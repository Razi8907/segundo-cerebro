"use client";

import type { MesFilter } from "../types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
}

export default function DevolucionesChart({ resumen, mesFilter }: { resumen: Resumen; mesFilter: MesFilter }) {
  const allData = [
    {
      mes: "Enero",
      Devoluciones: resumen.enero.devoluciones,
      "% Devolución": parseFloat(((resumen.enero.devoluciones / resumen.enero.movilizadas) * 100).toFixed(1)),
      "% Entrega": parseFloat(((resumen.enero.entregados / resumen.enero.movilizadas) * 100).toFixed(1)),
    },
    {
      mes: "Febrero",
      Devoluciones: resumen.febrero.devoluciones,
      "% Devolución": parseFloat(((resumen.febrero.devoluciones / resumen.febrero.movilizadas) * 100).toFixed(1)),
      "% Entrega": parseFloat(((resumen.febrero.entregados / resumen.febrero.movilizadas) * 100).toFixed(1)),
    },
    {
      mes: "Marzo",
      Devoluciones: resumen.marzo.devoluciones,
      "% Devolución": parseFloat(((resumen.marzo.devoluciones / resumen.marzo.movilizadas) * 100).toFixed(1)),
      "% Entrega": parseFloat(((resumen.marzo.entregados / resumen.marzo.movilizadas) * 100).toFixed(1)),
    },
  ];

  const chartData = (mesFilter === "q1" || mesFilter === "abril")
    ? allData
    : allData.filter((d) => d.mes.toLowerCase() === mesFilter);

  return (
    <ChartDownloadBtn filename="Devoluciones">
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Tasas de Entrega vs Devolución</h2>
      <p className="text-xs text-gray-400 mb-4">Evolución porcentual por mes</p>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorEntrega" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorDev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
          <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} unit="%" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#16213e",
              border: "1px solid rgba(249,115,22,0.3)",
              borderRadius: "12px",
              color: "#F97316",
            }}
            itemStyle={{ color: "#F97316" }}
            labelStyle={{ color: "#e5e7eb" }}
            formatter={(value) => `${value}%`}
          />
          <Area type="monotone" dataKey="% Entrega" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorEntrega)" />
          <Area type="monotone" dataKey="% Devolución" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    </ChartDownloadBtn>
  );
}
