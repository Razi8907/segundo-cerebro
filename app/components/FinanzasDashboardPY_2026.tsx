"use client";

// ═══════════════════════════════════════════════════════════════════
// FINANZAS PARAGUAY 2026 — Dropi E.A.S. (cifras en guaraníes)
// Fuente: Informe Financiero Mensual (estado de resultados por mes).
// Para cargar un mes nuevo: agregar su fila en MESES (y sacar PRELIM si
// era el preliminar). Todo lo demás (trimestres, totales) se calcula solo.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MesFilter } from "../types";

const C = {
  orange: "#E8540A",
  green: "#1A6640",
  greenBar: "#2E8B57",
  red: "#A81A1A",
  amber: "#C47A00",
  blue: "#3F6FB0",
  teal: "#1FA393",
  gray: "#8a8a8a",
  grayLt: "#b0a89e",
  blueLt: "#C8D8E8",
};

// ─── DATOS ────────────────────────────────────────────────────────
// ing = 4 Ingresos operativos · cos = 5 Costos operativos · otr = 8 Otros ingresos
// gv = 10 Gastos de ventas · ga = 11 Gastos de administración · com = 11.16 Comisiones bancarias
// alqEERR = 11.05 Alquileres registrados · alq = alquiler del mes (contrato)
// ful = fulfillment: ord entregadas, mo mano de obra, alqB alquiler bodega,
//       ser servicios y otros, mat materiales, inv inversiones en bodega (una sola vez)
// sas / llc = transferencias a Dropi S.A.S. / Dropi LLC (USD)
type MesKeyPY = "Ene" | "Feb" | "Mar" | "Abr" | "May" | "Jun" | "Jul" | "Ago" | "Sep";
interface Ful { ord: number | null; mo: number; alqB: number; ser: number; mat: number; inv?: number }
interface MesRaw { m: MesKeyPY; ing: number; cos: number; otr: number; gv: number; ga: number; com: number; alqEERR: number; alq: number; ful: Ful; sas: number; llc: number }

const MESES: MesRaw[] = [
  { m: "Ene", ing: 683364708, cos: 614096529, otr: 11250769, gv: 29356746, ga: 78611491, com: 907387, alqEERR: 0, alq: 3768000, ful: { ord: 3486, mo: 8165419, alqB: 3014400, ser: 282893, mat: 6494100, inv: 6640000 }, sas: 100000, llc: 0 },
  { m: "Feb", ing: 818010063, cos: 557400930, otr: 5542470, gv: 25499500, ga: 62295152, com: 1233984, alqEERR: 0, alq: 3768000, ful: { ord: 3574, mo: 8165419, alqB: 3014400, ser: 257973, mat: 4167600, inv: 690000 }, sas: 0, llc: 13408 },
  { m: "Mar", ing: 805959679, cos: 654888143, otr: 0, gv: 28017711, ga: 65702092, com: 429333, alqEERR: 0, alq: 3768000, ful: { ord: 3618, mo: 8165419, alqB: 3014400, ser: 305435, mat: 3663205 }, sas: 0, llc: 0 },
  { m: "Abr", ing: 842586699, cos: 701899053, otr: 0, gv: 23438985, ga: 66580635, com: 2285578, alqEERR: 0, alq: 3768000, ful: { ord: 3261, mo: 8165419, alqB: 3014400, ser: 284316, mat: 3286240 }, sas: 300000, llc: 0 },
  { m: "May", ing: 933992531, cos: 737050723, otr: 0, gv: 28731526, ga: 86763268, com: 878280, alqEERR: 0, alq: 3768000, ful: { ord: 4126, mo: 8165419, alqB: 3014400, ser: 1092465, mat: 5505375 }, sas: 0, llc: 0 },
  { m: "Jun", ing: 1017306944, cos: 669685873, otr: 2936430, gv: 60527025, ga: 96998739, com: 419548, alqEERR: 13458065, alq: 3768000, ful: { ord: 3079, mo: 8165419, alqB: 3014400, ser: 1894156, mat: 5057335 }, sas: 0, llc: 0 },
  { m: "Jul", ing: 944700723, cos: 731993333, otr: 37059992, gv: 29362069, ga: 95724547, com: 1944960, alqEERR: 0, alq: 7536000, ful: { ord: 4075, mo: 10457151, alqB: 6028800, ser: 278115, mat: 8388400, inv: 20734102 }, sas: 90566, llc: 4216 },
  { m: "Ago", ing: 1052575528, cos: 793270003, otr: 15766468, gv: 36193357, ga: 86464944, com: 2329163, alqEERR: 0, alq: 7536000, ful: { ord: 4561, mo: 10075529, alqB: 6028800, ser: 569597, mat: 7702835 }, sas: 110489, llc: 18042 },
];

// Mes preliminar (todavía sin estado de resultados): gastos vienen en un solo total.
// Poner null cuando llegue el cierre y pasar el mes a MESES.
const PRELIM: { m: MesKeyPY; ing: number; cos: number; otr: number; gastos: number; com: number; alq: number; ful: Ful; sas: number; llc: number } | null = {
  m: "Sep", ing: 1329999190, cos: 1023058009, otr: 0, gastos: 157031283, com: 0, alq: 7536000,
  ful: { ord: null, mo: 7446204, alqB: 6028800, ser: 58769975, mat: 3278250 }, sas: 84718, llc: 92103,
};

// Balance del último cierre
const BAL = {
  fecha: "31/08/2026", activo: 8359587487, pasivo: 7120835148, patrimonio: 1238752339,
  actCorr: 8322553853, pasCorr: 7120835148, aex: 1847477130, deudaSAS: 4298774922,
};
const TARIFA_FUL = 5000;
const PCT_LLC = 0.25;

