"use client";

// ═══════════════════════════════════════════════════════════════════
// PUNTO DE EQUILIBRIO — Argentina.
// Real (no simulado): guías movilizadas EN VIVO con la misma regla y snapshot que el
// Dashboard operativo, mix Fixy/Urbano y ticket reales del mes, gasto del mes desde la
// rendición de caja. Sigue al mes elegido en el selector de arriba.
// Utilidad por guía = rentabilidad por guía de la transportadora (Informe Utilidad Gerencial),
//                   que ya incluye la comisión COD.
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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
} from "recharts";
import type { MesKey, RendicionCaja } from "../lib/finanzas-ar-types";
import { C, fmtArs, fmtArsExact, fmtNum, fmtPct, Badge, KpiCard, Td, Th, type Tone } from "./finanzas-ar-ui";

// Rentabilidad real por guía (Informe Utilidad Gerencial, Power BI). Ya incluye la
// comisión COD: no se suma nada encima. Meses sin informe usan el último mes cargado
// antes (se marca en pantalla).
// Para cargar un mes nuevo: agregar su fila acá.
const MARGEN_HIST: Partial<Record<MesKey, { fixy: number; urbano: number; guiasFixy: number | null; guiasUrbano: number | null }>> = {
  ene: { fixy: 1353, urbano: 2393, guiasFixy: 8274, guiasUrbano: 6 },
  feb: { fixy: 1394, urbano: 2887, guiasFixy: 6476, guiasUrbano: 358 },
  mar: { fixy: 1425, urbano: 2515, guiasFixy: 4683, guiasUrbano: 1506 },
  abr: { fixy: 1868, urbano: 2680, guiasFixy: 4689, guiasUrbano: 4393 },
  may: { fixy: 1859, urbano: 2719, guiasFixy: 11871, guiasUrbano: 4253 },
  jun: { fixy: 1917, urbano: 3284, guiasFixy: 10268, guiasUrbano: 3779 },
  ago: { fixy: 2670, urbano: 4169, guiasFixy: null, guiasUrbano: null },
  sep: { fixy: 2901, urbano: 3810, guiasFixy: null, guiasUrbano: null },
};

// Gasto mensual de meses SIN rendición de caja cargada (rendición en papel).
// Cuando se sube la rendición del mes desde "Rendición de caja", esa manda.
const OPEX_HIST: Partial<Record<MesKey, { total: number; fijos: number | null; nota: string }>> = {
  jun: { total: 44_932_980, fijos: null, nota: "Caja $22,7M + Banco $22,3M" },
  jul: { total: 50_154_900, fijos: 34_182_867, nota: "Egresos de caja de julio" },
};

const PE_KEYS: MesKey[] = ["abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ALL_KEYS: MesKey[] = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const KEY_TO_MES: Record<MesKey, string> = {
  ene: "enero", feb: "febrero", mar: "marzo", abr: "abril", may: "mayo", jun: "junio",
  jul: "julio", ago: "agosto", sep: "septiembre", oct: "octubre", nov: "noviembre", dic: "diciembre",
};
const MES_LABEL: Record<MesKey, string> = {
  ene: "Enero", feb: "Febrero", mar: "Marzo", abr: "Abril", may: "Mayo", jun: "Junio",
  jul: "Julio", ago: "Agosto", sep: "Septiembre", oct: "Octubre", nov: "Noviembre", dic: "Diciembre",
};
const MES_CORTO: Record<MesKey, string> = { ene: "Ene", feb: "Feb", mar: "Mar", abr: "Abr", may: "May", jun: "Jun", jul: "Jul", ago: "Ago", sep: "Sep", oct: "Oct", nov: "Nov", dic: "Dic" };

// Utilidad por guía = rentabilidad por guía de cada transportadora (ya incluye el COD).
function beCalc(opex: number, margenFixy: number, margenUrbano: number, mixPct: number) {
  const uF = margenFixy;
  const uU = margenUrbano;
  const uM = (mixPct / 100) * uF + (1 - mixPct / 100) * uU;
  return {
    uF, uU, uM,
    beFixy: uF > 0 ? Math.ceil(opex / uF) : 0,
    beUrb: uU > 0 ? Math.ceil(opex / uU) : 0,
    beMix: uM > 0 ? Math.ceil(opex / uM) : 0,
  };
}

// ─── Modelo ───
interface ApiRow { mes: string; mesOrden: number | null; dia: number | null; transportadora: string; total: number; movilizadas: number; entregadas: number; valor: number }
export interface PeApi { rows: ApiRow[]; ingresadas: { mes: string; ingresadas: number }[] }

// Utilidad de una transportadora en el mes: guías × rentabilidad por guía (COD incluido)
interface PeLinea {
  nombre: string;
  guias: number;
  margenGuia: number;      // rentabilidad por guía (Informe Utilidad)
  margenTotal: number;
  total: number;           // = margenTotal
  porGuia: number;         // total ÷ guías
}

interface PeDia { dia: number; guias: number; acum: number; utilAcum: number; necesario: number; proyeccion?: number }

interface PeMes {
  m: MesKey;
  ingresadas: number | null;
  movilizadas: number;
  entregadas: number;
  fixy: number;
  urbano: number;
  otras: number;
  mixPct: number;          // % Fixy sobre Fixy+Urbano
  ticket: number;
  margenFixy: number;
  margenUrbano: number;
  margenMes: MesKey;       // de qué mes es el margen logístico usado
  uF: number;
  uU: number;
  uM: number;              // utilidad promedio real por guía (mix real)
  utilidad: number;
  opexTotal: number;
  opexFijos: number | null;
  opexFuente: string;
  opexEstimado: boolean;
  beTotal: number;
  beFijos: number | null;
  resultado: number;
  enCurso: boolean;
  diasMes: number;
  diasTranscurridos: number;
  proyeccion: number | null;   // guías al cierre al ritmo actual (solo mes en curso)
  diaEquilibrio: number | null;
  dias: PeDia[];
  lineas: PeLinea[];
}

