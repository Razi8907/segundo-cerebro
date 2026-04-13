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

// ─── Datos financieros DROPI E.A.S. Paraguay ───
const DATA = {
  balance2025: {
    actCorr: 6830468619,
    disp: 2323299969,
    caja: 552558266,
    bancos: 1770741703,
    cred: 4507168650,
    actNoCurr: 3442500,
    equipos: 3442500,
    pasCorr: 6463286969,
    acreedores: 4552037054,
    aft: 1902560660,
    ips: 8689255,
    otrasCP: 1911249915,
    capital: 400000000,
    resultados: -29375850,
    patrimonio: 370624150,
  },
  balance2026: {
    actCorr: 7396739775,
    disp: 2756852187,
    caja: 832698153,
    bancos: 1924154034,
    cred: 4639887588,
    actNoCurr: 3442500,
    equipos: 3442500,
    pasCorr: 6846031766,
    acreedores: 4761604203,
    otrasCP: 2084427563,
    aft: 1902560660,
    capital: 400000000,
    resultados: 154150509,
    patrimonio: 554150509,
    resEjercicio: 166502092,
  },
  estadoResultados: {
    ing24: 1141956005, cogs24: 936658397, ub24: 205297608,
    gv24: 112410908, ga24: 220040937, ev24: 28363637,
    ebit24: -1483093, gfin24: 10868490, net24: -12351583,
    ing25: 7778255334, cogs25: 6168284795, ub25: 1609970539,
    gv25: 160732322, ga25: 1425511488, ev25: 145429092, viat25: 8549074,
    ebit25: 40646841, gfin25: 57671108, net25: -17024267,
    ing26: 818010063, cogs26: 557400930, ub26: 260609133,
    gv26: 11886425, ga26: 43373901, ev26: 23909,
    util26: 210891277,
  },
  q1_2026: {
    enero: { rev: 725239637, costo: 589856117, util: 135383519, rent: 18.67, guias: 20192 },
    febrero: { rev: 679206716, costo: 520765175, util: 158441541, rent: 23.33, guias: 19237 },
    marzo: { rev: 775660871, costo: 563779418, util: 211881453, rent: 27.32, guias: 21737 },
  },
  eventos: [
    { cat: "Eventos Corporativos", v2024: 28363637, v2025: 145429092, v2026: 23909, nota: "Visitas a operadores, conferencias y eventos de marca" },
    { cat: "Viaticos a Vendedores", v2024: 0, v2025: 5004235, v2026: 800000, nota: "Visitas comerciales a operadores logisticos" },
    { cat: "Viaticos Administrativos", v2024: 0, v2025: 3544839, v2026: 192727, nota: "Misiones de supervision y negociacion" },
    { cat: "Publicidad y Propaganda", v2024: 40897272, v2025: 33791230, v2026: 0, nota: "Presencia de marca y captacion de usuarios" },
    { cat: "Gastos de Representacion", v2024: 16784226, v2025: 4361602, v2026: 3182, nota: "Reuniones con socios y operadores clave" },
  ],
};

