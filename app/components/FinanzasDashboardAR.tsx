"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useFinanzasAR } from "../lib/useFinanzasAR";
import type { FinanzasARData, MesKey } from "../lib/finanzas-ar-types";
import FinanzasEditor from "./FinanzasEditor";

// ═══════════════════════════════════════════════════════════════════
// DERIVADOS — los insights reales de Segundo Cerebro
// ═══════════════════════════════════════════════════════════════════
function derived(input: FinanzasARData) {
  const orderedKeys: MesKey[] = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const presentKeys = orderedKeys.filter((k) => !!input.meses[k]);

  const monthly = presentKeys.map((m) => {
    const f = input.meses[m]!;
    const ingresoDropi = f.fleteCod + f.comisionCod + f.fleteFf;
    const totalGastos = f.egrFijos + f.egrVar;
    const resultado = ingresoDropi - totalGastos;
    const margenPct = ingresoDropi > 0 ? resultado / ingresoDropi : 0;
    const ingresoPorOrden = f.movilizadas > 0 ? ingresoDropi / f.movilizadas : 0;
    const costoPorOrden = f.movilizadas > 0 ? totalGastos / f.movilizadas : 0;
    const margenPorOrden = ingresoPorOrden - costoPorOrden;
    const ffTotal = f.ffEntregadas + f.ffNoEntregadas;
    const pctNoEntregadas = ffTotal > 0 ? f.ffNoEntregadas / ffTotal : 0;
    const ffIngreso = f.ffEntregadas * 1500;
    const ffCosto = f.ffEntregadas * f.ffPrecioEnt + f.ffNoEntregadas * f.ffPrecioNoEnt;
    const ffGanancia = ffIngreso - ffCosto;
    return { mes: f.label, m, ...f, ingresoDropi, totalGastos, resultado, margenPct, ingresoPorOrden, costoPorOrden, margenPorOrden, ffTotal, pctNoEntregadas, ffIngreso, ffCosto, ffGanancia };
  });

  const totales = monthly.reduce(
    (acc, r) => ({
      movilizadas: acc.movilizadas + r.movilizadas,
      ingresoDropi: acc.ingresoDropi + r.ingresoDropi,
      egrFijos: acc.egrFijos + r.egrFijos,
      egrVar: acc.egrVar + r.egrVar,
      totalGastos: acc.totalGastos + r.totalGastos,
      resultado: acc.resultado + r.resultado,
      ffEntregadas: acc.ffEntregadas + r.ffEntregadas,
      ffNoEntregadas: acc.ffNoEntregadas + r.ffNoEntregadas,
      ffIngreso: acc.ffIngreso + r.ffIngreso,
      ffCosto: acc.ffCosto + r.ffCosto,
      ffGanancia: acc.ffGanancia + r.ffGanancia,
    }),
    { movilizadas: 0, ingresoDropi: 0, egrFijos: 0, egrVar: 0, totalGastos: 0, resultado: 0, ffEntregadas: 0, ffNoEntregadas: 0, ffIngreso: 0, ffCosto: 0, ffGanancia: 0 },
  );

  const margenYtd = totales.ingresoDropi > 0 ? totales.resultado / totales.ingresoDropi : 0;
  const cajaLiquida = input.caja.bbva + input.caja.efectivo;
  const monthsCount = Math.max(monthly.length, 1);
  const burnMensualPromedio = totales.totalGastos / monthsCount;
  const ingresoMensualPromedio = totales.ingresoDropi / monthsCount;
  const burnNeto = Math.max(burnMensualPromedio - ingresoMensualPromedio, 0);
  const runwayMesesSinFixy = burnNeto > 0 ? cajaLiquida / burnNeto : 999;

  // Acumulado mensual
  let acum = 0;
  const acumulado = monthly.map((r) => ({ mes: r.mes, m: r.m, resultado: r.resultado, acumulado: (acum += r.resultado) }));

  // Punto de equilibrio FF: tomamos los precios del último mes con FF activo
  const ultimo = monthly[monthly.length - 1];
  const pEnt = ultimo?.ffPrecioEnt ?? 1350;
  const pNoEnt = ultimo?.ffPrecioNoEnt ?? 675;
  const bepRatio = pNoEnt > 0 ? (1500 - pEnt) / pNoEnt : 0;
  const bepNeNoEntPctActual = bepRatio > 0 ? bepRatio / (1 + bepRatio) : 0;

  return {
    monthly,
    totales,
    margenYtd,
    cajaLiquida,
    burnMensualPromedio,
    ingresoMensualPromedio,
    burnNeto,
    runwayMesesSinFixy,
    acumulado,
    bepNeNoEntPctActual,
    // datos crudos para los views
    caja: input.caja,
    deuda: input.deuda,
    salarioRazielAr: input.salarioRazielAr,
    gastosBreakdownYtd: input.gastosBreakdownYtd,
    liquidaciones: input.liquidaciones,
  };
}

