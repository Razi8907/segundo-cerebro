"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend,
} from "recharts";

type Mes = "abril" | "mayo" | "junio";
const MESES: Mes[] = ["abril", "mayo", "junio"];
const MES_LABEL: Record<Mes, string> = { abril: "Abril", mayo: "Mayo", junio: "Junio" };

const NO_MOV = new Set([
  "PENDIENTE","PENDIENTE CONFIRMACION","GUIA_GENERADA","PREPARADO PARA TRANSPORTADORA",
  "CANCELADO","RECHAZADO","GUIA ANULADA","CANCELADO POR TRANSPORTADORA",
]);

interface OpSnapshot {
  total_orders: number;
  by_status: Record<string, number>;
  by_dropshipper: { nombre: string; total: number; estados: Record<string, number> }[];
  by_proveedor: { nombre: string; id?: number; total: number; estados: Record<string, number> }[];
  by_producto: { nombre: string; cantidad: number; ordenes: number; proveedor: string }[];
  by_date: { fecha: string; total: number; estados: Record<string, number> }[];
  logistics?: { by_transportadora: { nombre: string; total: number; entregado: number; pctEntrega: number }[] };
}

interface MetaInfo {
  meta_movilizadas_abril?: number;
  meta_ingresadas_abril?: number;
  meta_movilizadas_mayo?: number;
  meta_ingresadas_mayo?: number;
  meta_movilizadas_junio?: number;
  meta_ingresadas_junio?: number;
  [k: string]: any;
}

interface ResumenMes { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number }

function movFromEstados(estados: Record<string, number>): number {
  let total = 0, noMov = 0;
  for (const k in estados) {
    total += estados[k] || 0;
    if (NO_MOV.has(k)) noMov += estados[k] || 0;
  }
  return Math.max(total - noMov, 0);
}

function entregadasFromEstados(estados: Record<string, number>): number {
  return estados["ENTREGADO"] || 0;
}

function devolucionesFromEstados(estados: Record<string, number>): number {
  return (estados["DEVOLUCION"] || 0) + (estados["EN PROCESO DE DEVOLUCION"] || 0);
}

