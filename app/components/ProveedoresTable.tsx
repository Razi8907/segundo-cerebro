"use client";

import { useState } from "react";

interface Proveedor {
  proveedor: string;
  enero: { ingresadas: number | null; movilizadas: number | null; entregados: number | null; devoluciones: number | null; pct_entrega: number | null; pct_dev: number | null };
  febrero: { ingresadas: number | null; movilizadas: number | null; entregados: number | null; devoluciones: number | null; pct_entrega: number | null; pct_dev: number | null };
  marzo: { ingresadas: number | null; movilizadas: number | null; entregados: number | null; devoluciones: number | null; pct_entrega: number | null; pct_dev: number | null };
}

export default function ProveedoresTable({ proveedores }: { proveedores: Proveedor[] }) {
  const [sortBy, setSortBy] = useState<string>("total_mov");
  const [search, setSearch] = useState("");

  const withTotals = proveedores.map((p) => {
    const totalIng = (p.enero.ingresadas || 0) + (p.febrero.ingresadas || 0) + (p.marzo.ingresadas || 0);
    const totalMov = (p.enero.movilizadas || 0) + (p.febrero.movilizadas || 0) + (p.marzo.movilizadas || 0);
    const totalEnt = (p.enero.entregados || 0) + (p.febrero.entregados || 0) + (p.marzo.entregados || 0);
    const totalDev = (p.enero.devoluciones || 0) + (p.febrero.devoluciones || 0) + (p.marzo.devoluciones || 0);
    return { ...p, totalIng, totalMov, totalEnt, totalDev };
  });

  const filtered = withTotals
    .filter((p) => p.proveedor.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "total_mov") return b.totalMov - a.totalMov;
      if (sortBy === "total_ing") return b.totalIng - a.totalIng;
      if (sortBy === "total_ent") return b.totalEnt - a.totalEnt;
      if (sortBy === "total_dev") return b.totalDev - a.totalDev;
      if (sortBy === "pct_entrega") {
        const pctA = a.totalMov > 0 ? a.totalEnt / a.totalMov : 0;
        const pctB = b.totalMov > 0 ? b.totalEnt / b.totalMov : 0;
        return pctB - pctA;
      }
      return b.totalMov - a.totalMov;
    });

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Ranking de Proveedores</h2>
          <p className="text-xs text-gray-400">{filtered.length} proveedores - Datos acumulados Q1 2026</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar proveedor..."
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
            <option value="total_ing">Ingresadas</option>
            <option value="total_ent">Entregados</option>
            <option value="total_dev">Devoluciones</option>
            <option value="pct_entrega">% Entrega</option>
          </select>
        </div>
      </div>
      <div className="table-container overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-orange-500/20">
              <th className="text-left py-3 px-2 text-gray-400 font-medium">#</th>
              <th className="text-left py-3 px-2 text-gray-400 font-medium">Proveedor</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Ingresadas</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Movilizadas</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Entregados</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Devoluciones</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">% Entrega</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">% Devolución</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((p, i) => {
              const pctEntrega = p.totalMov > 0 ? ((p.totalEnt / p.totalMov) * 100).toFixed(1) : "—";
              const pctDev = p.totalMov > 0 ? ((p.totalDev / p.totalMov) * 100).toFixed(1) : "—";
              const pctDevNum = p.totalMov > 0 ? (p.totalDev / p.totalMov) * 100 : 0;
              return (
                <tr key={p.proveedor} className="border-b border-gray-800/50 hover:bg-orange-500/5 transition-colors">
                  <td className="py-2.5 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-2.5 px-2 text-white font-medium max-w-[200px] truncate">{p.proveedor}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{p.totalIng.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-blue-400 font-medium">{p.totalMov.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-green-400">{p.totalEnt.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-red-400">{p.totalDev.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right">
                    <span className="text-green-400">{pctEntrega}%</span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={pctDevNum > 30 ? "text-red-400 font-bold" : pctDevNum > 20 ? "text-yellow-400" : "text-gray-400"}>
                      {pctDev}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
