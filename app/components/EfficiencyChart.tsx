"use client";

import type { MesFilter } from "../types";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
}

export default function EfficiencyChart({ resumen, mesFilter }: { resumen: Resumen; mesFilter: MesFilter }) {
  let totalIng: number, totalMov: number, totalEnt: number, totalDev: number;

  if (mesFilter === "q1" || mesFilter === "abril") {
    totalIng = resumen.enero.ingresadas + resumen.febrero.ingresadas + resumen.marzo.ingresadas;
    totalMov = resumen.enero.movilizadas + resumen.febrero.movilizadas + resumen.marzo.movilizadas;
    totalEnt = resumen.enero.entregados + resumen.febrero.entregados + resumen.marzo.entregados;
    totalDev = resumen.enero.devoluciones + resumen.febrero.devoluciones + resumen.marzo.devoluciones;
  } else {
    const d = resumen[mesFilter];
    totalIng = d.ingresadas;
    totalMov = d.movilizadas;
    totalEnt = d.entregados;
    totalDev = d.devoluciones;
  }

  const pctMov = parseFloat(((totalMov / totalIng) * 100).toFixed(1));
  const pctEnt = parseFloat(((totalEnt / totalMov) * 100).toFixed(1));
  const pctDev = parseFloat(((totalDev / totalMov) * 100).toFixed(1));
  const pctExito = parseFloat(((totalEnt / totalIng) * 100).toFixed(1));

  const metrics = [
    { label: "Movilización", value: pctMov, color: "#F97316", desc: "Ingresadas → Movilizadas" },
    { label: "Entrega", value: pctEnt, color: "#10B981", desc: "Movilizadas → Entregadas" },
    { label: "Éxito Total", value: pctExito, color: "#3B82F6", desc: "Ingresadas → Entregadas" },
    { label: "Devolución", value: pctDev, color: "#EF4444", desc: "Movilizadas → Devueltas" },
  ];

  return (
    <ChartDownloadBtn filename="Eficiencia_Operativa">
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Eficiencia Operativa</h2>
      <p className="text-xs text-gray-400 mb-4">Tasas de conversión del funnel de órdenes</p>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col items-center">
            <ResponsiveContainer width={120} height={120}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="70%"
                outerRadius="100%"
                barSize={10}
                data={[{ value: m.value, fill: m.color }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: "#d1d5db" }} dataKey="value" angleAxisId={0} cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <span className="text-2xl font-bold mt-[-60px] mb-6" style={{ color: m.color }}>
              {m.value}%
            </span>
            <span className="text-sm font-medium text-white">{m.label}</span>
            <span className="text-[10px] text-gray-500">{m.desc}</span>
          </div>
        ))}
      </div>
    </div>
    </ChartDownloadBtn>
  );
}
