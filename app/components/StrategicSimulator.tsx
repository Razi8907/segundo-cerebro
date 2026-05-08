"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";
import type { MesFilter } from "../types";

// Estados que NO cuentan como movilizadas (siguen en posesión del dropshipper/proveedor)
const NO_MOVILIZADO_STATES = new Set([
  "PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA",
  "PREPARADO PARA TRANSPORTADORA", "CANCELADO", "RECHAZADO",
  "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA",
]);

const normalizeName = (s: string) => (s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
  .replace(/\s*\(\d+\)\s*$/, "") // strip "(12345)" id suffix
  .replace(/[^a-z0-9]/g, ""); // strip non-alphanumerics


interface ProveedorData {
  proveedor: string;
  sellers: number;
  enero: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  febrero: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  marzo: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  total: { ing: number; mov: number; ent: number; dev: number };
  growth_pct: number | null;
  dropi_id?: number | null;
  whatsapp?: string | null;
}

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
}

interface MetaInfo {
  meta_movilizadas_abril: number;
  meta_ingresadas_abril: number;
  meta_movilizadas_mayo?: number;
  meta_ingresadas_mayo?: number;
  tasa_movilizacion: number;
  [key: string]: any;
}

export default function StrategicSimulator({
  proveedores,
  resumen,
  metaInfo,
  mesFilter = "abril",
  country = "py",
}: {
  proveedores: ProveedorData[];
  resumen: Resumen;
  metaInfo?: MetaInfo;
  mesFilter?: MesFilter;
  country?: "ar" | "py";
}) {
  const [showAll, setShowAll] = useState(false);
  const isMayo = mesFilter === "mayo";

  // Etiquetas dinámicas según el mes target
  const TARGET_LABEL = isMayo ? "Mayo" : "Abril";
  const COMP_LABEL = isMayo ? "Abril" : "Marzo";

  const GOAL_MOVILIZADAS = isMayo
    ? (metaInfo?.meta_movilizadas_mayo ?? metaInfo?.meta_movilizadas_abril ?? 40000)
    : (metaInfo?.meta_movilizadas_abril ?? 40000);
  const TASA_MOVILIZACION = metaInfo?.tasa_movilizacion ?? 0.78;
  const GOAL_INGRESADAS = isMayo
    ? (metaInfo?.meta_ingresadas_mayo ?? Math.ceil(GOAL_MOVILIZADAS / TASA_MOVILIZACION))
    : (metaInfo?.meta_ingresadas_abril ?? Math.ceil(GOAL_MOVILIZADAS / TASA_MOVILIZACION));

  // En Mayo: cargar data real de Abril desde operational_snapshots para usarla
  // como base de proyección por proveedor.
  const [abrilByProv, setAbrilByProv] = useState<Map<string, { nombre: string; mov: number; ent: number; dev: number; total: number }>>(new Map());
  useEffect(() => {
    if (!isMayo) return;
    let cancelled = false;
    fetch(`/api/data/operational?country=${country}&mes=abril`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const byProv = res.data?.by_proveedor;
        if (!Array.isArray(byProv)) return;
        const map = new Map<string, { nombre: string; mov: number; ent: number; dev: number; total: number }>();
        for (const p of byProv) {
          const estados = p.estados || {};
          let noMov = 0;
          for (const k of Object.keys(estados)) {
            if (NO_MOVILIZADO_STATES.has(k)) noMov += estados[k] || 0;
          }
          const mov = (p.total || 0) - noMov;
          const ent = estados["ENTREGADO"] || 0;
          const dev = (estados["DEVOLUCION"] || 0) + (estados["EN PROCESO DE DEVOLUCION"] || 0);
          map.set(normalizeName(p.nombre), { nombre: p.nombre, mov, ent, dev, total: p.total || 0 });
        }
        setAbrilByProv(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isMayo, country]);

  const analysis = useMemo(() => {
    // Base "comp" según mes target. Si es Mayo, usamos abril; si es Abril, marzo.
    const compTotalGlobal = isMayo
      ? (() => {
          let sum = 0;
          abrilByProv.forEach((v) => { sum += v.mov; });
          return sum;
        })()
      : resumen.marzo.movilizadas;
    const gap = GOAL_MOVILIZADAS - compTotalGlobal;
    const gapPct = compTotalGlobal > 0 ? ((gap / compTotalGlobal) * 100).toFixed(1) : "0";

    // En Mayo: combinamos Q1 con proveedores nuevos que aparecieron solo en Abril
    // (los del pareto del mes que no estaban en Q1 deben aparecer en el plan).
    let workingProveedores = proveedores;
    if (isMayo && abrilByProv.size > 0) {
      const q1Keys = new Set(proveedores.map((p) => normalizeName(p.proveedor)));
      const extras: ProveedorData[] = [];
      abrilByProv.forEach((entry, key) => {
        if (q1Keys.has(key)) return;
        // Reconstruimos un nombre limpio sin "(id)"
        const cleanName = entry.nombre.replace(/\s*\(\d+\)\s*$/, "").trim();
        extras.push({
          proveedor: cleanName || entry.nombre,
          sellers: 0,
          enero: { ing: null, mov: null, ent: null, dev: null, pct_entrega: null, pct_dev: null },
          febrero: { ing: null, mov: null, ent: null, dev: null, pct_entrega: null, pct_dev: null },
          marzo: { ing: null, mov: null, ent: null, dev: null, pct_entrega: null, pct_dev: null },
          total: { ing: entry.mov, mov: entry.mov, ent: entry.ent, dev: entry.dev },
          growth_pct: null,
        });
      });
      if (extras.length > 0) workingProveedores = [...proveedores, ...extras];
    }

    // Dynamic volume scale based on country size
    const activeProvs = workingProveedores.filter((p) => isMayo
      ? (abrilByProv.get(normalizeName(p.proveedor))?.mov || 0) > 0 || p.total.mov > 0
      : p.total.mov > 0);
    const totalAvgMov = activeProvs.reduce((s, p) => s + p.total.mov / 3, 0);
    const volumeScale = activeProvs.length > 0 ? (totalAvgMov / activeProvs.length) * 3 : 2000;

    // Total share base movilizadas across all providers (abril si isMayo, marzo si isAbril)
    const totalCompMov = isMayo
      ? compTotalGlobal
      : activeProvs.reduce((s, p) => s + (p.marzo.mov || 0), 0);

    const scored = activeProvs
      .map((p) => {
        // marMov = movilizadas del mes de comparación
        // En Mayo: traer del abrilByProv mediante normalización del nombre
        const abrilEntry = isMayo ? abrilByProv.get(normalizeName(p.proveedor)) : null;
        const marMov = isMayo
          ? (abrilEntry?.mov ?? p.marzo.mov ?? 0)  // si no encuentra abril, fallback a marzo
          : (p.marzo.mov || 0);
        const eneMov = p.enero.mov || 0;
        const avgMov = p.total.mov / 3;
        // Tendencia: en Abril compara marzo vs enero; en Mayo, abril vs marzo (si tenemos abril real)
        const trend = isMayo
          ? (abrilEntry && p.marzo.mov && p.marzo.mov > 0 ? (abrilEntry.mov - p.marzo.mov) / p.marzo.mov : 0)
          : (marMov > 0 && eneMov > 0 ? (marMov - eneMov) / eneMov : 0);
        // % entrega/dev: en Mayo usar abril si tenemos data, si no Q1
        const pctDev = isMayo && abrilEntry && abrilEntry.mov > 0
          ? abrilEntry.dev / abrilEntry.mov
          : p.total.dev / p.total.mov;
        const pctEnt = isMayo && abrilEntry && abrilEntry.mov > 0
          ? abrilEntry.ent / abrilEntry.mov
          : p.total.ent / p.total.mov;

        // Score: volume (40%) + trend (30%) + low dev (20%) + high delivery (10%)
        const volumeScore = Math.min(avgMov / volumeScale, 1) * 40;
        const trendScore = Math.min(Math.max(trend, -1), 2) / 2 * 30;
        const devScore = (1 - Math.min(pctDev, 1)) * 20;
        const entScore = Math.min(pctEnt, 1) * 10;
        const totalScore = volumeScore + trendScore + devScore + entScore;

        // Goal-based projection: distribute GOAL_MOVILIZADAS proportionally
        // based on each provider's comp month share
        const share = totalCompMov > 0 ? marMov / totalCompMov : 0;
        const baseTarget = Math.round(GOAL_MOVILIZADAS * share);

        // Providers with strong growth trend (>100%) get up to 50% extra over comp month
        const cappedGrowth = trend > 1 ? 0.50 : Math.min(Math.max(trend * 0.5, 0), 0.30);
        const trendProjection = Math.round(marMov * (1 + cappedGrowth));

        // Use the higher of goal-share or trend projection
        const projectedAbril = Math.max(baseTarget, trendProjection);

        return {
          ...p,
          marMov,
          avgMov: Math.round(avgMov),
          trend: Math.round(trend * 100),
          pctDev: Math.round(pctDev * 100),
          pctEnt: Math.round(pctEnt * 100),
          score: Math.round(totalScore),
          projectedAbril,
          share: Math.round(share * 10000) / 100,
          category:
            totalScore >= 60
              ? "estrella"
              : totalScore >= 40
              ? "potencial"
              : totalScore >= 20
              ? "mantener"
              : "revisar",
        };
      })
      .sort((a, b) => b.score - a.score);

    const estrellas = scored.filter((s) => s.category === "estrella");
    const potenciales = scored.filter((s) => s.category === "potencial");
    const mantener = scored.filter((s) => s.category === "mantener");
    const revisar = scored.filter((s) => s.category === "revisar");

    const projectedTotal = scored.reduce((sum, s) => sum + s.projectedAbril, 0);
    const additionalNeeded = Math.max(0, GOAL_MOVILIZADAS - projectedTotal);

    return {
      marzoMov: compTotalGlobal,
      gap,
      gapPct,
      scored,
      estrellas,
      potenciales,
      mantener,
      revisar,
      projectedTotal,
      additionalNeeded,
    };
  }, [proveedores, resumen, GOAL_MOVILIZADAS, isMayo, abrilByProv]);

  const chartData = analysis.scored.slice(0, 20).map((p) => ({
    name: p.proveedor.length > 15 ? p.proveedor.slice(0, 15) + "…" : p.proveedor,
    [`${COMP_LABEL} Real`]: p.marMov,
    [`Proy. ${TARGET_LABEL}`]: p.projectedAbril,
    score: p.score,
    category: p.category,
  }));

  const categoryColors: Record<string, string> = {
    estrella: "#F97316",
    potencial: "#3B82F6",
    mantener: "#6B7280",
    revisar: "#EF4444",
  };
  const categoryLabels: Record<string, string> = {
    estrella: "Estrella",
    potencial: "Alto Potencial",
    mantener: "Mantener",
    revisar: "Revisar",
  };

  const displayList = showAll ? analysis.scored : analysis.scored.slice(0, 15);

  return (
    <ChartDownloadBtn filename="Plan_Estrategico">
    <div className="glass-card p-6 border-orange-500/30">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🎯 Plan Estratégico: {GOAL_MOVILIZADAS.toLocaleString()} Movilizadas en {TARGET_LABEL}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Se necesitan {GOAL_INGRESADAS.toLocaleString()} órdenes ingresadas ({Math.round(TASA_MOVILIZACION * 100)}% tasa de movilización)
          </p>
        </div>

        {/* Gap indicator */}
        <div className="flex gap-3">
          <div className="text-center px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <p className="text-[10px] text-gray-400 uppercase">{COMP_LABEL} {isMayo ? "real" : "actual"}</p>
            <p className="text-lg font-bold text-orange-400">{analysis.marzoMov.toLocaleString()}</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-[10px] text-gray-400 uppercase">Gap vs meta</p>
            <p className="text-lg font-bold text-red-400">+{analysis.gap.toLocaleString()}</p>
            <p className="text-[10px] text-red-400">({analysis.gapPct}% más)</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-[10px] text-gray-400 uppercase">Proy. tendencia</p>
            <p className="text-lg font-bold text-blue-400">{analysis.projectedTotal.toLocaleString()}</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-[10px] text-gray-400 uppercase">Meta</p>
            <p className="text-lg font-bold text-green-400">{GOAL_MOVILIZADAS.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { cat: "estrella", emoji: "⭐", color: "orange" },
          { cat: "potencial", emoji: "📈", color: "blue" },
          { cat: "mantener", emoji: "📊", color: "gray" },
          { cat: "revisar", emoji: "⚠️", color: "red" },
        ].map(({ cat, emoji, color }) => {
          const list = analysis[cat === "estrella" ? "estrellas" : cat === "potencial" ? "potenciales" : cat as "mantener" | "revisar"];
          const totalMov = list.reduce((s: number, p: { projectedAbril: number }) => s + p.projectedAbril, 0);
          return (
            <div key={cat} className={`rounded-xl p-3 border border-${color}-500/20 bg-${color}-500/5`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{emoji}</span>
                <span className="text-xs font-medium text-white">{categoryLabels[cat]}</span>
              </div>
              <p className={`text-xl font-bold text-${color}-400`}>{list.length}</p>
              <p className="text-[10px] text-gray-400">Prov. → {totalMov.toLocaleString()} mov. proy.</p>
            </div>
          );
        })}
      </div>

      {/* Chart: Top 20 providers projected */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Top 20 Proveedores: {COMP_LABEL} vs Proyección {TARGET_LABEL}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 10 }} width={120} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#16213e",
                border: "1px solid rgba(249,115,22,0.3)",
                borderRadius: "12px",
                color: "#F97316",
                fontSize: 12,
              }}
              itemStyle={{ color: "#F97316" }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value) => Number(value).toLocaleString()}
            />
            <ReferenceLine x={analysis.scored.length > 0 ? Math.round(GOAL_MOVILIZADAS / analysis.scored.length) : 0} stroke="#10B981" strokeDasharray="3 3" label={{ value: "Meta promedio", fill: "#10B981", fontSize: 10 }} />
            <Bar dataKey={`${COMP_LABEL} Real`} fill="#6B7280" radius={[0, 4, 4, 0]} barSize={10} />
            <Bar dataKey={`Proy. ${TARGET_LABEL}`} radius={[0, 4, 4, 0]} barSize={10}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={categoryColors[entry.category]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">
            Recomendación: Con qué proveedores trabajar
          </h3>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-orange-400 hover:text-orange-300"
          >
            {showAll ? "Ver menos" : `Ver todos (${analysis.scored.length})`}
          </button>
        </div>
        <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
              <tr className="border-b border-orange-500/20">
                <th className="text-left py-2 px-2 text-gray-400">Cat.</th>
                <th className="text-left py-2 px-2 text-gray-400">Proveedor</th>
                <th className="text-right py-2 px-2 text-gray-400">Sellers</th>
                <th className="text-right py-2 px-2 text-gray-400">Prom. Mov/Mes</th>
                <th className="text-right py-2 px-2 text-gray-400">{COMP_LABEL} Mov</th>
                <th className="text-right py-2 px-2 text-gray-400">Tendencia</th>
                <th className="text-right py-2 px-2 text-gray-400">% Entrega</th>
                <th className="text-right py-2 px-2 text-gray-400">% Dev</th>
                <th className="text-right py-2 px-2 text-gray-400">Score</th>
                <th className="text-right py-2 px-2 text-gray-400">Proy. {TARGET_LABEL}</th>
                <th className="text-left py-2 px-2 text-gray-400">Acción</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((p, i) => (
                <tr key={p.proveedor} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                  <td className="py-2 px-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: categoryColors[p.category] }}
                    />
                  </td>
                  <td className="py-2 px-2 max-w-[180px]">
                    {p.whatsapp ? (
                      <a href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-500 font-medium block truncate hover:text-green-400 hover:underline" title={`Chat WhatsApp: ${p.whatsapp}`}>{p.proveedor}</a>
                    ) : (
                      <span className="text-white font-medium block truncate">{p.proveedor}</span>
                    )}
                    {p.dropi_id && <span className="text-[10px] text-gray-500">ID: {p.dropi_id}</span>}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-300">{p.sellers}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{p.avgMov.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right text-blue-400 font-medium">{p.marMov.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={p.trend > 0 ? "text-green-400" : p.trend < 0 ? "text-red-400" : "text-gray-400"}>
                      {p.trend > 0 ? "+" : ""}{p.trend}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-green-400">{p.pctEnt}%</td>
                  <td className="py-2 px-2 text-right">
                    <span className={p.pctDev > 30 ? "text-red-400 font-bold" : p.pctDev > 20 ? "text-yellow-400" : "text-gray-400"}>
                      {p.pctDev}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className="font-bold" style={{ color: categoryColors[p.category] }}>
                      {p.score}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-orange-400 font-bold">{p.projectedAbril.toLocaleString()}</td>
                  <td className="py-2 px-2 text-left">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      p.category === "estrella"
                        ? "bg-orange-500/10 text-orange-400"
                        : p.category === "potencial"
                        ? "bg-blue-500/10 text-blue-400"
                        : p.category === "mantener"
                        ? "bg-gray-500/10 text-gray-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      {p.category === "estrella"
                        ? "Escalar"
                        : p.category === "potencial"
                        ? "Impulsar"
                        : p.category === "mantener"
                        ? "Mantener"
                        : "Reducir dev."}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom insight */}
      <div className="mt-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
        <h3 className="text-sm font-bold text-orange-400 mb-2">💡 Resumen Estratégico para {TARGET_LABEL}</h3>
        <ul className="text-xs text-gray-300 space-y-1.5">
          <li>• <strong>Meta:</strong> {GOAL_MOVILIZADAS.toLocaleString()} movilizadas = ~{GOAL_INGRESADAS.toLocaleString()} ingresadas ({Math.round(TASA_MOVILIZACION * 100)}% tasa movilización)</li>
          <li>• <strong>Gap actual:</strong> {COMP_LABEL} cerró en {analysis.marzoMov.toLocaleString()} → necesitamos +{analysis.gap.toLocaleString()} ({analysis.gapPct}% más)</li>
          <li>• <strong>Por tendencia:</strong> Se proyectan {analysis.projectedTotal.toLocaleString()} movilizadas {analysis.projectedTotal >= GOAL_MOVILIZADAS ? "(✅ se alcanza la meta)" : `(❌ faltan ${(GOAL_MOVILIZADAS - analysis.projectedTotal).toLocaleString()} adicionales)`}</li>
          <li>• <strong>Top {analysis.estrellas.length} proveedores estrella</strong> aportan {analysis.estrellas.reduce((s, p) => s + p.projectedAbril, 0).toLocaleString()} mov. proyectadas → escalar sellers activos y reclutar nuevos</li>
          <li>• <strong>{analysis.potenciales.length} proveedores de alto potencial</strong> con tendencia positiva → impulsar con campañas y mayor exposición</li>
          <li>• <strong>Reducir devoluciones</strong> en proveedores con &gt;30% dev. liberaría ~{Math.round(analysis.revisar.reduce((s, p) => s + p.marMov * p.pctDev / 100 * 0.5, 0)).toLocaleString()} órdenes efectivas adicionales</li>
          {isMayo && abrilByProv.size > 0 && (
            <li>• <strong>Base real Abril:</strong> {abrilByProv.size} proveedores con datos reales del archivo operacional. Para los que no tengan match, se usa marzo como fallback.</li>
          )}
        </ul>
      </div>
    </div>
    </ChartDownloadBtn>
  );
}
