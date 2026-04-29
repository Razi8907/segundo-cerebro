"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── Paleta DROPI Argentina (igual al HTML ejecutivo) ───
const COLOR = {
  orange: "#E8692A",
  orangeDark: "#C85520",
  orangeLt: "#FFF0E8",
  green: "#1E6B3C",
  greenLt: "#E8F5EE",
  red: "#B42222",
  redLt: "#FDECEA",
  amber: "#B35900",
  amberLt: "#FFF3E0",
  gray: "#4A6170",
  grayLt: "#EEF2F5",
  dark: "#111418",
  muted: "#8A929B",
};

// ─── Datos financieros DROPI S.A. Argentina ───
const DATA = {
  meta: {
    cuit: "30-71916455-9",
    periodo: "Oct 2025 – Abr 2026",
    actualizado: "2026-04-27",
  },
  headerKpis: {
    recaudoReal: 596212518,
    netoDropiTotal: 512740040,
    cajaDisponible: 107200740,
  },
  // Niveles del resumen
  niveles: {
    recaudoTotal: 596212518,
    ingresoDropi: 512740040,
    gananciaNeta: 2616191,
  },
  // Tabla principal: Oct-Dic real Fixy + Ene-Abr archivo REALES
  tablaPrincipal: [
    {
      mes: "Oct '25",
      sub: "2° quincena",
      recaudo: 20320954,
      fixy: -4287973,
      netoDropi: 16032982,
      gastos: null,
      gastosLabel: "Préstamo Paraguay",
      resultado: null,
      estado: "✅ Cobrado BBVA 02/12",
      estadoColor: "green",
      seccion: "real",
    },
    {
      mes: "Nov '25",
      sub: "1° + 2° quinc.",
      recaudo: 196944088,
      fixy: -43483494,
      netoDropi: 153448900,
      gastos: null,
      gastosLabel: "Préstamo PY + Ecom Day",
      resultado: null,
      estado: "✅ Cobrado BBVA + Efectivo",
      estadoColor: "green",
      seccion: "real",
    },
    {
      mes: "Dic '25",
      sub: "1° + 2° quinc.",
      recaudo: 378947476,
      fixy: -96962818,
      netoDropi: 281984658,
      gastos: -5977252,
      gastosLabel: null,
      resultado: 276007406,
      resultadoLabel: "$276.0M*",
      estado: "🔴 Retenido por Fixy",
      estadoColor: "red",
      seccion: "real",
    },
    {
      mes: "Ene '26",
      sub: null,
      recaudo: 510060000,
      recaudoEst: true,
      fixy: null,
      fixyEst: true,
      netoDropi: 15209400,
      gastos: -11184090,
      gastosLabel: null,
      resultado: 4025310,
      resultadoLabel: "+$4.0M",
      estado: "🔴 Retenido por Fixy",
      estadoColor: "red",
      seccion: "archivo",
    },
    {
      mes: "Feb '26",
      sub: null,
      recaudo: 472500000,
      recaudoEst: true,
      fixy: null,
      fixyEst: true,
      netoDropi: 14031300,
      gastos: -14611912,
      gastosLabel: null,
      resultado: -580612,
      resultadoLabel: "-$580K",
      estado: "⏳ A conciliar",
      estadoColor: "amber",
      seccion: "archivo",
    },
    {
      mes: "Mar '26",
      sub: null,
      recaudo: 545160000,
      recaudoEst: true,
      fixy: null,
      fixyEst: true,
      netoDropi: 15833100,
      gastos: -14102849,
      gastosLabel: null,
      resultado: 1730251,
      resultadoLabel: "+$1.7M",
      estado: "⏳ A conciliar",
      estadoColor: "amber",
      seccion: "archivo",
    },
    {
      mes: "Abr '26",
      sub: null,
      recaudo: 553920000,
      recaudoEst: true,
      fixy: null,
      fixyEst: true,
      netoDropi: 16199700,
      gastos: -18758458,
      gastosLabel: null,
      resultado: -2558758,
      resultadoLabel: "-$2.6M",
      estado: "⏳ A conciliar",
      estadoColor: "amber",
      seccion: "archivo",
    },
  ],
  subtotales: {
    octDic: { recaudo: 596212518, fixy: -144734285, netoDropi: 451466540, gastos: -5977252, resultado: 445489288 },
    eneAbr: { recaudo: 2081640000, fixy: -520410000, netoDropi: 61273500, gastos: -58657309, resultado: 2616191 },
    total: { recaudo: 2677852518, fixy: -144734285, netoDropi: 512740040, gastos: -64634561, resultado: 448105479 },
  },
  // Recaudo real Oct-Dic con órdenes
  recaudoReal: [
    { periodo: "Oct '25 — 2° quinc.", ordenes: 415, bruto: 20320954, fixy: -4287973, neto: 16032982, estado: "✅ Cobrado — Banco BBVA 02/12/25", estadoColor: "green" },
    { periodo: "Nov '25 — 1° quinc.", ordenes: 1394, bruto: 76665279, fixy: -18650125, neto: 58003460, estado: "✅ Cobrado — Banco BBVA 10/12/25", estadoColor: "green" },
    { periodo: "Nov '25 — 2° quinc.", ordenes: 2301, bruto: 120278809, fixy: -24833369, neto: 95445440, estado: "✅ Cobrado — Efectivo (Dic/Feb/Abr)", estadoColor: "green" },
    { periodo: "Dic '25 — 1° quinc.", ordenes: 6995, bruto: 199467358, fixy: -49741073, neto: 149726285, estado: "🔴 Retenido por Fixy", estadoColor: "red" },
    { periodo: "Dic '25 — 2° quinc.", ordenes: 7526, bruto: 179480118, fixy: -47221745, neto: 132258373, estado: "🔴 Retenido por Fixy", estadoColor: "red" },
  ],
  // Recaudo estimado Ene-Abr
  recaudoEst: [
    { periodo: "Ene '26", ordenes: 8501, bruto: 510060000, fixy: -127515000, neto: 186837690, netoLabel: "$186.837.690 ✓", estado: "🔴 Retenido confirmado por Fixy", estadoColor: "red" },
    { periodo: "Feb '26", ordenes: 7875, bruto: 472500000, fixy: -118125000, neto: 354375000, estado: "⏳ A conciliar — Fixy", estadoColor: "amber" },
    { periodo: "Mar '26 — Fixy + Urbano", ordenes: 9086, bruto: 545160000, fixy: -136290000, neto: 408870000, estado: "⏳ A conciliar — Fixy + Urbano", estadoColor: "amber" },
    { periodo: "Abr '26 — Fixy + Urbano", ordenes: 9232, bruto: 553920000, fixy: -138480000, neto: 415440000, estado: "⏳ A conciliar — Fixy + Urbano", estadoColor: "amber" },
  ],
  // Ingreso Dropi mensual desglosado
  ingresoDropi: [
    { mes: "Oct '25", fleteCod: 622500, comisionCod: 124500, fleteFf: null, total: 747000, fuente: "415 órd × $1.500 + × $60k × 0.5%", seccion: "calculado" },
    { mes: "Nov '25", fleteCod: 5542500, comisionCod: 1108500, fleteFf: null, total: 6651000, fuente: "3.695 órd × $1.500 + × $60k × 0.5%", seccion: "calculado" },
    { mes: "Dic '25", fleteCod: 21781500, comisionCod: 4356300, fleteFf: null, total: 26137800, fuente: "14.521 órd × $1.500 + × $60k × 0.5%", seccion: "calculado" },
    { mes: "Ene '26", fleteCod: 12289500, comisionCod: 2457900, fleteFf: 462000, total: 15209400, fuente: "Archivo REALES ARS", seccion: "archivo" },
    { mes: "Feb '26", fleteCod: 11094000, comisionCod: 2218800, fleteFf: 718500, total: 14031300, fuente: "Archivo REALES ARS", seccion: "archivo" },
    { mes: "Mar '26", fleteCod: 11020500, comisionCod: 2204100, fleteFf: 2608500, total: 15833100, fuente: "Archivo REALES ARS", seccion: "archivo" },
    { mes: "Abr '26", fleteCod: 11758500, comisionCod: 2351700, fleteFf: 2089500, total: 16199700, fuente: "Archivo REALES ARS", seccion: "archivo" },
  ],
  ingresoDropiTotal: { fleteCod: 74109000, comisionCod: 14821800, fleteFf: 5878500, total: 94809300 },
  // Ganancia (resultado mensual ene-abr)
  ganancia: [
    { mes: "Ene '26", ingreso: 15209400, egrFijos: -10202480, egrVar: -981610, total: -11184090, resultado: 4025310, margen: 0.265, acumulado: 4025310 },
    { mes: "Feb '26", ingreso: 14031300, egrFijos: -11840915, egrVar: -2770997, total: -14611912, resultado: -580612, margen: -0.041, acumulado: 3444698 },
    { mes: "Mar '26", ingreso: 15833100, egrFijos: -9940019, egrVar: -4162830, total: -14102849, resultado: 1730251, margen: 0.109, acumulado: 5174949 },
    { mes: "Abr '26", ingreso: 16199700, egrFijos: -10460549, egrVar: -8297909, total: -18758458, resultado: -2558758, margen: -0.158, acumulado: 2616191 },
  ],
  gananciaTotal: { ingreso: 61273500, egrFijos: -42443963, egrVar: -16213346, total: -58657309, resultado: 2616191, margen: 0.043 },
  // Breakdown gastos ene-abr
  gastosBreakdown: [
    { concepto: "Sueldos (sin Raziel)", detalle: "Valeria, Keimar, Tabossi, Agüero", monto: 13200000 },
    { concepto: "Alquiler + cochera", detalle: "Oficina Fernández 1959", monto: 10400000 },
    { concepto: "Honorarios contador + abogado", detalle: "Servicios profesionales", monto: 10500000 },
    { concepto: "Viáticos Raziel", detalle: "60 USD/día + alojamiento", monto: 15100000 },
    { concepto: "Viáticos Heads Comerciales", detalle: "Camilo Colombia + Paraguay", monto: 3100000 },
    { concepto: "Fulfillment GV Nexus", detalle: "Entregadas + no entregadas", monto: 3500000 },
  ],
  // Fulfillment detalle
  fulfillment: [
    { mes: "Ene '26", subFc: "FC 07/01/2026", entregadas: 184, pEnt: 990, noEnt: 194, pNent: 495, ingreso: 276000, costoNeto: 278190, totalIva: 336609.90, ganancia: -2190, hike: false },
    { mes: "Feb '26", subFc: "FC 03/02/2026", entregadas: 208, pEnt: 990, noEnt: 202, pNent: 495, ingreso: 312000, costoNeto: 305910, totalIva: 370151.10, ganancia: 6090, hike: false },
    { mes: "Mar '26", subFc: "⬆ GV Nexus subió 36%", entregadas: 268, pEnt: 1350, noEnt: 123, pNent: 675, ingreso: 402000, costoNeto: 444825, totalIva: 538238.25, ganancia: -42825, hike: true },
    { mes: "Abr '26", subFc: "FC 08/04/2026", entregadas: 911, pEnt: 1350, noEnt: 900, pNent: 675, ingreso: 1366500, costoNeto: 1837350, totalIva: 2223193.50, ganancia: -470850, hike: true },
  ],
  fulfillmentTotal: { entregadas: 1571, noEnt: 1419, ingreso: 2356500, costoNeto: 2866275, totalIva: 3468192.75, ganancia: -509775 },
  // Caja flujo mensual
  cajaFlujo: [
    { mes: "Dic '25", recibidos: 15775000, gastos: -5977252, saldo: 9797748, nota: "Adelanto Fixy — 2° liq. noviembre" },
    { mes: "Ene '26", recibidos: null, gastos: -9713548, saldo: 84200, nota: "Sin fondos nuevos — saldo crítico", critico: true },
    { mes: "Feb '26", recibidos: 30000000, gastos: -13036912, saldo: 17047288, nota: "Fixy transfirió $30M en efectivo" },
    { mes: "Mar '26", recibidos: null, gastos: -14181966, saldo: 2865322, nota: "Sin fondos — saldo muy ajustado", critico: true },
    { mes: "Abr '26", recibidos: 49670440, gastos: -19423044, saldo: 33164298, nota: "Fixy pagó el saldo restante de nov" },
  ],
  // Estado liquidaciones (caja real, tabla detallada)
  liquidaciones: [
    { periodo: "Oct '25 2° quinc.", bruto: 20320954, fixy: -4287973, neto: 16032982, estado: "✅ Cobrado", estadoColor: "green", deposito: "02/12/25 — Banco BBVA" },
    { periodo: "Nov '25 1° quinc.", bruto: 76665279, fixy: -18650125, neto: 58003460, estado: "✅ Cobrado", estadoColor: "green", deposito: "10/12/25 — Banco BBVA" },
    { periodo: "Nov '25 2° quinc.", bruto: 120278809, fixy: -24833369, neto: 95445440, estado: "✅ Cobrado", estadoColor: "green", deposito: "Dic/Feb/Abr — Efectivo" },
    { periodo: "Dic '25 1° quinc.", bruto: 199467358, fixy: -49741073, neto: 149726285, estado: "🔴 Retenido", estadoColor: "red", deposito: "Pendiente" },
    { periodo: "Dic '25 2° quinc.", bruto: 179480118, fixy: -47221745, neto: 132258373, estado: "🔴 Retenido", estadoColor: "red", deposito: "Pendiente" },
    { periodo: "Ene '26 1° quinc.", bruto: 95168984, fixy: -25291194, neto: 69877790, estado: "🔴 Retenido", estadoColor: "red", deposito: "Pendiente" },
    { periodo: "Ene '26 2° quinc.", bruto: null, fixy: null, neto: 116959900, estado: "🔴 Retenido", estadoColor: "red", deposito: "Pendiente" },
    { periodo: "Feb '26", bruto: null, fixy: null, neto: null, estado: "⏳ A conciliar", estadoColor: "amber", deposito: "Pendiente conciliación" },
    { periodo: "Mar '26 — Fixy", bruto: null, fixy: null, neto: null, estado: "⏳ A conciliar", estadoColor: "amber", deposito: "Pendiente conciliación" },
    { periodo: "Mar '26 — Urbano", bruto: null, fixy: null, neto: null, estado: "⏳ A conciliar", estadoColor: "amber", deposito: "Urbano — inició mar'26" },
    { periodo: "Abr '26 — Fixy", bruto: null, fixy: null, neto: null, estado: "⏳ A conciliar", estadoColor: "amber", deposito: "Pendiente conciliación" },
    { periodo: "Abr '26 — Urbano", bruto: null, fixy: null, neto: null, estado: "⏳ A conciliar", estadoColor: "amber", deposito: "Urbano — pendiente" },
  ],
  caja: {
    bbva: 74036442,
    efectivo: 33164298,
    fixyRetenido: 468822348,
  },
  deuda: {
    colombia: { monto: 29800000, detalle: "USD 1.750 × TC 1.420 × 12 meses", periodo: "Abr'25–Mar'26 · Desde abr'26 lo paga Argentina" },
    paraguay: { monto: 42000000, detalle: "GS 201.641.907 ÷ TC 7", periodo: "Mar'25–Nov'25 · Cubría viajes, estadía, operación" },
    total: 71800000,
  },
};