export default function Q2Resumen({ country }: { country: "ar" | "py" }) {
  const [snaps, setSnaps] = useState<Record<Mes, OpSnapshot | null>>({ abril: null, mayo: null, junio: null });
  const [metaInfo, setMetaInfo] = useState<MetaInfo>({});
  const [resumen, setResumen] = useState<Record<string, ResumenMes>>({});
  const [usuariosQ2, setUsuariosQ2] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Get operational snapshots
      const ops = await Promise.all(
        MESES.map((m) => fetch(`/api/data/operational?country=${country}&mes=${m}`).then(r => r.json()).catch(() => null))
      );
      const opsMap: Record<Mes, OpSnapshot | null> = { abril: null, mayo: null, junio: null };
      MESES.forEach((m, i) => { opsMap[m] = ops[i]?.data || null; });
      setSnaps(opsMap);

      // Get dashboard (resumen, meta_info)
      const dash = await fetch(`/api/data/${country}`).then(r => r.json()).catch(() => null);
      setMetaInfo(dash?.meta_info || {});
      setResumen(dash?.resumen || {});

      // Get usuarios Q2
      const us = await fetch(`/api/data/usuarios?country=${country}`).then(r => r.json()).catch(() => null);
      if (us?.cohorts?.q2) setUsuariosQ2(us.cohorts.q2);
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Métricas por mes calculadas desde operational_snapshots (source of truth) ───
  // Si por algún motivo no hay snapshot, cae al resumen legacy (compat).
  const metricsByMes = useMemo(() => {
    const out: Record<Mes, ResumenMes> = {
      abril: { ingresadas: 0, movilizadas: 0, entregados: 0, devoluciones: 0 },
      mayo:  { ingresadas: 0, movilizadas: 0, entregados: 0, devoluciones: 0 },
      junio: { ingresadas: 0, movilizadas: 0, entregados: 0, devoluciones: 0 },
    };
    MESES.forEach((m) => {
      const s = snaps[m];
      if (s?.by_dropshipper && s.by_dropshipper.length > 0) {
        // SOURCE OF TRUTH: operational_snapshots
        for (const r of s.by_dropshipper) {
          const e = r.estados || {};
          out[m].ingresadas += r.total;
          out[m].movilizadas += movFromEstados(e);
          out[m].entregados += entregadasFromEstados(e);
          out[m].devoluciones += devolucionesFromEstados(e);
        }
      } else {
        // Fallback al resumen legacy si aún no hay snap
        const r = resumen[m] || { ingresadas: 0, movilizadas: 0, entregados: 0, devoluciones: 0 };
        out[m] = { ingresadas: r.ingresadas, movilizadas: r.movilizadas, entregados: r.entregados, devoluciones: r.devoluciones };
      }
    });
    return out;
  }, [snaps, resumen]);

  const totales = useMemo(() => {
    let ing = 0, mov = 0, ent = 0, dev = 0, metaIng = 0, metaMov = 0;
    MESES.forEach((m) => {
      const r = metricsByMes[m];
      ing += r.ingresadas; mov += r.movilizadas; ent += r.entregados; dev += r.devoluciones;
      metaIng += (metaInfo[`meta_ingresadas_${m}`] as number) || 0;
      metaMov += (metaInfo[`meta_movilizadas_${m}`] as number) || 0;
    });
    return { ing, mov, ent, dev, metaIng, metaMov };
  }, [metricsByMes, metaInfo]);

  const porMesChart = useMemo(() => {
    return MESES.map((m) => {
      const r = metricsByMes[m];
      const metaMov = (metaInfo[`meta_movilizadas_${m}`] as number) || 0;
      const metaIng = (metaInfo[`meta_ingresadas_${m}`] as number) || 0;
      return {
        mes: MES_LABEL[m],
        ingresadas: r.ingresadas,
        movilizadas: r.movilizadas,
        entregados: r.entregados,
        devoluciones: r.devoluciones,
        metaMov, metaIng,
      };
    });
  }, [metricsByMes, metaInfo]);

  // Top 10 DSs Q2 (sum mov across 3 meses)
  const topDs = useMemo(() => {
    const map = new Map<string, { mov: number; ing: number; ent: number; dev: number }>();
    MESES.forEach((m) => {
      const s = snaps[m];
      if (!s?.by_dropshipper) return;
      for (const r of s.by_dropshipper) {
        const cur = map.get(r.nombre) || { mov: 0, ing: 0, ent: 0, dev: 0 };
        const e = r.estados || {};
        cur.mov += movFromEstados(e);
        cur.ing += r.total;
        cur.ent += entregadasFromEstados(e);
        cur.dev += devolucionesFromEstados(e);
        map.set(r.nombre, cur);
      }
    });
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.mov - a.mov)
      .slice(0, 10);
  }, [snaps]);

  const topProv = useMemo(() => {
    const map = new Map<string, { mov: number; ing: number; ent: number; dev: number }>();
    MESES.forEach((m) => {
      const s = snaps[m];
      if (!s?.by_proveedor) return;
      for (const r of s.by_proveedor) {
        const cur = map.get(r.nombre) || { mov: 0, ing: 0, ent: 0, dev: 0 };
        const e = r.estados || {};
        cur.mov += movFromEstados(e);
        cur.ing += r.total;
        cur.ent += entregadasFromEstados(e);
        cur.dev += devolucionesFromEstados(e);
        map.set(r.nombre, cur);
      }
    });
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.mov - a.mov)
      .slice(0, 10);
  }, [snaps]);

  const topProductos = useMemo(() => {
    const map = new Map<string, { ordenes: number; cantidad: number; proveedor: string }>();
    MESES.forEach((m) => {
      const s = snaps[m];
      if (!s?.by_producto) return;
      for (const r of s.by_producto) {
        const cur = map.get(r.nombre) || { ordenes: 0, cantidad: 0, proveedor: r.proveedor || "" };
        cur.ordenes += r.ordenes || 0;
        cur.cantidad += r.cantidad || 0;
        map.set(r.nombre, cur);
      }
    });
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.ordenes - a.ordenes)
      .slice(0, 10);
  }, [snaps]);

  // Transportadoras aggregate
  const transportadoras = useMemo(() => {
    const map = new Map<string, { total: number; entregado: number }>();
    MESES.forEach((m) => {
      const arr = snaps[m]?.logistics?.by_transportadora || [];
      for (const r of arr) {
        const cur = map.get(r.nombre) || { total: 0, entregado: 0 };
        cur.total += r.total || 0;
        cur.entregado += r.entregado || 0;
        map.set(r.nombre, cur);
      }
    });
    return Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, ...v, pctEntrega: v.total > 0 ? (v.entregado / v.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [snaps]);

  // Estados Q2 (suma de by_status de los 3 meses)
  const estadosQ2 = useMemo(() => {
    const map = new Map<string, number>();
    MESES.forEach((m) => {
      const bs = snaps[m]?.by_status || {};
      for (const k in bs) map.set(k, (map.get(k) || 0) + bs[k]);
    });
    return Array.from(map.entries()).map(([estatus, count]) => ({ estatus, count })).sort((a, b) => b.count - a.count);
  }, [snaps]);

  if (loading) {
    return <div className="glass-card p-6 t-muted text-sm">Cargando resumen Q2…</div>;
  }

  const pctMov = totales.ing > 0 ? (totales.mov / totales.ing) * 100 : 0;
  const pctEnt = totales.mov > 0 ? (totales.ent / totales.mov) * 100 : 0;
  const pctDev = totales.mov > 0 ? (totales.dev / totales.mov) * 100 : 0;
  const pctVsMetaMov = totales.metaMov > 0 ? (totales.mov / totales.metaMov) * 100 : 0;
  const pctVsMetaIng = totales.metaIng > 0 ? (totales.ing / totales.metaIng) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-xl p-5 border-2 border-orange-500/40" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(6,182,212,0.05))" }}>
        <h2 className="text-lg font-bold t-primary mb-1">📊 Resumen Q2 2026 — {country.toUpperCase()}</h2>
        <p className="text-xs t-muted">Acumulado de Abril + Mayo + Junio. Comercial, operaciones y usuarios.</p>
      </div>

      {/* Meta Q2 destacada */}
      <div className="rounded-2xl p-5 border-2" style={{
        background: "linear-gradient(135deg, rgba(167,139,250,0.10), rgba(249,115,22,0.08))",
        borderColor: pctVsMetaMov >= 100 ? "rgba(16,185,129,0.5)" : pctVsMetaMov >= 75 ? "rgba(245,158,11,0.5)" : "rgba(220,38,38,0.5)",
      }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-base font-bold t-primary">🎯 Meta Q2 — Avance trimestral</h3>
          <span className="text-[11px] t-muted">Suma de metas mensuales Abr + May + Jun</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Movilizadas */}
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[11px] t-muted uppercase tracking-wider">Movilizadas</span>
              <span className="text-[10px] t-secondary">{totales.mov.toLocaleString("es-AR")} / {totales.metaMov.toLocaleString("es-AR")}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold" style={{ color: pctVsMetaMov >= 100 ? "#10b981" : pctVsMetaMov >= 75 ? "#f59e0b" : "#dc2626" }}>
                {pctVsMetaMov.toFixed(1)}%
              </span>
              <span className="text-xs t-muted">de meta Q2</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
              <div className="h-full transition-all" style={{
                width: `${Math.min(pctVsMetaMov, 100)}%`,
                background: pctVsMetaMov >= 100 ? "#10b981" : pctVsMetaMov >= 75 ? "#f59e0b" : "#dc2626",
              }} />
            </div>
            <p className="text-[10px] t-muted mt-1">
              {pctVsMetaMov >= 100 ? "✅ Meta cumplida" : `${(totales.metaMov - totales.mov).toLocaleString("es-AR")} mov por cumplir`}
            </p>
          </div>

          {/* Ingresadas */}
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[11px] t-muted uppercase tracking-wider">Ingresadas</span>
              <span className="text-[10px] t-secondary">{totales.ing.toLocaleString("es-AR")} / {totales.metaIng.toLocaleString("es-AR")}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold" style={{ color: pctVsMetaIng >= 100 ? "#10b981" : pctVsMetaIng >= 75 ? "#f59e0b" : "#dc2626" }}>
                {pctVsMetaIng.toFixed(1)}%
              </span>
              <span className="text-xs t-muted">de meta Q2</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
              <div className="h-full transition-all" style={{
                width: `${Math.min(pctVsMetaIng, 100)}%`,
                background: pctVsMetaIng >= 100 ? "#10b981" : pctVsMetaIng >= 75 ? "#f59e0b" : "#dc2626",
              }} />
            </div>
            <p className="text-[10px] t-muted mt-1">
              {pctVsMetaIng >= 100 ? "✅ Meta cumplida" : `${(totales.metaIng - totales.ing).toLocaleString("es-AR")} ing por cumplir`}
            </p>
          </div>
        </div>

        {/* Breakdown por mes */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-700/40">
          {MESES.map((m) => {
            const r = metricsByMes[m];
            const metaM = (metaInfo[`meta_movilizadas_${m}`] as number) || 0;
            const metaI = (metaInfo[`meta_ingresadas_${m}`] as number) || 0;
            const pctM = metaM > 0 ? (r.movilizadas / metaM) * 100 : 0;
            const pctI = metaI > 0 ? (r.ingresadas / metaI) * 100 : 0;
            const color = pctM >= 100 ? "#10b981" : pctM >= 75 ? "#f59e0b" : "#dc2626";
            return (
              <div key={m} className="rounded-lg p-3 border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
                <p className="text-[10px] t-muted uppercase tracking-wider mb-1">{MES_LABEL[m]}</p>
                <p className="text-sm font-bold" style={{ color }}>{pctM.toFixed(0)}% mov</p>
                <p className="text-[10px] t-muted">{r.movilizadas.toLocaleString("es-AR")} / {metaM.toLocaleString("es-AR")}</p>
                <p className="text-[10px] mt-1" style={{ color: pctI >= 100 ? "#10b981" : pctI >= 75 ? "#f59e0b" : "#dc2626" }}>
                  {pctI.toFixed(0)}% ing
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="Ingresadas Q2" value={totales.ing.toLocaleString("es-AR")} color="#0891b2" sub={totales.metaIng > 0 ? `${pctVsMetaIng.toFixed(0)}% de meta` : undefined} />
        <Kpi label="Movilizadas Q2" value={totales.mov.toLocaleString("es-AR")} color="#10b981" sub={totales.metaMov > 0 ? `${pctVsMetaMov.toFixed(0)}% de meta` : undefined} />
        <Kpi label="% Movilización" value={`${pctMov.toFixed(1)}%`} color="#f97316" sub="mov / ing" />
        <Kpi label="Entregadas" value={totales.ent.toLocaleString("es-AR")} color="#10b981" sub={`${pctEnt.toFixed(1)}% de mov`} />
        <Kpi label="Devueltas" value={totales.dev.toLocaleString("es-AR")} color="#dc2626" sub={`${pctDev.toFixed(1)}% de mov`} />
        <Kpi label="Meta mov vs real" value={`${pctVsMetaMov.toFixed(0)}%`} color={pctVsMetaMov >= 100 ? "#10b981" : pctVsMetaMov >= 75 ? "#f59e0b" : "#dc2626"} sub={`${totales.mov.toLocaleString("es-AR")} / ${totales.metaMov.toLocaleString("es-AR")}`} />
      </div>

      {/* Chart por mes */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h3 className="text-sm font-bold t-primary mb-3">📈 Evolución Q2 — Ing / Mov / Ent / Dev por mes</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porMesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "rgba(22,33,62,0.95)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ingresadas" fill="#0891b2" name="Ingresadas" />
              <Bar dataKey="movilizadas" fill="#10b981" name="Movilizadas" />
              <Bar dataKey="entregados" fill="#22c55e" name="Entregadas" />
              <Bar dataKey="devoluciones" fill="#dc2626" name="Devoluciones" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumen comparativo por mes */}
      <div className="rounded-xl p-4 border border-cyan-500/20 overflow-x-auto" style={{ background: "var(--bg-card)" }}>
        <h3 className="text-sm font-bold t-primary mb-3">📋 Resumen comparativo por mes</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-[10px] t-muted">
              <th className="text-left py-2 px-2">Métrica</th>
              {MESES.map((m) => <th key={m} className="text-right py-2 px-2">{MES_LABEL[m]}</th>)}
              <th className="text-right py-2 px-2 text-orange-300">Q2 Total</th>
            </tr>
          </thead>
          <tbody>
            {(["ingresadas","movilizadas","entregados","devoluciones"] as const).map((k) => (
              <tr key={k} className="border-b border-gray-800/40">
                <td className="py-2 px-2 t-primary capitalize">{k}</td>
                {MESES.map((m) => {
                  const v = (metricsByMes[m]?.[k as keyof ResumenMes]) || 0;
                  return <td key={m} className="text-right py-2 px-2 font-mono">{v.toLocaleString("es-AR")}</td>;
                })}
                <td className="text-right py-2 px-2 font-mono font-bold text-orange-300">
                  {MESES.reduce((s, m) => s + ((metricsByMes[m]?.[k as keyof ResumenMes]) || 0), 0).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
            <tr className="border-b border-gray-800/40 bg-cyan-500/5">
              <td className="py-2 px-2 t-primary font-bold">Meta Mov</td>
              {MESES.map((m) => {
                const v = (metaInfo[`meta_movilizadas_${m}`] as number) || 0;
                return <td key={m} className="text-right py-2 px-2 font-mono">{v.toLocaleString("es-AR")}</td>;
              })}
              <td className="text-right py-2 px-2 font-mono font-bold text-cyan-300">{totales.metaMov.toLocaleString("es-AR")}</td>
            </tr>
            <tr className="border-b border-gray-800/40 bg-cyan-500/5">
              <td className="py-2 px-2 t-primary font-bold">Meta Ing</td>
              {MESES.map((m) => {
                const v = (metaInfo[`meta_ingresadas_${m}`] as number) || 0;
                return <td key={m} className="text-right py-2 px-2 font-mono">{v.toLocaleString("es-AR")}</td>;
              })}
              <td className="text-right py-2 px-2 font-mono font-bold text-cyan-300">{totales.metaIng.toLocaleString("es-AR")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Usuarios Q2 */}
      {usuariosQ2 && (
        <div className="rounded-xl p-4 border border-purple-500/30" style={{ background: "rgba(167,139,250,0.05)" }}>
          <h3 className="text-sm font-bold t-primary mb-3">👥 Usuarios Registrados Q2</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Registrados Q2" value={usuariosQ2.total_registrados.toLocaleString("es-AR")} color="#a78bfa" />
            <Kpi label="Activos reales" value={usuariosQ2.activos_total.toLocaleString("es-AR")} color="#10b981" sub={`${(usuariosQ2.activos_total / usuariosQ2.total_registrados * 100).toFixed(1)}%`} />
            <Kpi label="Sin órdenes" value={usuariosQ2.inactivos_total.toLocaleString("es-AR")} color="#dc2626" sub={`${(usuariosQ2.inactivos_total / usuariosQ2.total_registrados * 100).toFixed(1)}%`} />
            <Kpi label="Pareto 75%" value={usuariosQ2.segmento_1_pareto75.count.toLocaleString("es-AR")} color="#10b981" sub={`generan ${usuariosQ2.segmento_1_pareto75.pct_ordenes}% del mov`} />
          </div>
          <p className="text-[10px] t-muted mt-3">
            Ver detalle completo en Comercial → 🧑‍🤝‍🧑 Usuarios Registrados → tab "Q2 (acum)".
          </p>
        </div>
      )}

      {/* Top 10 DSs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RankingCard
          title="🏆 Top 10 Dropshippers Q2 (por movilizadas)"
          rows={topDs}
          getName={(r) => r.nombre.replace(/\s*\(\d+\)\s*$/, "").trim()}
          color="#10b981"
        />
        <RankingCard
          title="📦 Top 10 Proveedores Q2 (por movilizadas)"
          rows={topProv}
          getName={(r) => r.nombre.replace(/\s*\(\d+\)\s*$/, "").trim()}
          color="#0891b2"
        />
      </div>

      {/* Top productos */}
      {topProductos.length > 0 && (
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-3">🎯 Top 10 Productos Q2 (por órdenes)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-[10px] t-muted">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-left py-2 px-2">Proveedor</th>
                  <th className="text-right py-2 px-2">Órdenes Q2</th>
                  <th className="text-right py-2 px-2">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {topProductos.map((p, i) => (
                  <tr key={p.nombre + i} className="border-b border-gray-800/40">
                    <td className="py-2 px-2 t-muted text-[10px]">{i + 1}</td>
                    <td className="py-2 px-2 t-primary max-w-[300px] truncate" title={p.nombre}>{p.nombre}</td>
                    <td className="py-2 px-2 t-muted max-w-[200px] truncate">{p.proveedor}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-orange-300">{p.ordenes.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono">{p.cantidad.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transportadoras */}
      {transportadoras.length > 0 && (
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-3">🚚 Performance por Transportadora Q2</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-[10px] t-muted">
                  <th className="text-left py-2 px-2">Transportadora</th>
                  <th className="text-right py-2 px-2">Total guías Q2</th>
                  <th className="text-right py-2 px-2">Entregadas</th>
                  <th className="text-right py-2 px-2">% Entrega</th>
                </tr>
              </thead>
              <tbody>
                {transportadoras.map((t) => {
                  const color = t.pctEntrega >= 80 ? "#10b981" : t.pctEntrega >= 60 ? "#f59e0b" : "#dc2626";
                  return (
                    <tr key={t.nombre} className="border-b border-gray-800/40">
                      <td className="py-2 px-2 t-primary font-medium">{t.nombre}</td>
                      <td className="py-2 px-2 text-right font-mono">{t.total.toLocaleString("es-AR")}</td>
                      <td className="py-2 px-2 text-right font-mono">{t.entregado.toLocaleString("es-AR")}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold" style={{ color }}>{t.pctEntrega.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distribución por estado */}
      {estadosQ2.length > 0 && (
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-3">📊 Distribución por Estado — Q2 acumulado</h3>
          <div className="flex flex-wrap gap-2">
            {estadosQ2.slice(0, 20).map((e) => {
              const totalAll = estadosQ2.reduce((s, x) => s + x.count, 0);
              const pct = totalAll > 0 ? (e.count / totalAll) * 100 : 0;
              return (
                <div key={e.estatus} className="rounded-lg px-3 py-2 border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
                  <p className="text-[10px] t-muted">{e.estatus}</p>
                  <p className="text-sm font-bold t-primary">{e.count.toLocaleString("es-AR")} <span className="text-[10px] t-muted">({pct.toFixed(1)}%)</span></p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3 border border-cyan-500/10" style={{ background: "var(--bg-card)" }}>
      <p className="text-[10px] t-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] t-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function RankingCard({ title, rows, getName, color }: {
  title: string;
  rows: { nombre: string; mov: number; ing: number; ent: number; dev: number }[];
  getName: (r: any) => string;
  color: string;
}) {
  return (
    <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
      <h3 className="text-sm font-bold t-primary mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-[10px] t-muted">
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Nombre</th>
              <th className="text-right py-2 px-2">Mov</th>
              <th className="text-right py-2 px-2">Ent</th>
              <th className="text-right py-2 px-2">% Ent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pctEnt = r.mov > 0 ? (r.ent / r.mov) * 100 : 0;
              const pctColor = pctEnt >= 80 ? "#10b981" : pctEnt >= 60 ? "#f59e0b" : "#dc2626";
              return (
                <tr key={r.nombre + i} className="border-b border-gray-800/40">
                  <td className="py-2 px-2 t-muted text-[10px]">{i + 1}</td>
                  <td className="py-2 px-2 t-primary max-w-[200px] truncate" title={getName(r)}>{getName(r)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold" style={{ color }}>{r.mov.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.ent.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: pctColor }}>{pctEnt.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
