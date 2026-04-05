"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
}

export default function TrendChart({ resumen }: { resumen: Resumen }) {
  const chartData = [
    {
      mes: "Enero",
      Ingresadas: resumen.enero.ingresadas,
      Movilizadas: resumen.enero.movilizadas,
      Entregados: resumen.enero.entregados,
    },
    {
      mes: "Febrero",
      Ingresadas: resumen.febrero.ingresadas,
      Movilizadas: resumen.febrero.movilizadas,
      Entregados: resumen.febrero.entregados,
    },
    {
      mes: "Marzo",
      Ingresadas: resumen.marzo.ingresadas,
      Movilizadas: resumen.marzo.movilizadas,
      Entregados: resumen.marzo.entregados,
    },
  ];

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Tendencia Mensual Q1</h2>
      <p className="text-xs text-gray-400 mb-4">Órdenes ingresadas, movilizadas y entregadas</p>
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
              color: "#e5e7eb",
            }}
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
