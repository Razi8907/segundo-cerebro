"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
}

export default function EfficiencyChart({ resumen }: { resumen: Resumen }) {
  const totalIng = resumen.enero.ingresadas + resumen.febrero.ingresadas + resumen.marzo.ingresadas;
  const totalMov = resumen.enero.movilizadas + resumen.febrero.movilizadas + resumen.marzo.movilizadas;
  const totalEnt = resumen.enero.entregados + resumen.febrero.entregados + resumen.marzo.entregados;
  const totalDev = resumen.enero.devoluciones + resumen.febrero.devoluciones + resumen.marzo.devoluciones;

  const pctMov = parseFloat(((totalMov / totalIng) * 100).toFixed(1));
  const pctEnt = parseFloat(((totalEnt / totalMov) * 100).toFixed(1));
  const pctDev = parseFloat(((totalDev / totalMov) * 100).toFixed(1));
  const pctExito = parseFloat((((totalEnt) / totalIng) * 100).toFixed(1));

  const metrics = [
    { label: "Movilización", value: pctMov, color: "#F97316", desc: "Ingresadas → Movilizadas" },
    { label: "Entrega", value: pctEnt, color: "#10B981", desc: "Movilizadas → Entregadas" },
    { label: "Éxito Total", value: pctExito, color: "#3B82F6", desc: "Ingresadas → Entregadas" },
    { label: "Devolución", value: pctDev, color: "#EF4444", desc: "Movilizadas → Devueltas" },
  ];

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Eficiencia Operativa Q1</h2>
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
                <RadialBar
                  background={{ fill: "#2a2a4a" }}
                  dataKey="value"
                  angleAxisId={0}
                  cornerRadius={10}
                />
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
  );
}