// ─── Formatters ───
const fmtArs = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  return `${sign}$${abs.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
};

const fmtArsExact = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
};

const fmtNum = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("es-AR");
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
};

const colorFor = (key: string): string => {
  switch (key) {
    case "green": return COLOR.green;
    case "red": return COLOR.red;
    case "amber": return COLOR.amber;
    case "orange": return COLOR.orange;
    case "gray": return COLOR.gray;
    default: return COLOR.muted;
  }
};

const badgeBg = (key: string): { bg: string; color: string } => {
  switch (key) {
    case "green": return { bg: COLOR.greenLt, color: COLOR.green };
    case "red": return { bg: COLOR.redLt, color: COLOR.red };
    case "amber": return { bg: COLOR.amberLt, color: COLOR.amber };
    default: return { bg: COLOR.grayLt, color: COLOR.gray };
  }
};

type FinView = "resumen" | "recaudo" | "ingresos" | "ganancia" | "fulfillment" | "caja";

export default function FinanzasDashboardAR() {
  const [view, setView] = useState<FinView>("resumen");

  const tabs: { key: FinView; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "recaudo", label: "① Recaudo" },
    { key: "ingresos", label: "② Ingreso Dropi" },
    { key: "ganancia", label: "③ Ganancia" },
    { key: "fulfillment", label: "📦 Fulfillment" },
    { key: "caja", label: "Caja real" },
  ];

  return (
    <div className="space-y-6">
      {/* Header con KPIs principales */}
      <div className="rounded-xl p-5" style={{ background: COLOR.dark }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] tracking-[3px] font-bold mb-1" style={{ color: COLOR.orange }}>
              DROPI S.A. · ARGENTINA · {DATA.meta.periodo.toUpperCase()}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white leading-tight" style={{ fontFamily: "Georgia, serif" }}>
              Resumen Financiero Ejecutivo
            </div>
            <div className="text-xs text-gray-400 mt-1">
              CUIT {DATA.meta.cuit} · Moneda: ARS · Actualizado al {DATA.meta.actualizado}
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-right">
            <div>
              <div className="font-mono text-lg font-medium" style={{ color: COLOR.gray }}>
                {fmtArs(DATA.headerKpis.recaudoReal)}
              </div>
              <div className="text-[10px] text-gray-500">Recaudo real oct–dic (Fixy)</div>
            </div>
            <div>
              <div className="font-mono text-lg font-medium" style={{ color: COLOR.orange }}>
                {fmtArs(DATA.headerKpis.netoDropiTotal)}
              </div>
              <div className="text-[10px] text-gray-500">Neto Dropi total (oct–abr)</div>
            </div>
            <div>
              <div className="font-mono text-lg font-medium" style={{ color: COLOR.green }}>
                {fmtArs(DATA.headerKpis.cajaDisponible)}
              </div>
              <div className="text-[10px] text-gray-500">Caja disponible hoy</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className="text-xs px-4 py-2 rounded-t-md font-medium transition-all"
              style={{
                background: view === t.key ? "var(--bg-page, #F5F6F8)" : "rgba(255,255,255,0.08)",
                color: view === t.key ? COLOR.orange : "#aaa",
                fontWeight: view === t.key ? 700 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido del tab */}
      {view === "resumen" && <ResumenView />}
      {view === "recaudo" && <RecaudoView />}
      {view === "ingresos" && <IngresosView />}
      {view === "ganancia" && <GananciaView />}
      {view === "fulfillment" && <FulfillmentView />}
      {view === "caja" && <CajaView />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES REUTILIZABLES
// ═══════════════════════════════════════════════════════════════════

function InfoBox({ tone, children }: { tone: "gray" | "orange" | "green" | "amber" | "red"; children: React.ReactNode }) {
  const map = {
    gray: { bg: COLOR.grayLt, border: COLOR.gray },
    orange: { bg: COLOR.orangeLt, border: COLOR.orange },
    green: { bg: COLOR.greenLt, border: COLOR.green },
    amber: { bg: COLOR.amberLt, border: COLOR.amber },
    red: { bg: COLOR.redLt, border: COLOR.red },
  };
  const c = map[tone];
  return (
    <div className="rounded-lg p-4 text-sm leading-relaxed mb-5" style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, color: "#333" }}>
      {children}
    </div>
  );
}

function TableWrap({ title, headerColor, children, footnote }: { title: string; headerColor?: string; children: React.ReactNode; footnote?: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden mb-5 shadow-sm bg-white">
      <div className="px-5 py-3" style={{ background: headerColor || COLOR.dark }}>
        <span className="text-white text-sm font-bold" style={{ fontFamily: "Georgia, serif" }}>{title}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footnote && <div className="px-4 py-3 text-[11px] text-gray-500 bg-gray-50 border-t border-gray-100 leading-relaxed">{footnote}</div>}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  const c = badgeBg(tone);
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: c.bg, color: c.color }}>
      {children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════════════════
function ResumenView() {
  return (
    <div>
      <InfoBox tone="gray">
        <strong>¿Cómo leer este resumen?</strong> Hay tres conceptos distintos que se suelen confundir:{" "}
        <strong>①</strong> El <strong>recaudo</strong> es todo lo que pagaron los compradores — pasa por Fixy/Urbano.{" "}
        <strong>②</strong> El <strong>ingreso de Dropi</strong> es lo que le corresponde a Dropi: <strong>$1.500 por cada orden</strong> (COD y fulfillment). Para COD además cobra el <strong>0.5% de comisión</strong>. El costo del fulfillment es lo que factura GV Nexus por entregadas y no entregadas.{" "}
        <strong>③</strong> La <strong>ganancia</strong> es el ingreso de Dropi menos todos los gastos operativos.
      </InfoBox>

      {/* 3 NIVELES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <NivelCard num="①" label="Recaudo total" value={DATA.niveles.recaudoTotal} sub="real oct–dic (liquidaciones Fixy)" desc="Todo lo que los compradores pagaron y cobró Fixy. No es plata de Dropi todavía. De este monto, Fixy descuenta su comisión y le transfiere el neto a Dropi." color={COLOR.gray} />
        <NivelCard num="②" label="Ingreso Dropi" value={DATA.niveles.ingresoDropi} sub="neto Dropi oct'25–abr'26" desc="Lo que le corresponde a Dropi: $1.500 por flete (COD y FF) más 0.5% comisión COD. El fulfillment solo cobra el flete." color={COLOR.orange} />
        <NivelCard num="③" label="Ganancia neta" value={DATA.niveles.gananciaNeta} sub="resultado ene–abr 2026 (acumulado)" desc="Del ingreso de Dropi se restan los gastos reales: sueldos, alquiler, honorarios, viáticos, fulfillment, impuestos. Solo calculado para ene–abr porque dic está retenido." color={COLOR.green} />
      </div>

      {/* TABLA PRINCIPAL */}
      <TableWrap title="Datos reales por mes — Oct 2025 a Abr 2026" footnote={
        <>
          * El resultado de dic '25 ($276M) y ene '26 ($186.8M retenido confirmado) <strong>no están disponibles en caja todavía</strong> — Fixy los retiene.<br />
          ~ Recaudo ene–abr es estimado (órdenes × $60.000 ticket promedio). El ingreso Dropi de ene–abr es <strong>real</strong> del archivo.
        </>
      }>
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.orangeLt }}>
            <tr>
              <Th color={COLOR.orange} align="left">Mes</Th>
              <Th color={COLOR.gray}>① Recaudo bruto</Th>
              <Th color={COLOR.gray}>(-) Fixy</Th>
              <Th color={COLOR.orange}>② Neto Dropi</Th>
              <Th color={COLOR.red}>③ Gastos pagados</Th>
              <Th color={COLOR.green}>Resultado</Th>
              <Th color={COLOR.muted} align="left">Estado</Th>
            </tr>
          </thead>
          <tbody>
            <SepRow colspan={7}>Datos reales — liquidaciones Fixy</SepRow>
            {DATA.tablaPrincipal.filter((r) => r.seccion === "real").map((r) => (
              <RowMain key={r.mes} r={r} />
            ))}
            <SepRow colspan={7}>Datos reales — archivo REALES ARS · Recaudo estimado</SepRow>
            {DATA.tablaPrincipal.filter((r) => r.seccion === "archivo").map((r) => (
              <RowMain key={r.mes} r={r} />
            ))}
            {/* Subtotales */}
            <SubtotalRow label="Neto oct–dic (real Fixy)" data={DATA.subtotales.octDic} />
            <SubtotalRow label="Neto ene–abr (real REALES ARS)" data={DATA.subtotales.eneAbr} />
            <TotalRow label="TOTAL PERÍODO" data={DATA.subtotales.total} />
          </tbody>
        </table>
      </TableWrap>

      {/* GRÁFICO RESULTADO MENSUAL */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
        <div className="text-sm font-bold mb-3" style={{ color: COLOR.dark, fontFamily: "Georgia, serif" }}>
          Resultado neto mensual — Ene a Abr 2026
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={DATA.ganancia}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mes" fontSize={11} stroke="#666" />
            <YAxis fontSize={11} stroke="#666" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
            <Tooltip formatter={(v) => fmtArsExact(typeof v === "number" ? v : null)} contentStyle={{ background: "#fff", border: `1px solid ${COLOR.orange}`, fontSize: 12 }} />
            <Bar dataKey="resultado" name="Resultado">
              {DATA.ganancia.map((d, i) => (
                <Cell key={i} fill={d.resultado >= 0 ? COLOR.green : COLOR.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* DEUDA */}
      <div className="rounded-xl p-5 mb-5" style={{ background: "#FFF8F0", border: `1px solid ${COLOR.amber}40` }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: COLOR.amber }}>⚠ Préstamo intercompany — Colombia y Paraguay</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: COLOR.amber }}>Colombia — Salario Raziel</div>
            <div className="text-sm font-mono">{DATA.deuda.colombia.detalle} = ~{fmtArs(DATA.deuda.colombia.monto)} ARS</div>
            <div className="text-xs text-gray-500 mt-1">{DATA.deuda.colombia.periodo}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: COLOR.amber }}>Paraguay — Gastos preoperativos Raziel</div>
            <div className="text-sm font-mono">{DATA.deuda.paraguay.detalle} = ~{fmtArs(DATA.deuda.paraguay.monto)} ARS</div>
            <div className="text-xs text-gray-500 mt-1">{DATA.deuda.paraguay.periodo}</div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-white rounded-md text-xs text-gray-700 leading-relaxed">
          💡 Con {fmtArs(DATA.headerKpis.cajaDisponible)} de caja disponible y {fmtArs(DATA.caja.fixyRetenido)} retenidos por cobrar a Fixy, la empresa tiene capacidad de cubrir ambas deudas ({fmtArs(DATA.deuda.total)} total) cuando se concrete la conciliación.
        </div>
      </div>

      {/* CAJA KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CajaKpi label="Banco BBVA" value={DATA.caja.bbva} sub="Oct + Nov '25 — intacto" color={COLOR.green} />
        <CajaKpi label="Caja Efectivo" value={DATA.caja.efectivo} sub="Saldo al 23/04/2026" color={COLOR.orange} />
        <CajaKpi label="Retenido por Fixy" value={DATA.caja.fixyRetenido} sub="Ene'26–Abr'26 pendiente conciliación" color={COLOR.amber} />
      </div>
    </div>
  );
}

function NivelCard({ num, label, value, sub, desc, color }: { num: string; label: string; value: number; sub: string; desc: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm" style={{ borderTop: `4px solid ${color}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: color }}>{num}</div>
        <strong className="text-sm" style={{ color: "#333" }}>{label}</strong>
      </div>
      <div className="font-mono text-3xl font-medium my-2" style={{ color }}>{fmtArs(value)}</div>
      <div className="text-xs text-gray-500 mb-2">{sub}</div>
      <div className="text-xs text-gray-700 leading-relaxed">{desc}</div>
    </div>
  );
}

