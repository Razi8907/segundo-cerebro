"use client";

interface KPICardsProps {
  ingresadas: number;
  movilizadas: number;
  entregados: number;
  devoluciones: number;
  periodo: string;
}

export default function KPICards({ ingresadas, movilizadas, entregados, devoluciones, periodo }: KPICardsProps) {
  const pctMovilizacion = ((movilizadas / ingresadas) * 100).toFixed(1);
  const pctEntrega = ((entregados / movilizadas) * 100).toFixed(1);
  const pctDevolucion = ((devoluciones / movilizadas) * 100).toFixed(1);

  const cards = [
    {
      title: "Órdenes Ingresadas",
      value: ingresadas.toLocaleString(),
      subtitle: `${pctMovilizacion}% se movilizaron`,
      icon: "📦",
      borderColor: "border-orange-500/30",
      textColor: "text-orange-400",
    },
    {
      title: "Órdenes Movilizadas",
      value: movilizadas.toLocaleString(),
      subtitle: `${pctMovilizacion}% de ingresadas`,
      icon: "🚚",
      borderColor: "border-blue-500/30",
      textColor: "text-blue-400",
    },
    {
      title: "Entregados",
      value: entregados.toLocaleString(),
      subtitle: `${pctEntrega}% tasa de entrega`,
      icon: "✅",
      borderColor: "border-green-500/30",
      textColor: "text-green-400",
    },
    {
      title: "Devoluciones",
      value: devoluciones.toLocaleString(),
      subtitle: `${pctDevolucion}% tasa devolución`,
      icon: "↩️",
      borderColor: "border-red-500/30",
      textColor: "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`relative overflow-hidden rounded-2xl border ${card.borderColor} p-5 transition-all hover:scale-[1.02]`}
          style={{ background: "var(--bg-card)" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{card.title}</p>
              <p className={`text-3xl font-bold mt-2 ${card.textColor}`}>{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
            </div>
            <span className="text-2xl">{card.icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
