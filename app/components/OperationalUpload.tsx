"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "#F59E0B",
  "PENDIENTE CONFIRMACION": "#FBBF24",
  GUIA_GENERADA: "#3B82F6",
  "EN BODEGA ORIGEN": "#6366F1",
  "RECOGIDO POR TRANSPORTADORA": "#8B5CF6",
  MANIFIESTO: "#A78BFA",
  "EN BODEGA DESTINO": "#06B6D4",
  "EN REPARTO": "#14B8A6",
  "SALIDA A RUTA": "#10B981",
  "RUTEADO PARA SU ENTREGA": "#34D399",
  ENTREGADO: "#10B981",
  "NOVEDAD": "#F97316",
  "NOVEDAD SOLUCIONADA": "#FB923C",
  CANCELADO: "#EF4444",
  DEVOLUCION: "#DC2626",
  "EN PROCESO DE DEVOLUCION": "#F87171",
  RECHAZADO: "#B91C1C",
  "GESTIONADO OPERATIVA": "#6B7280",
  "MAL RUTEO": "#9CA3AF",
  "REINGRESO A BODEGA": "#D946EF",
  PACTADO: "#22D3EE",
  "REPACTADO LISTO PARA DESPACHO": "#67E8F9",
};

const STATUS_ORDER = [
  "PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA", "EN BODEGA ORIGEN",
  "RECOGIDO POR TRANSPORTADORA", "MANIFIESTO", "EN BODEGA DESTINO", "EN REPARTO",
  "SALIDA A RUTA", "RUTEADO PARA SU ENTREGA", "ENTREGADO", "NOVEDAD", "NOVEDAD SOLUCIONADA",
  "GESTIONADO OPERATIVA", "PACTADO", "REPACTADO LISTO PARA DESPACHO",
  "CANCELADO", "RECHAZADO", "EN PROCESO DE DEVOLUCION", "DEVOLUCION", "MAL RUTEO", "REINGRESO A BODEGA",
];

interface AggData {
  total_orders: number;
  date_range: { from: string; to: string };
  by_status: Record<string, number>;
  by_date: { fecha: string; total: number; estados: Record<string, number> }[];
  by_proveedor: { nombre: string; id: number; total: number; estados: Record<string, number> }[];
  by_dropshipper: { nombre: string; total: number; estados: Record<string, number> }[];
  by_producto: { nombre: string; cantidad: number; ordenes: number }[];
  by_departamento: { nombre: string; total: number }[];
}

