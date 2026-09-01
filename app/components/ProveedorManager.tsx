"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";
import type { MesFilter } from "../types";

const NO_MOV = new Set([
  "PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA",
  "PREPARADO PARA TRANSPORTADORA", "CANCELADO", "RECHAZADO",
  "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA",
]);

interface MetaInfo {
  meta_movilizadas_abril: number;
  meta_ingresadas_abril: number;
  meta_movilizadas_mayo?: number;
  meta_ingresadas_mayo?: number;
  [key: string]: any;
}

type OpsRow = { nombre: string; total: number; estados: Record<string, number>; id?: any };

interface ProveedorRow {
  nombre: string;
  cleanNombre: string;
  dropiId: string;
  abrIng: number;
  abrMov: number;
  abrEnt: number;
  abrDev: number;
  mayIng: number;
  mayMov: number;
  mayEnt: number;
  mayDev: number;
  baseMov: number;       // Mov del mes de comparación (Abril cerrado)
  baseIng: number;
  totalMov: number;       // Abril + Mayo combinados
  totalIng: number;
  totalEnt: number;
  totalDev: number;
  pctEnt: number;
  pctDev: number;
  pctMov: number;         // tasa de movilización
  growth: number;         // (mayMov - abrMov) / abrMov * 100
  goalMov: number;
  goalIng: number;
  incrementNeeded: number;
  share: number;
  category: "escalar" | "reactivar" | "mejorar_conv" | "alto_dev" | "mantener";
  action: string;
  priority: "alta" | "media" | "baja";
  seguimiento: string[];
  score: number;
}

function aggregate(rows: OpsRow[]) {
  const map = new Map<string, { mov: number; ing: number; ent: number; dev: number }>();
  for (const r of rows || []) {
    const e = r.estados || {};
    let noMov = 0;
    for (const k in e) if (NO_MOV.has(k)) noMov += e[k] || 0;
    const total = r.total || 0;
    const mov = total - noMov;
    const ent = e["ENTREGADO"] || 0;
    const dev = (e["DEVOLUCION"] || 0) + (e["EN PROCESO DE DEVOLUCION"] || 0);
    map.set(r.nombre, { mov, ing: total, ent, dev });
  }
  return map;
}

