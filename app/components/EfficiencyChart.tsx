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

  // Q1/Q2/Q3 y meses futuros suman siempre desde enero-marzo (referencia histórica).
  // Meses individuales muestran solo la data del mes seleccionado si existe.
  const r = resumen as unknown as Record<string, { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number } | undefined>;
  const isSpecificMonth = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre"].includes(mesFilter as string);
  const d = isSpecificMonth ? r[mesFilter as string] : undefined;
  if (d && d.ingresadas > 0) {
    totalIng = d.ingresadas;
    totalMov = d.movilizadas;
    totalEnt = d.entregados;
    totalDev = d.devoluciones;
  } else {
    // Fallback Q1
    totalIng = resumen.enero.ingresadas + resumen.febrero.ingresadas + resumen.marzo.ingresadas;
    totalMov = resumen.enero.movilizadas + resumen.febrero.movilizadas + resumen.marzo.movilizadas;
    totalEnt = resumen.enero.entregados + resumen.febrero.entregados + resumen.marzo.entregados;
    totalDev = resumen.enero.devoluciones + resumen.febrero.devoluciones + resumen.marzo.devoluciones;
  }

  const pctMov = totalIng > 0 ? parseFloat(((totalMov / totalIng) * 100).toFixed(1)) : 0;
  const pctEnt = totalMov > 0 ? parseFloat(((totalEnt / totalMov) * 100).toFixed(1)) : 0;
  const pctDev = totalMov > 0 ? parseFloat(((totalDev / totalMov) * 100).toFixed(1)) : 0;
  const pctExito = totalIng > 0 ? parseFloat(((totalEnt / totalIng) * 100).toFixed(1)) : 0;

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
