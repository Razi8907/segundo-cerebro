"use client";

// ═══════════════════════════════════════════════════════════════════
// RESUMEN Q3 2026 (Jul–Sep) — centraliza todo el trimestre y prepara Q4.
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
const Q2: Mes[] = ["abril", "mayo", "junio"];
const Q3: Mes[] = ["julio", "agosto", "septiembre"];
const Q4: Mes[] = ["octubre", "noviembre", "diciembre"];
const ALL: Mes[] = [...Q2, ...Q3, "octubre"];
const SNAP_MESES: Mes[] = ["junio", ...Q3, "octubre"];
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
export default function Q3Resumen({ country }: { country: "ar" | "py" }) {
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
        titulo: "Resumen Q3 2026",
        periodo: "Julio – Septiembre 2026 (con avance de Octubre)",
        archivo: `Q3-2026-${country === "ar" ? "Argentina" : "Paraguay"}`,
      });
    } catch (e) {
      console.error("PDF Q3:", e);
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
          fetch(`/api/data/${country}`).then((r) => r.json()).catch(() => null),
          ...SNAP_MESES.map((m) => fetch(`/api/data/operational?country=${country}&mes=${m}`).then((r) => r.json()).catch(() => null)),
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
  }, [country]);

  // ─── Métricas por mes ───
  const met = useMemo(() => {
    const out = {} as Record<Mes, Met>;
    for (const m of [...ALL, "noviembre", "diciembre"] as Mes[]) {
      const ds = dias[m] ?? [];
      const s = (k: keyof Dia) => ds.reduce((a, x) => a + (x[k] || 0), 0);
      out[m] = {
        ing: s("ingresadas"), mov: s("movilizadas"), ent: s("entregadas"), dev: s("devueltas"), proc: s("en_proceso"), canc: s("canceladas"),
        diasConDatos: ds.filter((x) => x.ingresadas > 0).length, diasMes: DIAS_MES(m),
        metaMov: Number(meta[`meta_movilizadas_${m}`]) || 0, metaIng: Number(meta[`meta_ingresadas_${m}`]) || 0,
      };
    }
    return out;
  }, [dias, meta]);
  const tQ2 = useMemo(() => sumMet(Q2.map((m) => met[m])), [met]);
  const tQ3 = useMemo(() => sumMet(Q3.map((m) => met[m])), [met]);

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
  }, [dias]);

  // ─── Patrón por día de semana (Q3) ───
  const porDiaSemana = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ ing: 0, n: 0 }));
    for (const m of Q3) for (const x of dias[m] ?? []) {
      if (!x.ingresadas) continue;
      const dow = new Date(2026, NUM[m] - 1, x.dia).getDay();
      acc[dow].ing += x.ingresadas; acc[dow].n++;
    }
    const orden = [1, 2, 3, 4, 5, 6, 0];
    return orden.map((i) => ({ dia: DIAS_SEMANA[i].slice(0, 3), nombre: DIAS_SEMANA[i], prom: acc[i].n ? Math.round(acc[i].ing / acc[i].n) : 0 }));
  }, [dias]);

  // ─── Activación de dropshippers y proveedores (desde snapshots) ───
  const activacion = useMemo(() => {
    const setDe = (m: Mes, k: "by_dropshipper" | "by_proveedor") => {
      const map = new Map<string, number>();
      for (const r of snaps[m]?.[k] ?? []) if ((r.total || 0) > 0) map.set(normName(r.nombre), (map.get(normName(r.nombre)) ?? 0) + r.total);
      return map;
    };
    const filas = Q3.map((m) => {
      const prev = m === "julio" ? "junio" : m === "agosto" ? "julio" : "agosto";
      const cur = setDe(m, "by_dropshipper"), ant = setDe(prev as Mes, "by_dropshipper");
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
    const los3 = [...setDe("julio", "by_dropshipper").keys()].filter((k) => setDe("agosto", "by_dropshipper").has(k) && setDe("septiembre", "by_dropshipper").has(k)).length;
    return { filas, unicos: unicos.size, los3 };
  }, [snaps]);

  // ─── Rankings Q3 con tendencia mes a mes ───
  const ranking = (k: "by_dropshipper" | "by_proveedor") => {
    const map = new Map<string, { nombre: string; jul: number; ago: number; sep: number; mov: number; ent: number; dev: number }>();
    const key: Record<string, "jul" | "ago" | "sep"> = { julio: "jul", agosto: "ago", septiembre: "sep" };
    for (const m of Q3) for (const r of snaps[m]?.[k] ?? []) {
      const id = normName(r.nombre);
      const cur = map.get(id) ?? { nombre: cleanName(r.nombre), jul: 0, ago: 0, sep: 0, mov: 0, ent: 0, dev: 0 };
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
    const map = new Map<string, { nombre: string; proveedor: string; ordenes: number; jul: number; sep: number }>();
    for (const m of Q3) for (const r of snaps[m]?.by_producto ?? []) {
      const cur = map.get(r.nombre) ?? { nombre: r.nombre, proveedor: r.proveedor || "", ordenes: 0, jul: 0, sep: 0 };
      cur.ordenes += r.ordenes || 0;
      if (m === "julio") cur.jul += r.ordenes || 0;
      if (m === "septiembre") cur.sep += r.ordenes || 0;
      map.set(r.nombre, cur);
    }
    return [...map.values()].sort((a, b) => b.ordenes - a.ordenes).slice(0, 10);
  }, [snaps]);

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
  }, [transpData]);
  const movTotalTransp = transp.reduce((a, t) => a + t.tot.mov, 0);

  // ─── Preparación Q4 ───
  const q4 = useMemo(() => {
    const oct = met.octubre;
    const diasOct = (dias.octubre ?? []).filter((d) => d.ingresadas > 0).map((d) => d.dia);
    const ultimoDia = diasOct.length ? Math.max(...diasOct) : 0;
    const restantes = Math.max(DIAS_MES("octubre") - ultimoDia, 0);
    const promOct = ultimoDia ? oct.ing / ultimoDia : 0;
    const proyIng = Math.round(promOct * DIAS_MES("octubre"));
    const tasaMovQ3 = ratio(tQ3.mov, tQ3.ing);
    const proyMov = Math.round(proyIng * tasaMovQ3);
    const necesarioDiaIng = restantes > 0 ? Math.max(oct.metaIng - oct.ing, 0) / restantes : 0;
    const promQ3 = tQ3.diasMes ? tQ3.ing / tQ3.diasMes : 0;
    const crecQ3vsQ2 = delta(tQ3.ing, tQ2.ing);
    const baseMensualQ4 = Math.round((tQ3.mov / 3) * (1 + crecQ3vsQ2 / 100 / 3));
    return { oct, ultimoDia, restantes, promOct, proyIng, proyMov, necesarioDiaIng, promQ3, crecQ3vsQ2, baseMensualQ4, tasaMovQ3 };
  }, [met, dias, tQ2, tQ3]);

  // ─── Conclusiones automáticas ───
  const insights = useMemo(() => {
    const out: { tone: "pos" | "neg" | "info"; txt: string }[] = [];
    const mejor = [...Q3].sort((a, b) => met[b].mov - met[a].mov)[0];
    out.push({ tone: "info", txt: `Mejor mes del Q3 en movilizadas: ${LABEL[mejor]} (${fmt(met[mejor].mov)}).` });
    out.push({ tone: tQ3.mov >= tQ2.mov ? "pos" : "neg", txt: `Q3 movilizó ${fmt(tQ3.mov)} guías, ${deltaTxt(tQ3.mov, tQ2.mov)} contra Q2 (${fmt(tQ2.mov)}).` });
    if (tQ3.metaMov > 0) out.push({ tone: tQ3.mov >= tQ3.metaMov ? "pos" : "neg", txt: `Cumplimiento de meta Q3: ${pct(tQ3.mov, tQ3.metaMov)} (${fmt(tQ3.mov)} de ${fmt(tQ3.metaMov)} movilizadas).` });
    const teJul = ratio(met.julio.ent, met.julio.ent + met.julio.dev) * 100, teSep = ratio(met.septiembre.ent, met.septiembre.ent + met.septiembre.dev) * 100;
    if (teJul && teSep) out.push({ tone: teSep >= teJul ? "pos" : "neg", txt: `Efectividad de entrega (entregadas ÷ entregadas+devueltas): julio ${teJul.toFixed(1).replace(".", ",")}% → septiembre ${teSep.toFixed(1).replace(".", ",")}% (${ppTxt(teSep, teJul)}).` });
    const pico = [...porDiaSemana].sort((a, b) => b.prom - a.prom)[0], valle = [...porDiaSemana].sort((a, b) => a.prom - b.prom)[0];
    if (pico?.prom) out.push({ tone: "info", txt: `Día más fuerte: ${pico.nombre} (${fmt(pico.prom)} ingresadas promedio). Más flojo: ${valle.nombre} (${fmt(valle.prom)}). Planificar campañas y stock según este patrón.` });
    const a = activacion.filas;
    if (a[0]?.hayDatos && a[2]?.hayDatos) out.push({ tone: a[2].activos >= a[0].activos ? "pos" : "neg", txt: `Dropshippers activos: julio ${fmt(a[0].activos)} → septiembre ${fmt(a[2].activos)}. En el trimestre se perdieron ${fmt(a.reduce((s, x) => s + x.perdidos, 0))} y entraron ${fmt(a.reduce((s, x) => s + x.nuevos, 0))} nuevos.` });
    const conVol = transp.filter((t) => t.tot.mov > 300);
    const peor = [...conVol].sort((x, y) => ratio(x.tot.ent, x.tot.mov) - ratio(y.tot.ent, y.tot.mov))[0];
    const mejorT = [...conVol].sort((x, y) => ratio(y.tot.ent, y.tot.mov) - ratio(x.tot.ent, x.tot.mov))[0];
    if (peor && mejorT && peor !== mejorT) out.push({ tone: "info", txt: `Transportadoras (tasa de entrega sobre movilizadas): mejor ${mejorT.nombre} (${pct(mejorT.tot.ent, mejorT.tot.mov)}), más baja ${peor.nombre} (${pct(peor.tot.ent, peor.tot.mov)}).` });
    return out;
  }, [met, tQ2, tQ3, porDiaSemana, activacion, transp]);

  // ─── Lectura del Q3: resumen ejecutivo redactado con los datos ───
  const lectura = useMemo(() => {
    const pais = country === "ar" ? "Argentina" : "Paraguay";
    const p1 = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");
    const sube = (a: number, b: number) => (a >= b ? "subió" : "bajó");
    const parrafos: string[] = [];
    const prioridades: string[] = [];

    // 1. Volumen y meta
    const mejor = [...Q3].sort((a, b) => met[b].mov - met[a].mov)[0];
    const cumpl = ratio(tQ3.mov, tQ3.metaMov);
    const tendMes = delta(met.septiembre.mov, met.julio.mov);
    parrafos.push(
      `En el Q3 2026 ${pais} movilizó ${fmt(tQ3.mov)} guías sobre ${fmt(tQ3.ing)} órdenes ingresadas, ${deltaTxt(tQ3.mov, tQ2.mov)} contra el Q2 (${fmt(tQ2.mov)} movilizadas)` +
      (tQ3.metaMov ? `, con un cumplimiento de meta del ${p1(tQ3.mov, tQ3.metaMov)} (${tQ3.mov >= tQ3.metaMov ? `${fmt(tQ3.mov - tQ3.metaMov)} guías por encima` : `faltaron ${fmt(tQ3.metaMov - tQ3.mov)} guías`} de las ${fmt(tQ3.metaMov)} planificadas)` : "") +
      `. El trimestre fue ${tendMes >= 3 ? "de crecimiento sostenido" : tendMes <= -3 ? "de caída progresiva" : "estable"} mes a mes: julio ${fmt(met.julio.mov)}, agosto ${fmt(met.agosto.mov)} y septiembre ${fmt(met.septiembre.mov)} movilizadas (${deltaTxt(met.septiembre.mov, met.julio.mov)} de julio a septiembre); el mejor mes fue ${LABEL[mejor].toLowerCase()}. ` +
      `El promedio diario de ingresadas fue ${fmt(ratio(tQ3.ing, tQ3.diasMes))}, contra ${fmt(ratio(tQ2.ing, tQ2.diasMes))} en el Q2.`,
    );
    if (tQ3.metaMov && cumpl < 1) prioridades.push(`Recuperar el ritmo: el Q3 cerró en ${p1(tQ3.mov, tQ3.metaMov)} de la meta; el Q4 necesita sostener al menos ${fmt(ratio(tQ3.metaMov, 3))} movilizadas por mes para no repetir la brecha.`);

    // 2. Conversión y calidad de entrega
    const movQ3 = ratio(tQ3.mov, tQ3.ing) * 100, movQ2 = ratio(tQ2.mov, tQ2.ing) * 100;
    const teQ3 = ratio(tQ3.ent, tQ3.mov) * 100, teQ2 = ratio(tQ2.ent, tQ2.mov) * 100;
    const efQ3l = ratio(tQ3.ent, tQ3.ent + tQ3.dev) * 100, efQ2l = ratio(tQ2.ent, tQ2.ent + tQ2.dev) * 100;
    const teJul = ratio(met.julio.ent, met.julio.mov) * 100, teSep = ratio(met.septiembre.ent, met.septiembre.mov) * 100;
    parrafos.push(
      `La conversión de órdenes a guías movilizadas fue del ${p1(tQ3.mov, tQ3.ing)} (${ppTxt(movQ3, movQ2)} vs Q2). ` +
      `La tasa de entrega sobre movilizadas fue ${p1(tQ3.ent, tQ3.mov)} y la efectividad sobre guías cerradas ${efQ3l.toFixed(1).replace(".", ",")}%, ` +
      `${efQ3l >= efQ2l ? "una mejora" : "un retroceso"} de ${Math.abs(efQ3l - efQ2l).toFixed(1).replace(".", ",")} puntos frente al Q2; la devolución ${sube(ratio(tQ3.dev, tQ3.mov), ratio(tQ2.dev, tQ2.mov))} a ${p1(tQ3.dev, tQ3.mov)} (Q2: ${p1(tQ2.dev, tQ2.mov)}). ` +
      `Dentro del trimestre la entrega ${teSep >= teJul ? "mejoró" : "se deterioró"} de ${teJul.toFixed(1).replace(".", ",")}% en julio a ${teSep.toFixed(1).replace(".", ",")}% en septiembre` +
      (met.septiembre.proc > 0 ? ` (septiembre todavía tiene ${fmt(met.septiembre.proc)} guías en proceso, por lo que su tasa final puede subir).` : "."),
    );
    if (teQ3 < teQ2 || teSep < teJul - 2) prioridades.push(`Calidad de entrega: la tasa cayó ${teSep < teJul ? `${(teJul - teSep).toFixed(1).replace(".", ",")} puntos entre julio y septiembre` : `frente al Q2`}. Revisar novedades, confirmación de pedidos y devoluciones por zona antes de escalar volumen.`);

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
    if (a[0]?.hayDatos && a[2]?.hayDatos) {
      const nuevos = a.reduce((s, x) => s + x.nuevos, 0), perdidos = a.reduce((s, x) => s + x.perdidos, 0);
      let dsTot = 0;
      for (const m of Q3) for (const r of snaps[m]?.by_dropshipper ?? []) dsTot += movOf(r.estados || {});
      const top10 = topDs.reduce((s, r) => s + r.mov, 0);
      parrafos.push(
        `La base activa pasó de ${fmt(a[0].activos)} dropshippers con órdenes en julio a ${fmt(a[2].activos)} en septiembre (${fmt(activacion.unicos)} distintos en el trimestre, ${fmt(activacion.los3)} activos los tres meses). ` +
        `Entraron ${fmt(nuevos)} nuevos y se perdieron ${fmt(perdidos)}, un saldo ${nuevos >= perdidos ? "positivo" : "negativo"} de ${fmt(Math.abs(nuevos - perdidos))}. ` +
        `El negocio está concentrado: en septiembre ${fmt(a[2].pareto)} dropshippers generaron el 80% de las órdenes` +
        (dsTot ? ` y el top 10 explica el ${p1(top10, dsTot)} de las movilizadas del trimestre` : "") +
        (topDs[0] ? `, liderado por ${topDs[0].nombre} (${fmt(topDs[0].mov)}).` : "."),
      );
      if (perdidos > nuevos) prioridades.push(`Retención: se perdieron más dropshippers (${fmt(perdidos)}) de los que entraron (${fmt(nuevos)}). Armar un plan de reactivación con la lista de "perdidos" y seguimiento semanal del top 20.`);
      if (dsTot && ratio(top10, dsTot) > 0.4) prioridades.push(`Dependencia: el top 10 concentra ${p1(top10, dsTot)} del volumen. Cuidar a esas cuentas (stock, tiempos, atención) y desarrollar la segunda línea para bajar el riesgo.`);
    }

    // 5. Proveedores y productos
    if (topProv[0] || topProd[0]) {
      const caen = topProv.filter((r) => r.jul > 0 && r.sep < r.jul * 0.8).map((r) => r.nombre);
      parrafos.push(
        (topProv[0] ? `Entre los proveedores lideró ${topProv[0].nombre} (${fmt(topProv[0].mov)} movilizadas)${topProv[1] ? `, seguido por ${topProv[1].nombre} y ${topProv[2]?.nombre ?? "—"}` : ""}. ` : "") +
        (caen.length ? `Dentro del top 10, ${caen.slice(0, 3).join(", ")} ${caen.length === 1 ? "cayó" : "cayeron"} más de 20% de julio a septiembre. ` : "") +
        (topProd[0] ? `El producto más pedido fue "${topProd[0].nombre}" con ${fmt(topProd[0].ordenes)} órdenes en el trimestre.` : ""),
      );
      if (caen.length) prioridades.push(`Proveedores en baja: revisar stock, precio y calidad con ${caen.slice(0, 3).join(", ")} antes de las campañas de fin de año.`);
    }

    // 6. Arranque del Q4
    const pico = [...porDiaSemana].sort((x, y) => y.prom - x.prom)[0];
    parrafos.push(
      `Para el Q4: octubre lleva ${fmt(q4.oct.ing)} ingresadas al día ${q4.ultimoDia} (${fmt(q4.promOct)} por día, ${q4.promOct >= q4.promQ3 ? "por encima" : "por debajo"} del promedio del Q3 de ${fmt(q4.promQ3)}). ` +
      `Al ritmo actual cerraría en ~${fmt(q4.proyIng)} ingresadas y ~${fmt(q4.proyMov)} movilizadas` +
      (q4.oct.metaMov ? `, ${q4.proyMov >= q4.oct.metaMov ? "superando" : "por debajo de"} la meta de ${fmt(q4.oct.metaMov)} movilizadas` : "") +
      (q4.restantes > 0 && q4.oct.metaIng ? `; para llegar a la meta de ingresadas hacen falta ${fmt(q4.necesarioDiaIng)} por día en los ${q4.restantes} días que quedan.` : ".") +
      (pico?.prom ? ` ${pico.nombre} es el día de mayor demanda: conviene concentrar ahí campañas y reposición.` : ""),
    );
    if (q4.oct.metaMov && q4.proyMov < q4.oct.metaMov) prioridades.push(`Octubre: la proyección (${fmt(q4.proyMov)}) no alcanza la meta (${fmt(q4.oct.metaMov)}). Activar acciones comerciales con el top de dropshippers y proveedores en esta quincena.`);
    if (!met.noviembre.metaMov) prioridades.push(`Definir metas de noviembre y diciembre: la base sugerida por la tendencia del Q3 es ~${fmt(q4.baseMensualQ4)} movilizadas por mes.`);

    return { parrafos, prioridades };
  }, [country, met, tQ2, tQ3, transp, activacion, snaps, topDs, topProv, topProd, porDiaSemana, q4]);

  if (loading) return <div className="glass-card p-6 t-muted text-sm">Cargando resumen Q3… (calcula julio a octubre con los datos de Operaciones)</div>;
  if (err) return <div className="glass-card p-6 text-sm text-red-400">No se pudo cargar el resumen Q3: {err}</div>;

  const evolucion = ALL.map((m) => ({
    mes: m === "octubre" ? `${CORTO[m]}*` : CORTO[m], ingresadas: met[m].ing, movilizadas: met[m].mov, entregadas: met[m].ent, devueltas: met[m].dev, metaMov: met[m].metaMov || null,
    tasaEnt: +(ratio(met[m].ent, met[m].mov) * 100).toFixed(1), tasaDev: +(ratio(met[m].dev, met[m].mov) * 100).toFixed(1),
    efectividad: +(ratio(met[m].ent, met[m].ent + met[m].dev) * 100).toFixed(1), tasaMov: +(ratio(met[m].mov, met[m].ing) * 100).toFixed(1),
  }));

  // Cuadro comparativo: columnas agrupadas por trimestre y filas agrupadas por tema
  type Fila = { label: string; get: (x: Met) => string; delta?: (a: Met, b: Met) => { txt: string; good: boolean }; tasa?: boolean; color?: (x: Met) => string | undefined };
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
    { titulo: "Q2 · Abr – Jun", meses: Q2, total: tQ2, color: "#64748b" },
    { titulo: "Q3 · Jul – Sep", meses: Q3, total: tQ3, color: "#f97316" },
  ];

  const efQ3 = ratio(tQ3.ent, tQ3.ent + tQ3.dev) * 100, efQ2 = ratio(tQ2.ent, tQ2.ent + tQ2.dev) * 100;

  return (
    <div className="space-y-4" ref={rootRef}>
      {/* Encabezado */}
      <div className="rounded-xl p-5 border-2 border-orange-500/40" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(6,182,212,0.05))" }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-bold t-primary">📊 Resumen Q3 2026 — {country === "ar" ? "Argentina" : "Paraguay"}</h2>
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
          Julio + Agosto + Septiembre, comparado con Q2 y con el arranque de Q4. Mismas reglas que Operaciones: ingresadas del Seguimiento Diario, movilizadas/entregadas/devueltas del último archivo de cada mes (solo guías con fecha de orden del mes).
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

      {/* Lectura del Q3 */}
      <Card title={`📝 Lectura del Q3 — ${country === "ar" ? "Argentina" : "Paraguay"}`} sub="Resumen ejecutivo redactado con los datos del trimestre (se actualiza solo con cada carga)">
        <div className="space-y-2.5">
          {lectura.parrafos.map((t, i) => (
            <p key={i} className="text-[13px] leading-relaxed t-secondary">{t}</p>
          ))}
        </div>
        {lectura.prioridades.length > 0 && (
          <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(249,115,22,0.07)", borderLeft: "4px solid #f97316" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#f97316" }}>Prioridades para el Q4</p>
            <ol className="space-y-1.5 list-decimal pl-5">
              {lectura.prioridades.map((t, i) => <li key={i} className="text-[12.5px] leading-relaxed t-secondary">{t}</li>)}
            </ol>
          </div>
        )}
      </Card>

      {/* Meta Q3 */}
      <div data-pdf-section className="rounded-2xl p-5 border-2" style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.10), rgba(249,115,22,0.08))", borderColor: "rgba(167,139,250,0.4)" }}>
        <h3 className="text-base font-bold t-primary mb-3">🎯 Meta Q3 — cumplimiento trimestral</h3>
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
              <p className="text-[11px] mt-1" style={{ color: x.real >= x.meta ? "#10b981" : "#f59e0b" }}>{pct(x.real, x.meta)} de la meta{x.meta ? ` · ${x.real >= x.meta ? "superada por" : "faltaron"} ${fmt(Math.abs(x.real - x.meta))}` : ""}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {Q3.map((m) => (
            <div key={m} className="rounded-lg p-2 text-center" style={{ background: "rgba(148,163,184,0.08)" }}>
              <div className="text-[11px] t-muted">{LABEL[m]}</div>
              <div className="font-mono text-sm font-bold t-primary">{fmt(met[m].mov)}</div>
              <div className="text-[10px]" style={{ color: met[m].mov >= met[m].metaMov ? "#10b981" : "#f59e0b" }}>{pct(met[m].mov, met[m].metaMov, 0)} de {fmt(met[m].metaMov)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs Q3 vs Q2 */}
      <div data-pdf-section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <Kpi label="Ingresadas Q3" value={fmt(tQ3.ing)} sub={`${deltaTxt(tQ3.ing, tQ2.ing)} vs Q2`} good={tQ3.ing >= tQ2.ing} color={C.ing} />
        <Kpi label="Movilizadas Q3" value={fmt(tQ3.mov)} sub={`${deltaTxt(tQ3.mov, tQ2.mov)} vs Q2`} good={tQ3.mov >= tQ2.mov} color={C.mov} />
        <Kpi label="% movilización" value={pct(tQ3.mov, tQ3.ing)} sub={`Q2: ${pct(tQ2.mov, tQ2.ing)}`} good={ratio(tQ3.mov, tQ3.ing) >= ratio(tQ2.mov, tQ2.ing)} color={C.mov} />
        <Kpi label="Entregadas Q3" value={fmt(tQ3.ent)} sub={`${deltaTxt(tQ3.ent, tQ2.ent)} vs Q2`} good={tQ3.ent >= tQ2.ent} color={C.ent} />
        <Kpi label="Tasa de entrega" value={pct(tQ3.ent, tQ3.mov)} sub={`Q2: ${pct(tQ2.ent, tQ2.mov)}`} good={ratio(tQ3.ent, tQ3.mov) >= ratio(tQ2.ent, tQ2.mov)} color={C.ent} />
        <Kpi label="Efectividad cerrada" value={`${efQ3.toFixed(1).replace(".", ",")}%`} sub={`Q2: ${efQ2.toFixed(1).replace(".", ",")}% (${ppTxt(efQ3, efQ2)})`} good={efQ3 >= efQ2} color={C.ent} />
        <Kpi label="Tasa devolución" value={pct(tQ3.dev, tQ3.mov)} sub={`Q2: ${pct(tQ2.dev, tQ2.mov)}`} good={ratio(tQ3.dev, tQ3.mov) <= ratio(tQ2.dev, tQ2.mov)} color={C.dev} />
        <Kpi label="Promedio diario" value={fmt(ratio(tQ3.ing, tQ3.diasMes))} sub={`ingresadas · Q2 ${fmt(ratio(tQ2.ing, tQ2.diasMes))}`} good={ratio(tQ3.ing, tQ3.diasMes) >= ratio(tQ2.ing, tQ2.diasMes)} color={C.ing} />
      </div>

      {/* Conclusiones */}
      <Card title="🧠 Lo más importante del Q3" sub="Conclusiones calculadas con los datos del trimestre">
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
      <Card title="📋 Cuadro comparativo — Q2 vs Q3 mes a mes" sub="Totales de cada trimestre resaltados. Δ compara el total del Q3 contra el del Q2 (en tasas, diferencia en puntos porcentuales).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[12px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th rowSpan={2} className="text-left align-bottom py-2 px-3 text-[11px] uppercase tracking-wider t-muted border-b-2 border-gray-600">Concepto</th>
                {colsQ.map((q) => (
                  <th key={q.titulo} colSpan={4} className="py-1.5 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-white rounded-t-lg" style={{ background: q.color, borderLeft: "3px solid transparent", backgroundClip: "padding-box" }}>{q.titulo}</th>
                ))}
                <th rowSpan={2} className="align-bottom py-2 px-3 text-center text-[11px] uppercase tracking-wider t-muted border-b-2 border-gray-600">Δ Q3 vs Q2</th>
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
        <p className="text-[11px] t-muted mt-3">Cumplimiento de meta: verde ≥ 100% · amarillo ≥ 90% · rojo &lt; 90%. Tasa de entrega y devolución sobre guías movilizadas; efectividad sobre guías ya cerradas (entregadas + devueltas).</p>
      </Card>

      {/* Evolución mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="📈 Evolución mensual — Abril a Octubre" sub="* Octubre en curso (parcial)">
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
      <Card title="📅 Tendencia diaria del Q3 — ingresadas y media móvil de 7 días" sub="Movilizadas y entregadas por día de orden (las últimas semanas de septiembre todavía tienen guías en proceso)">
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
        <Card title="🗓️ Patrón por día de la semana (Q3)" sub="Promedio de órdenes ingresadas según el día">
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
            {fmt(activacion.unicos)} dropshippers distintos operaron en el Q3; {fmt(activacion.los3)} estuvieron activos los 3 meses.
            {" "}Nuevos = no tenían órdenes el mes anterior · Perdidos = tenían órdenes el mes anterior y este no.
          </p>
          <p className="text-[11px] mt-2" style={{ color: C.amber }}>
            ⚠ La activación de <b>usuarios registrados</b> (registro → primera orden) necesita el export de usuarios de julio a septiembre: subilo en Estrategia → Registrados para completarla.
          </p>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[{ t: "🏆 Top 10 dropshippers Q3 (movilizadas)", rows: topDs }, { t: "📦 Top 10 proveedores Q3 (movilizadas)", rows: topProv }].map((blk) => (
          <Card key={blk.t} title={blk.t} sub="Tendencia = septiembre contra julio">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700"><Th left>#</Th><Th left>Nombre</Th><Th>Jul</Th><Th>Ago</Th><Th>Sep</Th><Th>Q3</Th><Th>Entrega</Th><Th>Tendencia</Th></tr>
                </thead>
                <tbody>
                  {blk.rows.map((r, i) => (
                    <tr key={r.nombre} className="border-b border-gray-800/50">
                      <Td left>{i + 1}</Td>
                      <td className="py-1.5 px-2 text-xs t-primary max-w-[180px] truncate" title={r.nombre}>{r.nombre}</td>
                      <Td>{fmt(r.jul)}</Td><Td>{fmt(r.ago)}</Td><Td>{fmt(r.sep)}</Td><Td bold>{fmt(r.mov)}</Td>
                      <Td>{pct(r.ent, r.mov, 0)}</Td>
                      <Td bold color={r.sep >= r.jul ? "#10b981" : "#ef4444"}>{r.jul ? deltaTxt(r.sep, r.jul) : "nuevo"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="🎯 Top 10 productos Q3 (órdenes)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-700"><Th left>#</Th><Th left>Producto</Th><Th left>Proveedor</Th><Th>Jul</Th><Th>Sep</Th><Th>Q3</Th></tr></thead>
              <tbody>
                {topProd.map((p, i) => (
                  <tr key={p.nombre} className="border-b border-gray-800/50">
                    <Td left>{i + 1}</Td>
                    <td className="py-1.5 px-2 text-xs t-primary max-w-[220px] truncate" title={p.nombre}>{p.nombre}</td>
                    <td className="py-1.5 px-2 text-xs t-muted max-w-[120px] truncate" title={p.proveedor}>{cleanName(p.proveedor)}</td>
                    <Td>{fmt(p.jul)}</Td><Td color={p.sep >= p.jul ? "#10b981" : "#ef4444"}>{fmt(p.sep)}</Td><Td bold>{fmt(p.ordenes)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="🚚 Transportadoras — tasa de entrega por mes" sub="Misma regla que Operaciones → Por Logística: entregadas ÷ movilizadas (solo guías con fecha de orden del mes)">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-700"><Th left>Transportadora</Th>{Q3.map((m) => <Th key={m}>{CORTO[m]}</Th>)}<Th>Movilizadas Q3</Th><Th>Particip.</Th><Th>Entrega Q3</Th><Th>Devol. Q3</Th><Th>En proceso</Th></tr></thead>
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
          {transp.length === 0 && <p className="text-xs t-muted">Sin datos de Operaciones para Q3.</p>}
        </Card>
      </div>

      {/* Preparación Q4 */}
      <div data-pdf-section className="rounded-2xl p-5 border-2" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(59,130,246,0.08))", borderColor: "rgba(16,185,129,0.4)" }}>
        <h3 className="text-base font-bold t-primary mb-1">🚀 Preparando el Q4 — base para planificar</h3>
        <p className="text-[11px] t-muted mb-4">Octubre en curso contra su meta, y la base que deja el Q3 para fijar noviembre y diciembre.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <Kpi label={`Octubre al día ${q4.ultimoDia}`} value={fmt(q4.oct.ing)} sub={`ingresadas · ${fmt(q4.promOct)}/día (Q3: ${fmt(q4.promQ3)}/día)`} good={q4.promOct >= q4.promQ3} color={C.ing} />
          <Kpi label="Proyección octubre" value={fmt(q4.proyIng)} sub={q4.oct.metaIng ? `ingresadas · ${pct(q4.proyIng, q4.oct.metaIng, 0)} de la meta ${fmt(q4.oct.metaIng)}` : "ingresadas al ritmo actual"} good={q4.oct.metaIng ? q4.proyIng >= q4.oct.metaIng : null} color={C.ing} />
          <Kpi label="Movilizadas proyectadas" value={fmt(q4.proyMov)} sub={q4.oct.metaMov ? `meta ${fmt(q4.oct.metaMov)} · con la tasa de mov. del Q3 (${(q4.tasaMovQ3 * 100).toFixed(1).replace(".", ",")}%)` : ""} good={q4.oct.metaMov ? q4.proyMov >= q4.oct.metaMov : null} color={C.mov} />
          <Kpi label="Necesario por día" value={fmt(q4.necesarioDiaIng)} sub={`ingresadas en los ${q4.restantes} días que quedan para llegar a la meta`} good={q4.necesarioDiaIng <= q4.promOct} color={C.meta} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-700"><Th left>Mes Q4</Th><Th>Meta movilizadas</Th><Th>Meta ingresadas</Th><Th>vs promedio Q3</Th><Th left>Estado</Th></tr></thead>
            <tbody>
              {Q4.map((m) => {
                const mm = met[m];
                const promQ3Mov = tQ3.mov / 3;
                return (
                  <tr key={m} className="border-b border-gray-800/50">
                    <Td left bold>{LABEL[m]}</Td>
                    <Td>{mm.metaMov ? fmt(mm.metaMov) : "—"}</Td>
                    <Td>{mm.metaIng ? fmt(mm.metaIng) : "—"}</Td>
                    <Td>{mm.metaMov ? deltaTxt(mm.metaMov, promQ3Mov) : "—"}</Td>
                    <td className="py-1.5 px-2 text-xs t-muted">{m === "octubre" ? `En curso: ${fmt(mm.mov)} movilizadas al día ${q4.ultimoDia}` : mm.metaMov ? "Meta cargada" : `Sin meta · base sugerida ${fmt(q4.baseMensualQ4)} movilizadas`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] t-muted mt-3">
          Base sugerida = promedio mensual de movilizadas del Q3 ({fmt(tQ3.mov / 3)}) ajustado por el crecimiento Q3 vs Q2 ({q4.crecQ3vsQ2 >= 0 ? "+" : ""}{q4.crecQ3vsQ2.toFixed(1).replace(".", ",")}% trimestral). Es un punto de partida para definir las metas de noviembre y diciembre.
        </p>
      </div>
    </div>
  );
}