function CajaKpi({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm text-center" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className="font-mono text-2xl font-medium my-1" style={{ color }}>{fmtArsExact(value)}</div>
      <div className="text-[11px] text-gray-500">{sub}</div>
    </div>
  );
}

function Th({ color, align = "right", children }: { color: string; align?: "left" | "right"; children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color, borderBottom: `2px solid ${color}`, textAlign: align }}>
      {children}
    </th>
  );
}

function SepRow({ colspan, children }: { colspan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colspan} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50">
        {children}
      </td>
    </tr>
  );
}

function RowMain({ r }: { r: typeof DATA.tablaPrincipal[0] }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-orange-50/30">
      <td className="px-3 py-2.5">
        <strong>{r.mes}</strong>
        {r.sub && <div className="text-[11px] text-gray-400">{r.sub}</div>}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.recaudoEst ? COLOR.muted : COLOR.gray }}>
        {r.recaudoEst ? `~${fmtArsExact(r.recaudo)}` : fmtArsExact(r.recaudo)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.fixyEst ? COLOR.muted : COLOR.red }}>
        {r.fixyEst ? "~est." : fmtArsExact(r.fixy)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: COLOR.orange }}>
        {fmtArsExact(r.netoDropi)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.gastosLabel ? COLOR.muted : COLOR.red }}>
        {r.gastosLabel || fmtArsExact(r.gastos)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: r.resultado === null ? COLOR.muted : r.resultado >= 0 ? COLOR.green : COLOR.red }}>
        {r.resultadoLabel || (r.resultado === null ? "—" : fmtArs(r.resultado))}
      </td>
      <td className="px-3 py-2.5"><Badge tone={r.estadoColor}>{r.estado}</Badge></td>
    </tr>
  );
}

