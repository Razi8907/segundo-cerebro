"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

interface ProveedorData {
  proveedor: string;
  sellers: number;
  enero: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  febrero: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  marzo: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  total: { ing: number; mov: number; ent: number; dev: number };
  growth_pct: number | null;
  dropi_id?: number | null;
}

const COLORS = [
  "#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F59E0B", "#6366F1", "#06B6D4",
  "#84CC16", "#D946EF", "#FB7185", "#22D3EE", "#A3E635",
];

export default function ProductGoalPlanner({ proveedores }: { proveedores: ProveedorData[] }) {
  const [tab, setTab] = useState<"plan" | "acciones">("plan");

  const analysis = useMemo(() => {
    const prepared = proveedores
      .map((p) => {
        const eneMov = p.enero.mov || 0;
        const febMov = p.febrero.mov || 0;
        const marMov = p.marzo.mov || 0;
        const eneIng = p.enero.ing || 0;
        const febIng = p.febrero.ing || 0;
        const marIng = p.marzo.ing || 0;
        const q1Mov = p.total.mov;
        const q1Ing = p.total.ing;
        const avgMov = q1Mov / 3;
        const avgIng = q1Ing / 3;

        // Monthly trend
        const movValues = [eneMov, febMov, marMov].filter((v) => v > 0);
        let trend = 0;
        if (movValues.length >= 2) {
          trend = movValues[0] > 0 ? (movValues[movValues.length - 1] - movValues[0]) / movValues[0] : 0;
        }

        const movRate = q1Ing > 0 ? q1Mov / q1Ing : 0;
        const devRate = q1Mov > 0 ? p.total.dev / q1Mov : 0;
        const entRate = q1Mov > 0 ? p.total.ent / q1Mov : 0;

        // Realistic April projection: based on March + realistic growth cap
        // Cap growth at 30% max over March for "realistic" projection
        const realisticGrowth = Math.min(Math.max(trend * 0.4, 0), 0.30);
        const projAbrilIng = Math.round(marIng * (1 + realisticGrowth));
        const projAbrilMov = Math.round(marMov * (1 + realisticGrowth));

        // Stretch target: what if we push harder (extra sellers, better conversion)
        const stretchGrowth = Math.min(Math.max(trend * 0.7, 0.05), 0.50);
        const stretchAbrilIng = Math.round(marIng * (1 + stretchGrowth));
        const stretchAbrilMov = Math.round(marMov * (1 + stretchGrowth));

        // What can actually help this provider grow
        const actions: string[] = [];
        if (devRate > 0.3) actions.push("Reducir devoluciones (actualmente " + Math.round(devRate * 100) + "%)");
        if (trend < 0) actions.push("Reactivar: en caida " + Math.round(trend * 100) + "% Q1");
        if (p.sellers <= 3) actions.push("Reclutar mas sellers (solo tiene " + p.sellers + ")");
        if (p.sellers > 3 && trend > 0.1) actions.push("Escalar sellers activos (tendencia +" + Math.round(trend * 100) + "%)");
        if (movRate < 0.7) actions.push("Mejorar tasa movilizacion (" + Math.round(movRate * 100) + "% actual)");
        if (entRate > 0.6 && devRate < 0.2) actions.push("Proveedor eficiente: ampliar catalogo");
        if (actions.length === 0) actions.push("Mantener ritmo actual");

        return {
          ...p,
          eneMov, febMov, marMov, eneIng, febIng, marIng,
          q1Mov, q1Ing, avgMov: Math.round(avgMov), avgIng: Math.round(avgIng),
          trend, movRate, devRate, entRate,
          projAbrilIng, projAbrilMov,
          stretchAbrilIng, stretchAbrilMov,
          realisticGrowth, stretchGrowth,
          actions,
        };
      })
      .filter((p) => p.q1Mov > 0)
      .sort((a, b) => b.marIng - a.marIng);

    // Totals
    const totalProjIng = prepared.reduce((s, p) => s + p.projAbrilIng, 0);
    const totalProjMov = prepared.reduce((s, p) => s + p.projAbrilMov, 0);
    const totalStretchIng = prepared.reduce((s, p) => s + p.stretchAbrilIng, 0);
    const totalStretchMov = prepared.reduce((s, p) => s + p.stretchAbrilMov, 0);
    const totalMarzoIng = prepared.reduce((s, p) => s + p.marIng, 0);
    const totalMarzoMov = prepared.reduce((s, p) => s + p.marMov, 0);

    // Top 12 for pie
    const topForPie = prepared.slice(0, 12);
    const othersProjIng = prepared.slice(12).reduce((s, p) => s + p.projAbrilIng, 0);
    const pieData = [
      ...topForPie.map((p, i) => ({
        name: p.proveedor.length > 18 ? p.proveedor.slice(0, 18) + "..." : p.proveedor,
        value: p.projAbrilIng,
        fill: COLORS[i % COLORS.length],
      })),
      ...(othersProjIng > 0 ? [{ name: `Otros (${prepared.length - 12})`, value: othersProjIng, fill: "#d1d5db" }] : []),
    ];

    // Categories
    const creciendo = prepared.filter((p) => p.trend > 0.1 && p.marMov > 50);
    const estables = prepared.filter((p) => p.trend >= -0.1 && p.trend <= 0.1 && p.marMov > 20);
    const cayendo = prepared.filter((p) => p.trend < -0.1 && p.q1Mov > 100);
    const altoDev = prepared.filter((p) => p.devRate > 0.3 && p.marMov > 20);

    return {
      prepared,
      totalProjIng, totalProjMov,
      totalStretchIng, totalStretchMov,
      totalMarzoIng, totalMarzoMov,
      pieData,
      creciendo, estables, cayendo, altoDev,
    };
  }, [proveedores]);

  const barData = analysis.prepared.slice(0, 20).map((p) => ({
    name: p.proveedor.length > 14 ? p.proveedor.slice(0, 14) + "..." : p.proveedor,
    "Marzo": p.marIng,
    "Proy. Realista": p.projAbrilIng,
    "Proy. Stretch": p.stretchAbrilIng,
    trend: p.trend,
  }));

  return (
    <ChartDownloadBtn filename="Proyeccion_Proveedores">
    <div className="glass-card p-6 border-orange-500/30">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📦 Proveedores &mdash; Proyeccion Realista Abril
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Proyeccion basada en tendencia Q1 + acciones concretas por proveedor
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("plan")}
            className={`text-xs px-4 py-2 rounded-lg transition-all ${
              tab === "plan"
                ? "bg-orange-500 text-white"
                : "bg-transparent text-gray-400 border border-gray-700 hover:border-orange-500/40"
            }`}
          >
            Proyeccion
          </button>
          <button
            onClick={() => setTab("acciones")}
            className={`text-xs px-4 py-2 rounded-lg transition-all ${
              tab === "acciones"
                ? "bg-orange-500 text-white"
                : "bg-transparent text-gray-400 border border-gray-700 hover:border-orange-500/40"
            }`}
          >
            Acciones por Proveedor
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Marzo Real</p>
          <p className="text-lg font-bold text-gray-300">{analysis.totalMarzoIng.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">ingresadas</p>
        </div>
        <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Proy. Realista</p>
          <p className="text-lg font-bold text-blue-400">{analysis.totalProjIng.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">{analysis.totalProjMov.toLocaleString()} mov</p>
        </div>
        <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Proy. Stretch</p>
          <p className="text-lg font-bold text-orange-400">{analysis.totalStretchIng.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">{analysis.totalStretchMov.toLocaleString()} mov</p>
        </div>
        <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">En Crecimiento</p>
          <p className="text-lg font-bold text-green-400">{analysis.creciendo.length}</p>
          <p className="text-[10px] text-gray-500">proveedores</p>
        </div>
        <div className="rounded-xl p-3 border border-yellow-500/20" style={{ background: "rgba(245,158,11,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">En Caida</p>
          <p className="text-lg font-bold text-yellow-400">{analysis.cayendo.length}</p>
          <p className="text-[10px] text-gray-500">requieren accion</p>
        </div>
        <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Alta Devolucion</p>
          <p className="text-lg font-bold text-red-400">{analysis.altoDev.length}</p>
          <p className="text-[10px] text-gray-500">&gt;30% dev</p>
        </div>
      </div>

      {tab === "plan" ? (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Bar chart */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Top 20: Marzo vs Proyecciones Abril</h3>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={barData} layout="vertical" margin={{ left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                  <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 9 }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
                    itemStyle={{ color: "#F97316" }}
                    labelStyle={{ color: "#e5e7eb" }}
                    formatter={(value) => Number(value).toLocaleString()}
                  />
                  <Bar dataKey="Marzo" fill="#6B7280" radius={[0, 4, 4, 0]} barSize={8} />
                  <Bar dataKey="Proy. Realista" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={8} />
                  <Bar dataKey="Proy. Stretch" fill="#F97316" radius={[0, 4, 4, 0]} barSize={8} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Distribucion Proyectada Abril (Realista)</h3>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie
                    data={analysis.pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "#6B7280" }}
                  >
                    {analysis.pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
                    itemStyle={{ color: "#F97316" }}
                    formatter={(value) => `${Number(value).toLocaleString()} ord.`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Provider cards */}
          <h3 className="text-sm font-medium text-gray-300 mb-3">Top 12 Proveedores &mdash; Proyeccion y Palancas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analysis.prepared.slice(0, 12).map((p, i) => {
              const crecPct = p.marIng > 0 ? Math.round(((p.projAbrilIng - p.marIng) / p.marIng) * 100) : 0;
              const trendColor = p.trend > 0.1 ? "text-green-400" : p.trend < -0.1 ? "text-red-400" : "text-gray-400";
              const trendLabel = p.trend > 0.1 ? "Creciendo" : p.trend < -0.1 ? "Cayendo" : "Estable";
              return (
                <div
                  key={p.proveedor}
                  className="p-4 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition-all"
                  style={{ background: "rgba(249,115,22,0.04)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? "dropi-gradient text-white" : "bg-gray-800 text-gray-400"}`}>
                        {i + 1}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white truncate block max-w-[140px]">{p.proveedor}</span>
                        <span className="text-[10px] text-gray-500">{p.dropi_id ? `ID: ${p.dropi_id} · ` : ""}{p.sellers} sellers</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      p.trend > 0.1 ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      p.trend < -0.1 ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      "bg-gray-500/10 text-gray-400 border-gray-500/20"
                    }`}>
                      {trendLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <p className="text-[10px] text-gray-500">Marzo</p>
                      <p className="text-sm font-bold text-gray-300">{p.marIng.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Proy. Abr</p>
                      <p className="text-sm font-bold text-blue-400">{p.projAbrilIng.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Crec.</p>
                      <p className={`text-sm font-bold ${crecPct > 0 ? "text-green-400" : crecPct < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {crecPct > 0 ? "+" : ""}{crecPct}%
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min((p.marIng / Math.max(p.projAbrilIng, 1)) * 100, 100)}%` }} />
                  </div>

                  {/* Key action */}
                  <p className="text-[10px] text-orange-400">{p.actions[0]}</p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Actions table */}
          <div className="table-container overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                <tr className="border-b border-orange-500/20">
                  <th className="text-left py-2 px-2 text-gray-400">#</th>
                  <th className="text-left py-2 px-2 text-gray-400">Proveedor</th>
                  <th className="text-right py-2 px-2 text-gray-400">Sellers</th>
                  <th className="text-right py-2 px-2 text-gray-400">Ene</th>
                  <th className="text-right py-2 px-2 text-gray-400">Feb</th>
                  <th className="text-right py-2 px-2 text-gray-400">Mar</th>
                  <th className="text-right py-2 px-2 text-gray-400">Tendencia</th>
                  <th className="text-right py-2 px-2 text-blue-400 font-bold">Proy. Abr</th>
                  <th className="text-right py-2 px-2 text-gray-400">% Ent</th>
                  <th className="text-right py-2 px-2 text-gray-400">% Dev</th>
                  <th className="text-left py-2 px-2 text-gray-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {analysis.prepared.filter((p) => p.marIng > 0).map((p, i) => (
                  <tr key={p.proveedor} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                    <td className="py-2 px-2 text-gray-500">{i + 1}</td>
                    <td className="py-2 px-2 max-w-[160px]">
                      <span className="text-white font-medium block truncate">{p.proveedor}</span>
                      {p.dropi_id && <span className="text-[10px] text-gray-500">ID: {p.dropi_id}</span>}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400">{p.sellers}</td>
                    <td className="py-2 px-2 text-right text-gray-400">{p.eneIng > 0 ? p.eneIng.toLocaleString() : "-"}</td>
                    <td className="py-2 px-2 text-right text-gray-400">{p.febIng > 0 ? p.febIng.toLocaleString() : "-"}</td>
                    <td className="py-2 px-2 text-right text-gray-300 font-medium">{p.marIng.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={p.trend > 0.1 ? "text-green-400" : p.trend < -0.1 ? "text-red-400" : "text-gray-400"}>
                        {p.trend > 0 ? "+" : ""}{Math.round(p.trend * 100)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-blue-400 font-bold">{p.projAbrilIng.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-green-400">{Math.round(p.entRate * 100)}%</td>
                    <td className="py-2 px-2 text-right">
                      <span className={p.devRate > 0.3 ? "text-red-400 font-bold" : p.devRate > 0.2 ? "text-yellow-400" : "text-gray-400"}>
                        {Math.round(p.devRate * 100)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-left max-w-[200px]">
                      <span className="text-[10px] text-orange-400">{p.actions[0]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-[10px] text-gray-500 flex-wrap">
            <span>Proy. Abr = Marzo + crecimiento orgánico (max +30%)</span>
            <span>Tendencia = cambio Ene→Mar</span>
          </div>
        </>
      )}

      {/* Bottom insight */}
      <div className="mt-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
        <h3 className="text-sm font-bold text-orange-400 mb-2">Resumen de Crecimiento Abril</h3>
        <ul className="text-xs text-gray-300 space-y-1.5">
          <li>
            <strong>Proyeccion realista:</strong> {analysis.totalProjIng.toLocaleString()} ingresadas / {analysis.totalProjMov.toLocaleString()} movilizadas
            {" "}({analysis.totalMarzoIng > 0 ? "+" + Math.round(((analysis.totalProjIng - analysis.totalMarzoIng) / analysis.totalMarzoIng) * 100) : 0}% vs Marzo)
          </li>
          <li>
            <strong>Proyeccion stretch:</strong> {analysis.totalStretchIng.toLocaleString()} ingresadas / {analysis.totalStretchMov.toLocaleString()} movilizadas
            {" "}(con acciones agresivas en top proveedores)
          </li>
          <li>
            <strong>{analysis.creciendo.length} proveedores en crecimiento</strong> &mdash; escalar con mas sellers y catalogo
          </li>
          <li>
            <strong>{analysis.cayendo.length} proveedores en caida</strong> &mdash; contacto directo para identificar causa y reactivar
          </li>
          {analysis.altoDev.length > 0 && (
            <li>
              <strong>{analysis.altoDev.length} con alta devolucion (&gt;30%)</strong> &mdash; reducir dev libera ordenes efectivas
            </li>
          )}
        </ul>
      </div>
    </div>
    </ChartDownloadBtn>
  );
}
