"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Paleta consistente con el HTML ejecutivo ───
const C = {
  orange: "#E8650A",
  orangeLt: "#FAEEDA",
  green: "#3B6D11",
  greenLt: "#EAF3DE",
  red: "#A32D2D",
  amber: "#BA7517",
  amberLt: "#FAEEDA",
  info: "#185FA5",
  infoLt: "#E3F0FA",
  gray: "#888780",
  yellow: "#F4C06B",
  lime: "#97C459",
  purple: "#7F77DD",
  blueLt: "#B5D4F4",
};

// ═══════════════════════════════════════════════════════════════════
// DATOS — del informe ejecutivo Q1 2026 + cierre 2025
// ═══════════════════════════════════════════════════════════════════
const DATA = {
  cierre: {
    kpis: [
      { label: "Ingresos 2025 (cierre)", value: "Gs 7.778,3M", sub: "+581% vs 2024", tone: "up" as const },
      { label: "Ingresos Q1 2026", value: "Gs 2.180,1M", sub: "28% del total 2025 en 3 meses", tone: "up" as const },
      { label: "Margen bruto 2025", value: "20,7%", sub: "Cierre anual", tone: "neu" as const },
      { label: "Margen bruto Q1 2026", value: "23,2%", sub: "▲ +2,5pp", tone: "up" as const },
      { label: "Resultado neto 2025", value: "-Gs 17,0M", sub: "Por dif. cambio Gs 57,7M", tone: "dn" as const },
      { label: "Resultado Feb 2026", value: "+Gs 210,9M", sub: "Recuperación", tone: "up" as const },
    ],
    ingAnio: [
      { mes: "2024 anual", value: 1142.0, color: C.gray },
      { mes: "2025 anual", value: 7778.3, color: C.yellow },
      { mes: "Q1 2026", value: 2180.1, color: C.orange },
    ],
    mbAnio: [
      { mes: "2024", value: 18.0, color: C.gray },
      { mes: "2025", value: 20.7, color: C.yellow },
      { mes: "Q1 2026", value: 23.2, color: C.green },
    ],
    indicadores: [
      { indicador: "Ingresos operativos", v24: "Gs 1.142,0M", v25: "Gs 7.778,3M", q1: "Gs 2.180,1M", tendencia: "▲ Crecimiento sostenido" },
      { indicador: "Costo de servicios", v24: "Gs 936,7M", v25: "Gs 6.168,3M", q1: "Gs 1.674,4M", tendencia: "▲ Proporcional" },
      { indicador: "Utilidad bruta", v24: "Gs 205,3M", v25: "Gs 1.610,0M", q1: "Gs 505,7M", tendencia: "▲ +28% vs Q1 estimado 2025" },
      { indicador: "Margen bruto %", v24: "18,0%", v25: "20,7%", q1: "23,2%", tendencia: "▲ +2,5pp" },
      { indicador: "Gastos operativos", v24: "Gs 332,5M", v25: "Gs 1.586,2M", q1: "~Gs 166,4M", tendencia: "▲ Mejor eficiencia" },
      { indicador: "EBIT (utilidad operativa)", v24: "-Gs 1,5M", v25: "Gs 40,6M", q1: "~Gs 339,3M", tendencia: "▲ Salto fuerte" },
      { indicador: "Gastos financieros (dif. cambio)", v24: "-Gs 10,9M", v25: "-Gs 57,7M", q1: "Por confirmar", tendencia: "Variable", neutral: true },
      { indicador: "Resultado neto del ejercicio", v24: "-Gs 12,4M", v25: "-Gs 17,0M", q1: "+Gs 210,9M (solo Feb)", tendencia: "▲ Recuperación", highlight: true },
      { indicador: "Liquidez corriente", v24: "2,06x", v25: "1,06x", q1: "1,08x", tendencia: "Saludable" },
      { indicador: "Volumen entregado mensual", v24: "Variable", v25: "Variable", q1: "~20.389 guías", tendencia: "Sostenido" },
    ],
  },
  overview: {
    kpis: [
      { label: "Total ingresos Q1", value: "Gs 2.180,1M", sub: "61.166 guías", tone: "up" as const },
      { label: "Total costos Q1", value: "Gs 1.674,4M", sub: "76,8% del ingreso", tone: "neu" as const },
      { label: "Utilidad bruta Q1", value: "Gs 505,7M", sub: "23,20% margen", tone: "up" as const },
      { label: "OPEX fijo Q1", value: "~Gs 166,4M", sub: "7,63% del ingreso", tone: "neu" as const },
      { label: "Fulfillment Q1", value: "Gs 38,2M", sub: "1,75% del ingreso", tone: "neu" as const },
      { label: "Utilidad neta estimada Q1", value: "~Gs 301,1M", sub: "13,8% margen", tone: "up" as const },
    ],
    mensual: [
      { mes: "Enero", guias: 20192, ingresos: 725.2, costos: 589.9, util: 135.4, margen: 18.67, utilGuia: 6705 },
      { mes: "Febrero", guias: 19237, ingresos: 679.2, costos: 520.8, util: 158.4, margen: 23.33, utilGuia: 8236 },
      { mes: "Marzo", guias: 21737, ingresos: 775.7, costos: 563.8, util: 211.9, margen: 27.32, utilGuia: 9748 },
      { mes: "Q1 TOTAL", guias: 61166, ingresos: 2180.1, costos: 1674.4, util: 505.7, margen: 23.2, utilGuia: 8268, total: true },
    ],
    composicion: [
      { name: "Costo logístico", value: 76.8, color: C.orange },
      { name: "OPEX fijo", value: 7.63, color: C.yellow },
      { name: "Fulfillment", value: 1.75, color: C.lime },
      { name: "Margen neto", value: 13.82, color: C.green },
    ],
    guiasMargen: [
      { mes: "Enero", guias: 20192, margen: 18.67 },
      { mes: "Febrero", guias: 19237, margen: 23.33 },
      { mes: "Marzo", guias: 21737, margen: 27.32 },
    ],
  },
  fulfillment: {
    kpis: [
      { label: "Costo total Fulfillment Q1", value: "Gs 38,2M", sub: "1,75% del ingreso", tone: "up" as const },
      { label: "Personal Fulfillment", value: "Gs 18,6M", sub: "Q1 acumulado", tone: "neu" as const },
      { label: "Materiales Fulfillment", value: "Gs 19,6M", sub: "Q1 acumulado", tone: "neu" as const },
      { label: "Tendencia mensual", value: "↓ Bajando", sub: "2,62% → 1,16%", tone: "up" as const },
    ],
    detalle: [
      { concepto: "Personal (2 personas)", ene: "Gs 6,2M", feb: "Gs 6,2M", mar: "Gs 6,2M", total: "Gs 18,6M", pct: "0,85%" },
      { concepto: "Bolsas de seguridad", ene: "Gs 1,9M", feb: "Gs 1,2M", mar: "Gs 1,9M", total: "Gs 5,0M", pct: "0,23%" },
      { concepto: "Cajas de cartón", ene: "—", feb: "Gs 1,1M", mar: "Gs 1,1M", total: "Gs 2,3M", pct: "0,10%" },
      { concepto: "Rollos / cinta", ene: "Gs 4,3M", feb: "Gs 0,7M", mar: "—", total: "Gs 5,0M", pct: "0,23%" },
      { concepto: "Equipamiento (scanner Zebra)", ene: "Gs 6,3M", feb: "—", mar: "—", total: "Gs 6,3M", pct: "0,29%" },
      { concepto: "Uniformes", ene: "Gs 0,4M", feb: "—", mar: "—", total: "Gs 0,4M", pct: "0,02%" },
      { concepto: "Subtotal materiales", ene: "Gs 12,8M", feb: "Gs 3,0M", mar: "Gs 3,0M", total: "Gs 19,0M", pct: "0,87%", subtotal: true },
      { concepto: "TOTAL FULFILLMENT", ene: "Gs 19,0M", feb: "Gs 9,2M", mar: "Gs 9,2M", total: "Gs 37,6M", pct: "1,72%", isTotal: true },
    ],
    pctIngresos: [
      { mes: "Enero", personal: 0.85, materiales: 1.77 },
      { mes: "Febrero", personal: 0.91, materiales: 0.55 },
      { mes: "Marzo", personal: 0.80, materiales: 0.39 },
    ],
    tools: [
      { concepto: "Líneas (AMX)", ene: "Gs 0,36M", feb: "Gs 0,46M", mar: "Gs 0,46M" },
      { concepto: "Internet (Núcleo)", ene: "Gs 0,18M", feb: "Gs 0,18M", mar: "Gs 0,18M" },
      { concepto: "Pasarela (Grupo M)", ene: "Gs 0,20M", feb: "Gs 0,20M", mar: "Gs 0,20M" },
      { concepto: "Total tools", ene: "Gs 0,74M", feb: "Gs 0,84M", mar: "Gs 0,84M", subtotal: true },
      { concepto: "% sobre ingresos", ene: "0,10%", feb: "0,12%", mar: "0,11%" },
    ],
  },
  margen: {
    kpis: [
      { label: "Margen bruto enero", value: "18,67%", sub: "Gs 135,4M utilidad", tone: "neu" as const },
      { label: "Margen bruto febrero", value: "23,33%", sub: "▲ +4,66pp · Gs 158,4M", tone: "up" as const },
      { label: "Margen bruto marzo", value: "27,32%", sub: "▲ +3,99pp · Gs 211,9M", tone: "up" as const },
      { label: "Margen neto Ene*", value: "~16,8%", sub: "Tras OPEX", tone: "neu" as const },
      { label: "Margen neto Feb*", value: "~21,9%", sub: "Confirmado Gs 210,9M", tone: "up" as const },
      { label: "Margen neto Mar*", value: "~23,5%", sub: "Mejor del Q1", tone: "up" as const },
    ],
    cascada: [
      { concepto: "Ingresos operativos", ene: "Gs 725,2M", feb: "Gs 679,2M", mar: "Gs 775,7M", q1: "Gs 2.180,1M", pct: "100,0%", header: true },
      { concepto: "(-) Costo de servicios", ene: "-Gs 589,9M", feb: "-Gs 520,8M", mar: "-Gs 563,8M", q1: "-Gs 1.674,4M", pct: "-76,8%", neg: true },
      { concepto: "Utilidad bruta", ene: "Gs 135,4M", feb: "Gs 158,4M", mar: "Gs 211,9M", q1: "Gs 505,7M", pct: "23,2%", subtotal: true },
      { concepto: "(-) Gastos de ventas", ene: "~-Gs 13,7M", feb: "-Gs 11,9M", mar: "~-Gs 14,5M", q1: "~-Gs 40,1M", pct: "-1,84%", neg: true },
      { concepto: "(-) Gastos administración", ene: "~-Gs 41,5M", feb: "-Gs 43,4M", mar: "~-Gs 41,4M", q1: "~-Gs 126,3M", pct: "-5,79%", neg: true },
      { concepto: "EBIT (utilidad operativa)", ene: "Gs 80,2M", feb: "Gs 103,1M", mar: "Gs 156,0M", q1: "Gs 339,3M", pct: "15,6%", subtotal: true, pos: true },
      { concepto: "(-) Gastos financieros", ene: "Por confirmar", feb: "Mínimo", mar: "Mínimo", q1: "~Gs 0–10M", pct: "~0%", neutral: true },
      { concepto: "Resultado neto estimado", ene: "~Gs 80,2M", feb: "Gs 210,9M*", mar: "~Gs 156,0M", q1: "~Gs 301,1M", pct: "~13,8%", total: true, pos: true },
    ],
    opex: [
      { mes: "Enero", value: 5.27 },
      { mes: "Febrero", value: 5.39 },
      { mes: "Marzo", value: 3.97 },
    ],
    transportadora: [
      { mes: "Feb", AEX: 18.52, FIXY: 31.16, "FIXY-NEXTDAY": 31.50 },
      { mes: "Mar", AEX: 25.63, FIXY: 31.10, "FIXY-NEXTDAY": 29.34 },
    ],
  },
  aex: {
    kpis: [
      { label: "Pendiente AEX (15 abr)", value: "Gs 2.304M", sub: "≈ ingreso de 3 meses", tone: "dn" as const },
      { label: "Pendiente actualizado (20 abr)", value: "Gs 2.177M", sub: "11.592 guías", tone: "dn" as const },
      { label: "De marzo (antiguo)", value: "Gs 1.497M", sub: "7.526 guías", tone: "dn" as const },
      { label: "De abril (reciente)", value: "Gs 777M", sub: "4.066 guías", tone: "neu" as const },
      { label: "FIXY pendiente", value: "Gs 3,0M", sub: "Paga puntual", tone: "up" as const },
      { label: "Brecha caja real Q1", value: "~5,7pp margen", sub: "Contable vs caja", tone: "dn" as const },
    ],
    pendiente: [
      { antiguedad: "+2 semanas (marzo)", guias: "7.526", monto: "Gs 1.497M", pct: "66,3%", equiv: "1,94x ingreso febrero" },
      { antiguedad: "Reciente (abril)", guias: "4.066", monto: "Gs 777M", pct: "33,7%", equiv: "~1 mes ingreso" },
      { antiguedad: "TOTAL pendiente AEX", guias: "11.592", monto: "Gs 2.177M", pct: "100%", equiv: "3 meses operativos", total: true },
    ],
    devCobr: [
      { mes: "Enero", devengado: 725.2, cobrado: 718.0 },
      { mes: "Febrero", devengado: 679.2, cobrado: 665.0 },
      { mes: "Marzo", devengado: 775.7, cobrado: 275.7 },
    ],
    margenes: [
      { mes: "Enero", contable: 18.67, caja: 18.4 },
      { mes: "Febrero", contable: 23.33, caja: 22.7 },
      { mes: "Marzo", contable: 27.32, caja: 11.8, alerta: true },
    ],
  },
  viajes: {
    kpis: [
      { label: "Total viajes operativos", value: "Gs 1,47M", sub: "Enero CDE", tone: "neu" as const },
      { label: "Viáticos vendedores", value: "Gs 0,80M", sub: "Q1 acumulado", tone: "neu" as const },
      { label: "Movilidad administrativa", value: "Gs 0,83M", sub: "Q1 acumulado", tone: "neu" as const },
      { label: "Total viajes Q1", value: "Gs 2,91M", sub: "0,13% del ingreso", tone: "up" as const },
    ],
    detalle: [
      { concepto: "Hotel Sur Brasil — hospedaje CDE", tipo: "Operativo", mes: "Enero", monto: "Gs 500.000" },
      { concepto: "NSA S.A. — pasajes a CDE", tipo: "Operativo", mes: "Enero", monto: "Gs 450.000" },
      { concepto: "Viático equipo Operaciones", tipo: "Operativo", mes: "Enero", monto: "Gs 520.000" },
      { concepto: "Megale Group — alojamiento viaje comercial", tipo: "Comercial", mes: "Febrero", monto: "Sin monto", badge: true },
      { concepto: "Movilidad / viáticos administrativos", tipo: "Admin", mes: "Q1", monto: "Gs 830.227" },
      { concepto: "TOTAL Q1 IDENTIFICADO", tipo: "", mes: "", monto: "Gs 2.300.227", total: true },
    ],
    correlacion: [
      { mes: "Enero", margen: 18.67, viajes: 1.47 },
      { mes: "Febrero", margen: 23.33, viajes: 0.31 },
      { mes: "Marzo", margen: 27.32, viajes: 0 },
    ],
  },
  trans: {
    kpis: [
      { label: "Concentración AEX actual", value: "39,1%", sub: "23.924 / 61.166 guías", tone: "dn" as const },
      { label: "Margen AEX promedio", value: "22,1%", sub: "El más bajo", tone: "dn" as const },
      { label: "Margen FIXY", value: "31,1%", sub: "El mejor", tone: "up" as const },
      { label: "Margen FIXY-NEXTDAY", value: "30,3%", sub: "Muy bueno", tone: "up" as const },
    ],
    perf: [
      { trans: "AEX", guias: "23.924", ingresos: "Gs 869,6M", utilidad: "Gs 192,5M", margen: 22.1, pendiente: "Gs 2.177M", pendienteTone: "dn" as const },
      { trans: "FIXY", guias: "2.028", ingresos: "Gs 68,9M", utilidad: "Gs 21,4M", margen: 31.1, pendiente: "Gs 3,0M", pendienteTone: "up" as const },
      { trans: "FIXY-NEXTDAY", guias: "15.022", ingresos: "Gs 516,4M", utilidad: "Gs 156,3M", margen: 30.3, pendiente: "Mínimo", pendienteTone: "up" as const },
      { trans: "TOTAL", guias: "61.166", ingresos: "Gs 2.180,1M", utilidad: "Gs 505,7M", margen: 23.2, pendiente: "Gs 2.180M", pendienteTone: "neu" as const, total: true },
    ],
    actual: [
      { name: "AEX", value: 39.1, color: C.orange },
      { name: "FIXY", value: 3.3, color: C.lime },
      { name: "FIXY-NEXTDAY", value: 24.6, color: C.info },
      { name: "Otros canales", value: 33.0, color: C.gray },
    ],
    propuesta: [
      { name: "AEX", value: 25, color: C.orange },
      { name: "FIXY", value: 15, color: C.lime },
      { name: "FIXY-NEXTDAY", value: 25, color: C.info },
      { name: "Nueva", value: 25, color: C.purple },
      { name: "Otros", value: 10, color: C.gray },
    ],
    beneficios: [
      { concepto: "Mejora margen Q2 esperado", valor: "+4,20pp", detalle: "23,20% → ~27,40%" },
      { concepto: "Utilidad operativa adicional Q2", valor: "+Gs 91,6M", detalle: "Sobre ingreso actual" },
      { concepto: "Reducción pendiente cobro", valor: "-37,5%", detalle: "Gs 2.177M → ~Gs 1.360M" },
      { concepto: "Días de cobro promedio", valor: "~14 días", detalle: "Hoy: ~30+ con AEX" },
      { concepto: "Poder de negociación tarifa", valor: "+5–8%", detalle: "Competencia entre operadores" },
      { concepto: "Continuidad operativa", valor: "Alta", detalle: "Si una falla, otras cubren" },
      { concepto: "Impacto neto trimestral estimado", valor: "+Gs 91,6M", detalle: "Solo Q2 — anualizado +Gs 366M", total: true },
    ],
  },
};

