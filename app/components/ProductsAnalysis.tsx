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
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Product {
  producto: string;
  cantidad: number;
}

interface ProveedorData {
  proveedor: string;
  sellers: number;
  total: { ing: number; mov: number; ent: number; dev: number };
  growth_pct: number | null;
}

interface MetaInfo {
  meta_movilizadas_abril: number;
  meta_ingresadas_abril: number;
  [key: string]: any;
}

const COLORS = [
  "#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F59E0B", "#6366F1", "#06B6D4",
  "#84CC16", "#D946EF", "#FB7185", "#22D3EE", "#A3E635",
];

import type { MesFilter } from "../types";

export default function ProductsAnalysis({
  productos,
  proveedores,
  productosTotal,
  mesFilter = "abril",
  metaInfo,
}: {
  productos: Product[];
  proveedores: ProveedorData[];
  productosTotal: number;
  mesFilter?: MesFilter;
  metaInfo?: MetaInfo;
}) {
  const isAbril = mesFilter === "abril";
  const META_INGRESADAS = metaInfo?.meta_ingresadas_abril ?? 51283;
  const [search, setSearch] = useState("");
  const [showCount, setShowCount] = useState(30);

  const analysis = useMemo(() => {
    const totalUnidades = productos.reduce((s, p) => s + p.cantidad, 0);

    // Top products with market share and growth factor
    const topProducts = productos.map((p, i) => {
      const share = p.cantidad / totalUnidades;
      // Growth factor needed: ratio of April goal vs Q1 monthly average
      // Q1 total = totalUnidades, monthly avg = totalUnidades/3
      // April needs META_INGRESADAS, so growth = META_INGRESADAS / (totalUnidades/3)
      const monthlyAvg = totalUnidades / 3;
      const growthFactor = META_INGRESADAS / monthlyAvg;
      const stockNeededAbril = Math.round(p.cantidad / 3 * growthFactor);
      const stockQ1Monthly = Math.round(p.cantidad / 3);

      return {
        ...p,
        rank: i + 1,
        share,
        stockQ1Monthly,
        stockNeededAbril,
        increment: stockQ1Monthly > 0 ? Math.round(((stockNeededAbril - stockQ1Monthly) / stockQ1Monthly) * 100) : 0,
      };
    });

    // Category concentration
    const top10Share = topProducts.slice(0, 10).reduce((s, p) => s + p.share, 0);
    const top20Share = topProducts.slice(0, 20).reduce((s, p) => s + p.share, 0);
    const top50Share = topProducts.slice(0, 50).reduce((s, p) => s + p.share, 0);

    // Pie data
    const pieData = topProducts.slice(0, 10).map((p, i) => ({
      name: p.producto.length > 25 ? p.producto.slice(0, 25) + "…" : p.producto,
      value: p.cantidad,
      fill: COLORS[i],
    }));
    pieData.push({
      name: `Otros (${productosTotal - 10})`,
      value: totalUnidades - topProducts.slice(0, 10).reduce((s, p) => s + p.cantidad, 0),
      fill: "#4B5563",
    });

    return { topProducts, totalUnidades, top10Share, top20Share, top50Share, pieData };
  }, [productos, productosTotal]);

  const filtered = analysis.topProducts.filter((p) =>
    p.producto.toLowerCase().includes(search.toLowerCase())
  );

  const barData = analysis.topProducts.slice(0, 15).map((p) => ({
    name: p.producto.length > 22 ? p.producto.slice(0, 22) + "…" : p.producto,
    "Q1 Mensual": p.stockQ1Monthly,
    "Meta Abril": p.stockNeededAbril,
  }));

  // Top providers matched with top products for recommendations
  const topProvs = proveedores.slice(0, 15);

  return (
    <div className="glass-card p-6 border-orange-500/30">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🏷️ Productos Más Vendidos Q1 {isAbril ? "— Stock Necesario Abril" : ""}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {productosTotal.toLocaleString()} productos &middot; {analysis.totalUnidades.toLocaleString()} unidades vendidas Q1
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Unid. Q1</p>
          <p className="text-lg font-bold text-orange-400">{analysis.totalUnidades.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">{Math.round(analysis.totalUnidades / 3).toLocaleString()}/mes</p>
        </div>
        <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Top 10 = </p>
          <p className="text-lg font-bold text-blue-400">{(analysis.top10Share * 100).toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500">del volumen total</p>
        </div>
        <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Top 20 = </p>
          <p className="text-lg font-bold text-green-400">{(analysis.top20Share * 100).toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500">del volumen total</p>
        </div>
        <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: "rgba(139,92,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Top 50 = </p>
          <p className="text-lg font-bold text-purple-400">{(analysis.top50Share * 100).toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500">del volumen total</p>
        </div>
        {isAbril && (
          <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Factor Crecimiento</p>
            <p className="text-lg font-bold text-red-400">x{(META_INGRESADAS / (analysis.totalUnidades / 3)).toFixed(2)}</p>
            <p className="text-[10px] text-gray-500">vs promedio Q1 mensual</p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pie */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Concentración Top 10 Productos</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={analysis.pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={55}
                paddingAngle={2}
              >
                {analysis.pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
                itemStyle={{ color: "#F97316" }}
                formatter={(value) => `${Number(value).toLocaleString()} unidades`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar: Q1 monthly vs April goal */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">{isAbril ? "Top 15: Stock Mensual Q1 vs Meta Abril" : "Top 15: Volumen Mensual Promedio Q1"}</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} layout="vertical" margin={{ left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 8 }} width={160} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
                itemStyle={{ color: "#F97316" }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(value) => Number(value).toLocaleString()}
              />
              <Bar dataKey="Q1 Mensual" fill="#F97316" radius={[0, 4, 4, 0]} barSize={10} />
              {isAbril && <Bar dataKey="Meta Abril" fill="#10B981" radius={[0, 4, 4, 0]} barSize={10} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Products table */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">{isAbril ? "Listado de Productos — Stock Necesario para Abril" : "Listado de Productos — Rendimiento Q1"}</h3>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-2 rounded-lg bg-[#16213e] border border-orange-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
        />
      </div>
      <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
            <tr className="border-b border-orange-500/20">
              <th className="text-left py-2 px-2 text-gray-400">#</th>
              <th className="text-left py-2 px-2 text-gray-400">Producto</th>
              <th className="text-right py-2 px-2 text-gray-400">Vendidos Q1</th>
              <th className="text-right py-2 px-2 text-gray-400">% Total</th>
              <th className="text-right py-2 px-2 text-gray-400">Prom/Mes Q1</th>
              {isAbril && <th className="text-right py-2 px-2 text-orange-400 font-bold">Stock Meta Abril</th>}
              {isAbril && <th className="text-right py-2 px-2 text-gray-400">Incremento</th>}
              <th className="text-center py-2 px-2 text-gray-400">Prioridad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, showCount).map((p) => {
              const prioridad = p.rank <= 10 ? "Crítico" : p.rank <= 30 ? "Alto" : p.rank <= 100 ? "Medio" : "Bajo";
              const prioColor = p.rank <= 10 ? "text-red-400" : p.rank <= 30 ? "text-orange-400" : p.rank <= 100 ? "text-yellow-400" : "text-gray-500";
              return (
                <tr key={p.producto} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                  <td className="py-2 px-2 text-gray-500">{p.rank}</td>
                  <td className="py-2 px-2 text-white font-medium max-w-[280px] truncate">{p.producto}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{p.cantidad.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right text-gray-400">{(p.share * 100).toFixed(2)}%</td>
                  <td className="py-2 px-2 text-right text-blue-400">{p.stockQ1Monthly.toLocaleString()}</td>
                  {isAbril && <td className="py-2 px-2 text-right text-orange-400 font-bold">{p.stockNeededAbril.toLocaleString()}</td>}
                  {isAbril && (
                    <td className="py-2 px-2 text-right">
                      <span className={p.increment > 50 ? "text-red-400" : "text-green-400"}>
                        +{p.increment}%
                      </span>
                    </td>
                  )}
                  <td className={`py-2 px-2 text-center text-[10px] font-medium ${prioColor}`}>{prioridad}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > showCount && (
        <button
          onClick={() => setShowCount((c) => c + 30)}
          className="mt-3 text-xs text-orange-400 hover:text-orange-300"
        >
          Ver más ({filtered.length - showCount} restantes)
        </button>
      )}

      {/* Dropshipper + Product recommendations - only for Abril */}
      {isAbril && <div className="mt-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
        <h3 className="text-sm font-bold text-orange-400 mb-3">🎯 Recomendaciones: Productos + Dropshippers para Abril</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium text-white mb-2">Productos prioritarios para stock</h4>
            <ul className="text-xs text-gray-300 space-y-1">
              {analysis.topProducts.slice(0, 10).map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold w-4 shrink-0">{i + 1}.</span>
                  <span className="flex-1">
                    <strong>{p.producto}</strong>
                    <span className="text-gray-500"> — Stock necesario: </span>
                    <span className="text-orange-400 font-bold">{p.stockNeededAbril.toLocaleString()}</span>
                    <span className="text-gray-500"> unid. (+{p.increment}% vs Q1)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium text-white mb-2">Dropshippers a priorizar (por volumen + crecimiento)</h4>
            <ul className="text-xs text-gray-300 space-y-1">
              {topProvs.slice(0, 10).map((p, i) => {
                const action =
                  (p.growth_pct ?? 0) > 20
                    ? "Escalar agresivamente"
                    : (p.growth_pct ?? 0) > 0
                    ? "Mantener y crecer"
                    : "Reactivar con campañas";
                const actionColor =
                  (p.growth_pct ?? 0) > 20 ? "text-green-400" : (p.growth_pct ?? 0) > 0 ? "text-blue-400" : "text-yellow-400";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-orange-400 font-bold w-4 shrink-0">{i + 1}.</span>
                    <span className="flex-1">
                      <strong>{p.proveedor}</strong>
                      <span className="text-gray-500"> ({p.sellers} sellers, {p.total.mov.toLocaleString()} mov Q1) — </span>
                      <span className={`font-medium ${actionColor}`}>{action}</span>
                      {p.growth_pct != null && (
                        <span className={`ml-1 ${(p.growth_pct ?? 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                          ({p.growth_pct > 0 ? "+" : ""}{p.growth_pct}%)
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>}
    </div>
  );
}
