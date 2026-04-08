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
  if (mes === "q1" || mes === "abril") return { ing: p.total.ing, mov: p.total.mov, ent: p.total.ent, dev: p.total.dev };
  const d = p[mes];
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
              <th className="text-center py-3 px-2 text-gray-400 font-medium">WhatsApp</th>
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
                    <span className="text-white font-medium block truncate">{p.proveedor}</span>
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
                  <td className="py-2.5 px-2 text-center">
                    {p.whatsapp ? (
                      <a
                        href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        title={`WhatsApp: ${p.whatsapp}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
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