function parseExcel(file: File): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function aggregate(rows: any[][]): AggData {
  const header = rows[0] as string[];
  const idx = (name: string) => header.indexOf(name);

  const iEstatus = idx("ESTATUS");
  const iFecha = idx("FECHA");
  const iProvNombre = idx("PROVEEDOR NOMBRE");
  const iProvId = idx("PROVEEDOR ID");
  const iDropshipper = idx("DROPSHIPPER");
  const iProducto = idx("PRODUCTO");
  const iCantidad = idx("CANTIDAD");
  const iDepto = idx("DEPARTAMENTO DESTINO");

  const data = rows.slice(1);
  const by_status: Record<string, number> = {};
  const by_date_map: Record<string, { total: number; estados: Record<string, number> }> = {};
  const by_prov_map: Record<string, { id: number; total: number; estados: Record<string, number> }> = {};
  const by_ds_map: Record<string, { total: number; estados: Record<string, number> }> = {};
  const by_prod_map: Record<string, { cantidad: number; ordenes: number }> = {};
  const by_dept_map: Record<string, number> = {};

  for (const r of data) {
    const status = String(r[iEstatus] || "DESCONOCIDO");
    const fecha = String(r[iFecha] || "");
    const prov = String(r[iProvNombre] || "Sin proveedor");
    const provId = Number(r[iProvId]) || 0;
    const ds = String(r[iDropshipper] || "Sin dropshipper");
    const prod = String(r[iProducto] || "Sin producto");
    const cant = Number(r[iCantidad]) || 1;
    const dept = String(r[iDepto] || "Sin departamento");

    by_status[status] = (by_status[status] || 0) + 1;

    if (!by_date_map[fecha]) by_date_map[fecha] = { total: 0, estados: {} };
    by_date_map[fecha].total++;
    by_date_map[fecha].estados[status] = (by_date_map[fecha].estados[status] || 0) + 1;

    if (!by_prov_map[prov]) by_prov_map[prov] = { id: provId, total: 0, estados: {} };
    by_prov_map[prov].total++;
    by_prov_map[prov].estados[status] = (by_prov_map[prov].estados[status] || 0) + 1;

    if (!by_ds_map[ds]) by_ds_map[ds] = { total: 0, estados: {} };
    by_ds_map[ds].total++;
    by_ds_map[ds].estados[status] = (by_ds_map[ds].estados[status] || 0) + 1;

    if (!by_prod_map[prod]) by_prod_map[prod] = { cantidad: 0, ordenes: 0 };
    by_prod_map[prod].cantidad += cant;
    by_prod_map[prod].ordenes++;

    by_dept_map[dept] = (by_dept_map[dept] || 0) + 1;
  }

  const fechas = Object.keys(by_date_map).sort();

  return {
    total_orders: data.length,
    date_range: { from: fechas[0] || "", to: fechas[fechas.length - 1] || "" },
    by_status,
    by_date: fechas.map((f) => ({ fecha: f, ...by_date_map[f] })),
    by_proveedor: Object.entries(by_prov_map).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total),
    by_dropshipper: Object.entries(by_ds_map).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total),
    by_producto: Object.entries(by_prod_map).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.ordenes - a.ordenes),
    by_departamento: Object.entries(by_dept_map).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
  };
}

const PIE_COLORS = ["#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B", "#6366F1", "#06B6D4", "#84CC16", "#D946EF"];

