"use client";

import type { MesFilter } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
}

export default function TrendChart({ resumen, mesFilter }: { resumen: Resumen; mesFilter: MesFilter }) {
  const allData = [
    { mes: "Enero", Ingresadas: resumen.enero.ingresadas, Movilizadas: resumen.enero.movilizadas, Entregados: resumen.enero.entregados },
    { mes: "Febrero", Ingresadas: resumen.febrero.ingresadas, Movilizadas: resumen.febrero.movilizadas, Entregados: resumen.febrero.entregados },
    { mes: "Marzo", Ingresadas: resumen.marzo.ingresadas, Movilizadas: resumen.marzo.movilizadas, Entregados: resumen.marzo.entregados },
  ];

  const chartData = (mesFilter === "q1" || mesFilter === "abril")
    ? allData
    : allData.filter((d) => d.mes.toLowerCase() === mesFilter);

  const highlightMes = mesFilter !== "q1" ? mesFilter.charAt(0).toUpperCase() + mesFilter.slice(1) : null;

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Tendencia Mensual</h2>
      <p className="text-xs text-gray-400 mb-4">
        {mesFilter === "q1" ? "Comparativa Ene-Feb-Mar" : `Detalle ${highlightMes}`} &middot; Órdenes ingresadas, movilizadas y entregadas
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
          <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
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
          <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
          <Bar dataKey="Ingresadas" fill="#F97316" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Movilizadas" fill="#3B82F6" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Entregados" fill="#10B981" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