function buildPuntoEquilibrio(api: PeApi | null, rendiciones: Partial<Record<MesKey, RendicionCaja>>): PeMes[] {
  if (!api) return [];
  const hoy = new Date();
  const out: PeMes[] = [];
  let ultimoOpex: { m: MesKey; total: number; fijos: number | null } | null = null;

  for (const m of PE_KEYS) {
    // Gasto del mes: rendición cargada > rendición en papel > último conocido (estimado)
    const r = rendiciones[m];
    let opexTotal: number | null = null, opexFijos: number | null = null, opexFuente = "", opexEstimado = false;
    if (r) {
      opexTotal = r.movimientos.reduce((s, x) => s + x.monto, 0);
      opexFijos = r.movimientos.filter((x) => x.tipo === "fijo").reduce((s, x) => s + x.monto, 0);
      opexFuente = "Rendición de caja";
    } else if (OPEX_HIST[m]) {
      opexTotal = OPEX_HIST[m]!.total;
      opexFijos = OPEX_HIST[m]!.fijos;
      opexFuente = OPEX_HIST[m]!.nota;
    }
    if (opexTotal !== null) ultimoOpex = { m, total: opexTotal, fijos: opexFijos };

    const rows = api.rows.filter((x) => x.mes === KEY_TO_MES[m]);
    const movilizadas = rows.reduce((s, x) => s + x.movilizadas, 0);
    if (movilizadas === 0) continue;
    if (opexTotal === null) {
      if (!ultimoOpex) continue;
      opexTotal = ultimoOpex.total;
      opexFijos = ultimoOpex.fijos;
      opexFuente = `Estimado con gasto de ${MES_CORTO[ultimoOpex.m]}`;
      opexEstimado = true;
    }

    const idx = ALL_KEYS.indexOf(m);
    const diasMes = new Date(2026, idx + 1, 0).getDate();
    const isFixy = (t: string) => t.includes("FIXY");
    const isUrb = (t: string) => t.includes("URBANO");
    const grupo = (t: string) => (isFixy(t) ? "Fixy" : isUrb(t) ? "Urbano" : "Otras");
    const fixy = rows.filter((x) => isFixy(x.transportadora)).reduce((s, x) => s + x.movilizadas, 0);
    const urbano = rows.filter((x) => isUrb(x.transportadora)).reduce((s, x) => s + x.movilizadas, 0);
    const otras = movilizadas - fixy - urbano;
    const entregadas = rows.reduce((s, x) => s + x.entregadas, 0);
    const valor = rows.reduce((s, x) => s + x.valor, 0);
    const ticket = movilizadas > 0 ? valor / movilizadas : 0;
    const mixPct = fixy + urbano > 0 ? (fixy / (fixy + urbano)) * 100 : 100;

    // Margen logístico: el del mes si hay Informe Utilidad; si no, el último informe disponible
    const margenMes = [...ALL_KEYS.slice(0, idx + 1)].reverse().find((k) => MARGEN_HIST[k]) ?? "jun";
    const margenFixy = MARGEN_HIST[margenMes]!.fixy;
    const margenUrbano = MARGEN_HIST[margenMes]!.urbano;
    const b = beCalc(opexTotal, margenFixy, margenUrbano, mixPct);

    // Utilidad por transportadora. "Otras" (si aparecieran) toman la rentabilidad promedio del mix.
    const margenOtras = (mixPct / 100) * margenFixy + (1 - mixPct / 100) * margenUrbano;
    const lineas: PeLinea[] = (["Fixy", "Urbano", "Otras"] as const).map((nombre) => {
      const rs = rows.filter((x) => grupo(x.transportadora) === nombre);
      const guias = rs.reduce((s, x) => s + x.movilizadas, 0);
      const margenGuia = nombre === "Fixy" ? margenFixy : nombre === "Urbano" ? margenUrbano : margenOtras;
      const margenTotal = guias * margenGuia;
      return { nombre, guias, margenGuia, margenTotal, total: margenTotal, porGuia: margenGuia };
    }).filter((l) => l.guias > 0);
    const porGuiaDe = (t: string) => lineas.find((l) => l.nombre === grupo(t))?.porGuia ?? 0;
    const uGuia = porGuiaDe;
    const utilidad = lineas.reduce((s, l) => s + l.total, 0);
    const uM = utilidad / movilizadas;
    const beTotal = Math.ceil(opexTotal / uM);

    // Serie diaria por día de orden. Órdenes del mes anterior que vienen en el archivo → día 1.
    const porDia = Array.from({ length: diasMes + 1 }, () => ({ guias: 0, util: 0 }));
    for (const x of rows) {
      let d = x.dia ?? 1;
      if (x.mesOrden !== null && x.mesOrden !== idx + 1) d = x.mesOrden < idx + 1 ? 1 : diasMes;
      d = Math.min(Math.max(d, 1), diasMes);
      porDia[d].guias += x.movilizadas;
      porDia[d].util += x.movilizadas * uGuia(x.transportadora);
    }
    const enCurso = hoy.getFullYear() === 2026 && hoy.getMonth() === idx;
    const diasTranscurridos = enCurso ? Math.min(hoy.getDate(), diasMes) : diasMes;
    const ritmo = movilizadas / diasTranscurridos;
    const proyeccion = enCurso ? Math.round(ritmo * diasMes) : null;
    let acum = 0, utilAcum = 0;
    let diaEquilibrio: number | null = null;
    const dias: PeDia[] = [];
    for (let d = 1; d <= diasMes; d++) {
      const futuro = enCurso && d > diasTranscurridos;
      if (!futuro) {
        acum += porDia[d].guias;
        utilAcum += porDia[d].util;
        if (diaEquilibrio === null && acum >= beTotal) diaEquilibrio = d;
      }
      dias.push({
        dia: d,
        guias: futuro ? 0 : porDia[d].guias,
        acum: futuro ? NaN : acum,
        utilAcum: futuro ? NaN : utilAcum,
        necesario: Math.round((beTotal * d) / diasMes),
        proyeccion: enCurso && d >= diasTranscurridos ? Math.round(movilizadas + ritmo * (d - diasTranscurridos)) : undefined,
      });
    }

    const ing = api.ingresadas.find((x) => x.mes === KEY_TO_MES[m])?.ingresadas ?? null;
    out.push({
      m, ingresadas: ing && ing > 0 ? ing : null, movilizadas, entregadas, fixy, urbano, otras, mixPct, ticket,
      margenFixy, margenUrbano, margenMes,
      uF: lineas.find((l) => l.nombre === "Fixy")?.porGuia ?? b.uF,
      uU: lineas.find((l) => l.nombre === "Urbano")?.porGuia ?? b.uU,
      uM, utilidad, lineas,
      opexTotal, opexFijos, opexFuente, opexEstimado,
      beTotal,
      beFijos: opexFijos !== null ? Math.ceil(opexFijos / uM) : null,
      resultado: utilidad - opexTotal,
      enCurso, diasMes, diasTranscurridos, proyeccion, diaEquilibrio, dias,
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════════════════
export default function PuntoEquilibrioAR({ mesKeys, periodoLabel, rendiciones }: { mesKeys: MesKey[]; periodoLabel: string; rendiciones: Partial<Record<MesKey, RendicionCaja>> }) {
  const [api, setApi] = useState<PeApi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/finanzas/ar/punto-equilibrio", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`); return r.json(); })
      .then((j) => { if (alive) setApi(j); })
      .catch((e) => { if (alive) setErr(e?.message || "Error al cargar"); });
    return () => { alive = false; };
  }, []);

  if (err) return <div className="glass-card p-5 text-sm text-red-400">No se pudo cargar el punto de equilibrio: {err}</div>;
  if (!api) return <div className="text-xs t-muted text-center py-4">Calculando punto de equilibrio con los datos del Dashboard operativo…</div>;
  return <PuntoEquilibrioVista api={api} mesKeys={mesKeys} periodoLabel={periodoLabel} rendiciones={rendiciones} />;
}

export function PuntoEquilibrioVista({ api, mesKeys, periodoLabel, rendiciones }: { api: PeApi; mesKeys: MesKey[]; periodoLabel: string; rendiciones: Partial<Record<MesKey, RendicionCaja>> }) {
  const meses = useMemo(() => buildPuntoEquilibrio(api, rendiciones), [api, rendiciones]);
  // Mes foco: el último del período elegido arriba que tenga operación
  const foco = [...meses].reverse().find((x) => mesKeys.includes(x.m)) ?? null;

  return (
    <div className="space-y-6">
      {!foco && (
        <div className="glass-card p-8 text-center">
          <p className="text-sm t-secondary">No hay operación cargada para {periodoLabel}.</p>
          <p className="text-[11px] t-muted mt-1">El punto de equilibrio se calcula desde junio 2026 con las guías movilizadas del Dashboard operativo y el gasto de la rendición de caja.</p>
        </div>
      )}

      {foco && (
        <>
          <Encabezado f={foco} />
          <Termometro f={foco} />
          <CuadroReal f={foco} />
          <DetalleUtilidad f={foco} />
          <SeguimientoDiario f={foco} />
          <Analisis f={foco} />
          <Ganancias f={foco} />
        </>
      )}

      {meses.length > 0 && <Evolucion meses={meses} foco={foco?.m ?? null} />}

      <div className="glass-card p-4 text-[11px] t-muted leading-relaxed">
        <b className="t-secondary">Cómo se calcula.</b> Guías = <b>movilizadas</b> del Dashboard operativo (misma regla: con fecha de procesamiento y sin cancelar/rechazar, último archivo cargado del mes).
        Utilidad por guía = <b>rentabilidad por guía</b> de la transportadora (Informe Utilidad Gerencial), que ya incluye la comisión COD.
        Gasto = <b>rendición de caja</b> del mes. Punto de equilibrio = gasto ÷ utilidad por guía.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HistTable titulo="Margen logístico real por guía — Fixy" color={C.orange} rows={histRows("fixy")} />
        <HistTable titulo="Margen logístico real por guía — Urbano" color={C.green} rows={histRows("urbano")} />
      </div>

      {foco && <Simulador key={foco.m} f={foco} />}
    </div>
  );
}

// ─── Encabezado con fuentes ───
function Encabezado({ f }: { f: PeMes }) {
  const margenPropio = f.margenMes === f.m;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-base font-semibold t-primary mr-2">⚖️ Punto de equilibrio — {MES_LABEL[f.m]} 2026</h3>
      {f.enCurso && <Badge tone="amber">Mes en curso · día {f.diasTranscurridos} de {f.diasMes}</Badge>}
      <Badge tone={f.opexEstimado ? "amber" : "blue"}>Gasto: {f.opexFuente}</Badge>
      <Badge tone="blue">Guías: Dashboard operativo</Badge>
      <Badge tone={margenPropio ? "blue" : "amber"}>Margen logístico: {margenPropio ? `informe ${MES_CORTO[f.m]}` : `último informe (${MES_CORTO[f.margenMes]})`}</Badge>
    </div>
  );
}

// ─── Termómetro: a cuánto estamos del equilibrio ───
function Termometro({ f }: { f: PeMes }) {
  const pct = f.beTotal > 0 ? f.movilizadas / f.beTotal : 0;
  const supera = f.movilizadas >= f.beTotal;
  const falta = f.beTotal - f.movilizadas;
  const escala = Math.max(f.beTotal, f.movilizadas, f.proyeccion ?? 0) * 1.12;
  const pos = (v: number) => `${Math.min((v / escala) * 100, 100)}%`;
  const color = supera ? C.green : pct >= 0.9 ? C.amber : C.red;
  const faltaDia = f.enCurso ? Math.ceil(Math.max(falta, 0) / Math.max(f.diasMes - f.diasTranscurridos, 1)) : Math.ceil(Math.max(falta, 0) / f.diasMes);
  const resultadoProy = f.proyeccion !== null ? f.proyeccion * f.uM - f.opexTotal : null;

  return (
    <div className="glass-card p-5" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] t-muted uppercase tracking-wider">Situación actual</div>
          <div className="text-2xl font-bold" style={{ color }}>
            {supera ? `✅ Superamos el equilibrio en ${fmtNum(-falta)} guías` : `Estamos al ${fmtPct(pct)} del punto de equilibrio`}
          </div>
          <div className="text-sm t-secondary mt-1">
            {supera
              ? <>Ganancia del mes: <b style={{ color: C.green }}>{fmtArsExact(f.resultado)}</b> · cada guía extra suma ${fmtNum(Math.round(f.uM))}</>
              : <>Faltan <b style={{ color: C.red }}>{fmtNum(falta)} guías</b> ({fmtPct(falta / f.movilizadas)} más de volumen){f.enCurso ? <> · {fmtNum(faltaDia)} guías/día en {diasRestantesTxt(f.diasMes - f.diasTranscurridos)}</> : <> · ≈ {fmtNum(faltaDia)} guías/día más</>} · Resultado: <b style={{ color: C.red }}>{fmtArsExact(f.resultado)}</b></>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] t-muted uppercase tracking-wider">Movilizadas / necesarias</div>
          <div className="font-mono text-xl font-bold t-primary">{fmtNum(f.movilizadas)} / {fmtNum(f.beTotal)}</div>
        </div>
      </div>

      {/* Barra de avance con marcas de equilibrio */}
      <div className="relative mt-5 mb-7">
        <div className="h-5 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.18)" }}>
          <div className="h-full rounded-full" style={{ width: pos(f.movilizadas), background: color }} />
          {f.proyeccion !== null && f.proyeccion > f.movilizadas && (
            <div className="absolute top-0 h-5" style={{ left: pos(f.movilizadas), width: `calc(${pos(f.proyeccion)} - ${pos(f.movilizadas)})`, background: `repeating-linear-gradient(45deg, ${color}55 0 6px, transparent 6px 12px)` }} />
          )}
        </div>
        {f.beFijos !== null && (
          <Marca left={pos(f.beFijos)} color={C.blue} label={`Cubre fijos · ${fmtNum(f.beFijos)}`} />
        )}
        <Marca left={pos(f.beTotal)} color={C.orange} label={`Equilibrio · ${fmtNum(f.beTotal)}`} />
      </div>

      {f.enCurso && f.proyeccion !== null && resultadoProy !== null && (
        <p className="text-[12px] t-secondary">
          📈 Al ritmo actual ({fmtNum(Math.round(f.movilizadas / f.diasTranscurridos))} guías/día) el mes cerraría en <b>{fmtNum(f.proyeccion)} guías</b> →
          resultado proyectado <b style={{ color: resultadoProy >= 0 ? C.green : C.red }}>{fmtArsExact(resultadoProy)}</b>.
          <span className="t-muted"> Las órdenes de los últimos días todavía se están movilizando, así que el real suele quedar algo arriba.</span>
        </p>
      )}
      {!f.enCurso && f.diaEquilibrio !== null && (
        <p className="text-[12px] t-secondary">✅ El mes alcanzó el equilibrio el día <b>{f.diaEquilibrio}</b>; desde ahí cada guía fue ganancia.</p>
      )}
    </div>
  );
}