const fmtGs = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${v < 0 ? "-" : ""}Gs ${(abs / 1e6).toLocaleString("es", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1e6) return `${v < 0 ? "-" : ""}Gs ${(abs / 1e6).toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  return `${v < 0 ? "-" : ""}Gs ${abs.toLocaleString("es")}`;
};

const fmtM = (v: number) => (v / 1e6).toFixed(1);

type FinView = "resumen" | "balance" | "resultados" | "indicadores" | "eventos";
type YearKey = 2024 | 2025 | 2026;

export default function FinanzasDashboard({ country }: { country: string }) {
  const [view, setView] = useState<FinView>("resumen");
  const [balYear, setBalYear] = useState<2025 | 2026>(2025);
  const [selectedYears, setSelectedYears] = useState<Set<YearKey>>(new Set([2024, 2025, 2026]));

  const toggleYear = (y: YearKey) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y) && next.size > 1) next.delete(y);
      else next.add(y);
      return next;
    });
  };

  const views: { key: FinView; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "balance", label: "Balance" },
    { key: "resultados", label: "Resultados" },
    { key: "indicadores", label: "Indicadores" },
    { key: "eventos", label: "Eventos & Ops" },
  ];

  const yearButtons: YearKey[] = [2024, 2025, 2026];
  const allSelected = selectedYears.size === 3;
  const selectAll = () => setSelectedYears(new Set([2024, 2025, 2026]));

  return (
    <div className="space-y-6">
      {/* Sub-navigation + Year filter */}
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
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] t-muted uppercase tracking-wider mr-1">Periodo:</span>
          <button
            onClick={selectAll}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              allSelected
                ? "bg-orange-500/20 text-orange-400 border-orange-500/50"
                : "bg-transparent t-muted border-gray-700/50 opacity-50 hover:opacity-80"
            }`}
          >
            Total
          </button>
          {yearButtons.map((y) => (
            <button
              key={y}
              onClick={() => toggleYear(y)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                selectedYears.has(y)
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                  : "bg-transparent t-muted border-gray-700/50 opacity-50 hover:opacity-80"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Company header */}
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold text-white text-sm shrink-0">DR</div>
        <div>
          <p className="text-sm font-semibold t-primary">DROPI E.A.S.</p>
          <p className="text-xs t-muted">RUC 80141637-0 &middot; Paraguay &middot; Dashboard Gerencial</p>
        </div>
      </div>

      {/* ─── RESUMEN ─── */}
      {view === "resumen" && <ResumenView years={selectedYears} />}

      {/* ─── BALANCE ─── */}
      {view === "balance" && <BalanceView balYear={balYear} setBalYear={setBalYear} />}

      {/* ─── RESULTADOS ─── */}
      {view === "resultados" && <ResultadosView years={selectedYears} />}

      {/* ─── INDICADORES ─── */}
      {view === "indicadores" && <IndicadoresView years={selectedYears} />}

      {/* ─── EVENTOS ─── */}
      {view === "eventos" && <EventosView years={selectedYears} />}
    </div>
  );
}

// ═══════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════
function ResumenView({ years }: { years: Set<YearKey> }) {
  const e = DATA.estadoResultados;
  const q = DATA.q1_2026;
  const has24 = years.has(2024), has25 = years.has(2025), has26 = years.has(2026);

  // Totals across all years
  const totalIng = (has24 ? e.ing24 : 0) + (has25 ? e.ing25 : 0) + (has26 ? e.ing26 : 0);
  const totalUb = (has24 ? e.ub24 : 0) + (has25 ? e.ub25 : 0) + (has26 ? e.ub26 : 0);
  const totalNet = (has24 ? e.net24 : 0) + (has25 ? e.net25 : 0) + (has26 ? e.util26 : 0);
  const totalCogs = (has24 ? e.cogs24 : 0) + (has25 ? e.cogs25 : 0) + (has26 ? e.cogs26 : 0);
  const margenBrutoTotal = totalIng > 0 ? (totalUb / totalIng * 100).toFixed(1) : "0";
  const margenNetoTotal = totalIng > 0 ? (totalNet / totalIng * 100).toFixed(1) : "0";
  const activeCount = (has24 ? 1 : 0) + (has25 ? 1 : 0) + (has26 ? 1 : 0);

  const allKpis = [
    { label: "Ingresos 2024", value: "Gs 1,142.0M", delta: "Primer ano operativo", positive: true, year: 2024 as YearKey },
    { label: "Ingresos 2025", value: "Gs 7,778.3M", delta: "+581% vs 2024", positive: true, year: 2025 as YearKey },
    { label: "Utilidad Bruta 2025", value: "Gs 1,610.0M", delta: "Margen 20.7%", positive: true, year: 2025 as YearKey },
    { label: "EBIT 2025", value: "Gs 40.6M", delta: "Margen 0.52%", positive: true, year: 2025 as YearKey },
    { label: "Resultado Neto 2024", value: "-Gs 12.4M", delta: "Margen -1.08%", positive: false, year: 2024 as YearKey },
    { label: "Resultado Neto 2025", value: "-Gs 17.0M", delta: "Dif. cambio -Gs 57.7M", positive: false, year: 2025 as YearKey },
    { label: "Resultado Feb-2026", value: "Gs 210.9M", delta: "Margen 25.8%", positive: true, year: 2026 as YearKey },
    { label: "Rent. Operativa Mar-26", value: "27.32%", delta: "vs Ene: 18.67%", positive: true, year: 2026 as YearKey },
  ];
  const kpis = allKpis.filter((k) => years.has(k.year));

  const ingVsCostAll = [
    { periodo: "2024", Ingresos: +fmtM(e.ing24), Costos: +fmtM(e.cogs24), GOperativos: +fmtM(e.gv24 + e.ga24) },
    { periodo: "2025", Ingresos: +fmtM(e.ing25), Costos: +fmtM(e.cogs25), GOperativos: +fmtM(e.gv25 + e.ga25) },
    { periodo: "2026 (Feb)", Ingresos: +fmtM(e.ing26), Costos: +fmtM(e.cogs26), GOperativos: +fmtM(e.gv26 + e.ga26) },
  ];
  const ingVsCostData = ingVsCostAll.filter((_, i) => years.has((([2024, 2025, 2026] as YearKey[])[i])));

  const rentData = [
    { mes: "Enero", Rentabilidad: q.enero.rent },
    { mes: "Febrero", Rentabilidad: q.febrero.rent },
    { mes: "Marzo", Rentabilidad: q.marzo.rent },
  ];

  const gastosData = [
    { concepto: "COGS", ...(has24 ? { "2024": +fmtM(e.cogs24) } : {}), ...(has25 ? { "2025": +fmtM(e.cogs25) } : {}), ...(has26 ? { "2026": +fmtM(e.cogs26) } : {}) },
    { concepto: "G.Ventas", ...(has24 ? { "2024": +fmtM(e.gv24) } : {}), ...(has25 ? { "2025": +fmtM(e.gv25) } : {}), ...(has26 ? { "2026": +fmtM(e.gv26) } : {}) },
    { concepto: "G.Admin", ...(has24 ? { "2024": +fmtM(e.ga24) } : {}), ...(has25 ? { "2025": +fmtM(e.ga25) } : {}), ...(has26 ? { "2026": +fmtM(e.ga26) } : {}) },
    { concepto: "G.Financiero", ...(has24 ? { "2024": +fmtM(e.gfin24) } : {}), ...(has25 ? { "2025": +fmtM(e.gfin25) } : {}), ...(has26 ? { "2026": 0 } : {}) },
  ];

  const activeYearLabels = [has24 && "2024", has25 && "2025", has26 && "2026"].filter(Boolean).join(" vs ");

  return (
    <>
      {/* KPIs */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${kpis.length > 4 ? "lg:grid-cols-4" : "lg:grid-cols-" + kpis.length} gap-3`}>
        {kpis.map((k) => (
          <div key={k.label} className="glass-card p-4">
            <p className="text-[10px] t-muted uppercase tracking-wider">{k.label}</p>
            <p className="text-lg font-bold t-primary mt-1">{k.value}</p>
            <p className={`text-[11px] mt-1 ${k.positive ? "text-green-400" : "text-red-400"}`}>{k.delta}</p>
          </div>
        ))}
      </div>

      {/* Totals row */}
      {activeCount > 1 && (
        <div className="glass-card p-4 border border-orange-500/20">
          <p className="text-[10px] t-muted uppercase tracking-wider mb-3">Totales acumulados ({[has24 && "2024", has25 && "2025", has26 && "2026"].filter(Boolean).join(" + ")})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <p className="text-[10px] t-muted">Ingresos</p>
              <p className="text-base font-bold t-primary">{fmtGs(totalIng)}</p>
            </div>
            <div>
              <p className="text-[10px] t-muted">Costos</p>
              <p className="text-base font-bold t-primary">{fmtGs(totalCogs)}</p>
            </div>
            <div>
              <p className="text-[10px] t-muted">Utilidad Bruta</p>
              <p className="text-base font-bold text-green-400">{fmtGs(totalUb)}</p>
            </div>
            <div>
              <p className="text-[10px] t-muted">Margen Bruto</p>
              <p className="text-base font-bold text-green-400">{margenBrutoTotal}%</p>
            </div>
            <div>
              <p className="text-[10px] t-muted">Resultado Neto</p>
              <p className={`text-base font-bold ${totalNet >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtGs(totalNet)}</p>
            </div>
            <div>
              <p className="text-[10px] t-muted">Margen Neto</p>
              <p className={`text-base font-bold ${totalNet >= 0 ? "text-green-400" : "text-red-400"}`}>{margenNetoTotal}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold t-primary mb-1">Ingresos vs Costos — Anual (M Gs)</h3>
          <p className="text-xs t-muted mb-4">Comparativa {activeYearLabels}</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ingVsCostData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="periodo" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `${v}M`} />
              <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px" }} formatter={(v) => `${v}M Gs`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ingresos" fill="#F97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Costos" fill="#F4C06B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GOperativos" fill="#60A5FA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {has26 && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold t-primary mb-1">Rentabilidad operativa Q1-2026 (%)</h3>
            <p className="text-xs t-muted mb-4">Tendencia mensual Ene-Mar</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={rentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis domain={[10, 32]} tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px" }} formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="Rentabilidad" stroke="#F97316" strokeWidth={3} dot={{ r: 6, fill: "#F97316", stroke: "#fff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Gastos */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold t-primary mb-1">Composicion de gastos (M Gs)</h3>
        <p className="text-xs t-muted mb-4">Comparativa {activeYearLabels}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={gastosData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="concepto" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}M`} />
            <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px" }} formatter={(v) => `${v}M Gs`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {has24 && <Bar dataKey="2024" fill="#60A5FA" radius={[4, 4, 0, 0]} />}
            {has25 && <Bar dataKey="2025" fill="#F97316" radius={[4, 4, 0, 0]} />}
            {has26 && <Bar dataKey="2026" fill="#10B981" radius={[4, 4, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ═══════════════════════════════════════
// BALANCE
// ═══════════════════════════════════════
function BalanceView({ balYear, setBalYear }: { balYear: 2025 | 2026; setBalYear: (y: 2025 | 2026) => void }) {
  const b = balYear === 2025 ? DATA.balance2025 : DATA.balance2026;
  const totalAct = b.actCorr + b.actNoCurr;
  const totalPasPatr = b.pasCorr + b.patrimonio;
  const liqCorr = (b.actCorr / b.pasCorr).toFixed(3);
  const liqOk = parseFloat(liqCorr) >= 1;
  const de = (b.pasCorr / b.patrimonio).toFixed(2);
  const roa = balYear === 2025
    ? (DATA.estadoResultados.net25 / totalAct * 100).toFixed(2)
    : ((DATA.balance2026.resEjercicio ?? 0) / totalAct * 100).toFixed(2);
  const roaOk = parseFloat(roa) >= 0;
  const capitalTrabajo = b.actCorr - b.pasCorr;

  return (
    <>
      <div className="flex gap-2 mb-2">
        <button onClick={() => setBalYear(2025)} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${balYear === 2025 ? "bg-orange-500 text-white border-orange-500" : "bg-transparent t-secondary border-gray-700"}`}>Balance 2025</button>
        <button onClick={() => setBalYear(2026)} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${balYear === 2026 ? "bg-orange-500 text-white border-orange-500" : "bg-transparent t-secondary border-gray-700"}`}>Balance Feb-2026</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activos */}
        <div className="glass-card p-6">
          <h3 className="text-xs font-semibold t-muted uppercase tracking-wider mb-4">Activos</h3>
          <BalanceTable rows={[
            { label: "Activo corriente", value: b.actCorr, bold: true },
            { label: "Disponibilidades", value: b.disp, sub: true },
            { label: "Caja", value: b.caja, sub: true },
            { label: "Bancos", value: b.bancos, sub: true },
            { label: "Creditos", value: b.cred, sub: true },
            { divider: true },
            { label: "Activo no corriente", value: b.actNoCurr, bold: true },
            { label: "Equipos", value: b.equipos, sub: true },
            { divider: true },
            { label: "TOTAL ACTIVO", value: totalAct, bold: true },
          ]} />
        </div>

        {/* Pasivos & Patrimonio */}
        <div className="glass-card p-6">
          <h3 className="text-xs font-semibold t-muted uppercase tracking-wider mb-4">Pasivos & Patrimonio</h3>
          <BalanceTable rows={[
            { label: "Pasivo corriente", value: b.pasCorr, bold: true },
            { label: "Acreedores comerciales", value: b.acreedores, sub: true },
            { label: "Fondos 3ros (AFT)", value: b.aft, sub: true },
            ...(balYear === 2025 && "ips" in b ? [{ label: "IPS a Pagar", value: (b as typeof DATA.balance2025).ips, sub: true }] : []),
            { divider: true },
            { label: "Patrimonio neto", value: b.patrimonio, bold: true },
            { label: "Capital suscripto", value: b.capital, sub: true },
            { label: "Resultados", value: b.resultados, sub: true },
            { divider: true },
            { label: "TOTAL PAS + PATRIMONIO", value: totalPasPatr, bold: true },
          ]} />
        </div>
      </div>

      {/* Balance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiMini label="Liquidez Corriente" value={`${liqCorr}x`} desc={liqOk ? "Saludable (>1)" : "Alerta"} positive={liqOk} />
        <KpiMini label="Ratio Endeudamiento (D/E)" value={`${de}x`} desc="Incluye AFT 3ros" neutral />
        <KpiMini label="ROA" value={`${roa}%`} desc="Return on Assets" positive={roaOk} />
        <KpiMini label="Capital de Trabajo" value={fmtGs(capitalTrabajo)} desc="Activo cte - Pasivo cte" positive={capitalTrabajo >= 0} />
      </div>
    </>
  );
}

function BalanceTable({ rows }: { rows: Array<{ label?: string; value?: number; bold?: boolean; sub?: boolean; divider?: boolean }> }) {
  return (
    <table className="w-full">
      <tbody>
        {rows.map((r, i) => {
          if (r.divider) return <tr key={i}><td colSpan={2}><hr className="border-gray-700/50 my-2" /></td></tr>;
          return (
            <tr key={i}>
              <td className={`py-1.5 ${r.sub ? "pl-4 text-xs t-secondary" : "text-sm font-medium t-primary"}`}>{r.label}</td>
              <td className={`py-1.5 text-right ${r.sub ? "text-xs t-secondary" : "text-sm font-medium t-primary"}`}>{fmtGs(r.value ?? 0)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════
// RESULTADOS
// ═══════════════════════════════════════
function ResultadosView({ years }: { years: Set<YearKey> }) {
  const e = DATA.estadoResultados;
  const q = DATA.q1_2026;
  const has24 = years.has(2024), has25 = years.has(2025), has26 = years.has(2026);

  const rows: Array<{ label?: string; v24?: number; v25?: number; v26?: number; pct26?: number; bold?: boolean; divider?: boolean }> = [
    { label: "Ingresos operativos", v24: e.ing24, v25: e.ing25, v26: e.ing26, bold: true, pct26: 100 },
    { label: "Costo de servicios", v24: -e.cogs24, v25: -e.cogs25, v26: -e.cogs26, pct26: -(e.cogs26 / e.ing26 * 100) },
    { divider: true },
    { label: "Utilidad Bruta", v24: e.ub24, v25: e.ub25, v26: e.ub26, bold: true, pct26: e.ub26 / e.ing26 * 100 },
    { label: "Gastos de ventas", v24: -e.gv24, v25: -e.gv25, v26: -e.gv26, pct26: -(e.gv26 / e.ing26 * 100) },
    { label: "Gastos de administracion", v24: -e.ga24, v25: -e.ga25, v26: -e.ga26, pct26: -(e.ga26 / e.ing26 * 100) },
    { label: "  Eventos corporativos", v24: -e.ev24, v25: -e.ev25, v26: -e.ev26, pct26: -(e.ev26 / e.ing26 * 100) },
    { divider: true },
    { label: "EBIT / Utilidad Operativa", v24: e.ebit24, v25: e.ebit25, v26: e.util26, bold: true, pct26: e.util26 / e.ing26 * 100 },
    { label: "Gastos financieros", v24: -e.gfin24, v25: -e.gfin25, v26: 0, pct26: 0 },
    { divider: true },
    { label: "Resultado Neto", v24: e.net24, v25: e.net25, v26: e.util26, bold: true, pct26: e.util26 / e.ing26 * 100 },
  ];

  const fmtV = (v: number) => v === 0 ? "—" : `${v < 0 ? "-" : ""}Gs ${Math.abs(v / 1e6).toFixed(1)}M`;
  const activeCount = (has24 ? 1 : 0) + (has25 ? 1 : 0) + (has26 ? 1 : 0);
  const showTotal = activeCount > 1;
  const colSpan = 1 + (has24 ? 1 : 0) + (has25 ? 1 : 0) + (has26 ? 2 : 0) + (showTotal ? 1 : 0);

  const q1BarData = [
    { mes: "Enero", Ingresos: +fmtM(q.enero.rev), Costos: +fmtM(q.enero.costo), Utilidad: +fmtM(q.enero.util) },
    { mes: "Febrero", Ingresos: +fmtM(q.febrero.rev), Costos: +fmtM(q.febrero.costo), Utilidad: +fmtM(q.febrero.util) },
    { mes: "Marzo", Ingresos: +fmtM(q.marzo.rev), Costos: +fmtM(q.marzo.costo), Utilidad: +fmtM(q.marzo.util) },
  ];

  const allMargen = [
    { periodo: "2024", Margen: +(e.ub24 / e.ing24 * 100).toFixed(1) },
    { periodo: "2025", Margen: +(e.ub25 / e.ing25 * 100).toFixed(1) },
    { periodo: "Feb-2026", Margen: +(e.ub26 / e.ing26 * 100).toFixed(1) },
  ];
  const margenData = allMargen.filter((_, i) => years.has(([2024, 2025, 2026] as YearKey[])[i]));

  return (
    <>
      {/* Estado de resultados table */}
      <div className="glass-card p-6 overflow-x-auto">
        <h3 className="text-sm font-semibold t-primary mb-4">Estado de Resultados Comparativo</h3>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs t-muted pb-3 w-[30%]">Concepto</th>
              {has24 && <th className="text-right text-xs t-muted pb-3">2024 (M Gs)</th>}
              {has25 && <th className="text-right text-xs t-muted pb-3">2025 (M Gs)</th>}
              {has26 && <th className="text-right text-xs t-muted pb-3">Feb-2026 (M Gs)</th>}
              {has26 && <th className="text-right text-xs t-muted pb-3">% Ing.</th>}
              {showTotal && <th className="text-right text-xs text-orange-400 pb-3 font-bold">Total (M Gs)</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              if (r.divider) return <tr key={i}><td colSpan={colSpan}><hr className="border-gray-700/50 my-1" /></td></tr>;
              const totalVal = (has24 ? (r.v24 ?? 0) : 0) + (has25 ? (r.v25 ?? 0) : 0) + (has26 ? (r.v26 ?? 0) : 0);
              return (
                <tr key={i}>
                  <td className={`py-1.5 ${r.bold ? "font-medium t-primary" : "t-secondary pl-3 text-xs"}`}>{r.label}</td>
                  {has24 && <td className={`py-1.5 text-right ${r.bold ? "font-medium t-primary" : "text-xs t-secondary"} ${(r.v24 ?? 0) < 0 ? "text-red-400" : ""}`}>{fmtV(r.v24 ?? 0)}</td>}
                  {has25 && <td className={`py-1.5 text-right ${r.bold ? "font-medium t-primary" : "text-xs t-secondary"} ${(r.v25 ?? 0) < 0 ? "text-red-400" : ""}`}>{fmtV(r.v25 ?? 0)}</td>}
                  {has26 && <td className={`py-1.5 text-right ${r.bold ? "font-medium t-primary" : "text-xs t-secondary"} ${(r.v26 ?? 0) > 0 ? "text-green-400" : (r.v26 ?? 0) < 0 ? "text-red-400" : ""}`}>{fmtV(r.v26 ?? 0)}</td>}
                  {has26 && <td className="py-1.5 text-right text-xs t-muted">{r.pct26 !== undefined ? `${r.pct26.toFixed(1)}%` : ""}</td>}
                  {showTotal && <td className={`py-1.5 text-right ${r.bold ? "font-bold text-orange-400" : "text-xs text-orange-300/70"}`}>{fmtV(totalVal)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {has26 && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold t-primary mb-1">Ingresos mensuales Q1-2026 (M Gs)</h3>
            <p className="text-xs t-muted mb-4">Desglose por mes</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={q1BarData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}M`} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px" }} formatter={(v) => `${v}M Gs`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Ingresos" fill="#F97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Costos" fill="#F4C06B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Utilidad" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold t-primary mb-1">Margen bruto comparativo (%)</h3>
          <p className="text-xs t-muted mb-4">Evolucion del margen bruto</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={margenData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="periodo" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis domain={[0, 40]} tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px" }} formatter={(v) => `${v}%`} />
              <Bar dataKey="Margen" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════
// INDICADORES
// ═══════════════════════════════════════
function IndicadoresView({ years }: { years: Set<YearKey> }) {
  const e = DATA.estadoResultados;
  const b25 = DATA.balance2025;
  const b26 = DATA.balance2026;
  const ta25 = b25.actCorr + b25.actNoCurr;
  const ta26 = b26.actCorr + b26.actNoCurr;
  const deExAft = ((b25.pasCorr - b25.aft) / b25.patrimonio).toFixed(2);
  const has24 = years.has(2024), has25 = years.has(2025), has26 = years.has(2026);

  const allIndicators = [
    { name: "EBITDA 2025", value: "Gs 40.6M", desc: "Utilidad antes de intereses, impuestos, D&A. D&A minima (equipos Gs 3.4M).", pct: 40, ok: true, year: 2025 as YearKey },
    { name: "EBIT 2025", value: "Gs 40.6M / 0.52%", desc: "Beneficio operativo. Los gastos financieros (-Gs 57.7M, dif. cambio) generaron la perdida neta.", pct: 30, ok: true, year: 2025 as YearKey },
    { name: "Margen Bruto 2024", value: `${(e.ub24 / e.ing24 * 100).toFixed(2)}%`, desc: "Utilidad bruta sobre ingresos. Primer ano operativo.", pct: 18, ok: true, year: 2024 as YearKey },
    { name: "Liquidez Corriente 2025", value: `${(b25.actCorr / b25.pasCorr).toFixed(3)}x`, desc: "Activo cte / Pasivo cte. Resultado > 1 indica capacidad de cubrir deudas CP.", pct: Math.min((b25.actCorr / b25.pasCorr) / 2 * 100, 100), ok: true, year: 2025 as YearKey },
    { name: "Liquidez Corriente Feb-2026", value: `${(b26.actCorr / b26.pasCorr).toFixed(3)}x`, desc: "Mejora respecto a 2025. Activo cte crecio mas que pasivo cte.", pct: Math.min((b26.actCorr / b26.pasCorr) / 2 * 100, 100), ok: true, year: 2026 as YearKey },
    { name: "Margen Neto 2024", value: `${(e.net24 / e.ing24 * 100).toFixed(2)}%`, desc: "Negativo en primer ano. Fase de crecimiento.", pct: 0, ok: false, year: 2024 as YearKey },
    { name: "Margen Neto 2025", value: `${(e.net25 / e.ing25 * 100).toFixed(2)}%`, desc: "Negativo por perdida de cambio Gs 57.7M. Sin ese efecto: positivo.", pct: 0, ok: false, year: 2025 as YearKey },
    { name: "Margen Neto Feb-2026", value: "25.77%", desc: "Gs 210.9M utilidad sobre Gs 818M ingresos. Recuperacion muy fuerte.", pct: 74, ok: true, year: 2026 as YearKey },
    { name: "Ratio Endeudamiento D/E 2025", value: `${(b25.pasCorr / b25.patrimonio).toFixed(2)}x`, desc: `Alta por AFT (fondos de terceros). Ex-AFT: ${deExAft}x.`, pct: 80, ok: false, year: 2025 as YearKey },
    { name: "ROE 2025", value: `${(e.net25 / b25.patrimonio * 100).toFixed(2)}%`, desc: "Negativo por perdida neta. Sin dif. cambio hubiera sido +6.3%.", pct: 0, ok: false, year: 2025 as YearKey },
    { name: "ROE Feb-2026", value: `${(b26.resEjercicio! / b26.patrimonio * 100).toFixed(1)}%`, desc: "Fuerte recuperacion del capital.", pct: 50, ok: true, year: 2026 as YearKey },
    { name: "ROA 2025", value: `${(e.net25 / ta25 * 100).toFixed(2)}%`, desc: "Negativo por perdida cambiaria. Activos son principalmente creditos de intermediacion.", pct: 0, ok: false, year: 2025 as YearKey },
    { name: "ROA Feb-2026", value: `${(b26.resEjercicio! / ta26 * 100).toFixed(2)}%`, desc: "Eficiencia en uso de activos. Mejora significativa.", pct: 45, ok: true, year: 2026 as YearKey },
    { name: "Flujo Caja Operativo (FCO)", value: "~Gs 40.6M", desc: "Estimado: EBIT + D&A (2025). AFT son flujo de terceros, no operativo propio.", pct: 25, ok: true, year: 2025 as YearKey },
  ];
  const indicators = allIndicators.filter((ind) => years.has(ind.year));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {indicators.map((ind) => (
        <div key={ind.name} className="glass-card p-5 flex flex-col gap-2">
          <p className="text-[10px] t-muted uppercase tracking-wider font-medium">{ind.name}</p>
          <p className={`text-xl font-bold ${ind.ok ? "t-primary" : "text-red-400"}`}>{ind.value}</p>
          <div className="h-1.5 rounded-full bg-gray-700/50">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.max(ind.pct, 0)}%`, background: ind.ok ? "#F97316" : "#ef4444" }} />
          </div>
          <p className="text-[11px] t-muted leading-relaxed">{ind.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// EVENTOS & OPS
// ═══════════════════════════════════════
function EventosView({ years }: { years: Set<YearKey> }) {
  const e = DATA.estadoResultados;
  const q = DATA.q1_2026;
  const has24 = years.has(2024), has25 = years.has(2025), has26 = years.has(2026);

  const allEvVsIng = [
    { periodo: "2024", Eventos: +(e.ev24 / 1e6).toFixed(1), Ingresos: +(e.ing24 / 1e6).toFixed(1) },
    { periodo: "2025", Eventos: +(e.ev25 / 1e6).toFixed(1), Ingresos: +(e.ing25 / 1e6).toFixed(1) },
  ];
  const evVsIngData = allEvVsIng.filter((_, i) => years.has(([2024, 2025] as YearKey[])[i]));

  const margenOpData = [
    { mes: "Enero", Rentabilidad: q.enero.rent },
    { mes: "Febrero", Rentabilidad: q.febrero.rent },
    { mes: "Marzo", Rentabilidad: q.marzo.rent },
  ];

  const allEvKpis = [
    { label: "ROI Eventos 2024", value: "40.3x", desc: "Gs 40.3 de ingreso por cada Gs invertido", positive: true, year: 2024 as YearKey },
    { label: "ROI Eventos 2025", value: "53.5x", desc: "Gs 53.5 de ingreso por cada Gs invertido", positive: true, year: 2025 as YearKey },
    { label: "Crecimiento ingresos", value: "+581%", desc: "2024 a 2025: Gs 1,142M a Gs 7,778M", positive: true, year: 2025 as YearKey },
    { label: "Mejora margen Q1-2026", value: "+8.65pp", desc: "Enero 18.67% a Marzo 27.32%", positive: true, year: 2026 as YearKey },
    { label: "Guias Q1-2026", value: "61,166", desc: "Crecimiento operativo sostenido", positive: true, year: 2026 as YearKey },
    { label: "Utilidad operativa Q1-2026", value: "Gs 505.7M", desc: "Margen 23.20% promedio", positive: true, year: 2026 as YearKey },
  ];
  const evKpis = allEvKpis.filter((k) => years.has(k.year));

  return (
    <>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(has24 || has25) && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold t-primary mb-1">Inversion en eventos vs crecimiento de ingresos</h3>
            <p className="text-xs t-muted mb-4">Comparativa anual (M Gs)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={evVsIngData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="periodo" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `${v}M`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} tickFormatter={(v) => `${v}M`} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px" }} formatter={(v) => `${v}M Gs`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Eventos" fill="#F4C06B" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="Ingresos" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {has26 && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold t-primary mb-1">Margen operativo post-eventos — Q1 2026 (%)</h3>
            <p className="text-xs t-muted mb-4">Mejora mensual de margen</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={margenOpData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis domain={[12, 32]} tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px" }} formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="Rentabilidad" stroke="#F97316" strokeWidth={3} dot={{ r: 6, fill: "#F97316", stroke: "#fff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detalle de inversion */}
      <div className="glass-card p-6">
        <h3 className="text-xs font-semibold t-muted uppercase tracking-wider mb-4">Detalle de inversion — Visitas & Eventos Corporativos</h3>
        <div className="divide-y divide-gray-700/50">
          {DATA.eventos.map((ev) => (
            <div key={ev.cat} className="flex items-center justify-between py-3 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium t-primary">{ev.cat}</p>
                <p className="text-[11px] t-muted">{ev.nota}</p>
              </div>
              <div className="flex gap-4 text-right shrink-0">
                {has24 && (
                  <div>
                    <p className="text-[10px] t-muted">2024</p>
                    <p className="text-xs t-secondary">{ev.v2024 ? `Gs ${(ev.v2024 / 1e6).toFixed(1)}M` : "—"}</p>
                  </div>
                )}
                {has25 && (
                  <div>
                    <p className="text-[10px] t-muted">2025</p>
                    <p className="text-xs font-medium t-primary">{ev.v2025 ? `Gs ${(ev.v2025 / 1e6).toFixed(1)}M` : "—"}</p>
                  </div>
                )}
                {has26 && (
                  <div>
                    <p className="text-[10px] t-muted">Feb-26</p>
                    <p className="text-xs text-green-400">{ev.v2026 ? `Gs ${(ev.v2026 / 1e6).toFixed(2)}M` : "—"}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event KPIs */}
      {evKpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {evKpis.map((k) => (
            <div key={k.label} className="glass-card p-4">
              <p className="text-[10px] t-muted uppercase tracking-wider">{k.label}</p>
              <p className="text-base font-bold t-primary mt-1">{k.value}</p>
              <p className={`text-[11px] mt-1 ${k.positive ? "text-green-400" : "text-red-400"}`}>{k.desc}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════
// Shared mini components
// ═══════════════════════════════════════
function KpiMini({ label, value, desc, positive, neutral }: { label: string; value: string; desc: string; positive?: boolean; neutral?: boolean }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[10px] t-muted uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold t-primary mt-1">{value}</p>
      <p className={`text-[11px] mt-1 ${neutral ? "t-muted" : positive ? "text-green-400" : "text-red-400"}`}>{desc}</p>
    </div>
  );
}
