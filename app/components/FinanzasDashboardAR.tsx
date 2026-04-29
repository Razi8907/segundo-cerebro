"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─── Datos financieros DROPI S.A. Argentina ───
const DATA_AR = {
  caja: {
    fechaCorte: "2026-04-23",
    bbva: 74036442,
    efectivo: 33164298,
    fixyConfirmado: 468822348,
    fixyPendiente: "Feb + Mar 2026 a conciliar",
  },
  proyVsReal: [
    { mes: "Ene'26", ingProy: 2466093, ingReal: 15209400, egrProy: 18435000, egrReal: 11184090, resProy: -15968907, resReal: 4025310 },
    { mes: "Feb'26", ingProy: 2226196, ingReal: 14031300, egrProy: 22273400, egrReal: 14611912, resProy: -20047204, resReal: -580612 },
    { mes: "Mar'26", ingProy: 2211447, ingReal: 15833100, egrProy: 27409502, egrReal: 14102849, resProy: -25198055, resReal: 1730251 },
    { mes: "Abr'26", ingProy: 2823982, ingReal: 16199700, egrProy: 29576400, egrReal: 18758458, resProy: -26752418, resReal: -2558758 },
    { mes: "May'26", ingProy: 2965151, ingReal: null, egrProy: 30170200, egrReal: null, resProy: -27205049, resReal: null },
    { mes: "Jun'26", ingProy: 3261636, ingReal: null, egrProy: 34367200, egrReal: null, resProy: -31105564, resReal: null },
  ],
  ordenes: [
    { mes: "Ene'26", cod: 8193, ff: 308, total: 8501 },
    { mes: "Feb'26", cod: 7396, ff: 479, total: 7875 },
    { mes: "Mar'26", cod: 7347, ff: 1739, total: 9086 },
    { mes: "Abr'26", cod: 7839, ff: 1393, total: 9232 },
  ],
  fulfillment: [
    { mes: "Ene'26", ent: 184, nent: 194, ingreso: 276000, costo: 278190, ganancia: -2190, margen: -0.0079, pEnt: 990, pNent: 495 },
    { mes: "Feb'26", ent: null, nent: null, ingreso: null, costo: null, ganancia: 6090, margen: 0.0195, pEnt: 990, pNent: 495 },
    { mes: "Mar'26", ent: 268, nent: 123, ingreso: 402000, costo: 444825, ganancia: -42825, margen: -0.1065, pEnt: 1350, pNent: 675 },
    { mes: "Abr'26", ent: 911, nent: 900, ingreso: 1366500, costo: 1837350, ganancia: -470850, margen: -0.3446, pEnt: 1350, pNent: 675 },
  ],
  fulfillmentTotal: { ent: 1571, nent: 1419, ingreso: 2356500, costo: 2866275, ganancia: -509775, margen: -0.2163 },
  salarios: {
    enero: {
      empleados: [
        { nombre: "Busto Domanizcky, Raziel", cargo: "Country Manager", bruto: 2485000, neto: 2485000, obs: "Cubierto por Colombia (intercompany)" },
        { nombre: "Díaz Fajardo, Valeria", cargo: "Gerente Administrativa", bruto: 2200000, neto: 2200000, obs: "Honorario neto" },
        { nombre: "Campo, Keimar Gisel", cargo: "Ag. Servicio al Cliente", bruto: 1251738.67, neto: 1251738.67, obs: "Honorario neto" },
      ],
      total: 3451738.67,
    },
    febrero: {
      empleados: [
        { nombre: "Busto Domanizcky, Raziel", cargo: "Country Manager", bruto: 2485000, neto: 2485000, obs: "Cubierto por Colombia" },
        { nombre: "Díaz Fajardo, Valeria", cargo: "Gerente Administrativa", bruto: 2200000, neto: 2200000, obs: "Honorario neto" },
        { nombre: "Campo, Keimar Gisel", cargo: "Account Manager Junior", bruto: 1475237, neto: 1475237, obs: "" },
      ],
      total: 3675237,
    },
    marzo: {
      empleados: [
        { nombre: "Busto Domanizcky, Raziel", cargo: "Country Manager", bruto: 2485000, neto: 2485000, obs: "Cubierto por Colombia" },
        { nombre: "Díaz Fajardo, Valeria", cargo: "Gerente Administrativa", bruto: 2200000, neto: 2200000, obs: "Honorario neto" },
        { nombre: "Campo, Keimar Gisel", cargo: "Account Mgr — Liquidación Final", bruto: 1896316, neto: 1896316, obs: "Última liq." },
      ],
      total: 4096316.62,
    },
    abril: {
      empleados: [
        { nombre: "Busto Domanizcky, Raziel", cargo: "Country Manager", bruto: 2485000, neto: 6999999.9, obs: "Incluye saldos retroactivos" },
        { nombre: "Díaz Fajardo, Valeria", cargo: "Gerente Administrativa", bruto: 3000000, neto: 2199999.9, obs: "Honorario neto" },
        { nombre: "Tabossi Benitez, Julio C.", cargo: "Account Manager Senior", bruto: 2900000, neto: 2407000.08, obs: "Aporte 17% descontado" },
        { nombre: "Agüero, Franco Nicolás", cargo: "Account Manager Senior", bruto: 2800000, neto: 2323999.92, obs: "Aporte 17% descontado" },
      ],
      total: 9100000,
    },
    proyMayo: 14900000,
    proyJunio: 14900000,
  },
  pasivos: {
    items: [
      {
        concepto: "Salario Raziel Busto",
        operacion: "Colombia",
        montoOrig: 29000000,
        monedaOrig: "ARS",
        tc: 1,
        equivArs: 29000000,
        periodo: "Abril 2025–Abr 2026",
        estado: "⚠ Pendiente",
      },
      {
        concepto: "Gastos preoperativos Raziel",
        operacion: "Paraguay",
        montoOrig: 201641907,
        monedaOrig: "GS",
        tc: 4.8,
        equivArs: 42000000,
        periodo: "Mar–Nov 2025",
        estado: "⚠ Pendiente",
      },
    ],
    totalArs: 71000000,
  },
  cajaHistorial: {
    bbvaDepositos: [
      { periodo: "2° quinc oct 2025", fecha: "02/12/2025", bruto: 20320954, fixy: 4287973, neto: 16032982, estado: "✅ Acreditado" },
      { periodo: "1° quinc nov 2025", fecha: "10/12/2025", bruto: 76665279, fixy: 18650125, neto: 58003460, estado: "✅ Acreditado" },
    ],
    bbvaTotalNeto: 74036442,
    efectivo: [
      { fecha: "17/12/2025", concepto: "Adelanto efectivo Fixy", recibido: 15775000, gastos: 5977252, saldo: 9797748 },
      { fecha: "Feb 2026", concepto: "Fondos acordados Fixy", recibido: 30000000, gastos: 13036912, saldo: 17047288 },
      { fecha: "Abr 2026", concepto: "Saldo restante Fixy", recibido: 49670440, gastos: 19411464, saldo: 33164298 },
    ],
    efectivoSaldo: 33164298,
    fixyRetenciones: [
      { liq: "1° quinc dic 2025", ordenes: 6995, bruto: 199467358, fixy: 49741073, neto: 149726285, estado: "🔴 Retenido" },
      { liq: "2° quinc dic 2025", ordenes: 7526, bruto: 179480118, fixy: 47221745, neto: 132258373, estado: "🔴 Retenido" },
      { liq: "1° quinc ene 2026", ordenes: 3391, bruto: 95168984, fixy: 25291194, neto: 69877790, estado: "🔴 Retenido" },
      { liq: "2° quinc ene 2026", ordenes: null, bruto: null, fixy: null, neto: 116959900, estado: "🔴 Retenido" },
      { liq: "1°-2° quinc feb 2026", ordenes: null, bruto: null, fixy: null, neto: null, estado: "⏳ Pendiente concil." },
      { liq: "1°-2° quinc mar 2026", ordenes: null, bruto: null, fixy: null, neto: null, estado: "⏳ Pendiente concil." },
    ],
    fixyTotalConfirmado: 468822348,
  },
  parametros: {
    tarifaFlete: 1500,
    ticketCod: 60000,
    comisionCod: 0.005,
    pagoComunidades: 200,
    tcArsUsd: 1400,
  },
};

