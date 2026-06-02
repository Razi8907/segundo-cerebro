"use client";

import { useState } from "react";
import type { MesFilter } from "../types";

interface Proveedor {
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

function getData(p: Proveedor, mes: MesFilter) {
  if (mes === "q1" || mes === "abril" || mes === "mayo" || mes === "junio") return { ing: p.total.ing, mov: p.total.mov, ent: p.total.ent, dev: p.total.dev };
  const d = p[mes as "enero" | "febrero" | "marzo"];
  return { ing: d.ing || 0, mov: d.mov || 0, ent: d.ent || 0, dev: d.dev || 0 };
}

export default function ProveedoresTable({ proveedores, mesFilter }: { proveedores: Proveedor[]; mesFilter: MesFilter }) {
  const [sortBy, setSortBy] = useState<string>("total_mov");
  const [search, setSearch] = useState("");

  const withTotals = proveedores.map((p) => {
    const d = getData(p, mesFilter);
    return { ...p, fIng: d.ing, fMov: d.mov, fEnt: d.ent, fDev: d.dev };
  });

  const filtered = withTotals
    .filter((p) => p.proveedor.toLowerCase().includes(search.toLowerCase()) && p.fMov > 0)
    .sort((a, b) => {
      if (sortBy === "total_mov") return b.fMov - a.fMov;
      if (sortBy === "total_ing") return b.fIng - a.fIng;
      if (sortBy === "total_ent") return b.fEnt - a.fEnt;
      if (sortBy === "total_dev") return b.fDev - a.fDev;
      if (sortBy === "pct_entrega") {
        const pctA = a.fMov > 0 ? a.fEnt / a.fMov : 0;
        const pctB = b.fMov > 0 ? b.fEnt / b.fMov : 0;
        return pctB - pctA;
      }
      return b.fMov - a.fMov;
    });

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Tabla de Proveedores</h2>
          <p className="text-xs text-gray-400">{filtered.length} proveedores activos</p>
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
      <div className="table-container overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
            <tr className="border-b border-orange-500/20">
              <th className="text-left py-3 px-2 text-gray-400 font-medium">#</th>
              <th className="text-left py-3 px-2 text-gray-400 font-medium">Proveedor</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Sellers</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Ingresadas</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Movilizadas</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Entregados</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Devoluciones</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">% Entrega</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">% Dev</th>
              <th className="text-right py-3 px-2 text-gray-400 font-medium">Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((p, i) => {
              const pctEntrega = p.fMov > 0 ? ((p.fEnt / p.fMov) * 100).toFixed(1) : "—";
              const pctDev = p.fMov > 0 ? ((p.fDev / p.fMov) * 100).toFixed(1) : "—";
              const pctDevNum = p.fMov > 0 ? (p.fDev / p.fMov) * 100 : 0;
              return (
                <tr key={p.proveedor} className="border-b border-gray-800/50 hover:bg-orange-500/5 transition-colors">
                  <td className="py-2.5 px-2 text-gray-500">{i + 1}</td>
                  <td className="py-2.5 px-2 max-w-[200px]">
                    {p.whatsapp ? (
                      <a href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-500 font-medium block truncate hover:text-green-400 hover:underline" title={`Chat WhatsApp: ${p.whatsapp}`}>{p.proveedor}</a>
                    ) : (
                      <span className="text-white font-medium block truncate">{p.proveedor}</span>
                    )}
                    {p.dropi_id && <span className="text-[10px] text-gray-500">ID: {p.dropi_id}</span>}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-400">{p.sellers}</td>
                  <td className="py-2.5 px-2 text-right text-gray-300">{p.fIng.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-blue-400 font-medium">{p.fMov.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-green-400">{p.fEnt.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-red-400">{p.fDev.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right text-green-400">{pctEntrega}%</td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={pctDevNum > 30 ? "text-red-400 font-bold" : pctDevNum > 20 ? "text-yellow-400" : "text-gray-400"}>
                      {pctDev}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {p.growth_pct != null ? (
                      <span className={p.growth_pct > 0 ? "text-green-400" : "text-red-400"}>
                        {p.growth_pct > 0 ? "+" : ""}{p.growth_pct}%
                      </span>
                    ) : "—"}
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
