"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";

interface OpSnapshot {
  total_orders?: number;
  by_status?: Record<string, number>;
  by_date?: { fecha: string; total: number; estados?: Record<string, number> }[];
  by_producto?: { nombre: string; productoId?: string; proveedor?: string; cantidad?: number; ordenes: number }[];
  by_proveedor?: { id?: number; nombre: string; total: number; estados?: Record<string, number> }[];
  by_dropshipper?: { nombre: string; total: number; estados?: Record<string, number> }[];
  by_departamento?: { nombre: string; total: number }[];
  logistics?: {
    tasa_entrega?: number;
    tasa_devolucion?: number;
    tasa_cancelado?: number;
    by_transportadora?: { nombre: string; total: number; entregado: number; devolucion: number; pctEntrega: number }[];
  };
}

interface ResumenMes {
  mes: string;
  ingresadas: number;
  movilizadas: number;
  entregadas: number;
  devueltas: number;
  en_proceso: number;
}

interface MetaInfo {
  meta_ingresadas_abril?: number; meta_movilizadas_abril?: number;
  meta_ingresadas_mayo?: number; meta_movilizadas_mayo?: number;
  meta_ingresadas_junio?: number; meta_movilizadas_junio?: number;
  dias_abril?: number; dias_mayo?: number; dias_junio?: number;
  [k: string]: number | undefined;
}

type MesQ2 = "abril" | "mayo" | "junio" | "julio";
const MESES_Q2: MesQ2[] = ["abril", "mayo", "junio", "julio"];
const MES_LABEL: Record<string, string> = { abril: "Abril", mayo: "Mayo", junio: "Junio", julio: "Julio" };
const MES_DIAS: Record<MesQ2, number> = { abril: 30, mayo: 31, junio: 30, julio: 31 };
const MES_NUM: Record<MesQ2, number> = { abril: 4, mayo: 5, junio: 6, julio: 7 };

// Day of month from "DD-MM-YYYY"
function dayOf(s: string): number {
  const m = s?.match(/^(\d{2})-/);
  return m ? +m[1] : 0;
}

function pct(v: number, total: number): number {
  return total > 0 ? Math.round((v / total) * 1000) / 10 : 0;
}

function deltaPct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}

