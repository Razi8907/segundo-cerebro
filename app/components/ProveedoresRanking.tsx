"use client";

import { useState, useMemo } from "react";
import type { MesFilter } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

function getMesData(p: ProveedorData, mes: MesFilter) {
  if (mes === "q1" || mes === "abril") {
    return { mov: p.total.mov, ent: p.total.ent, dev: p.total.dev, ing: p.total.ing };
  }
  const d = p[mes];
  return { mov: d.mov || 0, ent: d.ent || 0, dev: d.dev || 0, ing: d.ing || 0 };
}

export default function ProveedoresRanking({
  proveedores,
  mesFilter,
}: {
  proveedores: ProveedorData[];
  mesFilter: MesFilter;
}) {
  const [view, setView] = useState<"volume" | "efficiency" | "growth">("volume");

  const ranked = useMemo(() => {
    return proveedores
      .map((p) => {
        const d = getMesData(p, mesFilter);
        const pctEnt = d.mov > 0 ? (d.ent / d.mov) * 100 : 0;
        const pctDev = d.mov > 0 ? (d.dev / d.mov) * 100 : 0;
        return { ...p, ...d, pctEnt, pctDev };
      })
      .filter((p) => p.mov > 0)
      .sort((a, b) => {
        if (view === "volume") return b.mov - a.mov;
        if (view === "efficiency") return b.pctEnt - a.pctEnt;
        return (b.growth_pct || 0) - (a.growth_pct || 0);
      });
  }, [proveedores, mesFilter, view]);

  const chartData = ranked.slice(0, 15).map((p) => ({
    name: p.proveedor.length > 18 ? p.proveedor.slice(0, 18) + "…" : p.proveedor,
    Movilizadas: p.mov,
    Entregados: p.ent,
  }));

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">📦 Ranking de Catálogos (Proveedores)</h2>
          <p className="text-xs text-gray-400">
            Cada proveedor = línea de productos &middot; {ranked.length} activos
          </p>
        </div>
        <div className="flex gap-1">
          {[
            { key: "volume", label: "Por Volumen" },
            { key: "efficiency", label: "Por Eficiencia" },
            { key: "growth", label: "Por Crecimiento" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key as typeof view)}
              className={`text-[11px] px-3 py-1.5 rounded-lg transition-all ${
                view === key
                  ? "bg-orange-500 text-white"
                  : "bg-transparent text-gray-400 border border-gray-700 hover:border-orange-500/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
          <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 10 }} width={140} />
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
          <Bar dataKey="Movilizadas" fill="#F97316" radius={[0, 6, 6, 0]} barSize={12} />
          <Bar dataKey="Entregados" fill="#10B981" radius={[0, 6, 6, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>

      {/* Top list */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ranked.slice(0, 9).map((p, i) => (
          <div
            key={p.proveedor}
            className="flex items-center gap-3 p-3 rounded-xl border border-gray-800/50 hover:border-orange-500/20 transition-all"
            style={{ background: "rgba(15,52,96,0.2)" }}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
              i < 3 ? "dropi-gradient text-white" : "bg-gray-800 text-gray-400"
            }`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{p.proveedor}</p>
              <div className="flex gap-3 mt-0.5">
                <span className="text-[10px] text-orange-400">{p.mov.toLocaleString()} mov</span>
                <span className="text-[10px] text-green-400">{p.pctEnt.toFixed(0)}% ent</span>
                <span className={`text-[10px] ${p.pctDev > 30 ? "text-red-400" : "text-gray-500"}`}>
                  {p.pctDev.toFixed(0)}% dev
                </span>
                {p.growth_pct != null && (
                  <span className={`text-[10px] ${p.growth_pct > 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.growth_pct > 0 ? "↑" : "↓"}{Math.abs(p.growth_pct)}%
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">{p.sellers} sellers</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
