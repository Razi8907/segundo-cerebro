"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  ComposedChart,
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

// ─── Paleta consistente con el HTML ejecutivo H1 2026 ───
const C = {
  orange: "#E8540A",
  orangeLt: "#FFF0E8",
  green: "#1A6640",
  greenLt: "#EDFBF3",
  red: "#A81A1A",
  redLt: "#FFF2F2",
  amber: "#C47A00",
  amberLt: "#FFF8ED",
  info: "#185FA5",
  infoLt: "#E3F0FA",
  gray: "#888780",
  yellow: "#F4C06B",
  lime: "#97C459",
  purple: "#7F77DD",
  blueLt: "#C8D8E8",
  navy: "#0F2D5E",
};

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];

// ═══════════════════════════════════════════════════════════════════
// DATOS — Informe ejecutivo H1 2026 (Ene–Jun · Junio provisional)
// ═══════════════════════════════════════════════════════════════════
const DATA = {
  resumen: {
    kpis: [
      { label: "📦 Guías H1", value: "164.894", sub: "+33% vs H1 2025 est.", tone: "up" as const },
      { label: "💰 Ingresos H1 (EERR)", value: "Gs 5.116M", sub: "Q1: 2.324M · Q2: 2.792M", tone: "up" as const },
      { label: "📤 Egresos H1", value: "Gs 4.641M", sub: "90,7% de los ingresos", tone: "neu" as const },
      { label: "📈 EBITDA H1", value: "Gs 476M", sub: "9,3% sobre ingresos", tone: "up" as const },
      { label: "📊 Margen Bruto H1", value: "21,8%", sub: "Q1: 21,4% → Q2: 22,1%", tone: "up" as const },
      { label: "⚡ Rentab. Flete (PBI)", value: "22,47%", sub: "Ene 14,4% → Jun 27,4%", tone: "up" as const },
    ],
    waterfall: [
      { label: "Ingresos", monto: "Gs 5.116M", pct: 100, pctLabel: "100%", color: C.blueLt, tone: "neu" as const },
      { label: "— Costo logístico", monto: "Gs 4.003M", pct: 78.2, pctLabel: "− 78,2%", color: C.orange, tone: "dn" as const },
      { label: "= Margen Bruto", monto: "Gs 1.114M", pct: 21.8, pctLabel: "21,8%", color: "#4A9A70", tone: "up" as const, strong: true },
      { label: "— Salarios + IPS", monto: "Gs 200M", pct: 3.9, pctLabel: "− 3,9%", color: "#909090", tone: "dn" as const },
      { label: "— Honorarios prof.", monto: "Gs 198M", pct: 3.9, pctLabel: "− 3,9%", color: C.amber, tone: "dn" as const },
      { label: "— Otros OPEX", monto: "Gs 240M", pct: 4.7, pctLabel: "− 4,7%", color: "#A0A0B0", tone: "dn" as const },
      { label: "= EBITDA", monto: "Gs 476M", pct: 9.3, pctLabel: "9,3%", color: C.green, tone: "up" as const, strong: true },
    ],
    ebitdaMensual: [
      { mes: "Ene", monto: -27.4, pct: -4.0 },
      { mes: "Feb", monto: 178.4, pct: 21.7 },
      { mes: "Mar", monto: 57.4, pct: 7.1 },
      { mes: "Abr", monto: 50.7, pct: 6.0 },
      { mes: "May", monto: 81.4, pct: 8.7 },
      { mes: "Jun", monto: 135.2, pct: 13.3 },
    ],
    q1q2: [
      { concepto: "Ingresos", q1: "Gs 2.324M", q2: "Gs 2.792M", varr: "+20,1%", tone: "up" as const },
      { concepto: "Costo logístico", q1: "Gs 1.826M", q2: "Gs 2.176M", varr: "+19,1%", tone: "dn" as const },
      { concepto: "Margen Bruto", q1: "Gs 498M · 21,4%", q2: "Gs 616M · 22,1%", varr: "+0,7 pp", tone: "up" as const, subtotal: true },
      { concepto: "OPEX total", q1: "Gs 289M · 12,5%", q2: "Gs 349M · 12,5%", varr: "0,0 pp", tone: "neu" as const },
      { concepto: "EBITDA", q1: "Gs 208M · 9,0%", q2: "Gs 267M · 9,6%", varr: "+0,6 pp ▲", tone: "up" as const, total: true },
    ],
    balance: [
      { label: "Activo Total (incluye wallets de terceros)", value: "Gs 9.581M", tone: "neu" as const },
      { label: "Fondos de dropshippers (se restan)", value: "− Gs 6.099M", tone: "dn" as const },
      { label: "Patrimonio Neto — valor real de Dropi", value: "Gs 769M", tone: "up" as const, highlight: true },
      { label: "Capital suscripto", value: "Gs 400M", tone: "neu" as const },
      { label: "Resultado del ejercicio acumulado", value: "Gs 340M", tone: "up" as const },
    ],
  },
  margenes: {
    kpis: [
      { label: "ROE", value: "61,9%", sub: "Rentabilidad del patrimonio", tone: "up" as const },
      { label: "Margen Bruto H1", value: "21,8%", sub: "Q1: 21,4% → Q2: 22,1%", tone: "up" as const },
      { label: "EBITDA H1", value: "9,3%", sub: "Q1: 9,0% → Q2: 9,6%", tone: "up" as const },
      { label: "Rentab. Op. Flete", value: "22,47%", sub: "Ene 14,4% → Jun 27,4%", tone: "up" as const },
      { label: "OPEX / Ingresos", value: "12,5%", sub: "Gastos operativos H1", tone: "neu" as const },
      { label: "Honorarios / Ingresos", value: "3,9%", sub: "Mayor gasto tras logística", tone: "neu" as const },
    ],
    rentFlete: [
      { mes: "Ene", value: 14.38 },
      { mes: "Feb", value: 20.85 },
      { mes: "Mar", value: 22.96 },
      { mes: "Abr", value: 23.65 },
      { mes: "May", value: 24.30 },
      { mes: "Jun", value: 27.42 },
    ],
    ebitdaLine: [
      { mes: "Ene", value: -4.0 },
      { mes: "Feb", value: 21.7 },
      { mes: "Mar", value: 7.1 },
      { mes: "Abr", value: 6.0 },
      { mes: "May", value: 8.7 },
      { mes: "Jun", value: 13.3 },
    ],
    opex: [
      { label: "Costo logístico (transportadoras)", pct: 78.2, color: C.orange, tone: "neu" as const },
      { label: "Honorarios profesionales", pct: 3.9, color: C.amber, tone: "warn" as const },
      { label: "Sueldos equipo comercial", pct: 2.2, color: "#909090", tone: "neu" as const },
      { label: "Sueldos equipo admin.", pct: 1.7, color: "#B0B0B0", tone: "neu" as const },
      { label: "Eventos / viajes / IT", pct: 2.1, color: "#C0C0C0", tone: "neu" as const },
      { label: "Otros OPEX", pct: 2.6, color: "#D0D0D0", tone: "neu" as const },
      { label: "EBITDA (lo que queda)", pct: 9.3, color: C.green, tone: "up" as const, strong: true },
    ],
    eerr: [
      { mes: "Enero", ingresos: "Gs 694M", mb: "11,6%", ebitda: "−Gs 27M", margen: "−4,0%", neg: true },
      { mes: "Febrero", ingresos: "Gs 823M", mb: "32,3%", ebitda: "+Gs 178M", margen: "21,7%", pos: true },
      { mes: "Marzo", ingresos: "Gs 806M", mb: "18,7%", ebitda: "+Gs 57M", margen: "7,1%" },
      { mes: "Q1 Total", ingresos: "Gs 2.324M", mb: "21,4%", ebitda: "+Gs 208M", margen: "9,0%", subtotal: true },
      { mes: "Abril", ingresos: "Gs 843M", mb: "16,7%", ebitda: "+Gs 51M", margen: "6,0%" },
      { mes: "Mayo", ingresos: "Gs 934M", mb: "21,1%", ebitda: "+Gs 81M", margen: "8,7%" },
      { mes: "Junio ⚡", ingresos: "Gs 1.016M", mb: "27,4%", ebitda: "+Gs 135M", margen: "13,3%", pos: true },
      { mes: "H1 Total", ingresos: "Gs 5.116M", mb: "21,8%", ebitda: "+Gs 476M", margen: "9,3%", total: true },
    ],
  },
  operativo: {
    kpis: [
      { label: "Total Guías H1", value: "164.894", sub: "Junio: 27.634", tone: "up" as const },
      { label: "Rentabilidad H1", value: "22,47%", sub: "Prom. mensual Power BI", tone: "up" as const },
      { label: "Revenue H1 (PBI)", value: "Gs 5.777M", sub: "Flete cobrado a dropshippers", tone: "neu" as const },
      { label: "Utilidad Flete H1", value: "Gs 1.298M", sub: "Gs 7.872 por guía prom.", tone: "up" as const },
      { label: "Flete promedio Dropi", value: "Gs 35.033", sub: "Por guía entregada", tone: "neu" as const },
      { label: "Dropshippers activos", value: "5.263", sub: "+300% vs enero 2026", tone: "up" as const },
    ],
    guias: [
      { mes: "Ene", guias: 26224, rentab: 14.38 },
      { mes: "Feb", guias: 25959, rentab: 20.85 },
      { mes: "Mar", guias: 25643, rentab: 22.96 },
      { mes: "Abr", guias: 28441, rentab: 23.65 },
      { mes: "May", guias: 30993, rentab: 24.30 },
      { mes: "Jun", guias: 27634, rentab: 27.42 },
    ],
    pbi: [
      { mes: "Ene", ingreso: 892.3, costo: 764.0, utilidad: 128.3 },
      { mes: "Feb", ingreso: 877.1, costo: 694.2, utilidad: 182.9 },
      { mes: "Mar", ingreso: 895.5, costo: 689.9, utilidad: 205.6 },
      { mes: "Abr", ingreso: 1011.4, costo: 772.2, utilidad: 239.2 },
      { mes: "May", ingreso: 1084.6, costo: 821.0, utilidad: 263.6 },
      { mes: "Jun", ingreso: 1015.8, costo: 737.3, utilidad: 278.5 },
    ],
  },
  fulfillment: {
    kpis: [
      { label: "Guías procesadas H1", value: "21.428", sub: "Luana + Hernán", tone: "neu" as const },
      { label: "Revenue H1", value: "Gs 107M", sub: "Gs 5.000/guía", tone: "neu" as const },
      { label: "Resultado Operativo H1", value: "Gs 14M", sub: "Margen 13,1%", tone: "up" as const },
      { label: "Break-even desde julio", value: "4.558", sub: "Actual prom: 3.571/mes", tone: "dn" as const },
    ],
    bar: [
      { mes: "Ene", resultado: -0.11 },
      { mes: "Feb", resultado: 2.13 },
      { mes: "Mar", resultado: 4.0 },
      { mes: "Abr", resultado: 2.71 },
      { mes: "May", resultado: 3.87 },
      { mes: "Jun", resultado: 1.44 },
    ],
    tabla: [
      { mes: "Enero", guias: "3.608", ingreso: "Gs 18,0M", resultado: "−Gs 113K", margen: "−0,6%", neg: true },
      { mes: "Febrero", guias: "3.325", ingreso: "Gs 16,6M", resultado: "+Gs 2,1M", margen: "12,8%" },
      { mes: "Marzo", guias: "3.746", ingreso: "Gs 18,7M", resultado: "+Gs 4,0M", margen: "21,4%" },
      { mes: "Abril", guias: "3.333", ingreso: "Gs 16,7M", resultado: "+Gs 2,7M", margen: "16,2%" },
      { mes: "Mayo", guias: "4.105", ingreso: "Gs 20,5M", resultado: "+Gs 3,9M", margen: "18,8%" },
      { mes: "Junio", guias: "3.311", ingreso: "Gs 16,6M", resultado: "+Gs 1,4M", margen: "8,7%" },
      { mes: "H1 Total", guias: "21.428", ingreso: "Gs 107M", resultado: "+Gs 14M", margen: "13,1%", total: true },
    ],
  },
  transportadoras: {
    kpis: [
      { label: "AEX · 51,9% volumen", value: "18,3%", sub: "Menor rentab. · pago con demora", tone: "dn" as const },
      { label: "FIXY · 5,8% volumen", value: "30,4%", sub: "Pago puntual", tone: "up" as const },
      { label: "FIXY-NEXTDAY · 41,3% vol.", value: "31,5%", sub: "Mayor rentab. · pago puntual", tone: "up" as const },
      { label: "Punto a Punto · 1,0% vol.", value: "33,1%", sub: "Mejor rentabilidad", tone: "up" as const },
    ],
    chart: [
      { trans: "AEX", rentab: 18.3, vol: 51.9 },
      { trans: "FIXY", rentab: 30.4, vol: 5.8 },
      { trans: "FIXY-NEXTDAY", rentab: 31.5, vol: 41.3 },
      { trans: "Pto. Punto", rentab: 33.1, vol: 1.0 },
    ],
    tabla: [
      { trans: "AEX", guias: "15.934", vol: "51,9%", rentab: 18.3, pago: "Con demora", pagoTone: "dn" as const },
      { trans: "FIXY", guias: "1.774", vol: "5,8%", rentab: 30.4, pago: "Puntual ✓", pagoTone: "up" as const },
      { trans: "FIXY-NEXTDAY", guias: "12.700", vol: "41,3%", rentab: 31.5, pago: "Puntual ✓", pagoTone: "up" as const },
      { trans: "Punto a Punto", guias: "320", vol: "1,0%", rentab: 33.1, pago: "Puntual ✓", pagoTone: "up" as const },
      { trans: "Total Mayo", guias: "30.728", vol: "100%", rentab: 23.8, pago: "—", pagoTone: "neu" as const, total: true },
    ],
  },
  obligaciones: {
    cards: [
      { lbl: "AEX — Recaudo pendiente de cobro", amt: "Gs 1.917M", flag: "✦ Es un ACTIVO — no es deuda de Dropi", flagTone: "amber", note: "AEX cobró a los clientes finales y aún no transfirió a Dropi. Al corte del 4 de junio. Cuando consigne, entra directo al banco.", tone: "or" },
      { lbl: "Colombia — Utilidades devengadas 2026", amt: "USD 12.261", flag: "≈ Gs 91,9M pendiente de transferir", flagTone: "amber", note: "25% de la utilidad neta de los meses positivos (Feb, Mar, Abr, May). Último pago: USD 13.408 en Dic 2025. La caja tiene capacidad para cubrirlo.", tone: "go" },
      { lbl: "Colombia CXC — saldo actual", amt: "Gs −72M", flag: "Colombia nos debe Gs 72M ← posición normal", flagTone: "green", note: "Saldo de la cuenta intercompany por retiros de wallets que Colombia procesa para PY. Paraguay ya reembolsó Gs 2.727M a Colombia en Ene y Abr.", tone: "gr" },
    ],
    aex: [
      { periodo: "Histórico 2025", guias: "5", monto: "Gs 1,3M", pct: "0,1%", tone: "muted" },
      { periodo: "Ene–Mar 2026", guias: "29", monto: "Gs 5,6M", pct: "0,3%", tone: "muted" },
      { periodo: "Abril 2026", guias: "1.222", monto: "Gs 244M", pct: "12,7%", tone: "warn" },
      { periodo: "Mayo 2026", guias: "7.472", monto: "Gs 1.388M", pct: "72,4%", tone: "dn" },
      { periodo: "Junio 2026", guias: "1.501", monto: "Gs 278M", pct: "14,5%", tone: "warn" },
      { periodo: "TOTAL al 04/Jun", guias: "10.229", monto: "Gs 1.917M", pct: "100%", total: true },
    ],
    wallets: [
      { name: "USDT 50,2%", value: 1332.5, color: C.navy },
      { name: "Transf. Colombia 28,5%", value: 757.7, color: C.orange },
      { name: "Coloca 9,8%", value: 261.0, color: "#4A7ABF" },
      { name: "Payoneer 9,1%", value: 241.6, color: "#709AB0" },
      { name: "Otros 2,3%", value: 62.2, color: "#B0C8D8" },
    ],
    walletMetrics: [
      { label: "Total wallets pagadas x Colombia", value: "Gs 2.655M", tone: "neu" as const },
      { label: "PY reembolsó a Colombia", value: "Gs 2.727M", tone: "neu" as const },
      { label: "Saldo CXC (Colombia nos debe)", value: "Gs 72M ✓", tone: "up" as const },
    ],
  },
  junio: {
    kpis: [
      { label: "Rentab. Flete — Mejor mes del año", value: "27,42%", sub: "27.634 guías entregadas", tone: "up" as const },
      { label: "Margen Bruto (flete)", value: "Gs 278M", sub: "Revenue 1.016M − Costo 737M", tone: "up" as const },
      { label: "EBITDA provisional", value: "Gs 135M", sub: "13,3% — incluye extraordinarios", tone: "neu" as const },
      { label: "EBITDA sin extraordinarios", value: "Gs 186M", sub: "18,3% — base normalizada", tone: "up" as const },
    ],
    donut: [
      { name: "Costos recurrentes Gs 92,6M", value: 92.6, color: C.green },
      { name: "Extraordinarios Gs 50,7M", value: 50.7, color: C.amber },
    ],
    opexMetrics: [
      { label: "Costos recurrentes (operación normal)", value: "Gs 92,6M", tone: "up" as const },
      { label: "Gastos extraordinarios (no se repiten)", value: "Gs 50,7M", tone: "warn" as const },
      { label: "OPEX total junio", value: "Gs 143,3M", tone: "neu" as const, highlight: true },
    ],
    extra: [
      { concepto: "⚽ Premios del Mundial (Mega + Nissei)", monto: "19.974.196", pct: "2,0%", hl: true },
      { concepto: "📢 Expo Ecommerce CAPACE", monto: "13.000.000", pct: "1,3%", hl: true },
      { concepto: "💻 Equipos IT", monto: "4.952.000", pct: "0,5%" },
      { concepto: "🎽 Camisetas PY-Dropi", monto: "4.050.000", pct: "0,4%" },
      { concepto: "🔧 Reparaciones", monto: "3.100.000", pct: "0,3%" },
      { concepto: "📋 Patente Comercial", monto: "1.540.700", pct: "0,2%" },
      { concepto: "🖨️ Útiles, Foto, CAPACE mens.", monto: "4.109.000", pct: "0,4%" },
      { concepto: "Total extraordinarios", monto: "50.725.896", pct: "5,0%", total: true },
    ],
  },
};