const NOM: Record<MesKeyPY, string> = { Ene: "Enero", Feb: "Febrero", Mar: "Marzo", Abr: "Abril", May: "Mayo", Jun: "Junio", Jul: "Julio", Ago: "Agosto", Sep: "Septiembre" };
const FILTER_TO_MES: Partial<Record<string, MesKeyPY>> = { enero: "Ene", febrero: "Feb", marzo: "Mar", abril: "Abr", mayo: "May", junio: "Jun", julio: "Jul", agosto: "Ago", septiembre: "Sep" };
const QUARTERS = [
  { key: "Q1", label: "Q1 (Ene–Mar)", meses: ["Ene", "Feb", "Mar"] as MesKeyPY[] },
  { key: "Q2", label: "Q2 (Abr–Jun)", meses: ["Abr", "May", "Jun"] as MesKeyPY[] },
  { key: "Q3", label: "Q3 (Jul–Sep)", meses: ["Jul", "Ago", "Sep"] as MesKeyPY[] },
];

// ─── CÁLCULOS ─────────────────────────────────────────────────────
// gas = gastos operativos (ventas + administración, con el alquiler del contrato en vez del registrado)
// eb  = EBITDA = margen bruto − gastos operativos sin comisiones bancarias
// net = ganancia neta = margen bruto + otros ingresos − gastos operativos
interface Calc {
  m: string; prelim: boolean; nMeses: number;
  ing: number; cos: number; gm: number; otr: number; gv: number | null; gaNeta: number | null; com: number; alq: number;
  gas: number; eb: number; net: number; egr: number; ingT: number;
  ord: number | null; mo: number; alqB: number; ser: number; mat: number; inv: number; fc: number; fi: number | null; fr: number | null;
  ut: number; sas: number; llc: number;
}

function calcMes(x: MesRaw): Calc {
  const gm = x.ing - x.cos;
  const gas = x.gv + x.ga - x.alqEERR + x.alq;
  const fc = x.ful.mo + x.ful.alqB + x.ful.ser + x.ful.mat;
  const fi = (x.ful.ord ?? 0) * TARIFA_FUL;
  return {
    m: x.m, prelim: false, nMeses: 1,
    ing: x.ing, cos: x.cos, gm, otr: x.otr, gv: x.gv, gaNeta: gas - x.gv - x.com, com: x.com, alq: x.alq,
    gas, eb: gm - (gas - x.com), net: gm + x.otr - gas, egr: x.cos + gas, ingT: x.ing + x.otr,
    ord: x.ful.ord, mo: x.ful.mo, alqB: x.ful.alqB, ser: x.ful.ser, mat: x.ful.mat, inv: x.ful.inv ?? 0, fc, fi, fr: fi - fc,
    ut: gm * PCT_LLC, sas: x.sas, llc: x.llc,
  };
}

function calcPrelim(x: NonNullable<typeof PRELIM>): Calc {
  const fi = x.ful.ord ? x.ful.ord * TARIFA_FUL : null;
  const ing = x.ing + (fi ? Math.round(fi / 1.1) : 0);
  const gm = ing - x.cos;
  const gas = x.gastos + x.alq;
  const fc = x.ful.mo + x.ful.alqB + x.ful.ser + x.ful.mat;
  return {
    m: x.m, prelim: true, nMeses: 1,
    ing, cos: x.cos, gm, otr: x.otr, gv: null, gaNeta: null, com: x.com, alq: x.alq,
    gas, eb: gm - (gas - x.com), net: gm + x.otr - gas, egr: x.cos + gas, ingT: ing + x.otr,
    ord: x.ful.ord, mo: x.ful.mo, alqB: x.ful.alqB, ser: x.ful.ser, mat: x.ful.mat, inv: 0, fc, fi, fr: fi !== null ? fi - fc : null,
    ut: gm * PCT_LLC, sas: x.sas, llc: x.llc,
  };
}

function sumCalc(label: string, rows: Calc[]): Calc {
  const s = (k: keyof Calc) => rows.reduce((a, r) => a + ((r[k] as number | null) ?? 0), 0);
  const anyNull = (k: keyof Calc) => rows.some((r) => r[k] === null);
  return {
    m: label, prelim: rows.some((r) => r.prelim), nMeses: rows.length,
    ing: s("ing"), cos: s("cos"), gm: s("gm"), otr: s("otr"),
    gv: anyNull("gv") ? null : s("gv"), gaNeta: anyNull("gaNeta") ? null : s("gaNeta"), com: s("com"), alq: s("alq"),
    gas: s("gas"), eb: s("eb"), net: s("net"), egr: s("egr"), ingT: s("ingT"),
    ord: anyNull("ord") ? null : s("ord"), mo: s("mo"), alqB: s("alqB"), ser: s("ser"), mat: s("mat"), inv: s("inv"), fc: s("fc"),
    fi: anyNull("fi") ? null : s("fi"), fr: anyNull("fr") ? null : s("fr"),
    ut: s("ut"), sas: s("sas"), llc: s("llc"),
  };
}

const R = MESES.map(calcMes);
const P = PRELIM ? calcPrelim(PRELIM) : null;
const TOT = sumCalc(`${R[0].m}–${R[R.length - 1].m}`, R);
const findMes = (m: MesKeyPY): Calc | null => R.find((r) => r.m === m) ?? (P && P.m === m ? P : null);