export default function ProveedorManager({
  mesFilter = "abril",
  metaInfo,
  country = "py",
}: {
  mesFilter?: MesFilter;
  metaInfo?: MetaInfo;
  country?: "ar" | "py";
}) {
  const isAbril = mesFilter === "abril";
  const isMayo = mesFilter === "mayo";
  const isJunio = mesFilter === "junio";
  const isJulio = mesFilter === "julio";
  const isAgosto = mesFilter === "agosto";
  const isSeptiembre = mesFilter === "septiembre";
  const isPlanning = isMayo || isJunio || isJulio || isAgosto || isSeptiembre;
  const TARGET = isSeptiembre ? "Septiembre" : isAgosto ? "Agosto" : isJulio ? "Julio" : isJunio ? "Junio" : isMayo ? "Mayo" : "Abril";
  const COMP = isSeptiembre ? "Agosto" : isAgosto ? "Julio" : isJulio ? "Junio" : isJunio ? "Mayo" : isMayo ? "Abril" : "Marzo";

  const mi = metaInfo as any;
  const META_MOV = isSeptiembre
    ? (mi?.meta_movilizadas_septiembre ?? mi?.meta_movilizadas_agosto ?? 40000)
    : isAgosto
    ? (mi?.meta_movilizadas_agosto ?? mi?.meta_movilizadas_julio ?? 40000)
    : isJulio
    ? (mi?.meta_movilizadas_julio ?? mi?.meta_movilizadas_junio ?? 40000)
    : isJunio
    ? (mi?.meta_movilizadas_junio ?? metaInfo?.meta_movilizadas_mayo ?? metaInfo?.meta_movilizadas_abril ?? 40000)
    : isMayo
    ? (metaInfo?.meta_movilizadas_mayo ?? metaInfo?.meta_movilizadas_abril ?? 40000)
    : (metaInfo?.meta_movilizadas_abril ?? 40000);
  const META_ING = isSeptiembre
    ? (mi?.meta_ingresadas_septiembre ?? mi?.meta_ingresadas_agosto ?? 51283)
    : isAgosto
    ? (mi?.meta_ingresadas_agosto ?? mi?.meta_ingresadas_julio ?? 51283)
    : isJulio
    ? (mi?.meta_ingresadas_julio ?? mi?.meta_ingresadas_junio ?? 51283)
    : isJunio
    ? (mi?.meta_ingresadas_junio ?? metaInfo?.meta_ingresadas_mayo ?? metaInfo?.meta_ingresadas_abril ?? 51283)
    : isMayo
    ? (metaInfo?.meta_ingresadas_mayo ?? metaInfo?.meta_ingresadas_abril ?? 51283)
    : (metaInfo?.meta_ingresadas_abril ?? 51283);

  const [opsAbril, setOpsAbril] = useState<OpsRow[]>([]);
  const [opsMayo, setOpsMayo] = useState<OpsRow[]>([]);
  type ProvDaily = { proveedor: string; provId: number; fecha: string; ordenes: number; estados: Record<string, number> };
  const [provDailyAbril, setProvDailyAbril] = useState<ProvDaily[]>([]);
  const [provDailyMayo, setProvDailyMayo] = useState<ProvDaily[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "escalar" | "reactivar" | "mejorar_conv" | "alto_dev">("all");
  const [selectedNombre, setSelectedNombre] = useState<string | null>(null);

  // Filtro por rango de fecha (sobre el día del mes — el filtro espejo se aplica al mes anterior)
  const [dateMode, setDateMode] = useState<"all" | "range">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Cuando el mes activo es Julio: comp=junio target=julio
    const compMes = isSeptiembre ? "agosto" : isAgosto ? "julio" : isJulio ? "junio" : isJunio ? "mayo" : "abril";
    const targetMes = isSeptiembre ? "septiembre" : isAgosto ? "agosto" : isJulio ? "julio" : isJunio ? "junio" : "mayo";
    Promise.all([
      fetch(`/api/data/operational?country=${country}&mes=${compMes}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/data/operational?country=${country}&mes=${targetMes}`).then((r) => r.json()).catch(() => null),
    ]).then(([abr, may]) => {
      if (cancelled) return;
      setOpsAbril(Array.isArray(abr?.data?.by_proveedor) ? abr.data.by_proveedor : []);
      setOpsMayo(Array.isArray(may?.data?.by_proveedor) ? may.data.by_proveedor : []);
      setProvDailyAbril(Array.isArray(abr?.data?.by_prov_daily) ? abr.data.by_prov_daily : []);
      setProvDailyMayo(Array.isArray(may?.data?.by_prov_daily) ? may.data.by_prov_daily : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [country, isJunio, isJulio, isAgosto, isSeptiembre]);

  // Agrupa by_prov_daily filtrando por día del mes (1..31) → OpsRow agregada por proveedor
  function aggregateProvDaily(daily: ProvDaily[], fromDay: number, toDay: number): OpsRow[] {
    const map = new Map<string, { id: number; total: number; estados: Record<string, number> }>();
    const fechaToDay = (s: string): number => {
      const m = s.match(/^(\d{1,2})[-\/]/);
      return m ? parseInt(m[1], 10) : 0;
    };
    for (const r of daily) {
      const day = fechaToDay(r.fecha);
      if (day < fromDay || day > toDay) continue;
      if (!map.has(r.proveedor)) map.set(r.proveedor, { id: r.provId, total: 0, estados: {} });
      const e = map.get(r.proveedor)!;
      e.total += r.ordenes || 0;
      for (const [s, c] of Object.entries(r.estados || {})) {
        e.estados[s] = (e.estados[s] || 0) + (c as number);
      }
    }
    return Array.from(map.entries()).map(([nombre, v]) => ({ nombre, ...v }));
  }

  // Efectivos: si dateMode=range usa los daily filtrados; si "all", los monthly totals
  const effOpsAbril = useMemo(() => {
    if (dateMode !== "range" || (!dateFrom && !dateTo)) return opsAbril;
    const fromDay = dateFrom ? parseInt(dateFrom.slice(8, 10), 10) : 1;
    const toDay = dateTo ? parseInt(dateTo.slice(8, 10), 10) : 31;
    return aggregateProvDaily(provDailyAbril, fromDay, toDay);
  }, [dateMode, dateFrom, dateTo, opsAbril, provDailyAbril]);

  const effOpsMayo = useMemo(() => {
    if (dateMode !== "range" || (!dateFrom && !dateTo)) return opsMayo;
    const fromDay = dateFrom ? parseInt(dateFrom.slice(8, 10), 10) : 1;
    const toDay = dateTo ? parseInt(dateTo.slice(8, 10), 10) : 31;
    return aggregateProvDaily(provDailyMayo, fromDay, toDay);
  }, [dateMode, dateFrom, dateTo, opsMayo, provDailyMayo]);

  const rows: ProveedorRow[] = useMemo(() => {
    const aMap = aggregate(effOpsAbril);
    const mMap = aggregate(effOpsMayo);
    const allKeys = new Set<string>([...aMap.keys(), ...mMap.keys()]);

    // Pre-compute totals for share calculation
    const baseMovTotals: { nombre: string; baseMov: number }[] = [];
    allKeys.forEach((nombre) => {
      const a = aMap.get(nombre) || { mov: 0, ing: 0, ent: 0, dev: 0 };
      const m = mMap.get(nombre) || { mov: 0, ing: 0, ent: 0, dev: 0 };
      const baseMov = a.mov > 0 ? a.mov : m.mov;
      if (baseMov > 0) baseMovTotals.push({ nombre, baseMov });
    });
    const totalBaseMov = baseMovTotals.reduce((s, r) => s + r.baseMov, 0);
    const maxBaseMov = baseMovTotals.reduce((m, r) => Math.max(m, r.baseMov), 0) || 1;

    const out: ProveedorRow[] = [];
    allKeys.forEach((nombre) => {
      const a = aMap.get(nombre) || { mov: 0, ing: 0, ent: 0, dev: 0 };
      const m = mMap.get(nombre) || { mov: 0, ing: 0, ent: 0, dev: 0 };
      const baseMov = a.mov > 0 ? a.mov : m.mov;
      const baseIng = a.ing > 0 ? a.ing : m.ing;
      const totalMov = a.mov + m.mov;
      const totalIng = a.ing + m.ing;
      const totalEnt = a.ent + m.ent;
      const totalDev = a.dev + m.dev;
      const refEnt = a.mov > 0 ? a.ent : m.ent;
      const refDev = a.mov > 0 ? a.dev : m.dev;
      const pctEnt = baseMov > 0 ? refEnt / baseMov : 0;
      const pctDev = baseMov > 0 ? refDev / baseMov : 0;
      const pctMov = baseIng > 0 ? baseMov / baseIng : 0;
      const growth = a.mov > 0
        ? ((m.mov - a.mov) / a.mov) * 100
        : (m.mov > 0 ? 100 : 0);
      const share = totalBaseMov > 0 ? baseMov / totalBaseMov : 0;
      const goalMov = Math.round(META_MOV * share);
      const goalIng = Math.round(META_ING * share);
      const incrementNeeded = baseMov > 0 ? Math.round(((goalMov - baseMov) / baseMov) * 100) : 0;

      // Categorize
      let category: ProveedorRow["category"] = "mantener";
      let action = "Mantener y optimizar";
      let priority: ProveedorRow["priority"] = "baja";
      const seguimiento: string[] = [];

      if (pctDev > 0.30 && baseMov > 50) {
        category = "alto_dev";
        action = "Reducir devoluciones urgente";
        priority = "alta";
        seguimiento.push(`${(pctDev * 100).toFixed(0)}% de devolución actual — auditar productos con más rechazo`);
        seguimiento.push("Revisar packaging, calidad y descripción del listing");
        seguimiento.push("Acompañar a dropshippers en la selección de productos");
        seguimiento.push("Si no baja en 30 días, evaluar reducir exposición");
      } else if (growth > 30 && baseMov > 100) {
        category = "escalar";
        action = "Escalar agresivamente";
        priority = "alta";
        seguimiento.push(`Crecimiento del ${growth.toFixed(0)}% Abril→Mayo — momentum a aprovechar`);
        seguimiento.push("Asegurar stock para soportar el ritmo de ventas");
        seguimiento.push("Conectar con más dropshippers (sumar sellers)");
        seguimiento.push("Negociar mejores tarifas / exclusividad de productos");
      } else if (growth < -20 && baseMov > 200) {
        category = "reactivar";
        action = "Reactivar con seguimiento intensivo";
        priority = "alta";
        seguimiento.push(`Caída del ${Math.abs(growth).toFixed(0)}% Abril→Mayo — investigar causa`);
        seguimiento.push("Contacto directo: ¿problemas de stock, calidad, precios?");
        seguimiento.push("Ofrecer incentivos / promo para recuperar volumen");
        seguimiento.push("Revisar si los dropshippers que vendían están activos");
      } else if (pctEnt < 0.50 && baseMov > 100) {
        category = "mejorar_conv";
        action = "Mejorar tasa de entrega";
        priority = "media";
        seguimiento.push(`Solo ${(pctEnt * 100).toFixed(0)}% de movilizadas terminan entregadas`);
        seguimiento.push("Revisar logística (tiempos, rutas) y comunicación con compradores");
        seguimiento.push("Identificar productos con mayor tasa de no-entrega");
        seguimiento.push("Capacitar dropshippers en confirmar bien el pedido");
      } else {
        category = "mantener";
        action = "Mantener y optimizar";
        priority = "baja";
        seguimiento.push("Performance estable, mantener acompañamiento mensual");
        if (incrementNeeded > 0) seguimiento.push(`Para alcanzar meta ${TARGET}: +${incrementNeeded}% (${(goalMov - baseMov).toLocaleString("es-AR")} guías más)`);
      }

      // Score: volumen (50%) + crecimiento (25%) + entrega (15%) + baja-dev (10%)
      const volumeScore = Math.min(baseMov / maxBaseMov, 1) * 50;
      const growthScore = Math.max(-25, Math.min(25, (growth / 100) * 25));
      const entScore = pctEnt * 15;
      const devScore = (1 - Math.min(pctDev, 1)) * 10;
      const score = Math.round(volumeScore + growthScore + entScore + devScore);

      const idMatch = nombre.match(/\((\d+)\)\s*$/);
      out.push({
        nombre,
        cleanNombre: nombre.replace(/\s*\(\d+\)\s*$/, "").trim(),
        dropiId: idMatch ? idMatch[1] : "",
        abrIng: a.ing, abrMov: a.mov, abrEnt: a.ent, abrDev: a.dev,
        mayIng: m.ing, mayMov: m.mov, mayEnt: m.ent, mayDev: m.dev,
        baseMov, baseIng,
        totalMov, totalIng, totalEnt, totalDev,
        pctEnt, pctDev, pctMov, growth,
        goalMov, goalIng, incrementNeeded, share: share * 100,
        category, action, priority, seguimiento, score,
      });
    });

    return out
      .filter((p) => p.baseMov > 0 || p.mayMov > 0)
      .sort((a, b) => {
        if (b.baseMov !== a.baseMov) return b.baseMov - a.baseMov;
        return b.score - a.score;
      });
  }, [effOpsAbril, effOpsMayo, META_MOV, META_ING, TARGET]);

  const escalables = rows.filter((r) => r.category === "escalar");
  const reactivar = rows.filter((r) => r.category === "reactivar");
  const mejorarConv = rows.filter((r) => r.category === "mejorar_conv");
  const altoDev = rows.filter((r) => r.category === "alto_dev");
  const mantener = rows.filter((r) => r.category === "mantener");

  const filtered = useMemo(() => {
    let r = rows;
    if (filterType !== "all") r = r.filter((p) => p.category === filterType);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((p) => p.cleanNombre.toLowerCase().includes(s));
    }
    return r;
  }, [rows, filterType, search]);

  const selected = selectedNombre ? rows.find((p) => p.nombre === selectedNombre) : null;

  const catColors: Record<string, string> = {
    escalar: "#10B981", reactivar: "#F59E0B", mejorar_conv: "#3B82F6", alto_dev: "#EF4444", mantener: "#6B7280",
  };
  const catLabels: Record<string, string> = {
    escalar: "Escalar", reactivar: "Reactivar", mejorar_conv: "Mejorar Conv.", alto_dev: "Alto Dev", mantener: "Mantener",
  };

  const chartData = rows.slice(0, 20).map((p) => ({
    name: p.cleanNombre.length > 18 ? p.cleanNombre.slice(0, 18) + "…" : p.cleanNombre,
    [`${COMP} Mov`]: p.baseMov,
    [`Meta ${TARGET}`]: p.goalMov,
    category: p.category,
  }));

  if (loading) {
    return <div className="glass-card p-5 text-xs t-muted">Cargando data operacional para gestión de proveedores…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="glass-card p-5 border border-amber-500/30 bg-amber-500/5">
        <p className="text-sm font-semibold t-primary mb-1">📦 No hay data operacional para gestión de proveedores</p>
        <p className="text-xs t-muted">Subí el Excel diario desde "📊 General" → "Análisis Operacional" para ver el plan de seguimiento.</p>
      </div>
    );
  }

  return (
    <ChartDownloadBtn filename={`Gestion_Proveedores_${TARGET}`}>
    <div className="glass-card p-6 border-orange-500/30">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
        📦 Gestión de Proveedores — Plan de Seguimiento {TARGET}
      </h2>
      <p className="text-xs text-gray-400 mb-6">
        {rows.length} proveedores activos &middot; Base {COMP} → meta {TARGET}, score y categorización
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Escalar", count: escalables.length, color: "green", emoji: "🚀", desc: "Crecimiento >30%" },
          { label: "Reactivar", count: reactivar.length, color: "yellow", emoji: "⚡", desc: "Cayeron >20%" },
          { label: "Mejorar Conv.", count: mejorarConv.length, color: "blue", emoji: "🎯", desc: "% entrega <50%" },
          { label: "Alto Dev", count: altoDev.length, color: "red", emoji: "⚠️", desc: ">30% devolución" },
          { label: "Total Activos", count: rows.length, color: "orange", emoji: "📦", desc: `Proveedores ${COMP}` },
        ].map(({ label, count, color, emoji, desc }) => (
          <div key={label} className={`rounded-xl p-3 border border-${color}-500/20`} style={{ background: `rgba(${color === "green" ? "16,185,129" : color === "yellow" ? "245,158,11" : color === "blue" ? "59,130,246" : color === "red" ? "239,68,68" : "249,115,22"},0.05)` }}>
            <div className="flex items-center gap-1 mb-1">
              <span>{emoji}</span>
              <span className="text-xs font-medium text-gray-300">{label}</span>
            </div>
            <p className={`text-xl font-bold text-${color}-400`}>{count}</p>
            <p className="text-[10px] text-gray-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Top 20 Proveedores: {COMP} vs Meta {TARGET}</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 9 }} width={130} />
            <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }} formatter={(v) => Number(v).toLocaleString()} />
            <Bar dataKey={`${COMP} Mov`} fill="#6B7280" radius={[0, 4, 4, 0]} barSize={10} />
            <Bar dataKey={`Meta ${TARGET}`} radius={[0, 4, 4, 0]} barSize={10}>
              {chartData.map((entry, i) => <Cell key={i} fill={catColors[entry.category]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Date range filter (compara mismos días en ambos meses) */}
      <div className="flex flex-wrap items-end gap-3 mb-3 p-3 rounded-lg bg-[#16213e]/40 border border-orange-500/15">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">Rango fecha orden</label>
          <select value={dateMode} onChange={(e) => setDateMode(e.target.value as "all" | "range")} className="text-xs px-2 py-1.5 rounded-lg bg-transparent border border-gray-700 text-white focus:border-orange-500 outline-none">
            <option value="all">Todo el mes</option>
            <option value="range">Rango de días</option>
          </select>
        </div>
        {dateMode === "range" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Desde</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-transparent border border-gray-700 text-white focus:border-orange-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Hasta</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg bg-transparent border border-gray-700 text-white focus:border-orange-500 outline-none" />
            </div>
            <span className="text-[10px] text-cyan-300 self-end pb-1">
              Comparación: mismos días de {COMP} vs {TARGET}.
              {provDailyAbril.length === 0 && provDailyMayo.length === 0 && (
                <span className="block text-amber-300">⚠️ Re-subí el reporte Comercial para activar el filtro por día (necesita la nueva agregación by_prov_daily).</span>
              )}
            </span>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-2 rounded-lg bg-[#16213e] border border-orange-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 flex-1 max-w-xs"
        />
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all", label: "Todos" },
            { key: "escalar", label: `🚀 Escalar (${escalables.length})` },
            { key: "reactivar", label: `⚡ Reactivar (${reactivar.length})` },
            { key: "mejorar_conv", label: `🎯 Mejorar (${mejorarConv.length})` },
            { key: "alto_dev", label: `⚠️ Alto Dev (${altoDev.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterType(key as typeof filterType)}
              className={`text-[11px] px-3 py-1.5 rounded-lg transition-all ${
                filterType === key
                  ? "bg-orange-500 text-white"
                  : "bg-transparent text-gray-400 border border-gray-700 hover:border-orange-500/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="mb-4 p-4 rounded-xl border border-orange-500/30" style={{ background: "rgba(249,115,22,0.03)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-orange-400">{selected.cleanNombre}</h3>
            <button onClick={() => setSelectedNombre(null)} className="text-xs text-gray-500 hover:text-gray-300">Cerrar</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Meta {TARGET} Mov</p>
              <p className="text-lg font-bold text-orange-400">{selected.goalMov.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Meta {TARGET} Ing</p>
              <p className="text-lg font-bold text-blue-400">{selected.goalIng.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Incremento necesario</p>
              <p className={`text-lg font-bold ${selected.incrementNeeded > 50 ? "text-red-400" : "text-green-400"}`}>+{selected.incrementNeeded}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">% Meta total</p>
              <p className="text-lg font-bold text-purple-400">{selected.share.toFixed(1)}%</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 pt-3 border-t border-gray-700/30">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">{COMP} Mov</p>
              <p className="text-sm font-bold text-gray-300">{selected.baseMov.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Mayo Mov (avance)</p>
              <p className="text-sm font-bold text-gray-300">{selected.mayMov.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">% Entrega</p>
              <p className="text-sm font-bold text-green-400">{(selected.pctEnt * 100).toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">% Devolución</p>
              <p className={`text-sm font-bold ${selected.pctDev > 0.3 ? "text-red-400" : "text-yellow-400"}`}>{(selected.pctDev * 100).toFixed(1)}%</p>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-orange-400 mb-2">📋 Plan de seguimiento ({selected.priority} prioridad)</h4>
            <ul className="text-xs text-gray-300 space-y-1 ml-3">
              {selected.seguimiento.map((s, i) => (<li key={i}>• {s}</li>))}
            </ul>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
            <tr className="border-b border-orange-500/20">
              <th className="text-left py-2 px-2 text-gray-400">#</th>
              <th className="text-left py-2 px-2 text-gray-400">Proveedor</th>
              <th className="text-left py-2 px-2 text-gray-400">Usuario Dropi</th>
              <th className="text-right py-2 px-2 text-gray-400">{COMP} Ing</th>
              <th className="text-right py-2 px-2 text-gray-400">{COMP} Mov</th>
              <th className="text-right py-2 px-2 text-gray-400">{TARGET} Ing</th>
              <th className="text-right py-2 px-2 text-gray-400">{TARGET} Mov</th>
              <th className="text-right py-2 px-2 text-orange-400 font-bold">Meta {TARGET.slice(0, 3)}</th>
              <th className="text-right py-2 px-2 text-gray-400">Incr.</th>
              <th className="text-right py-2 px-2 text-gray-400">% Ent</th>
              <th className="text-right py-2 px-2 text-gray-400">% Dev</th>
              <th className="text-right py-2 px-2 text-gray-400">Crec.</th>
              <th className="text-left py-2 px-2 text-gray-400">Acción</th>
              <th className="text-center py-2 px-2 text-gray-400">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((p, i) => (
              <tr key={p.nombre} className={`border-b border-gray-800/40 hover:bg-orange-500/5 ${selectedNombre === p.nombre ? "bg-orange-500/10" : ""}`}>
                <td className="py-2 px-2 text-gray-500">{i + 1}</td>
                <td className="py-2 px-2 text-white font-medium max-w-[180px] truncate" title={p.cleanNombre}>{p.cleanNombre}</td>
                <td className="py-2 px-2 text-cyan-300 text-[11px] font-mono">{p.dropiId || "—"}</td>
                <td className="py-2 px-2 text-right text-gray-400">{p.abrIng > 0 ? p.abrIng.toLocaleString() : "—"}</td>
                <td className="py-2 px-2 text-right text-blue-400">{p.abrMov > 0 ? p.abrMov.toLocaleString() : "—"}</td>
                <td className="py-2 px-2 text-right text-gray-400">{p.mayIng > 0 ? p.mayIng.toLocaleString() : "—"}</td>
                <td className="py-2 px-2 text-right text-blue-300">{p.mayMov > 0 ? p.mayMov.toLocaleString() : "—"}</td>
                <td className="py-2 px-2 text-right text-orange-400 font-bold">{p.goalMov.toLocaleString()}</td>
                <td className="py-2 px-2 text-right">
                  <span className={p.incrementNeeded > 50 ? "text-red-400" : p.incrementNeeded > 20 ? "text-yellow-400" : "text-green-400"}>
                    +{p.incrementNeeded}%
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-green-400">{(p.pctEnt * 100).toFixed(0)}%</td>
                <td className="py-2 px-2 text-right">
                  <span className={p.pctDev > 0.3 ? "text-red-400 font-bold" : p.pctDev > 0.2 ? "text-yellow-400" : "text-gray-400"}>{(p.pctDev * 100).toFixed(0)}%</span>
                </td>
                <td className="py-2 px-2 text-right">
                  <span className={p.growth > 0 ? "text-green-400" : "text-red-400"}>
                    {p.growth > 0 ? "+" : ""}{p.growth.toFixed(0)}%
                  </span>
                </td>
                <td className="py-2 px-2 text-left max-w-[180px]">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: catColors[p.category] + "20", color: catColors[p.category] }}>
                    {catLabels[p.category]}
                  </span>
                </td>
                <td className="py-2 px-2 text-center">
                  <button onClick={() => setSelectedNombre(selectedNombre === p.nombre ? null : p.nombre)} className="text-[10px] text-orange-400 hover:text-orange-300">
                    {selectedNombre === p.nombre ? "Ocultar" : "Ver"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom strategies */}
      <div className="mt-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
        <h3 className="text-sm font-bold text-orange-400 mb-3">📋 Estrategia de Seguimiento por Categoría</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs text-gray-300">
          <div>
            <h4 className="font-medium text-green-400 mb-1">🚀 Escalar ({escalables.length} proveedores)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Asegurar stock para ritmo de ventas creciente</li>
              <li>• Sumar más dropshippers que vendan sus productos</li>
              <li>• Negociar tarifas mejores o exclusividad</li>
              <li>• Promocionar productos top en campañas</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-yellow-400 mb-1">⚡ Reactivar ({reactivar.length} proveedores)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Contacto directo en próximas 48hs</li>
              <li>• Identificar causa: stock, precios, competencia</li>
              <li>• Ofrecer incentivo / promo para recuperar</li>
              <li>• Revisar si dropshippers que vendían siguen activos</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-1">🎯 Mejorar Conversión ({mejorarConv.length} proveedores)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Auditar % entrega bajo (&lt;50%): logística, comunicación</li>
              <li>• Identificar productos con mayor no-entrega</li>
              <li>• Capacitar dropshippers en confirmar bien el pedido</li>
              <li>• Meta: subir tasa de entrega +15pp</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-red-400 mb-1">⚠️ Reducir Devoluciones ({altoDev.length} proveedores)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Auditar productos con más rechazo</li>
              <li>• Revisar packaging, calidad, descripciones</li>
              <li>• Acompañar dropshippers en selección de productos</li>
              <li>• Si no baja en 30 días, reducir exposición</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    </ChartDownloadBtn>
  );
}