type TabKey = "resumen" | "margenes" | "operativo" | "fulfillment" | "transportadoras" | "obligaciones" | "junio";

export default function FinanzasDashboardPY_H1() {
  const [tab, setTab] = useState<TabKey>("resumen");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "resumen", label: "🧭 Resumen" },
    { key: "margenes", label: "💹 Márgenes" },
    { key: "operativo", label: "📦 Operativo" },
    { key: "fulfillment", label: "📦 Fulfillment" },
    { key: "transportadoras", label: "🚚 Transportadoras" },
    { key: "obligaciones", label: "📋 Obligaciones" },
    { key: "junio", label: "⚡ Junio" },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold t-primary flex items-center gap-2">
              DROPI E.A.S. — Dashboard Financiero H1 2026
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.orange, color: "white" }}>EJECUTIVO</span>
            </h2>
            <p className="text-xs t-muted mt-1">Paraguay · Ene–Jun 2026 · Actualizado al 09/07/2026 · Junio provisional · Cifras en guaraníes (Gs)</p>
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

      {tab === "resumen" && <ResumenView />}
      {tab === "margenes" && <MargenesView />}
      {tab === "operativo" && <OperativoView />}
      {tab === "fulfillment" && <FulfillmentView />}
      {tab === "transportadoras" && <TransportadorasView />}
      {tab === "obligaciones" && <ObligacionesView />}
      {tab === "junio" && <JunioView />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
type Tone = "up" | "dn" | "neu" | "warn";
const toneColor: Record<Tone, string> = { up: C.green, dn: C.red, neu: C.gray, warn: C.amber };

function KpiGrid({ kpis }: { kpis: { label: string; value: string; sub: string; tone: Tone }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
      {kpis.map((k) => (
        <div key={k.label} className="glass-card p-3">
          <p className="text-[11px] t-muted mb-1">{k.label}</p>
          <p className="font-mono text-base font-semibold t-primary">{k.value}</p>
          <p className="text-[10px] mt-1" style={{ color: toneColor[k.tone] }}>{k.sub}</p>
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
    pos: { bg: C.greenLt, border: C.green, text: "#0E3D24" },
    warn: { bg: C.amberLt, border: C.amber, text: "#633806" },
    dn: { bg: C.redLt, border: C.red, text: "#791F1F" },
    info: { bg: C.infoLt, border: C.info, text: "#0F3B66" },
  };
  const m = map[tone];
  return (
    <div className="rounded-lg px-4 py-3 text-xs leading-relaxed mt-3" style={{ background: m.bg, borderLeft: `3px solid ${m.border}`, color: m.text }}>
      {children}
    </div>
  );
}

// Fila horizontal tipo "waterfall" / composición (barra proporcional + valor)
function BarRow({ label, pct, pctLabel, monto, color, strong }: { label: string; pct: number; pctLabel: string; monto?: string; color: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`text-[11px] w-40 shrink-0 text-right ${strong ? "t-primary font-semibold" : "t-muted"}`}>{label}</div>
      <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-md flex items-center px-2 text-[11px] font-semibold text-white whitespace-nowrap" style={{ width: `${Math.max(pct, 6)}%`, background: color }}>
          {monto}
        </div>
      </div>
      <div className="text-[11px] font-semibold w-20 text-right font-mono t-primary">{pctLabel}</div>
    </div>
  );
}

const tipStyle = { background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 };

// ═══════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════
function ResumenView() {
  const [mode, setMode] = useState<"monto" | "pct">("monto");
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.resumen.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>De cada Gs 100 que ingresa — dónde va</SectionTitle>
          <div className="space-y-2">
            {DATA.resumen.waterfall.map((w) => (
              <BarRow key={w.label} label={w.label} pct={w.pct} pctLabel={w.pctLabel} monto={w.monto} color={w.color} strong={w.strong} />
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>Resultado mensual — EBITDA</SectionTitle>
            <div className="flex gap-1">
              {(["monto", "pct"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`text-[10px] px-2 py-1 rounded-md border transition-all ${mode === m ? "bg-orange-500 text-white border-orange-500" : "bg-transparent t-secondary border-gray-700"}`}>
                  {m === "monto" ? "Gs" : "%"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DATA.resumen.ebitdaMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => (mode === "monto" ? `${v}M` : `${v}%`)} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => (mode === "monto" ? `Gs ${v}M` : `${v}%`)} />
              <Bar dataKey={mode} radius={[4, 4, 0, 0]}>
                {DATA.resumen.ebitdaMensual.map((d, i) => <Cell key={i} fill={d[mode] >= 0 ? C.green : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Q1 vs Q2 — Comparativo (EERR oficial)</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Concepto</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Q1 (Ene–Mar)</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Q2 (Abr–Jun)</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Variación</th>
                </tr>
              </thead>
              <tbody>
                {DATA.resumen.q1q2.map((r) => (
                  <tr key={r.concepto} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : r.subtotal ? { background: "rgba(255,255,255,0.04)", fontWeight: 600 } : {}}>
                    <td className="py-2 px-3 t-primary">{r.concepto}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.q1}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.q2}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: toneColor[r.tone] }}>{r.varr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-4">
          <SectionTitle>Balance — lo que realmente es de Dropi</SectionTitle>
          {DATA.resumen.balance.map((b) => (
            <div key={b.label} className="flex items-center justify-between py-2 border-b border-gray-800/50" style={b.highlight ? { borderTop: `2px solid ${C.orange}`, marginTop: 4, paddingTop: 10 } : {}}>
              <span className={`text-xs ${b.highlight ? "t-primary font-semibold" : "t-muted"}`}>{b.label}</span>
              <span className={`font-mono font-semibold ${b.highlight ? "text-lg" : "text-xs"}`} style={{ color: toneColor[b.tone] }}>{b.value}</span>
            </div>
          ))}
          <Alert tone="warn">
            El activo total (Gs 9.581M) parece alto porque incluye fondos de los dropshippers que Dropi administra. Esos fondos se compensan exactamente en el pasivo. El número que importa es el <strong>Patrimonio Neto: Gs 769M</strong>.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function MargenesView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.margenes.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Evolución rentabilidad operativa flete — mensual (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={DATA.margenes.rentFlete}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} domain={[10, 32]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="value" stroke={C.orange} strokeWidth={2.5} dot={{ fill: C.orange, r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Margen EBITDA mensual (%) — EERR oficial</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={DATA.margenes.ebitdaLine}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="value" stroke={C.green} strokeWidth={2.5} dot={{ fill: C.green, r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Composición OPEX — % sobre ingresos H1</SectionTitle>
          <div className="space-y-2">
            {DATA.margenes.opex.map((o) => (
              <BarRow key={o.label} label={o.label} pct={o.pct} pctLabel={`${o.pct.toString().replace(".", ",")}%`} color={o.color} strong={o.strong} />
            ))}
          </div>
          <Alert tone="warn">
            Los honorarios profesionales (Gs 198M en 5 meses) representan el <strong>3,9% de los ingresos</strong>. Es el mayor gasto después del costo logístico. Si bajaran un 25%, el EBITDA subiría ~1 pp.
          </Alert>
        </div>

        <div className="glass-card p-4">
          <SectionTitle>Resultado mensual — EERR oficial</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Mes</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Ingresos</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">MB%</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">EBITDA</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Margen</th>
                </tr>
              </thead>
              <tbody>
                {DATA.margenes.eerr.map((r: any) => (
                  <tr key={r.mes} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : r.subtotal ? { background: "rgba(255,255,255,0.04)", fontWeight: 600 } : {}}>
                    <td className="py-2 px-3 t-primary">{r.mes}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.ingresos}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.mb}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.neg ? C.red : C.green }}>{r.ebitda}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.neg ? C.red : C.green }}>{r.margen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] t-muted mt-2">Junio es provisional — EERR oficial pendiente del cierre contable.</p>
        </div>
      </div>
    </div>
  );
}

function OperativoView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.operativo.kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Guías entregadas por mes</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={DATA.operativo.guias}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis yAxisId="left" stroke="#888" fontSize={10} tickFormatter={(v) => v.toLocaleString("es-AR")} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={10} domain={[10, 35]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="guias" name="Guías" fill={C.green} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="rentab" name="Rentab. %" stroke={C.amber} strokeWidth={2} dot={{ fill: C.amber, r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Ingreso, Costo y Utilidad mensual — Power BI (Gs M)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={DATA.operativo.pbi}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => `${v}M`} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => `Gs ${v}M`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ingreso" name="Ingreso" fill={C.blueLt} radius={[3, 3, 0, 0]} />
              <Bar dataKey="costo" name="Costo" fill={C.orange} radius={[3, 3, 0, 0]} />
              <Bar dataKey="utilidad" name="Utilidad" fill={C.green} radius={[3, 3, 0, 0]} />
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
      <KpiGrid kpis={DATA.fulfillment.kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Resultado operativo mensual (Gs M)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={DATA.fulfillment.bar}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => `${v}M`} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => `Gs ${v}M`} />
              <Bar dataKey="resultado" radius={[4, 4, 0, 0]}>
                {DATA.fulfillment.bar.map((d, i) => <Cell key={i} fill={d.resultado >= 0 ? C.green : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Resumen H1 Fulfillment</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Mes</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Guías</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Ingreso</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Resultado</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Margen</th>
                </tr>
              </thead>
              <tbody>
                {DATA.fulfillment.tabla.map((r: any) => (
                  <tr key={r.mes} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : {}}>
                    <td className="py-2 px-3 t-primary">{r.mes}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.guias}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.ingreso}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.neg ? C.red : C.green }}>{r.resultado}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.neg ? C.red : undefined }}>{r.margen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert tone="dn">
            <strong>⚠ Alerta julio 2026: costo fijo sube de Gs 15M a Gs 22,8M/mes.</strong> Se incorpora un 3er empleado y el alquiler se duplica (USD 600 → USD 1.200). Se necesitan 4.558 guías/mes para cubrir costos — un +28% sobre el promedio actual de 3.571. En el escenario sin acción: pérdida mensual estimada de Gs −5,6M.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function TransportadorasView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.transportadoras.kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Rentabilidad operativa vs volumen — Mayo 2026 (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={DATA.transportadoras.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="trans" stroke="#888" fontSize={10} />
              <YAxis yAxisId="left" stroke="#888" fontSize={10} domain={[0, 45]} tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={10} domain={[0, 70]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="rentab" name="Rentabilidad %" radius={[4, 4, 0, 0]}>
                {DATA.transportadoras.chart.map((d, i) => <Cell key={i} fill={d.rentab < 25 ? C.red : C.green} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="vol" name="% Volumen" stroke={C.amber} strokeWidth={2.5} dot={{ fill: C.amber, r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Comparativo Mayo 2026</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Transportadora</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Guías</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">% Vol.</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Rentab.</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Pago</th>
                </tr>
              </thead>
              <tbody>
                {DATA.transportadoras.tabla.map((r: any) => (
                  <tr key={r.trans} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : {}}>
                    <td className="py-2 px-3 t-primary">{r.trans}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.guias}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.vol}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.rentab < 25 ? C.red : C.green }}>{r.rentab.toString().replace(".", ",")}%</td>
                    <td className="py-2 px-3 text-right text-xs" style={{ color: toneColor[r.pagoTone as Tone], fontWeight: 600 }}>{r.pago}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert tone="warn">
            <strong>AEX: 51,9% del volumen con la rentabilidad más baja (18,3%).</strong> FIXY-NEXTDAY: 41,3% del volumen con 31,5%. La brecha es de 13,2 pp. Migrar un 10% del volumen de AEX a FIXY-NEXTDAY mejoraría el margen global en ~+1,4 pp.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function ObligacionesView() {
  const cardTone: Record<string, { bg: string; border: string; amt: string }> = {
    or: { bg: C.orangeLt, border: "rgba(232,84,10,0.2)", amt: C.orange },
    go: { bg: C.amberLt, border: "rgba(196,122,0,0.2)", amt: C.amber },
    gr: { bg: C.greenLt, border: "rgba(26,102,64,0.2)", amt: C.green },
  };
  const flagColor: Record<string, string> = { amber: C.amber, green: C.green };
  const cellTone: Record<string, string> = { muted: C.gray, warn: C.amber, dn: C.red };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {DATA.obligaciones.cards.map((c) => {
          const t = cardTone[c.tone];
          return (
            <div key={c.lbl} className="rounded-xl p-5 border" style={{ background: t.bg, borderColor: t.border }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#555" }}>{c.lbl}</p>
              <p className="text-2xl font-extrabold my-1 font-mono" style={{ color: t.amt }}>{c.amt}</p>
              <p className="text-xs font-semibold mb-1" style={{ color: flagColor[c.flagTone] }}>{c.flag}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "#444" }}>{c.note}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>AEX — Detalle de pendientes por período (activo de cobro)</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Período</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Guías</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Monto (Gs)</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">% del total</th>
                </tr>
              </thead>
              <tbody>
                {DATA.obligaciones.aex.map((r: any) => (
                  <tr key={r.periodo} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : {}}>
                    <td className="py-2 px-3 t-primary">{r.periodo}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.guias}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{r.monto}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.total ? undefined : cellTone[r.tone] }}>{r.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-4">
          <SectionTitle>Wallets que procesa Colombia — por canal (H1 2026)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={DATA.obligaciones.wallets} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                {DATA.obligaciones.wallets.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tipStyle} formatter={(v) => `Gs ${v}M`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          {DATA.obligaciones.walletMetrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <span className="text-xs t-muted">{m.label}</span>
              <span className="font-mono text-xs font-semibold" style={{ color: toneColor[m.tone] }}>{m.value}</span>
            </div>
          ))}
          <Alert tone="pos">
            <strong>Estos flujos son fondos de terceros — no son utilidades de Dropi.</strong> Son retiros de wallets de dropshippers procesados por Colombia. No afectan el P&amp;L.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function JunioView() {
  return (
    <div className="space-y-4">
      <KpiGrid kpis={DATA.junio.kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>OPEX Junio — recurrente vs. extraordinario (provisional)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={DATA.junio.donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                {DATA.junio.donut.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tipStyle} formatter={(v) => `Gs ${v}M`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          {DATA.junio.opexMetrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between py-2 border-b border-gray-800/50" style={m.highlight ? { borderTop: `2px solid ${C.orange}`, marginTop: 4, paddingTop: 10 } : {}}>
              <span className={`text-xs ${m.highlight ? "t-primary font-semibold" : "t-muted"}`}>{m.label}</span>
              <span className={`font-mono font-semibold ${m.highlight ? "text-base" : "text-xs"}`} style={{ color: toneColor[m.tone] }}>{m.value}</span>
            </div>
          ))}
        </div>

        <div className="glass-card p-4">
          <SectionTitle>Detalle de gastos extraordinarios de Junio</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Concepto</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Monto (Gs)</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">% Revenue</th>
                </tr>
              </thead>
              <tbody>
                {DATA.junio.extra.map((r: any) => (
                  <tr key={r.concepto} className="border-b border-gray-800/50" style={r.total ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : r.hl ? { background: "rgba(232,84,10,0.05)" } : {}}>
                    <td className="py-2 px-3 t-primary text-xs">{r.concepto}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.hl || r.total ? C.amber : undefined }}>{r.monto}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.hl || r.total ? C.amber : undefined }}>{r.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert tone="pos">
            <strong>Sin los extraordinarios, el EBITDA de junio sería 18,3% — el mejor mes del semestre.</strong> Los premios del Mundial y la Expo son inversiones en marca y visibilidad. No se repiten en julio.
          </Alert>
        </div>
      </div>
    </div>
  );
}