type TabKey = "cierre" | "overview" | "fulfillment" | "margen" | "aex" | "viajes" | "trans";

export default function FinanzasDashboardPY_Q1() {
  const [tab, setTab] = useState<TabKey>("cierre");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "cierre", label: "📊 2025 vs 2026" },
    { key: "overview", label: "🧭 Resumen Q1" },
    { key: "fulfillment", label: "📦 Fulfillment" },
    { key: "margen", label: "💹 Márgenes" },
    { key: "aex", label: "⚠ Impacto AEX" },
    { key: "viajes", label: "✈ Viajes" },
    { key: "trans", label: "🚚 Transportadora" },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold t-primary flex items-center gap-2">
              DROPI E.A.S. — Informe Gerencial Q1 2026
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.orange, color: "white" }}>EJECUTIVO</span>
            </h2>
            <p className="text-xs t-muted mt-1">RUC 80141637-0 · Cierre 2025 · Q1 2026 · Proyección Q2 2026 · Cifras en guaraníes (Gs)</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                tab === t.key
                  ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                  : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "cierre" && <CierreView />}
      {tab === "overview" && <OverviewView />}
      {tab === "fulfillment" && <FulfillmentView />}
      {tab === "margen" && <MargenView />}
      {tab === "aex" && <AexView />}
      {tab === "viajes" && <ViajesView />}
      {tab === "trans" && <TransView />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
type Tone = "up" | "dn" | "neu";

function KpiGrid({ kpis }: { kpis: { label: string; value: string; sub: string; tone: Tone }[] }) {
  const colorMap: Record<Tone, string> = { up: C.green, dn: C.red, neu: C.gray };
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
      {kpis.map((k) => (
        <div key={k.label} className="glass-card p-3">
          <p className="text-[11px] t-muted mb-1">{k.label}</p>
          <p className="font-mono text-base font-semibold t-primary">{k.value}</p>
          <p className="text-[10px] mt-1" style={{ color: colorMap[k.tone] }}>{k.sub}</p>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold t-secondary uppercase tracking-wider mb-3">{children}</p>;
}

function Alert({ tone, children }: { tone: "pos" | "warn" | "dn" | "info"; children: React.ReactNode }) {
  const map = {
    pos: { bg: C.greenLt, border: C.green, text: "#27500A" },
    warn: { bg: C.orangeLt, border: C.amber, text: "#633806" },
    dn: { bg: "#FCEBEB", border: C.red, text: "#791F1F" },
    info: { bg: C.infoLt, border: C.info, text: "#0F3B66" },
  };
  const m = map[tone];
  return (
    <div className="rounded-lg px-4 py-3 text-xs leading-relaxed mt-3" style={{ background: m.bg, borderLeft: `3px solid ${m.border}`, color: m.text }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════
function CierreView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.cierre.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Comparativo de ingresos 2024 → 2025 → Q1 2026 (Gs M)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA.cierre.ingAnio}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => `Gs ${v}M`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v) => `Gs ${v}M`} />
              <Bar dataKey="value">
                {DATA.cierre.ingAnio.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Evolución del margen bruto (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA.cierre.mbAnio}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} domain={[0, 28]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Bar dataKey="value">
                {DATA.cierre.mbAnio.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-4">
        <SectionTitle>Cierre 2025 vs Q1 2026 — indicadores clave</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Indicador</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">2024</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">2025 (cierre)</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Q1 2026</th>
                <th className="py-2 px-3 text-left text-[11px] t-muted">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {DATA.cierre.indicadores.map((r) => (
                <tr key={r.indicador} className="border-b border-gray-800/50" style={r.highlight ? { background: "rgba(232,101,10,0.05)", fontWeight: 600 } : {}}>
                  <td className="py-2 px-3 t-primary">{r.indicador}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.v24}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.v25}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs t-primary font-semibold">{r.q1}</td>
                  <td className="py-2 px-3 text-xs" style={{ color: r.neutral ? C.gray : C.green }}>{r.tendencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Alert tone="pos">
        <strong>Lectura del cierre:</strong> 2025 cerró con resultado contable negativo de Gs 17,0M, pero la causa fue exclusivamente la diferencia de cambio (Gs 57,7M). El EBIT operativo fue positivo en Gs 40,6M — el negocio operativo es rentable. Q1 2026 confirma esta tendencia: solo en febrero generamos Gs 210,9M de utilidad neta, más de lo que perdimos en todo 2025.
      </Alert>
    </div>
  );
}

function OverviewView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.overview.kpis} />

      <div className="glass-card p-4">
        <SectionTitle>Performance mensual Q1-2026</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Mes</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Guías</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Ingresos</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Costos</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Utilidad bruta</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Margen %</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Util/guía</th>
              </tr>
            </thead>
            <tbody>
              {DATA.overview.mensual.map((r) => (
                <tr key={r.mes} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,101,10,0.08)", fontWeight: 700 } : {}}>
                  <td className="py-2 px-3 t-primary">{r.mes}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.guias.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">Gs {r.ingresos.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">Gs {r.costos.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">Gs {r.util.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M</td>
                  <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: C.green }}>{r.margen}%</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">Gs {r.utilGuia.toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Composición de costos Q1 (% sobre ingresos)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={DATA.overview.composicion} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={(e) => `${e.name}: ${e.value}%`}>
                {DATA.overview.composicion.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Volumen entregado vs margen operativo</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={DATA.overview.guiasMargen}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis yAxisId="left" stroke="#888" fontSize={10} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={10} domain={[10, 32]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="guias" name="Guías" fill={C.blueLt} />
              <Line yAxisId="right" type="monotone" dataKey="margen" name="Margen %" stroke={C.orange} strokeWidth={2} dot={{ fill: C.orange, r: 5 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function FulfillmentView() {
  return (
    <div className="space-y-4">
      <Alert tone="info">
        <strong>Importante:</strong> El área de Fulfillment <strong>no factura ingresos propios actualmente</strong>. Es un centro de costo que apoya la operación logística general. Los costos mostrados representan inversión en personal y materiales.
      </Alert>

      <KpiGrid kpis={DATA.fulfillment.kpis} />

      <div className="glass-card p-4">
        <SectionTitle>Detalle costos Fulfillment Q1-2026</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Concepto</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Enero</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Febrero</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Marzo</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Total Q1</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">% Q1 ingresos</th>
              </tr>
            </thead>
            <tbody>
              {DATA.fulfillment.detalle.map((r: any) => (
                <tr key={r.concepto} className="border-b border-gray-800/50" style={r.isTotal ? { background: "rgba(232,101,10,0.08)", fontWeight: 700 } : r.subtotal ? { background: "rgba(255,255,255,0.03)", fontWeight: 600 } : {}}>
                  <td className="py-2 px-3 t-primary">{r.concepto}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.ene}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.feb}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.mar}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs t-primary">{r.total}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] t-muted mt-2">El gasto de enero fue elevado por la inversión única en scanner Zebra (Gs 6,3M). Sin ese ítem, el costo recurrente mensual es ~Gs 9,2M.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Costo Fulfillment como % de ingresos</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA.fulfillment.pctIngresos}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="personal" name="Personal" stackId="a" fill={C.orange} />
              <Bar dataKey="materiales" name="Materiales" stackId="a" fill={C.yellow} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Herramientas operativas (tools) — Gs M y % por mes</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Concepto</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Ene</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Feb</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Mar</th>
                </tr>
              </thead>
              <tbody>
                {DATA.fulfillment.tools.map((r: any) => (
                  <tr key={r.concepto} className="border-b border-gray-800/50" style={r.subtotal ? { background: "rgba(255,255,255,0.03)", fontWeight: 600 } : {}}>
                    <td className="py-2 px-3 t-primary text-xs">{r.concepto}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.ene}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.feb}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.mar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Alert tone="pos">
        Las herramientas operativas representan <strong>menos del 0,13% de ingresos</strong> mensuales — eficiencia muy alta. La estructura tecnológica está dimensionada correctamente para el volumen actual.
      </Alert>
    </div>
  );
}

function MargenView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.margen.kpis} />

      <div className="glass-card p-4">
        <SectionTitle>Cascada P&amp;L Q1-2026 (en Gs M)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Concepto</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Enero</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Febrero</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Marzo</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Q1 Total</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">% Q1</th>
              </tr>
            </thead>
            <tbody>
              {DATA.margen.cascada.map((r: any) => {
                const styles = r.total
                  ? { background: "rgba(232,101,10,0.10)", fontWeight: 700 }
                  : r.subtotal
                  ? { background: "rgba(255,255,255,0.04)", fontWeight: 600 }
                  : r.header
                  ? { fontWeight: 600 }
                  : {};
                const valColor = r.pos ? C.green : r.neg ? C.red : r.neutral ? C.gray : undefined;
                return (
                  <tr key={r.concepto} className="border-b border-gray-800/50" style={styles}>
                    <td className="py-2 px-3 t-primary">{r.concepto}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: valColor }}>{r.ene}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: valColor }}>{r.feb}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: valColor }}>{r.mar}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: valColor }}>{r.q1}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.pct}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] t-muted mt-2">* Febrero 2026 confirmado por estado contable: utilidad neta Gs 210,9M.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>OPEX fijo como % de ingresos</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={DATA.margen.opex}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} domain={[0, 8]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="value" stroke={C.orange} strokeWidth={2} dot={{ fill: C.orange, r: 5 }} fill="rgba(232,101,10,0.08)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Margen por transportadora (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={DATA.margen.transportadora}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} domain={[0, 40]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="AEX" fill={C.orange} />
              <Bar dataKey="FIXY" fill={C.lime} />
              <Bar dataKey="FIXY-NEXTDAY" fill={C.info} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function AexView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.aex.kpis} />

      <div className="glass-card p-4">
        <SectionTitle>Pendiente AEX por antigüedad</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Antigüedad</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Guías</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Monto pendiente</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">% del total</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Equivalente</th>
              </tr>
            </thead>
            <tbody>
              {DATA.aex.pendiente.map((r: any) => (
                <tr key={r.antiguedad} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,101,10,0.10)", fontWeight: 700 } : {}}>
                  <td className="py-2 px-3 t-primary">{r.antiguedad}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.guias}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: C.red }}>{r.monto}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.pct}</td>
                  <td className="py-2 px-3 text-right text-xs t-secondary">{r.equiv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Ingresos devengados vs cobrados estimados (Gs M)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA.aex.devCobr}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => `Gs ${v}M`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v) => `Gs ${v}M`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="devengado" name="Devengado (contable)" fill={C.orange} />
              <Bar dataKey="cobrado" name="Cobrado est." fill={C.lime} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Margen contable vs margen de caja real</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Mes</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Contable</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Caja real</th>
              </tr>
            </thead>
            <tbody>
              {DATA.aex.margenes.map((r) => (
                <tr key={r.mes} className="border-b border-gray-800/50">
                  <td className="py-2 px-3 t-primary">{r.mes}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: C.green }}>{r.contable}%</td>
                  <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.alerta ? C.red : C.green }}>~{r.caja}% {r.alerta ? "⚠" : ""}</td>
                </tr>
              ))}
              <tr style={{ background: "rgba(232,101,10,0.08)", fontWeight: 700 }}>
                <td className="py-2 px-3 t-primary">Q1 promedio</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: C.green }}>23,20%</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: C.red }}>~17,5%</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] t-muted mt-2">Marzo: Gs 1.497M de AEX sin cobrar al 15/abr. El negocio es rentable contablemente pero la caja real está bajo presión.</p>
        </div>
      </div>

      <Alert tone="dn">
        <strong>Riesgo de flujo de caja:</strong> AEX concentra Gs 1.497M de pendiente de marzo (1,94x ingreso mensual). Si AEX demora más de 2 semanas, DROPI cubre OPEX, salarios y materiales con fondos propios. FIXY y FIXY-NEXTDAY pagan puntualmente — diversificar reduce la exposición.
      </Alert>
    </div>
  );
}

