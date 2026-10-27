"use client";

// ═══════════════════════════════════════════════════════════════════
// RESUMEN TRIMESTRAL 2026 (Q3 / Q4) — centraliza el trimestre y prepara el siguiente.
// Trimestre cerrado: resumen completo vs el trimestre anterior.
// Trimestre en curso: avance vs meta, comparación proporcional a los días transcurridos y proyección.
// Fuentes:
//   - /api/data/quarter  → por mes y por día con la regla de Operaciones
//     (solo guías cuya fecha de orden es del mes; ingresadas = Seguimiento Diario)
//   - /api/data/operational → snapshots del Análisis Operacional (DS, proveedores,
//     productos, transportadoras) para activación y rankings
//   - /api/data/{country} → metas (meta_info)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useUser } from "../lib/useUser";
import { exportarSeccionesPdf } from "../lib/export-pdf";

type Mes = "abril" | "mayo" | "junio" | "julio" | "agosto" | "septiembre" | "octubre" | "noviembre" | "diciembre";
type Trim = "q3" | "q4";
// prev = trimestre con el que se compara · cur = trimestre del resumen · next = el que se prepara
const TRIMS: Record<Trim, { nombre: string; prevNombre: string; nextNombre: string; prev: Mes[]; cur: Mes[]; next: Mes[] }> = {
  q3: { nombre: "Q3", prevNombre: "Q2", nextNombre: "Q4", prev: ["abril", "mayo", "junio"], cur: ["julio", "agosto", "septiembre"], next: ["octubre", "noviembre", "diciembre"] },
  q4: { nombre: "Q4", prevNombre: "Q3", nextNombre: "Q1 2027", prev: ["julio", "agosto", "septiembre"], cur: ["octubre", "noviembre", "diciembre"], next: [] },
};
const MESES_ANIO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const PREV_MES: Record<Mes, Mes> = { abril: "abril", mayo: "abril", junio: "mayo", julio: "junio", agosto: "julio", septiembre: "agosto", octubre: "septiembre", noviembre: "octubre", diciembre: "noviembre" };
const LABEL: Record<Mes, string> = { abril: "Abril", mayo: "Mayo", junio: "Junio", julio: "Julio", agosto: "Agosto", septiembre: "Septiembre", octubre: "Octubre", noviembre: "Noviembre", diciembre: "Diciembre" };
const CORTO: Record<Mes, string> = { abril: "Abr", mayo: "May", junio: "Jun", julio: "Jul", agosto: "Ago", septiembre: "Sep", octubre: "Oct", noviembre: "Nov", diciembre: "Dic" };
const NUM: Record<Mes, number> = { abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const DIAS_MES = (m: Mes) => new Date(2026, NUM[m], 0).getDate();
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const NO_MOV = new Set(["PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA", "PREPARADO PARA TRANSPORTADORA", "CANCELADO", "RECHAZADO", "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA"]);
const C = { ing: "#3b82f6", mov: "#f97316", ent: "#10b981", dev: "#ef4444", proc: "#06b6d4", meta: "#a78bfa", gray: "#9ca3af", amber: "#f59e0b" };

interface TranspRow { transportadora: string; guias: number; movilizadas: number; entregadas: number; devueltas: number; en_proceso: number; canceladas: number }
interface Dia { dia: number; ingresadas: number; movilizadas: number; entregadas: number; devueltas: number; canceladas: number; en_proceso: number; guias: number }
interface Snap {
  by_dropshipper?: { nombre: string; total: number; estados: Record<string, number> }[];
  by_proveedor?: { nombre: string; total: number; estados: Record<string, number> }[];
  by_producto?: { nombre: string; ordenes: number; cantidad: number; proveedor: string }[];
}
interface Met { ing: number; mov: number; ent: number; dev: number; proc: number; canc: number; diasConDatos: number; diasMes: number; metaMov: number; metaIng: number }

const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");
const pct = (a: number, b: number, d = 1) => (b > 0 ? `${((a / b) * 100).toFixed(d).replace(".", ",")}%` : "—");
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const delta = (a: number, b: number) => (b > 0 ? (a / b - 1) * 100 : 0);
const deltaTxt = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${delta(a, b).toFixed(1).replace(".", ",")}%` : "—");
const ppTxt = (a: number, b: number) => `${a >= b ? "+" : ""}${(a - b).toFixed(1).replace(".", ",")} pp`;
const normName = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s*\(\d+\)\s*$/, "").replace(/[^a-z0-9]/g, "");
const cleanName = (s: string) => (s || "").replace(/\s*\(\d+\)\s*$/, "").trim();
const movOf = (e: Record<string, number>) => { let t = 0, n = 0; for (const k in e) { t += e[k] || 0; if (NO_MOV.has(k)) n += e[k] || 0; } return Math.max(t - n, 0); };
const tip = { contentStyle: { background: "#1a1a1a", border: "1px solid #f97316", fontSize: 12 }, itemStyle: { color: "#fff" }, labelStyle: { color: "#fff" } };

function sumMet(ms: Met[]): Met {
  return ms.reduce((a, m) => ({
    ing: a.ing + m.ing, mov: a.mov + m.mov, ent: a.ent + m.ent, dev: a.dev + m.dev, proc: a.proc + m.proc, canc: a.canc + m.canc,
    diasConDatos: a.diasConDatos + m.diasConDatos, diasMes: a.diasMes + m.diasMes, metaMov: a.metaMov + m.metaMov, metaIng: a.metaIng + m.metaIng,
  }), { ing: 0, mov: 0, ent: 0, dev: 0, proc: 0, canc: 0, diasConDatos: 0, diasMes: 0, metaMov: 0, metaIng: 0 });
}

// ─── UI ───
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5" data-pdf-section>
      <h3 className="text-sm font-bold t-primary">{title}</h3>
      {sub && <p className="text-[11px] t-muted mt-0.5 mb-3">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  );
}
function Kpi({ label, value, sub, color, good }: { label: string; value: string; sub?: string; color: string; good?: boolean | null }) {
  return (
    <div className="rounded-xl p-3 border" style={{ background: "var(--bg-card)", borderColor: `${color}40`, borderTop: `3px solid ${color}` }}>
      <p className="text-[10px] t-muted uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold font-mono mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: good === true ? "#10b981" : good === false ? "#ef4444" : "var(--text-muted, #9ca3af)" }}>{sub}</p>}
    </div>
  );
}
function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <th className={`py-2 px-2 text-[10px] uppercase tracking-wider t-muted whitespace-nowrap ${left ? "text-left" : "text-right"}`}>{children}</th>;
}
function Td({ children, left, bold, color }: { children: React.ReactNode; left?: boolean; bold?: boolean; color?: string }) {
  return <td className={`py-1.5 px-2 text-xs whitespace-nowrap ${left ? "text-left" : "text-right font-mono"} ${bold ? "font-bold" : ""}`} style={{ color }}>{children}</td>;
}

// ═══════════════════════════════════════════════════════════════════
export default function TrimestreResumen({ country, trimestre = "q3" }: { country: "ar" | "py"; trimestre?: Trim }) {
  const T = TRIMS[trimestre];
  const Q2 = T.prev, Q3 = T.cur, Q4 = T.next;          // anterior · actual · siguiente
  const QN = T.nombre, QP = T.prevNombre, QS = T.nextNombre;
  const mesHoy = MESES_ANIO[new Date().getMonth()] as Mes;
  const enCurso = new Date().getFullYear() === 2026 && Q3.includes(mesHoy);
  // Mes que se sigue en "avance": el mes en curso si el trimestre está abierto; si no, el 1° del siguiente
  const MES_AVANCE: Mes = enCurso ? mesHoy : (Q4[0] ?? Q3[2]);
  const M_INI = Q3[0];
  const M_FIN: Mes = enCurso ? mesHoy : Q3[2];          // último mes con datos para tendencias
  const idxFin = Q3.indexOf(M_FIN);
  const l = (m: Mes) => LABEL[m].toLowerCase();
  const ALL: Mes[] = [...Q2, ...Q3, ...(!enCurso && Q4[0] ? [Q4[0]] : [])];
  const SNAP_MESES: Mes[] = [PREV_MES[Q3[0]], ...Q3, ...(!enCurso && Q4[0] ? [Q4[0]] : [])];
  const MESES_PLAN: Mes[] = enCurso ? Q3 : Q4;
  const [dias, setDias] = useState<Partial<Record<Mes, Dia[]>>>({});
  const [transpData, setTranspData] = useState<Partial<Record<Mes, TranspRow[]>>>({});
  const [snaps, setSnaps] = useState<Partial<Record<Mes, Snap | null>>>({});
  const [meta, setMeta] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { canDownload } = useUser();
  const [exportando, setExportando] = useState(false);
  const descargarPdf = async () => {
    if (!rootRef.current || exportando) return;
    setExportando(true);
    try {
      await exportarSeccionesPdf({
        root: rootRef.current,
        pais: country,
        titulo: `Resumen ${QN} 2026`,
        periodo: `${LABEL[Q3[0]]} – ${LABEL[Q3[2]]} 2026${enCurso ? " (en curso)" : Q4[0] ? ` (con avance de ${LABEL[Q4[0]]})` : ""}`,
        archivo: `${QN}-2026-${country === "ar" ? "Argentina" : "Paraguay"}`,
      });
    } catch (e) {
      console.error(`PDF ${QN}:`, e);
      alert("No se pudo generar el PDF. Probá de nuevo.");
    } finally {
      setExportando(false);
    }
  };
  const [avisos, setAvisos] = useState<{ mes: string; tipo: string; estado: string; guardadoEl?: string }[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const [q, dash, ...ops] = await Promise.all([
          fetch(`/api/data/quarter?country=${country}&meses=${ALL.join(",")}&transp=${Q3.join(",")}`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`/api/data/${country}?solo=meta_info`).then((r) => r.json()).catch(() => null),
          // Solo las claves que usa el resumen (el snapshot completo de PY pesa ~1,5 MB por mes)
          ...SNAP_MESES.map((m) => fetch(`/api/data/operational?country=${country}&mes=${m}&campos=by_dropshipper,by_proveedor,by_producto`).then((r) => r.json()).catch(() => null)),
        ]);
        if (!alive) return;
        if (q?.error) throw new Error(q.error);
        const d: Partial<Record<Mes, Dia[]>> = {};
        for (const m of ALL) d[m] = ((q?.meses?.[m] ?? []) as Dia[]).map((x) => ({
          dia: Number(x.dia), ingresadas: Number(x.ingresadas), movilizadas: Number(x.movilizadas), entregadas: Number(x.entregadas),
          devueltas: Number(x.devueltas), canceladas: Number(x.canceladas), en_proceso: Number(x.en_proceso), guias: Number(x.guias),
        }));
        setDias(d);
        const t: Partial<Record<Mes, TranspRow[]>> = {};
        for (const m of Q3) t[m] = ((q?.transp?.[m] ?? []) as TranspRow[]).map((x) => ({
          transportadora: String(x.transportadora), guias: Number(x.guias), movilizadas: Number(x.movilizadas), entregadas: Number(x.entregadas),
          devueltas: Number(x.devueltas), en_proceso: Number(x.en_proceso), canceladas: Number(x.canceladas),
        }));
        setTranspData(t);
        const s: Partial<Record<Mes, Snap | null>> = {};
        SNAP_MESES.forEach((m, i) => { s[m] = ops[i]?.data ?? null; });
        setSnaps(s);
        setAvisos(Array.isArray(q?.avisos) ? q.avisos : []);
        setMeta(dash?.meta_info ?? {});
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [country, trimestre]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Métricas por mes ───
  const met = useMemo(() => {
    const out = {} as Record<Mes, Met>;
    for (const m of [...new Set([...ALL, ...Q3, ...Q4])]) {
      const ds = dias[m] ?? [];
      const s = (k: keyof Dia) => ds.reduce((a, x) => a + (x[k] || 0), 0);
      out[m] = {
        // Movilizadas: si hay cierre oficial cargado (meta_info.cierre_movilizadas_<mes>) manda
        // sobre lo calculado desde las guías (archivos viejos pueden no reflejar el cierre real).
        ing: s("ingresadas"), mov: Number(meta[`cierre_movilizadas_${m}`]) || s("movilizadas"), ent: s("entregadas"), dev: s("devueltas"), proc: s("en_proceso"), canc: s("canceladas"),
        diasConDatos: ds.filter((x) => x.ingresadas > 0).length, diasMes: DIAS_MES(m),
        metaMov: Number(meta[`meta_movilizadas_${m}`]) || 0, metaIng: Number(meta[`meta_ingresadas_${m}`]) || 0,
      };
    }
    return out;
  }, [dias, meta]); // eslint-disable-line react-hooks/exhaustive-deps
  // Días del trimestre ya transcurridos (en curso: meses cerrados + días con datos del mes actual)
  const diasTrans = useMemo(() => Q3.reduce((a, m) => {
    if (!enCurso || NUM[m] < NUM[mesHoy]) return a + DIAS_MES(m);
    if (m !== mesHoy) return a;
    const ds = (dias[m] ?? []).filter((d) => d.ingresadas > 0).map((d) => d.dia);
    return a + (ds.length ? Math.max(...ds) : 0);
  }, 0), [dias]); // eslint-disable-line react-hooks/exhaustive-deps
  const diasTotalesTrim = Q3.reduce((a, m) => a + DIAS_MES(m), 0);
  // tQ2full = trimestre anterior completo (para mostrar) · tQ2 = base de comparación:
  // si el trimestre está en curso, el anterior proporcional a los mismos días transcurridos.
  const tQ2full = useMemo(() => sumMet(Q2.map((m) => met[m])), [met]); // eslint-disable-line react-hooks/exhaustive-deps
  const tQ2 = useMemo(() => {
    if (!enCurso || !tQ2full.diasMes) return tQ2full;
    const f = diasTrans / tQ2full.diasMes;
    return { ...tQ2full, ing: tQ2full.ing * f, mov: tQ2full.mov * f, ent: tQ2full.ent * f, dev: tQ2full.dev * f, proc: tQ2full.proc * f, canc: tQ2full.canc * f, metaMov: tQ2full.metaMov * f, metaIng: tQ2full.metaIng * f, diasMes: diasTrans };
  }, [tQ2full, diasTrans]); // eslint-disable-line react-hooks/exhaustive-deps
  const tQ3 = useMemo(() => {
    const t = sumMet(Q3.map((m) => met[m]));
    return enCurso ? { ...t, diasMes: diasTrans } : t;
  }, [met, diasTrans]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tendencia diaria Q3 (+ media móvil 7 días) ───
  const diario = useMemo(() => {
    const rows: { fecha: string; ing: number; mov: number; ent: number; mm7?: number }[] = [];
    for (const m of Q3) for (const x of (dias[m] ?? []).filter((d) => d.dia >= 1 && d.dia <= DIAS_MES(m))) {
      rows.push({ fecha: `${x.dia}/${NUM[m]}`, ing: x.ingresadas, mov: x.movilizadas, ent: x.entregadas });
    }
    rows.forEach((r, i) => {
      if (i >= 6) r.mm7 = Math.round(rows.slice(i - 6, i + 1).reduce((a, b) => a + b.ing, 0) / 7);
    });
    return rows;
  }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Patrón por día de semana ───
  const porDiaSemana = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ ing: 0, n: 0 }));
    for (const m of Q3) for (const x of dias[m] ?? []) {
      if (!x.ingresadas) continue;
      const dow = new Date(2026, NUM[m] - 1, x.dia).getDay();
      acc[dow].ing += x.ingresadas; acc[dow].n++;
    }
    const orden = [1, 2, 3, 4, 5, 6, 0];
    return orden.map((i) => ({ dia: DIAS_SEMANA[i].slice(0, 3), nombre: DIAS_SEMANA[i], prom: acc[i].n ? Math.round(acc[i].ing / acc[i].n) : 0 }));
  }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Activación de dropshippers y proveedores (desde snapshots) ───
  const activacion = useMemo(() => {
    const setDe = (m: Mes, k: "by_dropshipper" | "by_proveedor") => {
      const map = new Map<string, number>();
      for (const r of snaps[m]?.[k] ?? []) if ((r.total || 0) > 0) map.set(normName(r.nombre), (map.get(normName(r.nombre)) ?? 0) + r.total);
      return map;
    };
    const filas = Q3.map((m) => {
      const cur = setDe(m, "by_dropshipper"), ant = setDe(PREV_MES[m], "by_dropshipper");
      const nuevos = [...cur.keys()].filter((k) => !ant.has(k)).length;
      const perdidos = [...ant.keys()].filter((k) => !cur.has(k)).length;
      const vals = [...cur.values()].sort((a, b) => b - a);
      const tot = vals.reduce((a, b) => a + b, 0);
      let acum = 0, pareto = 0;
      for (const v of vals) { if (acum >= tot * 0.8) break; acum += v; pareto++; }
      const conMov = (snaps[m]?.by_dropshipper ?? []).filter((r) => movOf(r.estados || {}) > 0).length;
      const prov = setDe(m, "by_proveedor").size;
      return { m, activos: cur.size, conMov, nuevos, recurrentes: cur.size - nuevos, perdidos, pareto, promPorDs: cur.size ? tot / cur.size : 0, prov, hayDatos: !!snaps[m] };
    });
    const unicos = new Set<string>();
    for (const m of Q3) for (const k of setDe(m, "by_dropshipper").keys()) unicos.add(k);
    const los3 = [...setDe(Q3[0], "by_dropshipper").keys()].filter((k) => setDe(Q3[1], "by_dropshipper").has(k) && setDe(Q3[2], "by_dropshipper").has(k)).length;
    return { filas, unicos: unicos.size, los3 };
  }, [snaps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Rankings Q3 con tendencia mes a mes ───
  const ranking = (k: "by_dropshipper" | "by_proveedor") => {
    const map = new Map<string, { nombre: string; m0: number; m1: number; m2: number; mov: number; ent: number; dev: number }>();
    const key: Record<string, "m0" | "m1" | "m2"> = { [Q3[0]]: "m0", [Q3[1]]: "m1", [Q3[2]]: "m2" };
    for (const m of Q3) for (const r of snaps[m]?.[k] ?? []) {
      const id = normName(r.nombre);
      const cur = map.get(id) ?? { nombre: cleanName(r.nombre), m0: 0, m1: 0, m2: 0, mov: 0, ent: 0, dev: 0 };
      const e = r.estados || {};
      const mv = movOf(e);
      cur[key[m]] += mv; cur.mov += mv; cur.ent += e["ENTREGADO"] || 0; cur.dev += (e["DEVOLUCION"] || 0) + (e["EN PROCESO DE DEVOLUCION"] || 0);
      map.set(id, cur);
    }
    return [...map.values()].sort((a, b) => b.mov - a.mov).slice(0, 10);
  };
  const topDs = useMemo(() => ranking("by_dropshipper"), [snaps]); // eslint-disable-line react-hooks/exhaustive-deps
  const topProv = useMemo(() => ranking("by_proveedor"), [snaps]); // eslint-disable-line react-hooks/exhaustive-deps
  const topProd = useMemo(() => {
    const map = new Map<string, { nombre: string; proveedor: string; ordenes: number; m0: number; m2: number }>();
    for (const m of Q3) for (const r of snaps[m]?.by_producto ?? []) {
      const cur = map.get(r.nombre) ?? { nombre: r.nombre, proveedor: r.proveedor || "", ordenes: 0, m0: 0, m2: 0 };
      cur.ordenes += r.ordenes || 0;
      if (m === Q3[0]) cur.m0 += r.ordenes || 0;
      if (m === Q3[2]) cur.m2 += r.ordenes || 0;
      map.set(r.nombre, cur);
    }
    return [...map.values()].sort((a, b) => b.ordenes - a.ordenes).slice(0, 10);
  }, [snaps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Transportadoras por mes (misma regla que Operaciones → Por Logística) ───
  // Tasa de entrega = entregadas ÷ movilizadas · devolución = devueltas ÷ movilizadas
  const transp = useMemo(() => {
    type T = { mov: number; ent: number; dev: number; proc: number };
    const map = new Map<string, Partial<Record<Mes, T>>>();
    for (const m of Q3) for (const t of transpData[m] ?? []) {
      if (t.movilizadas <= 0) continue;
      const row = map.get(t.transportadora) ?? {};
      row[m] = { mov: t.movilizadas, ent: t.entregadas, dev: t.devueltas, proc: t.en_proceso };
      map.set(t.transportadora, row);
    }
    return [...map.entries()].map(([nombre, r]) => {
      const tot = Q3.reduce((a, m) => ({ mov: a.mov + (r[m]?.mov ?? 0), ent: a.ent + (r[m]?.ent ?? 0), dev: a.dev + (r[m]?.dev ?? 0), proc: a.proc + (r[m]?.proc ?? 0) }), { mov: 0, ent: 0, dev: 0, proc: 0 });
      return { nombre, r, tot };
    }).sort((a, b) => b.tot.mov - a.tot.mov);
  }, [transpData]); // eslint-disable-line react-hooks/exhaustive-deps
  const movTotalTransp = transp.reduce((a, t) => a + t.tot.mov, 0);

  // ─── Avance del mes en curso / preparación del siguiente trimestre ───
  const q4 = useMemo(() => {
    const oct = met[MES_AVANCE];
    const diasOct = (dias[MES_AVANCE] ?? []).filter((d) => d.ingresadas > 0).map((d) => d.dia);
    const ultimoDia = diasOct.length ? Math.max(...diasOct) : 0;
    const restantes = Math.max(DIAS_MES(MES_AVANCE) - ultimoDia, 0);
    const promOct = ultimoDia ? oct.ing / ultimoDia : 0;
    const proyIng = Math.round(promOct * DIAS_MES(MES_AVANCE));
    // Tasa de movilización de referencia: la del último trimestre cerrado
    const tasaMovQ3 = enCurso ? ratio(tQ2full.mov, tQ2full.ing) : ratio(tQ3.mov, tQ3.ing);
    const proyMov = Math.round(proyIng * tasaMovQ3);
    const necesarioDiaIng = restantes > 0 ? Math.max(oct.metaIng - oct.ing, 0) / restantes : 0;
    const promQ3 = enCurso ? ratio(tQ2full.ing, tQ2full.diasMes) : ratio(tQ3.ing, tQ3.diasMes);
    const crecQ3vsQ2 = delta(tQ3.ing, tQ2.ing);
    const baseMensualQ4 = Math.round((tQ3.mov / 3) * (1 + crecQ3vsQ2 / 100 / 3));
    // Proyección del trimestre en curso: meses cerrados reales + mes actual proyectado + resto al ritmo actual
    const promMovDia = ultimoDia ? oct.mov / ultimoDia : 0;
    let proyTrimMov = 0, proyTrimIng = 0, diasRestTrim = 0;
    for (const m of Q3) {
      if (!enCurso || NUM[m] < NUM[mesHoy]) { proyTrimMov += met[m].mov; proyTrimIng += met[m].ing; }
      else if (m === mesHoy) { proyTrimMov += Math.max(proyMov, oct.mov); proyTrimIng += Math.max(proyIng, oct.ing); diasRestTrim += restantes; }
      else { proyTrimMov += Math.round(Math.max(promMovDia, promOct * tasaMovQ3) * DIAS_MES(m)); proyTrimIng += Math.round(promOct * DIAS_MES(m)); diasRestTrim += DIAS_MES(m); }
    }
    const necesarioDiaMovTrim = diasRestTrim > 0 ? Math.max(tQ3.metaMov - tQ3.mov, 0) / diasRestTrim : 0;
    return { oct, ultimoDia, restantes, promOct, proyIng, proyMov, necesarioDiaIng, promQ3, crecQ3vsQ2, baseMensualQ4, tasaMovQ3, proyTrimMov, proyTrimIng, diasRestTrim, necesarioDiaMovTrim, promMovDia };
  }, [met, dias, tQ2, tQ3, tQ2full]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Conclusiones automáticas ───
  const insights = useMemo(() => {
    const out: { tone: "pos" | "neg" | "info"; txt: string }[] = [];
    if (enCurso) {
      out.push({ tone: tQ3.mov >= tQ2.mov ? "pos" : "neg", txt: `${QN} en curso (${diasTrans} de ${diasTotalesTrim} días): ${fmt(tQ3.mov)} movilizadas, ${deltaTxt(tQ3.mov, tQ2.mov)} contra el ${QP} en los mismos días (${fmt(tQ2.mov)}).` });
      if (tQ3.metaMov > 0) out.push({ tone: q4.proyTrimMov >= tQ3.metaMov ? "pos" : "neg", txt: `Meta ${QN}: ${pct(tQ3.mov, tQ3.metaMov)} cumplido con ${pct(diasTrans, diasTotalesTrim, 0)} del trimestre transcurrido. Proyección al cierre: ~${fmt(q4.proyTrimMov)} de ${fmt(tQ3.metaMov)} movilizadas.` });
    } else {
      const mejor = [...Q3].sort((a, b) => met[b].mov - met[a].mov)[0];
      out.push({ tone: "info", txt: `Mejor mes del ${QN} en movilizadas: ${LABEL[mejor]} (${fmt(met[mejor].mov)}).` });
      out.push({ tone: tQ3.mov >= tQ2.mov ? "pos" : "neg", txt: `${QN} movilizó ${fmt(tQ3.mov)} guías, ${deltaTxt(tQ3.mov, tQ2.mov)} contra ${QP} (${fmt(tQ2.mov)}).` });
      if (tQ3.metaMov > 0) out.push({ tone: tQ3.mov >= tQ3.metaMov ? "pos" : "neg", txt: `Cumplimiento de meta ${QN}: ${pct(tQ3.mov, tQ3.metaMov)} (${fmt(tQ3.mov)} de ${fmt(tQ3.metaMov)} movilizadas).` });
    }
    const teJul = ratio(met[M_INI].ent, met[M_INI].ent + met[M_INI].dev) * 100, teSep = ratio(met[M_FIN].ent, met[M_FIN].ent + met[M_FIN].dev) * 100;
    if (teJul && teSep && M_INI !== M_FIN) out.push({ tone: teSep >= teJul ? "pos" : "neg", txt: `Efectividad de entrega (entregadas ÷ entregadas+devueltas): ${l(M_INI)} ${teJul.toFixed(1).replace(".", ",")}% → ${l(M_FIN)} ${teSep.toFixed(1).replace(".", ",")}% (${ppTxt(teSep, teJul)}).` });
    const pico = [...porDiaSemana].sort((a, b) => b.prom - a.prom)[0], valle = [...porDiaSemana].sort((a, b) => a.prom - b.prom)[0];
    if (pico?.prom) out.push({ tone: "info", txt: `Día más fuerte: ${pico.nombre} (${fmt(pico.prom)} ingresadas promedio). Más flojo: ${valle.nombre} (${fmt(valle.prom)}). Planificar campañas y stock según este patrón.` });
    const a = activacion.filas;
    if (a[0]?.hayDatos && a[idxFin]?.hayDatos && idxFin > 0) out.push({ tone: a[idxFin].activos >= a[0].activos ? "pos" : "neg", txt: `Dropshippers activos: ${l(M_INI)} ${fmt(a[0].activos)} → ${l(M_FIN)} ${fmt(a[idxFin].activos)}. En el trimestre se perdieron ${fmt(a.reduce((s, x) => s + x.perdidos, 0))} y entraron ${fmt(a.reduce((s, x) => s + x.nuevos, 0))} nuevos.` });
    else if (a[0]?.hayDatos && enCurso) out.push({ tone: a[0].nuevos >= a[0].perdidos ? "pos" : "neg", txt: `Dropshippers activos en ${l(M_INI)}: ${fmt(a[0].activos)} (${fmt(a[0].nuevos)} nuevos y ${fmt(a[0].perdidos)} que no volvieron desde ${l(PREV_MES[M_INI])}).` });
    const conVol = transp.filter((t) => t.tot.mov > 300);
    const peor = [...conVol].sort((x, y) => ratio(x.tot.ent, x.tot.mov) - ratio(y.tot.ent, y.tot.mov))[0];
    const mejorT = [...conVol].sort((x, y) => ratio(y.tot.ent, y.tot.mov) - ratio(x.tot.ent, x.tot.mov))[0];
    if (peor && mejorT && peor !== mejorT) out.push({ tone: "info", txt: `Transportadoras (tasa de entrega sobre movilizadas): mejor ${mejorT.nombre} (${pct(mejorT.tot.ent, mejorT.tot.mov)}), más baja ${peor.nombre} (${pct(peor.tot.ent, peor.tot.mov)}).` });
    return out;
  }, [met, tQ2, tQ3, porDiaSemana, activacion, transp, q4, diasTrans]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Lectura del trimestre: resumen ejecutivo redactado con los datos ───
  const lectura = useMemo(() => {
    const pais = country === "ar" ? "Argentina" : "Paraguay";
    const p1 = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");
    const sube = (a: number, b: number) => (a >= b ? "subió" : "bajó");
    const parrafos: string[] = [];
    const prioridades: string[] = [];

    if (enCurso) {
      const pais2 = pais;
      const avanceCal = ratio(diasTrans, diasTotalesTrim);
      const avanceMeta = ratio(tQ3.mov, tQ3.metaMov);
      parrafos.push(
        `El ${QN} 2026 está en curso: al día ${q4.ultimoDia} de ${l(mesHoy)} ${pais2} lleva ${fmt(tQ3.mov)} guías movilizadas sobre ${fmt(tQ3.ing)} órdenes ingresadas` +
        (tQ3.metaMov ? `, el ${p1(tQ3.mov, tQ3.metaMov)} de la meta trimestral de ${fmt(tQ3.metaMov)} con el ${p1(diasTrans, diasTotalesTrim)} del calendario transcurrido (${avanceMeta >= avanceCal ? "adelantado" : "atrasado"} respecto del ritmo necesario).` : "."),
      );
      parrafos.push(
        `El ritmo actual es de ${fmt(q4.promOct)} ingresadas por día (${q4.promOct >= q4.promQ3 ? "por encima" : "por debajo"} del promedio del ${QP} de ${fmt(q4.promQ3)}) y ${fmt(q4.promMovDia)} movilizadas por día. ` +
        `Contra el ${QP} en los mismos ${diasTrans} días, las movilizadas van ${deltaTxt(tQ3.mov, tQ2.mov)} y las ingresadas ${deltaTxt(tQ3.ing, tQ2.ing)}. ` +
        `Si se sostiene este ritmo, el trimestre cerraría en ~${fmt(q4.proyTrimMov)} movilizadas` +
        (tQ3.metaMov ? ` (${p1(q4.proyTrimMov, tQ3.metaMov)} de la meta)` : "") +
        (q4.diasRestTrim > 0 && tQ3.metaMov > tQ3.mov ? `; para cumplirla hacen falta ${fmt(q4.necesarioDiaMovTrim)} movilizadas por día en los ${q4.diasRestTrim} días que quedan.` : "."),
      );
      // Con guías en proceso, la tasa sobre movilizadas es baja por definición: se compara la
      // efectividad sobre guías ya cerradas (entregadas ÷ entregadas + devueltas).
      const efCur = ratio(tQ3.ent, tQ3.ent + tQ3.dev) * 100, efPrev = ratio(tQ2full.ent, tQ2full.ent + tQ2full.dev) * 100;
      parrafos.push(
        `La tasa de entrega en curso es ${p1(tQ3.ent, tQ3.mov)} sobre movilizadas, con ${fmt(tQ3.proc)} guías todavía en proceso que van a ir cerrando (por eso es más baja que el ${p1(tQ2full.ent, tQ2full.mov)} del ${QP} cerrado). ` +
        `Sobre las guías ya cerradas la efectividad va en ${efCur.toFixed(1).replace(".", ",")}% (${QP} cerrado: ${efPrev.toFixed(1).replace(".", ",")}%), pero las devoluciones se registran más tarde que las entregas, así que esta cifra suele bajar a medida que el mes madura; la comparación justa es la del mes anterior al mismo día. ` +
        `Para eso, y para comparar logísticas en igualdad de condiciones, usá Operaciones con el rango del mes.`,
      );
      if (tQ3.metaMov && q4.proyTrimMov < tQ3.metaMov) prioridades.push(`Ritmo: la proyección (${fmt(q4.proyTrimMov)}) queda ${fmt(tQ3.metaMov - q4.proyTrimMov)} movilizadas debajo de la meta del ${QN}. Hacen falta ${fmt(q4.necesarioDiaMovTrim)} movilizadas por día (hoy ${fmt(q4.promMovDia)}).`);
      if (efCur < efPrev - 3) prioridades.push(`Entrega: la efectividad sobre guías cerradas (${efCur.toFixed(1).replace(".", ",")}%) está ${(efPrev - efCur).toFixed(1).replace(".", ",")} puntos debajo del ${QP} (${efPrev.toFixed(1).replace(".", ",")}%); revisar novedades, confirmación y devoluciones antes de las campañas de fin de año.`);
    }

    if (!enCurso) {
    // 1. Volumen y meta
    const mejor = [...Q3].sort((a, b) => met[b].mov - met[a].mov)[0];
    const cumpl = ratio(tQ3.mov, tQ3.metaMov);
    const tendMes = delta(met[Q3[2]].mov, met[Q3[0]].mov);
    parrafos.push(
      `En el ${QN} 2026 ${pais} movilizó ${fmt(tQ3.mov)} guías sobre ${fmt(tQ3.ing)} órdenes ingresadas, ${deltaTxt(tQ3.mov, tQ2.mov)} contra el ${QP} (${fmt(tQ2.mov)} movilizadas)` +
      (tQ3.metaMov ? `, con un cumplimiento de meta del ${p1(tQ3.mov, tQ3.metaMov)} (${tQ3.mov >= tQ3.metaMov ? `${fmt(tQ3.mov - tQ3.metaMov)} guías por encima` : `faltaron ${fmt(tQ3.metaMov - tQ3.mov)} guías`} de las ${fmt(tQ3.metaMov)} planificadas)` : "") +
      `. El trimestre fue ${tendMes >= 3 ? "de crecimiento sostenido" : tendMes <= -3 ? "de caída progresiva" : "estable"} mes a mes: ${l(Q3[0])} ${fmt(met[Q3[0]].mov)}, ${l(Q3[1])} ${fmt(met[Q3[1]].mov)} y ${l(Q3[2])} ${fmt(met[Q3[2]].mov)} movilizadas (${deltaTxt(met[Q3[2]].mov, met[Q3[0]].mov)} de ${l(Q3[0])} a ${l(Q3[2])}); el mejor mes fue ${LABEL[mejor].toLowerCase()}. ` +
      `El promedio diario de ingresadas fue ${fmt(ratio(tQ3.ing, tQ3.diasMes))}, contra ${fmt(ratio(tQ2.ing, tQ2.diasMes))} en el ${QP}.`,
    );
    if (tQ3.metaMov && cumpl < 1) prioridades.push(`Recuperar el ritmo: el ${QN} cerró en ${p1(tQ3.mov, tQ3.metaMov)} de la meta; el ${QS} necesita sostener al menos ${fmt(ratio(tQ3.metaMov, 3))} movilizadas por mes para no repetir la brecha.`);

    // 2. Conversión y calidad de entrega
    const movQ3 = ratio(tQ3.mov, tQ3.ing) * 100, movQ2 = ratio(tQ2.mov, tQ2.ing) * 100;
    const teQ3 = ratio(tQ3.ent, tQ3.mov) * 100, teQ2 = ratio(tQ2.ent, tQ2.mov) * 100;
    const efQ3l = ratio(tQ3.ent, tQ3.ent + tQ3.dev) * 100, efQ2l = ratio(tQ2.ent, tQ2.ent + tQ2.dev) * 100;
    const teJul = ratio(met[Q3[0]].ent, met[Q3[0]].mov) * 100, teSep = ratio(met[Q3[2]].ent, met[Q3[2]].mov) * 100;
    parrafos.push(
      `La conversión de órdenes a guías movilizadas fue del ${p1(tQ3.mov, tQ3.ing)} (${ppTxt(movQ3, movQ2)} vs ${QP}). ` +
      `La tasa de entrega sobre movilizadas fue ${p1(tQ3.ent, tQ3.mov)} y la efectividad sobre guías cerradas ${efQ3l.toFixed(1).replace(".", ",")}%, ` +
      `${Math.abs(efQ3l - efQ2l) < 1 ? `prácticamente igual que en el ${QP}` : `${efQ3l > efQ2l ? "una mejora" : "un retroceso"} de ${Math.abs(efQ3l - efQ2l).toFixed(1).replace(".", ",")} puntos frente al ${QP}`}; la devolución ${sube(ratio(tQ3.dev, tQ3.mov), ratio(tQ2.dev, tQ2.mov))} a ${p1(tQ3.dev, tQ3.mov)} (${QP}: ${p1(tQ2.dev, tQ2.mov)}). ` +
      (Math.abs(teSep - teJul) < 1
        ? `Dentro del trimestre la entrega se mantuvo estable (${teJul.toFixed(1).replace(".", ",")}% en ${l(Q3[0])}, ${teSep.toFixed(1).replace(".", ",")}% en ${l(Q3[2])})`
        : `Dentro del trimestre la entrega ${teSep > teJul ? "mejoró" : "se deterioró"} de ${teJul.toFixed(1).replace(".", ",")}% en ${l(Q3[0])} a ${teSep.toFixed(1).replace(".", ",")}% en ${l(Q3[2])}`) +
      (met[Q3[2]].proc > 0 ? ` (${l(Q3[2])} todavía tiene ${fmt(met[Q3[2]].proc)} guías en proceso, por lo que su tasa final puede subir).` : "."),
    );
    if (teQ3 < teQ2 || teSep < teJul - 2) prioridades.push(`Calidad de entrega: la tasa cayó ${teSep < teJul ? `${(teJul - teSep).toFixed(1).replace(".", ",")} puntos entre ${l(Q3[0])} y ${l(Q3[2])}` : `frente al ${QP}`}. Revisar novedades, confirmación de pedidos y devoluciones por zona antes de escalar volumen.`);

    }

    // 3. Transportadoras
    const movT = transp.reduce((a, t) => a + t.tot.mov, 0);
    const conVol = transp.filter((t) => t.tot.mov > Math.max(300, movT * 0.03));
    if (conVol.length) {
      const orden = [...conVol].sort((x, y) => ratio(y.tot.ent, y.tot.mov) - ratio(x.tot.ent, x.tot.mov));
      const mejorT = orden[0], peorT = orden[orden.length - 1];
      const detalle = conVol.map((t) => `${t.nombre} ${p1(t.tot.ent, t.tot.mov)} de entrega con ${p1(t.tot.mov, movT)} del volumen`).join("; ");
      parrafos.push(
        `Por transportadora (misma regla que Operaciones): ${detalle}. ` +
        (mejorT !== peorT ? `La brecha entre la mejor (${mejorT.nombre}) y la más baja (${peorT.nombre}) es de ${((ratio(mejorT.tot.ent, mejorT.tot.mov) - ratio(peorT.tot.ent, peorT.tot.mov)) * 100).toFixed(1).replace(".", ",")} puntos de entrega.` : ""),
      );
      if (mejorT !== peorT && ratio(peorT.tot.mov, movT) > 0.15) prioridades.push(`Logística: ${peorT.nombre} mueve ${p1(peorT.tot.mov, movT)} del volumen con la entrega más baja (${p1(peorT.tot.ent, peorT.tot.mov)}). Evaluar derivar zonas o volumen hacia ${mejorT.nombre} (${p1(mejorT.tot.ent, mejorT.tot.mov)}) y negociar metas de entrega.`);
    }

    // 4. Base de dropshippers y concentración
    const a = activacion.filas;
    if (!enCurso && a[0]?.hayDatos && a[2]?.hayDatos) {
      const nuevos = a.reduce((s, x) => s + x.nuevos, 0), perdidos = a.reduce((s, x) => s + x.perdidos, 0);
      let dsTot = 0;
      for (const m of Q3) for (const r of snaps[m]?.by_dropshipper ?? []) dsTot += movOf(r.estados || {});
      const top10 = topDs.reduce((s, r) => s + r.mov, 0);
      parrafos.push(
        `La base activa pasó de ${fmt(a[0].activos)} dropshippers con órdenes en ${l(Q3[0])} a ${fmt(a[2].activos)} en ${l(Q3[2])} (${fmt(activacion.unicos)} distintos en el trimestre, ${fmt(activacion.los3)} activos los tres meses). ` +
        `Entraron ${fmt(nuevos)} nuevos y se perdieron ${fmt(perdidos)}, un saldo ${nuevos >= perdidos ? "positivo" : "negativo"} de ${fmt(Math.abs(nuevos - perdidos))}. ` +
        `El negocio está concentrado: en ${l(Q3[2])} ${fmt(a[2].pareto)} dropshippers generaron el 80% de las órdenes` +
        (dsTot ? ` y el top 10 explica el ${p1(top10, dsTot)} de las movilizadas del trimestre` : "") +
        (topDs[0] ? `, liderado por ${topDs[0].nombre} (${fmt(topDs[0].mov)}).` : "."),
      );
      if (perdidos > nuevos) prioridades.push(`Retención: se perdieron más dropshippers (${fmt(perdidos)}) de los que entraron (${fmt(nuevos)}). Armar un plan de reactivación con la lista de "perdidos" y seguimiento semanal del top 20.`);
      if (dsTot && ratio(top10, dsTot) > 0.4) prioridades.push(`Dependencia: el top 10 concentra ${p1(top10, dsTot)} del volumen. Cuidar a esas cuentas (stock, tiempos, atención) y desarrollar la segunda línea para bajar el riesgo.`);
    }

    // 5. Proveedores y productos
    if (!enCurso && (topProv[0] || topProd[0])) {
      const caen = topProv.filter((r) => r.m0 > 0 && r.m2 < r.m0 * 0.8).map((r) => r.nombre);
      parrafos.push(
        (topProv[0] ? `Entre los proveedores lideró ${topProv[0].nombre} (${fmt(topProv[0].mov)} movilizadas)${topProv[1] ? `, seguido por ${topProv[1].nombre} y ${topProv[2]?.nombre ?? "—"}` : ""}. ` : "") +
        (caen.length ? `Dentro del top 10, ${caen.slice(0, 3).join(", ")} ${caen.length === 1 ? "cayó" : "cayeron"} más de 20% de ${l(Q3[0])} a ${l(Q3[2])}. ` : "") +
        (topProd[0] ? `El producto más pedido fue "${topProd[0].nombre}" con ${fmt(topProd[0].ordenes)} órdenes en el trimestre.` : ""),
      );
      if (caen.length) prioridades.push(`Proveedores en baja: revisar stock, precio y calidad con ${caen.slice(0, 3).join(", ")} antes de las campañas de fin de año.`);
    }

    // 6. Arranque del trimestre siguiente
    if (!enCurso) {
    const pico = [...porDiaSemana].sort((x, y) => y.prom - x.prom)[0];
    parrafos.push(
      `Para el ${QS}: ${l(MES_AVANCE)} lleva ${fmt(q4.oct.ing)} ingresadas al día ${q4.ultimoDia} (${fmt(q4.promOct)} por día, ${q4.promOct >= q4.promQ3 ? "por encima" : "por debajo"} del promedio del ${QN} de ${fmt(q4.promQ3)}). ` +
      `Al ritmo actual cerraría en ~${fmt(q4.proyIng)} ingresadas y ~${fmt(q4.proyMov)} movilizadas` +
      (q4.oct.metaMov ? `, ${q4.proyMov >= q4.oct.metaMov ? "superando" : "por debajo de"} la meta de ${fmt(q4.oct.metaMov)} movilizadas` : "") +
      (q4.restantes > 0 && q4.oct.metaIng ? `; para llegar a la meta de ingresadas hacen falta ${fmt(q4.necesarioDiaIng)} por día en los ${q4.restantes} días que quedan.` : ".") +
      (pico?.prom ? ` ${pico.nombre} es el día de mayor demanda: conviene concentrar ahí campañas y reposición.` : ""),
    );
    if (q4.oct.metaMov && q4.proyMov < q4.oct.metaMov) prioridades.push(`${LABEL[MES_AVANCE]}: la proyección (${fmt(q4.proyMov)}) no alcanza la meta (${fmt(q4.oct.metaMov)}). Activar acciones comerciales con el top de dropshippers y proveedores en esta quincena.`);
    if (Q4.length > 2 && Q4.slice(1).some((m) => !met[m]?.metaMov)) prioridades.push(`Definir metas de ${l(Q4[1])} y ${l(Q4[2])}: la base sugerida por la tendencia del ${QN} es ~${fmt(q4.baseMensualQ4)} movilizadas por mes.`);

    }

    return { parrafos, prioridades };
  }, [country, met, tQ2, tQ3, tQ2full, transp, activacion, snaps, topDs, topProv, topProd, porDiaSemana, q4, diasTrans]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="glass-card p-6 t-muted text-sm">Cargando resumen {QN}… (calcula el trimestre con los datos de Operaciones)</div>;
  if (err) return <div className="glass-card p-6 text-sm text-red-400">No se pudo cargar el resumen {QN}: {err}</div>;

  const evolucion = ALL.map((m) => ({
    mes: m === mesHoy ? `${CORTO[m]}*` : CORTO[m], ingresadas: met[m].ing, movilizadas: met[m].mov, entregadas: met[m].ent, devueltas: met[m].dev, metaMov: met[m].metaMov || null,
    tasaEnt: +(ratio(met[m].ent, met[m].mov) * 100).toFixed(1), tasaDev: +(ratio(met[m].dev, met[m].mov) * 100).toFixed(1),
    efectividad: +(ratio(met[m].ent, met[m].ent + met[m].dev) * 100).toFixed(1), tasaMov: +(ratio(met[m].mov, met[m].ing) * 100).toFixed(1),
  }));

  // Cuadro comparativo: columnas agrupadas por trimestre y filas agrupadas por tema
  type Fila = { label: string; get: (x: Met) => string; delta?: (a: Met, b: Met) => { txt: string; good: boolean }; tasa?: boolean; color?: (x: Met) => string | undefined };
  const mesesConCierre = ALL.filter((m) => Number(meta[`cierre_movilizadas_${m}`]) > 0);
  const colorCumpl = (x: Met) => (!x.metaMov ? undefined : x.mov >= x.metaMov ? "#10b981" : x.mov >= x.metaMov * 0.9 ? "#f59e0b" : "#ef4444");
  const gruposComp: { titulo: string; filas: Fila[] }[] = [
    { titulo: "Volumen", filas: [
      { label: "Ingresadas", get: (x) => fmt(x.ing), delta: (a, b) => ({ txt: deltaTxt(a.ing, b.ing), good: a.ing >= b.ing }) },
      { label: "Promedio diario de ingresadas", get: (x) => fmt(ratio(x.ing, x.diasMes)), delta: (a, b) => ({ txt: deltaTxt(ratio(a.ing, a.diasMes), ratio(b.ing, b.diasMes)), good: ratio(a.ing, a.diasMes) >= ratio(b.ing, b.diasMes) }) },
      { label: "Movilizadas", get: (x) => fmt(x.mov), delta: (a, b) => ({ txt: deltaTxt(a.mov, b.mov), good: a.mov >= b.mov }) },
      { label: "% movilización (mov ÷ ing)", tasa: true, get: (x) => pct(x.mov, x.ing), delta: (a, b) => ({ txt: ppTxt(ratio(a.mov, a.ing) * 100, ratio(b.mov, b.ing) * 100), good: ratio(a.mov, a.ing) >= ratio(b.mov, b.ing) }) },
    ] },
    { titulo: "Meta", filas: [
      { label: "Meta de movilizadas", get: (x) => (x.metaMov ? fmt(x.metaMov) : "—") },
      { label: "Cumplimiento de meta", tasa: true, get: (x) => pct(x.mov, x.metaMov), color: colorCumpl, delta: (a, b) => ({ txt: ppTxt(ratio(a.mov, a.metaMov) * 100, ratio(b.mov, b.metaMov) * 100), good: ratio(a.mov, a.metaMov) >= ratio(b.mov, b.metaMov) }) },
    ] },
    { titulo: "Entrega", filas: [
      { label: "Entregadas", get: (x) => fmt(x.ent), delta: (a, b) => ({ txt: deltaTxt(a.ent, b.ent), good: a.ent >= b.ent }) },
      { label: "Tasa de entrega (ent ÷ mov)", tasa: true, get: (x) => pct(x.ent, x.mov), delta: (a, b) => ({ txt: ppTxt(ratio(a.ent, a.mov) * 100, ratio(b.ent, b.mov) * 100), good: ratio(a.ent, a.mov) >= ratio(b.ent, b.mov) }) },
      { label: "Efectividad (ent ÷ ent + dev)", tasa: true, get: (x) => pct(x.ent, x.ent + x.dev), delta: (a, b) => ({ txt: ppTxt(ratio(a.ent, a.ent + a.dev) * 100, ratio(b.ent, b.ent + b.dev) * 100), good: ratio(a.ent, a.ent + a.dev) >= ratio(b.ent, b.ent + b.dev) }) },
    ] },
    { titulo: "Devolución y pendientes", filas: [
      { label: "Devueltas", get: (x) => fmt(x.dev), delta: (a, b) => ({ txt: deltaTxt(a.dev, b.dev), good: a.dev <= b.dev }) },
      { label: "Tasa de devolución (dev ÷ mov)", tasa: true, get: (x) => pct(x.dev, x.mov), delta: (a, b) => ({ txt: ppTxt(ratio(a.dev, a.mov) * 100, ratio(b.dev, b.mov) * 100), good: ratio(a.dev, a.mov) <= ratio(b.dev, b.mov) }) },
      { label: "En proceso", get: (x) => fmt(x.proc) },
      { label: "Canceladas", get: (x) => fmt(x.canc) },
    ] },
  ];
  const colsQ: { titulo: string; meses: Mes[]; total: Met; color: string }[] = [
    { titulo: `${QP} · ${CORTO[Q2[0]]} – ${CORTO[Q2[2]]}`, meses: Q2, total: tQ2full, color: "#64748b" },
    { titulo: `${QN} · ${CORTO[Q3[0]]} – ${CORTO[Q3[2]]}${enCurso ? " (en curso)" : ""}`, meses: Q3, total: tQ3, color: "#f97316" },
  ];

  const efQ3 = ratio(tQ3.ent, tQ3.ent + tQ3.dev) * 100, efQ2 = ratio(tQ2.ent, tQ2.ent + tQ2.dev) * 100;

  return (
    <div className="space-y-4" ref={rootRef}>
      {/* Encabezado */}
      <div className="rounded-xl p-5 border-2 border-orange-500/40" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(6,182,212,0.05))" }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-bold t-primary">📊 Resumen {QN} 2026{enCurso ? " (en curso)" : ""} — {country === "ar" ? "Argentina" : "Paraguay"}</h2>
          {canDownload && (
            <button
              onClick={descargarPdf}
              disabled={exportando}
              className="text-xs px-4 py-2 rounded-full bg-orange-500 text-white border border-orange-500 shadow-lg shadow-orange-500/20 hover:bg-orange-600 disabled:opacity-60 transition-all"
            >
              {exportando ? "Generando PDF…" : "📄 Descargar PDF"}
            </button>
          )}
        </div>
        <p className="text-xs t-muted">
          {LABEL[Q3[0]]} + {LABEL[Q3[1]]} + {LABEL[Q3[2]]}, comparado con {QP}{enCurso ? ` (proporcional a los ${diasTrans} días transcurridos)` : Q4[0] ? ` y con el arranque de ${QS}` : ""}. Mismas reglas que Operaciones: ingresadas del Seguimiento Diario, movilizadas/entregadas/devueltas del último archivo de cada mes (solo guías con fecha de orden del mes).
        </p>
      </div>

      {avisos.length > 0 && (
        <div className="rounded-xl p-3 border border-amber-500/40 text-xs" style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
          {avisos.map((a, i) => (
            <p key={i}>
              ⚠ {LABEL[a.mes as Mes] ?? a.mes}{a.tipo === "transp" ? " (transportadoras)" : ""}:{" "}
              {a.estado === "guardado"
                ? `la base tardó demasiado; se muestra el último cálculo guardado${a.guardadoEl ? ` (${new Date(a.guardadoEl).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })})` : ""}.`
                : "no se pudo calcular ahora (la base tardó demasiado). Recargá en unos minutos."}
            </p>
          ))}
        </div>
      )}

      {/* Lectura del trimestre */}
      <Card title={`📝 Lectura del ${QN}${enCurso ? " (en curso)" : ""} — ${country === "ar" ? "Argentina" : "Paraguay"}`} sub="Resumen ejecutivo redactado con los datos del trimestre (se actualiza solo con cada carga)">
        <div className="space-y-2.5">
          {lectura.parrafos.map((t, i) => (
            <p key={i} className="text-[13px] leading-relaxed t-secondary">{t}</p>
          ))}
        </div>
        {lectura.prioridades.length > 0 && (
          <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(249,115,22,0.07)", borderLeft: "4px solid #f97316" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#f97316" }}>{enCurso ? `Prioridades para lo que queda del ${QN}` : `Prioridades para el ${QS}`}</p>
            <ol className="space-y-1.5 list-decimal pl-5">
              {lectura.prioridades.map((t, i) => <li key={i} className="text-[12.5px] leading-relaxed t-secondary">{t}</li>)}
            </ol>
          </div>
        )}
      </Card>

      {/* Meta del trimestre */}
      <div data-pdf-section className="rounded-2xl p-5 border-2" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.10), rgba(249,115,22,0.08))", borderColor: "rgba(167,139,250,0.4)" }}>
        <h3 className="text-base font-bold t-primary mb-3">🎯 Meta {QN} — {enCurso ? `avance (${diasTrans} de ${diasTotalesTrim} días · esperado ${pct(diasTrans, diasTotalesTrim, 0)})` : "cumplimiento trimestral"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ l: "Movilizadas", real: tQ3.mov, meta: tQ3.metaMov, color: C.mov }, { l: "Ingresadas", real: tQ3.ing, meta: tQ3.metaIng, color: C.ing }].map((x) => (
            <div key={x.l}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs t-secondary">{x.l}</span>
                <span className="font-mono text-sm t-primary"><b style={{ color: x.color }}>{fmt(x.real)}</b> / {x.meta ? fmt(x.meta) : "sin meta"}</span>
              </div>
              <div className="h-3 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(148,163,184,0.2)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(ratio(x.real, x.meta) * 100, 100)}%`, background: x.real >= x.meta ? "#10b981" : x.color }} />
              </div>
              <p className="text-[11px] mt-1" style={{ color: x.real >= x.meta ? "#10b981" : "#f59e0b" }}>{pct(x.real, x.meta)} de la meta{x.meta ? ` · ${x.real >= x.meta ? "superada por" : enCurso ? "faltan" : "faltaron"} ${fmt(Math.abs(x.real - x.meta))}` : ""}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {Q3.map((m) => (
            <div key={m} className="rounded-lg p-2 text-center" style={{ background: "rgba(148,163,184,0.08)" }}>
              <div className="text-[11px] t-muted">{LABEL[m]}</div>
              {enCurso && NUM[m] > NUM[mesHoy] ? (
                <>
                  <div className="font-mono text-sm font-bold t-muted">por empezar</div>
                  <div className="text-[10px] t-muted">meta {fmt(met[m].metaMov)}</div>
                </>
              ) : (
                <>
                  <div className="font-mono text-sm font-bold t-primary">{fmt(met[m].mov)}</div>
                  <div className="text-[10px]" style={{ color: met[m].mov >= met[m].metaMov ? "#10b981" : "#f59e0b" }}>{pct(met[m].mov, met[m].metaMov, 0)} de {fmt(met[m].metaMov)}{m === mesHoy ? " (en curso)" : ""}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KPIs del trimestre vs el anterior */}
      <div data-pdf-section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <Kpi label={`Ingresadas ${QN}`} value={fmt(tQ3.ing)} sub={`${deltaTxt(tQ3.ing, tQ2.ing)} vs ${QP}${enCurso ? " (mismos días)" : ""}`} good={tQ3.ing >= tQ2.ing} color={C.ing} />
        <Kpi label={`Movilizadas ${QN}`} value={fmt(tQ3.mov)} sub={`${deltaTxt(tQ3.mov, tQ2.mov)} vs ${QP}${enCurso ? " (mismos días)" : ""}`} good={tQ3.mov >= tQ2.mov} color={C.mov} />
        <Kpi label="% movilización" value={pct(tQ3.mov, tQ3.ing)} sub={`${QP}: ${pct(tQ2.mov, tQ2.ing)}`} good={ratio(tQ3.mov, tQ3.ing) >= ratio(tQ2.mov, tQ2.ing)} color={C.mov} />
        <Kpi label={`Entregadas ${QN}`} value={fmt(tQ3.ent)} sub={`${deltaTxt(tQ3.ent, tQ2.ent)} vs ${QP}${enCurso ? " (mismos días)" : ""}`} good={tQ3.ent >= tQ2.ent} color={C.ent} />
        <Kpi label="Tasa de entrega" value={pct(tQ3.ent, tQ3.mov)} sub={`${QP}: ${pct(tQ2.ent, tQ2.mov)}`} good={ratio(tQ3.ent, tQ3.mov) >= ratio(tQ2.ent, tQ2.mov)} color={C.ent} />
        <Kpi label="Efectividad cerrada" value={`${efQ3.toFixed(1).replace(".", ",")}%`} sub={`${QP}: ${efQ2.toFixed(1).replace(".", ",")}% (${ppTxt(efQ3, efQ2)})`} good={efQ3 >= efQ2} color={C.ent} />
        <Kpi label="Tasa devolución" value={pct(tQ3.dev, tQ3.mov)} sub={`${QP}: ${pct(tQ2.dev, tQ2.mov)}`} good={ratio(tQ3.dev, tQ3.mov) <= ratio(tQ2.dev, tQ2.mov)} color={C.dev} />
        <Kpi label="Promedio diario" value={fmt(ratio(tQ3.ing, tQ3.diasMes))} sub={`ingresadas · ${QP} ${fmt(ratio(tQ2.ing, tQ2.diasMes))}`} good={ratio(tQ3.ing, tQ3.diasMes) >= ratio(tQ2.ing, tQ2.diasMes)} color={C.ing} />
      </div>

      {/* Conclusiones */}
      <Card title={`🧠 Lo más importante del ${QN}`} sub="Conclusiones calculadas con los datos del trimestre">
        <ul className="space-y-1.5">
          {insights.map((i, k) => (
            <li key={k} className="text-xs t-secondary flex gap-2">
              <span style={{ color: i.tone === "pos" ? "#10b981" : i.tone === "neg" ? "#ef4444" : "#3b82f6" }}>{i.tone === "pos" ? "▲" : i.tone === "neg" ? "▼" : "●"}</span>
              <span>{i.txt}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Cuadro comparativo */}
      <Card title={`📋 Cuadro comparativo — ${QP} vs ${QN} mes a mes`} sub={enCurso ? `Totales de cada trimestre resaltados. Con el ${QN} en curso, Δ compara contra el ${QP} proporcional a los mismos ${diasTrans} días (en tasas, diferencia en puntos porcentuales).` : `Totales de cada trimestre resaltados. Δ compara el total del ${QN} contra el del ${QP} (en tasas, diferencia en puntos porcentuales).`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[12px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th rowSpan={2} className="text-left align-bottom py-2 px-3 text-[11px] uppercase tracking-wider t-muted border-b-2 border-gray-600">Concepto</th>
                {colsQ.map((q) => (
                  <th key={q.titulo} colSpan={4} className="py-1.5 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-white rounded-t-lg" style={{ background: q.color, borderLeft: "3px solid transparent", backgroundClip: "padding-box" }}>{q.titulo}</th>
                ))}
                <th rowSpan={2} className="align-bottom py-2 px-3 text-center text-[11px] uppercase tracking-wider t-muted border-b-2 border-gray-600">Δ {QN} vs {QP}</th>
              </tr>
              <tr>
                {colsQ.flatMap((q, qi) => [
                  ...q.meses.map((m, mi) => (
                    <th key={m} className="py-1.5 px-3 text-right text-[11px] font-semibold t-secondary border-b-2 border-gray-600" style={mi === 0 && qi > 0 ? { borderLeft: "3px solid rgba(148,163,184,0.35)" } : undefined}>{CORTO[m]}</th>
                  )),
                  <th key={`t-${q.titulo}`} className="py-1.5 px-3 text-right text-[11px] font-bold border-b-2 border-gray-600" style={{ color: q.color, background: `${q.color}1f` }}>Total</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {gruposComp.map((g) => [
                <tr key={`g-${g.titulo}`}>
                  <td colSpan={2 + colsQ.length * 4} className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#f97316" }}>{g.titulo}</td>
                </tr>,
                ...g.filas.map((f, fi) => {
                  const d = f.delta?.(tQ3, tQ2);
                  return (
                    <tr key={f.label} style={{ background: fi % 2 ? "rgba(148,163,184,0.06)" : undefined }}>
                      <td className={`py-1.5 px-3 whitespace-nowrap ${f.tasa ? "t-secondary italic" : "t-primary font-medium"}`}>{f.label}</td>
                      {colsQ.flatMap((q, qi) => [
                        ...q.meses.map((m, mi) => (
                          <td key={m} className="py-1.5 px-3 text-right font-mono whitespace-nowrap t-secondary" style={{ ...(mi === 0 && qi > 0 ? { borderLeft: "3px solid rgba(148,163,184,0.35)" } : {}), color: f.color?.(met[m]) }}>{f.get(met[m])}</td>
                        )),
                        <td key={`t-${q.titulo}`} className="py-1.5 px-3 text-right font-mono font-bold whitespace-nowrap" style={{ background: `${q.color}1f`, color: f.color?.(q.total) }}>{f.get(q.total)}</td>,
                      ])}
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        {d && d.txt !== "—" && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold font-mono" style={{ background: d.good ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: d.good ? "#10b981" : "#ef4444" }}>{d.txt}</span>
                        )}
                      </td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
        {mesesConCierre.length > 0 && (
          <p className="text-[11px] mt-3" style={{ color: "#f59e0b" }}>
            * Movilizadas de {mesesConCierre.map((m) => LABEL[m].toLowerCase()).join(", ")}: cierre oficial cargado manualmente (reemplaza el cálculo desde las guías de Operaciones). Las tasas de entrega y devolución de esos meses se calculan sobre ese cierre.
          </p>
        )}
        <p className="text-[11px] t-muted mt-3">Cumplimiento de meta: verde ≥ 100% · amarillo ≥ 90% · rojo &lt; 90%. Tasa de entrega y devolución sobre guías movilizadas; efectividad sobre guías ya cerradas (entregadas + devueltas).</p>
      </Card>

      {/* Evolución mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`📈 Evolución mensual — ${LABEL[ALL[0]]} a ${LABEL[ALL[ALL.length - 1]]}`} sub={ALL.includes(mesHoy) ? `* ${LABEL[mesHoy]} en curso (parcial)` : undefined}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={evolucion}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="mes" fontSize={11} stroke="#888" />
              <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ingresadas" name="Ingresadas" fill={C.ing} radius={[3, 3, 0, 0]} />
              <Bar dataKey="movilizadas" name="Movilizadas" fill={C.mov} radius={[3, 3, 0, 0]} />
              <Bar dataKey="entregadas" name="Entregadas" fill={C.ent} radius={[3, 3, 0, 0]} />
              <Line dataKey="metaMov" name="Meta movilizadas" stroke={C.meta} strokeDasharray="5 4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card title="🚚 Tasa de entrega, devolución y movilización (%)" sub="Tasa de entrega = entregadas ÷ movilizadas · Efectividad = entregadas ÷ (entregadas + devueltas)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolucion.filter((x) => !x.mes.endsWith("*"))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="mes" fontSize={11} stroke="#888" />
              <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip {...tip} formatter={(v) => `${String(v).replace(".", ",")}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="tasaMov" name="% movilización" stroke={C.mov} strokeWidth={2} dot={{ r: 3 }} />
              <Line dataKey="tasaEnt" name="Tasa de entrega" stroke={C.ent} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line dataKey="efectividad" name="Efectividad cerrada" stroke="#22d3ee" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
              <Line dataKey="tasaDev" name="Tasa de devolución" stroke={C.dev} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tendencia diaria */}
      <Card title={`📅 Tendencia diaria del ${QN} — ingresadas y media móvil de 7 días`} sub={`Movilizadas y entregadas por día de orden (las últimas semanas de ${l(M_FIN)} todavía tienen guías en proceso)`}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={diario}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="fecha" fontSize={9} stroke="#888" interval={6} />
            <YAxis fontSize={10} stroke="#888" />
            <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="ing" name="Ingresadas" fill={C.ing} opacity={0.55} />
            <Line dataKey="mm7" name="Media móvil 7 días" stroke="#facc15" strokeWidth={2.5} dot={false} />
            <Line dataKey="mov" name="Movilizadas" stroke={C.mov} strokeWidth={1.5} dot={false} />
            <Line dataKey="ent" name="Entregadas" stroke={C.ent} strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`🗓️ Patrón por día de la semana (${QN})`} sub="Promedio de órdenes ingresadas según el día">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porDiaSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="dia" fontSize={11} stroke="#888" />
              <YAxis fontSize={10} stroke="#888" />
              <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="prom" name="Promedio ingresadas" radius={[4, 4, 0, 0]}>
                {porDiaSemana.map((d, i) => {
                  const max = Math.max(...porDiaSemana.map((x) => x.prom));
                  return <Cell key={i} fill={d.prom === max ? "#10b981" : C.ing} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Activación */}
        <Card title="⚡ Activación de dropshippers" sub="Dropshippers con al menos 1 orden en el mes (Análisis Operacional)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <Th left>Mes</Th><Th>Activos</Th><Th>Con movilizadas</Th><Th>Nuevos</Th><Th>Recurrentes</Th><Th>Perdidos</Th><Th>Hacen el 80%</Th><Th>Órdenes/DS</Th><Th>Proveedores</Th>
                </tr>
              </thead>
              <tbody>
                {activacion.filas.map((f) => (
                  <tr key={f.m} className="border-b border-gray-800/50">
                    <Td left bold>{LABEL[f.m]}</Td>
                    {f.hayDatos ? (
                      <>
                        <Td bold>{fmt(f.activos)}</Td><Td>{fmt(f.conMov)}</Td><Td color="#10b981">+{fmt(f.nuevos)}</Td><Td>{fmt(f.recurrentes)}</Td>
                        <Td color="#ef4444">−{fmt(f.perdidos)}</Td><Td>{fmt(f.pareto)}</Td><Td>{fmt(f.promPorDs)}</Td><Td>{fmt(f.prov)}</Td>
                      </>
                    ) : <td colSpan={8} className="py-1.5 px-2 text-xs t-muted">Sin archivo del Análisis Operacional cargado</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] t-muted mt-3">
            {fmt(activacion.unicos)} dropshippers distintos operaron en el {QN}{enCurso ? " (hasta hoy)" : ""}; {fmt(activacion.los3)} estuvieron activos los 3 meses.
            {" "}Nuevos = no tenían órdenes el mes anterior · Perdidos = tenían órdenes el mes anterior y este no.
          </p>
          <p className="text-[11px] mt-2" style={{ color: C.amber }}>
            ⚠ La activación de <b>usuarios registrados</b> (registro → primera orden) necesita el export de usuarios de {l(Q3[0])} a {l(Q3[2])}: subilo en Estrategia → Registrados para completarla.
          </p>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[{ t: `🏆 Top 10 dropshippers ${QN} (movilizadas)`, rows: topDs }, { t: `📦 Top 10 proveedores ${QN} (movilizadas)`, rows: topProv }].map((blk) => (
          <Card key={blk.t} title={blk.t} sub={enCurso ? "Tendencia disponible al cerrar el trimestre" : `Tendencia = ${l(Q3[2])} contra ${l(Q3[0])}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700"><Th left>#</Th><Th left>Nombre</Th><Th>{CORTO[Q3[0]]}</Th><Th>{CORTO[Q3[1]]}</Th><Th>{CORTO[Q3[2]]}</Th><Th>{QN}</Th><Th>Entrega</Th><Th>Tendencia</Th></tr>
                </thead>
                <tbody>
                  {blk.rows.map((r, i) => (
                    <tr key={r.nombre} className="border-b border-gray-800/50">
                      <Td left>{i + 1}</Td>
                      <td className="py-1.5 px-2 text-xs t-primary max-w-[180px] truncate" title={r.nombre}>{r.nombre}</td>
                      <Td>{fmt(r.m0)}</Td><Td>{fmt(r.m1)}</Td><Td>{fmt(r.m2)}</Td><Td bold>{fmt(r.mov)}</Td>
                      <Td>{pct(r.ent, r.mov, 0)}</Td>
                      <Td bold color={enCurso ? undefined : r.m2 >= r.m0 ? "#10b981" : "#ef4444"}>{enCurso ? "—" : r.m0 ? deltaTxt(r.m2, r.m0) : "nuevo"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={`🎯 Top 10 productos ${QN} (órdenes)`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-700"><Th left>#</Th><Th left>Producto</Th><Th left>Proveedor</Th><Th>{CORTO[Q3[0]]}</Th><Th>{CORTO[Q3[2]]}</Th><Th>{QN}</Th></tr></thead>
              <tbody>
                {topProd.map((p, i) => (
                  <tr key={p.nombre} className="border-b border-gray-800/50">
                    <Td left>{i + 1}</Td>
                    <td className="py-1.5 px-2 text-xs t-primary max-w-[220px] truncate" title={p.nombre}>{p.nombre}</td>
                    <td className="py-1.5 px-2 text-xs t-muted max-w-[120px] truncate" title={p.proveedor}>{cleanName(p.proveedor)}</td>
                    <Td>{fmt(p.m0)}</Td><Td color={enCurso ? undefined : p.m2 >= p.m0 ? "#10b981" : "#ef4444"}>{fmt(p.m2)}</Td><Td bold>{fmt(p.ordenes)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="🚚 Transportadoras — tasa de entrega por mes" sub="Misma regla que Operaciones → Por Logística: entregadas ÷ movilizadas (solo guías con fecha de orden del mes)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-700"><Th left>Transportadora</Th>{Q3.map((m) => <Th key={m}>{CORTO[m]}</Th>)}<Th>Movilizadas {QN}</Th><Th>Particip.</Th><Th>Entrega {QN}</Th><Th>Devol. {QN}</Th><Th>En proceso</Th></tr></thead>
              <tbody>
                {transp.map((t) => (
                  <tr key={t.nombre} className="border-b border-gray-800/50">
                    <Td left bold>{t.nombre}</Td>
                    {Q3.map((m) => <Td key={m}>{t.r[m] ? pct(t.r[m]!.ent, t.r[m]!.mov) : "—"}</Td>)}
                    <Td>{fmt(t.tot.mov)}</Td>
                    <Td>{pct(t.tot.mov, movTotalTransp, 0)}</Td>
                    <Td bold color="#10b981">{pct(t.tot.ent, t.tot.mov)}</Td>
                    <Td color="#ef4444">{pct(t.tot.dev, t.tot.mov)}</Td>
                    <Td>{pct(t.tot.proc, t.tot.mov)}</Td>
                  </tr>
                ))}
                {transp.length > 0 && (
                  <tr style={{ background: "rgba(249,115,22,0.08)" }}>
                    <Td left bold>Total</Td>
                    {Q3.map((m) => {
                      const mm = transp.reduce((a, t) => ({ mov: a.mov + (t.r[m]?.mov ?? 0), ent: a.ent + (t.r[m]?.ent ?? 0) }), { mov: 0, ent: 0 });
                      return <Td key={m} bold>{pct(mm.ent, mm.mov)}</Td>;
                    })}
                    <Td bold>{fmt(movTotalTransp)}</Td>
                    <Td bold>100%</Td>
                    <Td bold>{pct(transp.reduce((a, t) => a + t.tot.ent, 0), movTotalTransp)}</Td>
                    <Td bold>{pct(transp.reduce((a, t) => a + t.tot.dev, 0), movTotalTransp)}</Td>
                    <Td bold>{pct(transp.reduce((a, t) => a + t.tot.proc, 0), movTotalTransp)}</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {transp.length === 0 && <p className="text-xs t-muted">Sin datos de Operaciones para el {QN}.</p>}
        </Card>
      </div>

      {/* Avance del mes en curso / preparación del siguiente trimestre */}
      <div data-pdf-section className="rounded-2xl p-5 border-2" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(59,130,246,0.08))", borderColor: "rgba(16,185,129,0.4)" }}>
        <h3 className="text-base font-bold t-primary mb-1">{enCurso ? `🚀 Avance de ${LABEL[MES_AVANCE]} y del ${QN}` : `🚀 Preparando el ${QS} — base para planificar`}</h3>
        <p className="text-[11px] t-muted mb-4">{enCurso ? `${LABEL[MES_AVANCE]} en curso contra su meta, proyección del trimestre y metas de cada mes.` : `${LABEL[MES_AVANCE]} en curso contra su meta, y la base que deja el ${QN} para fijar los meses siguientes.`}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <Kpi label={`${LABEL[MES_AVANCE]} al día ${q4.ultimoDia}`} value={fmt(q4.oct.ing)} sub={`ingresadas · ${fmt(q4.promOct)}/día (${enCurso ? QP : QN}: ${fmt(q4.promQ3)}/día)`} good={q4.promOct >= q4.promQ3} color={C.ing} />
          <Kpi label={`Proyección ${l(MES_AVANCE)}`} value={fmt(q4.proyIng)} sub={q4.oct.metaIng ? `ingresadas · ${pct(q4.proyIng, q4.oct.metaIng, 0)} de la meta ${fmt(q4.oct.metaIng)}` : "ingresadas al ritmo actual"} good={q4.oct.metaIng ? q4.proyIng >= q4.oct.metaIng : null} color={C.ing} />
          <Kpi label="Movilizadas proyectadas" value={fmt(q4.proyMov)} sub={q4.oct.metaMov ? `meta ${fmt(q4.oct.metaMov)} · con la tasa de mov. del ${enCurso ? QP : QN} (${(q4.tasaMovQ3 * 100).toFixed(1).replace(".", ",")}%)` : ""} good={q4.oct.metaMov ? q4.proyMov >= q4.oct.metaMov : null} color={C.mov} />
          <Kpi label="Necesario por día" value={fmt(q4.necesarioDiaIng)} sub={`ingresadas en los ${q4.restantes} días que quedan para llegar a la meta`} good={q4.necesarioDiaIng <= q4.promOct} color={C.meta} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-700"><Th left>Mes {enCurso ? QN : QS}</Th><Th>Meta movilizadas</Th><Th>Meta ingresadas</Th><Th>vs promedio {enCurso ? QP : QN}</Th><Th left>Estado</Th></tr></thead>
            <tbody>
              {MESES_PLAN.map((m) => {
                const mm = met[m];
                const promQ3Mov = (enCurso ? tQ2full.mov : tQ3.mov) / 3;
                return (
                  <tr key={m} className="border-b border-gray-800/50">
                    <Td left bold>{LABEL[m]}</Td>
                    <Td>{mm.metaMov ? fmt(mm.metaMov) : "—"}</Td>
                    <Td>{mm.metaIng ? fmt(mm.metaIng) : "—"}</Td>
                    <Td>{mm.metaMov ? deltaTxt(mm.metaMov, promQ3Mov) : "—"}</Td>
                    <td className="py-1.5 px-2 text-xs t-muted">{m === MES_AVANCE ? `En curso: ${fmt(mm.mov)} movilizadas al día ${q4.ultimoDia} (${pct(mm.mov, mm.metaMov, 0)} de la meta)` : enCurso && NUM[m] < NUM[mesHoy] ? `Cerrado: ${fmt(mm.mov)} movilizadas (${pct(mm.mov, mm.metaMov, 0)} de la meta)` : mm.metaMov ? "Meta cargada" : `Sin meta · base sugerida ${fmt(q4.baseMensualQ4)} movilizadas`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!enCurso ? (
          <p className="text-[11px] t-muted mt-3">
            Base sugerida = promedio mensual de movilizadas del {QN} ({fmt(tQ3.mov / 3)}) ajustado por el crecimiento {QN} vs {QP} ({q4.crecQ3vsQ2 >= 0 ? "+" : ""}{q4.crecQ3vsQ2.toFixed(1).replace(".", ",")}% trimestral). Es un punto de partida para definir las metas de los meses siguientes.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
            <Kpi label={`Proyección de cierre del ${QN}`} value={fmt(q4.proyTrimMov)} sub={tQ3.metaMov ? `movilizadas · ${pct(q4.proyTrimMov, tQ3.metaMov, 0)} de la meta ${fmt(tQ3.metaMov)}` : "movilizadas al ritmo actual"} good={tQ3.metaMov ? q4.proyTrimMov >= tQ3.metaMov : null} color={C.mov} />
            <Kpi label={`Necesario por día (resto del ${QN})`} value={fmt(q4.necesarioDiaMovTrim)} sub={`movilizadas en los ${q4.diasRestTrim} días que quedan · hoy ${fmt(q4.promMovDia)}/día`} good={q4.necesarioDiaMovTrim <= q4.promMovDia} color={C.meta} />
            <Kpi label={`Avance del ${QN}`} value={pct(tQ3.mov, tQ3.metaMov, 0)} sub={`de la meta · calendario ${pct(diasTrans, diasTotalesTrim, 0)} transcurrido`} good={ratio(tQ3.mov, tQ3.metaMov) >= ratio(diasTrans, diasTotalesTrim)} color={C.ent} />
          </div>
        )}
      </div>
    </div>
  );
}
