"use client";

import { useState } from "react";
import type { MesFilter } from "../types";

interface Seller {
  email: string;
  enero: { mov: number | null; pct_entrega: number | null; pct_dev: number | null };
  febrero: { mov: number | null; pct_entrega: number | null; pct_dev: number | null };
  marzo: { mov: number | null; pct_entrega: number | null; pct_dev: number | null };
  total: { mov: number | null; pct_entrega: number | null; pct_dev: number | null };
}

function getSellerData(s: Seller, mes: MesFilter) {
  if (mes === "q1" || mes === "abril" || mes === "mayo") return s.total;
  return s[mes];
}

export default function SellersTable({ sellers, mesFilter }: { sellers: Seller[]; mesFilter: MesFilter }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total_mov");

  const filtered = sellers
    .filter((s) => s.email.toLowerCase().includes(search.toLowerCase()))
    .map((s) => ({ ...s, data: getSellerData(s, mesFilter) }))
    .filter((s) => (s.data.mov || 0) > 0)
    .sort((a, b) => {
      if (sortBy === "total_mov") return (b.data.mov || 0) - (a.data.mov || 0);
      if (sortBy === "pct_entrega") return (b.data.pct_entrega || 0) - (a.data.pct_entrega || 0);
      if (sortBy === "pct_dev") return (b.data.pct_dev || 0) - (a.data.pct_dev || 0);
      return (b.data.mov || 0) - (a.data.mov || 0);
    });

  const formatPct = (v: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : "—");

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Top Sellers por Movilizaciones</h2>
          <p className="text-xs text-gray-400">Rendimiento individual &middot; {filtered.length} sellers</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg bg-[#16213e] border border-orange-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg bg-[#16213e] border border-orange-500/20 text-white focus:outline-none"
          >
            <option value="total_mov">Movilizadas</option>
            <option value="pct_entrega">% Entrega</option>
            <option value="pct_dev">% Devolución</option>
          </select>
        </div>
      </div>
      <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.95)" }}>
            <tr className="border-b border-orange-500/20">
              <th className="text-left py-3 px-2 text-gray-400 font-medium">#</th>
              <th className="text-left py-3 px-2 text-gray-400 font-medium">Email</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Ene</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Feb</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Mar</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Total Mov</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">% Entrega</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">% Dev</th>
              <th className="text-center py-3 px-2 text-gray-400 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const pctDev = s.data.pct_dev || 0;
              let estado = "🟢";
              if (pctDev > 0.3) estado = "🔴";
              else if (pctDev > 0.2) estado = "🟡";
              return (
                <tr key={s.email} className="border-b border-gray-800/50 hover:bg-orange-500/5 transition-colors">
                  <td className="py-2.5 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-2.5 px-2 text-white font-medium max-w-[250px] truncate">{s.email}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{s.enero.mov?.toLocaleString() ?? "—"}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{s.febrero.mov?.toLocaleString() ?? "—"}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{s.marzo.mov?.toLocaleString() ?? "—"}</td>
                  <td className="py-2.5 px-2 text-right text-orange-400 font-bold">{s.data.mov?.toLocaleString() ?? "—"}</td>
                  <td className="py-2.5 px-2 text-right text-green-400">{formatPct(s.data.pct_entrega)}</td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={pctDev > 0.3 ? "text-red-400 font-bold" : pctDev > 0.2 ? "text-yellow-400" : "text-gray-400"}>
                      {formatPct(s.data.pct_dev)}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center">{estado}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