function SubtotalRow({ label, data }: { label: string; data: { recaudo: number; fixy: number; netoDropi: number; gastos: number; resultado: number } }) {
  return (
    <tr style={{ background: "#F0F4F0", borderTop: "1px solid #C8DCC8" }}>
      <td className="px-3 py-2.5 font-semibold text-sm">{label}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.gray }}>{fmtArsExact(data.recaudo)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtArsExact(data.fixy)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: COLOR.orange }}>{fmtArsExact(data.netoDropi)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtArsExact(data.gastos)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: data.resultado >= 0 ? COLOR.amber : COLOR.red }}>{fmtArs(data.resultado)}</td>
      <td className="px-3 py-2.5"><Badge tone="gray">subtotal</Badge></td>
    </tr>
  );
}

function TotalRow({ label, data }: { label: string; data: { recaudo: number; fixy: number; netoDropi: number; gastos: number; resultado: number } }) {
  return (
    <tr style={{ background: COLOR.orangeLt, borderTop: `2px solid ${COLOR.orange}` }}>
      <td className="px-3 py-3 font-bold text-sm">{label}</td>
      <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.gray }}>~{fmtArs(data.recaudo)}</td>
      <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>~{fmtArs(data.fixy)}+</td>
      <td className="px-3 py-3 text-right font-mono text-sm font-black" style={{ color: COLOR.orange }}>{fmtArsExact(data.netoDropi)}</td>
      <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>{fmtArs(data.gastos)}</td>
      <td className="px-3 py-3 text-right font-mono text-sm font-black" style={{ color: COLOR.amber }}>+{fmtArs(data.resultado)}*</td>
      <td className="px-3 py-3 text-[11px] text-gray-600">*Dic retenido Fixy</td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RECAUDO