const diasRestantesTxt = (n: number) => (n === 1 ? "el día que queda" : `los ${n} días que quedan`);

function Marca({ left, color, label }: { left: string; color: string; label: string }) {
  return (
    <div className="absolute top-[-4px]" style={{ left }}>
      <div style={{ width: 2, height: 28, background: color, marginLeft: -1 }} />
      <div className="text-[10px] font-semibold whitespace-nowrap mt-0.5" style={{ color, transform: "translateX(-50%)" }}>{label}</div>
    </div>
  );
}

// ─── Cuadro real vs equilibrio ───
function CuadroReal({ f }: { f: PeMes }) {
  const gastoVar = f.opexFijos !== null ? f.opexTotal - f.opexFijos : null;
  const tasaMov = f.ingresadas ? f.movilizadas / f.ingresadas : null;
  const ingNecesarias = tasaMov ? Math.ceil(f.beTotal / tasaMov) : null;
  const diaReal = f.movilizadas / f.diasTranscurridos;
  const diaNec = f.beTotal / f.diasMes;
  const fila = (concepto: string, real: string, eq: string, dif: string, difTone?: Tone, opts?: { sub?: boolean; bold?: boolean }) => ({ concepto, real, eq, dif, difTone, ...opts });
  const tone = (v: number): Tone => (v >= 0 ? "green" : "red");
  const signo = (v: number, f2: (n: number) => string) => `${v >= 0 ? "+" : "−"}${f2(Math.abs(v))}`;
  const filas = [
    ...(f.ingresadas !== null && ingNecesarias !== null
      ? [fila("Órdenes ingresadas (Seguimiento diario)", fmtNum(f.ingresadas), fmtNum(ingNecesarias), signo(f.ingresadas - ingNecesarias, fmtNum), tone(f.ingresadas - ingNecesarias))]
      : []),
    fila("Guías movilizadas", fmtNum(f.movilizadas), fmtNum(f.beTotal), signo(f.movilizadas - f.beTotal, fmtNum), tone(f.movilizadas - f.beTotal), { bold: true }),
    fila(`Fixy (${f.mixPct.toFixed(0)}%)`, fmtNum(f.fixy), "", "", undefined, { sub: true }),
    fila(`Urbano (${(100 - f.mixPct).toFixed(0)}%)`, fmtNum(f.urbano), "", "", undefined, { sub: true }),
    ...(f.otras > 0 ? [fila("Otras transportadoras", fmtNum(f.otras), "", "", undefined, { sub: true })] : []),
    fila(f.enCurso ? "Guías por día (hasta hoy)" : "Guías por día", fmtNum(Math.round(diaReal)), fmtNum(Math.ceil(diaNec)), signo(Math.round(diaReal - diaNec), fmtNum), tone(diaReal - diaNec)),
    fila("Utilidad por guía", `$${fmtNum(Math.round(f.uM))}`, `$${fmtNum(Math.round(f.uM))}`, ""),
    fila("Utilidad generada", fmtArsExact(f.utilidad), fmtArsExact(f.opexTotal), signo(f.utilidad - f.opexTotal, fmtArsExact), tone(f.utilidad - f.opexTotal), { bold: true }),
    ...f.lineas.map((l) => fila(`${l.nombre} — ${fmtNum(l.guias)} guías × $${fmtNum(l.margenGuia)}`, fmtArsExact(l.margenTotal), "", "", undefined, { sub: true })),
    fila("Gasto del mes", fmtArsExact(f.opexTotal), fmtArsExact(f.opexTotal), ""),
    ...(f.opexFijos !== null && gastoVar !== null
      ? [fila("Gastos fijos", fmtArsExact(f.opexFijos), "", "", undefined, { sub: true }), fila("Gastos variables", fmtArsExact(gastoVar), "", "", undefined, { sub: true })]
      : []),
    fila("Resultado del mes", fmtArsExact(f.resultado), "$0", signo(f.resultado, fmtArsExact), tone(f.resultado), { bold: true }),
  ];
  const colorTone: Record<Tone, string> = { green: C.green, red: C.red, orange: C.orange, blue: C.blue, amber: C.amber };

  return (
    <div className="glass-card overflow-x-auto">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold t-primary">📋 Real vs. punto de equilibrio — {MES_LABEL[f.m]}{f.enCurso ? " (hasta hoy)" : ""}</h3>
        <p className="text-[11px] t-muted">Qué hicimos en el mes contra lo que hacía falta para que la utilidad cubra el gasto.</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <Th align="left">Concepto</Th>
            <Th>Real</Th>
            <Th>Equilibrio</Th>
            <Th>Diferencia</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((r) => (
            <tr key={r.concepto} className="border-b border-gray-800/50">
              <td className={`py-2 px-4 text-xs ${r.sub ? "pl-8 t-muted" : "t-primary"} ${r.bold ? "font-semibold" : ""}`}>{r.concepto}</td>
              <Td mono bold={r.bold}>{r.real}</Td>
              <Td mono muted>{r.eq || "—"}</Td>
              <Td mono bold color={r.difTone ? colorTone[r.difTone] : undefined}>{r.dif || ""}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasaMov !== null && (
        <p className="text-[11px] t-muted px-5 py-3">
          Ingresadas necesarias = guías de equilibrio ÷ tasa de movilización real del mes ({fmtPct(tasaMov)}).
        </p>
      )}
    </div>
  );
}

// ─── Detalle de la utilidad: por transportadora (rentabilidad por guía, COD incluido) ───
function DetalleUtilidad({ f }: { f: PeMes }) {
  const p = { lineas: f.lineas, utilidad: f.utilidad, uM: f.uM, resultado: f.resultado, be: f.beTotal, gap: f.movilizadas - f.beTotal };
  const pctU = (v: number) => fmtPct(p.utilidad > 0 ? v / p.utilidad : 0);
  const color: Record<string, string> = { Fixy: C.orange, Urbano: C.green, Otras: C.gray };
  const $ = (v: number) => `${v < 0 ? "−" : ""}$${fmtNum(Math.abs(Math.round(v)))}`;

  return (
    <div className="glass-card overflow-x-auto">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold t-primary">
          💵 De dónde sale la utilidad — {MES_LABEL[f.m]}{f.enCurso ? " (hasta hoy)" : ""}
        </h3>
        <p className="text-[11px] t-muted">
          Por cada transportadora: <b>rentabilidad por guía</b> (Informe Utilidad {MES_CORTO[f.margenMes]}, ya con la comisión COD adentro) × guías movilizadas.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <Th align="left">Concepto</Th>
            <Th>Guías</Th>
            <Th align="left">Cálculo</Th>
            <Th>$ por guía</Th>
            <Th>Total</Th>
            <Th>% utilidad</Th>
          </tr>
        </thead>
        <tbody>
          {p.lineas.map((l) => (
            <FragmentLinea key={l.nombre}>
              <tr className="border-b border-gray-800/50" style={{ background: `${color[l.nombre]}10` }}>
                <td className="py-2 px-4 text-xs font-bold" style={{ color: color[l.nombre] }}>🚚 {l.nombre}</td>
                <Td mono bold>{fmtNum(l.guias)}</Td>
                <Td align="left" muted>{fmtNum(l.guias)} guías × {$(l.margenGuia)} · {fmtPct(l.guias / f.movilizadas)} de las movilizadas</Td>
                <Td mono bold>{$(l.porGuia)}</Td>
                <Td mono bold color={color[l.nombre]}>{fmtArsExact(l.total)}</Td>
                <Td mono bold>{pctU(l.total)}</Td>
              </tr>
            </FragmentLinea>
          ))}
          <tr className="border-b border-gray-800/50" style={{ background: "rgba(16,185,129,0.08)" }}>
            <td className="py-2 px-4 text-xs font-bold t-primary">= Utilidad total</td>
            <Td mono bold>{fmtNum(f.movilizadas)}</Td>
            <Td align="left" muted>Fixy + Urbano (COD incluido)</Td>
            <Td mono bold>{$(p.uM)}</Td>
            <Td mono bold color={C.green}>{fmtArsExact(p.utilidad)}</Td>
            <Td mono bold>100%</Td>
          </tr>
          <tr className="border-b border-gray-800/50">
            <td className="py-2 px-4 text-xs t-primary">(−) Gasto del mes</td>
            <Td mono muted>—</Td>
            <Td align="left" muted>{f.opexFuente}</Td>
            <Td mono muted>{$(f.opexTotal / f.movilizadas)}</Td>
            <Td mono color={C.red}>−{fmtArsExact(f.opexTotal)}</Td>
            <Td mono muted>{pctU(f.opexTotal)}</Td>
          </tr>
          <tr style={{ background: p.resultado >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
            <td className="py-3 px-4 text-sm font-bold t-primary">= {p.resultado >= 0 ? "Ganancia" : "Pérdida"} del mes</td>
            <Td mono muted>—</Td>
            <Td align="left" muted>utilidad − gasto</Td>
            <Td mono bold>{$(p.resultado / f.movilizadas)}</Td>
            <Td mono bold color={p.resultado >= 0 ? C.green : C.red}>{fmtArsExact(p.resultado)}</Td>
            <Td mono muted>—</Td>
          </tr>
          <tr className="border-t border-gray-700">
            <td className="py-2 px-4 text-xs t-primary">Punto de equilibrio</td>
            <Td mono bold>{fmtNum(p.be)}</Td>
            <Td align="left" muted>gasto ÷ {$(p.uM)} por guía</Td>
            <Td mono muted>—</Td>
            <Td mono bold color={p.gap >= 0 ? C.green : C.red}>{p.gap >= 0 ? `+${fmtNum(p.gap)} guías por encima` : `faltan ${fmtNum(-p.gap)} guías`}</Td>
            <Td mono muted>{fmtPct(p.be > 0 ? f.movilizadas / p.be : 0)}</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FragmentLinea({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ─── Gráfico de seguimiento diario (acumulado) ───
function SeguimientoDiario({ f }: { f: PeMes }) {
  const data = f.dias;
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold t-primary">📊 Seguimiento del mes — guías acumuladas vs. punto de equilibrio</h3>
      <p className="text-[11px] t-muted mb-3">
        Cuando la línea verde cruza la naranja, la utilidad del mes cubrió el gasto. La línea punteada es el ritmo parejo necesario para llegar al equilibrio el último día.
      </p>
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="dia" stroke="#888" fontSize={11} />
            <YAxis yAxisId="acum" stroke="#888" fontSize={11} tickFormatter={(v) => fmtNum(v)} />
            <YAxis yAxisId="dia" orientation="right" stroke="#888" fontSize={10} tickFormatter={(v) => fmtNum(v)} />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }}
              labelFormatter={(d) => `Día ${d}`}
              formatter={(v, name) => [typeof v === "number" && isFinite(v) ? fmtNum(Math.round(v)) : "—", name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="dia" dataKey="guias" name="Guías del día" fill={C.blue} fillOpacity={0.35} />
            <Area yAxisId="acum" type="monotone" dataKey="acum" name="Guías acumuladas (real)" stroke={C.green} fill={C.green} fillOpacity={0.12} strokeWidth={2.5} connectNulls={false} />
            <Line yAxisId="acum" type="linear" dataKey="necesario" name="Ritmo necesario" stroke={C.gray} strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
            {f.enCurso && <Line yAxisId="acum" type="linear" dataKey="proyeccion" name="Proyección al ritmo actual" stroke={C.green} strokeDasharray="3 4" dot={false} strokeWidth={2} />}
            <ReferenceLine yAxisId="acum" y={f.beTotal} stroke={C.orange} strokeWidth={2} label={{ value: `Equilibrio ${fmtNum(f.beTotal)}`, fill: C.orange, fontSize: 11, position: "insideTopLeft" }} />
            {f.beFijos !== null && (
              <ReferenceLine yAxisId="acum" y={f.beFijos} stroke={C.blue} strokeDasharray="4 4" label={{ value: `Cubre fijos ${fmtNum(f.beFijos)}`, fill: C.blue, fontSize: 10, position: "insideBottomLeft" }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] t-muted mt-2">Guías agrupadas por fecha de la orden. Las órdenes del mes anterior que vienen en el archivo del mes se cuentan en el día 1.</p>
    </div>
  );
}

// ─── Análisis automático ───
function Analisis({ f }: { f: PeMes }) {
  const items: { icon: string; tone: Tone; titulo: string; texto: string }[] = [];
  const falta = f.beTotal - f.movilizadas;
  const supera = falta <= 0;

  if (supera) {
    items.push({ icon: "✅", tone: "green", titulo: `El mes cubre sus gastos con ${fmtNum(-falta)} guías de margen`, texto: `La utilidad (${fmtArs(f.utilidad)}) supera el gasto (${fmtArs(f.opexTotal)}). Ganancia del mes: ${fmtArs(f.resultado)}.` });
  } else {
    items.push({
      icon: "🎯", tone: "red",
      titulo: `Faltan ${fmtNum(falta)} guías (${fmtPct(falta / f.movilizadas)} más de volumen) para el equilibrio`,
      texto: `Hoy la utilidad cubre el ${fmtPct(f.utilidad / f.opexTotal)} del gasto. El déficit de ${fmtArs(-f.resultado)} equivale a ${fmtNum(falta)} guías a $${fmtNum(Math.round(f.uM))} cada una.`,
    });
  }

  if (f.enCurso && !supera) {
    const restantes = f.diasMes - f.diasTranscurridos;
    const ritmo = f.movilizadas / f.diasTranscurridos;
    const necesario = restantes > 0 ? falta / restantes : falta;
    items.push({
      icon: "⏱", tone: "amber",
      titulo: restantes > 0 ? `Para llegar este mes: ${fmtNum(Math.ceil(necesario))} guías/día en ${diasRestantesTxt(restantes)}` : "El mes termina hoy",
      texto: `El ritmo actual es ${fmtNum(Math.round(ritmo))} guías/día. ${restantes > 0 && necesario > ritmo * 1.5 ? "Con el ritmo actual no se llega este mes: el foco es el mes que viene." : ""}`.trim(),
    });
  }

  if (f.beFijos !== null && f.opexFijos !== null) {
    const faltaFijos = f.beFijos - f.movilizadas;
    items.push({
      icon: "🧾", tone: faltaFijos > 0 ? "red" : "green",
      titulo: faltaFijos > 0 ? `Ni los gastos fijos se cubren todavía: faltan ${fmtNum(faltaFijos)} guías` : `Los gastos fijos están cubiertos (sobran ${fmtNum(-faltaFijos)} guías)`,
      texto: `Gastos fijos ${fmtArs(f.opexFijos)} → equilibrio de ${fmtNum(f.beFijos)} guías. Los variables/extraordinarios del mes (${fmtArs(f.opexTotal - f.opexFijos)}) suman ${fmtNum(f.beTotal - f.beFijos)} guías al equilibrio.`,
    });
  }

  // Palanca mix: pasar 10 pp de Fixy a Urbano
  if (f.fixy > 0 && f.urbano > 0 && f.uU > f.uF) {
    const mix2 = Math.max(f.mixPct - 10, 0) / 100;
    const uM2 = mix2 * f.uF + (1 - mix2) * f.uU;
    const be2 = Math.ceil(f.opexTotal / uM2);
    items.push({
      icon: "🚚", tone: "blue",
      titulo: `Urbano deja $${fmtNum(Math.round(f.uU - f.uF))} más por guía que Fixy`,
      texto: `Urbano $${fmtNum(Math.round(f.uU))}/guía vs Fixy $${fmtNum(Math.round(f.uF))}/guía. Si 10 pp del volumen pasaran de Fixy a Urbano (mix ${Math.round(mix2 * 100)}/${Math.round(100 - mix2 * 100)}), el equilibrio bajaría de ${fmtNum(f.beTotal)} a ${fmtNum(be2)} guías (−${fmtNum(f.beTotal - be2)}).`,
    });
  }

  // Palanca gasto
  const guiasPorMillon = 1_000_000 / f.uM;
  items.push({
    icon: "✂️", tone: "blue",
    titulo: `Cada $1M menos de gasto baja el equilibrio ${fmtNum(Math.round(guiasPorMillon))} guías`,
    texto: `Con la utilidad actual de $${fmtNum(Math.round(f.uM))} por guía.${f.opexEstimado ? " El gasto de este mes es estimado: subí la rendición de caja para tener el número exacto." : ""}`,
  });

  if (f.margenMes !== f.m) {
    items.push({
      icon: "ℹ️", tone: "amber",
      titulo: `Margen logístico estimado con el informe de ${MES_LABEL[f.margenMes].toLowerCase()}`,
      texto: `No hay Informe Utilidad Gerencial de ${MES_LABEL[f.m].toLowerCase()} todavía. Cada $100/guía de diferencia en el margen mueve el equilibrio ≈ ${fmtNum(Math.round(f.beTotal - f.opexTotal / (f.uM + 100)))} guías.`,
    });
  }

  const colorTone: Record<Tone, string> = { green: C.green, red: C.red, orange: C.orange, blue: C.blue, amber: C.amber };
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold t-primary mb-3">🔍 Análisis — {MES_LABEL[f.m]}</h3>
      <div className="space-y-2">
        {items.map((a, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: `${colorTone[a.tone]}12`, borderLeft: `3px solid ${colorTone[a.tone]}` }}>
            <div className="text-lg">{a.icon}</div>
            <div>
              <div className="text-sm font-semibold t-primary">{a.titulo}</div>
              {a.texto && <div className="text-[12px] t-secondary mt-0.5 leading-relaxed">{a.texto}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ganancias al superar el equilibrio ───
function Ganancias({ f }: { f: PeMes }) {
  const filas: { label: string; guias: number; destacado?: boolean }[] = [
    { label: `Real ${MES_CORTO[f.m]}${f.enCurso ? " (hasta hoy)" : ""}`, guias: f.movilizadas, destacado: true },
    ...(f.proyeccion !== null ? [{ label: "Proyección al cierre", guias: f.proyeccion }] : []),
    { label: "Punto de equilibrio", guias: f.beTotal },
    { label: "Equilibrio + 10%", guias: Math.round(f.beTotal * 1.1) },
    { label: "Equilibrio + 20%", guias: Math.round(f.beTotal * 1.2) },
    { label: "Equilibrio + 30%", guias: Math.round(f.beTotal * 1.3) },
    { label: "Para ganar $5M", guias: Math.ceil((f.opexTotal + 5_000_000) / f.uM) },
    { label: "Para ganar $10M", guias: Math.ceil((f.opexTotal + 10_000_000) / f.uM) },
  ].sort((a, b) => a.guias - b.guias);

  return (
    <div className="glass-card overflow-x-auto">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold t-primary">💰 Ganancia al superar el punto de equilibrio</h3>
        <p className="text-[11px] t-muted">
          Pasado el equilibrio, cada guía movilizada deja <b className="t-primary">${fmtNum(Math.round(f.uM))}</b> de ganancia (con el gasto de {fmtArs(f.opexTotal)} y el mix actual).
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <Th align="left">Escenario</Th>
            <Th>Guías/mes</Th>
            <Th>Guías/día</Th>
            <Th>vs real</Th>
            <Th>Utilidad</Th>
            <Th>Resultado</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((r) => {
            const res = r.guias * f.uM - f.opexTotal;
            const vs = r.guias - f.movilizadas;
            return (
              <tr key={r.label} className="border-b border-gray-800/50" style={r.destacado ? { background: "rgba(232,105,42,0.08)" } : undefined}>
                <Td align="left" bold={r.destacado}>{r.label}</Td>
                <Td mono bold>{fmtNum(r.guias)}</Td>
                <Td mono muted>{fmtNum(Math.ceil(r.guias / f.diasMes))}</Td>
                <Td mono muted>{r.destacado ? "—" : `${vs >= 0 ? "+" : "−"}${fmtNum(Math.abs(vs))}`}</Td>
                <Td mono color={C.green}>{fmtArs(r.guias * f.uM)}</Td>
                <Td mono bold color={Math.abs(res) < 1 ? C.gray : res > 0 ? C.green : C.red}>{Math.abs(res) < f.uM ? "$0" : fmtArs(res)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Evolución mensual ───
function Evolucion({ meses, foco }: { meses: PeMes[]; foco: MesKey | null }) {
  const chart = meses.map((r) => ({ mes: MES_CORTO[r.m], movilizadas: r.movilizadas, equilibrio: r.beTotal, ok: r.movilizadas >= r.beTotal }));
  return (
    <div className="glass-card overflow-x-auto">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold t-primary">📈 Evolución mensual — movilizadas vs. punto de equilibrio</h3>
        <p className="text-[11px] t-muted">Cobertura = guías movilizadas ÷ guías necesarias. ≥ 100% = el mes cubrió sus gastos.</p>
      </div>
      <div className="px-3" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="mes" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => fmtNum(v)} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} formatter={(v, n) => [fmtNum(typeof v === "number" ? v : 0), n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="movilizadas" name="Movilizadas (real)" radius={[4, 4, 0, 0]}>
              {chart.map((c, i) => <Cell key={i} fill={c.ok ? C.green : C.red} fillOpacity={0.8} />)}
            </Bar>
            <Line type="monotone" dataKey="equilibrio" name="Punto de equilibrio" stroke={C.orange} strokeWidth={2.5} dot={{ r: 4, fill: C.orange }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <table className="w-full text-sm mt-2">
        <thead>
          <tr className="border-b border-gray-700">
            <Th align="left">Mes</Th>
            <Th>Movilizadas</Th>
            <Th>Mix Fixy</Th>
            <Th>Utilidad/guía</Th>
            <Th>Gasto del mes</Th>
            <Th>Utilidad</Th>
            <Th>Resultado</Th>
            <Th>Equilibrio</Th>
            <Th>Cobertura</Th>
          </tr>
        </thead>
        <tbody>
          {meses.map((r) => {
            const cob = r.beTotal > 0 ? r.movilizadas / r.beTotal : 0;
            return (
              <tr key={r.m} className="border-b border-gray-800/50" style={foco === r.m ? { background: "rgba(232,105,42,0.08)" } : undefined}>
                <Td align="left" bold>
                  {MES_LABEL[r.m]}
                  {r.enCurso && <span className="ml-2 text-[10px] text-amber-400">en curso</span>}
                </Td>
                <Td mono>{fmtNum(r.movilizadas)}</Td>
                <Td mono muted>{r.mixPct.toFixed(0)}%</Td>
                <Td mono>${fmtNum(Math.round(r.uM))}</Td>
                <Td mono color={C.red}>{fmtArs(r.opexTotal)}{r.opexEstimado && <span className="text-amber-400"> *</span>}</Td>
                <Td mono color={C.green}>{fmtArs(r.utilidad)}</Td>
                <Td mono bold color={r.resultado >= 0 ? C.green : C.red}>{fmtArs(r.resultado)}</Td>
                <Td mono>{fmtNum(r.beTotal)}</Td>
                <Td mono bold color={cob >= 1 ? C.green : C.red}>{fmtPct(cob)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] t-muted px-5 py-3">
        * Mes sin rendición de caja cargada: se usa el gasto del último mes conocido. Los meses sin Informe Utilidad usan el margen logístico del último informe cargado (por ejemplo, julio usa junio).
      </p>
    </div>
  );
}

// ─── Simulador (qué pasa si…) ───
function Simulador({ f }: { f: PeMes }) {
  const [opex, setOpex] = useState(Math.round(f.opexTotal / 100_000) * 100_000);
  const [margenFixy, setMargenFixy] = useState(f.margenFixy);
  const [margenUrbano, setMargenUrbano] = useState(f.margenUrbano);
  const [mixPct, setMixPct] = useState(Math.round(f.mixPct));

  const sim = useMemo(() => beCalc(opex, margenFixy, margenUrbano, mixPct), [opex, margenFixy, margenUrbano, mixPct]);
  const simBars = [
    { name: "Fixy solo", guias: sim.beFixy, fill: C.orange },
    { name: "Urbano solo", guias: sim.beUrb, fill: C.green },
    { name: `Mix ${mixPct}/${100 - mixPct}`, guias: sim.beMix, fill: C.blue },
  ];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold t-primary">🧮 Simulador — ¿qué pasa si…?</h3>
      <p className="text-[11px] t-muted mt-1 mb-4">Arranca con los valores reales de {MES_LABEL[f.m].toLowerCase()} (gasto {fmtArs(f.opexTotal)}, mix {f.mixPct.toFixed(0)}% Fixy, ticket ${fmtNum(Math.round(f.ticket))}). Movés las variables y el punto de equilibrio se recalcula en vivo.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
        <SimSlider label="Gasto del mes" value={opex} min={10_000_000} max={80_000_000} step={500_000} onChange={setOpex} fmt={(v) => fmtArs(v)} />
        <SimSlider label="Rentabilidad por guía Fixy" value={margenFixy} min={500} max={5000} step={10} onChange={setMargenFixy} fmt={(v) => `$${fmtNum(v)}`} />
        <SimSlider label="Rentabilidad por guía Urbano" value={margenUrbano} min={500} max={6000} step={10} onChange={setMargenUrbano} fmt={(v) => `$${fmtNum(v)}`} />
        <SimSlider label="Mix (% Fixy)" value={mixPct} min={0} max={100} step={1} onChange={setMixPct} fmt={(v) => `${v}% Fixy`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <KpiCard label="Equilibrio — solo Fixy" value={`${fmtNum(sim.beFixy)} guías/mes`} sub={`$${fmtNum(Math.round(sim.uF))}/guía (COD incluido)`} tone="orange" />
        <KpiCard label="Equilibrio — solo Urbano" value={`${fmtNum(sim.beUrb)} guías/mes`} sub={`$${fmtNum(Math.round(sim.uU))}/guía (COD incluido)`} tone="green" />
        <KpiCard label={`Equilibrio — mix ${mixPct}/${100 - mixPct}`} value={`${fmtNum(sim.beMix)} guías/mes`} sub={`$${fmtNum(Math.round(sim.uM))}/guía promedio`} tone="blue" />
      </div>
      <div className="mt-5" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={simBars} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip formatter={(v) => `${fmtNum(typeof v === "number" ? v : 0)} guías/mes`} contentStyle={{ background: "#1a1a1a", border: `1px solid ${C.orange}`, fontSize: 12 }} />
            <ReferenceLine y={f.movilizadas} stroke={C.gray} strokeDasharray="4 4" label={{ value: `${MES_CORTO[f.m]} real: ${fmtNum(f.movilizadas)}`, fill: "#94a3b8", fontSize: 10, position: "insideTopRight" }} />
            <Bar dataKey="guias" radius={[4, 4, 0, 0]}>
              {simBars.map((b, i) => <Cell key={i} fill={b.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SimSlider({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div>
      <label className="text-[11px] t-muted uppercase tracking-wider">{label}</label>
      <div className="font-mono text-base font-semibold mb-1.5" style={{ color: C.orange }}>{fmt(value)}</div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full" style={{ accentColor: C.orange, height: 4 }}
      />
    </div>
  );
}

function histRows(t: "fixy" | "urbano") {
  return ALL_KEYS.filter((k) => MARGEN_HIST[k]).map((k) => {
    const h = MARGEN_HIST[k]!;
    return { mes: MES_CORTO[k], guias: t === "fixy" ? h.guiasFixy : h.guiasUrbano, util: t === "fixy" ? h.fixy : h.urbano };
  });
}

function HistTable({ titulo, color, rows }: { titulo: string; color: string; rows: { mes: string; guias: number | null; util: number }[] }) {
  return (
    <div className="glass-card p-4 overflow-x-auto">
      <h4 className="text-xs font-semibold mb-3" style={{ color }}>{titulo}</h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="t-muted text-[10px] uppercase tracking-wider border-b border-gray-700">
            <th className="text-left py-2">Mes 2026</th>
            <th className="text-right py-2">Guías</th>
            <th className="text-right py-2">Margen/guía</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-800/40">
              <td className="py-2 t-secondary">{r.mes}</td>
              <td className="py-2 text-right font-mono t-secondary">{fmtNum(r.guias)}</td>
              <td className="py-2 text-right font-mono font-semibold" style={{ color }}>${fmtNum(r.util)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
