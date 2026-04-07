"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
}

export default function ProjectionChart({ resumen }: { resumen: Resumen }) {
  // Linear regression projection for Q2
  const meses = [1, 2, 3];
  const ingresadas = [resumen.enero.ingresadas, resumen.febrero.ingresadas, resumen.marzo.ingresadas];
  const movilizadas = [resumen.enero.movilizadas, resumen.febrero.movilizadas, resumen.marzo.movilizadas];

  function linearProjection(values: number[], futureX: number): number {
    const n = values.length;
    const sumX = meses.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = meses.reduce((acc, x, i) => acc + x * values[i], 0);
    const sumX2 = meses.reduce((acc, x) => acc + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return Math.round(slope * futureX + intercept);
  }

  const chartData = [
    { mes: "Ene", Ingresadas: resumen.enero.ingresadas, Movilizadas: resumen.enero.movilizadas },
    { mes: "Feb", Ingresadas: resumen.febrero.ingresadas, Movilizadas: resumen.febrero.movilizadas },
    { mes: "Mar", Ingresadas: resumen.marzo.ingresadas, Movilizadas: resumen.marzo.movilizadas },
    {
      mes: "Abr*",
      "Ingresadas (Proy.)": linearProjection(ingresadas, 4),
      "Movilizadas (Proy.)": linearProjection(movilizadas, 4),
    },
    {
      mes: "May*",
      "Ingresadas (Proy.)": linearProjection(ingresadas, 5),
      "Movilizadas (Proy.)": linearProjection(movilizadas, 5),
    },
    {
      mes: "Jun*",
      "Ingresadas (Proy.)": linearProjection(ingresadas, 6),
      "Movilizadas (Proy.)": linearProjection(movilizadas, 6),
    },
  ];

  const projQ2Ing = linearProjection(ingresadas, 4) + linearProjection(ingresadas, 5) + linearProjection(ingresadas, 6);
  const projQ2Mov = linearProjection(movilizadas, 4) + linearProjection(movilizadas, 5) + linearProjection(movilizadas, 6);

  return (
    <ChartDownloadBtn filename="Proyeccion_Q2">
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Proyección Q2 2026</h2>
      <p className="text-xs text-gray-400 mb-2">Regresión lineal basada en tendencia Q1</p>
      <div className="flex gap-4 mb-4">
        <span className="text-xs px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
          Proy. Ingresadas Q2: {projQ2Ing.toLocaleString()}
        </span>
        <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Proy. Movilizadas Q2: {projQ2Mov.toLocaleString()}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
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
          <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 11 }} />
          <ReferenceLine x="Mar" stroke="#F97316" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Line type="monotone" dataKey="Ingresadas" stroke="#F97316" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Movilizadas" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Ingresadas (Proy.)" stroke="#F97316" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4, strokeDasharray: "0" }} />
          <Line type="monotone" dataKey="Movilizadas (Proy.)" stroke="#3B82F6" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4, strokeDasharray: "0" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    </ChartDownloadBtn>
  );
}