// ─── FORMATO ──────────────────────────────────────────────────────
const fN = (n: number) => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n)).toLocaleString("es-AR")}`;
const gs = (n: number | null) => (n === null ? "—" : `Gs ${fN(n)}`);
const gsM = (n: number) => `Gs ${(n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 0 })}M`;
const usd = (n: number) => `USD ${fN(n)}`;
const pct = (x: number, d = 1) => `${(x * 100).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const safeDiv = (a: number, b: number) => (b ? a / b : 0);
const deltaTxt = (cur: number, prev: number | undefined) => {
  if (prev === undefined || !prev) return "";
  const d = cur / prev - 1;
  return `${d >= 0 ? "+" : ""}${pct(d)} vs mes anterior`;
};
const tipStyle = { background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 };
const tipText = { color: "#fff" };

// ─── UI ───────────────────────────────────────────────────────────
type Tone = "up" | "dn" | "neu" | "warn" | "info";
const toneColor: Record<Tone, string> = { up: C.green, dn: C.red, neu: C.gray, warn: C.amber, info: C.blue };

function Kpi({ label, value, sub, tone = "neu" }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div className="glass-card p-3" style={{ borderTop: `3px solid ${toneColor[tone]}` }}>
      <p className="text-[11px] t-muted mb-1">{label}</p>
      <p className="font-mono text-base font-semibold t-primary">{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: toneColor[tone] }}>{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold t-secondary uppercase tracking-wider mb-3">{children}</p>;
}

function Pills<T extends string>({ items, value, onChange }: { items: { key: T; label: string; prelim?: boolean }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
            value === it.key
              ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
              : it.prelim
              ? "bg-transparent border-amber-600/50 text-amber-400 hover:border-amber-500"
              : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function BarRow({ label, value, base, color, strong, neg }: { label: string; value: number; base: number; color: string; strong?: boolean; neg?: boolean }) {
  const w = Math.max(Math.min(safeDiv(value, base) * 100, 100), 0);
  return (
    <div className="flex items-center gap-3">
      <div className={`text-[11px] w-44 shrink-0 text-right ${strong ? "t-primary font-semibold" : "t-muted"}`}>{label}</div>
      <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "rgba(148,163,184,0.12)" }}>
        <div className="h-full rounded-md flex items-center px-2 text-[11px] font-semibold text-white whitespace-nowrap" style={{ width: `${Math.max(w, 8)}%`, background: color }}>
          {gsM(value)}
        </div>
      </div>
      <div className="text-[11px] font-semibold w-16 text-right font-mono" style={{ color: neg ? C.red : strong ? C.green : undefined }}>
        {base === value ? "100%" : `${neg ? "− " : ""}${pct(safeDiv(value, base))}`}
      </div>
    </div>
  );
}

// Cascada "de cada Gs 100 que ingresan"
function Cascada({ c }: { c: Calc }) {
  return (
    <div className="space-y-2">
      <BarRow label="Ingresos" value={c.ing} base={c.ing} color="#7f9cc0" strong />
      <BarRow label="— Costo logístico" value={c.cos} base={c.ing} color={C.orange} neg />
      <BarRow label="= Margen bruto" value={c.gm} base={c.ing} color="#4A9A70" strong />
      {c.gv !== null && c.gaNeta !== null ? (
        <>
          <BarRow label="— Gastos de ventas" value={c.gv} base={c.ing} color={C.gray} neg />
          <BarRow label="— Gastos de administración" value={c.gaNeta} base={c.ing} color={C.amber} neg />
        </>
      ) : (
        <BarRow label="— Gastos operativos" value={c.gas - c.com} base={c.ing} color={C.amber} neg />
      )}
      <BarRow label="= EBITDA" value={c.eb} base={c.ing} color={c.eb >= 0 ? C.green : C.red} strong />
    </div>
  );
}

// Tabla del estado de resultados para N columnas (meses o trimestres)
function TablaEERR({ cols, highlightLast }: { cols: Calc[]; highlightLast?: boolean }) {
  type Fila = { label: string; get: (c: Calc) => string; kind?: "sub" | "tot" | "pct"; neg?: (c: Calc) => boolean };
  const filas: Fila[] = [
    { label: "Ingresos operativos", get: (c) => fN(c.ing) },
    { label: "Costo logístico", get: (c) => fN(c.cos) },
    { label: "Margen bruto", get: (c) => fN(c.gm), kind: "sub" },
    { label: "% margen bruto", get: (c) => pct(safeDiv(c.gm, c.ing)), kind: "pct" },
    { label: "Gastos de ventas", get: (c) => (c.gv === null ? "—" : fN(c.gv)) },
    { label: "Gastos de administración", get: (c) => (c.gaNeta === null ? "—" : fN(c.gaNeta)) },
    { label: "Comisiones bancarias", get: (c) => fN(c.com) },
    { label: "Gastos operativos (total)", get: (c) => fN(c.gas) },
    { label: "EBITDA", get: (c) => fN(c.eb), kind: "sub", neg: (c) => c.eb < 0 },
    { label: "% EBITDA", get: (c) => pct(safeDiv(c.eb, c.ing)), kind: "pct" },
    { label: "Otros ingresos", get: (c) => fN(c.otr) },
    { label: "Ganancia neta", get: (c) => fN(c.net), kind: "tot", neg: (c) => c.net < 0 },
    { label: "% margen neto", get: (c) => pct(safeDiv(c.net, c.ing)), kind: "pct" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="py-2 px-3 text-left text-[11px] t-muted sticky left-0" style={{ background: "var(--bg-card)" }}>Concepto (Gs)</th>
            {cols.map((c, i) => (
              <th key={c.m} className="py-2 px-3 text-right text-[11px] whitespace-nowrap" style={{ color: c.prelim ? C.amber : highlightLast && i === cols.length - 1 ? C.orange : undefined }}>
                {c.m}{c.prelim ? " (prelim.)" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.label}
              className="border-b border-gray-800/50"
              style={f.kind === "tot" ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : f.kind === "sub" ? { background: "rgba(148,163,184,0.06)", fontWeight: 600 } : {}}
            >
              <td className={`py-1.5 px-3 text-xs whitespace-nowrap sticky left-0 ${f.kind === "pct" ? "t-muted pl-6" : "t-primary"}`} style={{ background: "var(--bg-card)" }}>{f.label}</td>
              {cols.map((c) => (
                <td key={c.m} className={`py-1.5 px-3 text-right font-mono whitespace-nowrap ${f.kind === "pct" ? "text-[11px] t-muted" : "text-xs"}`} style={{ color: f.neg?.(c) ? C.red : undefined, opacity: c.prelim ? 0.85 : 1 }}>
                  {f.get(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── VISTAS ───────────────────────────────────────────────────────
type TabKey = "resumen" | "mes" | "trimestre" | "eerr" | "fulfillment" | "saldos";

function ResumenView() {
  const [mode, setMode] = useState<"monto" | "pct">("monto");
  const ultimo = R[R.length - 1];
  const ebData = [...R, ...(P ? [P] : [])].map((r) => ({ mes: r.prelim ? `${r.m}*` : r.m, prelim: r.prelim, monto: Math.round(r.eb / 1e6), pct: +(safeDiv(r.eb, r.ing) * 100).toFixed(1) }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        <Kpi label="💰 Ingresos" value={gsM(TOT.ing)} sub={`Promedio ${gsM(TOT.ing / R.length)} por mes`} tone="info" />
        <Kpi label="📤 Egresos" value={gsM(TOT.egr)} sub={`${pct(safeDiv(TOT.egr, TOT.ing))} de los ingresos`} tone="dn" />
        <Kpi label="📊 Margen bruto" value={pct(safeDiv(TOT.gm, TOT.ing))} sub={gsM(TOT.gm)} tone="warn" />
        <Kpi label="📈 EBITDA" value={gsM(TOT.eb)} sub={`${pct(safeDiv(TOT.eb, TOT.ing))} sobre ingresos`} tone="up" />
        <Kpi label="✅ Ganancia neta" value={gsM(TOT.net)} sub={`Margen neto ${pct(safeDiv(TOT.net, TOT.ing))}`} tone="up" />
        {P ? (
          <Kpi label={`⚡ Ingresos ${NOM[P.m as MesKeyPY].toLowerCase()} (prelim.)`} value={gsM(P.ing)} sub={`${P.ing >= ultimo.ing ? "+" : ""}${pct(P.ing / ultimo.ing - 1)} vs ${NOM[ultimo.m as MesKeyPY].toLowerCase()}`} tone="warn" />
        ) : (
          <Kpi label="🏦 Patrimonio neto" value={gsM(BAL.patrimonio)} sub={`Al ${BAL.fecha}`} tone="up" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>De cada Gs 100 que ingresan — {TOT.m} 2026</SectionTitle>
          <Cascada c={TOT} />
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>EBITDA mensual</SectionTitle>
            <div className="flex gap-1">
              {(["monto", "pct"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`text-[10px] px-2 py-1 rounded-md border transition-all ${mode === m ? "bg-orange-500 text-white border-orange-500" : "bg-transparent t-secondary border-gray-700"}`}>
                  {m === "monto" ? "Gs" : "%"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={ebData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => (mode === "monto" ? `${v}M` : `${v}%`)} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipText} labelStyle={tipText} formatter={(v) => (mode === "monto" ? `Gs ${v}M` : `${String(v).replace(".", ",")}%`)} />
              <Bar dataKey={mode} name="EBITDA" radius={[4, 4, 0, 0]}>
                {ebData.map((d, i) => <Cell key={i} fill={d.prelim ? C.amber : d[mode] >= 0 ? C.greenBar : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {P && <p className="text-[10px] t-muted">* {NOM[P.m as MesKeyPY]} preliminar (sin estado de resultados cerrado).</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Por trimestre</SectionTitle>
          <TablaEERR cols={QUARTERS.map((q) => sumCalc(q.key + (q.meses.every((m) => R.some((r) => r.m === m)) ? "" : " parcial"), R.filter((r) => q.meses.includes(r.m as MesKeyPY)))).filter((c) => c.nMeses > 0)} />
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Balance al {BAL.fecha}</SectionTitle>
          {[
            { l: "Activo total", v: gs(BAL.activo) },
            { l: "Pasivo total", v: gs(BAL.pasivo) },
            { l: "Patrimonio neto", v: gs(BAL.patrimonio), strong: true },
            { l: "Liquidez corriente", v: (BAL.actCorr / BAL.pasCorr).toFixed(2).replace(".", ",") },
            { l: `Rentabilidad sobre patrimonio (${TOT.m})`, v: pct(safeDiv(TOT.net, BAL.patrimonio)) },
          ].map((b) => (
            <div key={b.l} className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <span className={`text-xs ${b.strong ? "t-primary font-semibold" : "t-muted"}`}>{b.l}</span>
              <span className={`font-mono font-semibold ${b.strong ? "text-base" : "text-xs"}`} style={{ color: b.strong ? C.green : undefined }}>{b.v}</span>
            </div>
          ))}
          <p className="text-[11px] t-muted mt-3 leading-relaxed">
            El activo y el pasivo incluyen los fondos de los dropshippers que Dropi administra; se compensan entre sí. El número que importa es el patrimonio neto.
          </p>
        </div>
      </div>
    </div>
  );
}

function MesView({ mes, setMes }: { mes: MesKeyPY; setMes: (m: MesKeyPY) => void }) {
  const c = findMes(mes) ?? R[R.length - 1];
  const idx = R.findIndex((r) => r.m === c.m);
  const prev = c.prelim ? R[R.length - 1] : idx > 0 ? R[idx - 1] : undefined;
  const items = [...R.map((r) => ({ key: r.m as MesKeyPY, label: NOM[r.m as MesKeyPY] })), ...(P ? [{ key: P.m as MesKeyPY, label: `${NOM[P.m as MesKeyPY]} (prelim.)`, prelim: true }] : [])];
  const ful = [
    { l: "Mano de obra", v: c.mo, color: C.orange },
    { l: "Alquiler bodega", v: c.alqB, color: C.amber },
    { l: "Materiales de embalaje", v: c.mat, color: C.gray },
    { l: "Servicios y otros", v: c.ser, color: C.grayLt },
  ];
  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <SectionTitle>Elegí el mes</SectionTitle>
        <Pills items={items} value={c.m as MesKeyPY} onChange={setMes} />
        {c.prelim && (
          <p className="text-[11px] mt-3" style={{ color: C.amber }}>
            ⚠ {NOM[c.m as MesKeyPY]} es preliminar: todavía no hay estado de resultados cerrado. Los gastos vienen en un solo total (sin separar ventas y administración) y no hay otros ingresos ni órdenes de fulfillment cargadas.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        <Kpi label="💰 Ingresos" value={gsM(c.ing)} sub={deltaTxt(c.ing, prev?.ing) || "Primer mes del año"} tone="info" />
        <Kpi label="🚚 Costo logístico" value={gsM(c.cos)} sub={`${pct(safeDiv(c.cos, c.ing))} de los ingresos`} tone="dn" />
        <Kpi label="📊 Margen bruto" value={pct(safeDiv(c.gm, c.ing))} sub={`${gsM(c.gm)}${prev ? ` · antes ${pct(safeDiv(prev.gm, prev.ing))}` : ""}`} tone="warn" />
        <Kpi label="🏢 Gastos operativos" value={gsM(c.gas)} sub={`${pct(safeDiv(c.gas, c.ing))} de los ingresos`} tone="neu" />
        <Kpi label="📈 EBITDA" value={gsM(c.eb)} sub={`${pct(safeDiv(c.eb, c.ing))}${prev ? ` · antes ${pct(safeDiv(prev.eb, prev.ing))}` : ""}`} tone={c.eb >= 0 ? "up" : "dn"} />
        <Kpi label="✅ Ganancia neta" value={gsM(c.net)} sub={`Margen neto ${pct(safeDiv(c.net, c.ing))}${c.otr ? ` · incluye otros ingresos ${gsM(c.otr)}` : ""}`} tone={c.net >= 0 ? "up" : "dn"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>De cada Gs 100 que ingresan — {NOM[c.m as MesKeyPY]}</SectionTitle>
          <Cascada c={c} />
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Estado de resultados — {NOM[c.m as MesKeyPY]}{prev ? ` vs ${NOM[prev.m as MesKeyPY]}` : ""}</SectionTitle>
          <TablaEERR cols={prev ? [prev, c] : [c]} highlightLast />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Fulfillment — {NOM[c.m as MesKeyPY]}</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Kpi label="📦 Entregados" value={c.ord === null ? "—" : fN(c.ord)} tone="neu" />
            <Kpi label="💰 Ingreso" value={gs(c.fi)} sub={`Gs ${fN(TARIFA_FUL)} por entregado`} tone="info" />
            <Kpi label="Resultado" value={gs(c.fr)} tone={c.fr === null ? "neu" : c.fr >= 0 ? "up" : "dn"} />
          </div>
          <div className="space-y-2">
            {ful.map((f) => (
              <div key={f.l} className="flex items-center gap-3">
                <div className="text-[11px] w-40 shrink-0 text-right t-muted">{f.l}</div>
                <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: "rgba(148,163,184,0.15)" }}>
                  <div className="h-full rounded" style={{ width: `${safeDiv(f.v, c.fc) * 100}%`, background: f.color }} />
                </div>
                <div className="text-[11px] font-mono w-32 text-right t-primary">{gs(f.v)}</div>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-2 border-t border-gray-800/50">
              <span className="t-muted">Costo total{c.ord ? ` · Gs ${fN(c.fc / c.ord)} por entregado` : ""}</span>
              <span className="font-mono font-semibold t-primary">{gs(c.fc)}</span>
            </div>
            {c.inv > 0 && <p className="text-[11px] t-muted">+ Inversión en bodega (equipos, una sola vez): {gs(c.inv)}</p>}
          </div>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Utilidades y transferencias — {NOM[c.m as MesKeyPY]}</SectionTitle>
          {[
            { l: "Utilidad bruta sin IVA (margen bruto)", v: gs(c.gm) },
            { l: "Utilidad para Dropi LLC (25%)", v: gs(c.ut), strong: true },
            { l: "Transferido a Dropi LLC", v: c.llc ? usd(c.llc) : "—" },
            { l: "Transferido a Dropi S.A.S. (retiros de saldo)", v: c.sas ? usd(c.sas) : "—" },
            { l: "Alquiler del mes (contrato)", v: gs(c.alq) },
          ].map((b) => (
            <div key={b.l} className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <span className={`text-xs ${b.strong ? "t-primary font-semibold" : "t-muted"}`}>{b.l}</span>
              <span className="font-mono text-xs font-semibold t-primary">{b.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrimestreView({ q, setQ }: { q: string; setQ: (q: string) => void }) {
  const qs = QUARTERS.map((qq) => {
    const cerrados = R.filter((r) => qq.meses.includes(r.m as MesKeyPY));
    const conPrelim = P && qq.meses.includes(P.m as MesKeyPY) ? [...cerrados, P] : cerrados;
    const completo = qq.meses.every((m) => R.some((r) => r.m === m));
    return { ...qq, cerrados, conPrelim, completo, calc: sumCalc(qq.key + (completo ? "" : " parcial"), cerrados) };
  }).filter((x) => x.cerrados.length > 0);
  const sel = qs.find((x) => x.key === q) ?? qs[qs.length - 1];
  const prevQ = qs[qs.indexOf(sel) - 1];
  const chart = qs.map((x) => ({ q: x.key, Ingresos: Math.round(x.calc.ing / 1e6), Egresos: Math.round(x.calc.egr / 1e6), EBITDA: Math.round(x.calc.eb / 1e6), mb: +(safeDiv(x.calc.gm, x.calc.ing) * 100).toFixed(1), meb: +(safeDiv(x.calc.eb, x.calc.ing) * 100).toFixed(1) }));
  const conPrelim = sel.conPrelim.length > sel.cerrados.length ? sumCalc(`${sel.key} con ${P!.m} prelim.`, sel.conPrelim) : null;
  const v = (a: number, b: number | undefined) => (b ? `${a >= b ? "+" : ""}${pct(a / b - 1)}` : "");

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <SectionTitle>Elegí el trimestre</SectionTitle>
        <Pills items={qs.map((x) => ({ key: x.key, label: x.completo ? x.label : `${x.label} — parcial` }))} value={sel.key} onChange={setQ} />
        {!sel.completo && (
          <p className="text-[11px] mt-3" style={{ color: C.amber }}>
            ⚠ {sel.key} parcial: tiene {sel.cerrados.map((r) => NOM[r.m as MesKeyPY]).join(" y ")} cerrados{conPrelim ? `; abajo se muestra también con ${NOM[P!.m as MesKeyPY]} preliminar` : ""}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        <Kpi label="💰 Ingresos" value={gsM(sel.calc.ing)} sub={prevQ ? `${v(sel.calc.ing, prevQ.calc.ing)} vs ${prevQ.key}` : `Promedio ${gsM(sel.calc.ing / sel.calc.nMeses)} por mes`} tone="info" />
        <Kpi label="📤 Egresos" value={gsM(sel.calc.egr)} sub={`${pct(safeDiv(sel.calc.egr, sel.calc.ing))} de los ingresos`} tone="dn" />
        <Kpi label="📊 Margen bruto" value={pct(safeDiv(sel.calc.gm, sel.calc.ing))} sub={prevQ ? `${prevQ.key}: ${pct(safeDiv(prevQ.calc.gm, prevQ.calc.ing))}` : gsM(sel.calc.gm)} tone="warn" />
        <Kpi label="📈 EBITDA" value={gsM(sel.calc.eb)} sub={`${pct(safeDiv(sel.calc.eb, sel.calc.ing))}${prevQ ? ` · ${prevQ.key}: ${pct(safeDiv(prevQ.calc.eb, prevQ.calc.ing))}` : ""}`} tone={sel.calc.eb >= 0 ? "up" : "dn"} />
        <Kpi label="✅ Ganancia neta" value={gsM(sel.calc.net)} sub={`Margen neto ${pct(safeDiv(sel.calc.net, sel.calc.ing))}`} tone={sel.calc.net >= 0 ? "up" : "dn"} />
        <Kpi label="📦 Fulfillment" value={gs(sel.calc.fr)} sub={sel.calc.ord !== null ? `${fN(sel.calc.ord)} entregados` : ""} tone={sel.calc.fr !== null && sel.calc.fr < 0 ? "dn" : "up"} />
      </div>

      <div className="glass-card p-4">
        <SectionTitle>Estado de resultados — {sel.label} mes a mes</SectionTitle>
        <TablaEERR
          cols={[
            ...sel.conPrelim,
            { ...sel.calc, m: `Total ${sel.calc.m}` },
            ...(conPrelim ? [{ ...conPrelim, m: `Total ${sel.key} con ${P!.m}` }] : []),
          ]}
          highlightLast
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Trimestres comparados (Gs millones)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="q" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(x) => `${x}M`} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipText} labelStyle={tipText} formatter={(x) => `Gs ${Number(x).toLocaleString("es-AR")}M`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ingresos" fill={C.blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Egresos" fill={C.orange} radius={[4, 4, 0, 0]} />
              <Bar dataKey="EBITDA" fill={C.greenBar} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {qs.some((x) => !x.completo) && <p className="text-[10px] t-muted">El trimestre parcial tiene menos meses: compará márgenes (%), no montos.</p>}
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Todos los trimestres</SectionTitle>
          <TablaEERR cols={qs.map((x) => x.calc)} />
        </div>
      </div>
    </div>
  );
}

function EerrView() {
  const cols = [...R, TOT, ...(P ? [P] : [])].map((c) => (c === TOT ? { ...c, m: `Total ${c.m}` } : c));
  const mg = R.map((r) => ({ mes: r.m, "Margen bruto": +(safeDiv(r.gm, r.ing) * 100).toFixed(1), "Margen EBITDA": +(safeDiv(r.eb, r.ing) * 100).toFixed(1) }));
  const costos = [
    { l: "Costo logístico", v: TOT.cos, color: C.orange },
    { l: "Gastos de administración", v: TOT.gaNeta ?? 0, color: C.amber },
    { l: "Gastos de ventas", v: TOT.gv ?? 0, color: C.gray },
    { l: "Comisiones bancarias", v: TOT.com, color: C.grayLt },
    { l: "EBITDA", v: TOT.eb, color: C.green },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Margen bruto" value={pct(safeDiv(TOT.gm, TOT.ing))} sub={gsM(TOT.gm)} tone="warn" />
        <Kpi label="Margen EBITDA" value={pct(safeDiv(TOT.eb, TOT.ing))} sub={gsM(TOT.eb)} tone="up" />
        <Kpi label="Margen neto" value={pct(safeDiv(TOT.net, TOT.ing))} sub={gsM(TOT.net)} tone="up" />
        <Kpi label="Gastos operativos / ingresos" value={pct(safeDiv(TOT.gas, TOT.ing))} sub={gsM(TOT.gas)} tone="neu" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>Margen bruto y EBITDA (%)</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={mg}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(x) => `${x}%`} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipText} labelStyle={tipText} formatter={(x) => `${String(x).replace(".", ",")}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="Margen bruto" stroke={C.blue} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line dataKey="Margen EBITDA" stroke={C.orange} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Costos y gastos — % sobre ingresos ({TOT.m})</SectionTitle>
          <div className="space-y-3 mt-2">
            {costos.map((x) => (
              <div key={x.l} className="flex items-center gap-3">
                <div className={`text-[11px] w-44 shrink-0 text-right ${x.l === "EBITDA" ? "font-semibold" : "t-muted"}`} style={x.l === "EBITDA" ? { color: C.green } : undefined}>{x.l}</div>
                <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: "rgba(148,163,184,0.15)" }}>
                  <div className="h-full rounded" style={{ width: `${safeDiv(x.v, TOT.ing) * 100}%`, background: x.color }} />
                </div>
                <div className="text-[11px] font-mono w-14 text-right t-primary">{pct(safeDiv(x.v, TOT.ing))}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass-card p-4">
        <SectionTitle>Estado de resultados mensual (Gs)</SectionTitle>
        <TablaEERR cols={cols} />
        <p className="text-[11px] t-muted mt-3">
          EBITDA = margen bruto − gastos operativos sin comisiones bancarias. Gastos operativos con el alquiler mensual del contrato (en junio se registraron Gs 13,5M de alquileres atrasados que se reemplazan por el alquiler del mes).
        </p>
      </div>
    </div>
  );
}

function FulfillmentView() {
  const fulRows = [...R, ...(P ? [P] : [])];
  const chart = R.map((r) => ({ mes: r.m, Resultado: Math.round((r.fr ?? 0) / 1e6) }));
  const comp = [
    { l: "Mano de obra", v: TOT.mo, color: C.orange },
    { l: "Alquiler bodega", v: TOT.alqB, color: C.amber },
    { l: "Materiales de embalaje", v: TOT.mat, color: C.gray },
    { l: "Servicios y otros", v: TOT.ser, color: C.grayLt },
  ];
  const ord = TOT.ord ?? 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Kpi label="📦 Entregados" value={fN(ord)} sub={`Promedio ${fN(ord / R.length)} por mes`} tone="neu" />
        <Kpi label="💰 Ingresos" value={gsM(TOT.fi ?? 0)} sub={`Gs ${fN(TARIFA_FUL)} por entregado`} tone="info" />
        <Kpi label={(TOT.fr ?? 0) < 0 ? "📉 Resultado" : "📈 Resultado"} value={gsM(TOT.fr ?? 0)} sub={`${pct(safeDiv(TOT.fr ?? 0, TOT.fi ?? 0))} sobre ingresos`} tone={(TOT.fr ?? 0) < 0 ? "dn" : "up"} />
        <Kpi label="⚖️ Costo por entregado" value={`Gs ${fN(safeDiv(TOT.fc, ord))}`} sub={`Tarifa Gs ${fN(TARIFA_FUL)}`} tone="warn" />
        <Kpi label="🛠️ Inversiones en bodega" value={gsM(TOT.inv)} sub="Equipos y mobiliario, fuera del costo" tone="info" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <SectionTitle>En qué se gasta ({TOT.m})</SectionTitle>
          <div className="space-y-3 mt-2">
            {comp.map((x) => (
              <div key={x.l} className="flex items-center gap-3">
                <div className="text-[11px] w-40 shrink-0 text-right t-muted">{x.l}</div>
                <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: "rgba(148,163,184,0.15)" }}>
                  <div className="h-full rounded" style={{ width: `${safeDiv(x.v, TOT.fc) * 100}%`, background: x.color }} />
                </div>
                <div className="text-[11px] font-mono w-40 text-right t-primary">{pct(safeDiv(x.v, TOT.fc), 0)} · {gsM(x.v)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Resultado mensual (Gs millones)</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(x) => `${x}M`} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipText} labelStyle={tipText} formatter={(x) => `Gs ${x}M`} />
              <Bar dataKey="Resultado" radius={[4, 4, 0, 0]}>
                {chart.map((d, i) => <Cell key={i} fill={d.Resultado >= 0 ? C.greenBar : C.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="glass-card p-4 overflow-x-auto">
        <SectionTitle>Detalle por mes (Gs)</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {["Mes", "Entregados", "Ingreso", "Mano de obra", "Alquiler", "Materiales", "Servicios y otros", "Costo total", "Resultado", "Inversión bodega"].map((h, i) => (
                <th key={h} className={`py-2 px-3 text-[11px] t-muted whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...fulRows, TOT].map((r) => {
              const tot = r === TOT;
              return (
                <tr key={r.m} className="border-b border-gray-800/50" style={tot ? { background: "rgba(232,84,10,0.10)", fontWeight: 700 } : r.prelim ? { color: C.amber } : {}}>
                  <td className="py-1.5 px-3 text-xs whitespace-nowrap">{tot ? `Total ${r.m}` : `${NOM[r.m as MesKeyPY]}${r.prelim ? " (prelim.)" : ""}`}</td>
                  {[r.ord, r.fi, r.mo, r.alqB, r.mat, r.ser, r.fc].map((x, i) => <td key={i} className="py-1.5 px-3 text-right font-mono text-xs">{x === null ? "—" : fN(x)}</td>)}
                  <td className="py-1.5 px-3 text-right font-mono text-xs" style={{ color: r.fr === null ? undefined : r.fr < 0 ? C.red : C.green }}>{r.fr === null ? "—" : fN(r.fr)}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs">{r.inv ? fN(r.inv) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {P && <p className="text-[11px] t-muted mt-2">{NOM[P.m as MesKeyPY]} preliminar: sin órdenes entregadas cargadas, por eso no hay ingreso ni resultado de fulfillment. El total es {TOT.m} (meses cerrados).</p>}
      </div>
    </div>
  );
}

function SaldosView() {
  const all = [...R, ...(P ? [P] : [])];
  const utTot = all.reduce((a, r) => a + r.ut, 0);
  const sasT = all.reduce((a, r) => a + r.sas, 0);
  const llcT = all.reduce((a, r) => a + r.llc, 0);
  const chart = all.map((r) => ({ mes: r.prelim ? `${r.m}*` : r.m, "Dropi S.A.S.": r.sas, "Dropi LLC": r.llc }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="AEX nos debe" value={gs(BAL.aex)} sub={`Recaudo pendiente de cobro al ${BAL.fecha}`} tone="up" />
        <Kpi label="Deuda con Dropi S.A.S. (retiros de saldo)" value={gs(BAL.deudaSAS)} sub={`Transferido en 2026: ${usd(sasT)}`} tone="dn" />
        <Kpi label="Utilidad Dropi LLC (25%)" value={gs(utTot)} sub={`Transferido en 2026: ${usd(llcT)}`} tone="warn" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-4 overflow-x-auto">
          <SectionTitle>Utilidad para Dropi LLC — 25% de la utilidad bruta sin IVA</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {["Mes", "Utilidad bruta sin IVA", "25% Dropi LLC", "Transferido (USD)"].map((h, i) => <th key={h} className={`py-2 px-3 text-[11px] t-muted ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr key={r.m} className="border-b border-gray-800/50" style={r.prelim ? { color: C.amber } : {}}>
                  <td className="py-1.5 px-3 text-xs">{NOM[r.m as MesKeyPY]}{r.prelim ? " (prelim.)" : ""}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs">{fN(r.gm)}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs">{fN(r.ut)}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-xs">{r.llc ? fN(r.llc) : "—"}</td>
                </tr>
              ))}
              <tr style={{ background: "rgba(232,84,10,0.10)", fontWeight: 700 }}>
                <td className="py-1.5 px-3 text-xs">Total</td>
                <td className="py-1.5 px-3 text-right font-mono text-xs">{fN(all.reduce((a, r) => a + r.gm, 0))}</td>
                <td className="py-1.5 px-3 text-right font-mono text-xs">{fN(utTot)}</td>
                <td className="py-1.5 px-3 text-right font-mono text-xs">{fN(llcT)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="glass-card p-4">
          <SectionTitle>Transferencias al exterior (USD)</SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="mes" stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(x) => `${Math.round(Number(x) / 1000)}K`} />
              <Tooltip contentStyle={tipStyle} itemStyle={tipText} labelStyle={tipText} formatter={(x) => usd(Number(x))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Dropi S.A.S." fill={C.blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dropi LLC" fill={C.orange} radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE ───────────────────────────────────────────────────
export default function FinanzasDashboardPY_2026({ mesFilter }: { mesFilter?: MesFilter }) {
  const ultimoCerrado = R[R.length - 1].m as MesKeyPY;
  const [tab, setTab] = useState<TabKey>("resumen");
  const [mes, setMes] = useState<MesKeyPY>(ultimoCerrado);
  const [q, setQ] = useState<string>("Q3");

  // Si arriba se elige un mes o un trimestre, la pestaña lo sigue
  useEffect(() => {
    if (!mesFilter) return;
    const m = FILTER_TO_MES[mesFilter];
    if (m && findMes(m)) { setMes(m); setTab("mes"); return; }
    const qq = mesFilter.toUpperCase();
    if (QUARTERS.some((x) => x.key === qq) && R.some((r) => QUARTERS.find((x) => x.key === qq)!.meses.includes(r.m as MesKeyPY))) { setQ(qq); setTab("trimestre"); }
  }, [mesFilter]);

  const tabs: { key: TabKey; label: string }[] = useMemo(() => [
    { key: "resumen", label: "🧭 Resumen" },
    { key: "mes", label: "📅 Por mes" },
    { key: "trimestre", label: "📊 Por trimestre" },
    { key: "eerr", label: "💹 Estado de resultados" },
    { key: "fulfillment", label: "📦 Fulfillment" },
    { key: "saldos", label: "🏦 Saldos y utilidades" },
  ], []);

  return (
    <div className="space-y-6">
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-bold t-primary flex flex-wrap items-center gap-2">
              DROPI E.A.S. — Finanzas Paraguay 2026
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.orange, color: "white" }}>{NOM[R[0].m as MesKeyPY]} – {NOM[ultimoCerrado]}</span>
              {P && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.amber, color: "white" }}>{NOM[P.m as MesKeyPY]} preliminar</span>}
            </h2>
            <p className="text-xs t-muted mt-1">Informe financiero mensual · Cierre contable al {BAL.fecha} · Cifras en guaraníes (Gs) · Transferencias en USD</p>
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
      {tab === "mes" && <MesView mes={mes} setMes={setMes} />}
      {tab === "trimestre" && <TrimestreView q={q} setQ={setQ} />}
      {tab === "eerr" && <EerrView />}
      {tab === "fulfillment" && <FulfillmentView />}
      {tab === "saldos" && <SaldosView />}
    </div>
  );
}