// ═══════════════════════════════════════════════════════════════════
function RecaudoView() {
  return (
    <div>
      <InfoBox tone="gray">
        💡 <strong>¿Qué es el recaudo?</strong> Cuando un comprador paga su pedido, ese dinero lo recibe el transportista (Fixy o Urbano).
        Luego Fixy descuenta su comisión y le transfiere el resto a Dropi. El <strong>recaudo bruto</strong> es el total que pagaron los compradores.
        El <strong>neto Dropi</strong> es lo que queda después del descuento de Fixy. <strong>Oct–dic son datos reales</strong> de las liquidaciones.
        <strong> Ene–abr son estimados</strong> porque están pendientes de conciliación.
      </InfoBox>

      <TableWrap title="📋 Datos REALES — Liquidaciones Fixy (Oct–Dic 2025)" headerColor={COLOR.green}>
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.greenLt }}>
            <tr>
              <Th color={COLOR.green} align="left">Período</Th>
              <Th color={COLOR.green}>Órdenes</Th>
              <Th color={COLOR.green}>Recaudo bruto</Th>
              <Th color={COLOR.green}>(-) Descuento Fixy</Th>
              <Th color={COLOR.green}>Neto Dropi</Th>
              <Th color={COLOR.green} align="left">Estado</Th>
            </tr>
          </thead>
          <tbody>
            {DATA.recaudoReal.map((r) => (
              <tr key={r.periodo} className="border-b border-gray-100">
                <td className="px-3 py-2.5"><strong>{r.periodo}</strong></td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtNum(r.ordenes)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.gray }}>{fmtArsExact(r.bruto)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtArsExact(r.fixy)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: COLOR.green }}>{fmtArsExact(r.neto)}</td>
                <td className="px-3 py-2.5"><Badge tone={r.estadoColor}>{r.estado}</Badge></td>
              </tr>
            ))}
            <tr style={{ background: "#F0F4F0", borderTop: "1px solid #C8DCC8" }}>
              <td className="px-3 py-3 font-bold">SUBTOTAL Oct–Dic</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold">18.631</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.gray }}>{fmtArsExact(596212518)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>{fmtArsExact(-144734285)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-black" style={{ color: COLOR.orange }}>{fmtArsExact(451466540)}</td>
              <td className="px-3 py-3 text-[11px] text-gray-600">$169.5M cobrado · $281.9M retenido</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>

      <TableWrap title="📊 ESTIMADO — Pendiente conciliación (Ene–Abr 2026)" headerColor={COLOR.gray} footnote={
        <>⚠ El neto estimado incluye todo el recaudo (vendedor + Dropi). El ingreso real de Dropi de ene–abr es <strong>$61.3M</strong> — ver pestaña ② Ingreso Dropi.</>
      }>
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.grayLt }}>
            <tr>
              <Th color={COLOR.gray} align="left">Período</Th>
              <Th color={COLOR.gray}>Órdenes</Th>
              <Th color={COLOR.gray}>Recaudo est.</Th>
              <Th color={COLOR.gray}>(-) Fixy est. ~25%</Th>
              <Th color={COLOR.gray}>Neto est.</Th>
              <Th color={COLOR.gray} align="left">Estado</Th>
            </tr>
          </thead>
          <tbody>
            {DATA.recaudoEst.map((r) => (
              <tr key={r.periodo} className="border-b border-gray-100">
                <td className="px-3 py-2.5"><strong>{r.periodo}</strong></td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtNum(r.ordenes)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.muted }}>~{fmtArsExact(r.bruto)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.muted }}>~{fmtArsExact(r.fixy)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: r.estadoColor === "red" ? COLOR.red : COLOR.amber }}>
                  {r.netoLabel || `~${fmtArsExact(r.neto)}`}
                </td>
                <td className="px-3 py-2.5"><Badge tone={r.estadoColor}>{r.estado}</Badge></td>
              </tr>
            ))}
            <tr style={{ background: "#F0F4F0", borderTop: "1px solid #C8DCC8" }}>
              <td className="px-3 py-3 font-bold">SUBTOTAL Ene–Abr</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold">34.694</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.muted }}>~{fmtArs(2081640000)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.muted }}>~{fmtArs(-520410000)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-black" style={{ color: COLOR.amber }}>~{fmtArs(1365522690)}</td>
              <td className="px-3 py-3 text-[11px] text-gray-600">Ene confirmado $186.8M · Feb–Abr estimado</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INGRESO DROPI