function ViajesView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.viajes.kpis} />

      <div className="glass-card p-4">
        <SectionTitle>Detalle de viajes Q1-2026</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Concepto</th>
                <th className="py-2 px-3 text-left text-[11px] t-muted">Tipo</th>
                <th className="py-2 px-3 text-left text-[11px] t-muted">Mes</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Monto</th>
              </tr>
            </thead>
            <tbody>
              {DATA.viajes.detalle.map((r: any, i) => (
                <tr key={i} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,101,10,0.10)", fontWeight: 700 } : {}}>
                  <td className="py-2 px-3 t-primary text-xs">{r.concepto}</td>
                  <td className="py-2 px-3 text-xs t-secondary">{r.tipo}</td>
                  <td className="py-2 px-3 text-xs t-secondary">{r.mes}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">
                    {r.badge ? <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: "#FCEBEB", color: C.red }}>{r.monto}</span> : r.monto}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Inversión en viajes vs evolución del margen</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA.viajes.correlacion}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis yAxisId="left" stroke="#888" fontSize={10} tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={10} domain={[0, 2]} tickFormatter={(v) => `${v.toFixed(1)}M`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="margen" name="Margen %" fill={C.info} />
              <Line yAxisId="right" type="monotone" dataKey="viajes" name="Viajes Gs M" stroke={C.orange} strokeWidth={2} dot={{ fill: C.orange, r: 5 }} fill="rgba(232,101,10,0.15)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Margen operativo después de viajes (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={DATA.viajes.correlacion}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} domain={[14, 30]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="margen" stroke={C.green} strokeWidth={2} dot={{ fill: C.green, r: 6 }} fill="rgba(59,109,17,0.10)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Alert tone="pos">
        <strong>ROI de viajes Q1:</strong> Por cada Gs 1 invertido en viajes (total Gs 2,9M) se generaron <strong>~Gs 73 adicionales en utilidad operativa</strong> trimestral (~Gs 211M). El viaje a Ciudad del Este en enero coincide con el inicio de un crecimiento sostenido del margen: 18,67% → 23,33% → 27,32%.
      </Alert>
    </div>
  );
}