// ─── Formatters ───
const fmtArs = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}MM`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const fmtArsExact = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
};

const fmtNum = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("es-AR");
};

// Color helpers (paleta orange-blue-green-red, sin amarillo)
const C = {
  orange: "#E8692A",
  blue: "#74ACDF",
  green: "#10B981",     // emerald
  greenDk: "#059669",
  red: "#EF4444",
  redDk: "#DC2626",
  amber: "#F59E0B",
  gray: "#6B7280",
};

type View = "salud" | "caja" | "pnl" | "fulfillment" | "liquidaciones";

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function FinanzasDashboardAR() {
  const [view, setView] = useState<View>("salud");
  const [editing, setEditing] = useState(false);
  const { data, updatedAt, canEdit, loading, saving, save } = useFinanzasAR();
  const d = useMemo(() => derived(data), [data]);

  const tabs: { key: View; label: string }[] = [
    { key: "salud", label: "🩺 Salud financiera" },
    { key: "caja", label: "💰 Caja & Runway" },
    { key: "pnl", label: "📊 Resultado P&L" },
    { key: "fulfillment", label: "📦 Fulfillment" },
    { key: "liquidaciones", label: "🏦 Liquidaciones Fixy" },
  ];

  const handleSave = async (next: FinanzasARData) => {
    const res = await save(next);
    if (res.ok) setEditing(false);
    return res;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`text-xs px-4 py-2 rounded-full border transition-all ${
                view === t.key
                  ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                  : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-[10px] t-muted">
              Actualizado {new Date(updatedAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-all"
            >
              ✏ Editar datos
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-xs t-muted text-center py-4">Cargando datos financieros…</div>}

      {!loading && view === "salud" && <SaludView d={d} />}
      {!loading && view === "caja" && <CajaView d={d} />}
      {!loading && view === "pnl" && <PnlView d={d} />}
      {!loading && view === "fulfillment" && <FulfillmentView d={d} />}
      {!loading && view === "liquidaciones" && <LiquidacionesView d={d} />}

      {editing && (
        <FinanzasEditor
          initial={data}
          saving={saving}
          onCancel={() => setEditing(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: SALUD FINANCIERA
// ═══════════════════════════════════════════════════════════════════
function SaludView({ d }: { d: ReturnType<typeof derived> }) {
  const ultimo = d.monthly[d.monthly.length - 1];
  const alertas = buildAlertas(d);

  return (
    <div className="space-y-6">
      {/* KPIs principales — métricas DERIVADAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Margen YTD (ene–abr)"
          value={fmtArs(d.totales.resultado)}
          sub={`${fmtPct(d.margenYtd)} sobre ingreso · ${fmtNum(d.totales.movilizadas)} órdenes`}
          tone={d.totales.resultado >= 0 ? "green" : "red"}
        />
        <KpiCard
          label="Margen por orden — Abr"
          value={fmtArs(ultimo.margenPorOrden)}
          sub={`Ingreso ${fmtArs(ultimo.ingresoPorOrden)} − Costo ${fmtArs(ultimo.costoPorOrden)}`}
          tone={ultimo.margenPorOrden >= 0 ? "green" : "red"}
        />
        <KpiCard
          label="Caja líquida hoy"
          value={fmtArs(d.cajaLiquida)}
          sub={`BBVA ${fmtArs(d.caja.bbva)} + Efectivo ${fmtArs(d.caja.efectivo)}`}
          tone="blue"
        />
        <KpiCard
          label="Cobranza pendiente Fixy"
          value={fmtArs(d.caja.fixyConfirmado)}
          sub={`Confirmado dic'25 + ene'26 · feb–abr aún por conciliar`}
          tone="amber"
        />
      </div>

      {/* Semáforo mensual */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold t-primary">Semáforo de salud mensual</h3>
          <span className="text-[11px] t-muted">Verde: margen ≥ 0 · Rojo: pérdida</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {d.monthly.map((r) => {
            const ok = r.resultado >= 0;
            return (
              <div key={r.mes} className="rounded-lg p-3 text-center" style={{ background: ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${ok ? C.green : C.red}40` }}>
                <div className="text-2xl mb-1">{ok ? "🟢" : "🔴"}</div>
                <div className="text-xs font-semibold t-primary">{r.mes}</div>
                <div className="font-mono text-sm font-bold mt-1" style={{ color: ok ? C.green : C.red }}>
                  {fmtArs(r.resultado)}
                </div>
                <div className="text-[10px] t-muted mt-0.5">margen {fmtPct(r.margenPct)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alertas accionables */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold t-primary mb-3">Alertas accionables</h3>
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <Alerta key={i} {...a} />
          ))}
        </div>
      </div>

      {/* Tendencia margen y margen/orden */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold t-primary mb-3">Tendencia margen mensual</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v) => fmtArsExact(typeof v === "number" ? v : null)} contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              <Bar dataKey="resultado" name="Resultado">
                {d.monthly.map((r, i) => (
                  <Cell key={i} fill={r.resultado >= 0 ? C.green : C.red} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold t-primary mb-3">Margen por orden movilizada</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => fmtArsExact(typeof v === "number" ? v : null)} contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" label={{ value: "Break-even", fill: "#888", fontSize: 10, position: "right" }} />
              <Line type="monotone" dataKey="ingresoPorOrden" name="Ingreso/orden" stroke={C.orange} strokeWidth={2} dot={{ fill: C.orange, r: 4 }} />
              <Line type="monotone" dataKey="costoPorOrden" name="Costo/orden" stroke={C.red} strokeWidth={2} dot={{ fill: C.red, r: 4 }} />
              <Line type="monotone" dataKey="margenPorOrden" name="Margen/orden" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[11px] t-muted mt-2">El costo por orden subió un {fmtPct((ultimo.costoPorOrden / d.monthly[0].costoPorOrden) - 1)} de Ene a Abr — egresos variables crecen más rápido que el volumen.</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: CAJA & RUNWAY
// ═══════════════════════════════════════════════════════════════════
function CajaView({ d }: { d: ReturnType<typeof derived> }) {
  // 3 escenarios
  const burnNeto = d.burnNeto;
  const cajaActual = d.cajaLiquida;
  const escPesimista = {
    nombre: "Pesimista",
    desc: "Fixy NO paga el retenido + Argentina asume salario Raziel desde abr'26",
    cajaInicial: cajaActual,
    burnExtra: d.salarioRazielAr, // se suma al burn
    cobranzaFixy: 0,
    runway: cajaActual / Math.max((d.burnMensualPromedio + d.salarioRazielAr) - d.ingresoMensualPromedio, 1),
  };
  const escBase = {
    nombre: "Base",
    desc: "Fixy paga retenido confirmado ($468.8M) en próximos 3 meses + Arg asume Raziel",
    cajaInicial: cajaActual + d.caja.fixyConfirmado,
    burnExtra: d.salarioRazielAr,
    cobranzaFixy: d.caja.fixyConfirmado,
    runway: (cajaActual + d.caja.fixyConfirmado) / Math.max((d.burnMensualPromedio + d.salarioRazielAr) - d.ingresoMensualPromedio, 1),
  };
  const escOptimista = {
    nombre: "Optimista",
    desc: "Fixy paga TODO (confirmado + feb–abr conciliado) + crecimiento de margen",
    cajaInicial: cajaActual + d.caja.fixyConfirmado + d.caja.fixyPendienteEst,
    burnExtra: d.salarioRazielAr,
    cobranzaFixy: d.caja.fixyConfirmado + d.caja.fixyPendienteEst,
    runway: 999, // efectivamente "indefinido"
  };

  // Proyección 12 meses bajo cada escenario (caja al cierre de cada mes)
  const proyeccion = Array.from({ length: 13 }, (_, i) => {
    const burnP = d.burnMensualPromedio + d.salarioRazielAr - d.ingresoMensualPromedio;
    const cajaPesim = Math.max(escPesimista.cajaInicial - burnP * i, 0);
    // Base: la cobranza Fixy llega prorrateada en los primeros 3 meses
    const fixyMes = i < 3 ? d.caja.fixyConfirmado / 3 : 0;
    const cajaBase = Math.max(escBase.cajaInicial - burnP * i + (i >= 3 ? d.caja.fixyConfirmado : (d.caja.fixyConfirmado / 3) * i) - d.caja.fixyConfirmado, 0);
    // Optimista: igual que base + flujo gradual del pendiente
    const cajaOpt = Math.max(escOptimista.cajaInicial - burnP * i, 0);
    return { mes: `M${i}`, mesIdx: i, pesimista: cajaPesim, base: cajaBase + escBase.cajaInicial - cajaActual, optimista: cajaOpt };
  });

  return (
    <div className="space-y-6">
      {/* KPIs caja */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Banco BBVA" value={fmtArs(d.caja.bbva)} sub="Sin movimientos desde dic'25" tone="green" />
        <KpiCard label="Caja Efectivo" value={fmtArs(d.caja.efectivo)} sub="Saldo operativo al 23/04" tone="orange" />
        <KpiCard label="Retenido Fixy (conf.)" value={fmtArs(d.caja.fixyConfirmado)} sub="Dic'25 + Ene'26" tone="amber" />
        <KpiCard label="Burn neto promedio" value={fmtArs(d.burnNeto)} sub="Egresos − Ingresos / mes" tone="red" />
      </div>

      {/* 3 escenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <EscenarioCard tone="red" titulo="🔴 Pesimista" desc={escPesimista.desc} cajaInicial={escPesimista.cajaInicial} runway={escPesimista.runway} />
        <EscenarioCard tone="orange" titulo="🟠 Base" desc={escBase.desc} cajaInicial={escBase.cajaInicial} runway={escBase.runway} />
        <EscenarioCard tone="green" titulo="🟢 Optimista" desc={escOptimista.desc} cajaInicial={escOptimista.cajaInicial} runway={escOptimista.runway} />
      </div>

      {/* Proyección 12 meses */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold t-primary mb-3">Proyección de caja — próximos 12 meses</h3>
        <p className="text-[11px] t-muted mb-3">Asumiendo burn promedio ene–abr {fmtArs(d.burnNeto)}/mes neto + salario Raziel asumido por Argentina.</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={proyeccion}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="mes" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip formatter={(v) => fmtArs(typeof v === "number" ? v : null)} contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="optimista" name="Optimista" stroke={C.green} fill={C.green} fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="base" name="Base" stroke={C.orange} fill={C.orange} fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="pesimista" name="Pesimista" stroke={C.red} fill={C.red} fillOpacity={0.15} strokeWidth={2} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Deuda intercompany */}
      <div className="glass-card p-5 border-l-2 border-amber-500/50">
        <h3 className="text-sm font-semibold t-primary mb-3">⚠ Deuda intercompany — no aparece en P&L</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[11px] t-muted uppercase tracking-wider">Colombia</div>
            <div className="font-mono font-bold text-red-400">{fmtArs(d.deuda.colombia)}</div>
            <div className="text-[11px] t-muted">Salario Raziel abr'25–mar'26</div>
          </div>
          <div>
            <div className="text-[11px] t-muted uppercase tracking-wider">Paraguay</div>
            <div className="font-mono font-bold text-red-400">{fmtArs(d.deuda.paraguay)}</div>
            <div className="text-[11px] t-muted">Gastos preoperativos mar–nov'25</div>
          </div>
          <div>
            <div className="text-[11px] t-muted uppercase tracking-wider">Total a devolver</div>
            <div className="font-mono font-bold text-red-400 text-lg">{fmtArs(d.deuda.colombia + d.deuda.paraguay)}</div>
            <div className="text-[11px] t-muted">{fmtPct((d.deuda.colombia + d.deuda.paraguay) / (d.cajaLiquida + d.caja.fixyConfirmado))} de caja+Fixy</div>
          </div>
        </div>
        <p className="text-[11px] t-secondary mt-3 leading-relaxed">
          Si Argentina sumara estos {fmtArs(d.deuda.colombia + d.deuda.paraguay)} a sus egresos YTD, el resultado pasaría de +{fmtArs(d.totales.resultado)} a {fmtArs(d.totales.resultado - d.deuda.colombia - d.deuda.paraguay)}.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: P&L
// ═══════════════════════════════════════════════════════════════════
function PnlView({ d }: { d: ReturnType<typeof derived> }) {
  const totalGastosYtd = d.gastosBreakdownYtd.reduce((s, g) => s + g.monto, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingreso Dropi YTD" value={fmtArs(d.totales.ingresoDropi)} sub={`${fmtNum(d.totales.movilizadas)} órdenes movilizadas`} tone="orange" />
        <KpiCard label="Egresos totales YTD" value={fmtArs(d.totales.totalGastos)} sub={`Fijos ${fmtArs(d.totales.egrFijos)} + Var ${fmtArs(d.totales.egrVar)}`} tone="red" />
        <KpiCard label="Resultado YTD" value={fmtArs(d.totales.resultado)} sub={`Margen ${fmtPct(d.margenYtd)}`} tone={d.totales.resultado >= 0 ? "green" : "red"} />
        <KpiCard label="Costo/orden vs Ingreso/orden" value={`${fmtArs(d.totales.totalGastos / d.totales.movilizadas)} / ${fmtArs(d.totales.ingresoDropi / d.totales.movilizadas)}`} sub={`Margen unitario ${fmtArs((d.totales.ingresoDropi - d.totales.totalGastos) / d.totales.movilizadas)}`} tone="blue" />
      </div>

      {/* Tabla mensual con margen */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <Th align="left">Mes</Th>
              <Th>Movilizadas</Th>
              <Th>Ingreso Dropi</Th>
              <Th>Egr. fijos</Th>
              <Th>Egr. variables</Th>
              <Th>Resultado</Th>
              <Th>Margen %</Th>
              <Th>Margen/orden</Th>
            </tr>
          </thead>
          <tbody>
            {d.monthly.map((r) => (
              <tr key={r.mes} className="border-b border-gray-800/50">
                <Td align="left" bold>{r.mes}</Td>
                <Td mono>{fmtNum(r.movilizadas)}</Td>
                <Td mono color={C.orange}>{fmtArs(r.ingresoDropi)}</Td>
                <Td mono color={C.red}>{fmtArs(-r.egrFijos)}</Td>
                <Td mono color={C.red}>{fmtArs(-r.egrVar)}</Td>
                <Td mono bold color={r.resultado >= 0 ? C.green : C.red}>{fmtArs(r.resultado)}</Td>
                <Td mono color={r.margenPct >= 0 ? C.green : C.red}>{fmtPct(r.margenPct)}</Td>
                <Td mono color={r.margenPorOrden >= 0 ? C.green : C.red}>{fmtArs(r.margenPorOrden)}</Td>
              </tr>
            ))}
            <tr style={{ background: "rgba(232,105,42,0.08)", borderTop: `2px solid ${C.orange}` }}>
              <Td align="left" bold>YTD</Td>
              <Td mono bold>{fmtNum(d.totales.movilizadas)}</Td>
              <Td mono bold color={C.orange}>{fmtArs(d.totales.ingresoDropi)}</Td>
              <Td mono bold color={C.red}>{fmtArs(-d.totales.egrFijos)}</Td>
              <Td mono bold color={C.red}>{fmtArs(-d.totales.egrVar)}</Td>
              <Td mono bold color={d.totales.resultado >= 0 ? C.green : C.red}>{fmtArs(d.totales.resultado)}</Td>
              <Td mono bold color={d.margenYtd >= 0 ? C.green : C.red}>{fmtPct(d.margenYtd)}</Td>
              <Td mono bold color={C.blue}>{fmtArs((d.totales.ingresoDropi - d.totales.totalGastos) / d.totales.movilizadas)}</Td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Acumulado */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold t-primary mb-3">Resultado acumulado mes a mes</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={d.acumulado}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="mes" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
            <Tooltip formatter={(v) => fmtArsExact(typeof v === "number" ? v : null)} contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
            <Bar dataKey="acumulado" name="Acumulado">
              {d.acumulado.map((r, i) => (
                <Cell key={i} fill={r.acumulado >= 0 ? C.green : C.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown gastos */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold t-primary mb-3">¿En qué se gastó? — Acumulado Ene–Abr</h3>
        <div className="space-y-2">
          {d.gastosBreakdownYtd.sort((a, b) => b.monto - a.monto).map((g) => {
            const pct = g.monto / totalGastosYtd;
            return (
              <div key={g.concepto} className="flex items-center gap-3">
                <div className="w-44 text-sm t-secondary truncate">{g.concepto}</div>
                <div className="flex-1 h-6 bg-gray-800/40 rounded overflow-hidden relative">
                  <div className="h-full" style={{ width: `${pct * 100}%`, background: C.orange }} />
                  <div className="absolute inset-0 flex items-center px-2 text-[11px] font-mono t-primary">
                    {fmtArs(g.monto)} <span className="ml-2 t-muted">({fmtPct(pct)})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: FULFILLMENT — con BEP calculado
// ═══════════════════════════════════════════════════════════════════
function FulfillmentView({ d }: { d: ReturnType<typeof derived> }) {
  const ratioActual = d.totales.ffNoEntregadas / (d.totales.ffEntregadas + d.totales.ffNoEntregadas);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Entregadas YTD" value={fmtNum(d.totales.ffEntregadas)} sub={`Generan ingreso $1.500 c/u`} tone="green" />
        <KpiCard label="No entregadas YTD" value={fmtNum(d.totales.ffNoEntregadas)} sub={`Generan costo sin ingreso`} tone="red" />
        <KpiCard label="% No entregadas" value={fmtPct(ratioActual)} sub={`Break-even necesita ≤ ${fmtPct(d.bepNeNoEntPctActual)}`} tone={ratioActual <= d.bepNeNoEntPctActual ? "green" : "red"} />
        <KpiCard label="Resultado FF YTD" value={fmtArs(d.totales.ffGanancia)} sub={`${fmtPct(d.totales.ffGanancia / d.totales.ffIngreso)} margen`} tone={d.totales.ffGanancia >= 0 ? "green" : "red"} />
      </div>

      {/* BEP visual */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold t-primary mb-1">Punto de equilibrio: % no entregadas</h3>
        <p className="text-[11px] t-muted mb-3">
          Con precios actuales GV Nexus ($1.350/$675), el FF deja de perder plata cuando las no entregadas son ≤ <strong className="t-primary">{fmtPct(d.bepNeNoEntPctActual)}</strong> del total. Hoy estamos en <strong className={ratioActual > d.bepNeNoEntPctActual ? "text-red-400" : "text-emerald-400"}>{fmtPct(ratioActual)}</strong>.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={d.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="mes" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} domain={[0, 0.6]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip formatter={(v) => fmtPct(typeof v === "number" ? v : null)} contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} />
            <ReferenceLine y={d.bepNeNoEntPctActual} stroke={C.green} strokeWidth={2} strokeDasharray="5 5" label={{ value: `BEP ${fmtPct(d.bepNeNoEntPctActual)}`, fill: C.green, fontSize: 11, position: "right" }} />
            <Bar dataKey="pctNoEntregadas" name="% No entregadas">
              {d.monthly.map((r, i) => (
                <Cell key={i} fill={r.pctNoEntregadas <= d.bepNeNoEntPctActual ? C.green : C.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla detalle */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <Th align="left">Mes</Th>
              <Th>Ent.</Th>
              <Th>$ Ent.</Th>
              <Th>No ent.</Th>
              <Th>$ No ent.</Th>
              <Th>% No ent.</Th>
              <Th>Ingreso</Th>
              <Th>Costo</Th>
              <Th>Resultado</Th>
            </tr>
          </thead>
          <tbody>
            {d.monthly.map((r) => (
              <tr key={r.mes} className={`border-b border-gray-800/50 ${r.ffPrecioEnt === 1350 ? "bg-amber-500/5" : ""}`}>
                <Td align="left" bold>{r.mes}{r.ffPrecioEnt === 1350 && <span className="ml-2 text-[10px] text-amber-400">⬆ +36%</span>}</Td>
                <Td mono>{fmtNum(r.ffEntregadas)}</Td>
                <Td mono color={r.ffPrecioEnt === 1350 ? C.amber : C.gray}>${r.ffPrecioEnt}</Td>
                <Td mono color={C.red}>{fmtNum(r.ffNoEntregadas)}</Td>
                <Td mono color={r.ffPrecioEnt === 1350 ? C.amber : C.gray}>${r.ffPrecioNoEnt}</Td>
                <Td mono color={r.pctNoEntregadas <= d.bepNeNoEntPctActual ? C.green : C.red}>{fmtPct(r.pctNoEntregadas)}</Td>
                <Td mono color={C.green}>{fmtArs(r.ffIngreso)}</Td>
                <Td mono color={C.red}>{fmtArs(-r.ffCosto)}</Td>
                <Td mono bold color={r.ffGanancia >= 0 ? C.green : C.red}>{fmtArs(r.ffGanancia)}</Td>
              </tr>
            ))}
            <tr style={{ background: "rgba(232,105,42,0.08)", borderTop: `2px solid ${C.orange}` }}>
              <Td align="left" bold>TOTAL</Td>
              <Td mono bold>{fmtNum(d.totales.ffEntregadas)}</Td>
              <Td>—</Td>
              <Td mono bold color={C.red}>{fmtNum(d.totales.ffNoEntregadas)}</Td>
              <Td>—</Td>
              <Td mono bold color={ratioActual <= d.bepNeNoEntPctActual ? C.green : C.red}>{fmtPct(ratioActual)}</Td>
              <Td mono bold color={C.green}>{fmtArs(d.totales.ffIngreso)}</Td>
              <Td mono bold color={C.red}>{fmtArs(-d.totales.ffCosto)}</Td>
              <Td mono bold color={d.totales.ffGanancia >= 0 ? C.green : C.red}>{fmtArs(d.totales.ffGanancia)}</Td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="glass-card p-4 border-l-2 border-orange-500/50 bg-orange-500/5">
        <h3 className="text-sm font-semibold t-primary mb-2">💡 Acción sugerida</h3>
        <p className="text-[11px] t-secondary leading-relaxed">
          Para volver al break-even, las no entregadas tienen que bajar de <strong>{fmtPct(ratioActual)}</strong> a <strong>{fmtPct(d.bepNeNoEntPctActual)}</strong> — una reducción del <strong>{fmtPct(1 - d.bepNeNoEntPctActual / ratioActual)}</strong>. Alternativa: subir tarifa de flete de $1.500 a ${Math.round((1350 + 675 * ratioActual / (1 - ratioActual)) / 100) * 100}.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: LIQUIDACIONES
// ═══════════════════════════════════════════════════════════════════
function LiquidacionesView({ d }: { d: ReturnType<typeof derived> }) {
  const cobrado = d.liquidaciones.filter((l) => l.estado === "cobrado").reduce((s, l) => s + (l.neto || 0), 0);
  const retenido = d.liquidaciones.filter((l) => l.estado === "retenido").reduce((s, l) => s + (l.neto || 0), 0);
  const aConciliar = d.liquidaciones.filter((l) => l.estado === "conciliar").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Cobrado en banco/efectivo" value={fmtArs(cobrado)} sub="Oct + Nov '25" tone="green" />
        <KpiCard label="Retenido confirmado" value={fmtArs(retenido)} sub="Dic'25 + Ene'26 — pendiente cobro" tone="red" />
        <KpiCard label="A conciliar" value={`${aConciliar} liquidaciones`} sub="Feb–Abr 2026 (Fixy + Urbano)" tone="amber" />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <Th align="left">Período</Th>
              <Th>Órdenes</Th>
              <Th>Recaudo bruto</Th>
              <Th>(-) Fixy</Th>
              <Th>Neto Dropi</Th>
              <Th align="left">Estado</Th>
              <Th align="left">Depósito</Th>
            </tr>
          </thead>
          <tbody>
            {d.liquidaciones.map((l) => {
              const tone = l.estado === "cobrado" ? "green" : l.estado === "retenido" ? "red" : "amber";
              const label = l.estado === "cobrado" ? "✅ Cobrado" : l.estado === "retenido" ? "🔴 Retenido" : "⏳ A conciliar";
              return (
                <tr key={l.periodo} className="border-b border-gray-800/50">
                  <Td align="left" bold>{l.periodo}</Td>
                  <Td mono>{fmtNum(l.ordenes)}</Td>
                  <Td mono>{fmtArs(l.bruto)}</Td>
                  <Td mono color={l.fixy ? C.red : C.gray}>{l.fixy ? fmtArs(-l.fixy) : "—"}</Td>
                  <Td mono bold color={tone === "green" ? C.green : tone === "red" ? C.red : C.gray}>{fmtArs(l.neto)}</Td>
                  <Td align="left"><Badge tone={tone}>{label}</Badge></Td>
                  <Td align="left" muted>{l.deposito}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS UI
// ═══════════════════════════════════════════════════════════════════
type Tone = "green" | "red" | "orange" | "blue" | "amber";

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: Tone }) {
  const colorMap: Record<Tone, string> = { green: C.green, red: C.red, orange: C.orange, blue: C.blue, amber: C.amber };
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] t-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-xl font-semibold" style={{ color: colorMap[tone] }}>{value}</div>
      <div className="text-[11px] t-muted mt-1 leading-snug">{sub}</div>
    </div>
  );
}

function EscenarioCard({ tone, titulo, desc, cajaInicial, runway }: { tone: Tone; titulo: string; desc: string; cajaInicial: number; runway: number }) {
  const colorMap: Record<Tone, string> = { green: C.green, red: C.red, orange: C.orange, blue: C.blue, amber: C.amber };
  const c = colorMap[tone];
  return (
    <div className="glass-card p-5" style={{ borderTop: `3px solid ${c}` }}>
      <div className="text-sm font-semibold t-primary mb-2">{titulo}</div>
      <div className="text-[11px] t-muted mb-3 leading-relaxed">{desc}</div>
      <div className="space-y-2">
        <div>
          <div className="text-[10px] t-muted uppercase tracking-wider">Caja proyectada</div>
          <div className="font-mono text-lg font-semibold" style={{ color: c }}>{fmtArs(cajaInicial)}</div>
        </div>
        <div>
          <div className="text-[10px] t-muted uppercase tracking-wider">Runway</div>
          <div className="font-mono text-lg font-semibold t-primary">
            {runway >= 999 ? "∞ (cubierto)" : `${runway.toFixed(1)} meses`}
          </div>
        </div>
      </div>
    </div>
  );
}

function Alerta({ icon, severidad, titulo, accion }: { icon: string; severidad: Tone; titulo: string; accion: string }) {
  const colorMap: Record<Tone, string> = { green: C.green, red: C.red, orange: C.orange, blue: C.blue, amber: C.amber };
  const c = colorMap[severidad];
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: `${c}15`, borderLeft: `3px solid ${c}` }}>
      <div className="text-xl">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-semibold t-primary">{titulo}</div>
        <div className="text-[11px] t-secondary mt-0.5 leading-relaxed">{accion}</div>
      </div>
    </div>
  );
}

function buildAlertas(d: ReturnType<typeof derived>) {
  const out: { icon: string; severidad: Tone; titulo: string; accion: string }[] = [];
  const ultimo = d.monthly[d.monthly.length - 1];

  if (ultimo.margenPct < 0) {
    out.push({
      icon: "🔴",
      severidad: "red",
      titulo: `Margen abril ${fmtPct(ultimo.margenPct)} — peor mes del año`,
      accion: `Egresos variables saltaron ${fmtPct((ultimo.egrVar / d.monthly[0].egrVar) - 1)} vs enero ($${(ultimo.egrVar / 1e6).toFixed(1)}M vs $${(d.monthly[0].egrVar / 1e6).toFixed(1)}M). Revisar viáticos Raziel ($2.5M abr) y costo FF ($2.2M abr).`,
    });
  }
  if (d.totales.ffGanancia < 0) {
    out.push({
      icon: "📦",
      severidad: "amber",
      titulo: `Fulfillment perdiendo ${fmtArs(d.totales.ffGanancia)} acumulado`,
      accion: `El % de no entregadas (${fmtPct(d.totales.ffNoEntregadas / (d.totales.ffEntregadas + d.totales.ffNoEntregadas))}) supera el break-even (${fmtPct(d.bepNeNoEntPctActual)}). Negociar con GV Nexus o subir tarifa $1.500.`,
    });
  }
  if (d.caja.fixyConfirmado > d.cajaLiquida * 3) {
    out.push({
      icon: "🏦",
      severidad: "orange",
      titulo: `Cobranza Fixy retenida (${fmtArs(d.caja.fixyConfirmado)}) es ${(d.caja.fixyConfirmado / d.cajaLiquida).toFixed(1)}× la caja líquida`,
      accion: `Acelerar conciliación con Fixy es la palanca financiera #1. Cada mes de retraso es ~${fmtArs(d.burnNeto)} de presión adicional sobre caja.`,
    });
  }
  if (d.deuda.colombia + d.deuda.paraguay > 0) {
    out.push({
      icon: "⚠",
      severidad: "blue",
      titulo: `Deuda intercompany de ${fmtArs(d.deuda.colombia + d.deuda.paraguay)} no aparece en P&L`,
      accion: `Sumarla cambia el resultado YTD de +${fmtArs(d.totales.resultado)} a ${fmtArs(d.totales.resultado - d.deuda.colombia - d.deuda.paraguay)}. Considerar plan de devolución cuando se libere Fixy.`,
    });
  }
  return out;
}

function Th({ children, align = "right" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`py-3 px-4 text-[11px] t-muted uppercase tracking-wider whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, align = "right", bold, mono, color, muted }: { children: React.ReactNode; align?: "left" | "right"; bold?: boolean; mono?: boolean; color?: string; muted?: boolean }) {
  return (
    <td
      className={`py-2 px-4 text-xs ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""} ${muted ? "t-muted" : ""}`}
      style={color ? { color } : undefined}
    >
      {children}
    </td>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  const colorMap: Record<Tone, { bg: string; text: string }> = {
    green: { bg: "rgba(16,185,129,0.15)", text: C.green },
    red: { bg: "rgba(239,68,68,0.15)", text: C.red },
    orange: { bg: "rgba(232,105,42,0.15)", text: C.orange },
    blue: { bg: "rgba(116,172,223,0.15)", text: C.blue },
    amber: { bg: "rgba(245,158,11,0.15)", text: C.amber },
  };
  const c = colorMap[tone];
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: c.bg, color: c.text }}>
      {children}
    </span>
  );
}