// ═══════════════════════════════════════════════════════════════════
function IngresosView() {
  return (
    <div>
      <InfoBox tone="orange">
        💡 <strong>¿Cómo gana Dropi?</strong> De cada paquete, Dropi cobra <strong>$1.500 de flete</strong> por envío.
        Para los envíos <strong>COD</strong> (cobro contra entrega) además cobra el <strong>0.5% del valor del producto</strong>.
        Para el <strong>fulfillment</strong> solo cobra el flete de $1.500 por orden entregada — <strong>sin comisión</strong>.
        <br /><br />
        <strong>Oct–dic:</strong> El ingreso Dropi está calculado desde las órdenes reales (flete + COD, sin FF porque aún no había).{" "}
        <strong>Ene–abr:</strong> Datos reales del archivo REALES ARS — flete COD + comisión COD + flete FF.
      </InfoBox>

      <TableWrap title="Ingreso Dropi por mes — Oct 2025 a Abr 2026">
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.orangeLt }}>
            <tr>
              <Th color={COLOR.orange} align="left">Mes</Th>
              <Th color={COLOR.orange}>Flete COD</Th>
              <Th color={COLOR.orange}>Comisión COD (0.5%)</Th>
              <Th color={COLOR.orange}>Flete FF</Th>
              <Th color={COLOR.orange}>Total ingreso Dropi</Th>
              <Th color={COLOR.muted} align="left">Fuente</Th>
            </tr>
          </thead>
          <tbody>
            <SepRow colspan={6}>Oct–Dic 2025 — Calculado desde órdenes reales</SepRow>
            {DATA.ingresoDropi.filter((r) => r.seccion === "calculado").map((r) => (
              <RowIngreso key={r.mes} r={r} />
            ))}
            <SepRow colspan={6}>Ene–Abr 2026 — Datos reales archivo REALES ARS</SepRow>
            {DATA.ingresoDropi.filter((r) => r.seccion === "archivo").map((r) => (
              <RowIngreso key={r.mes} r={r} />
            ))}
            <tr style={{ background: COLOR.orangeLt, borderTop: `2px solid ${COLOR.orange}` }}>
              <td className="px-3 py-3 font-bold">TOTAL</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold">{fmtArsExact(DATA.ingresoDropiTotal.fleteCod)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold">{fmtArsExact(DATA.ingresoDropiTotal.comisionCod)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold">{fmtArsExact(DATA.ingresoDropiTotal.fleteFf)}</td>
              <td className="px-3 py-3 text-right font-mono text-sm font-black" style={{ color: COLOR.orange }}>{fmtArsExact(DATA.ingresoDropiTotal.total)}</td>
              <td className="px-3 py-3 text-[11px] text-gray-500 italic">Oct'25–Abr'26</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>

      <InfoBox tone="amber">
        📌 <strong>Nota:</strong> El ingreso de Dropi (${(DATA.ingresoDropiTotal.total / 1e6).toFixed(1)}M) es <em>diferente</em> al neto que transfiere Fixy ($451.5M oct–dic).
        La diferencia es que Fixy transfiere también el valor del producto que le corresponde al vendedor.
        El ingreso <em>real de Dropi</em> es solo flete + comisión COD.
      </InfoBox>
    </div>
  );
}

function RowIngreso({ r }: { r: typeof DATA.ingresoDropi[0] }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-orange-50/30">
      <td className="px-3 py-2.5"><strong>{r.mes}</strong></td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtArsExact(r.fleteCod)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtArsExact(r.comisionCod)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.fleteFf ? COLOR.dark : COLOR.muted }}>{r.fleteFf ? fmtArsExact(r.fleteFf) : "—"}</td>
      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: COLOR.orange }}>{fmtArsExact(r.total)}</td>
      <td className="px-3 py-2.5 text-[11px] text-gray-500 italic">{r.fuente}</td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GANANCIA