const fmtArs = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${v < 0 ? "-" : ""}$${(abs / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1e6) return `${v < 0 ? "-" : ""}$${(abs / 1e6).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (abs >= 1e3) return `${v < 0 ? "-" : ""}$${abs.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  return `${v < 0 ? "-" : ""}$${abs}`;
};

const fmtArsExact = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  return `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
};

const fmtPct = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(2)}%`;
};

const fmtNum = (v: number | null | undefined) => {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("es-AR");
};

type FinView = "resumen" | "proyreal" | "caja" | "salarios" | "pasivos" | "fulfillment";

export default function FinanzasDashboardAR() {
  const [view, setView] = useState<FinView>("resumen");

  const views: { key: FinView; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "proyreal", label: "Proyección vs Real" },
    { key: "caja", label: "Caja & Fixy" },
    { key: "salarios", label: "Salarios" },
    { key: "pasivos", label: "Pasivos Intercompany" },
    { key: "fulfillment", label: "Fulfillment" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap flex-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`text-xs px-4 py-2 rounded-full border transition-all ${
                view === v.key
                  ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                  : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0" style={{ background: "linear-gradient(135deg, #74ACDF, #F6B40E)" }}>DR</div>
        <div>
          <p className="text-sm font-semibold t-primary">DROPI S.A.</p>
          <p className="text-xs t-muted">CUIT 30-71916455-9 &middot; Argentina &middot; Dashboard Financiero</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] t-muted uppercase tracking-wider">Corte</p>
          <p className="text-xs t-secondary">{DATA_AR.caja.fechaCorte}</p>
        </div>
      </div>

      {view === "resumen" && <ResumenAR />}
      {view === "proyreal" && <ProyRealAR />}
      {view === "caja" && <CajaAR />}
      {view === "salarios" && <SalariosAR />}
      {view === "pasivos" && <PasivosAR />}
      {view === "fulfillment" && <FulfillmentAR />}
    </div>
  );
}

// ═══════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════
function ResumenAR() {
  const c = DATA_AR.caja;
  const cajaTotal = c.bbva + c.efectivo;
  const totalActivos = cajaTotal + c.fixyConfirmado;
  const totalDeudas = DATA_AR.pasivos.totalArs;
  const netoDisponible = totalActivos - totalDeudas;

  const ingRealYTD = DATA_AR.proyVsReal.filter((r) => r.ingReal !== null).reduce((s, r) => s + (r.ingReal || 0), 0);
  const egrRealYTD = DATA_AR.proyVsReal.filter((r) => r.egrReal !== null).reduce((s, r) => s + (r.egrReal || 0), 0);
  const resYTD = ingRealYTD - egrRealYTD;

  const ordenesYTD = DATA_AR.ordenes.reduce((s, o) => s + o.total, 0);

  const kpis = [
    { label: "Caja disponible hoy", val: fmtArs(cajaTotal), sub: `BBVA ${fmtArs(c.bbva)} + Efectivo ${fmtArs(c.efectivo)}`, color: "#3B6D11" },
    { label: "Retenido Fixy (confirmado)", val: fmtArs(c.fixyConfirmado), sub: "Dic'25 + Ene'26 — por cobrar", color: "#A35E11" },
    { label: "Deuda intercompany", val: fmtArs(-totalDeudas), sub: "Colombia + Paraguay", color: "#A32D2D" },
    { label: "Resultado neto YTD (Ene–Abr)", val: fmtArs(resYTD), sub: `${ordenesYTD.toLocaleString("es-AR")} órdenes movilizadas`, color: resYTD >= 0 ? "#3B6D11" : "#A32D2D" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-4">
            <p className="text-[11px] t-muted uppercase tracking-wider mb-1">{k.label}</p>
            <p className="text-xl font-medium t-primary" style={{ color: k.color }}>{k.val}</p>
            <p className="text-[11px] t-muted mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <p className="text-xs t-muted uppercase tracking-wider mb-3">Resultado neto mensual — Real vs Proyectado</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={DATA_AR.proyVsReal}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="mes" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} formatter={(v) => fmtArs(typeof v === "number" ? v : null)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="resReal" name="Real" fill="#74ACDF" />
            <Bar dataKey="resProy" name="Proyectado" fill="#F6B40E" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs t-muted uppercase tracking-wider mb-3">Estado de caja (al {c.fechaCorte})</p>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 t-secondary">🏦 Banco BBVA</td>
                <td className="py-2 text-right t-primary font-mono">{fmtArsExact(c.bbva)}</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 t-secondary">💵 Caja Efectivo</td>
                <td className="py-2 text-right t-primary font-mono">{fmtArsExact(c.efectivo)}</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 t-secondary">⏳ Retenido Fixy (conf.)</td>
                <td className="py-2 text-right text-amber-400 font-mono">{fmtArsExact(c.fixyConfirmado)}</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 t-secondary">⚠ Deuda intercompany</td>
                <td className="py-2 text-right text-red-400 font-mono">-{fmtArsExact(totalDeudas)}</td>
              </tr>
              <tr className="border-t-2 border-orange-500/40">
                <td className="py-2 font-semibold t-primary">Neto disponible (incl. Fixy)</td>
                <td className="py-2 text-right font-bold font-mono" style={{ color: netoDisponible >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtArsExact(netoDisponible)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="glass-card p-5">
          <p className="text-xs t-muted uppercase tracking-wider mb-3">YTD Ene–Abr 2026 (real)</p>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 t-secondary">Ingresos totales</td>
                <td className="py-2 text-right t-primary font-mono">{fmtArsExact(ingRealYTD)}</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 t-secondary">Egresos totales</td>
                <td className="py-2 text-right t-primary font-mono">{fmtArsExact(egrRealYTD)}</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 t-secondary">Órdenes movilizadas</td>
                <td className="py-2 text-right t-primary font-mono">{ordenesYTD.toLocaleString("es-AR")}</td>
              </tr>
              <tr className="border-t-2 border-orange-500/40">
                <td className="py-2 font-semibold t-primary">Resultado neto</td>
                <td className="py-2 text-right font-bold font-mono" style={{ color: resYTD >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtArsExact(resYTD)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] t-muted mt-3">Margen YTD: <span className="font-mono">{fmtPct(resYTD / ingRealYTD)}</span></p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// PROYECCIÓN VS REAL
// ═══════════════════════════════════════
function ProyRealAR() {
  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <p className="text-xs t-muted uppercase tracking-wider mb-3">Ingresos: Proyectado vs Real (mensual)</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={DATA_AR.proyVsReal}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="mes" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} formatter={(v) => fmtArs(typeof v === "number" ? v : null)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="ingReal" name="Ingresos Real" stroke="#74ACDF" strokeWidth={2} />
            <Line type="monotone" dataKey="ingProy" name="Ingresos Proy." stroke="#F6B40E" strokeWidth={2} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-3 px-4 text-left text-xs t-muted uppercase tracking-wider">Mes</th>
              <th className="py-3 px-4 text-right text-xs t-muted uppercase tracking-wider">Ing. Proy.</th>
              <th className="py-3 px-4 text-right text-xs t-muted uppercase tracking-wider">Ing. Real</th>
              <th className="py-3 px-4 text-right text-xs t-muted uppercase tracking-wider">Egr. Proy.</th>
              <th className="py-3 px-4 text-right text-xs t-muted uppercase tracking-wider">Egr. Real</th>
              <th className="py-3 px-4 text-right text-xs t-muted uppercase tracking-wider">Res. Proy.</th>
              <th className="py-3 px-4 text-right text-xs t-muted uppercase tracking-wider">Res. Real</th>
            </tr>
          </thead>
          <tbody>
            {DATA_AR.proyVsReal.map((r) => (
              <tr key={r.mes} className="border-b border-gray-800/50">
                <td className="py-2 px-4 font-medium t-primary">{r.mes}</td>
                <td className="py-2 px-4 text-right font-mono t-secondary">{fmtArsExact(r.ingProy)}</td>
                <td className="py-2 px-4 text-right font-mono t-primary">{fmtArsExact(r.ingReal)}</td>
                <td className="py-2 px-4 text-right font-mono t-secondary">{fmtArsExact(r.egrProy)}</td>
                <td className="py-2 px-4 text-right font-mono t-primary">{fmtArsExact(r.egrReal)}</td>
                <td className="py-2 px-4 text-right font-mono" style={{ color: r.resProy >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtArsExact(r.resProy)}</td>
                <td className="py-2 px-4 text-right font-mono font-semibold" style={{ color: (r.resReal ?? 0) >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtArsExact(r.resReal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card p-4 border-l-2 border-amber-500/50 bg-amber-500/5">
        <p className="text-xs t-secondary">
          <span className="font-semibold text-amber-400">Nota:</span> May–Jun 2026 son proyecciones. La proyección original asumió volúmenes mucho menores; los ingresos reales superan ~6× a los proyectados gracias al volumen de órdenes COD.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// CAJA & FIXY
// ═══════════════════════════════════════
function CajaAR() {
  const ch = DATA_AR.cajaHistorial;

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <p className="text-xs t-muted uppercase tracking-wider mb-3">▶ Depósitos en Banco BBVA</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-xs t-muted">Período</th>
                <th className="py-2 px-3 text-left text-xs t-muted">Fecha depósito</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Recaudo bruto COD</th>
                <th className="py-2 px-3 text-right text-xs t-muted">(-) Fixy</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Depósito neto</th>
                <th className="py-2 px-3 text-left text-xs t-muted">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ch.bbvaDepositos.map((d) => (
                <tr key={d.periodo} className="border-b border-gray-800/50">
                  <td className="py-2 px-3 t-primary">{d.periodo}</td>
                  <td className="py-2 px-3 t-secondary">{d.fecha}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtArsExact(d.bruto)}</td>
                  <td className="py-2 px-3 text-right font-mono text-red-400">{fmtArsExact(d.fixy)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{fmtArsExact(d.neto)}</td>
                  <td className="py-2 px-3 text-xs">{d.estado}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-orange-500/40">
                <td colSpan={4} className="py-2 px-3 font-semibold t-primary">Total acreditado en BBVA</td>
                <td className="py-2 px-3 text-right font-bold font-mono text-emerald-400">{fmtArsExact(ch.bbvaTotalNeto)}</td>
                <td className="py-2 px-3 text-xs t-muted">Sin movimientos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs t-muted uppercase tracking-wider mb-3">▶ Fondos en efectivo (Fixy)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-xs t-muted">Fecha</th>
                <th className="py-2 px-3 text-left text-xs t-muted">Concepto</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Recibido</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Gastos</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {ch.efectivo.map((e) => (
                <tr key={e.fecha} className="border-b border-gray-800/50">
                  <td className="py-2 px-3 t-secondary">{e.fecha}</td>
                  <td className="py-2 px-3 t-primary">{e.concepto}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtArsExact(e.recibido)}</td>
                  <td className="py-2 px-3 text-right font-mono text-red-400">{fmtArsExact(e.gastos)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{fmtArsExact(e.saldo)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-orange-500/40">
                <td colSpan={4} className="py-2 px-3 font-semibold t-primary">Saldo disponible</td>
                <td className="py-2 px-3 text-right font-bold font-mono text-emerald-400">{fmtArsExact(ch.efectivoSaldo)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs t-muted uppercase tracking-wider mb-3">▶ Fondos retenidos por Fixy</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-xs t-muted">Liquidación</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Órdenes</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Recaudo bruto</th>
                <th className="py-2 px-3 text-right text-xs t-muted">(-) Fixy</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Neto retenido</th>
                <th className="py-2 px-3 text-left text-xs t-muted">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ch.fixyRetenciones.map((r) => (
                <tr key={r.liq} className="border-b border-gray-800/50">
                  <td className="py-2 px-3 t-primary">{r.liq}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtNum(r.ordenes)}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtArsExact(r.bruto)}</td>
                  <td className="py-2 px-3 text-right font-mono text-red-400">{fmtArsExact(r.fixy)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-amber-400">{fmtArsExact(r.neto)}</td>
                  <td className="py-2 px-3 text-xs">{r.estado}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-orange-500/40">
                <td colSpan={4} className="py-2 px-3 font-semibold t-primary">Total confirmado retenido</td>
                <td className="py-2 px-3 text-right font-bold font-mono text-amber-400">{fmtArsExact(ch.fixyTotalConfirmado)}</td>
                <td className="py-2 px-3 text-xs t-muted">Conf. Fixy 07/04</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-4 border-l-2 border-amber-500/50 bg-amber-500/5">
        <p className="text-xs t-secondary">
          <span className="font-semibold text-amber-400">⚠</span> Los fondos retenidos de febrero y marzo 2026 quedan pendientes de conciliación con Fixy. La cifra final de retenciones puede crecer.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// SALARIOS
// ═══════════════════════════════════════
function SalariosAR() {
  const meses: { key: keyof typeof DATA_AR.salarios; label: string }[] = [
    { key: "enero", label: "Enero 2026" },
    { key: "febrero", label: "Febrero 2026" },
    { key: "marzo", label: "Marzo 2026" },
    { key: "abril", label: "Abril 2026" },
  ];

  const evolucion = [
    { mes: "Ene'26", total: DATA_AR.salarios.enero.total },
    { mes: "Feb'26", total: DATA_AR.salarios.febrero.total },
    { mes: "Mar'26", total: DATA_AR.salarios.marzo.total },
    { mes: "Abr'26", total: DATA_AR.salarios.abril.total },
    { mes: "May'26 (proy)", total: DATA_AR.salarios.proyMayo },
    { mes: "Jun'26 (proy)", total: DATA_AR.salarios.proyJunio },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <p className="text-xs t-muted uppercase tracking-wider mb-3">Evolución de la nómina mensual</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={evolucion}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="mes" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} formatter={(v) => fmtArs(typeof v === "number" ? v : null)} />
            <Bar dataKey="total" name="Total nómina" fill="#74ACDF" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {meses.map((m) => {
        const data = DATA_AR.salarios[m.key] as { empleados: { nombre: string; cargo: string; bruto: number; neto: number; obs: string }[]; total: number };
        return (
          <div key={m.key} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs t-muted uppercase tracking-wider">{m.label}</p>
              <p className="text-sm font-semibold text-orange-400">Total: <span className="font-mono">{fmtArsExact(data.total)}</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 px-3 text-left text-xs t-muted">Empleado</th>
                    <th className="py-2 px-3 text-left text-xs t-muted">Cargo</th>
                    <th className="py-2 px-3 text-right text-xs t-muted">Bruto</th>
                    <th className="py-2 px-3 text-right text-xs t-muted">Neto</th>
                    <th className="py-2 px-3 text-left text-xs t-muted">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {data.empleados.map((e, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2 px-3 t-primary font-medium">{e.nombre}</td>
                      <td className="py-2 px-3 t-secondary">{e.cargo}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmtArsExact(e.bruto)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmtArsExact(e.neto)}</td>
                      <td className="py-2 px-3 text-xs t-muted">{e.obs || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════
// PASIVOS INTERCOMPANY
// ═══════════════════════════════════════
function PasivosAR() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DATA_AR.pasivos.items.map((p) => (
          <div key={p.operacion} className="glass-card p-5 border-l-2 border-amber-500/50">
            <p className="text-xs t-muted uppercase tracking-wider mb-1">{p.operacion}</p>
            <p className="text-sm font-semibold t-primary mb-3">{p.concepto}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-800/50 py-1">
                <span className="t-secondary">Monto original</span>
                <span className="font-mono t-primary">{p.monedaOrig === "GS" ? "GS " : "$"}{p.montoOrig.toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/50 py-1">
                <span className="t-secondary">Tipo de cambio</span>
                <span className="font-mono t-primary">{p.tc === 1 ? "—" : `${p.tc} GS/ARS`}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/50 py-1">
                <span className="t-secondary">Equivalente ARS</span>
                <span className="font-mono font-semibold text-red-400">{fmtArsExact(p.equivArs)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/50 py-1">
                <span className="t-secondary">Período</span>
                <span className="t-primary text-xs">{p.periodo}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="t-secondary">Estado</span>
                <span className="text-amber-400 text-xs">{p.estado}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-5 bg-orange-500/5 border border-orange-500/30">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold t-primary">Total pasivos intercompany</p>
          <p className="text-2xl font-bold font-mono text-red-400">{fmtArsExact(DATA_AR.pasivos.totalArs)}</p>
        </div>
        <p className="text-xs t-muted mt-2">
          Colombia ($29M, salario Raziel cubierto por la operación colombiana hasta marzo 2026) + Paraguay ($42M, gastos preoperativos abonados por la operación paraguaya).
        </p>
      </div>

      <div className="glass-card p-4 border-l-2 border-emerald-500/50 bg-emerald-500/5">
        <p className="text-xs t-secondary">
          💡 Con <span className="font-mono font-semibold text-emerald-400">{fmtArsExact(DATA_AR.caja.bbva + DATA_AR.caja.efectivo)}</span> de caja líquida + <span className="font-mono font-semibold text-amber-400">{fmtArsExact(DATA_AR.caja.fixyConfirmado)}</span> retenidos por cobrar a Fixy, la empresa tiene capacidad de cubrir las deudas intercompany cuando se concrete la conciliación.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// FULFILLMENT
// ═══════════════════════════════════════
function FulfillmentAR() {
  const t = DATA_AR.fulfillmentTotal;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-[11px] t-muted uppercase tracking-wider mb-1">Total entregadas</p>
          <p className="text-xl font-medium text-emerald-400 font-mono">{t.ent.toLocaleString("es-AR")}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] t-muted uppercase tracking-wider mb-1">Total no entregadas</p>
          <p className="text-xl font-medium text-red-400 font-mono">{t.nent.toLocaleString("es-AR")}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] t-muted uppercase tracking-wider mb-1">Ganancia neta FF</p>
          <p className="text-xl font-medium font-mono" style={{ color: t.ganancia >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtArsExact(t.ganancia)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] t-muted uppercase tracking-wider mb-1">Margen FF</p>
          <p className="text-xl font-medium font-mono" style={{ color: t.margen >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtPct(t.margen)}</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <p className="text-xs t-muted uppercase tracking-wider mb-3">Análisis Fulfillment mensual</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-xs t-muted">Mes</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Entregadas</th>
                <th className="py-2 px-3 text-right text-xs t-muted">No entregadas</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Ingreso</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Costo GV Nexus</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Ganancia</th>
                <th className="py-2 px-3 text-right text-xs t-muted">Margen</th>
              </tr>
            </thead>
            <tbody>
              {DATA_AR.fulfillment.map((f) => (
                <tr key={f.mes} className="border-b border-gray-800/50">
                  <td className="py-2 px-3 font-medium t-primary">{f.mes}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtNum(f.ent)}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtNum(f.nent)}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtArsExact(f.ingreso)}</td>
                  <td className="py-2 px-3 text-right font-mono text-red-400">{fmtArsExact(f.costo)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold" style={{ color: (f.ganancia ?? 0) >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtArsExact(f.ganancia)}</td>
                  <td className="py-2 px-3 text-right font-mono" style={{ color: (f.margen ?? 0) >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtPct(f.margen)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-orange-500/40">
                <td className="py-2 px-3 font-semibold t-primary">TOTAL</td>
                <td className="py-2 px-3 text-right font-mono font-semibold">{t.ent.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold">{t.nent.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold">{fmtArsExact(t.ingreso)}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-red-400">{fmtArsExact(t.costo)}</td>
                <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: t.ganancia >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtArsExact(t.ganancia)}</td>
                <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: t.margen >= 0 ? "#3B6D11" : "#A32D2D" }}>{fmtPct(t.margen)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card p-4 border-l-2 border-red-500/50 bg-red-500/5">
        <p className="text-xs t-secondary">
          <span className="font-semibold text-red-400">⚠</span> El fulfillment está operando con margen negativo acumulado de <span className="font-mono font-semibold">{fmtPct(t.margen)}</span>. El costo GV Nexus por orden no entregada ($675–$495) erosiona la ganancia. Abril empeoró el margen al -34% por mayor volumen de no entregadas (900).
        </p>
      </div>
    </div>
  );
}