export default function OperationalUpload({ country }: { country: "py" | "ar" }) {
  const [aggData, setAggData] = useState<AggData | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [provFilter, setProvFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Load existing data from API
  useEffect(() => {
    fetch(`/api/data/operational?country=${country}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setAggData(res.data);
          setUploadedAt(res.uploaded_at);
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
      const agg = aggregate(rows);
      setAggData(agg);

      // Save to API
      await fetch("/api/data/operational", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, data: agg, raw_count: agg.total_orders }),
      });
      setUploadedAt(new Date().toISOString());
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al procesar el archivo. Verificá que sea un Excel válido.");
    }
    setUploading(false);
    e.target.value = "";
  }, [country]);

  // Filtered proveedor data for detail table
  const detailData = useMemo(() => {
    if (!aggData) return [];
    let items = provFilter === "all"
      ? aggData.by_proveedor
      : aggData.by_proveedor.filter((p) => p.nombre === provFilter);

    return items;
  }, [aggData, provFilter]);

  const allStatuses = useMemo(() => {
    if (!aggData) return [];
    return STATUS_ORDER.filter((s) => aggData.by_status[s]);
  }, [aggData]);

  const countryLabel = country === "py" ? "Paraguay" : "Argentina";

  if (!aggData) {
    return (
      <div className="glass-card p-6 border-cyan-500/30">
        <h2 className="text-xl font-bold text-white mb-1">📋 Análisis Operacional — Abril {countryLabel}</h2>
        <p className="text-xs text-gray-400 mb-4">Subí el archivo Excel del dashboard comercial de Dropi para ver el análisis</p>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg dropi-gradient text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          {uploading ? "Procesando..." : "Subir Excel de Abril"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    );
  }

  const statusChartData = allStatuses.map((s) => ({
    name: s.length > 18 ? s.slice(0, 18) + "…" : s,
    fullName: s,
    value: aggData.by_status[s],
    fill: STATUS_COLORS[s] || "#6B7280",
  }));

  const dateChartData = aggData.by_date.map((d) => ({
    fecha: d.fecha.replace("-04-2026", "/04"),
    total: d.total,
    entregado: d.estados["ENTREGADO"] || 0,
    cancelado: d.estados["CANCELADO"] || 0,
  }));

  return (
    <ChartDownloadBtn filename={`Operacional_Abril_${countryLabel}`}>
    <div className="glass-card p-6 border-cyan-500/30">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">📋 Análisis Operacional — Abril {countryLabel}</h2>
          <p className="text-xs text-gray-400">
            {aggData.total_orders.toLocaleString()} guías &middot; {aggData.date_range.from} al {aggData.date_range.to}
            {uploadedAt && <span className="ml-2 text-cyan-400">Actualizado: {new Date(uploadedAt).toLocaleString("es-PY")}</span>}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 text-xs cursor-pointer hover:bg-cyan-500/10 transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          {uploading ? "Procesando..." : "Actualizar archivo"}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Total Guías</p>
          <p className="text-xl font-bold text-blue-400">{aggData.total_orders.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">{aggData.by_date.length} días</p>
        </div>
        <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Entregados</p>
          <p className="text-xl font-bold text-green-400">{(aggData.by_status["ENTREGADO"] || 0).toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">{aggData.total_orders > 0 ? ((aggData.by_status["ENTREGADO"] || 0) / aggData.total_orders * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">En Tránsito</p>
          <p className="text-xl font-bold text-orange-400">
            {((aggData.by_status["EN BODEGA ORIGEN"] || 0) + (aggData.by_status["EN BODEGA DESTINO"] || 0) + (aggData.by_status["EN REPARTO"] || 0) + (aggData.by_status["RECOGIDO POR TRANSPORTADORA"] || 0)).toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500">bodega + reparto</p>
        </div>
        <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Cancelados</p>
          <p className="text-xl font-bold text-red-400">{(aggData.by_status["CANCELADO"] || 0).toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">{aggData.total_orders > 0 ? ((aggData.by_status["CANCELADO"] || 0) / aggData.total_orders * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: "rgba(139,92,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Proveedores</p>
          <p className="text-xl font-bold text-purple-400">{aggData.by_proveedor.length}</p>
          <p className="text-[10px] text-gray-500">{aggData.by_dropshipper.length} dropshippers</p>
        </div>
      </div>

      {/* Status distribution chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Distribución por Estado</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={statusChartData} layout="vertical" margin={{ left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 9 }} width={150} />
            <Tooltip
              contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "12px", color: "#e5e7eb", fontSize: 11 }}
              formatter={(value, _name, props) => [Number(value).toLocaleString(), (props as any).payload?.fullName || ""]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
              {statusChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Guías por Día</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={dateChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="fecha" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "12px", color: "#e5e7eb", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString()} />
            <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Total" />
            <Bar dataKey="entregado" fill="#10B981" radius={[4, 4, 0, 0]} name="Entregado" />
            <Bar dataKey="cancelado" fill="#EF4444" radius={[4, 4, 0, 0]} name="Cancelado" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* PROVEEDOR x STATUS DETAIL TABLE */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-cyan-400">Guías por Estado y Proveedor/Dropshipper</h3>
          <div className="flex gap-2 flex-wrap">
            <select
              value={provFilter}
              onChange={(e) => setProvFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#16213e] border border-cyan-500/20 text-white focus:outline-none"
            >
              <option value="all">Todos los proveedores</option>
              {aggData.by_proveedor.map((p) => (
                <option key={p.nombre} value={p.nombre}>{p.nombre} ({p.total})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
              <tr className="border-b border-cyan-500/20">
                <th className="text-left py-2 px-2 text-gray-400 sticky left-0" style={{ background: "rgba(22,33,62,0.98)" }}>Proveedor</th>
                <th className="text-right py-2 px-2 text-gray-400 font-bold">Total</th>
                {allStatuses.map((s) => (
                  <th key={s} className="text-right py-2 px-2 text-gray-400 whitespace-nowrap">
                    <span title={s}>{s.length > 12 ? s.slice(0, 12) + "…" : s}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailData.map((p) => (
                <tr key={p.nombre} className="border-b border-gray-800/40 hover:bg-cyan-500/5">
                  <td className="py-2 px-2 text-white font-medium whitespace-nowrap sticky left-0" style={{ background: "var(--bg-card)" }}>
                    {p.nombre}
                  </td>
                  <td className="py-2 px-2 text-right text-cyan-400 font-bold">{p.total.toLocaleString()}</td>
                  {allStatuses.map((s) => {
                    const val = p.estados[s] || 0;
                    return (
                      <td key={s} className="py-2 px-2 text-right" style={{ color: val > 0 ? STATUS_COLORS[s] || "#9ca3af" : "#374151" }}>
                        {val > 0 ? val.toLocaleString() : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {provFilter === "all" && (
                <tr className="border-t border-cyan-500/30 font-bold">
                  <td className="py-2 px-2 text-white sticky left-0" style={{ background: "var(--bg-card)" }}>TOTAL</td>
                  <td className="py-2 px-2 text-right text-cyan-400">{aggData.total_orders.toLocaleString()}</td>
                  {allStatuses.map((s) => (
                    <td key={s} className="py-2 px-2 text-right" style={{ color: STATUS_COLORS[s] || "#9ca3af" }}>
                      {(aggData.by_status[s] || 0).toLocaleString()}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Products + Departamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Top 15 Productos</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={aggData.by_producto.slice(0, 15).map((p) => ({ name: p.nombre.length > 22 ? p.nombre.slice(0, 22) + "…" : p.nombre, ordenes: p.ordenes }))} layout="vertical" margin={{ left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 8 }} width={160} />
              <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString()} />
              <Bar dataKey="ordenes" fill="#F97316" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Distribución por Departamento</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={aggData.by_departamento.slice(0, 10).map((d, i) => ({ name: d.nombre, value: d.total, fill: PIE_COLORS[i % PIE_COLORS.length] }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={50} paddingAngle={2}>
                {aggData.by_departamento.slice(0, 10).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "12px", color: "#e5e7eb", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {aggData.by_departamento.slice(0, 10).map((d, i) => (
              <span key={d.nombre} className="text-[9px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {d.nombre} ({d.total})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Dropshippers table */}
      <div>
        <h3 className="text-sm font-bold text-cyan-400 mb-3">Top Dropshippers por Estado</h3>
        <div className="table-container overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
              <tr className="border-b border-cyan-500/20">
                <th className="text-left py-2 px-2 text-gray-400">#</th>
                <th className="text-left py-2 px-2 text-gray-400">Dropshipper</th>
                <th className="text-right py-2 px-2 text-gray-400 font-bold">Total</th>
                <th className="text-right py-2 px-2 text-green-400">Entreg.</th>
                <th className="text-right py-2 px-2 text-red-400">Cancel.</th>
                <th className="text-right py-2 px-2 text-blue-400">Guía Gen.</th>
                <th className="text-right py-2 px-2 text-orange-400">Novedad</th>
                <th className="text-right py-2 px-2 text-yellow-400">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {aggData.by_dropshipper.slice(0, 30).map((d, i) => (
                <tr key={d.nombre} className="border-b border-gray-800/40 hover:bg-cyan-500/5">
                  <td className="py-2 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-2 px-2 text-white font-medium truncate max-w-[200px]">{d.nombre}</td>
                  <td className="py-2 px-2 text-right text-cyan-400 font-bold">{d.total}</td>
                  <td className="py-2 px-2 text-right text-green-400">{d.estados["ENTREGADO"] || 0}</td>
                  <td className="py-2 px-2 text-right text-red-400">{d.estados["CANCELADO"] || 0}</td>
                  <td className="py-2 px-2 text-right text-blue-400">{d.estados["GUIA_GENERADA"] || 0}</td>
                  <td className="py-2 px-2 text-right text-orange-400">{(d.estados["NOVEDAD"] || 0) + (d.estados["NOVEDAD SOLUCIONADA"] || 0)}</td>
                  <td className="py-2 px-2 text-right text-yellow-400">{(d.estados["PENDIENTE"] || 0) + (d.estados["PENDIENTE CONFIRMACION"] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </ChartDownloadBtn>
  );
}