// ═══════════════════════════════════════════════════════════════════
function GananciaView() {
  return (
    <div>
      <InfoBox tone="green">
        💡 <strong>¿Qué es la ganancia neta?</strong> Del ingreso de Dropi (flete + COD) se restan todos los gastos reales pagados:
        sueldos, alquiler, honorarios, viáticos, fulfillment, Vistage, impuestos.
        <strong> El salario de Raziel no está en los egresos</strong> porque lo cubrió Colombia como préstamo —
        pero es una deuda real que hay que devolver ($29.8M).
      </InfoBox>

      <TableWrap title="Resultado mensual — Ene a Abr 2026">
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.greenLt }}>
            <tr>
              <Th color={COLOR.green} align="left">Mes</Th>
              <Th color={COLOR.orange}>Ingreso Dropi</Th>
              <Th color={COLOR.red}>Egresos fijos</Th>
              <Th color={COLOR.red}>Egresos variables</Th>
              <Th color={COLOR.red}>Total gastos</Th>
              <Th color={COLOR.green}>Resultado</Th>
              <Th color={COLOR.green}>Margen</Th>
              <Th color={COLOR.green}>Acumulado</Th>
            </tr>
          </thead>
          <tbody>
            {DATA.ganancia.map((r) => (
              <tr key={r.mes} className="border-b border-gray-100">
                <td className="px-3 py-2.5"><strong>{r.mes}</strong></td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.orange }}>{fmtArsExact(r.ingreso)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtArsExact(r.egrFijos)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtArsExact(r.egrVar)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: COLOR.red }}>{fmtArsExact(r.total)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: r.resultado >= 0 ? COLOR.green : COLOR.red }}>{fmtArsExact(r.resultado)}</td>
                <td className="px-3 py-2.5 text-right"><Badge tone={r.margen >= 0 ? "green" : "red"}>{fmtPct(r.margen)}</Badge></td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.green }}>{fmtArs(r.acumulado)}</td>
              </tr>
            ))}
            <tr style={{ background: COLOR.orangeLt, borderTop: `2px solid ${COLOR.orange}` }}>
              <td className="px-3 py-3 font-bold">TOTAL Q1+Abr</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.orange }}>{fmtArsExact(DATA.gananciaTotal.ingreso)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>{fmtArsExact(DATA.gananciaTotal.egrFijos)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>{fmtArsExact(DATA.gananciaTotal.egrVar)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>{fmtArsExact(DATA.gananciaTotal.total)}</td>
              <td className="px-3 py-3 text-right font-mono text-sm font-black" style={{ color: COLOR.green }}>+{fmtArsExact(DATA.gananciaTotal.resultado)}</td>
              <td className="px-3 py-3 text-right"><Badge tone="green">{fmtPct(DATA.gananciaTotal.margen)}</Badge></td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.green }}>+{fmtArs(DATA.gananciaTotal.resultado)}</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>

      {/* Breakdown gastos */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
        <div className="text-base font-bold mb-3" style={{ fontFamily: "Georgia, serif" }}>¿En qué se gastó? — Acumulado Ene–Abr 2026</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {DATA.gastosBreakdown.map((g) => (
            <div key={g.concepto} className="px-4 py-3 bg-gray-50 rounded-md flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{g.concepto}</div>
                <div className="text-[11px] text-gray-500">{g.detalle}</div>
              </div>
              <div className="font-mono font-medium" style={{ color: COLOR.red }}>{fmtArs(g.monto)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: "#FFF8F0", border: `1px solid ${COLOR.amber}40` }}>
        <h3 className="text-sm font-bold mb-2" style={{ color: COLOR.amber }}>⚠ El salario de Raziel NO está en los egresos — es préstamo Colombia</h3>
        <div className="text-xs text-gray-700 leading-relaxed">
          USD 1.750 × TC 1.420 × 12 meses (abr'25–mar'26) = <strong>~$29.820.000 ARS</strong>.
          Este monto no salió de caja Argentina — lo pagó Colombia como préstamo.
          Si se suma a los egresos, el resultado acumulado sería <strong>-$27.2M</strong> en lugar de +$2.6M.
          Desde <strong>abril 2026</strong> Argentina asume el salario directamente.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FULFILLMENT
// ═══════════════════════════════════════════════════════════════════
function FulfillmentView() {
  const t = DATA.fulfillmentTotal;
  return (
    <div>
      <InfoBox tone="orange">
        💡 <strong>¿Cómo funciona el fulfillment?</strong>
        Dropi cobra <strong>$1.500 por cada orden entregada</strong>.
        GV Nexus (el operador) le cobra a Dropi por <strong>entregadas Y no entregadas</strong>.
        En marzo 2026 GV Nexus subió sus precios un <strong>36%</strong>.
        La ganancia neta de fulfillment = ingreso (entregadas × $1.500) − costo GV Nexus.
      </InfoBox>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <CajaKpi label="Total entregadas" value={t.entregadas} sub="Ene–Abr 2026" color={COLOR.orange} />
        <CajaKpi label="Total no entregadas" value={t.noEnt} sub="Generan costo sin ingreso" color={COLOR.red} />
        <CajaKpi label="Ingreso total FF" value={t.ingreso} sub="Entregadas × $1.500" color={COLOR.green} />
        <CajaKpi label="Resultado neto FF" value={t.ganancia} sub="Pérdida acumulada ene–abr" color={COLOR.red} />
      </div>

      <TableWrap title="Detalle por mes — Facturas GV Nexus">
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.orangeLt }}>
            <tr>
              <Th color={COLOR.orange} align="left">Mes</Th>
              <Th color={COLOR.orange}>Entregadas</Th>
              <Th color={COLOR.orange}>Precio unit.</Th>
              <Th color={COLOR.red}>No entregadas</Th>
              <Th color={COLOR.red}>Precio unit.</Th>
              <Th color={COLOR.green}>Ingreso Dropi</Th>
              <Th color={COLOR.red}>Costo GV (neto)</Th>
              <Th color={COLOR.red}>Total c/IVA</Th>
              <Th color={COLOR.red}>Ganancia neta</Th>
            </tr>
          </thead>
          <tbody>
            {DATA.fulfillment.map((r) => (
              <tr key={r.mes} className="border-b border-gray-100" style={{ background: r.hike ? "#FFF8F0" : undefined }}>
                <td className="px-3 py-2.5">
                  <strong>{r.mes}</strong>
                  <div className="text-[11px]" style={{ color: r.hike ? COLOR.amber : COLOR.muted }}>{r.subFc}</div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtNum(r.entregadas)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.hike ? COLOR.amber : COLOR.muted, fontWeight: r.hike ? 600 : 400 }}>${r.pEnt}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtNum(r.noEnt)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.hike ? COLOR.amber : COLOR.muted, fontWeight: r.hike ? 600 : 400 }}>${r.pNent}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: COLOR.green }}>{fmtArsExact(r.ingreso)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtArsExact(r.costoNeto)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>${r.totalIva.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: r.ganancia >= 0 ? COLOR.green : COLOR.red }}>{fmtArsExact(r.ganancia)}</td>
              </tr>
            ))}
            <tr style={{ background: COLOR.orangeLt, borderTop: `2px solid ${COLOR.orange}` }}>
              <td className="px-3 py-3 font-bold">TOTAL</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold">{fmtNum(t.entregadas)}</td>
              <td className="px-3 py-3 text-muted">—</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>{fmtNum(t.noEnt)}</td>
              <td className="px-3 py-3 text-muted">—</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.green }}>{fmtArsExact(t.ingreso)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>{fmtArsExact(t.costoNeto)}</td>
              <td className="px-3 py-3 text-right font-mono text-xs font-bold" style={{ color: COLOR.red }}>${t.totalIva.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
              <td className="px-3 py-3 text-right font-mono text-sm font-black" style={{ color: COLOR.red }}>{fmtArsExact(t.ganancia)}</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>

      {/* ANÁLISIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="text-base font-bold mb-3" style={{ color: COLOR.amber, fontFamily: "Georgia, serif" }}>⚠ El problema del fulfillment</div>
          <div className="text-xs text-gray-700 leading-relaxed space-y-2">
            <p>En <strong>enero y febrero</strong> el negocio era casi neutro — el costo de GV Nexus era casi igual al ingreso.</p>
            <p>En <strong>marzo GV Nexus subió 36%</strong>: de $990 a $1.350 por entregada. Justo cuando el volumen de FF creció de 479 a 1.739 órdenes — el peor momento para una suba de precios.</p>
            <p>En <strong>abril</strong> el volumen siguió creciendo (911 entregadas + 900 no entregadas) y la pérdida fue de <strong>-$470.850</strong> solo en fulfillment.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="text-base font-bold mb-3" style={{ color: COLOR.green, fontFamily: "Georgia, serif" }}>💡 ¿Qué se puede hacer?</div>
          <div className="text-xs text-gray-700 leading-relaxed space-y-2">
            <p>Para que el fulfillment sea rentable con los precios actuales de GV Nexus ($1.350/$675), Dropi debería cobrar más de $1.500 por entrega o reducir el % de no entregadas.</p>
            <p>Con la estructura actual: si el 100% fueran entregadas a $1.350, el margen sería solo $150 por orden. Con no entregadas al 50% (como en abr), el negocio da pérdida.</p>
            <p><strong>Punto de equilibrio aprox:</strong> necesita que las no entregadas sean menos del 10% del total para ser rentable a $1.500 de ingreso.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAJA REAL
// ═══════════════════════════════════════════════════════════════════
function CajaView() {
  return (
    <div>
      <InfoBox tone="green">
        💡 <strong>Caja real vs ingreso calculado.</strong> Los ingresos del archivo están calculados con las órdenes.
        Pero Fixy retiene el dinero antes de transferirlo. Esta pestaña muestra lo que
        <strong> efectivamente entró al banco o en efectivo</strong> y lo que todavía está por cobrar.
      </InfoBox>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <CajaKpi label="Banco BBVA" value={DATA.caja.bbva} sub="Oct + Nov '25 — intacto, sin movimientos" color={COLOR.green} />
        <CajaKpi label="Caja Efectivo" value={DATA.caja.efectivo} sub="Saldo operativo al 23/04/2026" color={COLOR.orange} />
        <CajaKpi label="Retenido por Fixy" value={DATA.caja.fixyRetenido} sub="Confirmado 07/04 · + Feb–Abr pendiente" color={COLOR.amber} />
      </div>

      <TableWrap title="Flujo de caja mensual — lo que entró y lo que salió">
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.greenLt }}>
            <tr>
              <Th color={COLOR.green} align="left">Mes</Th>
              <Th color={COLOR.green}>Fondos recibidos</Th>
              <Th color={COLOR.red}>Gastos pagados</Th>
              <Th color={COLOR.green}>Saldo al cierre</Th>
              <Th color={COLOR.muted} align="left">¿Qué pasó?</Th>
            </tr>
          </thead>
          <tbody>
            {DATA.cajaFlujo.map((r) => (
              <tr key={r.mes} className="border-b border-gray-100">
                <td className="px-3 py-2.5"><strong>{r.mes}</strong></td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.recibidos ? COLOR.green : COLOR.muted }}>
                  {r.recibidos ? `+${fmtArsExact(r.recibidos)}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: COLOR.red }}>{fmtArsExact(r.gastos)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: r.critico ? COLOR.red : r.saldo > 10000000 ? COLOR.green : COLOR.orange }}>
                  {fmtArsExact(r.saldo)}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-gray-600 italic">{r.nota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <TableWrap title="Estado de liquidaciones Fixy / Urbano" headerColor={COLOR.amber}>
        <table className="w-full text-sm">
          <thead style={{ background: COLOR.amberLt }}>
            <tr>
              <Th color={COLOR.amber} align="left">Período</Th>
              <Th color={COLOR.amber}>Recaudo bruto</Th>
              <Th color={COLOR.amber}>(-) Fixy</Th>
              <Th color={COLOR.amber}>Neto Dropi</Th>
              <Th color={COLOR.amber} align="left">Estado</Th>
              <Th color={COLOR.amber} align="left">Depósito</Th>
            </tr>
          </thead>
          <tbody>
            {DATA.liquidaciones.map((r) => (
              <tr key={r.periodo} className="border-b border-gray-100">
                <td className="px-3 py-2.5"><strong>{r.periodo}</strong></td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{r.bruto !== null ? fmtArsExact(r.bruto) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs" style={{ color: r.fixy !== null ? COLOR.red : COLOR.muted }}>{r.fixy !== null ? fmtArsExact(r.fixy) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-bold" style={{ color: r.estadoColor === "green" ? COLOR.green : r.estadoColor === "red" ? COLOR.red : COLOR.muted }}>
                  {r.neto !== null ? fmtArsExact(r.neto) : "—"}
                </td>
                <td className="px-3 py-2.5"><Badge tone={r.estadoColor}>{r.estado}</Badge></td>
                <td className="px-3 py-2.5 text-[11px] text-gray-600 italic">{r.deposito}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
