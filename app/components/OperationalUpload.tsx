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
  producto: string; cantidad: number; departamento: string;
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
  by_producto: { nombre: string; cantidad: number; ordenes: number }[];
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
          iDSEmail = idx("EMAIL"), iDSCel = idx("CELULAR"), iPR = idx("PRODUCTO"),
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
  const by_prod_map: Record<string, { cantidad: number; ordenes: number }> = {};
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
    if (!by_prod_map[r.producto]) by_prod_map[r.producto] = { cantidad: 0, ordenes: 0 };
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

export default function OperationalUpload({ country }: { country: "py" | "ar" }) {
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [savedAgg, setSavedAgg] = useState<AggData | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "proveedor" | "dropshipper">("all");
  const [selectedDS, setSelectedDS] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");

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
      // Save aggregation + raw rows for persistent filtering
      await fetch("/api/data/operational", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, data: { ...agg, raw_rows: rows }, raw_count: agg.total_orders }),
      });
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

  // Filtered aggregation — always re-aggregate from raw rows
  const aggData = useMemo(() => {
    if (!fullAgg) return null;
    if (filterType === "all" || !filterValue) return fullAgg;
    if (rawRows.length === 0) return fullAgg;
    const filtered = filterType === "proveedor"
      ? rawRows.filter((r) => r.proveedor === filterValue)
      : rawRows.filter((r) => r.dropshipper === filterValue);
    if (filtered.length === 0) return fullAgg;
    return aggregateRows(filtered);
  }, [fullAgg, rawRows, filterType, filterValue]);

  const allStatuses = useMemo(() => {
    if (!aggData) return [];
    return STATUS_ORDER.filter((s) => aggData.by_status[s]);
  }, [aggData]);

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

      {/* GLOBAL FILTER */}
      <div className="mb-5 p-3 rounded-xl border border-orange-500/20" style={{ background: "var(--bg-card-hover)" }}>
        <p className="text-[10px] t-muted uppercase mb-2">Filtrar todo por usuario</p>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value as any); setFilterValue(""); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/20 t-primary focus:outline-none" style={{ background: "var(--bg-input)" }}
          >
            <option value="all">Todos</option>
            <option value="proveedor">Por Proveedor</option>
            <option value="dropshipper">Por Dropshipper</option>
          </select>
          {filterType !== "all" && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/20 t-primary focus:outline-none flex-1 max-w-xs" style={{ background: "var(--bg-input)" }}
            >
              <option value="">Seleccionar...</option>
              {(filterType === "proveedor" ? fullAgg!.by_proveedor : fullAgg!.by_dropshipper).map((u) => (
                <option key={u.nombre} value={u.nombre}>{u.nombre} ({u.total})</option>
              ))}
            </select>
          )}
          {isFiltered && (
            <button onClick={() => { setFilterType("all"); setFilterValue(""); }} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10">
              Limpiar filtro
            </button>
          )}
        </div>
        {isFiltered && <p className="text-xs text-orange-500 font-medium mt-2">Mostrando: {filterLabel} — {aggData.total_orders.toLocaleString()} guías</p>}
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
                    <button key={d.ds} onClick={() => setSelectedDS(d.ds)}
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
                      onClick={() => setSelectedDS(selectedDS === d.ds ? "" : d.ds)}>
                      <td className="py-2 px-2 t-primary font-medium whitespace-nowrap sticky left-0 max-w-[180px] truncate" style={{ background: "var(--bg-card)" }} title={d.ds}>
                        {d.alert && <span className="mr-1">⚠️</span>}{d.ds.length > 25 ? d.ds.slice(0, 25) + "…" : d.ds}
                      </td>
                      <td className="py-2 px-2 t-muted text-[10px]">{d.dsId}</td>
                      <td className="py-2 px-2 t-muted text-[10px] max-w-[150px] truncate" title={d.dsEmail}>{d.dsEmail}</td>
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
                    <button onClick={() => setSelectedDS("")} className="text-xs t-muted hover:text-red-500">✕</button>
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
