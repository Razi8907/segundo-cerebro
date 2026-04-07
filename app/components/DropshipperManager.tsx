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
} from "recharts";

interface Dropshipper {
  email: string;
  proveedores: string[];
  num_proveedores: number;
  ene: { ing: number; mov: number };
  feb: { ing: number; mov: number };
  mar: { ing: number; mov: number };
  total: { ing: number; mov: number; ent: number; dev: number };
  pct_ent: number;
  pct_dev: number;
  pct_mov: number;
  growth: number | null;
}

interface ProveedorData {
  proveedor: string;
  sellers: number;
  total: { ing: number; mov: number; ent: number; dev: number };
  growth_pct: number | null;
  dropi_id?: number | null;
}

import type { MesFilter } from "../types";

interface MetaInfo {
  meta_movilizadas_abril: number;
  meta_ingresadas_abril: number;
  [key: string]: any;
}

export default function DropshipperManager({
  dropshippers,
  proveedores,
  mesFilter = "abril",
  metaInfo,
}: {
  dropshippers: Dropshipper[];
  proveedores: ProveedorData[];
  mesFilter?: MesFilter;
  metaInfo?: MetaInfo;
}) {
  const isAbril = mesFilter === "abril";
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "escalar" | "reactivar" | "nuevos_provs" | "alto_dev">("all");
  const [selectedDS, setSelectedDS] = useState<string | null>(null);

  const META_MOV_ABRIL = metaInfo?.meta_movilizadas_abril ?? 40000;
  const META_ING_ABRIL = metaInfo?.meta_ingresadas_abril ?? 51283;

  // Top providers ranked by potential — derived from data
  const TOP_PROVIDERS = proveedores
    .sort((a, b) => b.total.mov - a.total.mov)
    .slice(0, 15)
    .map((p) => p.proveedor);

  const analysis = useMemo(() => {
    const totalMovQ1 = dropshippers.reduce((s, d) => s + d.total.mov, 0);

    const scored = dropshippers.map((d) => {
      const marMov = d.mar.mov;
      const avgMov = d.total.mov / 3;

      const totalMarMov = dropshippers.reduce((s, dd) => s + dd.mar.mov, 0);
      const share = totalMarMov > 0 ? marMov / totalMarMov : 0;
      const goalAbrilMov = Math.round(META_MOV_ABRIL * share);
      const goalAbrilIng = Math.round(META_ING_ABRIL * share);
      const incrementNeeded = marMov > 0 ? Math.round(((goalAbrilMov - marMov) / marMov) * 100) : 0;

      // Current providers vs available top providers
      const currentProvs = new Set(d.proveedores);
      const missingTopProvs = TOP_PROVIDERS.filter((p) => !currentProvs.has(p));
      const potentialNewProvs = missingTopProvs.length;

      // Categorize
      let category: "escalar" | "reactivar" | "nuevos_provs" | "alto_dev" | "mantener";
      let action: string;
      let priority: "alta" | "media" | "baja";
      const seguimiento: string[] = [];

      if (d.pct_dev > 30) {
        category = "alto_dev";
        action = "Reducir devoluciones urgente";
        priority = "alta";
        seguimiento.push("Revisar calidad de productos enviados");
        seguimiento.push("Verificar tiempos de entrega y packaging");
        seguimiento.push("Capacitar en selección de productos con menor tasa de devolución");
        seguimiento.push(`Conectar con proveedores de baja devolución: ${missingTopProvs.filter((_, i) => i < 3).join(", ") || "N/A"}`);
      } else if ((d.growth ?? 0) > 30 && marMov > 50) {
        category = "escalar";
        action = "Escalar agresivamente";
        priority = "alta";
        seguimiento.push("Aumentar presupuesto de publicidad en productos que más vende");
        seguimiento.push(`Conectar con ${Math.min(potentialNewProvs, 3)} proveedores adicionales para ampliar catálogo`);
        seguimiento.push("Seguimiento semanal de métricas y optimización de campañas");
        seguimiento.push("Priorizar productos estrella: Creatina, Magnesio, Bee Venom, Lentes Multifoco");
      } else if ((d.growth ?? 0) < -20 && d.total.mov > 200) {
        category = "reactivar";
        action = "Reactivar con seguimiento intensivo";
        priority = "alta";
        seguimiento.push("Contacto directo para identificar por qué bajó el volumen");
        seguimiento.push("Ofrecer productos nuevos de alta rotación");
        seguimiento.push(`Conectar con proveedores faltantes: ${missingTopProvs.slice(0, 3).join(", ") || "N/A"}`);
        seguimiento.push("Plan de reactivación: metas semanales escalonadas");
      } else if (potentialNewProvs >= 8 && marMov > 30) {
        category = "nuevos_provs";
        action = "Ampliar catálogo de proveedores";
        priority = "media";
        seguimiento.push(`Solo trabaja con ${d.num_proveedores} proveedores de ${TOP_PROVIDERS.length} top disponibles`);
        seguimiento.push(`Conectar con: ${missingTopProvs.slice(0, 4).join(", ")}`);
        seguimiento.push("Capacitar en productos de alta demanda que aún no vende");
        seguimiento.push("Meta: agregar al menos 3 proveedores nuevos en Abril");
      } else {
        category = "mantener";
        action = "Mantener y optimizar";
        priority = "baja";
        seguimiento.push("Seguimiento quincenal de métricas");
        seguimiento.push("Revisar si puede incrementar volumen con productos existentes");
      }

      return {
        ...d,
        marMov,
        avgMov: Math.round(avgMov),
        goalAbrilMov,
        goalAbrilIng,
        incrementNeeded,
        missingTopProvs,
        potentialNewProvs,
        category,
        action,
        priority,
        seguimiento,
        share: Math.round(share * 10000) / 100,
      };
    });

    // Stats
    const escalables = scored.filter((s) => s.category === "escalar");
    const reactivar = scored.filter((s) => s.category === "reactivar");
    const nuevosProvs = scored.filter((s) => s.category === "nuevos_provs");
    const altoDevCount = scored.filter((s) => s.category === "alto_dev");

    return { scored, escalables, reactivar, nuevosProvs, altoDevCount };
  }, [dropshippers, META_MOV_ABRIL, META_ING_ABRIL, TOP_PROVIDERS]);

  const filtered = analysis.scored.filter((d) => {
    if (search && !d.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && d.category !== filterType) return false;
    return true;
  });

  const selected = selectedDS ? analysis.scored.find((d) => d.email === selectedDS) : null;

  const catColors: Record<string, string> = {
    escalar: "#10B981",
    reactivar: "#F59E0B",
    nuevos_provs: "#3B82F6",
    alto_dev: "#EF4444",
    mantener: "#6B7280",
  };
  const catLabels: Record<string, string> = {
    escalar: "Escalar",
    reactivar: "Reactivar",
    nuevos_provs: "Ampliar Provs",
    alto_dev: "Alto Dev",
    mantener: "Mantener",
  };

  const chartData = analysis.scored.slice(0, 20).map((d) => ({
    name: d.email.split("@")[0].slice(0, 16),
    "Marzo Mov": d.marMov,
    ...(isAbril ? { "Meta Abril": d.goalAbrilMov } : {}),
    category: d.category,
  }));

  return (
    <div className="glass-card p-6 border-orange-500/30">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
        👥 Gestión de Dropshippers {isAbril ? "— Plan de Seguimiento Abril" : "— Rendimiento Q1"}
      </h2>
      <p className="text-xs text-gray-400 mb-6">
        {dropshippers.length} dropshippers activos &middot; {isAbril ? "Seguimiento, proveedores y metas individuales" : "Análisis de rendimiento y categorización"}
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Escalar", count: analysis.escalables.length, color: "green", emoji: "🚀", desc: "En crecimiento, ampliar" },
          { label: "Reactivar", count: analysis.reactivar.length, color: "yellow", emoji: "⚡", desc: "Cayeron, recuperar" },
          { label: "Ampliar Provs", count: analysis.nuevosProvs.length, color: "blue", emoji: "📦", desc: "Falta catálogo" },
          { label: "Alto Dev", count: analysis.altoDevCount.length, color: "red", emoji: "⚠️", desc: ">30% devolución" },
          { label: "Total Activos", count: dropshippers.length, color: "orange", emoji: "👥", desc: "Dropshippers Q1" },
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
        <h3 className="text-sm font-medium text-gray-300 mb-3">{isAbril ? "Top 20 Dropshippers: Marzo vs Meta Abril" : "Top 20 Dropshippers: Movilizaciones por Mes"}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 9 }} width={120} />
            <Tooltip
              contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
              itemStyle={{ color: "#F97316" }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value) => Number(value).toLocaleString()}
            />
            <Bar dataKey="Marzo Mov" fill={isAbril ? "#6B7280" : "#F97316"} radius={[0, 4, 4, 0]} barSize={10} />
            {isAbril && (
              <Bar dataKey="Meta Abril" radius={[0, 4, 4, 0]} barSize={10}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={catColors[entry.category]} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-2 rounded-lg bg-[#16213e] border border-orange-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 flex-1 max-w-xs"
        />
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all", label: "Todos" },
            { key: "escalar", label: `🚀 Escalar (${analysis.escalables.length})` },
            { key: "reactivar", label: `⚡ Reactivar (${analysis.reactivar.length})` },
            { key: "nuevos_provs", label: `📦 Ampliar (${analysis.nuevosProvs.length})` },
            { key: "alto_dev", label: `⚠️ Alto Dev (${analysis.altoDevCount.length})` },
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
            <h3 className="text-sm font-bold text-orange-400">{selected.email}</h3>
            <button onClick={() => setSelectedDS(null)} className="text-xs text-gray-500 hover:text-gray-300">Cerrar</button>
          </div>
          {isAbril && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Meta Abril Mov</p>
                <p className="text-lg font-bold text-orange-400">{selected.goalAbrilMov.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Meta Abril Ing</p>
                <p className="text-lg font-bold text-blue-400">{selected.goalAbrilIng.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Incremento necesario</p>
                <p className={`text-lg font-bold ${selected.incrementNeeded > 50 ? "text-red-400" : "text-green-400"}`}>+{selected.incrementNeeded}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">% Meta total</p>
                <p className="text-lg font-bold text-purple-400">{selected.share}%</p>
              </div>
            </div>
          )}
          {!isAbril && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Total Mov Q1</p>
                <p className="text-lg font-bold text-orange-400">{selected.total.mov.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">% Entrega</p>
                <p className="text-lg font-bold text-green-400">{selected.pct_ent}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">% Devolución</p>
                <p className={`text-lg font-bold ${selected.pct_dev > 30 ? "text-red-400" : "text-gray-300"}`}>{selected.pct_dev}%</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-white mb-2">Proveedores actuales ({selected.num_proveedores})</h4>
              <div className="flex flex-wrap gap-1">
                {selected.proveedores.map((p) => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{p}</span>
                ))}
              </div>
              {selected.missingTopProvs.length > 0 && (
                <>
                  <h4 className="text-xs font-medium text-green-400 mt-3 mb-2">Proveedores recomendados para conectar</h4>
                  <div className="flex flex-wrap gap-1">
                    {selected.missingTopProvs.slice(0, 8).map((p) => (
                      <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">+ {p}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div>
              <h4 className="text-xs font-medium text-orange-400 mb-2">Plan de seguimiento</h4>
              <ul className="text-xs text-gray-300 space-y-1">
                {selected.seguimiento.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-orange-400 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
            <tr className="border-b border-orange-500/20">
              <th className="text-left py-2 px-2 text-gray-400">#</th>
              <th className="text-left py-2 px-2 text-gray-400">Dropshipper</th>
              <th className="text-right py-2 px-2 text-gray-400">Provs</th>
              <th className="text-right py-2 px-2 text-gray-400">Ene</th>
              <th className="text-right py-2 px-2 text-gray-400">Feb</th>
              <th className="text-right py-2 px-2 text-gray-400">Mar</th>
              {isAbril && <th className="text-right py-2 px-2 text-orange-400 font-bold">Meta Abr</th>}
              {isAbril && <th className="text-right py-2 px-2 text-gray-400">Incr.</th>}
              <th className="text-right py-2 px-2 text-gray-400">% Ent</th>
              <th className="text-right py-2 px-2 text-gray-400">% Dev</th>
              <th className="text-right py-2 px-2 text-gray-400">Trend</th>
              <th className="text-left py-2 px-2 text-gray-400">Acción</th>
              <th className="text-center py-2 px-2 text-gray-400">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((d, i) => (
              <tr key={d.email} className={`border-b border-gray-800/40 hover:bg-orange-500/5 ${selectedDS === d.email ? "bg-orange-500/10" : ""}`}>
                <td className="py-2 px-2 text-gray-500">{i + 1}</td>
                <td className="py-2 px-2 text-white font-medium max-w-[200px] truncate">{d.email}</td>
                <td className="py-2 px-2 text-right text-gray-400">{d.num_proveedores}</td>
                <td className="py-2 px-2 text-right text-gray-400">{d.ene.mov > 0 ? d.ene.mov.toLocaleString() : "—"}</td>
                <td className="py-2 px-2 text-right text-gray-400">{d.feb.mov > 0 ? d.feb.mov.toLocaleString() : "—"}</td>
                <td className="py-2 px-2 text-right text-blue-400">{d.marMov > 0 ? d.marMov.toLocaleString() : "—"}</td>
                {isAbril && <td className="py-2 px-2 text-right text-orange-400 font-bold">{d.goalAbrilMov.toLocaleString()}</td>}
                {isAbril && (
                  <td className="py-2 px-2 text-right">
                    <span className={d.incrementNeeded > 50 ? "text-red-400" : d.incrementNeeded > 20 ? "text-yellow-400" : "text-green-400"}>
                      +{d.incrementNeeded}%
                    </span>
                  </td>
                )}
                <td className="py-2 px-2 text-right text-green-400">{d.pct_ent}%</td>
                <td className="py-2 px-2 text-right">
                  <span className={d.pct_dev > 30 ? "text-red-400 font-bold" : d.pct_dev > 20 ? "text-yellow-400" : "text-gray-400"}>{d.pct_dev}%</span>
                </td>
                <td className="py-2 px-2 text-right">
                  {d.growth != null ? (
                    <span className={d.growth > 0 ? "text-green-400" : "text-red-400"}>
                      {d.growth > 0 ? "+" : ""}{d.growth}%
                    </span>
                  ) : "—"}
                </td>
                <td className="py-2 px-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: catColors[d.category] + "15", color: catColors[d.category] }}>
                    {catLabels[d.category]}
                  </span>
                </td>
                <td className="py-2 px-2 text-center">
                  <button
                    onClick={() => setSelectedDS(selectedDS === d.email ? null : d.email)}
                    className="text-[10px] px-2 py-0.5 rounded-lg border border-orange-500/20 text-orange-400 hover:bg-orange-500/10"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom strategies - only for Abril */}
      {isAbril && <div className="mt-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
        <h3 className="text-sm font-bold text-orange-400 mb-3">📋 Estrategia de Seguimiento por Categoría</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs text-gray-300">
          <div>
            <h4 className="font-medium text-green-400 mb-1">🚀 Escalar ({analysis.escalables.length} DS)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Seguimiento semanal de métricas y optimización</li>
              <li>• Conectar con proveedores top que no tienen</li>
              <li>• Aumentar presupuesto en campañas que funcionan</li>
              <li>• Priorizar productos: Creatina, Magnesio, Bee Venom, Lentes</li>
              <li>• Meta: +30% sobre Marzo</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-yellow-400 mb-1">⚡ Reactivar ({analysis.reactivar.length} DS)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Contacto directo en las próximas 48hs</li>
              <li>• Identificar causa de caída (competencia, stock, etc.)</li>
              <li>• Ofrecer nuevos productos de alta rotación</li>
              <li>• Plan de recuperación con metas semanales</li>
              <li>• Meta: volver al nivel de mejor mes Q1</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-400 mb-1">📦 Ampliar Catálogo ({analysis.nuevosProvs.length} DS)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Conectar con 3-5 proveedores top que no tienen</li>
              <li>• Capacitar en productos de alta demanda</li>
              <li>• Seguimiento bisemanal</li>
              <li>• Meta: duplicar proveedores activos</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-red-400 mb-1">⚠️ Reducir Devoluciones ({analysis.altoDevCount.length} DS)</h4>
            <ul className="space-y-0.5 ml-3">
              <li>• Auditoría de productos con mayor devolución</li>
              <li>• Capacitar en descripción de productos y expectativas</li>
              <li>• Migrar a proveedores con mejor tasa de entrega</li>
              <li>• Meta: bajar devolución a &lt;20%</li>
            </ul>
          </div>
        </div>
      </div>}
    </div>
  );
}