export default function AnalisisRecomendaciones({ country }: { country: "ar" | "py" }) {
  const [mesActual, setMesActual] = useState<MesQ2>("julio");
  const [opCurr, setOpCurr] = useState<OpSnapshot | null>(null);
  const [opPrev, setOpPrev] = useState<OpSnapshot | null>(null);
  const [resumenes, setResumenes] = useState<Record<string, ResumenMes>>({});
  const [meta, setMeta] = useState<MetaInfo>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const mesPrev: MesQ2 = mesActual === "julio" ? "junio" : mesActual === "junio" ? "mayo" : mesActual === "mayo" ? "abril" : "abril";

  const [estrategia, setEstrategia] = useState<{ usuarios?: { por_mes: Record<string, { ing: number; mov: number }> }[] } | null>(null);
  const [usuariosSeg, setUsuariosSeg] = useState<{ cohorts?: Record<string, { total_registrados?: number; activos_total?: number; intentaron_total?: number }>; retention?: Record<string, Record<string, Record<string, unknown[]>>> } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [curRes, prevRes, mainRes, resOpRes, estRes, usRes] = await Promise.all([
        fetch(`/api/data/operational?country=${country}&mes=${mesActual}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/operational?country=${country}&mes=${mesPrev}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/${country}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/resumen-operacional?country=${country}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/estrategia?country=${country}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/usuarios?country=${country}`).then((r) => r.json()).catch(() => null),
      ]);
      setOpCurr(curRes?.data || null);
      setOpPrev(prevRes?.data || null);

      // Resumen mensual: priorizar resumen_operacional (tabla nueva, fresca)
      // Fallback al snap si la tabla no responde.
      const map: Record<string, ResumenMes> = {};
      if (resOpRes?.rows && Array.isArray(resOpRes.rows)) {
        for (const r of resOpRes.rows) {
          map[r.mes] = {
            mes: r.mes,
            ingresadas: r.ingresadas || 0,
            movilizadas: r.movilizadas || 0,
            entregadas: r.entregadas || 0,
            devueltas: r.devueltas || 0,
            en_proceso: r.en_proceso || 0,
          };
        }
      }
      // El endpoint /api/data/[country] hace spread del snapshot, no lo envuelve en .data
      const allData = (mainRes || {}) as { resumen?: Record<string, ResumenMes>; meta_info?: MetaInfo };
      if (allData.resumen) {
        for (const m of MESES_Q2) {
          if (map[m]) continue; // ya cargado de resumen_operacional
          const r = allData.resumen[m];
          if (r) map[m] = { mes: m, ingresadas: r.ingresadas || 0, movilizadas: r.movilizadas || 0, entregadas: r.entregadas || 0, devueltas: r.devueltas || 0, en_proceso: r.en_proceso || 0 };
        }
      }
      setResumenes(map);

      if (allData.meta_info) {
        const mi = { ...allData.meta_info };
        // Calcular meta_movilizadas_junio si falta (tasa_mov * meta_ingresadas_junio)
        if (mi.meta_ingresadas_junio && !mi.meta_movilizadas_junio) {
          const tasa = mi.tasa_movilizacion || 0.75;
          mi.meta_movilizadas_junio = Math.round(mi.meta_ingresadas_junio * tasa);
        }
        setMeta(mi);
      }

      if (estRes && !estRes.error) setEstrategia(estRes);
      if (usRes && !usRes.error) setUsuariosSeg(usRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [country, mesActual, mesPrev]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const todayDay = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() === 2026 && now.getMonth() + 1 === MES_NUM[mesActual]) return now.getDate();
    return MES_DIAS[mesActual]; // Si mes pasado, asumimos mes completo
  }, [mesActual]);

  // KPIs comparativos
  const kpis = useMemo(() => {
    const c = resumenes[mesActual];
    const p = resumenes[mesPrev];
    if (!c || !p) return null;
    return {
      mov: { curr: c.movilizadas, prev: p.movilizadas, delta: deltaPct(c.movilizadas, p.movilizadas) },
      ing: { curr: c.ingresadas, prev: p.ingresadas, delta: deltaPct(c.ingresadas, p.ingresadas) },
      ent: { curr: c.entregadas, prev: p.entregadas, delta: deltaPct(c.entregadas, p.entregadas) },
      dev: { curr: c.devueltas, prev: p.devueltas, delta: deltaPct(c.devueltas, p.devueltas) },
      pctMov: { curr: pct(c.movilizadas, c.ingresadas), prev: pct(p.movilizadas, p.ingresadas) },
      pctEnt: { curr: pct(c.entregadas, c.movilizadas), prev: pct(p.entregadas, p.movilizadas) },
      pctDev: { curr: pct(c.devueltas, c.movilizadas), prev: pct(p.devueltas, p.movilizadas) },
    };
  }, [resumenes, mesActual, mesPrev]);

  // Meta del mes actual
  const metaMes = useMemo(() => {
    const movKey = `meta_movilizadas_${mesActual}` as keyof MetaInfo;
    const ingKey = `meta_ingresadas_${mesActual}` as keyof MetaInfo;
    return {
      mov: meta[movKey] || 0,
      ing: meta[ingKey] || 0,
    };
  }, [meta, mesActual]);

  // Proyección y progreso a meta
  const projeccion = useMemo(() => {
    if (!kpis) return null;
    const diasMes = MES_DIAS[mesActual];
    const diasTranscurridos = todayDay;
    const diasRestantes = Math.max(0, diasMes - diasTranscurridos);
    const promedioDiarioActual = diasTranscurridos > 0 ? kpis.mov.curr / diasTranscurridos : 0;
    const proyectado = Math.round(promedioDiarioActual * diasMes);
    const brechaAMeta = Math.max(0, metaMes.mov - kpis.mov.curr);
    const necesarioDiario = diasRestantes > 0 ? Math.ceil(brechaAMeta / diasRestantes) : 0;
    const onTrack = promedioDiarioActual * diasMes >= metaMes.mov;
    return {
      diasTranscurridos, diasRestantes, diasMes,
      promedioDiarioActual: Math.round(promedioDiarioActual),
      proyectado, brechaAMeta, necesarioDiario, onTrack,
      pctMeta: metaMes.mov > 0 ? Math.round((kpis.mov.curr / metaMes.mov) * 1000) / 10 : 0,
    };
  }, [kpis, metaMes, mesActual, todayDay]);

  // Daily comparison (mes actual vs mes anterior, día por día)
  const dailySeries = useMemo(() => {
    const currByDay = new Map<number, number>();
    const prevByDay = new Map<number, number>();
    for (const e of opCurr?.by_date || []) currByDay.set(dayOf(e.fecha), e.total);
    for (const e of opPrev?.by_date || []) prevByDay.set(dayOf(e.fecha), e.total);
    const maxDay = Math.max(MES_DIAS[mesActual], MES_DIAS[mesPrev]);
    const series: { dia: number; actual: number | null; anterior: number | null; cumActual: number | null; cumAnterior: number | null }[] = [];
    let cumA = 0, cumP = 0;
    for (let d = 1; d <= maxDay; d++) {
      const a = currByDay.has(d) ? currByDay.get(d)! : null;
      const p = prevByDay.has(d) ? prevByDay.get(d)! : null;
      if (a !== null) cumA += a;
      if (p !== null) cumP += p;
      series.push({
        dia: d,
        actual: a,
        anterior: p,
        cumActual: a !== null ? cumA : null,
        cumAnterior: p !== null ? cumP : null,
      });
    }
    return series;
  }, [opCurr, opPrev, mesActual, mesPrev]);

  // Filtro de rango de fechas aplicado a daily
  const filteredDaily = useMemo(() => {
    if (!dateFrom && !dateTo) return dailySeries;
    const from = dateFrom ? +dateFrom.split("-")[2] : 1;
    const to = dateTo ? +dateTo.split("-")[2] : MES_DIAS[mesActual];
    return dailySeries.filter((d) => d.dia >= from && d.dia <= to);
  }, [dailySeries, dateFrom, dateTo, mesActual]);

  // Top productos con delta (mismo producto en ambos meses)
  const topProductos = useMemo(() => {
    const currMap = new Map<string, { ordenes: number; cantidad: number; proveedor: string }>();
    const prevMap = new Map<string, { ordenes: number; cantidad: number }>();
    for (const p of opCurr?.by_producto || []) currMap.set(p.nombre, { ordenes: p.ordenes, cantidad: p.cantidad || 0, proveedor: p.proveedor || "" });
    for (const p of opPrev?.by_producto || []) prevMap.set(p.nombre, { ordenes: p.ordenes, cantidad: p.cantidad || 0 });
    const all = new Map<string, { curr: number; prev: number; proveedor: string }>();
    for (const [n, v] of currMap) all.set(n, { curr: v.ordenes, prev: prevMap.get(n)?.ordenes || 0, proveedor: v.proveedor });
    for (const [n, v] of prevMap) if (!all.has(n)) all.set(n, { curr: 0, prev: v.ordenes, proveedor: "" });
    return Array.from(all.entries())
      .map(([nombre, v]) => ({ nombre, curr: v.curr, prev: v.prev, delta: deltaPct(v.curr, v.prev), absDelta: v.curr - v.prev, proveedor: v.proveedor }))
      .sort((a, b) => b.curr - a.curr);
  }, [opCurr, opPrev]);

  // Top proveedores con delta
  const topProveedores = useMemo(() => {
    const currMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    for (const p of opCurr?.by_proveedor || []) currMap.set(p.nombre, p.total);
    for (const p of opPrev?.by_proveedor || []) prevMap.set(p.nombre, p.total);
    const all = new Map<string, { curr: number; prev: number }>();
    for (const [n, v] of currMap) all.set(n, { curr: v, prev: prevMap.get(n) || 0 });
    for (const [n, v] of prevMap) if (!all.has(n)) all.set(n, { curr: 0, prev: v });
    return Array.from(all.entries())
      .map(([nombre, v]) => ({ nombre, curr: v.curr, prev: v.prev, delta: deltaPct(v.curr, v.prev), absDelta: v.curr - v.prev }))
      .sort((a, b) => b.curr - a.curr);
  }, [opCurr, opPrev]);

  // Top departamentos
  const topDepartamentos = useMemo(() => {
    const currMap = new Map<string, number>();
    const prevMap = new Map<string, number>();
    for (const d of opCurr?.by_departamento || []) currMap.set(d.nombre, d.total);
    for (const d of opPrev?.by_departamento || []) prevMap.set(d.nombre, d.total);
    const all = new Map<string, { curr: number; prev: number }>();
    for (const [n, v] of currMap) all.set(n, { curr: v, prev: prevMap.get(n) || 0 });
    for (const [n, v] of prevMap) if (!all.has(n)) all.set(n, { curr: 0, prev: v });
    return Array.from(all.entries())
      .map(([nombre, v]) => ({ nombre, curr: v.curr, prev: v.prev, delta: deltaPct(v.curr, v.prev), absDelta: v.curr - v.prev }))
      .sort((a, b) => b.curr - a.curr);
  }, [opCurr, opPrev]);

  // Top transportadoras (logistics)
  const topTransportadoras = useMemo(() => {
    const cur = opCurr?.logistics?.by_transportadora || [];
    const prev = opPrev?.logistics?.by_transportadora || [];
    const prevMap = new Map(prev.map((t) => [t.nombre, t]));
    return cur.map((t) => {
      const p = prevMap.get(t.nombre);
      return {
        nombre: t.nombre,
        curr: t.total,
        prev: p?.total || 0,
        delta: deltaPct(t.total, p?.total || 0),
        pctEntrega: t.pctEntrega,
        pctEntregaPrev: p?.pctEntrega || 0,
      };
    }).sort((a, b) => b.curr - a.curr);
  }, [opCurr, opPrev]);

  // Análisis usuarios: del mes actual vs anterior — activos, intentaron, retención
  const analisisUsuarios = useMemo(() => {
    if (!usuariosSeg?.cohorts) return null;
    const cohortCurr = usuariosSeg.cohorts[mesActual];
    const cohortPrev = usuariosSeg.cohorts[mesPrev];
    const retentionView = usuariosSeg.retention?.[mesActual];
    // Buckets de retención para vista actual: sumar todos los activos vs perdidos
    let activos = 0, perdidos = 0, nuncaOperaron = 0, bajaron = 0;
    if (retentionView) {
      for (const buckets of Object.values(retentionView)) {
        for (const [bk, lst] of Object.entries(buckets)) {
          const n = Array.isArray(lst) ? lst.length : 0;
          if (bk === "nunca_operaron") nuncaOperaron += n;
          else if (bk.startsWith("solo_")) perdidos += n;
          else if (bk.startsWith("bajaron_")) bajaron += n;
          else if (bk.startsWith("activo_")) activos += n;
        }
      }
    }
    return {
      cohort_actual: cohortCurr || null,
      cohort_prev: cohortPrev || null,
      retention_activos: activos,
      retention_perdidos: perdidos,
      retention_nunca: nuncaOperaron,
      retention_bajaron: bajaron,
    };
  }, [usuariosSeg, mesActual, mesPrev]);

  // Mejor mes histórico (referencia para "lo que sí funcionó")
  const mejorMes = useMemo(() => {
    let best: { mes: string; mov: number } | null = null;
    for (const [mes, r] of Object.entries(resumenes)) {
      if (!best || r.movilizadas > best.mov) best = { mes, mov: r.movilizadas };
    }
    return best;
  }, [resumenes]);

  // DSs activos del mes (DSs que tienen mov > 0 en este mes según estrategia)
  const dssActivos = useMemo(() => {
    if (!estrategia?.usuarios) return null;
    let curr = 0, prev = 0;
    for (const u of estrategia.usuarios) {
      const movC = u.por_mes?.[mesActual]?.mov ?? 0;
      const movP = u.por_mes?.[mesPrev]?.mov ?? 0;
      if (movC > 0) curr++;
      if (movP > 0) prev++;
    }
    return { curr, prev, delta: deltaPct(curr, prev) };
  }, [estrategia, mesActual, mesPrev]);

  // Recomendaciones (heurísticas) — umbrales más bajos + cobertura completa
  const recomendaciones = useMemo(() => {
    type RecItem = { label: string; sub?: string; right?: string; deltaPct?: number; phone?: string; email?: string };
    type Rec = {
      titulo: string;
      detalle: string;
      impacto: "alto" | "medio" | "bajo";
      cualitativo?: string; // párrafo extra de contexto / por qué pasa / qué decir
      items?: RecItem[]; // lista expandible (productos, proveedores, DSs)
      itemsLabel?: string; // ej: "5 productos", "12 dropshippers"
    };
    const inmediatas: Rec[] = [];
    const inicio_mes: { titulo: string; detalle: string }[] = [];
    if (!kpis || !projeccion) return { inmediatas, inicio_mes };

    // === ACCIONES INMEDIATAS ===

    // 1. Comportamiento general de movilizadas
    if (kpis.mov.delta <= -5) {
      const sev = kpis.mov.delta <= -15 ? "alto" : "medio";
      inmediatas.push({
        titulo: `⬇️ Movilizadas ${kpis.mov.delta < 0 ? "cayeron" : "subieron"} ${Math.abs(kpis.mov.delta)}% vs ${MES_LABEL[mesPrev]}`,
        detalle: `Estás ${fmt(Math.abs(kpis.mov.curr - kpis.mov.prev))} órdenes por ${kpis.mov.curr < kpis.mov.prev ? "debajo" : "encima"} del mes anterior. Acción: priorizá llamar HOY a los DSs Top 10 (los Pareto 75%), preguntales qué obstáculos tienen y ofreceles incentivos puntuales (envío gratis × N, descuentos en flete, productos winners exclusivos).`,
        impacto: sev as "alto" | "medio",
      });
    } else if (kpis.mov.delta >= 5) {
      inmediatas.push({
        titulo: `📈 Movilizadas crecieron ${kpis.mov.delta}% vs ${MES_LABEL[mesPrev]}`,
        detalle: `Buena tendencia (+${fmt(kpis.mov.curr - kpis.mov.prev)} órdenes). Sostené la inversión en los productos y proveedores ganadores. Replicá la estrategia que funcionó: revisá calendario de ${MES_LABEL[mesPrev]} para identificar qué cambió.`,
        impacto: "medio",
      });
    } else {
      inmediatas.push({
        titulo: `↔️ Movilizadas estables (${kpis.mov.delta >= 0 ? "+" : ""}${kpis.mov.delta}%)`,
        detalle: `Vas parejo con ${MES_LABEL[mesPrev]} (${fmt(kpis.mov.curr)} vs ${fmt(kpis.mov.prev)}). Si el objetivo es crecer, hay que cambiar algo: activar campaña con nuevos productos winners, lanzar promo, o atacar la base de DSs intentaron-pero-no-movilizaron.`,
        impacto: "medio",
      });
    }

    // 2. Tasa de entrega
    // 2-PRE. Tasa de MOVILIZACIÓN (ingresadas → movilizadas).
    // ATENCIÓN: la tasa del mes corriente está siempre subestimada porque los
    // pendientes/en_proceso aún no se contaron como movilizadas. Recién días
    // después del cierre se ve la tasa real. Cuando el mes seleccionado es el
    // mes corriente, calculamos tasa proyectada = (mov + en_proceso) / ing.
    const isMesCorriente = (() => {
      const now = new Date();
      return now.getFullYear() === 2026 && now.getMonth() + 1 === MES_NUM[mesActual];
    })();
    const enProcCurr = resumenes[mesActual]?.en_proceso || 0;
    const tasaProyCurr = kpis.ing.curr > 0 ? Math.round(((kpis.mov.curr + enProcCurr) / kpis.ing.curr) * 1000) / 10 : 0;
    const dMov = kpis.pctMov.curr - kpis.pctMov.prev;
    const dMovProy = tasaProyCurr - kpis.pctMov.prev;

    if (isMesCorriente) {
      // En mes corriente: usar tasa proyectada para evaluar
      if (dMovProy <= -3 && enProcCurr > 0) {
        const ordPerdidas = Math.round((kpis.ing.curr * Math.abs(dMovProy)) / 100);
        inmediatas.push({
          titulo: `⚠️ Tasa de movilización proyectada cayó ${Math.abs(dMovProy).toFixed(1)} pp`,
          detalle: `Aún con todos los pendientes (${fmt(enProcCurr)}) saliendo a despacho, la tasa proyectada del mes sería ${tasaProyCurr.toFixed(1)}% vs ${kpis.pctMov.prev.toFixed(1)}% de ${MES_LABEL[mesPrev]}. Estimado perdidas: ${fmt(ordPerdidas)} órdenes.`,
          cualitativo: `Mes en curso — la tasa actual (${kpis.pctMov.curr.toFixed(1)}%) está subestimada porque los pendientes aún no se contaron. La proyectada (asumiendo que todos los en_proceso se movilizan) es ${tasaProyCurr.toFixed(1)}%. Aún así está abajo de ${MES_LABEL[mesPrev]}, lo cual sí es preocupante. Causas típicas: cancelaciones por cliente que no confirma, rechazos por stock, pendientes que no se resuelven. Revisar by_status del mes en operaciones para encontrar el cuello.`,
          impacto: "alto",
        });
      } else if (enProcCurr > 0) {
        // Solo informativo, no alarma
        inmediatas.push({
          titulo: `ℹ️ Tasa de movilización del mes en curso (${kpis.pctMov.curr.toFixed(1)}%) — preliminar`,
          detalle: `Hay ${fmt(enProcCurr)} órdenes en proceso (PENDIENTE / GUIA_GENERADA / EN_PROCESO) que aún no se contaron como movilizadas. Tasa proyectada incluyéndolas: ${tasaProyCurr.toFixed(1)}% (vs ${kpis.pctMov.prev.toFixed(1)}% de ${MES_LABEL[mesPrev]}).`,
          cualitativo: `Es normal que durante el mes la tasa esté más baja que el mes anterior cerrado. La tasa real del mes recién se ve unos días después del cierre. Si la proyectada (${tasaProyCurr.toFixed(1)}%) está cerca o por encima de ${MES_LABEL[mesPrev]}, todo OK. Acción: monitorear que los pendientes se resuelvan rápido — meta sana es ≤10% de las ingresadas del mes en estados pendientes hacia el cierre.`,
          impacto: "bajo",
        });
      }
    } else {
      // Mes cerrado: comparación directa válida
      if (dMov <= -3) {
        const ordPerdidas = Math.round((kpis.ing.curr * Math.abs(dMov)) / 100);
        inmediatas.push({
          titulo: `⚠️ Tasa de movilización cayó ${Math.abs(dMov).toFixed(1)} pp vs ${MES_LABEL[mesPrev]}`,
          detalle: `Pasó de ${kpis.pctMov.prev.toFixed(1)}% a ${kpis.pctMov.curr.toFixed(1)}%. De cada 100 ingresadas, ${Math.abs(dMov).toFixed(0)} menos salieron a despacho. Total perdidas en el mes: ${fmt(ordPerdidas)} órdenes.`,
          cualitativo: `Mes cerrado, esto es la tasa final. Diagnóstico por estado: mirar by_status en operaciones para ver dónde se acumularon las no-movilizadas. Causas típicas: cancelaciones por cliente, rechazos por stock, errores en dirección. Para el próximo mes: reforzar contacto WhatsApp automatizado pre-despacho, bloquear productos sin stock, validar formularios.`,
          impacto: "alto",
        });
      } else if (dMov >= 3) {
        inmediatas.push({
          titulo: `✅ Tasa de movilización subió ${dMov.toFixed(1)} pp`,
          detalle: `Pasó de ${kpis.pctMov.prev.toFixed(1)}% a ${kpis.pctMov.curr.toFixed(1)}%. Mismas ingresadas, más despachos. Sostener.`,
          impacto: "medio",
        });
      }
    }

    const dEnt = kpis.pctEnt.curr - kpis.pctEnt.prev;
    if (dEnt <= -2) {
      inmediatas.push({
        titulo: `🚚 Tasa de entrega cayó ${Math.abs(dEnt).toFixed(1)} pp`,
        detalle: `Pasó de ${kpis.pctEnt.prev.toFixed(1)}% a ${kpis.pctEnt.curr.toFixed(1)}%. Eso son ${fmt(Math.round(kpis.mov.curr * Math.abs(dEnt) / 100))} entregas perdidas estimadas. Revisá inmediatamente las transportadoras con pctEntrega más bajo en la tabla — si una bajó >5pp, escalá con su responsable de logística HOY.`,
        impacto: "alto",
      });
    } else if (dEnt >= 2) {
      inmediatas.push({
        titulo: `✅ % Entrega subió ${dEnt.toFixed(1)} pp`,
        detalle: `Mejora real: ${kpis.pctEnt.prev.toFixed(1)}% → ${kpis.pctEnt.curr.toFixed(1)}%. Identificá qué transportadora explicó el salto y derivá más volumen hacia ella.`,
        impacto: "medio",
      });
    }

    // 3. Tasa de devolución
    const dDev = kpis.pctDev.curr - kpis.pctDev.prev;
    if (dDev >= 2) {
      inmediatas.push({
        titulo: `↩️ Devoluciones crecieron ${dDev.toFixed(1)} pp`,
        detalle: `Pasó de ${kpis.pctDev.prev.toFixed(1)}% a ${kpis.pctDev.curr.toFixed(1)}%. Cada punto de devolución cuesta plata (flete + producto + tiempo). Acciones: auditá los productos con más devoluciones, reforzá confirmación telefónica al cliente final, y bloqueá temporalmente los productos con tasa devolución > 30%.`,
        impacto: "alto",
      });
    }

    // 4. Proyección vs meta
    if (metaMes.mov > 0) {
      if (!projeccion.onTrack && projeccion.diasRestantes > 0) {
        const gap = Math.round(((metaMes.mov - projeccion.proyectado) / metaMes.mov) * 100);
        inmediatas.push({
          titulo: `🎯 Vas ${gap}% por debajo de la meta proyectada`,
          detalle: `Necesitás ${fmt(projeccion.necesarioDiario)} mov/día en los ${projeccion.diasRestantes} días restantes vs los ${fmt(projeccion.promedioDiarioActual)}/día actuales (${Math.round(projeccion.necesarioDiario / Math.max(projeccion.promedioDiarioActual, 1) * 100 - 100)}% más). Plan de emergencia: 1) llamada hoy a top 10 Master+ con incentivo de envío bonificado, 2) push a "intentaron" (mov=0 ing>0) para destrabarlos, 3) reactivar productos winners del mes anterior con visibilidad extra.`,
          impacto: "alto",
        });
      } else if (projeccion.onTrack) {
        inmediatas.push({
          titulo: `✅ Vas en camino a superar la meta (${projeccion.pctMeta}%)`,
          detalle: `Proyectás ${fmt(projeccion.proyectado)} vs meta ${fmt(metaMes.mov)} (+${fmt(projeccion.proyectado - metaMes.mov)} mov sobre objetivo). Sostené el ritmo: no aflojes con los Master/Experto y empujá a los Iniciados para que pasen al siguiente nivel.`,
          impacto: "medio",
        });
      }
    }

    // 5. Productos en caída
    const prodCaida = topProductos.filter((p) => p.prev >= 30 && p.delta <= -20);
    if (prodCaida.length > 0) {
      inmediatas.push({
        titulo: `📉 ${prodCaida.length} producto${prodCaida.length>1?"s":""} top en caída`,
        detalle: `Estos productos movían bien en ${MES_LABEL[mesPrev]} y bajaron al menos 20% este mes. Probable: rotura de stock, baja de precio de la competencia, fatiga del creativo. Diagnóstico producto por producto.`,
        cualitativo: `Mensaje sugerido para el equipo: "Tenemos ${prodCaida.length} productos en caída fuerte vs ${MES_LABEL[mesPrev]}. Antes de buscar productos nuevos, recuperemos estos: pidan al proveedor stock actualizado, revisen si la competencia bajó precio en Mercado Libre, y si el producto no es recuperable, reemplacen YA con un winner del mismo segmento."`,
        impacto: "medio",
        items: prodCaida.slice(0, 30).map((p) => ({
          label: p.nombre,
          sub: p.proveedor ? `prov: ${p.proveedor.split("(")[0].trim()}` : undefined,
          right: `${fmt(p.curr)} ord (era ${fmt(p.prev)})`,
          deltaPct: p.delta,
        })),
        itemsLabel: `Ver ${prodCaida.length} producto${prodCaida.length>1?"s":""} en caída`,
      });
    }

    // 6. Productos winners
    const prodWinner = topProductos.filter((p) => p.prev >= 20 && p.delta >= 25 && p.curr >= 50);
    if (prodWinner.length > 0) {
      inmediatas.push({
        titulo: `🚀 ${prodWinner.length} producto${prodWinner.length>1?"s":""} con tracción fuerte`,
        detalle: `Estos productos están creciendo en doble dígito vs ${MES_LABEL[mesPrev]}. Es donde tenés que doblar la apuesta.`,
        cualitativo: `Mensaje sugerido: "Estos ${prodWinner.length} productos están explotando. Acciones HOY: 1) Asegurar stock con los proveedores (que no se rompa la cadena), 2) Subirlos al banner principal del catálogo, 3) Empujarlos en el grupo WhatsApp de Sabios VIP y Expertos como 'producto del mes', 4) Crear creativos nuevos para los DSs que aún no los testearon."`,
        impacto: "medio",
        items: prodWinner.slice(0, 30).map((p) => ({
          label: p.nombre,
          sub: p.proveedor ? `prov: ${p.proveedor.split("(")[0].trim()}` : undefined,
          right: `${fmt(p.curr)} ord (era ${fmt(p.prev)})`,
          deltaPct: p.delta,
        })),
        itemsLabel: `Ver ${prodWinner.length} winner${prodWinner.length>1?"s":""}`,
      });
    }

    // 7. Proveedores con caída
    const provCaida = topProveedores.filter((p) => p.prev >= 80 && p.delta <= -15);
    if (provCaida.length > 0) {
      inmediatas.push({
        titulo: `⚠️ ${provCaida.length} proveedor${provCaida.length>1?"es":""} con caída fuerte`,
        detalle: `Cada uno hacía ≥80 órdenes en ${MES_LABEL[mesPrev]} y cayó ≥15%. La causa más común es operativa (stock, demoras, problemas en entregas).`,
        cualitativo: `Mensaje sugerido para customer success: "Llamada HOY a cada uno. Guion: '¿Cómo viene la operación este mes? Estamos viendo menos movimiento que ${MES_LABEL[mesPrev]} — queremos entender si es un tema nuestro o tuyo y cómo te ayudamos.' Si el proveedor responde con 'no tenemos stock' o 'problemas operativos', escalá al área correspondiente HOY. Si dice 'no hay demanda', es momento de armarle catálogo destacado o promoción."`,
        impacto: "alto",
        items: provCaida.slice(0, 30).map((p) => ({
          label: p.nombre.split("(")[0].trim(),
          right: `${fmt(p.curr)} ord (era ${fmt(p.prev)})`,
          deltaPct: p.delta,
        })),
        itemsLabel: `Ver ${provCaida.length} proveedor${provCaida.length>1?"es":""}`,
      });
    }

    // 8. Proveedores winners
    const provWinner = topProveedores.filter((p) => p.prev >= 50 && p.delta >= 20 && p.curr >= 100);
    if (provWinner.length > 0) {
      inmediatas.push({
        titulo: `🏆 ${provWinner.length} proveedor${provWinner.length>1?"es":""} crecen fuerte`,
        detalle: `Crecimiento sólido vs ${MES_LABEL[mesPrev]}. Entender por qué les funciona y replicar la fórmula al resto.`,
        cualitativo: `Pedile a cada uno una llamada de 15 minutos esta semana. Preguntá: ¿qué hicieron distinto este mes? ¿productos nuevos? ¿campaña en redes? ¿algún DS estrella? Esa info es ORO — la reproducís con los otros proveedores y multiplicás.`,
        impacto: "medio",
        items: provWinner.slice(0, 30).map((p) => ({
          label: p.nombre.split("(")[0].trim(),
          right: `${fmt(p.curr)} ord (era ${fmt(p.prev)})`,
          deltaPct: p.delta,
        })),
        itemsLabel: `Ver ${provWinner.length} proveedor${provWinner.length>1?"es":""} winners`,
      });
    }

    // 9. DSs activos
    if (dssActivos && dssActivos.delta <= -10) {
      // Sacar la lista de DSs que operaron en prev y NO operaron en curr
      const lostDS: { label: string; sub?: string; right?: string }[] = [];
      if (estrategia?.usuarios) {
        for (const u of estrategia.usuarios) {
          const movC = u.por_mes?.[mesActual]?.mov ?? 0;
          const movP = u.por_mes?.[mesPrev]?.mov ?? 0;
          if (movP > 0 && movC === 0) {
            const uu = u as unknown as { email?: string; nombre?: string; telefono?: string };
            lostDS.push({
              label: uu.nombre || uu.email || "(sin nombre)",
              sub: uu.email,
              right: `${fmt(movP)} mov en ${MES_LABEL[mesPrev]}`,
            });
          }
        }
      }
      lostDS.sort((a, b) => parseInt((b.right || "0").replace(/\D/g, "")) - parseInt((a.right || "0").replace(/\D/g, "")));
      inmediatas.push({
        titulo: `👥 DSs operando cayeron ${Math.abs(dssActivos.delta)}% (${fmt(dssActivos.curr)} vs ${fmt(dssActivos.prev)})`,
        detalle: `${fmt(dssActivos.prev - dssActivos.curr)} DSs menos están moviendo este mes. El volumen baja por menos DSs operando, no por menos pedidos promedio.`,
        cualitativo: `Esto es lo más urgente — el negocio se construye sobre cuántos DSs están operando, no cuánto operan los de siempre. Lista en el detalle: cada uno con su nombre y email. Llamar HOY a los TOP 20 con un mensaje claro: "Vimos que no estás operando este mes y queremos entender por qué. ¿Hubo algún problema?". Ofrecé incentivo: 10 envíos bonificados si vuelven en los próximos 7 días.`,
        impacto: "alto",
        items: lostDS.slice(0, 100),
        itemsLabel: `Ver ${lostDS.length} DSs que dejaron de operar`,
      });
    } else if (dssActivos && dssActivos.delta >= 10) {
      inmediatas.push({
        titulo: `👥 +${dssActivos.delta}% DSs operando vs ${MES_LABEL[mesPrev]}`,
        detalle: `${fmt(dssActivos.curr)} DSs operando (+${fmt(dssActivos.curr - dssActivos.prev)} netos). Base ampliada.`,
        cualitativo: `Buena base, pero atención al efecto "primer mes": muchos DSs aparecen activos en su primer mes y desaparecen al segundo. Acción: identificá los DSs nuevos (Iniciados / Esporádicos) y armá un programa de onboarding intensivo para que lleguen a 10+ mov antes de que se vayan.`,
        impacto: "medio",
      });
    }

    // 10. Retención perdidos (registrados que no volvieron) — con lista detallada
    if (analisisUsuarios && analisisUsuarios.retention_perdidos >= 5) {
      // Combinar todos los buckets "solo_*" de las cohorts previas en la vista actual
      const perdidosUsers: { email?: string; nombre?: string; telefono?: string; comunidad?: string | null; mov_cohort?: number; mov_abril?: number; mov_mayo?: number; mov_junio?: number }[] = [];
      const retentionView = (usuariosSeg as unknown as { retention?: Record<string, Record<string, Record<string, { email?: string; nombre?: string; telefono?: string; comunidad?: string | null; mov_cohort?: number; mov_abril?: number; mov_mayo?: number; mov_junio?: number }[]>>> } | null)?.retention?.[mesActual];
      const cohortMap: Record<string, string> = {};
      if (retentionView) {
        for (const [cohortKey, buckets] of Object.entries(retentionView)) {
          for (const [bk, lst] of Object.entries(buckets)) {
            if (bk.startsWith("solo_") && Array.isArray(lst)) {
              for (const u of lst) {
                perdidosUsers.push(u);
                if (u.email) cohortMap[u.email] = cohortKey;
              }
            }
          }
        }
      }
      // Ordenar por mov_cohort desc (los que más operaron primero)
      perdidosUsers.sort((a, b) => (b.mov_cohort || 0) - (a.mov_cohort || 0));
      inmediatas.push({
        titulo: `🔁 ${fmt(analisisUsuarios.retention_perdidos)} DSs operaron antes y NO volvieron en ${MES_LABEL[mesActual]}`,
        detalle: `Son la pesca más fácil — ya saben usar la plataforma, ya generaron ventas alguna vez. Recuperarlos cuesta mucho menos que conseguir DSs nuevos.`,
        cualitativo: `Campaña "te extrañamos" en 3 etapas: 1) WhatsApp automatizado con mensaje personal y bonus de 10 envíos gratis. 2) Si no responde en 48hs, llamada del comercial. 3) Si vuelve a operar, asignación a un programa de fidelización (proveedor preferente, info anticipada de productos nuevos). La lista está abajo con el email y teléfono — ordenada por los que más operaban antes (priorizar TOP 20).`,
        impacto: "medio",
        items: perdidosUsers.slice(0, 200).map((u) => {
          const ck = u.email ? (cohortMap[u.email] || "") : "";
          return {
            label: u.nombre || u.email || "(sin nombre)",
            sub: `${u.email || ""}${u.telefono ? ` · 📞 ${u.telefono}` : ""}${u.comunidad ? ` · ${u.comunidad}` : ""}${ck ? ` · cohort ${MES_LABEL[ck] || ck}` : ""}`,
            right: `${fmt(u.mov_cohort || 0)} mov antes${(u.mov_abril||u.mov_mayo||u.mov_junio) ? ` · A:${u.mov_abril||0} M:${u.mov_mayo||0} J:${u.mov_junio||0}` : ""}`,
          };
        }),
        itemsLabel: `Ver ${perdidosUsers.length} DSs perdidos`,
      });
    }

    // 11. Intentaron pero no movilizaron (con lista detallada)
    if (analisisUsuarios?.cohort_actual?.intentaron_total && analisisUsuarios.cohort_actual.intentaron_total >= 10) {
      const cohort = usuariosSeg?.cohorts?.[mesActual] as unknown as { segmento_intentaron?: { usuarios?: { email?: string; nombre?: string; telefono?: string; ing?: number; comunidad?: string | null }[] } } | undefined;
      const intentUsers = cohort?.segmento_intentaron?.usuarios || [];
      inmediatas.push({
        titulo: `⚠️ ${fmt(analisisUsuarios.cohort_actual.intentaron_total)} DSs registrados en ${MES_LABEL[mesActual]} ingresaron órdenes pero NINGUNA se movilizó`,
        detalle: `Estos DSs ya generaron tráfico, ya hicieron pedidos — pero todo se cae antes de despachar (cancelado, pendiente, rechazado).`,
        cualitativo: `Es la pesca más rápida del mes. Diagnóstico típico: 1) Cliente no confirma la dirección/teléfono → reforzar confirmación automatizada por WhatsApp antes de despachar. 2) Proveedor sin stock → revisar inventario en tiempo real y bloquear productos sin stock. 3) Precio mal calculado por el DS → llamarlos para tutorial rápido. Cada uno destrabado = una venta lograda con casi cero esfuerzo.`,
        impacto: "alto",
        items: intentUsers.slice(0, 100).map((u) => ({
          label: u.nombre || u.email || "(sin nombre)",
          sub: u.email + (u.comunidad ? ` · ${u.comunidad}` : ""),
          right: `${fmt(u.ing || 0)} ing, 0 mov`,
        })),
        itemsLabel: `Ver ${intentUsers.length} DSs intentaron sin mov`,
      });
    }

    // 11. Mejor mes histórico
    if (mejorMes && mejorMes.mes !== mesActual && kpis.mov.curr < mejorMes.mov) {
      const gap = mejorMes.mov - kpis.mov.curr;
      inmediatas.push({
        titulo: `📚 Tu mejor mes fue ${MES_LABEL[mejorMes.mes] || mejorMes.mes}: ${fmt(mejorMes.mov)} mov`,
        detalle: `Estás ${fmt(gap)} órdenes por debajo de ese pico (${Math.round((1 - kpis.mov.curr / mejorMes.mov) * 100)}% menos). Revisá qué se hizo en ${MES_LABEL[mejorMes.mes] || mejorMes.mes}: catálogo de productos, base de DSs activos, transportadoras usadas, campañas. Replicá lo que se pueda.`,
        impacto: "medio",
      });
    }

    // === ACCIONES PARA INICIO DE MES ===
    // Siempre se muestran (5 fijas) + extras según contexto

    inicio_mes.push({
      titulo: "🎯 Definir meta del mes y comunicarla el día 1",
      detalle: `Compartir con todo el equipo desde el primer día — visibilidad genera urgencia y compromiso. Mostrar también el progreso diario en una pantalla pública o canal de Slack/WhatsApp.`,
    });

    inicio_mes.push({
      titulo: "📦 Curar el catálogo con los winners del mes anterior",
      detalle: `Tomar el Top 20 productos del mes que cierra y promocionarlos como "ganadores comprobados" a los DSs nuevos e Iniciados. Reduce el riesgo de prueba y acelera tiempo a primera venta.`,
    });

    inicio_mes.push({
      titulo: "🚀 Reactivar dormidos en la primera semana",
      detalle: `Filtrar los registrados de los últimos 90 días que NO operaron ni una vez (segmento 4_cero). Campaña de bienvenida con bonus en envíos los primeros 7 días, con seguimiento por WhatsApp.`,
    });

    inicio_mes.push({
      titulo: "👥 Asignar comerciales a los Master+",
      detalle: `Los DSs con 300+ mov merecen punto de contacto fijo. Asignar comercial por cartera y agendar 1 llamada quincenal en la primera semana del mes. Ellos sostienen el 70% del volumen.`,
    });

    inicio_mes.push({
      titulo: "📊 Setup del reporte semanal del mes",
      detalle: `Cada lunes: ingresadas vs meta, % entrega por transportadora, productos en caída/winners, DSs próximos a subir nivel. Reunión 30 min con el equipo comercial y operaciones.`,
    });

    // Extras contextuales
    if (mejorMes) {
      inicio_mes.push({
        titulo: `📚 Estudiar el playbook de ${MES_LABEL[mejorMes.mes] || mejorMes.mes} (mejor mes histórico)`,
        detalle: `Ese mes movió ${fmt(mejorMes.mov)} órdenes. Repasar: ¿qué productos lideraban? ¿qué proveedores empujaban? ¿qué transportadoras tenían más volumen y mejor pct_entrega? Replicar la fórmula del mes ganador.`,
      });
    }

    if (analisisUsuarios && analisisUsuarios.retention_perdidos >= 10) {
      inicio_mes.push({
        titulo: `🔁 Lanzar campaña de winback los primeros 14 días`,
        detalle: `Hay ${fmt(analisisUsuarios.retention_perdidos)} DSs que operaron antes y dejaron de hacerlo. Mensaje personalizado por WhatsApp + bonus para incentivar primer pedido del mes. Llamada al final si no responden.`,
      });
    }

    inicio_mes.push({
      titulo: "🎁 Programa de incentivos por nivel",
      detalle: `Iniciados → bonus por llegar a 10 mov (subir a En Desarrollo). En Desarrollo → bonus por superar 66 (Master). Master → comisión preferencial los primeros 100 envíos al subir a Sabio VIP. Estos micro-objetivos aceleran upgrades.`,
    });

    return { inmediatas, inicio_mes };
  }, [kpis, projeccion, metaMes, mesActual, mesPrev, topProductos, topProveedores, dssActivos, analisisUsuarios, mejorMes]);

  // ─── Playbook Q3: solo activo cuando estamos en Julio ───
  // Compara el mejor mes de Q2 vs junio (cierre reciente) y produce un plan
  // accionable para julio con estrategias de retorno rápido.
  const playbookQ3 = useMemo(() => {
    if (mesActual !== "julio") return null;

    // Encontrar el mejor mes de Q2 en cada dimensión
    const q2Meses = ["abril","mayo","junio"] as const;
    const resQ2 = q2Meses.map((m) => {
      const r = resumenes[m] || { ingresadas: 0, movilizadas: 0, entregadas: 0, devueltas: 0, en_proceso: 0 };
      return { mesKey: m as string, ingresadas: r.ingresadas, movilizadas: r.movilizadas, entregadas: r.entregadas, devueltas: r.devueltas };
    });
    const mejorPorMov = [...resQ2].sort((a, b) => (b.movilizadas || 0) - (a.movilizadas || 0))[0];
    const junio = resumenes.junio || { ingresadas: 0, movilizadas: 0, entregadas: 0, devueltas: 0 };
    const gapVsBest = (mejorPorMov?.movilizadas || 0) - (junio.movilizadas || 0);
    const gapPct = mejorPorMov?.movilizadas ? (gapVsBest / mejorPorMov.movilizadas) * 100 : 0;

    // Top productos del mejor mes que en junio bajaron o desaparecieron
    // (opCurr no aplica aún porque Julio no tiene datos, usamos comparación indirecta)
    const winnersQ2NotInJunio = topProductos
      .filter((p) => p.prev >= 30 && (p.delta <= -20 || p.curr === 0))
      .slice(0, 8);

    // Winners consistentes (crecieron o se mantuvieron en junio)
    const winnersSostenidos = topProductos
      .filter((p) => p.curr >= 30 && p.delta >= 0)
      .slice(0, 10);

    // Tasa histórica esperada (viene de meta_info.tasa_movilizacion, ej AR=0.81 / PY=0.76)
    const tasaEsperada = meta.tasa_movilizacion || 0.80;
    const tasaMin = meta.tasa_movilizacion_min || (tasaEsperada - 0.01);
    const tasaMax = meta.tasa_movilizacion_max || (tasaEsperada + 0.01);
    // Ingresadas necesarias para llegar a la meta a esa tasa
    const ingNecesariasParaMeta = tasaEsperada > 0 ? Math.round(metaMes.mov / tasaEsperada) : 0;

    // Tasa REAL de junio (mes cerrado más reciente)
    const junio = resumenes.junio || { ingresadas: 0, movilizadas: 0, entregadas: 0, devueltas: 0 };
    const tasaJunio = junio.ingresadas > 0 ? junio.movilizadas / junio.ingresadas : 0;
    const dentroDelRango = tasaJunio >= tasaMin && tasaJunio <= tasaMax;

    return {
      mejorMes: mejorPorMov,
      junio,
      gapVsBest,
      gapPct: Math.round(gapPct * 10) / 10,
      winnersRecuperar: winnersQ2NotInJunio,
      winnersReplicar: winnersSostenidos,
      metaJulio: metaMes,
      tasaEsperada, tasaMin, tasaMax,
      ingNecesariasParaMeta,
      tasaJunio, dentroDelRango,
    };
  }, [mesActual, resumenes, topProductos, metaMes, meta]);

  if (loading) return <div className="glass-card p-6 t-muted text-sm">Cargando análisis…</div>;
  if (error) return <div className="glass-card p-6 text-red-400 text-sm">⚠️ {error}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 border border-cyan-500/30" style={{ background: "var(--bg-card)" }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold t-primary mb-1">📊 Análisis y Recomendaciones — {country.toUpperCase()}</h1>
            <p className="text-[11px] t-muted">
              Comparativo del mes vs mes anterior, productos/proveedores ganadores y en caída, proyección a meta y acciones recomendadas.
            </p>
          </div>
          <div className="flex gap-2">
            {MESES_Q2.map((m) => (
              <button key={m} onClick={() => setMesActual(m)}
                className={`text-xs px-3 py-2 rounded-lg border ${mesActual === m ? "bg-orange-500 text-white border-orange-500" : "border-gray-700 t-secondary hover:border-orange-500/40"}`}>
                {MES_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs comparativos */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiDelta label="Movilizadas" curr={kpis.mov.curr} prev={kpis.mov.prev} delta={kpis.mov.delta} primary />
          <KpiDelta label="Ingresadas" curr={kpis.ing.curr} prev={kpis.ing.prev} delta={kpis.ing.delta} />
          <KpiDelta label="Entregadas" curr={kpis.ent.curr} prev={kpis.ent.prev} delta={kpis.ent.delta} />
          <KpiDelta label="Devueltas" curr={kpis.dev.curr} prev={kpis.dev.prev} delta={kpis.dev.delta} invertColor />
        </div>
      )}

      {/* Tasas y proyección */}
      {kpis && projeccion && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-lg p-4 border border-gray-700" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-[10px] t-muted uppercase tracking-wider mb-2">Tasas operativas</h3>
            <div className="space-y-2">
              <RowDelta label="% Movilización" curr={kpis.pctMov.curr} prev={kpis.pctMov.prev} suffix="%" />
              {(() => {
                const now = new Date();
                const enCurso = now.getFullYear() === 2026 && now.getMonth() + 1 === MES_NUM[mesActual];
                const enProc = resumenes[mesActual]?.en_proceso || 0;
                if (!enCurso || enProc <= 0 || kpis.ing.curr <= 0) return null;
                const proyectada = ((kpis.mov.curr + enProc) / kpis.ing.curr) * 100;
                return (
                  <div className="text-[10px] t-muted pl-2 -mt-1 italic">
                    → proyectada (incluye {fmt(enProc)} en proceso): <strong className="text-cyan-300">{proyectada.toFixed(1)}%</strong>
                  </div>
                );
              })()}
              <RowDelta label="% Entrega" curr={kpis.pctEnt.curr} prev={kpis.pctEnt.prev} suffix="%" />
              <RowDelta label="% Devolución" curr={kpis.pctDev.curr} prev={kpis.pctDev.prev} suffix="%" invertColor />
            </div>
            {(() => {
              const now = new Date();
              const enCurso = now.getFullYear() === 2026 && now.getMonth() + 1 === MES_NUM[mesActual];
              if (!enCurso) return null;
              return (
                <p className="text-[9px] t-muted mt-2 italic">ⓘ {MES_LABEL[mesActual]} en curso — la tasa final se ve recién días después del cierre cuando se resuelven los pendientes.</p>
              );
            })()}
          </div>
          <div className="rounded-lg p-4 border border-amber-500/30" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-[10px] t-muted uppercase tracking-wider mb-2">Progreso a meta {MES_LABEL[mesActual]}</h3>
            {/* Movilizadas vs meta */}
            <div className="mb-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] t-muted">Movilizadas</span>
                <span className="text-[11px] font-mono font-bold" style={{ color: projeccion.onTrack ? "#10b981" : "#f59e0b" }}>
                  {projeccion.pctMeta}%
                </span>
              </div>
              <div className="text-base font-bold t-primary">{fmt(kpis.mov.curr)}<span className="text-xs t-muted"> / {fmt(metaMes.mov)}</span></div>
              <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                <div className="h-full" style={{ width: `${Math.min(100, projeccion.pctMeta)}%`, background: projeccion.onTrack ? "#10b981" : "#f59e0b" }}></div>
              </div>
              <p className="text-[9px] t-muted mt-1">Faltan <strong className="t-secondary">{fmt(Math.max(0, metaMes.mov - kpis.mov.curr))}</strong> mov</p>
            </div>
            {/* Ingresadas vs meta */}
            {metaMes.ing > 0 && (
              <div className="mb-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] t-muted">Ingresadas</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: kpis.ing.curr >= metaMes.ing ? "#10b981" : "#f59e0b" }}>
                    {Math.round((kpis.ing.curr / metaMes.ing) * 1000) / 10}%
                  </span>
                </div>
                <div className="text-base font-bold t-primary">{fmt(kpis.ing.curr)}<span className="text-xs t-muted"> / {fmt(metaMes.ing)}</span></div>
                <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                  <div className="h-full" style={{ width: `${Math.min(100, (kpis.ing.curr / metaMes.ing) * 100)}%`, background: kpis.ing.curr >= metaMes.ing ? "#10b981" : "#0891b2" }}></div>
                </div>
                <p className="text-[9px] t-muted mt-1">Faltan <strong className="t-secondary">{fmt(Math.max(0, metaMes.ing - kpis.ing.curr))}</strong> ing</p>
              </div>
            )}
            {/* Proyección de movilizadas si se mantiene la tasa de mov del mes anterior */}
            {kpis.pctMov.prev > 0 && (() => {
              const tasaPrev = kpis.pctMov.prev / 100;
              const movProyectadasPorIng = Math.round(kpis.ing.curr * tasaPrev);
              const faltanPara100 = Math.max(0, metaMes.mov - movProyectadasPorIng);
              const pctConTasaPrev = metaMes.mov > 0 ? Math.round((movProyectadasPorIng / metaMes.mov) * 1000) / 10 : 0;
              return (
                <div className="pt-2 border-t border-amber-500/15">
                  <p className="text-[9px] t-muted uppercase tracking-wider mb-1">Si manteneís la tasa de {MES_LABEL[mesPrev]} ({kpis.pctMov.prev.toFixed(1)}%)</p>
                  <p className="text-[11px] t-secondary">
                    Tus {fmt(kpis.ing.curr)} ing actuales se convertirían en <strong className="text-cyan-300">{fmt(movProyectadasPorIng)} mov</strong>
                    {" "}({pctConTasaPrev}% de la meta). {faltanPara100 > 0
                      ? <>Faltarían <strong className="text-amber-300">{fmt(faltanPara100)} mov</strong> para llegar a {fmt(metaMes.mov)}.</>
                      : <span className="text-emerald-300">Ya superarías la meta de movilizadas.</span>}
                  </p>
                </div>
              );
            })()}
          </div>
          <div className="rounded-lg p-4 border border-purple-500/30" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-[10px] t-muted uppercase tracking-wider mb-2">Proyección al cierre</h3>
            <div className="text-2xl font-bold" style={{ color: projeccion.onTrack ? "#10b981" : "#f59e0b" }}>
              {fmt(projeccion.proyectado)}
            </div>
            <p className="text-[10px] t-muted mt-1">
              Ritmo {fmt(projeccion.promedioDiarioActual)}/día · faltan {projeccion.diasRestantes} días
            </p>
            {!projeccion.onTrack && projeccion.diasRestantes > 0 && (
              <p className="text-[10px] text-amber-300 mt-1">
                ⚠️ Necesitás {fmt(projeccion.necesarioDiario)} mov/día para llegar
              </p>
            )}
          </div>
        </div>
      )}

      {/* Comparativo diario */}
      <div className="rounded-xl p-4 border border-gray-700" style={{ background: "var(--bg-card)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold t-primary">📈 Comparativo diario — {MES_LABEL[mesActual]} vs {MES_LABEL[mesPrev]}</h2>
            <p className="text-[11px] t-muted">Total de órdenes ingresadas por día. Ideal para detectar caídas puntuales o eventos.</p>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-[10px] t-muted">Desde día</label>
            <input type="number" min={1} max={MES_DIAS[mesActual]} value={dateFrom ? dateFrom.split("-")[2] : ""} onChange={(e) => setDateFrom(e.target.value ? `2026-${String(MES_NUM[mesActual]).padStart(2,"0")}-${e.target.value.padStart(2,"0")}` : "")} className="w-16 text-xs px-2 py-1 rounded border border-gray-700 bg-transparent t-primary" />
            <label className="text-[10px] t-muted">hasta</label>
            <input type="number" min={1} max={MES_DIAS[mesActual]} value={dateTo ? dateTo.split("-")[2] : ""} onChange={(e) => setDateTo(e.target.value ? `2026-${String(MES_NUM[mesActual]).padStart(2,"0")}-${e.target.value.padStart(2,"0")}` : "")} className="w-16 text-xs px-2 py-1 rounded border border-gray-700 bg-transparent t-primary" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] t-muted hover:text-orange-400">limpiar</button>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filteredDaily} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
            <XAxis dataKey="dia" tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={todayDay} stroke="#f97316" strokeDasharray="3 3" label={{ value: "Hoy", fill: "#f97316", fontSize: 10 }} />
            <Line type="monotone" dataKey="anterior" name={MES_LABEL[mesPrev]} stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="actual" name={MES_LABEL[mesActual]} stroke="#f97316" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Acumulado diario */}
      <div className="rounded-xl p-4 border border-gray-700" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">📊 Acumulado por día (carrera con el mes anterior)</h2>
        <p className="text-[11px] t-muted mb-3">¿En qué día se cruzó el mes corriente con el anterior?</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={dailySeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
            <XAxis dataKey="dia" tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="cumAnterior" name={`${MES_LABEL[mesPrev]} acum`} stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cumActual" name={`${MES_LABEL[mesActual]} acum`} stroke="#10b981" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Panel usuarios */}
      {(analisisUsuarios || dssActivos) && (
        <div className="rounded-xl p-4 border border-purple-500/30" style={{ background: "var(--bg-card)" }}>
          <h2 className="text-base font-bold t-primary mb-1">👥 Usuarios — {MES_LABEL[mesActual]} vs {MES_LABEL[mesPrev]}</h2>
          <p className="text-[11px] t-muted mb-3">Activación de la base, retención y recuperables.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {dssActivos && (
              <KpiDelta label="DSs operando" curr={dssActivos.curr} prev={dssActivos.prev} delta={dssActivos.delta} primary />
            )}
            {analisisUsuarios?.cohort_actual && (
              <>
                <KpiDelta
                  label="Nuevos registrados"
                  curr={analisisUsuarios.cohort_actual?.total_registrados || 0}
                  prev={analisisUsuarios.cohort_prev?.total_registrados || 0}
                  delta={deltaPct(analisisUsuarios.cohort_actual?.total_registrados || 0, analisisUsuarios.cohort_prev?.total_registrados || 0)}
                />
                <KpiDelta
                  label="Activos del cohort"
                  curr={analisisUsuarios.cohort_actual?.activos_total || 0}
                  prev={analisisUsuarios.cohort_prev?.activos_total || 0}
                  delta={deltaPct(analisisUsuarios.cohort_actual?.activos_total || 0, analisisUsuarios.cohort_prev?.activos_total || 0)}
                />
                <KpiDelta
                  label="Intentaron sin mov"
                  curr={analisisUsuarios.cohort_actual?.intentaron_total || 0}
                  prev={analisisUsuarios.cohort_prev?.intentaron_total || 0}
                  delta={deltaPct(analisisUsuarios.cohort_actual?.intentaron_total || 0, analisisUsuarios.cohort_prev?.intentaron_total || 0)}
                  invertColor
                />
              </>
            )}
          </div>
          {analisisUsuarios && (analisisUsuarios.retention_activos + analisisUsuarios.retention_perdidos + analisisUsuarios.retention_bajaron) > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded p-2 border border-emerald-500/30" style={{ background: "var(--bg-input)" }}>
                <p className="t-muted text-[10px] uppercase tracking-wider">🟢 Activos retenidos</p>
                <p className="text-lg font-bold text-emerald-400">{fmt(analisisUsuarios.retention_activos)}</p>
              </div>
              <div className="rounded p-2 border border-orange-500/30" style={{ background: "var(--bg-input)" }}>
                <p className="t-muted text-[10px] uppercase tracking-wider">🟠 Bajaron</p>
                <p className="text-lg font-bold text-orange-400">{fmt(analisisUsuarios.retention_bajaron)}</p>
              </div>
              <div className="rounded p-2 border border-amber-500/30" style={{ background: "var(--bg-input)" }}>
                <p className="t-muted text-[10px] uppercase tracking-wider">🟡 Perdidos (recuperables)</p>
                <p className="text-lg font-bold text-amber-400">{fmt(analisisUsuarios.retention_perdidos)}</p>
              </div>
              <div className="rounded p-2 border border-red-500/30" style={{ background: "var(--bg-input)" }}>
                <p className="t-muted text-[10px] uppercase tracking-wider">🔴 Nunca operaron</p>
                <p className="text-lg font-bold text-red-400">{fmt(analisisUsuarios.retention_nunca)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mejor mes histórico */}
      {mejorMes && mejorMes.mes !== mesActual && (
        <div className="rounded-xl p-4 border border-cyan-500/30" style={{ background: "var(--bg-card)" }}>
          <h2 className="text-base font-bold t-primary mb-1">📚 Mejor mes histórico — {MES_LABEL[mejorMes.mes] || mejorMes.mes}</h2>
          <p className="text-[11px] t-muted">
            En {MES_LABEL[mejorMes.mes] || mejorMes.mes} movilizaron <strong className="t-primary">{fmt(mejorMes.mov)}</strong> órdenes
            {kpis && kpis.mov.curr < mejorMes.mov && (
              <> — estás <strong className="text-amber-300">{fmt(mejorMes.mov - kpis.mov.curr)} órdenes ({Math.round((1 - kpis.mov.curr / mejorMes.mov) * 100)}%) por debajo</strong> de ese pico</>
            )}.
            Mirá las tablas debajo y revisá: ¿qué productos lideraban entonces? ¿qué proveedores empujaban? ¿qué transportadoras tenían mejor pct_entrega? Replicá lo que se pueda — la fórmula ya está probada.
          </p>
        </div>
      )}

      {/* Recomendaciones */}
      <div className="rounded-xl p-4 border border-amber-500/40" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-3">💡 Recomendaciones — Acciones inmediatas</h2>
        {recomendaciones.inmediatas.length === 0 ? (
          <p className="text-xs t-muted">Sin acciones críticas detectadas con la data actual.</p>
        ) : (
          <div className="space-y-2">
            {recomendaciones.inmediatas.map((r, i) => (
              <RecCard key={i} rec={r} />
            ))}
          </div>
        )}
      </div>

      {/* Playbook Q3 — solo se muestra cuando estamos en Julio */}
      {playbookQ3 && (
        <div className="rounded-xl p-4 border-2 border-cyan-500/50" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.05))" }}>
          <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
            <div>
              <h2 className="text-lg font-bold t-primary mb-1">🎯 Playbook Q3 — Estrategias para arrancar Julio con foco</h2>
              <p className="text-[11px] t-muted">
                Análisis del mejor mes de Q2 vs Junio (cierre reciente). Priorizamos <strong className="text-cyan-300">retorno rápido</strong> con acciones ejecutables las primeras 2 semanas del mes.
              </p>
            </div>
          </div>

          {/* Contexto: mejor mes Q2 vs junio + meta + tasa esperada */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg p-3 border border-emerald-500/30" style={{ background: "var(--bg-input)" }}>
              <p className="text-[10px] t-muted uppercase tracking-wider mb-1">📈 Mejor mes Q2</p>
              <p className="text-lg font-bold text-emerald-400">{MES_LABEL[playbookQ3.mejorMes.mesKey] || playbookQ3.mejorMes.mesKey}</p>
              <p className="text-[11px] t-secondary">{fmt(playbookQ3.mejorMes.movilizadas || 0)} movilizadas</p>
            </div>
            <div className="rounded-lg p-3 border border-gray-700" style={{ background: "var(--bg-input)" }}>
              <p className="text-[10px] t-muted uppercase tracking-wider mb-1">🏁 Cierre Junio</p>
              <p className="text-lg font-bold t-primary">{fmt(playbookQ3.junio.movilizadas || 0)}</p>
              <p className="text-[11px]" style={{ color: playbookQ3.gapPct >= 0 ? "#fbbf24" : "#10b981" }}>
                {playbookQ3.gapPct >= 0 ? `${playbookQ3.gapPct.toFixed(1)}% vs mejor` : `+${Math.abs(playbookQ3.gapPct).toFixed(1)}% vs mejor`}
              </p>
            </div>
            <div className="rounded-lg p-3 border border-cyan-500/40" style={{ background: "var(--bg-input)" }}>
              <p className="text-[10px] t-muted uppercase tracking-wider mb-1">🎯 Meta Julio</p>
              <p className="text-lg font-bold text-cyan-400">{fmt(playbookQ3.metaJulio.mov)}</p>
              <p className="text-[11px] t-secondary">mov · {fmt(playbookQ3.metaJulio.ing)} ing</p>
            </div>
            <div className="rounded-lg p-3 border border-purple-500/40" style={{ background: "var(--bg-input)" }}>
              <p className="text-[10px] t-muted uppercase tracking-wider mb-1">📊 Tasa esperada</p>
              <p className="text-lg font-bold text-purple-300">{(playbookQ3.tasaEsperada * 100).toFixed(0)}%</p>
              <p className="text-[11px] t-secondary">
                rango {(playbookQ3.tasaMin * 100).toFixed(0)}–{(playbookQ3.tasaMax * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: playbookQ3.dentroDelRango ? "#10b981" : "#fbbf24" }}>
                Junio: {(playbookQ3.tasaJunio * 100).toFixed(1)}% {playbookQ3.dentroDelRango ? "✓" : "⚠"}
              </p>
            </div>
          </div>

          {/* Nota: cuántas ingresadas se necesitan para llegar a la meta con la tasa esperada */}
          <div className="rounded-lg p-2 mb-3 border border-cyan-500/20 text-[11px] t-secondary" style={{ background: "rgba(6,182,212,0.05)" }}>
            💡 <strong className="t-primary">Para llegar a {fmt(playbookQ3.metaJulio.mov)} movilizadas</strong> a la tasa histórica del {(playbookQ3.tasaEsperada * 100).toFixed(0)}%, necesitás <strong className="text-cyan-300">{fmt(playbookQ3.ingNecesariasParaMeta)} ingresadas</strong> en Julio.
            {playbookQ3.tasaJunio > 0 && playbookQ3.tasaJunio < playbookQ3.tasaMin && (
              <span className="block mt-1 text-amber-300">
                ⚠ Junio cerró en {(playbookQ3.tasaJunio * 100).toFixed(1)}% (debajo del {(playbookQ3.tasaMin * 100).toFixed(0)}% esperado). Si julio replica esa tasa, necesitás <strong>{fmt(Math.round(playbookQ3.metaJulio.mov / playbookQ3.tasaJunio))} ingresadas</strong> — es {fmt(Math.round(playbookQ3.metaJulio.mov / playbookQ3.tasaJunio) - playbookQ3.ingNecesariasParaMeta)} más. Priorizar recuperar la tasa antes de solo empujar volumen.
              </span>
            )}
          </div>

          {/* Acciones rápidas — retorno inmediato */}
          <div className="rounded-lg p-3 border border-orange-500/40 mb-3" style={{ background: "var(--bg-input)" }}>
            <h3 className="text-sm font-bold text-orange-300 mb-2">⚡ Acciones RÁPIDAS con retorno inmediato (semana 1-2)</h3>
            <ul className="space-y-2 text-[12px] t-secondary">
              <li>
                <strong className="t-primary">1. Reactivar productos ganadores de {MES_LABEL[playbookQ3.mejorMes.mesKey]}</strong> que en Junio bajaron o desaparecieron.
                {playbookQ3.winnersRecuperar.length > 0 && (
                  <span className="block mt-1 pl-3 text-[11px]">
                    Ejemplos: {playbookQ3.winnersRecuperar.slice(0, 3).map((p) => `${p.nombre.slice(0, 40)} (${p.delta}%)`).join(" · ")}
                  </span>
                )}
                <span className="block text-[10px] t-muted pl-3 mt-0.5">→ Pedir stock urgente al proveedor, poner en banner y push a WhatsApp de DSs Sabio VIP.</span>
              </li>
              <li>
                <strong className="t-primary">2. Doblar apuesta en productos que YA vienen creciendo</strong> — asegurar stock antes del pico Q3.
                {playbookQ3.winnersReplicar.length > 0 && (
                  <span className="block mt-1 pl-3 text-[11px]">
                    Winners sostenidos: {playbookQ3.winnersReplicar.slice(0, 3).map((p) => `${p.nombre.slice(0, 40)} (+${p.delta}%)`).join(" · ")}
                  </span>
                )}
                <span className="block text-[10px] t-muted pl-3 mt-0.5">→ Campaña con creativos nuevos + capacitación a Iniciados/En Desarrollo para que los prueben.</span>
              </li>
              <li>
                <strong className="t-primary">3. Winback de DSs que operaron en {MES_LABEL[playbookQ3.mejorMes.mesKey]} pero no en Junio</strong>.
                <span className="block text-[10px] t-muted pl-3 mt-0.5">→ Lista en Estrategia Usuarios &gt; Retención cohorts. WhatsApp con bonus de 10 envíos gratis los primeros 7 días de julio.</span>
              </li>
              <li>
                <strong className="t-primary">4. Empujar &quot;próximos a subir&quot;</strong> (Iniciados en 8-10 mov, En Desarrollo en 55-65 mov).
                <span className="block text-[10px] t-muted pl-3 mt-0.5">→ Bonus por cruzar el umbral en los primeros 15 días. Retorno inmediato en cantidad + calidad de operación.</span>
              </li>
              <li>
                <strong className="t-primary">5. Destrabar los &quot;intentaron sin mov&quot;</strong> (mov=0, ing&gt;0 del mes anterior).
                <span className="block text-[10px] t-muted pl-3 mt-0.5">→ Ya generaron tráfico. Diagnóstico: cancelaciones por confirmación, stock, dirección. Reforzar WhatsApp automatizado.</span>
              </li>
            </ul>
          </div>

          {/* Acciones estructurales para todo Q3 */}
          <div className="rounded-lg p-3 border border-purple-500/40" style={{ background: "var(--bg-input)" }}>
            <h3 className="text-sm font-bold text-purple-300 mb-2">🏗️ Acciones estructurales para todo Q3</h3>
            <ul className="space-y-1.5 text-[12px] t-secondary">
              <li>• <strong className="t-primary">Playbook Q2:</strong> Documentar qué se hizo en {MES_LABEL[playbookQ3.mejorMes.mesKey]} (mejor mes) — productos, campañas, transportadoras, comerciales — y reproducirlo mensualmente.</li>
              <li>• <strong className="t-primary">Setup Q3:</strong> Meta Julio = {fmt(playbookQ3.metaJulio.mov)} mov. Definir metas Agosto y Septiembre con crecimiento +5-10% mensual.</li>
              <li>• <strong className="t-primary">Reunión de arranque:</strong> Día 1 de julio con todo el equipo. Compartir meta, top productos, top DSs, campañas activas.</li>
              <li>• <strong className="t-primary">Programa de cartera:</strong> Cada Master+ tiene comercial asignado con QBR mensual. Objetivo: 0 DSs Master perdidos en Q3.</li>
              <li>• <strong className="t-primary">Nuevos DSs onboarding intensivo:</strong> Los nuevos Iniciados de Julio tienen que llegar a 10 mov antes del día 21 (60% se pierde entre día 15-30 del primer mes).</li>
              <li>• <strong className="t-primary">Auditoría de transportadoras:</strong> Identificar la de mejor tasa entrega en Junio y derivar más volumen hacia ella. Escalar las que bajaron.</li>
              <li>• <strong className="t-primary">Reporte semanal:</strong> Cada lunes revisar ingresadas vs meta, % entrega por transportadora, productos winners/en caída y próximos a subir de nivel.</li>
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-xl p-4 border border-purple-500/30" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-3">🚀 Acciones para arrancar el próximo mes (lecciones de {MES_LABEL[mesPrev]} → {MES_LABEL[mesActual]})</h2>
        <div className="space-y-2">
          {recomendaciones.inicio_mes.map((r, i) => (
            <div key={i} className="rounded-lg p-3 border border-purple-500/20" style={{ background: "var(--bg-input)" }}>
              <p className="text-sm font-bold t-primary mb-1">{r.titulo}</p>
              <p className="text-[11px] t-secondary">{r.detalle}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top productos */}
      <div className="rounded-xl p-4 border border-gray-700" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">🏆 Productos — Top 20 con variación vs {MES_LABEL[mesPrev]}</h2>
        <p className="text-[11px] t-muted mb-3">Verde: crecieron. Rojo: cayeron. Foco operativo: replicar verdes, investigar rojos.</p>
        <TopTable items={topProductos.slice(0, 20)} colKey="ordenes" labelCol="Producto" />
      </div>

      {/* Top proveedores */}
      <div className="rounded-xl p-4 border border-gray-700" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">📦 Proveedores — Top 15 con variación</h2>
        <TopTable items={topProveedores.slice(0, 15)} colKey="total" labelCol="Proveedor" />
      </div>

      {/* Top departamentos */}
      <div className="rounded-xl p-4 border border-gray-700" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">🌍 Departamentos / Zonas — Top 12</h2>
        <TopTable items={topDepartamentos.slice(0, 12)} colKey="total" labelCol="Zona" />
      </div>

      {/* Top transportadoras */}
      {topTransportadoras.length > 0 && (
        <div className="rounded-xl p-4 border border-gray-700" style={{ background: "var(--bg-card)" }}>
          <h2 className="text-base font-bold t-primary mb-1">🚚 Transportadoras — Volumen + Tasa de entrega</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-700" style={{ background: "var(--bg-input)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-[10px] t-muted">
                  <th className="text-left py-2 px-3">Transportadora</th>
                  <th className="text-right py-2 px-3">Volumen actual</th>
                  <th className="text-right py-2 px-3">vs prev</th>
                  <th className="text-right py-2 px-3">% Entrega</th>
                  <th className="text-right py-2 px-3">vs prev</th>
                </tr>
              </thead>
              <tbody>
                {topTransportadoras.map((t) => (
                  <tr key={t.nombre} className="border-b border-gray-800/40">
                    <td className="py-2 px-3 t-primary">{t.nombre}</td>
                    <td className="py-2 px-3 text-right font-mono">{fmt(t.curr)}</td>
                    <td className="py-2 px-3 text-right font-mono" style={{ color: t.delta > 0 ? "#10b981" : t.delta < 0 ? "#dc2626" : "#94a3b8" }}>{t.delta > 0 ? "+" : ""}{t.delta}%</td>
                    <td className="py-2 px-3 text-right font-mono">{t.pctEntrega.toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right font-mono" style={{ color: t.pctEntrega - t.pctEntregaPrev > 0 ? "#10b981" : "#dc2626" }}>{t.pctEntrega - t.pctEntregaPrev > 0 ? "+" : ""}{(t.pctEntrega - t.pctEntregaPrev).toFixed(1)}pp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface RecCardItem { label: string; sub?: string; right?: string; deltaPct?: number; phone?: string; email?: string }
interface RecCardData {
  titulo: string; detalle: string; impacto: "alto" | "medio" | "bajo";
  cualitativo?: string; items?: RecCardItem[]; itemsLabel?: string;
}

function RecCard({ rec }: { rec: RecCardData }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const r = rec;
  const filtered = useMemo(() => {
    if (!r.items) return [];
    if (!search.trim()) return r.items;
    const q = search.toLowerCase();
    return r.items.filter((it) =>
      it.label.toLowerCase().includes(q) ||
      (it.sub || "").toLowerCase().includes(q) ||
      (it.right || "").toLowerCase().includes(q)
    );
  }, [r.items, search]);

  return (
    <div className="rounded-lg p-3 border" style={{
      background: "var(--bg-input)",
      borderColor: r.impacto === "alto" ? "rgba(220,38,38,0.4)" : r.impacto === "medio" ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)",
    }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold t-primary mb-1">{r.titulo}</p>
          <p className="text-[11px] t-secondary">{r.detalle}</p>
          {r.cualitativo && (
            <p className="text-[11px] t-secondary mt-2 pl-2 border-l-2" style={{
              borderColor: r.impacto === "alto" ? "#dc2626" : r.impacto === "medio" ? "#f59e0b" : "#10b981",
              fontStyle: "italic", opacity: 0.92,
            }}>
              {r.cualitativo}
            </p>
          )}
          <span className="text-[9px] uppercase tracking-wider mt-1 inline-block" style={{
            color: r.impacto === "alto" ? "#fca5a5" : r.impacto === "medio" ? "#fcd34d" : "#86efac",
          }}>Impacto {r.impacto}</span>
        </div>
        {r.items && r.items.length > 0 && (
          <button onClick={() => setOpen(!open)}
            className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-orange-500/40 shrink-0">
            {open ? "Ocultar" : `▶ ${r.itemsLabel || `Ver ${r.items.length}`}`}
          </button>
        )}
      </div>
      {open && r.items && (
        <div className="mt-3 space-y-1">
          {r.items.length > 10 && (
            <input
              type="text" placeholder="🔍 Buscar..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full text-[11px] px-2 py-1 mb-1 rounded border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500"
            />
          )}
          <div className="max-h-[400px] overflow-y-auto rounded border border-gray-700" style={{ background: "var(--bg-card)" }}>
            <table className="w-full text-[11px]">
              <tbody>
                {filtered.slice(0, 200).map((it, i) => (
                  <tr key={it.label + i} className="border-b border-gray-800/30 hover:bg-orange-500/5">
                    <td className="py-1.5 px-2 t-muted text-[10px] w-8">{i + 1}</td>
                    <td className="py-1.5 px-2 t-primary">
                      {it.label}
                      {it.sub && <div className="text-[9px] t-muted font-mono">{it.sub}</div>}
                    </td>
                    {it.right && <td className="py-1.5 px-2 text-right font-mono t-secondary text-[10px]">{it.right}</td>}
                    {typeof it.deltaPct === "number" && (
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-[10px] w-16" style={{
                        color: it.deltaPct > 0 ? "#10b981" : it.deltaPct < 0 ? "#dc2626" : "#94a3b8",
                      }}>{it.deltaPct > 0 ? "+" : ""}{it.deltaPct}%</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && <p className="text-[9px] t-muted mt-1">Mostrando primeros 200. Usá la búsqueda.</p>}
        </div>
      )}
    </div>
  );
}

function KpiDelta({ label, curr, prev, delta, primary, invertColor }: { label: string; curr: number; prev: number; delta: number; primary?: boolean; invertColor?: boolean }) {
  const positive = delta > 0;
  const color = invertColor ? (positive ? "#dc2626" : "#10b981") : (positive ? "#10b981" : delta < 0 ? "#dc2626" : "#94a3b8");
  return (
    <div className="rounded-lg p-3 border" style={{ background: "var(--bg-card)", borderColor: primary ? "rgba(249,115,22,0.4)" : "rgba(75,85,99,0.4)" }}>
      <p className="text-[10px] t-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold t-primary">{fmt(curr)}</p>
      <p className="text-[10px] t-muted mt-0.5">prev: {fmt(prev)}</p>
      <p className="text-xs font-bold mt-1" style={{ color }}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}%</p>
    </div>
  );
}

function RowDelta({ label, curr, prev, suffix = "", invertColor }: { label: string; curr: number; prev: number; suffix?: string; invertColor?: boolean }) {
  const d = curr - prev;
  const color = invertColor ? (d > 0 ? "#dc2626" : d < 0 ? "#10b981" : "#94a3b8") : (d > 0 ? "#10b981" : d < 0 ? "#dc2626" : "#94a3b8");
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="t-secondary">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="t-primary font-mono font-bold">{curr.toFixed(1)}{suffix}</span>
        <span className="text-[10px] font-mono" style={{ color }}>{d > 0 ? "+" : ""}{d.toFixed(1)}pp</span>
      </div>
    </div>
  );
}

function TopTable({ items, colKey, labelCol }: { items: { nombre: string; curr: number; prev: number; delta: number; absDelta: number; proveedor?: string }[]; colKey: string; labelCol: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700" style={{ background: "var(--bg-input)" }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700 text-[10px] t-muted">
            <th className="text-left py-2 px-3">#</th>
            <th className="text-left py-2 px-3">{labelCol}</th>
            <th className="text-right py-2 px-3">Actual</th>
            <th className="text-right py-2 px-3">Anterior</th>
            <th className="text-right py-2 px-3">Δ {colKey}</th>
            <th className="text-right py-2 px-3">Δ %</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.nombre + i} className="border-b border-gray-800/40">
              <td className="py-2 px-3 t-muted text-[10px]">{i + 1}</td>
              <td className="py-2 px-3 t-primary max-w-[280px] truncate" title={it.nombre}>{it.nombre}{it.proveedor ? <span className="t-muted text-[10px] ml-1">({it.proveedor.split("(")[0].trim()})</span> : null}</td>
              <td className="py-2 px-3 text-right font-mono">{fmt(it.curr)}</td>
              <td className="py-2 px-3 text-right font-mono t-muted">{fmt(it.prev)}</td>
              <td className="py-2 px-3 text-right font-mono" style={{ color: it.absDelta > 0 ? "#10b981" : it.absDelta < 0 ? "#dc2626" : "#94a3b8" }}>{it.absDelta > 0 ? "+" : ""}{fmt(it.absDelta)}</td>
              <td className="py-2 px-3 text-right font-mono font-bold" style={{ color: it.delta > 0 ? "#10b981" : it.delta < 0 ? "#dc2626" : "#94a3b8" }}>{it.delta > 0 ? "+" : ""}{it.delta}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
