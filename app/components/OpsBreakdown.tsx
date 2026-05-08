"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

// ─── Estados que NO cuentan como movilizadas ───
const NO_MOV = new Set([
  "PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA",
  "PREPARADO PARA TRANSPORTADORA", "CANCELADO", "RECHAZADO",
  "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA",
]);

const normalizeName = (s: string) => (s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\s*\(\d+\)\s*$/, "")
  .replace(/[^a-z0-9]/g, "");

interface OpsRow {
  nombre: string;
  total: number;
  estados: Record<string, number>;
  id?: any;
}

interface Aggregated {
  nombre: string;
  cleanNombre: string;
  total: number;
  mov: number;
  ent: number;
  dev: number;
  noEnt: number;
  cancelado: number;
  novedad: number;
  enTransito: number;
  pendienteDS: number;
  pctMov: number;
  pctEnt: number;
  pctDev: number;
}

function aggregate(rows: OpsRow[]): Aggregated[] {
  return rows.map((r) => {
    const e = r.estados || {};
    let noMov = 0;
    for (const k in e) if (NO_MOV.has(k)) noMov += e[k] || 0;
    const total = r.total || 0;
    const mov = total - noMov;
    const ent = e["ENTREGADO"] || 0;
    const dev = (e["DEVOLUCION"] || 0) + (e["EN PROCESO DE DEVOLUCION"] || 0);
    const noEnt = e["NO ENTREGADA"] || 0;
    const cancelado = (e["CANCELADO"] || 0) + (e["RECHAZADO"] || 0) + (e["GUIA ANULADA"] || 0) + (e["CANCELADO POR TRANSPORTADORA"] || 0);
    const novedad = (e["NOVEDAD"] || 0) + (e["NOVEDAD SOLUCIONADA"] || 0);
    const pendienteDS = e["PENDIENTE CONFIRMACION"] || 0;
    const enTransito = mov - ent - dev - noEnt - novedad;
    const pctMov = total > 0 ? mov / total : 0;
    const pctEnt = mov > 0 ? ent / mov : 0;
    const pctDev = mov > 0 ? dev / mov : 0;
    return {
      nombre: r.nombre,
      cleanNombre: r.nombre.replace(/\s*\(\d+\)\s*$/, "").trim(),
      total, mov, ent, dev, noEnt, cancelado, novedad, enTransito, pendienteDS,
      pctMov, pctEnt, pctDev,
    };
  }).sort((a, b) => b.mov - a.mov);
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════════════════
type Mes = "abril" | "mayo";
type Category = "dropshipper" | "proveedor";

const MES_LABEL: Record<Mes, string> = { abril: "Abril 2026", mayo: "Mayo 2026" };

export default function OpsBreakdown({
  country,
  mes,
  category,
}: {
  country: "ar" | "py";
  mes: Mes;
  category: Category;
}) {
  const [data, setData] = useState<Aggregated[]>([]);
  const [prev, setPrev] = useState<Aggregated[]>([]);
  const [loading, setLoading] = useState(true);

  const prevMes: Mes | null = mes === "mayo" ? "abril" : null;
  const dataKey = category === "dropshipper" ? "by_dropshipper" : "by_proveedor";
  const catLabel = category === "dropshipper" ? "Dropshippers" : "Proveedores";
  const catSing = category === "dropshipper" ? "Dropshipper" : "Proveedor";
  const emoji = category === "dropshipper" ? "👥" : "📦";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const reqs: Promise<any>[] = [
      fetch(`/api/data/operational?country=${country}&mes=${mes}`).then((r) => r.json()).catch(() => null),
    ];
    if (prevMes) {
      reqs.push(fetch(`/api/data/operational?country=${country}&mes=${prevMes}`).then((r) => r.json()).catch(() => null));
    }
    Promise.all(reqs).then(([cur, pr]) => {
      if (cancelled) return;
      const curRows = cur?.data?.[dataKey] || [];
      const prevRows = pr?.data?.[dataKey] || [];
      setData(aggregate(curRows));
      setPrev(aggregate(prevRows));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [country, mes, dataKey, prevMes]);

  const prevByKey = useMemo(() => {
    const m = new Map<string, Aggregated>();
    for (const r of prev) m.set(normalizeName(r.nombre), r);
    return m;
  }, [prev]);

  const enriched = useMemo(() => {
    return data.map((d) => {
      const prevEntry = prevByKey.get(normalizeName(d.nombre));
      const prevMov = prevEntry?.mov ?? 0;
      const prevTotal = prevEntry?.total ?? 0;
      const growthMov = prevMov > 0 ? ((d.mov - prevMov) / prevMov) * 100 : (d.mov > 0 && !prevEntry ? null : 0);
      return { ...d, prevMov, prevTotal, growthMov };
    });
  }, [data, prevByKey]);

  const totals = useMemo(() => ({
    total: data.reduce((s, r) => s + r.total, 0),
    mov: data.reduce((s, r) => s + r.mov, 0),
    ent: data.reduce((s, r) => s + r.ent, 0),
    dev: data.reduce((s, r) => s + r.dev, 0),
    noEnt: data.reduce((s, r) => s + r.noEnt, 0),
    cancelado: data.reduce((s, r) => s + r.cancelado, 0),
    novedad: data.reduce((s, r) => s + r.novedad, 0),
    pendienteDS: data.reduce((s, r) => s + r.pendienteDS, 0),
  }), [data]);

  const prevTotals = useMemo(() => ({
    mov: prev.reduce((s, r) => s + r.mov, 0),
    total: prev.reduce((s, r) => s + r.total, 0),
  }), [prev]);

  const growthTotalMov = prevTotals.mov > 0 ? ((totals.mov - prevTotals.mov) / prevTotals.mov) * 100 : null;

  // Pareto: top que acumula 80% del volumen
  const paretoTop = useMemo(() => {
    let acum = 0;
    const limit = totals.mov * 0.8;
    const out: typeof enriched = [];
    for (const r of enriched) {
      out.push(r);
      acum += r.mov;
      if (acum >= limit) break;
    }
    return out;
  }, [enriched, totals.mov]);

  const top20 = enriched.slice(0, 20);
  const top20Chart = top20.map((d) => ({
    name: d.cleanNombre.length > 18 ? d.cleanNombre.slice(0, 18) + "…" : d.cleanNombre,
    [MES_LABEL[mes].split(" ")[0]]: d.mov,
    ...(prevMes ? { [MES_LABEL[prevMes].split(" ")[0]]: d.prevMov } : {}),
  }));

  const breakdownData = [
    { name: "Entregadas", value: totals.ent, color: "#10B981" },
    { name: "En tránsito", value: Math.max(totals.mov - totals.ent - totals.dev - totals.noEnt - totals.novedad, 0), color: "#3B82F6" },
    { name: "No entregadas", value: totals.noEnt, color: "#F59E0B" },
    { name: "Devoluciones", value: totals.dev, color: "#EF4444" },
    { name: "Novedades", value: totals.novedad, color: "#A855F7" },
  ].filter((x) => x.value > 0);

  if (loading) {
    return <div className="glass-card p-5 text-xs t-muted">Cargando data operacional de {MES_LABEL[mes]}…</div>;
  }
  if (data.length === 0) {
    return (
      <div className="glass-card p-5 border border-amber-500/30 bg-amber-500/5">
        <p className="text-sm font-semibold t-primary mb-1">📋 No hay data operacional de {MES_LABEL[mes]} todavía</p>
        <p className="text-xs t-muted">Subí el Excel diario desde el sub-tab "📊 General" → "Análisis Operacional" para ver la data por {catLabel.toLowerCase()}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-lg font-bold t-primary flex items-center gap-2">
            {emoji} {catLabel} — Data Operacional {MES_LABEL[mes]}
          </h2>
          <span className="text-[11px] t-muted">{data.length} {catLabel.toLowerCase()} activos · {totals.mov.toLocaleString("es-AR")} guías movilizadas</span>
        </div>
        <p className="text-xs t-muted">Datos reales del archivo de Dropi cargado en el mes activo. {prevMes ? `Comparación vs ${MES_LABEL[prevMes]}.` : ""}</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Movilizadas" value={totals.mov} sub={prevMes ? `${growthTotalMov === null ? "—" : (growthTotalMov >= 0 ? "+" : "") + growthTotalMov.toFixed(1) + "%"} vs ${MES_LABEL[prevMes].split(" ")[0]}` : "Total mes"} color="#10B981" />
        <Kpi label="Entregadas" value={totals.ent} sub={`${totals.mov > 0 ? ((totals.ent / totals.mov) * 100).toFixed(1) : 0}% de movilizadas`} color="#3B82F6" />
        <Kpi label="Devoluciones" value={totals.dev} sub={`${totals.mov > 0 ? ((totals.dev / totals.mov) * 100).toFixed(1) : 0}% de movilizadas`} color="#EF4444" />
        <Kpi label="No entregadas" value={totals.noEnt} sub={`${totals.mov > 0 ? ((totals.noEnt / totals.mov) * 100).toFixed(1) : 0}% de movilizadas`} color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 20 con comparación */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold t-primary mb-3">Top 20 {catLabel} por volumen movilizado</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top20Chart} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis type="number" stroke="#888" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#888" fontSize={10} width={130} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString("es-AR")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {prevMes && <Bar dataKey={MES_LABEL[prevMes].split(" ")[0]} fill="#6B7280" radius={[0, 4, 4, 0]} barSize={10} />}
              <Bar dataKey={MES_LABEL[mes].split(" ")[0]} fill="#F97316" radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de estados */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold t-primary mb-3">Distribución de estados — {MES_LABEL[mes]}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={breakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2} label={(e) => `${e.name}: ${e.value.toLocaleString("es-AR")}`}>
                {breakdownData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString("es-AR")} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
            <div className="t-muted">Pendientes confirmación: <strong className="t-primary">{totals.pendienteDS.toLocaleString("es-AR")}</strong></div>
            <div className="t-muted">Canceladas/rechazadas: <strong className="t-primary">{totals.cancelado.toLocaleString("es-AR")}</strong></div>
          </div>
        </div>
      </div>

      {/* Pareto card */}
      <div className="glass-card p-5 border-l-2 border-orange-500/40">
        <h3 className="text-sm font-semibold t-primary mb-2">📌 Pareto del mes — {paretoTop.length} {catLabel.toLowerCase()} concentran 80% del volumen movilizado</h3>
        <div className="flex flex-wrap gap-2">
          {paretoTop.map((d, i) => (
            <span key={d.nombre} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] border border-orange-500/30 bg-orange-500/10 text-orange-300">
              <span className="font-bold">{i + 1}.</span> {d.cleanNombre} <span className="t-muted">{d.mov.toLocaleString("es-AR")}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Tabla detallada con comparación */}
      <div className="glass-card overflow-x-auto">
        <h3 className="text-sm font-semibold t-primary mb-3 px-5 pt-5">Detalle por {catSing.toLowerCase()} — {MES_LABEL[mes]}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-3 text-left text-[11px] t-muted">{catSing}</th>
              {prevMes && <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[prevMes].split(" ")[0]} ing.</th>}
              {prevMes && <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[prevMes].split(" ")[0]} mov.</th>}
              <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[mes].split(" ")[0]} ing.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[mes].split(" ")[0]} mov.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Crec. mov</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Entregadas</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">% Ent.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Devoluciones</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">% Dev.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">No entr.</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((d, i) => (
              <tr key={d.nombre} className="border-b border-gray-800/50 hover:bg-orange-500/5">
                <td className="py-2 px-3 t-primary text-xs">
                  <span className="t-muted mr-2">{i + 1}.</span>{d.cleanNombre}
                </td>
                {prevMes && <td className="py-2 px-3 text-right font-mono text-xs t-muted">{d.prevTotal > 0 ? d.prevTotal.toLocaleString("es-AR") : "—"}</td>}
                {prevMes && <td className="py-2 px-3 text-right font-mono text-xs t-muted">{d.prevMov > 0 ? d.prevMov.toLocaleString("es-AR") : "—"}</td>}
                <td className="py-2 px-3 text-right font-mono text-xs t-secondary">{d.total.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs font-bold text-orange-400">{d.mov.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: d.growthMov === null ? "#10B981" : (d.growthMov ?? 0) >= 0 ? "#10B981" : "#EF4444" }}>
                  {d.growthMov === null ? "🆕" : (d.growthMov >= 0 ? "+" : "") + d.growthMov.toFixed(0) + "%"}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs">{d.ent.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: d.pctEnt >= 0.6 ? "#10B981" : d.pctEnt >= 0.4 ? "#F59E0B" : "#EF4444" }}>
                  {(d.pctEnt * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs">{d.dev.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: d.pctDev > 0.3 ? "#EF4444" : d.pctDev > 0.2 ? "#F59E0B" : "#9CA3AF" }}>
                  {(d.pctDev * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs t-muted">{d.noEnt.toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "rgba(249,115,22,0.08)", fontWeight: 700 }}>
              <td className="py-2 px-3 t-primary text-xs">TOTAL ({data.length})</td>
              {prevMes && <td className="py-2 px-3 text-right font-mono text-xs">{prevTotals.total.toLocaleString("es-AR")}</td>}
              {prevMes && <td className="py-2 px-3 text-right font-mono text-xs">{prevTotals.mov.toLocaleString("es-AR")}</td>}
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.total.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs text-orange-400">{totals.mov.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: (growthTotalMov ?? 0) >= 0 ? "#10B981" : "#EF4444" }}>
                {growthTotalMov === null ? "—" : (growthTotalMov >= 0 ? "+" : "") + growthTotalMov.toFixed(1) + "%"}
              </td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.ent.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.mov > 0 ? ((totals.ent / totals.mov) * 100).toFixed(0) : 0}%</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.dev.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.mov > 0 ? ((totals.dev / totals.mov) * 100).toFixed(0) : 0}%</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.noEnt.toLocaleString("es-AR")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[11px] t-muted">{label}</p>
      <p className="font-mono text-xl font-semibold" style={{ color }}>{value.toLocaleString("es-AR")}</p>
      <p className="text-[10px] t-muted mt-1">{sub}</p>
    </div>
  );
}
