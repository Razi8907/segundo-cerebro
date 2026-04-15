"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Line,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "#d97706", "PENDIENTE CONFIRMACION": "#b45309", GUIA_GENERADA: "#2563eb",
  "EN BODEGA ORIGEN": "#4f46e5", "RECOGIDO POR TRANSPORTADORA": "#7c3aed", MANIFIESTO: "#8b5cf6",
  "EN BODEGA DESTINO": "#0891b2", "EN REPARTO": "#0d9488", "SALIDA A RUTA": "#059669",
  "RUTEADO PARA SU ENTREGA": "#10b981", ENTREGADO: "#16a34a", NOVEDAD: "#ea580c",
  "NOVEDAD SOLUCIONADA": "#f97316", CANCELADO: "#dc2626", DEVOLUCION: "#b91c1c",
  "EN PROCESO DE DEVOLUCION": "#ef4444", RECHAZADO: "#991b1b", "GESTIONADO OPERATIVA": "#4b5563",
  "MAL RUTEO": "#6b7280", "REINGRESO A BODEGA": "#a21caf", PACTADO: "#0e7490",
  "REPACTADO LISTO PARA DESPACHO": "#06b6d4",
};

const STATUS_ORDER = [
  "PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA", "EN BODEGA ORIGEN",
  "RECOGIDO POR TRANSPORTADORA", "MANIFIESTO", "EN BODEGA DESTINO", "EN REPARTO",
  "SALIDA A RUTA", "RUTEADO PARA SU ENTREGA", "ENTREGADO", "NOVEDAD", "NOVEDAD SOLUCIONADA",
  "GESTIONADO OPERATIVA", "PACTADO", "REPACTADO LISTO PARA DESPACHO",
  "CANCELADO", "RECHAZADO", "EN PROCESO DE DEVOLUCION", "DEVOLUCION", "MAL RUTEO", "REINGRESO A BODEGA",
];

interface RawRow {
  estatus: string; fecha: string; proveedor: string; provId: number;
  dropshipper: string; dropshipperId: string; dropshipperEmail: string; dropshipperCelular: string;
  producto: string; productoId: string; cantidad: number; departamento: string;
  ciudad: string; transportadora: string; precioFlete: number;
}

interface LogisticsData {
  tasa_entrega: number;
  tasa_devolucion: number;
  tasa_en_proceso: number;
  tasa_cancelado: number;
  total_entregado: number;
  total_devolucion: number;
  total_en_proceso: number;
  total_cancelado: number;
  by_transportadora: { nombre: string; total: number; entregado: number; devolucion: number; pctEntrega: number; fletePromedio: number }[];
  by_departamento_flete: { departamento: string; total: number; fletePromedio: number; fleteMin: number; fleteMax: number; entregado: number; pctEntrega: number }[];
  by_ciudad_flete: { ciudad: string; departamento: string; total: number; fletePromedio: number }[];
}

interface AggData {
  total_orders: number;
  date_range: { from: string; to: string };
  by_status: Record<string, number>;
  by_date: { fecha: string; total: number; estados: Record<string, number> }[];
  by_proveedor: { nombre: string; id: number; total: number; estados: Record<string, number> }[];
  by_dropshipper: { nombre: string; total: number; estados: Record<string, number> }[];
  by_ds_daily: { ds: string; dsId: string; dsEmail: string; dsCelular: string; fecha: string; ordenes: number }[];
  by_ds_producto: { ds: string; producto: string; ordenes: number }[];
  by_producto: { nombre: string; productoId: string; proveedor: string; cantidad: number; ordenes: number }[];
  by_departamento: { nombre: string; total: number }[];
  logistics: LogisticsData;
}

function parseExcel(file: File): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const header = rows[0] as string[];
        const idx = (name: string) => header.indexOf(name);
        const iE = idx("ESTATUS"), iF = idx("FECHA"), iPN = idx("PROVEEDOR NOMBRE"),
          iPID = idx("PROVEEDOR ID"), iDS = idx("DROPSHIPPER"), iDSID = idx("DROPSHIPPER ID"),
          iDSEmail = idx("EMAIL"), iDSCel = idx("CELULAR"), iPR = idx("PRODUCTO"), iPRID = idx("PRODUCTO ID"),
          iC = idx("CANTIDAD"), iD = idx("DEPARTAMENTO DESTINO"), iCI = idx("CIUDAD DESTINO"),
          iTR = idx("TRANSPORTADORA"), iFL = idx("PRECIO FLETE");
        const parsed: RawRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          parsed.push({
            estatus: String(r[iE] || "DESCONOCIDO"), fecha: String(r[iF] || ""),
            proveedor: String(r[iPN] || "Sin proveedor"), provId: Number(r[iPID]) || 0,
            dropshipper: String(r[iDS] || "Sin dropshipper"),
            dropshipperId: String(r[iDSID] || ""), dropshipperEmail: iDSEmail >= 0 ? String(r[iDSEmail] || "") : "", dropshipperCelular: iDSCel >= 0 ? String(r[iDSCel] || "") : "",
            producto: String(r[iPR] || "Sin producto"),
            productoId: iPRID >= 0 && r[iPRID] ? String(r[iPRID]) : (String(r[iPR] || "").match(/^\d+-?$/) ? String(r[iPR] || "").replace(/-$/, "") : ""),
            cantidad: Number(r[iC]) || 1, departamento: String(r[iD] || "Sin departamento"),
            ciudad: String(r[iCI] || ""), transportadora: String(r[iTR] || "Sin transportadora"),
            precioFlete: Number(r[iFL]) || 0,
          });
        }
        resolve(parsed);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function aggregateRows(rows: RawRow[]): AggData {
  const by_status: Record<string, number> = {};
  const by_date_map: Record<string, { total: number; estados: Record<string, number> }> = {};
  const by_prov_map: Record<string, { id: number; total: number; estados: Record<string, number> }> = {};
  const by_ds_map: Record<string, { total: number; estados: Record<string, number> }> = {};
  const by_prod_map: Record<string, { productoId: string; proveedor: string; cantidad: number; ordenes: number }> = {};
  const by_dept_map: Record<string, number> = {};
  const ds_daily_map: Record<string, { ds: string; dsId: string; dsEmail: string; dsCelular: string; fecha: string; ordenes: number }> = {};
  const ds_prod_map: Record<string, { ds: string; producto: string; ordenes: number }> = {};

  for (const r of rows) {
    by_status[r.estatus] = (by_status[r.estatus] || 0) + 1;
    if (!by_date_map[r.fecha]) by_date_map[r.fecha] = { total: 0, estados: {} };
    by_date_map[r.fecha].total++;
    by_date_map[r.fecha].estados[r.estatus] = (by_date_map[r.fecha].estados[r.estatus] || 0) + 1;
    if (!by_prov_map[r.proveedor]) by_prov_map[r.proveedor] = { id: r.provId, total: 0, estados: {} };
    by_prov_map[r.proveedor].total++;
    by_prov_map[r.proveedor].estados[r.estatus] = (by_prov_map[r.proveedor].estados[r.estatus] || 0) + 1;
    if (!by_ds_map[r.dropshipper]) by_ds_map[r.dropshipper] = { total: 0, estados: {} };
    by_ds_map[r.dropshipper].total++;
    by_ds_map[r.dropshipper].estados[r.estatus] = (by_ds_map[r.dropshipper].estados[r.estatus] || 0) + 1;
    if (!by_prod_map[r.producto]) by_prod_map[r.producto] = { productoId: r.productoId || "", proveedor: r.proveedor || "", cantidad: 0, ordenes: 0 };
    if (r.productoId && !by_prod_map[r.producto].productoId) by_prod_map[r.producto].productoId = r.productoId;
    if (r.proveedor && !by_prod_map[r.producto].proveedor) by_prod_map[r.producto].proveedor = r.proveedor;
    by_prod_map[r.producto].cantidad += r.cantidad;
    by_prod_map[r.producto].ordenes++;
    by_dept_map[r.departamento] = (by_dept_map[r.departamento] || 0) + 1;

    // DS daily tracking
    const dsDayKey = `${r.dropshipper}||${r.fecha}`;
    if (!ds_daily_map[dsDayKey]) ds_daily_map[dsDayKey] = { ds: r.dropshipper, dsId: r.dropshipperId || "", dsEmail: r.dropshipperEmail || "", dsCelular: r.dropshipperCelular || "", fecha: r.fecha, ordenes: 0 };
    ds_daily_map[dsDayKey].ordenes++;

    // DS product tracking
    const dsProdKey = `${r.dropshipper}||${r.producto}`;
    if (!ds_prod_map[dsProdKey]) ds_prod_map[dsProdKey] = { ds: r.dropshipper, producto: r.producto, ordenes: 0 };
    ds_prod_map[dsProdKey].ordenes++;
  }
  const fechas = Object.keys(by_date_map).sort();

  // Logistics calculations
  const ENTREGA_STATES = ["ENTREGADO"];
  const DEV_STATES = ["DEVOLUCION", "EN PROCESO DE DEVOLUCION", "RECHAZADO", "REINGRESO A BODEGA"];
  const PROCESO_STATES = ["GUIA_GENERADA", "EN BODEGA ORIGEN", "RECOGIDO POR TRANSPORTADORA", "MANIFIESTO", "EN BODEGA DESTINO", "EN REPARTO", "SALIDA A RUTA", "RUTEADO PARA SU ENTREGA", "NOVEDAD", "NOVEDAD SOLUCIONADA", "GESTIONADO OPERATIVA", "PACTADO", "REPACTADO LISTO PARA DESPACHO", "MAL RUTEO"];
  const total_entregado = ENTREGA_STATES.reduce((s, st) => s + (by_status[st] || 0), 0);
  const total_devolucion = DEV_STATES.reduce((s, st) => s + (by_status[st] || 0), 0);
  const total_cancelado = by_status["CANCELADO"] || 0;
  const total_en_proceso = PROCESO_STATES.reduce((s, st) => s + (by_status[st] || 0), 0);
  // Base for delivery/return rates excludes cancelled orders
  const nSinCancelados = (rows.length - total_cancelado) || 1;

  // By transportadora
  const trans_map: Record<string, { total: number; totalSinCanc: number; entregado: number; devolucion: number; fletes: number[] }> = {};
  // By dept flete
  const dept_flete_map: Record<string, { total: number; totalSinCanc: number; entregado: number; fletes: number[] }> = {};
  // By ciudad flete
  const city_flete_map: Record<string, { dept: string; total: number; fletes: number[] }> = {};

  for (const r of rows) {
    if (!trans_map[r.transportadora]) trans_map[r.transportadora] = { total: 0, totalSinCanc: 0, entregado: 0, devolucion: 0, fletes: [] };
    trans_map[r.transportadora].total++;
    if (r.estatus !== "CANCELADO") trans_map[r.transportadora].totalSinCanc++;
    if (ENTREGA_STATES.includes(r.estatus)) trans_map[r.transportadora].entregado++;
    if (DEV_STATES.includes(r.estatus)) trans_map[r.transportadora].devolucion++;
    if (r.precioFlete > 0) trans_map[r.transportadora].fletes.push(r.precioFlete);

    if (!dept_flete_map[r.departamento]) dept_flete_map[r.departamento] = { total: 0, totalSinCanc: 0, entregado: 0, fletes: [] };
    dept_flete_map[r.departamento].total++;
    if (r.estatus !== "CANCELADO") dept_flete_map[r.departamento].totalSinCanc++;
    if (ENTREGA_STATES.includes(r.estatus)) dept_flete_map[r.departamento].entregado++;
    if (r.precioFlete > 0) dept_flete_map[r.departamento].fletes.push(r.precioFlete);

    const cityKey = `${r.ciudad}|${r.departamento}`;
    if (!city_flete_map[cityKey]) city_flete_map[cityKey] = { dept: r.departamento, total: 0, fletes: [] };
    city_flete_map[cityKey].total++;
    if (r.precioFlete > 0) city_flete_map[cityKey].fletes.push(r.precioFlete);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const logistics: LogisticsData = {
    tasa_entrega: (total_entregado / nSinCancelados) * 100,
    tasa_devolucion: (total_devolucion / nSinCancelados) * 100,
    tasa_en_proceso: (total_en_proceso / nSinCancelados) * 100,
    tasa_cancelado: (total_cancelado / (rows.length || 1)) * 100,
    total_entregado, total_devolucion, total_en_proceso, total_cancelado,
    by_transportadora: Object.entries(trans_map).map(([nombre, v]) => ({
      nombre, total: v.total, entregado: v.entregado, devolucion: v.devolucion,
      pctEntrega: v.totalSinCanc > 0 ? (v.entregado / v.totalSinCanc) * 100 : 0,
      fletePromedio: Math.round(avg(v.fletes)),
    })).sort((a, b) => b.total - a.total),
    by_departamento_flete: Object.entries(dept_flete_map).map(([departamento, v]) => ({
      departamento, total: v.total, entregado: v.entregado,
      fletePromedio: Math.round(avg(v.fletes)),
      fleteMin: v.fletes.length > 0 ? Math.round(Math.min(...v.fletes)) : 0,
      fleteMax: v.fletes.length > 0 ? Math.round(Math.max(...v.fletes)) : 0,
      pctEntrega: v.totalSinCanc > 0 ? (v.entregado / v.totalSinCanc) * 100 : 0,
    })).sort((a, b) => b.total - a.total),
    by_ciudad_flete: Object.entries(city_flete_map).map(([key, v]) => ({
      ciudad: key.split("|")[0], departamento: v.dept, total: v.total,
      fletePromedio: Math.round(avg(v.fletes)),
    })).filter((c) => c.ciudad && c.total >= 3).sort((a, b) => b.total - a.total),
  };

  return {
    total_orders: rows.length,
    date_range: { from: fechas[0] || "", to: fechas[fechas.length - 1] || "" },
    by_status,
    by_date: fechas.map((f) => ({ fecha: f, ...by_date_map[f] })),
    by_proveedor: Object.entries(by_prov_map).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total),
    by_dropshipper: Object.entries(by_ds_map).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total),
    by_ds_daily: Object.values(ds_daily_map).sort((a, b) => a.fecha.localeCompare(b.fecha) || b.ordenes - a.ordenes),
    by_ds_producto: Object.values(ds_prod_map).sort((a, b) => b.ordenes - a.ordenes),
    by_producto: Object.entries(by_prod_map).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.ordenes - a.ordenes),
    by_departamento: Object.entries(by_dept_map).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
    logistics,
  };
}

