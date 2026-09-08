"use client";

interface KPICardsProps {
  ingresadas: number;
  movilizadas: number;
  entregados: number;
  devoluciones: number;
  periodo: string;
}

export default function KPICards(props: KPICardsProps) {
  // Coacción defensiva: si algún valor llega undefined/null/NaN, se usa 0 en vez de
  // reventar el .toLocaleString() (que dejaba el cuadro principal en blanco).
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const ingresadas = num(props.ingresadas);
  const movilizadas = num(props.movilizadas);
  const entregados = num(props.entregados);
  const devoluciones = num(props.devoluciones);
  const periodo = props.periodo || "";
  const pctMovilizacion = ingresadas > 0 ? ((movilizadas / ingresadas) * 100).toFixed(1) : "0";
  const pctEntrega = movilizadas > 0 ? ((entregados / movilizadas) * 100).toFixed(1) : "0";
  const pctDevolucion = movilizadas > 0 ? ((devoluciones / movilizadas) * 100).toFixed(1) : "0";

  // En meses en planificación (Mayo en curso) el valor de "movilizadas" representa
  // la META del mes, no datos reales. Renombramos y resaltamos la tarjeta.
  const mesActual = periodo.split(" ")[0]; // "Mayo 2026" → "Mayo"
  const isPlanning = /^(Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)$/i.test(mesActual);
  const movTitle = isPlanning ? `Meta de ${mesActual}` : "Órdenes Movilizadas";
  const movSubtitle = isPlanning ? `Objetivo del mes (${pctMovilizacion}% sobre ingresadas)` : `${pctMovilizacion}% de ingresadas`;

  const cards = [
    {
      title: "Órdenes Ingresadas",
      value: ingresadas.toLocaleString(),
      subtitle: `${pctMovilizacion}% se movilizaron`,
      icon: "📦",
      borderColor: "border-orange-500/30",
      textColor: "text-orange-400",
      highlight: false,
    },
    {
      title: movTitle,
      value: movilizadas.toLocaleString(),
      subtitle: movSubtitle,
      icon: isPlanning ? "🎯" : "🚚",
      borderColor: isPlanning ? "border-orange-500" : "border-blue-500/30",
      textColor: isPlanning ? "text-orange-400" : "text-blue-400",
      highlight: isPlanning,
    },
    {
      title: "Entregados",
      value: entregados.toLocaleString(),
      subtitle: `${pctEntrega}% tasa de entrega`,
      icon: "✅",
      borderColor: "border-green-500/30",
      textColor: "text-green-400",
      highlight: false,
    },
    {
      title: "Devoluciones",
      value: devoluciones.toLocaleString(),
      subtitle: `${pctDevolucion}% tasa devolución`,
      icon: "↩️",
      borderColor: "border-red-500/30",
      textColor: "text-red-400",
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`relative overflow-hidden rounded-2xl border-2 ${card.borderColor} p-5 transition-all hover:scale-[1.02] ${
            card.highlight ? "ring-2 ring-orange-500/60 shadow-lg shadow-orange-500/20" : ""
          }`}
          style={{
            background: card.highlight
              ? "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(234,88,12,0.08))"
              : "var(--bg-card)",
          }}
        >
          {card.highlight && (
            <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">
              Meta
            </span>
          )}
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
