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
  ReferenceLine,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface ProveedorData {
  proveedor: string;
  sellers: number;
  enero: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  febrero: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  marzo: { ing: number | null; mov: number | null; ent: number | null; dev: number | null; pct_entrega: number | null; pct_dev: number | null };
  total: { ing: number; mov: number; ent: number; dev: number };
  growth_pct: number | null;
}

const GOAL_MOVILIZADAS = 40000;
const TASA_MOVILIZACION = 0.78;
const GOAL_INGRESADAS = Math.ceil(GOAL_MOVILIZADAS / TASA_MOVILIZACION); // 51,283

const COLORS = [
  "#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F59E0B", "#6366F1", "#06B6D4",
  "#84CC16", "#D946EF", "#FB7185", "#22D3EE", "#A3E635",
  "#C084FC", "#FCD34D", "#34D399", "#F87171", "#60A5FA",
];

export default function ProductGoalPlanner({ proveedores }: { proveedores: ProveedorData[] }) {
  const [tab, setTab] = useState<"distribution" | "plan">("distribution");

  const analysis = useMemo(() => {
    // Prepare provider data with trends
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

        // Growth rate based on linear trend
        const movValues = [eneMov, febMov, marMov].filter((v) => v > 0);
        let monthlyGrowthRate = 0;
        if (movValues.length >= 2) {
          const first = movValues[0];
          const last = movValues[movValues.length - 1];
          monthlyGrowthRate = first > 0 ? (last - first) / first / (movValues.length - 1) : 0;
        }

        // Efficiency (movilizacion rate)
        const movRate = q1Ing > 0 ? q1Mov / q1Ing : 0;
        const devRate = q1Mov > 0 ? p.total.dev / q1Mov : 0;
        const entRate = q1Mov > 0 ? p.total.ent / q1Mov : 0;

        // Projected April (organic growth from March)
        const projAbrilMov = Math.round(marMov * (1 + Math.max(monthlyGrowthRate, 0)));
        const projAbrilIng = Math.round(marIng * (1 + Math.max(monthlyGrowthRate, 0)));

        // Market share of March
        const totalMarzoIng = proveedores.reduce((s, pp) => s + (pp.marzo.ing || 0), 0);
        const shareMarzo = totalMarzoIng > 0 ? marIng / totalMarzoIng : 0;

        return {
          ...p,
          eneMov, febMov, marMov, eneIng, febIng, marIng,
          q1Mov, q1Ing, avgMov, avgIng,
          monthlyGrowthRate,
          movRate, devRate, entRate,
          projAbrilMov, projAbrilIng,
          shareMarzo,
        };
      })
      .filter((p) => p.q1Mov > 0)
      .sort((a, b) => b.marIng - a.marIng);

    // === GOAL ALLOCATION ===
    // Strategy: Distribute 51,283 based on March share + growth potential
    const totalProjectedIng = prepared.reduce((s, p) => s + p.projAbrilIng, 0);
    const gapIng = Math.max(0, GOAL_INGRESADAS - totalProjectedIng);

    // Allocate goal proportionally using weighted score:
    // - 50% based on March ingresadas (proven capacity)
    // - 30% based on growth trend (momentum)
    // - 20% based on efficiency (low dev, high mov rate)
    const totalMarIng = prepared.reduce((s, p) => s + p.marIng, 0);
    const maxGrowth = Math.max(...prepared.map((p) => p.monthlyGrowthRate), 0.01);

    const withGoals = prepared.map((p) => {
      const capacityScore = totalMarIng > 0 ? p.marIng / totalMarIng : 0;
      const growthScore = maxGrowth > 0 ? Math.max(p.monthlyGrowthRate, 0) / maxGrowth : 0;
      const efficiencyScore = p.movRate * (1 - p.devRate);
      const weight = capacityScore * 0.5 + growthScore * 0.3 + efficiencyScore * 0.2;
      return { ...p, weight };
    });

    const totalWeight = withGoals.reduce((s, p) => s + p.weight, 0);

    const goalAllocated = withGoals.map((p) => {
      const share = totalWeight > 0 ? p.weight / totalWeight : 0;
      const goalIng = Math.round(GOAL_INGRESADAS * share);
      const goalMov = Math.round(goalIng * TASA_MOVILIZACION);
      const incrementVsMarzo = p.marIng > 0 ? ((goalIng - p.marIng) / p.marIng) * 100 : 0;
      const extraNeeded = Math.max(0, goalIng - p.projAbrilIng);
      const extraSellersNeeded = p.sellers > 0 && p.avgIng > 0
        ? Math.ceil(extraNeeded / (p.avgIng / p.sellers))
        : 0;

      return {
        ...p,
        goalIng,
        goalMov,
        share,
        incrementVsMarzo,
        extraNeeded,
        extraSellersNeeded,
        feasibility: incrementVsMarzo <= 30 ? "alta" : incrementVsMarzo <= 60 ? "media" : "baja",
      };
    });

    goalAllocated.sort((a, b) => b.goalIng - a.goalIng);

    // Pie chart data for market distribution
    const topForPie = goalAllocated.slice(0, 12);
    const othersGoal = goalAllocated.slice(12).reduce((s, p) => s + p.goalIng, 0);
    const pieData = [
      ...topForPie.map((p, i) => ({
        name: p.proveedor.length > 20 ? p.proveedor.slice(0, 20) + "…" : p.proveedor,
        value: p.goalIng,
        fill: COLORS[i % COLORS.length],
      })),
      ...(othersGoal > 0 ? [{ name: `Otros (${goalAllocated.length - 12})`, value: othersGoal, fill: "#4B5563" }] : []),
    ];

    // Summary stats
    const totalAllocated = goalAllocated.reduce((s, p) => s + p.goalIng, 0);
    const highFeasibility = goalAllocated.filter((p) => p.feasibility === "alta" && p.goalIng > 100);
    const medFeasibility = goalAllocated.filter((p) => p.feasibility === "media" && p.goalIng > 100);
    const lowFeasibility = goalAllocated.filter((p) => p.feasibility === "baja" && p.goalIng > 100);

    return {
      goalAllocated,
      pieData,
      totalAllocated,
      totalProjectedIng,
      gapIng,
      highFeasibility,
      medFeasibility,
      lowFeasibility,
    };
  }, [proveedores]);

  const barData = analysis.goalAllocated.slice(0, 20).map((p) => ({
    name: p.proveedor.length > 16 ? p.proveedor.slice(0, 16) + "…" : p.proveedor,
    "Marzo Real": p.marIng,
    "Meta Abril": p.goalIng,
    feasibility: p.feasibility,
  }));

  const feasColors: Record<string, string> = { alta: "#10B981", media: "#F59E0B", baja: "#EF4444" };

  return (
    <div className="glass-card p-6 border-orange-500/30">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📦 Productos (Proveedores) &mdash; Plan de Metas Abril
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Distribución de {GOAL_INGRESADAS.toLocaleString()} órdenes ingresadas necesarias entre proveedores para alcanzar 40,000 movilizadas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("distribution")}
            className={`text-xs px-4 py-2 rounded-lg transition-all ${
              tab === "distribution"
                ? "bg-orange-500 text-white"
                : "bg-transparent text-gray-400 border border-gray-700 hover:border-orange-500/40"
            }`}
          >
            Distribución Actual
          </button>
          <button
            onClick={() => setTab("plan")}
            className={`text-xs px-4 py-2 rounded-lg transition-all ${
              tab === "plan"
                ? "bg-orange-500 text-white"
                : "bg-transparent text-gray-400 border border-gray-700 hover:border-orange-500/40"
            }`}
          >
            Plan por Proveedor
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Meta Ingresadas</p>
          <p className="text-xl font-bold text-orange-400">{GOAL_INGRESADAS.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">→ 40,000 mov (78%)</p>
        </div>
        <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Proy. Orgánica</p>
          <p className="text-xl font-bold text-blue-400">{analysis.totalProjectedIng.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">Por tendencia</p>
        </div>
        <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Factibilidad Alta</p>
          <p className="text-xl font-bold text-green-400">{analysis.highFeasibility.length}</p>
          <p className="text-[10px] text-gray-500">Proveedores (&le;30% incr.)</p>
        </div>
        <div className="rounded-xl p-3 border border-yellow-500/20" style={{ background: "rgba(245,158,11,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Factibilidad Media</p>
          <p className="text-xl font-bold text-yellow-400">{analysis.medFeasibility.length}</p>
          <p className="text-[10px] text-gray-500">Proveedores (30-60%)</p>
        </div>
        <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Gap a cubrir</p>
          <p className="text-xl font-bold text-red-400">{analysis.gapIng > 0 ? `+${analysis.gapIng.toLocaleString()}` : "Cubierto"}</p>
          <p className="text-[10px] text-gray-500">Órdenes extra vs proy.</p>
        </div>
      </div>

      {tab === "distribution" ? (
        <>
          {/* PIE CHART + BAR CHART */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Pie: Goal distribution */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Distribución de Meta por Proveedor</h3>
              <ResponsiveContainer width="100%" height={350}>
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
                    {analysis.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#16213e",
                      border: "1px solid rgba(249,115,22,0.3)",
                      borderRadius: "12px",
                      color: "#F97316",
                    }}
                    itemStyle={{ color: "#F97316" }}
                    labelStyle={{ color: "#e5e7eb" }}
                    formatter={(value) => `${Number(value).toLocaleString()} órdenes`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar: March real vs April goal */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Top 20: Marzo Real vs Meta Abril (Ingresadas)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={barData} layout="vertical" margin={{ left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                  <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 9 }} width={130} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#16213e",
                      border: "1px solid rgba(249,115,22,0.3)",
                      borderRadius: "12px",
                      color: "#F97316",
                    }}
                    itemStyle={{ color: "#F97316" }}
                    labelStyle={{ color: "#e5e7eb" }}
                    formatter={(value) => Number(value).toLocaleString()}
                  />
                  <Bar dataKey="Marzo Real" fill="#6B7280" radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="Meta Abril" radius={[0, 4, 4, 0]} barSize={10}>
                    {barData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={feasColors[entry.feasibility]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top products cards */}
          <h3 className="text-sm font-medium text-gray-300 mb-3">Top 12 Proveedores que más mueven el negocio</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {analysis.goalAllocated.slice(0, 12).map((p, i) => {
              const pctOfGoal = ((p.goalIng / GOAL_INGRESADAS) * 100).toFixed(1);
              return (
                <div
                  key={p.proveedor}
                  className="p-4 rounded-xl border border-gray-800/50 hover:border-orange-500/30 transition-all"
                  style={{ background: "rgba(15,52,96,0.2)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          i < 3 ? "dropi-gradient text-white" : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium text-white truncate max-w-[160px]">{p.proveedor}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        p.feasibility === "alta"
                          ? "bg-green-500/10 text-green-400"
                          : p.feasibility === "media"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {p.feasibility === "alta" ? "Alcanzable" : p.feasibility === "media" ? "Esfuerzo" : "Desafiante"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-gray-500">Marzo</p>
                      <p className="text-sm font-bold text-gray-300">{p.marIng.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Meta Abril</p>
                      <p className="text-sm font-bold text-orange-400">{p.goalIng.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Incremento</p>
                      <p className={`text-sm font-bold ${p.incrementVsMarzo > 50 ? "text-red-400" : p.incrementVsMarzo > 20 ? "text-yellow-400" : "text-green-400"}`}>
                        {p.incrementVsMarzo > 0 ? "+" : ""}{p.incrementVsMarzo.toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                    <span>{p.sellers} sellers activos</span>
                    <span>{pctOfGoal}% de la meta total</span>
                    <span>{(p.movRate * 100).toFixed(0)}% tasa mov.</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full dropi-gradient"
                      style={{ width: `${Math.min((p.marIng / p.goalIng) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {((p.marIng / p.goalIng) * 100).toFixed(0)}% ya alcanzado con nivel Marzo
                  </p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* PLAN TABLE */}
          <div className="table-container overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                <tr className="border-b border-orange-500/20">
                  <th className="text-left py-2 px-2 text-gray-400">#</th>
                  <th className="text-left py-2 px-2 text-gray-400">Proveedor</th>
                  <th className="text-right py-2 px-2 text-gray-400">Sellers</th>
                  <th className="text-right py-2 px-2 text-gray-400">Ene Ing</th>
                  <th className="text-right py-2 px-2 text-gray-400">Feb Ing</th>
                  <th className="text-right py-2 px-2 text-gray-400">Mar Ing</th>
                  <th className="text-right py-2 px-2 text-orange-400 font-bold">Meta Abr</th>
                  <th className="text-right py-2 px-2 text-orange-400 font-bold">Meta Mov</th>
                  <th className="text-right py-2 px-2 text-gray-400">Incr.</th>
                  <th className="text-right py-2 px-2 text-gray-400">Extra Ing</th>
                  <th className="text-right py-2 px-2 text-gray-400">+Sellers</th>
                  <th className="text-right py-2 px-2 text-gray-400">% Mov</th>
                  <th className="text-right py-2 px-2 text-gray-400">% Dev</th>
                  <th className="text-center py-2 px-2 text-gray-400">Viab.</th>
                </tr>
              </thead>
              <tbody>
                {analysis.goalAllocated
                  .filter((p) => p.goalIng >= 10)
                  .map((p, i) => (
                  <tr key={p.proveedor} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                    <td className="py-2 px-2 text-gray-500">{i + 1}</td>
                    <td className="py-2 px-2 text-white font-medium max-w-[180px] truncate">{p.proveedor}</td>
                    <td className="py-2 px-2 text-right text-gray-400">{p.sellers}</td>
                    <td className="py-2 px-2 text-right text-gray-400">{p.eneIng > 0 ? p.eneIng.toLocaleString() : "—"}</td>
                    <td className="py-2 px-2 text-right text-gray-400">{p.febIng > 0 ? p.febIng.toLocaleString() : "—"}</td>
                    <td className="py-2 px-2 text-right text-blue-400">{p.marIng > 0 ? p.marIng.toLocaleString() : "—"}</td>
                    <td className="py-2 px-2 text-right text-orange-400 font-bold">{p.goalIng.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-orange-300">{p.goalMov.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={p.incrementVsMarzo > 50 ? "text-red-400 font-bold" : p.incrementVsMarzo > 20 ? "text-yellow-400" : "text-green-400"}>
                        {p.incrementVsMarzo > 0 ? "+" : ""}{p.incrementVsMarzo.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-300">
                      {p.extraNeeded > 0 ? `+${p.extraNeeded.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-300">
                      {p.extraSellersNeeded > 0 ? `+${p.extraSellersNeeded}` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-400">{(p.movRate * 100).toFixed(0)}%</td>
                    <td className="py-2 px-2 text-right">
                      <span className={p.devRate > 0.3 ? "text-red-400" : p.devRate > 0.2 ? "text-yellow-400" : "text-gray-400"}>
                        {(p.devRate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          p.feasibility === "alta" ? "bg-green-400" : p.feasibility === "media" ? "bg-yellow-400" : "bg-red-400"
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Alta viabilidad (&le;30% incremento)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Media (30-60%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Baja (&gt;60%)</span>
            <span>+Sellers = sellers adicionales estimados necesarios</span>
          </div>
        </>
      )}

      {/* Bottom insight */}
      <div className="mt-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
        <h3 className="text-sm font-bold text-orange-400 mb-2">📋 Resumen del Plan de Productos/Proveedores</h3>
        <ul className="text-xs text-gray-300 space-y-1.5">
          <li>• <strong>Meta:</strong> {GOAL_INGRESADAS.toLocaleString()} ingresadas &times; 78% = 40,000 movilizadas en Abril</li>
          <li>• <strong>Top 5 proveedores</strong> ({analysis.goalAllocated.slice(0, 5).map((p) => p.proveedor).join(", ")}) deben aportar {analysis.goalAllocated.slice(0, 5).reduce((s, p) => s + p.goalIng, 0).toLocaleString()} ingresadas ({((analysis.goalAllocated.slice(0, 5).reduce((s, p) => s + p.goalIng, 0) / GOAL_INGRESADAS) * 100).toFixed(0)}% de la meta)</li>
          <li>• <strong>{analysis.highFeasibility.length} proveedores</strong> pueden alcanzar su meta con crecimiento orgánico (&le;30% de incremento vs Marzo)</li>
          <li>• <strong>{analysis.medFeasibility.length} proveedores</strong> necesitan esfuerzo adicional (campañas, nuevos sellers, mayor exposición)</li>
          <li>• <strong>Acción clave:</strong> Enfocar reclutamiento de sellers en los proveedores con alta viabilidad y baja tasa de devolución para maximizar movilización efectiva</li>
          <li>• <strong>Proveedores en crecimiento:</strong> {analysis.goalAllocated.filter((p) => p.monthlyGrowthRate > 0.2 && p.marIng > 200).slice(0, 5).map((p) => `${p.proveedor} (+${(p.monthlyGrowthRate * 100).toFixed(0)}%)`).join(", ") || "N/A"} — priorizar para escalar</li>
        </ul>
      </div>
    </div>
  );
}