const PIE_COLORS = ["#ea580c", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#db2777", "#0d9488", "#d97706", "#4f46e5", "#0891b2", "#65a30d", "#a21caf"];
const TICK_STYLE = { fill: "#374151", fontSize: 10 };
const TICK_STYLE_SM = { fill: "#374151", fontSize: 9 };
const TOOLTIP_STYLE = { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", color: "#1f2937", fontSize: 11 };

/* ═══ STOCK PROJECTION SUB-COMPONENT ═══ */
function StockProjection({ country, aggData }: { country: string; aggData: AggData }) {
  const [stockData, setStockData] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => {
    fetch(`/api/data/stock?country=${country}`)
      .then((r) => r.json())
      .then((res) => { if (res.products) setStockData(res.products); })
      .catch(() => {});
  }, [country]);

  const diasCargados = aggData.by_date.length;
  const diasRestantes = 30 - diasCargados;

  // Find Pareto DS (80% of orders)
  const paretoDS = useMemo(() => {
    const sorted = [...aggData.by_dropshipper].sort((a, b) => b.total - a.total);
    const totalOrd = sorted.reduce((s, d) => s + d.total, 0);
    let acum = 0;
    const pareto: string[] = [];
    for (const ds of sorted) {
      if (pareto.length > 0 && acum >= totalOrd * 0.8) break;
      acum += ds.total;
      pareto.push(ds.nombre);
    }
    return pareto;
  }, [aggData.by_dropshipper]);

  // Get products sold by Pareto DS using by_ds_producto + enriched with by_producto data
  const paretoProducts = useMemo(() => {
    if (!aggData.by_ds_producto?.length) return [];
    const prodSet = new Set<string>();
    for (const dp of aggData.by_ds_producto) {
      if (paretoDS.includes(dp.ds)) prodSet.add(dp.producto);
    }
    // Get full product info from by_producto (has productoId, proveedor, cantidad)
    return aggData.by_producto
      .filter((p) => prodSet.has(p.nombre))
      .slice(0, 20);
  }, [aggData.by_ds_producto, aggData.by_producto, paretoDS]);

  const projections = useMemo(() => {
    if (!paretoProducts.length) return [];
    return paretoProducts.map((prod) => {
      const stock = stockData.find((s) => s.product_name === prod.nombre || s.product_id === prod.productoId);
      const stockActual = stock?.stock_actual ?? null;
      const demandaDiaria = diasCargados > 0 ? prod.cantidad / diasCargados : 0;
      const demandaRestante = Math.round(demandaDiaria * diasRestantes);
      const demandaTotal = Math.round(demandaDiaria * 30);
      const diasDeStock = stockActual !== null && demandaDiaria > 0 ? Math.round(stockActual / demandaDiaria) : null;
      const deficit = stockActual !== null ? Math.max(0, demandaRestante - stockActual) : null;
      return {
        product_id: prod.productoId || stock?.product_id || "", product_name: prod.nombre,
        proveedor: prod.proveedor || stock?.proveedor || "",
        stock_actual: stockActual, ordenes: prod.ordenes, unidades: prod.cantidad,
        demandaDiaria: Math.round(demandaDiaria), demandaRestante, demandaTotal,
        diasDeStock, deficit, hasStock: stockActual !== null,
      };
    }).sort((a: any, b: any) => {
      if (a.hasStock && !b.hasStock) return -1;
      if (!a.hasStock && b.hasStock) return 1;
      if (a.hasStock && b.hasStock) return (a.diasDeStock ?? 999) - (b.diasDeStock ?? 999);
      return b.ordenes - a.ordenes;
    });
  }, [paretoProducts, stockData, diasCargados, diasRestantes]);

  async function updateStock(productId: string, newStock: number) {
    await fetch("/api/data/stock", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, product_id: productId, stock_actual: newStock }),
    });
    setStockData((prev) => prev.map((p) => p.product_id === productId ? { ...p, stock_actual: newStock } : p));
    setEditing(null);
  }

  if (!projections.length) return null;

  const criticos = projections.filter((p: any) => p.hasStock && p.diasDeStock !== null && p.diasDeStock < 5);
  const alertas = projections.filter((p: any) => p.hasStock && p.diasDeStock !== null && p.diasDeStock >= 5 && p.diasDeStock < 10);
  const sinStock = projections.filter((p: any) => !p.hasStock);

  return (
    <div className="mb-6 p-4 rounded-xl border border-purple-500/20" style={{ background: "var(--bg-card)" }}>
      <h3 className="text-sm font-bold t-primary mb-1">📦 Proyección de Stock — Productos del Pareto</h3>
      <p className="text-[10px] t-muted mb-4">{diasCargados} días cargados · {diasRestantes} días restantes · Productos de los DS que generan el 80% · Click en stock para editar
        {sinStock.length > 0 && <span className="text-orange-500 ml-1">· {sinStock.length} sin stock cargado</span>}
      </p>

      {/* Alertas críticas */}
      {criticos.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border-2 border-red-500" style={{ background: "rgba(220,38,38,0.06)" }}>
          <p className="text-xs font-bold text-red-600 mb-1">🚨 STOCK CRÍTICO — {criticos.length} producto{criticos.length > 1 ? "s" : ""}</p>
          <div className="flex flex-wrap gap-2">
            {criticos.map((p: any) => (
              <span key={p.product_id} className="text-[10px] px-2 py-1 rounded-lg border border-red-500/30 text-red-600">
                {p.product_name}: <strong>{p.stock_actual} uds</strong> ({p.diasDeStock} días) — faltan {p.deficit}
              </span>
            ))}
          </div>
        </div>
      )}
      {alertas.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border border-yellow-500/30" style={{ background: "rgba(250,204,21,0.06)" }}>
          <p className="text-xs font-bold text-yellow-600 mb-1">⚠️ Stock bajo — {alertas.length} producto{alertas.length > 1 ? "s" : ""}</p>
          <div className="flex flex-wrap gap-2">
            {alertas.map((p: any) => (
              <span key={p.product_id} className="text-[10px] px-2 py-1 rounded-lg border border-yellow-500/20 text-yellow-600">
                {p.product_name}: <strong>{p.stock_actual} uds</strong> ({p.diasDeStock} días)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
            <tr className="border-b border-purple-500/20">
              <th className="text-center py-2 px-2 text-gray-400">Estado</th>
              <th className="text-left py-2 px-2 text-gray-400">ID</th>
              <th className="text-left py-2 px-2 text-gray-400">Producto</th>
              <th className="text-left py-2 px-2 text-gray-400">Proveedor</th>
              <th className="text-right py-2 px-2 text-gray-400">Vendidos</th>
              <th className="text-right py-2 px-2 text-gray-400">Dem/día</th>
              <th className="text-right py-2 px-2 text-gray-400">Dem. restante</th>
              <th className="text-right py-2 px-2 text-gray-400">Proy. total abril</th>
              <th className="text-right py-2 px-2 text-gray-400">Stock actual</th>
              <th className="text-right py-2 px-2 text-gray-400">Días de stock</th>
              <th className="text-right py-2 px-2 text-gray-400">Déficit</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p: any) => {
              const color = !p.hasStock ? "#6b7280" : p.diasDeStock < 5 ? "#dc2626" : p.diasDeStock < 10 ? "#d97706" : "#16a34a";
              const emoji = !p.hasStock ? "⚪" : p.diasDeStock < 5 ? "🔴" : p.diasDeStock < 10 ? "🟡" : "🟢";
              return (
                <tr key={p.product_id} className="border-b border-gray-800/40">
                  <td className="py-2 px-2 text-center">{emoji}</td>
                  <td className="py-2 px-2 t-muted text-[10px]">{p.product_id || "—"}</td>
                  <td className="py-2 px-2 t-primary font-medium">{p.product_name}</td>
                  <td className="py-2 px-2 t-secondary text-[10px]">{p.proveedor}</td>
                  <td className="py-2 px-2 text-right t-secondary">{p.unidades}</td>
                  <td className="py-2 px-2 text-right t-secondary">{p.demandaDiaria}</td>
                  <td className="py-2 px-2 text-right text-orange-500 font-bold">{p.demandaRestante}</td>
                  <td className="py-2 px-2 text-right t-secondary">{p.demandaTotal}</td>
                  <td className="py-2 px-2 text-right">
                    {editing === p.product_name ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                          className="w-16 px-1 py-0.5 text-xs rounded border border-orange-500/30 t-primary" style={{ background: "var(--bg-input)" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (p.hasStock) { updateStock(p.product_id, Number(editVal)); }
                              else {
                                fetch("/api/data/stock", { method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ country, product_id: String(Date.now()), product_name: p.product_name, proveedor: p.proveedor, stock_actual: Number(editVal) }),
                                }).then(() => { setStockData((prev) => [...prev, { product_id: String(Date.now()), product_name: p.product_name, proveedor: p.proveedor, stock_actual: Number(editVal) }]); setEditing(null); });
                              }
                            }
                          }} autoFocus />
                        <button onClick={() => {
                          if (p.hasStock) { updateStock(p.product_id, Number(editVal)); }
                          else {
                            fetch("/api/data/stock", { method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ country, product_id: String(Date.now()), product_name: p.product_name, proveedor: p.proveedor, stock_actual: Number(editVal) }),
                            }).then(() => { setStockData((prev) => [...prev, { product_id: String(Date.now()), product_name: p.product_name, proveedor: p.proveedor, stock_actual: Number(editVal) }]); setEditing(null); });
                          }
                        }} className="text-green-500 text-[10px]">✓</button>
                        <button onClick={() => setEditing(null)} className="text-red-500 text-[10px]">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(p.product_name); setEditVal(String(p.stock_actual ?? 0)); }}
                        className="font-bold hover:underline cursor-pointer" style={{ color }}>
                        {p.hasStock ? p.stock_actual : "Cargar"}
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right font-bold" style={{ color }}>{!p.hasStock ? "—" : p.diasDeStock >= 999 ? "∞" : `${p.diasDeStock}d`}</td>
                  <td className="py-2 px-2 text-right font-bold" style={{ color: !p.hasStock ? "#6b7280" : p.deficit > 0 ? "#dc2626" : "#16a34a" }}>
                    {!p.hasStock ? "Sin dato" : p.deficit > 0 ? `-${p.deficit}` : "✓"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-2 text-[9px] t-muted">
        <span>🟢 Stock suficiente (10+ días)</span>
        <span>🟡 Stock bajo (5-10 días)</span>
        <span>🔴 Crítico (&lt;5 días)</span>
        <span>⚪ Sin stock cargado — click en "Cargar"</span>
      </div>
    </div>
  );
}