function TransView() {
  return (
    <div className="space-y-4">
      <Alert tone="info">
        <strong>Escenario Q2 2026:</strong> Mantener AEX, FIXY y FIXY-NEXTDAY como están actualmente. <strong>Sumar una cuarta transportadora</strong> para reducir concentración con AEX y diversificar riesgo de cobro.
      </Alert>

      <KpiGrid kpis={DATA.trans.kpis} />

      <div className="glass-card p-4">
        <SectionTitle>Performance por transportadora Q1-2026</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Transportadora</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Guías Q1</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Ingresos</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Utilidad</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Margen %</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Pendiente cobro</th>
              </tr>
            </thead>
            <tbody>
              {DATA.trans.perf.map((r: any) => (
                <tr key={r.trans} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,101,10,0.10)", fontWeight: 700 } : {}}>
                  <td className="py-2 px-3 t-primary">{r.trans}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.guias}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.ingresos}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.utilidad}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.margen >= 30 ? C.green : C.red }}>{r.margen}%</td>
                  <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.pendienteTone === "dn" ? C.red : r.pendienteTone === "up" ? C.green : C.gray }}>{r.pendiente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-4">
        <SectionTitle>Distribución actual del volumen Q1</SectionTitle>
        <StackedBar data={DATA.trans.actual} />
        <div className="mt-4">
          <SectionTitle>Distribución propuesta Q2 — mantener actuales + 1 nueva</SectionTitle>
          <StackedBar data={DATA.trans.propuesta} />
        </div>
      </div>

      <div className="glass-card p-4">
        <SectionTitle>Beneficios financieros estimados — agregando una cuarta transportadora en Q2</SectionTitle>
        <table className="w-full text-sm">
          <tbody>
            {DATA.trans.beneficios.map((r: any) => (
              <tr key={r.concepto} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,101,10,0.10)", fontWeight: 700 } : {}}>
                <td className="py-2 px-3 t-primary">{r.concepto}</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: C.green }}>{r.valor}</td>
                <td className="py-2 px-3 text-xs t-secondary">{r.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Alert tone="pos">
        <strong>Recomendación gerencial:</strong> Sumar una cuarta transportadora en Q2 generaría <strong>+Gs 91,6M de utilidad operativa adicional</strong> en el trimestre (~Gs 366M anualizado), reduciría el pendiente de cobro en Gs 817M y aceleraría el ciclo de caja en ~16 días. El beneficio mayor no es solo el margen — es la dilución del riesgo financiero de concentrar 39% del volumen en un solo operador con problemas de pago.
      </Alert>
    </div>
  );
}

function StackedBar({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="flex w-full h-7 rounded-full overflow-hidden">
      {data.map((d) => (
        <div key={d.name} className="flex items-center justify-center text-[11px] text-white font-medium" style={{ width: `${d.value}%`, background: d.color }}>
          {d.value >= 8 ? `${d.name} ${d.value}%` : ""}
        </div>
      ))}
    </div>
  );
}