export default function OperationalUpload({ country }: { country: "py" | "ar" }) {
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [savedAgg, setSavedAgg] = useState<AggData | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "proveedor" | "dropshipper">("all");
  const [selectedDS, setSelectedDS] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [fProveedor, setFProveedor] = useState("");
  const [fDropshipper, setFDropshipper] = useState("");
  const [fTransportadora, setFTransportadora] = useState("");
  const [recLogistic, setRecLogistic] = useState("");

  useEffect(() => {
    fetch(`/api/data/operational?country=${country}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setSavedAgg(res.data);
          setUploadedAt(res.uploaded_at);
          // Load saved raw rows for filtering
          if (res.data.raw_rows && Array.isArray(res.data.raw_rows)) {
            setRawRows(res.data.raw_rows);
          } else if (res.data.compact_rows && Array.isArray(res.data.compact_rows)) {
            // Expand compact rows
            setRawRows(res.data.compact_rows.map((r: any) => ({
              estatus: r.e||"", fecha: r.f||"", proveedor: r.p||"", provId: r.pi||0,
              dropshipper: r.d||"", dropshipperId: r.di||"", dropshipperEmail: r.de||"", dropshipperCelular: r.dc||"",
              producto: r.pr||"", productoId: r.pri||"", cantidad: r.c||1, departamento: r.dp||"",
              ciudad: r.ci||"", transportadora: r.t||"", precioFlete: r.fl||0,
            })));
          }
        }
      })
      .catch(() => {});
  }, [country]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const rows = await parseExcel(file);
      setRawRows(rows);
      const agg = aggregateRows(rows);
      setSavedAgg(agg);
      setFilterType("all"); setFilterValue("");
      // Save aggregation + compact raw_rows in chunks to avoid Vercel payload limit
      const saveData = { ...agg };
      // Compact raw_rows: only keep fields needed for filtering
      const compactRows = rows.map((r) => ({
        e: r.estatus, f: r.fecha, p: r.proveedor, pi: r.provId,
        d: r.dropshipper, di: r.dropshipperId, de: r.dropshipperEmail, dc: r.dropshipperCelular,
        pr: r.producto, pri: r.productoId, c: r.cantidad, dp: r.departamento,
        ci: r.ciudad, t: r.transportadora, fl: r.precioFlete,
      }));
      (saveData as any).compact_rows = compactRows;

      // Try saving, if too large save without rows
      try {
        const payload = JSON.stringify({ country, data: saveData, raw_count: agg.total_orders });
        if (payload.length > 4000000) {
          // Too large for Vercel, save without compact_rows
          delete (saveData as any).compact_rows;
          await fetch("/api/data/operational", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country, data: saveData, raw_count: agg.total_orders }),
          });
        } else {
          await fetch("/api/data/operational", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: payload,
          });
        }
      } catch {
        // Fallback: save without rows
        delete (saveData as any).compact_rows;
        await fetch("/api/data/operational", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country, data: saveData, raw_count: agg.total_orders }),
        });
      }
      setUploadedAt(new Date().toISOString());
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al procesar el archivo.");
    }
    setUploading(false);
    e.target.value = "";
  }, [country]);

  // Full aggregation (no filter)
  const fullAgg = useMemo(() => {
    if (rawRows.length > 0) return aggregateRows(rawRows);
    return savedAgg;
  }, [rawRows, savedAgg]);

  // Filter options from raw rows
  const globalFilterOptions = useMemo(() => {
    if (rawRows.length === 0) return { proveedores: [] as string[], dropshippers: [] as string[], transportadoras: [] as string[] };
    const provSet = new Set<string>(), dsSet = new Set<string>(), trSet = new Set<string>();
    for (const r of rawRows) {
      if (r.proveedor) provSet.add(r.proveedor);
      if (r.dropshipper) dsSet.add(r.dropshipper);
      if (r.transportadora) trSet.add(r.transportadora);
    }
    return { proveedores: Array.from(provSet).sort(), dropshippers: Array.from(dsSet).sort(), transportadoras: Array.from(trSet).sort() };
  }, [rawRows]);

  const hasGlobalFilter = fProveedor || fDropshipper || fTransportadora;
  const clearGlobalFilters = () => { setFProveedor(""); setFDropshipper(""); setFTransportadora(""); setFilterType("all"); setFilterValue(""); };

  // Filtered aggregation — always re-aggregate from raw rows
  const aggData = useMemo(() => {
    if (!fullAgg) return null;
    if (rawRows.length === 0) return fullAgg;
    // Apply new global filters
    if (!fProveedor && !fDropshipper && !fTransportadora) {
      // Fall back to legacy filter
      if (filterType === "all" || !filterValue) return fullAgg;
      const filtered = filterType === "proveedor"
        ? rawRows.filter((r) => r.proveedor === filterValue)
        : rawRows.filter((r) => r.dropshipper === filterValue);
      if (filtered.length === 0) return fullAgg;
      return aggregateRows(filtered);
    }
    let filtered = rawRows;
    if (fProveedor) filtered = filtered.filter((r) => r.proveedor === fProveedor);
    if (fDropshipper) filtered = filtered.filter((r) => r.dropshipper === fDropshipper);
    if (fTransportadora) filtered = filtered.filter((r) => r.transportadora === fTransportadora);
    if (filtered.length === 0) return fullAgg;
    return aggregateRows(filtered);
  }, [fullAgg, rawRows, filterType, filterValue, fProveedor, fDropshipper, fTransportadora]);

  const allStatuses = useMemo(() => {
    if (!aggData) return [];
    return STATUS_ORDER.filter((s) => aggData.by_status[s]);
  }, [aggData]);

  // Best logistics recommendation per city based on delivery/return rates
  const cityLogisticsRecommendation = useMemo(() => {
    if (rawRows.length === 0) return [];
    // Apply same global filters
    let filtered = rawRows;
    if (fProveedor) filtered = filtered.filter((r) => r.proveedor === fProveedor);
    if (fDropshipper) filtered = filtered.filter((r) => r.dropshipper === fDropshipper);
    // Do NOT filter by transportadora here — we need all to compare
    const ENTREGA = ["ENTREGADO"];
    const DEV = ["DEVOLUCION", "EN PROCESO DE DEVOLUCION", "RECHAZADO", "REINGRESO A BODEGA"];

    // Group by city + transportadora
    type Bucket = { ciudad: string; dept: string; trans: string; total: number; entregado: number; devuelto: number; fletes: number[] };
    const buckets = new Map<string, Bucket>();
    for (const r of filtered) {
      if (!r.ciudad || !r.transportadora) continue;
      if (r.estatus === "CANCELADO") continue;
      const key = `${r.ciudad}|${r.departamento}|${r.transportadora}`;
      let b = buckets.get(key);
      if (!b) {
        b = { ciudad: r.ciudad, dept: r.departamento, trans: r.transportadora, total: 0, entregado: 0, devuelto: 0, fletes: [] };
        buckets.set(key, b);
      }
      b.total++;
      if (ENTREGA.includes(r.estatus)) b.entregado++;
      if (DEV.includes(r.estatus)) b.devuelto++;
      if (r.precioFlete > 0) b.fletes.push(r.precioFlete);
    }

    // Group by city, rank transportadoras
    type CityResult = {
      ciudad: string;
      dept: string;
      totalCity: number;
      best: { trans: string; pctEntrega: number; pctDev: number; total: number; fletePromedio: number } | null;
      alternatives: { trans: string; pctEntrega: number; pctDev: number; total: number; fletePromedio: number }[];
    };
    const byCity = new Map<string, { dept: string; transOptions: Bucket[] }>();
    for (const b of buckets.values()) {
      const k = `${b.ciudad}|${b.dept}`;
      let c = byCity.get(k);
      if (!c) { c = { dept: b.dept, transOptions: [] }; byCity.set(k, c); }
      c.transOptions.push(b);
    }

    const results: CityResult[] = [];
    for (const [key, c] of byCity.entries()) {
      const [ciudad] = key.split("|");
      const totalCity = c.transOptions.reduce((s, t) => s + t.total, 0);
      if (totalCity < 5) continue; // skip low-volume cities

      const ranked = c.transOptions
        .filter((t) => t.total >= 3) // need min 3 guides per trans to be meaningful
        .map((t) => ({
          trans: t.trans,
          pctEntrega: t.total > 0 ? (t.entregado / t.total) * 100 : 0,
          pctDev: t.total > 0 ? (t.devuelto / t.total) * 100 : 0,
          total: t.total,
          fletePromedio: t.fletes.length > 0 ? Math.round(t.fletes.reduce((a, b) => a + b, 0) / t.fletes.length) : 0,
          // Score: prioritize high delivery, penalize high return
          score: (t.total > 0 ? (t.entregado / t.total) * 100 : 0) - (t.total > 0 ? (t.devuelto / t.total) * 100 * 0.5 : 0),
        }))
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) continue;
      const [best, ...alternatives] = ranked;
      results.push({
        ciudad,
        dept: c.dept,
        totalCity,
        best: { trans: best.trans, pctEntrega: best.pctEntrega, pctDev: best.pctDev, total: best.total, fletePromedio: best.fletePromedio },
        alternatives: alternatives.map(({ trans, pctEntrega, pctDev, total, fletePromedio }) => ({ trans, pctEntrega, pctDev, total, fletePromedio })),
      });
    }

    return results.sort((a, b) => b.totalCity - a.totalCity);
  }, [rawRows, fProveedor, fDropshipper]);

  // Cities performance for a specific logistic (when user selects one in recommendation filter)
  const citiesByLogistic = useMemo(() => {
    if (!recLogistic || rawRows.length === 0) return [];
    let filtered = rawRows.filter((r) => r.transportadora === recLogistic);
    if (fProveedor) filtered = filtered.filter((r) => r.proveedor === fProveedor);
    if (fDropshipper) filtered = filtered.filter((r) => r.dropshipper === fDropshipper);
    const ENTREGA = ["ENTREGADO"];
    const DEV = ["DEVOLUCION", "EN PROCESO DE DEVOLUCION", "RECHAZADO", "REINGRESO A BODEGA"];

    const byCity = new Map<string, { ciudad: string; dept: string; total: number; entregado: number; devuelto: number; fletes: number[] }>();
    for (const r of filtered) {
      if (!r.ciudad) continue;
      if (r.estatus === "CANCELADO") continue;
      const key = `${r.ciudad}|${r.departamento}`;
      let b = byCity.get(key);
      if (!b) { b = { ciudad: r.ciudad, dept: r.departamento, total: 0, entregado: 0, devuelto: 0, fletes: [] }; byCity.set(key, b); }
      b.total++;
      if (ENTREGA.includes(r.estatus)) b.entregado++;
      if (DEV.includes(r.estatus)) b.devuelto++;
      if (r.precioFlete > 0) b.fletes.push(r.precioFlete);
    }
    return Array.from(byCity.values())
      .filter((c) => c.total >= 3)
      .map((c) => ({
        ciudad: c.ciudad,
        dept: c.dept,
        total: c.total,
        pctEntrega: (c.entregado / c.total) * 100,
        pctDev: (c.devuelto / c.total) * 100,
        fletePromedio: c.fletes.length > 0 ? Math.round(c.fletes.reduce((a, b) => a + b, 0) / c.fletes.length) : 0,
        score: (c.entregado / c.total) * 100 - (c.devuelto / c.total) * 100 * 0.5,
      }))
      .sort((a, b) => b.score - a.score);
  }, [recLogistic, rawRows, fProveedor, fDropshipper]);

  const countryLabel = country === "py" ? "Paraguay" : "Argentina";

  if (!aggData) {
    return (
      <div className="glass-card p-6 border-cyan-500/30">
        <h2 className="text-xl font-bold t-primary mb-1">📋 Análisis Operacional — Abril {countryLabel}</h2>
        <p className="text-xs t-secondary mb-4">Subí el archivo Excel del dashboard comercial de Dropi para ver el análisis</p>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg dropi-gradient text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          {uploading ? "Procesando..." : "Subir Excel de Abril"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    );
  }

  const isFiltered = filterType !== "all" && !!filterValue;
  const filterLabel = isFiltered ? `${filterType === "proveedor" ? "Proveedor" : "Dropshipper"}: ${filterValue}` : "Todos";

  const statusChartData = allStatuses.map((s) => ({
    name: s.length > 20 ? s.slice(0, 20) + "…" : s,
    fullName: s, value: aggData.by_status[s] || 0, fill: STATUS_COLORS[s] || "#6B7280",
  }));

  const dateChartData = aggData.by_date.map((d) => ({
    fecha: d.fecha.replace(/-04-2026$/, "/04").replace(/-04-2026/, "/04"),
    total: d.total, entregado: d.estados["ENTREGADO"] || 0, cancelado: d.estados["CANCELADO"] || 0,
  }));

  return (
    <ChartDownloadBtn filename={`Operacional_Abril_${countryLabel}`}>
    <div className="glass-card p-6 border-cyan-500/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold t-primary mb-1">📋 Análisis Operacional — Abril {countryLabel}</h2>
          <p className="text-xs t-secondary">
            {(fullAgg?.total_orders || 0).toLocaleString()} guías totales &middot; {aggData.date_range.from} al {aggData.date_range.to}
            {uploadedAt && <span className="ml-2 text-orange-500">Act: {new Date(uploadedAt).toLocaleString("es-PY")}</span>}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-500/30 text-orange-500 text-xs cursor-pointer hover:bg-orange-500/10 transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          {uploading ? "Procesando..." : "Actualizar archivo"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* GLOBAL FILTERS */}
      <div className="mb-5 p-3 rounded-xl border border-orange-500/20" style={{ background: "var(--bg-card-hover)" }}>
        {rawRows.length > 0 ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] t-muted uppercase tracking-wider">Logistica</label>
                <select value={fTransportadora} onChange={(e) => setFTransportadora(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-orange-500/20 t-primary focus:outline-none min-w-[140px]" style={{ background: "var(--bg-input)" }}>
                  <option value="">Todas</option>
                  {globalFilterOptions.transportadoras.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] t-muted uppercase tracking-wider">Dropshipper</label>
                <select value={fDropshipper} onChange={(e) => setFDropshipper(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-orange-500/20 t-primary focus:outline-none min-w-[140px]" style={{ background: "var(--bg-input)" }}>
                  <option value="">Todos</option>
                  {globalFilterOptions.dropshippers.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] t-muted uppercase tracking-wider">Proveedor</label>
                <select value={fProveedor} onChange={(e) => setFProveedor(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-orange-500/20 t-primary focus:outline-none min-w-[140px]" style={{ background: "var(--bg-input)" }}>
                  <option value="">Todos</option>
                  {globalFilterOptions.proveedores.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {hasGlobalFilter && (
                <button onClick={clearGlobalFilters} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10">
                  Limpiar filtros
                </button>
              )}
            </div>
            {hasGlobalFilter && (
              <p className="text-xs text-orange-500 font-medium mt-2">
                Mostrando {aggData.total_orders.toLocaleString()} de {(fullAgg?.total_orders || 0).toLocaleString()} guias
                {fTransportadora && ` · Logistica: ${fTransportadora}`}
                {fDropshipper && ` · DS: ${fDropshipper}`}
                {fProveedor && ` · Prov: ${fProveedor}`}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs t-muted">Subi el archivo Excel nuevamente para activar los filtros por logistica, dropshipper y proveedor.</p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Guías", value: aggData.total_orders, sub: `${aggData.by_date.length} días`, color: "blue" },
          { label: "Entregados", value: aggData.by_status["ENTREGADO"] || 0, sub: `${aggData.total_orders > 0 ? ((aggData.by_status["ENTREGADO"] || 0) / aggData.total_orders * 100).toFixed(1) : 0}%`, color: "green" },
          { label: "En Tránsito", value: (aggData.by_status["EN BODEGA ORIGEN"] || 0) + (aggData.by_status["EN BODEGA DESTINO"] || 0) + (aggData.by_status["EN REPARTO"] || 0) + (aggData.by_status["RECOGIDO POR TRANSPORTADORA"] || 0), sub: "bodega + reparto", color: "orange" },
          { label: "Cancelados", value: aggData.by_status["CANCELADO"] || 0, sub: `${aggData.total_orders > 0 ? ((aggData.by_status["CANCELADO"] || 0) / aggData.total_orders * 100).toFixed(1) : 0}%`, color: "red" },
          { label: "Proveedores", value: aggData.by_proveedor.length, sub: `${aggData.by_dropshipper.length} dropshippers`, color: "purple" },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl p-3 border border-${k.color}-500/20`} style={{ background: "var(--bg-card)" }}>
            <p className="text-[10px] t-muted uppercase">{k.label}</p>
            <p className={`text-xl font-bold text-${k.color}-500`}>{k.value.toLocaleString()}</p>
            <p className="text-[10px] t-muted">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ═══ PARETO DROPSHIPPERS ═══ */}
      {aggData.by_dropshipper.length > 0 && (() => {
        const sorted = [...aggData.by_dropshipper].sort((a, b) => b.total - a.total);
        const totalOrdenes = sorted.reduce((s, d) => s + d.total, 0);
        const totalDS = sorted.length;

        // Find pareto: DS that make 80% of orders
        let acum = 0;
        let paretoCount = 0;
        const paretoDS: typeof sorted = [];
        const noParetoDS: typeof sorted = [];
        for (const ds of sorted) {
          acum += ds.total;
          if (acum <= totalOrdenes * 0.8) {
            paretoCount++;
            paretoDS.push(ds);
          } else if (paretoDS.length === 0 || acum - ds.total < totalOrdenes * 0.8) {
            paretoCount++;
            paretoDS.push(ds);
          } else {
            noParetoDS.push(ds);
          }
        }
        // Make sure at least the ones up to 80% are in pareto
        if (paretoDS.length === 0 && sorted.length > 0) {
          paretoDS.push(sorted[0]);
          paretoCount = 1;
        }
        const paretoOrdenes = paretoDS.reduce((s, d) => s + d.total, 0);
        const paretoPct = totalOrdenes > 0 ? ((paretoOrdenes / totalOrdenes) * 100).toFixed(1) : "0";
        const paretoDSPct = totalDS > 0 ? ((paretoCount / totalDS) * 100).toFixed(1) : "0";

        return (
          <div className="mb-6 p-4 rounded-xl border border-orange-500/20" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-sm font-bold t-primary mb-3">📊 Ley de Pareto — Dropshippers {isFiltered ? `(${filterLabel})` : ""}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">DS Activos</p>
                <p className="text-2xl font-bold text-blue-500">{totalDS}</p>
                <p className="text-[10px] t-muted">{totalOrdenes.toLocaleString()} órdenes</p>
              </div>
              <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">Hacen el 80% (Pareto)</p>
                <p className="text-2xl font-bold text-green-500">{paretoCount}</p>
                <p className="text-[10px] t-muted">{paretoDSPct}% de los DS → {paretoPct}% órdenes</p>
              </div>
              <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">No hacen Pareto</p>
                <p className="text-2xl font-bold text-orange-500">{totalDS - paretoCount}</p>
                <p className="text-[10px] t-muted">{(100 - Number(paretoDSPct)).toFixed(1)}% de los DS → {(100 - Number(paretoPct)).toFixed(1)}% órdenes</p>
              </div>
              <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: "rgba(139,92,246,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">Prom por DS Pareto</p>
                <p className="text-2xl font-bold text-purple-500">{paretoCount > 0 ? Math.round(paretoOrdenes / paretoCount) : 0}</p>
                <p className="text-[10px] t-muted">vs {totalDS - paretoCount > 0 ? Math.round((totalOrdenes - paretoOrdenes) / (totalDS - paretoCount)) : 0} prom resto</p>
              </div>
            </div>

            {/* Pareto DS list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-green-500 mb-2">Top Pareto ({paretoCount} DS = {paretoPct}% órdenes)</h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {paretoDS.map((d, i) => (
                    <div key={d.nombre} className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-green-500/5">
                      <span className="t-primary truncate max-w-[200px]"><span className="text-green-500 font-bold mr-1">{i + 1}.</span>{d.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 font-bold">{d.total}</span>
                        <span className="t-muted text-[10px]">{totalOrdenes > 0 ? ((d.total / totalOrdenes) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-2 py-2 mt-1 border-t border-green-500/20 text-xs font-bold">
                  <span className="text-green-500">TOTAL</span>
                  <span className="text-green-500">{paretoOrdenes.toLocaleString()} órdenes</span>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-orange-500 mb-2">Fuera de Pareto ({totalDS - paretoCount} DS = {(100 - Number(paretoPct)).toFixed(1)}% órdenes)</h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {noParetoDS.slice(0, 20).map((d, i) => (
                    <div key={d.nombre} className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-orange-500/5">
                      <span className="t-secondary truncate max-w-[200px]"><span className="text-orange-500 mr-1">{i + 1}.</span>{d.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500">{d.total}</span>
                        <span className="t-muted text-[10px]">{totalOrdenes > 0 ? ((d.total / totalOrdenes) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </div>
                  ))}
                  {noParetoDS.length > 20 && <p className="text-[10px] t-muted px-2">+{noParetoDS.length - 20} más...</p>}
                </div>
                <div className="flex items-center justify-between px-2 py-2 mt-1 border-t border-orange-500/20 text-xs font-bold">
                  <span className="text-orange-500">TOTAL</span>
                  <span className="text-orange-500">{(totalOrdenes - paretoOrdenes).toLocaleString()} órdenes</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ ALERTA PENDIENTES +24HS ═══ */}
      {rawRows.length > 0 && (() => {
        const now = new Date();
        // Get filtered rows based on current global filters
        let filtered = rawRows;
        if (fProveedor) filtered = filtered.filter((r) => r.proveedor === fProveedor);
        if (fDropshipper) filtered = filtered.filter((r) => r.dropshipper === fDropshipper);
        if (fTransportadora) filtered = filtered.filter((r) => r.transportadora === fTransportadora);

        const pendientes = filtered.filter((r) => {
          if (r.estatus !== "PENDIENTE" && r.estatus !== "PENDIENTE CONFIRMACION") return false;
          if (!r.fecha) return false;
          // Parse fecha: could be "DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD" or similar
          let d: Date | null = null;
          const parts = r.fecha.match(/(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})/);
          if (parts) {
            const a = parseInt(parts[1]), b = parseInt(parts[2]), c = parseInt(parts[3]);
            if (a > 1000) d = new Date(a, b - 1, c); // YYYY-MM-DD
            else if (c > 1000) d = new Date(c, b - 1, a); // DD-MM-YYYY
          }
          if (!d || isNaN(d.getTime())) return false;
          const horasDesde = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
          return horasDesde > 24;
        });

        if (pendientes.length === 0) return null;

        // Group by proveedor
        const byProv: Record<string, { count: number; guias: string[] }> = {};
        for (const r of pendientes) {
          if (!byProv[r.proveedor]) byProv[r.proveedor] = { count: 0, guias: [] };
          byProv[r.proveedor].count++;
          if (byProv[r.proveedor].guias.length < 5) byProv[r.proveedor].guias.push(`${r.dropshipper} (${r.fecha})`);
        }
        const provList = Object.entries(byProv).sort((a, b) => b[1].count - a[1].count);

        return (
          <div className="mb-6 p-4 rounded-xl border-2 border-red-500" style={{ background: "rgba(220,38,38,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🚨</span>
              <h3 className="text-sm font-bold text-red-500">Alerta: {pendientes.length} guias PENDIENTES +24hs sin pasar a Guia Generada</h3>
            </div>
            <p className="text-xs t-muted mb-3">Estas guias llevan mas de 24 horas en estado Pendiente. El proveedor debe generar la guia.</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {provList.map(([prov, data]) => (
                <div key={prov} className="p-3 rounded-lg border border-red-500/20" style={{ background: "var(--bg-card)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold t-primary">{prov}</span>
                    <span className="text-xs font-bold text-red-500">{data.count} guia{data.count > 1 ? "s" : ""} parada{data.count > 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.guias.map((g, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{g}</span>
                    ))}
                    {data.count > 5 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">+{data.count - 5} mas</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ═══ PARETO PROVEEDORES ═══ */}
      {aggData.by_proveedor.length > 0 && (() => {
        const sorted = [...aggData.by_proveedor].sort((a, b) => b.total - a.total);
        const totalOrdenes = sorted.reduce((s, d) => s + d.total, 0);
        const totalProv = sorted.length;

        let acum = 0;
        const paretoProv: typeof sorted = [];
        const noParetoProv: typeof sorted = [];
        for (const p of sorted) {
          acum += p.total;
          if (paretoProv.length === 0 || acum - p.total < totalOrdenes * 0.8) {
            paretoProv.push(p);
          } else {
            noParetoProv.push(p);
          }
        }
        const paretoOrdenes = paretoProv.reduce((s, d) => s + d.total, 0);
        const paretoPct = totalOrdenes > 0 ? ((paretoOrdenes / totalOrdenes) * 100).toFixed(1) : "0";
        const paretoProvPct = totalProv > 0 ? ((paretoProv.length / totalProv) * 100).toFixed(1) : "0";

        return (
          <div className="mb-6 p-4 rounded-xl border border-blue-500/20" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-sm font-bold t-primary mb-3">📊 Ley de Pareto — Proveedores {isFiltered ? `(${filterLabel})` : ""}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">Proveedores Activos</p>
                <p className="text-2xl font-bold text-blue-500">{totalProv}</p>
                <p className="text-[10px] t-muted">{totalOrdenes.toLocaleString()} órdenes</p>
              </div>
              <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">Hacen el 80% (Pareto)</p>
                <p className="text-2xl font-bold text-green-500">{paretoProv.length}</p>
                <p className="text-[10px] t-muted">{paretoProvPct}% de provs → {paretoPct}% órdenes</p>
              </div>
              <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">No hacen Pareto</p>
                <p className="text-2xl font-bold text-orange-500">{totalProv - paretoProv.length}</p>
                <p className="text-[10px] t-muted">{(100 - Number(paretoProvPct)).toFixed(1)}% de provs → {(100 - Number(paretoPct)).toFixed(1)}% órdenes</p>
              </div>
              <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: "rgba(139,92,246,0.05)" }}>
                <p className="text-[10px] t-muted uppercase">Prom por Prov Pareto</p>
                <p className="text-2xl font-bold text-purple-500">{paretoProv.length > 0 ? Math.round(paretoOrdenes / paretoProv.length) : 0}</p>
                <p className="text-[10px] t-muted">vs {noParetoProv.length > 0 ? Math.round((totalOrdenes - paretoOrdenes) / noParetoProv.length) : 0} prom resto</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-green-500 mb-2">Top Pareto ({paretoProv.length} provs = {paretoPct}% órdenes)</h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {paretoProv.map((p, i) => (
                    <div key={p.nombre} className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-green-500/5">
                      <span className="t-primary truncate max-w-[200px]"><span className="text-green-500 font-bold mr-1">{i + 1}.</span>{p.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 font-bold">{p.total}</span>
                        <span className="t-muted text-[10px]">{totalOrdenes > 0 ? ((p.total / totalOrdenes) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-2 py-2 mt-1 border-t border-green-500/20 text-xs font-bold">
                  <span className="text-green-500">TOTAL</span>
                  <span className="text-green-500">{paretoOrdenes.toLocaleString()} órdenes</span>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-orange-500 mb-2">Fuera de Pareto ({noParetoProv.length} provs = {(100 - Number(paretoPct)).toFixed(1)}% órdenes)</h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {noParetoProv.map((p, i) => (
                    <div key={p.nombre} className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-orange-500/5">
                      <span className="t-secondary truncate max-w-[200px]"><span className="text-orange-500 mr-1">{i + 1}.</span>{p.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500">{p.total}</span>
                        <span className="t-muted text-[10px]">{totalOrdenes > 0 ? ((p.total / totalOrdenes) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-2 py-2 mt-1 border-t border-orange-500/20 text-xs font-bold">
                  <span className="text-orange-500">TOTAL</span>
                  <span className="text-orange-500">{(totalOrdenes - paretoOrdenes).toLocaleString()} órdenes</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ DROPSHIPPER DAILY TRACKING ═══ */}
      {aggData.by_ds_daily.length > 0 && (() => {
        // Build DS daily data with trend detection
        const dsNames = Array.from(new Set(aggData.by_ds_daily.map((d) => d.ds)));
        const fechas = Array.from(new Set(aggData.by_ds_daily.map((d) => d.fecha))).sort();

        // Per DS: daily orders + trend
        const dsAnalysis = dsNames.map((ds) => {
          const firstEntry = aggData.by_ds_daily.find((d) => d.ds === ds);
          const dsId = firstEntry?.dsId || "";
          const dsEmail = firstEntry?.dsEmail || "";
          const dsCelular = firstEntry?.dsCelular || "";
          const daily = fechas.map((f) => {
            const entry = aggData.by_ds_daily.find((d) => d.ds === ds && d.fecha === f);
            return { fecha: f, ordenes: entry?.ordenes || 0 };
          });
          const total = daily.reduce((s, d) => s + d.ordenes, 0);
          const daysActive = daily.filter((d) => d.ordenes > 0).length;
          const avg = daysActive > 0 ? total / daysActive : 0;

          // Trend: compare last 2 days with average
          const lastDays = daily.filter((d) => d.ordenes > 0).slice(-3);
          const lastAvg = lastDays.length > 0 ? lastDays.reduce((s, d) => s + d.ordenes, 0) / lastDays.length : 0;
          const trend = avg > 0 ? ((lastAvg - avg) / avg) * 100 : 0;
          const alert = trend < -30 && total > 10; // Dropping >30% and has significant volume

          // Products for this DS
          const productos = aggData.by_ds_producto
            .filter((p) => p.ds === ds)
            .sort((a, b) => b.ordenes - a.ordenes)
            .slice(0, 5);

          return { ds, dsId, dsEmail, dsCelular, daily, total, daysActive, avg: Math.round(avg), lastAvg: Math.round(lastAvg), trend: Math.round(trend), alert, productos };
        })
        .filter((d) => d.total > 5) // Only show DS with >5 orders
        .sort((a, b) => b.total - a.total);

        const alertDS = dsAnalysis.filter((d) => d.alert);

        return (
          <div className="mb-6">
            <h3 className="text-sm font-bold t-primary mb-3">📈 Seguimiento Diario por Dropshipper {isFiltered ? `— ${filterLabel}` : ""}</h3>

            {/* Alert for dropping DS */}
            {alertDS.length > 0 && !isFiltered && (
              <div className="mb-3 p-3 rounded-xl border border-red-500/30" style={{ background: "rgba(220,38,38,0.05)" }}>
                <p className="text-xs font-bold text-red-600 mb-1">⚠️ Dropshippers bajando volumen ({alertDS.length})</p>
                <div className="flex flex-wrap gap-2">
                  {alertDS.map((d) => (
                    <button key={d.ds} onClick={() => { setSelectedDS(d.ds); setFilterType("dropshipper"); setFilterValue(d.ds); }}
                      className="text-[10px] px-2 py-1 rounded-lg border border-red-500/20 text-red-600 hover:bg-red-500/10">
                      {d.ds.split("(")[0].trim()} <span className="font-bold">{d.trend}%</span> (prom {d.avg} → {d.lastAvg})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DS table with daily breakdown */}
            <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                  <tr className="border-b border-orange-500/20">
                    <th className="text-left py-2 px-2 text-gray-400 sticky left-0" style={{ background: "rgba(22,33,62,0.98)" }}>Dropshipper</th>
                    <th className="text-left py-2 px-2 text-gray-400">ID</th>
                    <th className="text-left py-2 px-2 text-gray-400">Email</th>
                    <th className="text-right py-2 px-2 text-gray-400">Total</th>
                    <th className="text-right py-2 px-2 text-gray-400">Prom/día</th>
                    <th className="text-right py-2 px-2 text-gray-400">Tendencia</th>
                    {fechas.map((f) => (
                      <th key={f} className="text-right py-2 px-2 text-gray-400 whitespace-nowrap">{f.replace(/-2026$/, "").replace(/-04-/, "/")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dsAnalysis.slice(0, 30).map((d) => (
                    <tr key={d.ds} className={`border-b border-gray-800/40 hover:bg-orange-500/5 cursor-pointer ${selectedDS === d.ds ? "bg-orange-500/10" : ""}`}
                      onClick={() => { const newDS = selectedDS === d.ds ? "" : d.ds; setSelectedDS(newDS); if (newDS) { setFilterType("dropshipper"); setFilterValue(newDS); } else { setFilterType("all"); setFilterValue(""); } }}>
                      <td className="py-2 px-2 t-primary font-medium whitespace-nowrap sticky left-0 max-w-[180px] truncate" style={{ background: "var(--bg-card)" }} title={d.ds}>
                        {d.alert && <span className="mr-1">⚠️</span>}{d.ds.length > 25 ? d.ds.slice(0, 25) + "…" : d.ds}
                      </td>
                      <td className="py-2 px-2 t-primary text-[10px]">{d.dsId}</td>
                      <td className="py-2 px-2 t-primary text-[10px] max-w-[150px] truncate" title={d.dsEmail}>{d.dsEmail}</td>
                      <td className="py-2 px-2 text-right text-orange-500 font-bold">{d.total}</td>
                      <td className="py-2 px-2 text-right t-secondary">{d.avg}</td>
                      <td className="py-2 px-2 text-right">
                        <span style={{ color: d.trend > 10 ? "#16a34a" : d.trend < -30 ? "#dc2626" : d.trend < -10 ? "#d97706" : "#6b7280" }} className="font-bold">
                          {d.trend > 0 ? "+" : ""}{d.trend}%
                        </span>
                      </td>
                      {d.daily.map((day) => (
                        <td key={day.fecha} className="py-2 px-2 text-right" style={{ color: day.ordenes === 0 ? "#9ca3af" : day.ordenes >= d.avg ? "#16a34a" : day.ordenes < d.avg * 0.5 ? "#dc2626" : "#d97706" }}>
                          {day.ordenes || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-orange-500/30">
                    <td className="py-2 px-2 t-primary font-bold sticky left-0" style={{ background: "var(--bg-card)" }}>TOTAL</td>
                    <td className="py-2 px-2"></td>
                    <td className="py-2 px-2"></td>
                    <td className="py-2 px-2 text-right text-orange-500 font-bold">{dsAnalysis.reduce((s, d) => s + d.total, 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right t-secondary">{dsAnalysis.length > 0 ? Math.round(dsAnalysis.reduce((s, d) => s + d.avg, 0) / dsAnalysis.length) : 0}</td>
                    <td className="py-2 px-2"></td>
                    {fechas.map((f) => {
                      const dayTotal = dsAnalysis.reduce((s, d) => s + (d.daily.find((dd) => dd.fecha === f)?.ordenes || 0), 0);
                      return <td key={f} className="py-2 px-2 text-right text-orange-500 font-bold">{dayTotal.toLocaleString()}</td>;
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[10px] t-muted mt-1">Click en un dropshipper para ver sus productos. Verde = arriba del promedio, Rojo = menos del 50% del promedio.</p>

            {/* Selected DS detail: chart + products */}
            {selectedDS && (() => {
              const dsInfo = dsAnalysis.find((d) => d.ds === selectedDS);
              if (!dsInfo) return null;
              const chartData = dsInfo.daily.map((d) => ({
                fecha: d.fecha.replace(/-2026$/, "").replace(/-04-/, "/").replace(/^0/, ""),
                ordenes: d.ordenes,
                promedio: dsInfo.avg,
              }));
              return (
                <div className="mt-3 p-4 rounded-xl border border-orange-500/20" style={{ background: "var(--bg-card)" }}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-orange-500">{dsInfo.ds}</h4>
                      <p className="text-[10px] t-muted">
                        {dsInfo.dsId && <span>ID: {dsInfo.dsId} · </span>}
                        {dsInfo.dsEmail && <span>{dsInfo.dsEmail} · </span>}
                        {dsInfo.dsCelular && <span>Cel: {dsInfo.dsCelular} · </span>}
                        Total: {dsInfo.total} órdenes · Prom: {dsInfo.avg}/día · Tendencia: {dsInfo.trend > 0 ? "+" : ""}{dsInfo.trend}%
                      </p>
                    </div>
                    <button onClick={() => { setSelectedDS(""); setFilterType("all"); setFilterValue(""); }} className="text-xs t-muted hover:text-red-500">✕</button>
                  </div>

                  {dsInfo.alert && (
                    <div className="mb-3 p-2 rounded-lg border border-red-500/20 text-xs text-red-600" style={{ background: "rgba(220,38,38,0.05)" }}>
                      ⚠️ Bajando volumen. Promedio: {dsInfo.avg}/día → últimos días: {dsInfo.lastAvg}/día ({dsInfo.trend}%). Verificar stock de sus productos.
                    </div>
                  )}

                  {/* Daily chart */}
                  <h5 className="text-xs font-medium t-primary mb-2">Movimiento diario</h5>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                      <XAxis dataKey="fecha" tick={{ fill: "#374151", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#374151", fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", color: "#1f2937", fontSize: 11 }} />
                      <Bar dataKey="ordenes" radius={[4, 4, 0, 0]} name="Órdenes">
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.ordenes >= dsInfo.avg ? "#16a34a" : d.ordenes > 0 && d.ordenes < dsInfo.avg * 0.5 ? "#dc2626" : d.ordenes > 0 ? "#d97706" : "#d1d5db"} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="promedio" stroke="#ea580c" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Promedio" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-1 text-[9px] t-muted justify-center">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#16a34a" }} />Arriba del promedio</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#d97706" }} />Debajo del promedio</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#dc2626" }} />Menos del 50%</span>
                    <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: "#ea580c" }} />Promedio ({dsInfo.avg}/día)</span>
                  </div>

                  {/* Products */}
                  <h5 className="text-xs font-medium t-primary mt-4 mb-2">Productos que vende — verificar stock</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {dsInfo.productos.map((p, i) => (
                      <div key={p.producto} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-500/10" style={{ background: "var(--bg-card-hover)" }}>
                        <span className="text-xs font-bold text-orange-500 w-4">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] t-primary font-medium truncate" title={p.producto}>{p.producto}</p>
                          <p className="text-xs font-bold text-orange-600">{p.ordenes} órdenes</p>
                        </div>
                      </div>
                    ))}
                    {dsInfo.productos.length === 0 && <p className="text-xs t-muted">Sin productos registrados</p>}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Status distribution — cards + Daily chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-bold t-primary mb-3">Distribución por Estado</h3>
          <div className="grid grid-cols-2 gap-2">
            {allStatuses.map((s) => {
              const val = aggData.by_status[s] || 0;
              const pct = aggData.total_orders > 0 ? ((val / aggData.total_orders) * 100).toFixed(1) : "0";
              return (
                <div key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-200" style={{ background: "var(--bg-card)" }}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS_COLORS[s] || "#6B7280" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] t-primary font-medium truncate" title={s}>{s}</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-xs font-bold" style={{ color: STATUS_COLORS[s] || "#6B7280" }}>{val.toLocaleString()}</p>
                      <p className="text-[9px] t-muted">{pct}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold t-primary mb-3">Guías por Día</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dateChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
              <XAxis dataKey="fecha" tick={TICK_STYLE} />
              <YAxis tick={TICK_STYLE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => Number(v).toLocaleString()} />
              <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} name="Total" />
              <Bar dataKey="entregado" fill="#16a34a" radius={[4, 4, 0, 0]} name="Entregado" />
              <Bar dataKey="cancelado" fill="#dc2626" radius={[4, 4, 0, 0]} name="Cancelado" />
            </BarChart>
          </ResponsiveContainer>
          {/* Departamentos */}
          <h3 className="text-sm font-bold t-primary mt-6 mb-3">Distribución Geográfica</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {aggData.by_departamento.slice(0, 12).map((d, i) => (
              <div key={d.nombre} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-200" style={{ background: "var(--bg-card)" }}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <div className="min-w-0">
                  <p className="text-[10px] t-primary font-medium truncate">{d.nombre}</p>
                  <p className="text-xs font-bold" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{d.total.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PROVEEDOR x STATUS TABLE */}
      <div className="mb-6">
        <h3 className="text-sm font-bold t-primary mb-3">Guías por Estado y Proveedor</h3>
        <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
              <tr className="border-b border-orange-500/20">
                <th className="text-left py-2 px-2 text-gray-400 sticky left-0" style={{ background: "rgba(22,33,62,0.98)" }}>Proveedor</th>
                <th className="text-right py-2 px-2 text-gray-400 font-bold">Total</th>
                {allStatuses.map((s) => (
                  <th key={s} className="text-right py-2 px-2 text-gray-400 whitespace-nowrap"><span title={s}>{s.length > 12 ? s.slice(0, 12) + "…" : s}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aggData.by_proveedor.map((p) => (
                <tr key={p.nombre} className={`border-b border-gray-800/40 hover:bg-orange-500/5 cursor-pointer ${filterType === "proveedor" && filterValue === p.nombre ? "bg-orange-500/10" : ""}`}
                  onClick={() => { setFilterType("proveedor"); setFilterValue(p.nombre); }}>
                  <td className="py-2 px-2 t-primary font-medium whitespace-nowrap sticky left-0" style={{ background: "var(--bg-card)" }}>{p.nombre}</td>
                  <td className="py-2 px-2 text-right font-bold text-orange-500">{p.total.toLocaleString()}</td>
                  {allStatuses.map((s) => {
                    const val = p.estados[s] || 0;
                    return <td key={s} className="py-2 px-2 text-right" style={{ color: val > 0 ? STATUS_COLORS[s] : "#9ca3af" }}>{val > 0 ? val.toLocaleString() : "—"}</td>;
                  })}
                </tr>
              ))}
              {!isFiltered && (
                <tr className="border-t-2 border-orange-500/30 font-bold">
                  <td className="py-2 px-2 t-primary sticky left-0" style={{ background: "var(--bg-card)" }}>TOTAL</td>
                  <td className="py-2 px-2 text-right text-orange-500">{aggData.total_orders.toLocaleString()}</td>
                  {allStatuses.map((s) => (
                    <td key={s} className="py-2 px-2 text-right" style={{ color: STATUS_COLORS[s] }}>{(aggData.by_status[s] || 0).toLocaleString()}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] t-muted mt-1">Click en un proveedor para filtrar todo el análisis</p>
      </div>

      {/* DROPSHIPPERS TABLE */}
      <div>
        <h3 className="text-sm font-bold t-primary mb-3">Dropshippers por Estado {isFiltered && filterType === "proveedor" ? `— ${filterValue}` : ""}</h3>
        <div className="table-container overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
              <tr className="border-b border-orange-500/20">
                <th className="text-left py-2 px-2 text-gray-400">#</th>
                <th className="text-left py-2 px-2 text-gray-400">Dropshipper</th>
                <th className="text-right py-2 px-2 text-gray-400 font-bold">Total</th>
                <th className="text-right py-2 px-2 text-green-600">Entreg.</th>
                <th className="text-right py-2 px-2 text-red-600">Cancel.</th>
                <th className="text-right py-2 px-2 text-blue-600">Guía Gen.</th>
                <th className="text-right py-2 px-2 text-orange-600">Novedad</th>
                <th className="text-right py-2 px-2 text-yellow-600">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {aggData.by_dropshipper.slice(0, 50).map((d, i) => (
                <tr key={d.nombre} className={`border-b border-gray-800/40 hover:bg-orange-500/5 cursor-pointer ${filterType === "dropshipper" && filterValue === d.nombre ? "bg-orange-500/10" : ""}`}
                  onClick={() => { setFilterType("dropshipper"); setFilterValue(d.nombre); }}>
                  <td className="py-2 px-2 t-muted">{i + 1}</td>
                  <td className="py-2 px-2 t-primary font-medium truncate max-w-[200px]">{d.nombre}</td>
                  <td className="py-2 px-2 text-right text-orange-500 font-bold">{d.total}</td>
                  <td className="py-2 px-2 text-right text-green-600">{d.estados["ENTREGADO"] || 0}</td>
                  <td className="py-2 px-2 text-right text-red-600">{d.estados["CANCELADO"] || 0}</td>
                  <td className="py-2 px-2 text-right text-blue-600">{d.estados["GUIA_GENERADA"] || 0}</td>
                  <td className="py-2 px-2 text-right text-orange-600">{(d.estados["NOVEDAD"] || 0) + (d.estados["NOVEDAD SOLUCIONADA"] || 0)}</td>
                  <td className="py-2 px-2 text-right text-yellow-600">{(d.estados["PENDIENTE"] || 0) + (d.estados["PENDIENTE CONFIRMACION"] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] t-muted mt-1">Click en un dropshipper para filtrar todo el análisis</p>
      </div>

      {/* TOP PRODUCTS — cards */}
      <div className="mb-6">
        <h3 className="text-sm font-bold t-primary mb-3">Top 20 Productos {isFiltered ? `— ${filterLabel}` : ""}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {aggData.by_producto.slice(0, 20).map((p, i) => (
            <div key={p.nombre} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-500/15" style={{ background: "var(--bg-card)" }}>
              <span className="text-xs font-bold text-orange-500 shrink-0 w-5">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] t-primary font-medium truncate" title={p.nombre}>{p.nombre}</p>
                <div className="flex gap-2">
                  <p className="text-xs font-bold text-orange-600">{p.ordenes.toLocaleString()} órd.</p>
                  <p className="text-[10px] t-muted">{p.cantidad.toLocaleString()} uds.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ STOCK PROJECTION ═══ */}
      <StockProjection country={country} aggData={aggData} />

      {/* ═══ LOGISTICS SECTION ═══ */}
      {aggData.logistics && (
        <div className="mt-8 pt-6 border-t-2 border-orange-500/20">
          <h2 className="text-lg font-bold t-primary mb-1">🚚 Logística {isFiltered ? `— ${filterLabel}` : ""}</h2>
          <p className="text-xs t-secondary mb-5">Tasas de entrega, devolución y costos de flete por localidad</p>

          {/* Logistics KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl p-4 border border-green-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px] t-muted uppercase">Tasa de Entrega</p>
              <p className="text-2xl font-bold text-green-600">{aggData.logistics.tasa_entrega.toFixed(1)}%</p>
              <p className="text-xs t-secondary">{aggData.logistics.total_entregado.toLocaleString()} entregados</p>
            </div>
            <div className="rounded-xl p-4 border border-red-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px] t-muted uppercase">Tasa de Devolución</p>
              <p className="text-2xl font-bold text-red-600">{aggData.logistics.tasa_devolucion.toFixed(1)}%</p>
              <p className="text-xs t-secondary">{aggData.logistics.total_devolucion.toLocaleString()} devueltos</p>
            </div>
            <div className="rounded-xl p-4 border border-blue-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px] t-muted uppercase">En Proceso</p>
              <p className="text-2xl font-bold text-blue-600">{aggData.logistics.tasa_en_proceso.toFixed(1)}%</p>
              <p className="text-xs t-secondary">{aggData.logistics.total_en_proceso.toLocaleString()} en tránsito</p>
            </div>
            <div className="rounded-xl p-4 border border-gray-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px] t-muted uppercase">Cancelados</p>
              <p className="text-2xl font-bold text-gray-600">{aggData.logistics.tasa_cancelado.toFixed(1)}%</p>
              <p className="text-xs t-secondary">{aggData.logistics.total_cancelado.toLocaleString()} cancelados</p>
            </div>
          </div>

          {/* Transportadoras */}
          <div className="mb-6">
            <h3 className="text-sm font-bold t-primary mb-3">Rendimiento por Transportadora</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aggData.logistics.by_transportadora.map((t) => (
                <div key={t.nombre} className="p-4 rounded-xl border border-orange-500/15" style={{ background: "var(--bg-card)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold t-primary">{t.nombre}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 font-medium">{t.total.toLocaleString()} guías</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mb-3">
                    <div>
                      <p className="text-[10px] t-muted">Entregados</p>
                      <p className="text-lg font-bold text-green-600">{t.pctEntrega.toFixed(1)}%</p>
                      <p className="text-[10px] t-secondary">{t.entregado}</p>
                    </div>
                    <div>
                      <p className="text-[10px] t-muted">Devueltos</p>
                      <p className="text-lg font-bold text-red-600">{t.total > 0 ? ((t.devolucion / t.total) * 100).toFixed(1) : 0}%</p>
                      <p className="text-[10px] t-secondary">{t.devolucion}</p>
                    </div>
                    <div>
                      <p className="text-[10px] t-muted">Flete Prom.</p>
                      <p className="text-lg font-bold text-orange-600">${t.fletePromedio.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "#e5e7eb" }}>
                    <div className="h-full bg-green-500" style={{ width: `${t.pctEntrega}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${t.total > 0 ? (t.devolucion / t.total) * 100 : 0}%` }} />
                  </div>
                  <div className="flex gap-3 mt-1 text-[9px] t-muted">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Entregado</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Devuelto</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#e5e7eb" }} />En proceso</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed flete table by department */}
          <div className="mb-6">
            <h3 className="text-sm font-bold t-primary mb-3">Detalle Logístico por Departamento</h3>
            <div className="table-container overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                  <tr className="border-b border-orange-500/20">
                    <th className="text-left py-2 px-2 text-gray-400">Departamento</th>
                    <th className="text-right py-2 px-2 text-gray-400">Guías</th>
                    <th className="text-right py-2 px-2 text-gray-400">Flete Prom.</th>
                    <th className="text-right py-2 px-2 text-gray-400">Flete Mín.</th>
                    <th className="text-right py-2 px-2 text-gray-400">Flete Máx.</th>
                    <th className="text-right py-2 px-2 text-gray-400">Entregados</th>
                    <th className="text-right py-2 px-2 text-gray-400">% Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {aggData.logistics.by_departamento_flete.map((d) => (
                    <tr key={d.departamento} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                      <td className="py-2 px-2 t-primary font-medium">{d.departamento}</td>
                      <td className="py-2 px-2 text-right t-secondary">{d.total.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-orange-600 font-bold">${d.fletePromedio.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-green-600">${d.fleteMin.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-red-600">${d.fleteMax.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right text-green-600">{d.entregado}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={d.pctEntrega >= 15 ? "text-green-600 font-bold" : d.pctEntrega >= 10 ? "text-yellow-600" : "text-red-600"}>
                          {d.pctEntrega.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ RECOMENDACION DE LOGISTICA POR CIUDAD ═══ */}
          {cityLogisticsRecommendation.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold t-primary mb-1">🎯 Recomendacion de Logistica por Ciudad</h3>
              <p className="text-xs t-secondary mb-3">
                Mejor transportadora por ciudad segun tasa de entrega y devolucion (score = %entrega − %devolucion×0.5). Min 5 guias por ciudad, 3 por transportadora.
              </p>

              {/* Filter by logistic */}
              <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg border border-orange-500/15" style={{ background: "var(--bg-card)" }}>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] t-muted uppercase tracking-wider">Ver por logistica</label>
                  <select
                    value={recLogistic}
                    onChange={(e) => setRecLogistic(e.target.value)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-orange-500/20 t-primary focus:outline-none min-w-[180px]"
                    style={{ background: "var(--bg-input)" }}
                  >
                    <option value="">Todas (modo recomendacion)</option>
                    {globalFilterOptions.transportadoras.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                {recLogistic && (
                  <button
                    onClick={() => setRecLogistic("")}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10"
                  >
                    Limpiar
                  </button>
                )}
                {recLogistic && (
                  <span className="text-[11px] t-muted ml-auto">
                    {citiesByLogistic.length} ciudades con {recLogistic}
                  </span>
                )}
              </div>

              {/* Chart for selected logistic */}
              {recLogistic && citiesByLogistic.length > 0 && (
                <div className="mb-4 p-4 rounded-xl border border-orange-500/15" style={{ background: "var(--bg-card)" }}>
                  <h4 className="text-xs font-bold t-primary mb-3">📊 Performance de {recLogistic} por Ciudad (Top 15)</h4>
                  <ResponsiveContainer width="100%" height={Math.min(citiesByLogistic.length * 30, 450)}>
                    <BarChart data={citiesByLogistic.slice(0, 15)} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis type="number" domain={[0, 100]} tick={TICK_STYLE} tickFormatter={(v) => `${v}%`} />
                      <YAxis dataKey="ciudad" type="category" tick={TICK_STYLE_SM} width={110} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => [`${Number(value).toFixed(1)}%`, String(name) === "pctEntrega" ? "Entrega" : "Devolucion"]}
                      />
                      <Bar dataKey="pctEntrega" name="pctEntrega" fill="#16a34a" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="pctDev" name="pctDev" fill="#dc2626" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 text-[10px] t-muted">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />% Entrega</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />% Devolucion</span>
                  </div>
                </div>
              )}
              <div className="table-container overflow-x-auto max-h-[450px] overflow-y-auto">
                {recLogistic ? (
                  // Filtered by logistic: show top cities for this logistic
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: "var(--bg-card)" }}>
                      <tr className="border-b-2 border-orange-500/30">
                        <th className="text-left py-2 px-2 t-primary font-bold">#</th>
                        <th className="text-left py-2 px-2 t-primary font-bold">Ciudad</th>
                        <th className="text-left py-2 px-2 t-primary font-bold">Departamento</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">Guias</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">%Entrega</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">%Devol.</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">Flete Prom.</th>
                        <th className="text-left py-2 px-2 t-primary font-bold">Recomendacion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citiesByLogistic.map((c, i) => {
                        // Check if this logistic is the best for this city
                        const cityRec = cityLogisticsRecommendation.find((r) => r.ciudad === c.ciudad && r.dept === c.dept);
                        const isRecommended = cityRec?.best?.trans === recLogistic;
                        const statusLabel = isRecommended ? "✓ Recomendada" : c.pctEntrega >= 50 ? "⚠ Aceptable" : "✗ Baja entrega";
                        const statusColor = isRecommended ? "text-green-600 bg-green-500/15" : c.pctEntrega >= 50 ? "text-yellow-600 bg-yellow-500/15" : "text-red-600 bg-red-500/15";
                        return (
                          <tr key={`${c.ciudad}-${c.dept}`} className="border-b border-gray-800/20 hover:bg-orange-500/5">
                            <td className="py-2 px-2 t-muted">{i + 1}</td>
                            <td className="py-2 px-2 t-primary font-medium">{c.ciudad}</td>
                            <td className="py-2 px-2 t-secondary">{c.dept}</td>
                            <td className="py-2 px-2 text-right t-secondary">{c.total}</td>
                            <td className="py-2 px-2 text-right font-bold text-green-600">{c.pctEntrega.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right font-bold text-red-600">{c.pctDev.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right text-orange-600">${c.fletePromedio.toLocaleString()}</td>
                            <td className="py-2 px-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  // Default mode: show best recommendation per city
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: "var(--bg-card)" }}>
                      <tr className="border-b-2 border-orange-500/30">
                        <th className="text-left py-2 px-2 t-primary font-bold">Ciudad</th>
                        <th className="text-left py-2 px-2 t-primary font-bold">Departamento</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">Guias</th>
                        <th className="text-left py-2 px-2 t-primary font-bold">Recomendada</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">%Entrega</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">%Devol.</th>
                        <th className="text-right py-2 px-2 t-primary font-bold">Flete Prom.</th>
                        <th className="text-left py-2 px-2 t-primary font-bold">Alternativas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityLogisticsRecommendation.map((c) => (
                        <tr key={`${c.ciudad}-${c.dept}`} className="border-b border-gray-800/20 hover:bg-orange-500/5">
                          <td className="py-2 px-2 t-primary font-medium">{c.ciudad}</td>
                          <td className="py-2 px-2 t-secondary">{c.dept}</td>
                          <td className="py-2 px-2 text-right t-secondary">{c.totalCity}</td>
                          <td className="py-2 px-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 font-bold text-[11px]">
                              ⭐ {c.best?.trans}
                            </span>
                            <span className="t-muted text-[10px] ml-1">({c.best?.total})</span>
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-green-600">{c.best?.pctEntrega.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-right font-bold text-red-600">{c.best?.pctDev.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-right text-orange-600">${c.best?.fletePromedio.toLocaleString()}</td>
                          <td className="py-2 px-2">
                            {c.alternatives.length === 0 ? (
                              <span className="t-muted text-[10px]">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {c.alternatives.slice(0, 3).map((a) => (
                                  <span key={a.trans} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 t-secondary" title={`Flete prom. $${a.fletePromedio.toLocaleString()}`}>
                                    {a.trans}: {a.pctEntrega.toFixed(0)}% entrega / {a.pctDev.toFixed(0)}% dev ({a.total})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Top cities by flete */}
          {aggData.logistics.by_ciudad_flete.length > 0 && (
            <div>
              <h3 className="text-sm font-bold t-primary mb-3">Costo de Flete por Ciudad (Top 30)</h3>
              <div className="table-container overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                    <tr className="border-b border-orange-500/20">
                      <th className="text-left py-2 px-2 text-gray-400">#</th>
                      <th className="text-left py-2 px-2 text-gray-400">Ciudad</th>
                      <th className="text-left py-2 px-2 text-gray-400">Departamento</th>
                      <th className="text-right py-2 px-2 text-gray-400">Guías</th>
                      <th className="text-right py-2 px-2 text-gray-400">Flete Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggData.logistics.by_ciudad_flete.slice(0, 30).map((c, i) => (
                      <tr key={`${c.ciudad}-${c.departamento}`} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                        <td className="py-2 px-2 t-muted">{i + 1}</td>
                        <td className="py-2 px-2 t-primary font-medium">{c.ciudad}</td>
                        <td className="py-2 px-2 t-secondary">{c.departamento}</td>
                        <td className="py-2 px-2 text-right t-secondary">{c.total}</td>
                        <td className="py-2 px-2 text-right text-orange-600 font-bold">${c.fletePromedio.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </ChartDownloadBtn>
  );
}
