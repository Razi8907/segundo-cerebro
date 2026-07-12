"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { MesFilter } from "../types";

// ────────────────────────────────────────────────────────────────────────
// Tipos del snapshot operacional (subset que consumimos)
// ────────────────────────────────────────────────────────────────────────
interface OpSnapshot {
  total_orders?: number;
  by_status?: Record<string, number>;
  by_date?: { fecha: string; total: number; estados?: Record<string, number> }[];
  by_producto?: { nombre: string; ordenes: number; proveedor?: string }[];
  by_dropshipper?: { nombre: string; total: number }[];
  by_proveedor?: { nombre: string; id?: number; total: number }[];
  by_ds_daily?: { ds: string; dsId?: string; dsEmail?: string; dsCelular?: string; fecha: string; ordenes: number }[];
  by_prov_daily?: { proveedor: string; provId?: number; fecha: string; ordenes: number }[];
  logistics?: { tasa_entrega?: number; tasa_devolucion?: number };
}

// ────────────────────────────────────────────────────────────────────────
// Constantes de dominio
// ────────────────────────────────────────────────────────────────────────
const PREV_MONTH: Record<string, string> = {
  enero: "diciembre", febrero: "enero", marzo: "febrero", abril: "marzo",
  mayo: "abril", junio: "mayo", julio: "junio", agosto: "julio",
  septiembre: "agosto", octubre: "septiembre", noviembre: "octubre", diciembre: "noviembre",
};
const DIAS_MES: Record<string, number> = {
  enero: 31, febrero: 28, marzo: 31, abril: 30, mayo: 31, junio: 30,
  julio: 31, agosto: 31, septiembre: 30, octubre: 31, noviembre: 30, diciembre: 31,
};
const MES_NUM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const LABEL: Record<string, string> = {
  enero: "Enero", febrero: "Febrero", marzo: "Marzo", abril: "Abril", mayo: "Mayo",
  junio: "Junio", julio: "Julio", agosto: "Agosto", septiembre: "Septiembre",
  octubre: "Octubre", noviembre: "Noviembre", diciembre: "Diciembre",
};

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────
const dayOf = (s: string): number => {
  const m = s?.match(/^(\d{1,2})-/);
  return m ? +m[1] : 0;
};
const fmt = (n: number): string => Math.round(n).toLocaleString("es-AR");
const deltaPct = (curr: number, prev: number): number => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};

interface Area { ing: number; mov: number; ent: number; dev: number }

// Agrega órdenes por entidad (dropshipper/proveedor) hasta el día N
function aggByDaily<T extends { fecha: string; ordenes: number }>(
  rows: T[] | undefined, N: number, keyFn: (r: T) => string,
): Map<string, { orders: number; row: T }> {
  const map = new Map<string, { orders: number; row: T }>();
  for (const r of rows || []) {
    const day = dayOf(r.fecha);
    if (day > N || day < 1) continue;
    const key = keyFn(r);
    const prev = map.get(key);
    if (prev) prev.orders += r.ordenes || 0;
    else map.set(key, { orders: r.ordenes || 0, row: r });
  }
  return map;
}

interface Reco { icon: string; text: string }
interface DsReforzar { nombre: string; cur: number; prev: number; email?: string; celular?: string }

// Desglose diario canónico (viene de /api/data/operations-daily → get_ops_daily)
interface DailyRow {
  dia: number;
  ingresadas: number;
  movilizadas: number;
  entregadas: number;
  devueltas: number;
  canceladas: number;
}
function sumDaily(rows: DailyRow[], N: number): Area {
  const r: Area = { ing: 0, mov: 0, ent: 0, dev: 0 };
  for (const d of rows) {
    const dia = Number(d.dia);
    if (dia < 1 || dia > N) continue;
    r.ing += Number(d.ingresadas) || 0;
    r.mov += Number(d.movilizadas) || 0;
    r.ent += Number(d.entregadas) || 0;
    r.dev += Number(d.devueltas) || 0;
  }
  return r;
}

// ════════════════════════════════════════════════════════════════════════
export default function AccionesUrgentes({
  country,
  mes,
  metaInfo,
}: {
  country: "ar" | "py";
  mes: MesFilter;
  metaInfo: Record<string, number | undefined>;
}) {
  const realMes = LABEL[mes as string] ? (mes as string) : "julio";
  const mesPrev = PREV_MONTH[realMes] || "junio";

  const [opCurr, setOpCurr] = useState<OpSnapshot | null>(null);
  const [opPrev, setOpPrev] = useState<OpSnapshot | null>(null);
  const [dailyCurr, setDailyCurr] = useState<DailyRow[]>([]);
  const [dailyPrev, setDailyPrev] = useState<DailyRow[]>([]);
  const [comunidades, setComunidades] = useState<
    { comunidad: string; registrados: number; activos: number; pct_activacion: number }[] | null
  >(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cur, prev, dCur, dPrev, us] = await Promise.all([
        fetch(`/api/data/operational?country=${country}&mes=${realMes}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/operational?country=${country}&mes=${mesPrev}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/operations-daily?country=${country}&mes=${realMes}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/operations-daily?country=${country}&mes=${mesPrev}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/usuarios?country=${country}`).then((r) => r.json()).catch(() => null),
      ]);
      setOpCurr(cur?.data || null);
      setOpPrev(prev?.data || null);
      setDailyCurr(Array.isArray(dCur?.dias) ? dCur.dias : []);
      setDailyPrev(Array.isArray(dPrev?.dias) ? dPrev.dias : []);
      if (us && !us.error) setComunidades(us.comunidades_globales || us?.data?.comunidades_globales || null);
    } finally {
      setLoading(false);
    }
  }, [country, realMes, mesPrev]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const A = useMemo(() => {
    if (!dailyCurr.length) return null;

    // Rango de días a comparar (1 → N). Fuente: get_ops_daily (operations_data,
    // última fecha_carga, regla oficial de Operaciones).
    // N = último día con movilizadas/ingresadas, EXCLUYENDO el día en curso (hoy),
    // porque hoy está incompleto. Ej: hoy 12 → compara hasta el 11.
    // Para meses pasados se usa toda la data.
    const curDays = dailyCurr
      .filter((d) => (Number(d.movilizadas) || 0) > 0 || (Number(d.ingresadas) || 0) > 0)
      .map((d) => Number(d.dia))
      .filter((d) => d >= 1);
    const lastDataDay = curDays.length ? Math.max(...curDays) : 0;
    const now = new Date();
    const esMesEnCurso = now.getMonth() + 1 === MES_NUM[realMes];
    const N = esMesEnCurso ? Math.max(0, Math.min(lastDataDay, now.getDate() - 1)) : lastDataDay;
    const diasMes = DIAS_MES[realMes] || 30;
    const diasRestantes = Math.max(0, diasMes - N);

    // Totales por área en el mismo tramo 1→N (movilizadas = regla oficial)
    const cur = sumDaily(dailyCurr, N);
    const prev = sumDaily(dailyPrev, N);

    // Meta (sobre movilizadas)
    const metaMov = Number(metaInfo?.[`meta_movilizadas_${realMes}`] ?? 0);
    const ritmoActual = N > 0 ? cur.mov / N : 0;
    const proyeccion = Math.round(ritmoActual * diasMes);
    const restanteMeta = Math.max(0, metaMov - cur.mov);
    const ritmoNecesario = diasRestantes > 0 ? Math.ceil(restanteMeta / diasRestantes) : 0;
    const onTrack = metaMov > 0 && proyeccion >= metaMov;

    // Serie diaria acumulada (movilizadas) para el gráfico
    const curByDay = new Map<number, number>();
    const prevByDay = new Map<number, number>();
    for (const d of dailyCurr) {
      const day = Number(d.dia);
      if (day >= 1) curByDay.set(day, Number(d.movilizadas) || 0);
    }
    for (const d of dailyPrev) {
      const day = Number(d.dia);
      if (day >= 1) prevByDay.set(day, Number(d.movilizadas) || 0);
    }
    let accCur = 0, accPrev = 0;
    const serie: { dia: number; actual: number; anterior: number; meta: number }[] = [];
    const metaDiaria = metaMov > 0 ? metaMov / diasMes : 0;
    for (let d = 1; d <= N; d++) {
      accCur += curByDay.get(d) || 0;
      accPrev += prevByDay.get(d) || 0;
      serie.push({ dia: d, actual: accCur, anterior: accPrev, meta: Math.round(metaDiaria * d) });
    }

    // Barras comparativas por área
    const barras = [
      { area: "Ingresadas", actual: cur.ing, anterior: prev.ing },
      { area: "Movilizadas", actual: cur.mov, anterior: prev.mov },
      { area: "Entregadas", actual: cur.ent, anterior: prev.ent },
      { area: "Devoluciones", actual: cur.dev, anterior: prev.dev },
    ];

    // Tasa de devolución del tramo
    const tasaDevCur = cur.mov > 0 ? (cur.dev / cur.mov) * 100 : 0;
    const tasaDevPrev = prev.mov > 0 ? (prev.dev / prev.mov) * 100 : 0;

    // ── Comercial: dropshippers y proveedores por el mismo tramo (daily) ──
    const dsCur = aggByDaily(opCurr?.by_ds_daily, N, (r) => r.ds);
    const dsPrev = aggByDaily(opPrev?.by_ds_daily, N, (r) => r.ds);
    const dsNames = new Set<string>([...dsCur.keys(), ...dsPrev.keys()]);
    const dsActivosCur = [...dsCur.values()].filter((v) => v.orders > 0).length;
    const dsActivosPrev = [...dsPrev.values()].filter((v) => v.orders > 0).length;

    const reforzar: DsReforzar[] = [];
    const enAlza: DsReforzar[] = [];
    for (const nombre of dsNames) {
      const c = dsCur.get(nombre)?.orders || 0;
      const p = dsPrev.get(nombre)?.orders || 0;
      const contact = dsCur.get(nombre)?.row || dsPrev.get(nombre)?.row;
      // Reforzar: movían bien el mes pasado (≥5) y cayeron ≥40% (o se apagaron)
      if (p >= 5 && c < p * 0.6) {
        reforzar.push({ nombre, cur: c, prev: p, email: contact?.dsEmail, celular: contact?.dsCelular });
      }
      // En alza: crecieron vs el mes pasado (para acompañar y empujar)
      if (c > p && c >= 5) {
        enAlza.push({ nombre, cur: c, prev: p, email: contact?.dsEmail, celular: contact?.dsCelular });
      }
    }
    reforzar.sort((a, b) => (b.prev - b.cur) - (a.prev - a.cur));
    enAlza.sort((a, b) => (b.cur - b.prev) - (a.cur - a.prev));

    const provCur = aggByDaily(opCurr?.by_prov_daily, N, (r) => r.proveedor);
    const provPrev = aggByDaily(opPrev?.by_prov_daily, N, (r) => r.proveedor);
    const provActivosCur = [...provCur.values()].filter((v) => v.orders > 0).length;
    const provActivosPrev = [...provPrev.values()].filter((v) => v.orders > 0).length;

    // Productos (agregado de mes, referencial)
    const prodCur = (opCurr?.by_producto || []).filter((p) => (p.ordenes || 0) > 0).length;
    const prodPrev = (opPrev?.by_producto || []).filter((p) => (p.ordenes || 0) > 0).length;

    // ── Lo que funcionó en el mes anterior (mismo tramo) para replicar ──
    const ritmoPrev = N > 0 ? prev.mov / N : 0;
    const tasaEntCur = cur.mov > 0 ? (cur.ent / cur.mov) * 100 : 0;
    const tasaEntPrev = prev.mov > 0 ? (prev.ent / prev.mov) * 100 : 0;
    const topDsPrev: DsReforzar[] = [...dsPrev.entries()]
      .map(([nombre, v]) => ({ nombre, prev: v.orders, cur: dsCur.get(nombre)?.orders || 0, email: v.row?.dsEmail, celular: v.row?.dsCelular }))
      .filter((d) => d.prev > 0)
      .sort((a, b) => b.prev - a.prev)
      .slice(0, 6);
    const topProvPrev = [...provPrev.entries()]
      .map(([nombre, v]) => ({ nombre, prev: v.orders, cur: provCur.get(nombre)?.orders || 0 }))
      .filter((d) => d.prev > 0)
      .sort((a, b) => b.prev - a.prev)
      .slice(0, 5);
    const topProdPrev = (opPrev?.by_producto || [])
      .filter((p) => (p.ordenes || 0) > 0)
      .sort((a, b) => (b.ordenes || 0) - (a.ordenes || 0))
      .slice(0, 5)
      .map((p) => ({ nombre: p.nombre, ordenes: p.ordenes || 0, proveedor: p.proveedor }));

    // ── Motor de recomendaciones ──
    const refuerzos: Reco[] = [];
    const mejoras: Reco[] = [];
    const alertas: Reco[] = [];

    const dMov = deltaPct(cur.mov, prev.mov);
    const dEnt = deltaPct(cur.ent, prev.ent);
    const dIng = deltaPct(cur.ing, prev.ing);

    // Veredicto de meta
    if (metaMov > 0) {
      if (onTrack) {
        refuerzos.push({
          icon: "🎯",
          text: `Vas en ritmo para la meta: al paso actual (${fmt(ritmoActual)}/día) proyectás ${fmt(proyeccion)} movilizadas y la meta es ${fmt(metaMov)}. Sostené lo que estás haciendo.`,
        });
      } else {
        mejoras.push({
          icon: "🚀",
          text: `Al ritmo actual (${fmt(ritmoActual)}/día) proyectás ${fmt(proyeccion)} movilizadas, por debajo de la meta de ${fmt(metaMov)}. Necesitás ${fmt(ritmoNecesario)}/día en los ${diasRestantes} días que quedan${ritmoActual > 0 ? ` (${deltaPct(ritmoNecesario, ritmoActual) > 0 ? "+" : ""}${deltaPct(ritmoNecesario, ritmoActual)}% sobre el ritmo de hoy)` : ""}. Hay que empujar volumen ya.`,
        });
      }
    }

    // Replicar lo que funcionó en el mes anterior (mismo tramo)
    if (ritmoPrev > 0) {
      refuerzos.push({
        icon: "⏱️",
        text: ritmoActual >= ritmoPrev
          ? `En ${LABEL[mesPrev]} el tramo iba a ${fmt(ritmoPrev)} movilizadas/día y hoy vas a ${fmt(ritmoActual)}/día — ya lo estás igualando o superando. Sostené ese trabajo.`
          : `En ${LABEL[mesPrev]} el tramo iba a ${fmt(ritmoPrev)} movilizadas/día; hoy vas a ${fmt(ritmoActual)}/día. Replicá lo que hacían en ${LABEL[mesPrev]} para volver a ese ritmo.`,
      });
    }
    if (topDsPrev.length > 0) {
      refuerzos.push({
        icon: "🏅",
        text: `En ${LABEL[mesPrev]} el tramo lo empujaron ${topDsPrev.slice(0, 3).map((d) => d.nombre).join(", ")}. Replicá el acompañamiento que funcionó con ellos (detalle abajo).`,
      });
    }
    if (topProdPrev.length > 0) {
      refuerzos.push({
        icon: "🧴",
        text: `Productos ganadores de ${LABEL[mesPrev]}: ${topProdPrev.slice(0, 3).map((p) => p.nombre).join(", ")}. Reforzá stock y pauta de estos en ${LABEL[realMes]}.`,
      });
    }
    if (tasaEntPrev > 0 && tasaEntPrev > tasaEntCur + 2) {
      refuerzos.push({
        icon: "✅",
        text: `En ${LABEL[mesPrev]} entregaban al ${tasaEntPrev.toFixed(1)}% y ahora vas al ${tasaEntCur.toFixed(1)}%. Volvé a la logística/gestión que daba esa entrega.`,
      });
    }

    // Comparativa vs mes anterior
    if (dMov > 0) refuerzos.push({ icon: "📈", text: `Movilizadas +${dMov}% vs el mismo tramo de ${LABEL[mesPrev]} (${fmt(cur.mov)} vs ${fmt(prev.mov)}). Vas mejor — reforzá el foco actual.` });
    else if (dMov < 0) mejoras.push({ icon: "⚠️", text: `Movilizadas ${dMov}% vs ${LABEL[mesPrev]} (${fmt(cur.mov)} vs ${fmt(prev.mov)}). Estás por debajo del mes pasado en el mismo tramo — recuperá ritmo.` });

    if (dEnt > 0) refuerzos.push({ icon: "✅", text: `Entregas +${dEnt}% vs ${LABEL[mesPrev]} (${fmt(cur.ent)} vs ${fmt(prev.ent)}). La logística viene mejor.` });
    else if (dEnt < -5) mejoras.push({ icon: "📦", text: `Entregas ${dEnt}% vs ${LABEL[mesPrev]}. Revisá la operación logística y transportadoras.` });

    if (dIng > 0) refuerzos.push({ icon: "🛒", text: `Ingresadas +${dIng}% vs ${LABEL[mesPrev]} (${fmt(cur.ing)} vs ${fmt(prev.ing)}). Entran más pedidos — sostené la generación de demanda (pauta/activación).` });
    else if (dIng < 0) mejoras.push({ icon: "🛒", text: `Ingresadas ${dIng}% vs ${LABEL[mesPrev]} (${fmt(cur.ing)} vs ${fmt(prev.ing)}). Entran menos pedidos — más pauta, más activación y más productos para generar demanda.` });

    // Devoluciones
    if (tasaDevCur >= 30) alertas.push({ icon: "↩️", text: `Devoluciones al ${tasaDevCur.toFixed(1)}% de movilizadas (vs ${tasaDevPrev.toFixed(1)}% en ${LABEL[mesPrev]}). Alto — identificá productos y dropshippers que más devuelven y frená lo que peor entrega.` });
    else if (tasaDevCur > tasaDevPrev + 2) alertas.push({ icon: "↩️", text: `Devoluciones subieron: ${tasaDevCur.toFixed(1)}% vs ${tasaDevPrev.toFixed(1)}% el mes pasado. Vigilá antes de escalar volumen.` });

    // Dropshippers
    if (dsActivosCur < dsActivosPrev) alertas.push({ icon: "👥", text: `Tenés ${dsActivosCur} dropshippers activos vs ${dsActivosPrev} en el mismo tramo de ${LABEL[mesPrev]}. Faltan ${dsActivosPrev - dsActivosCur} — activá usuarios nuevos y recuperá a los que cayeron (lista abajo).` });
    else if (dsActivosCur > dsActivosPrev) refuerzos.push({ icon: "👥", text: `${dsActivosCur} dropshippers activos, +${dsActivosCur - dsActivosPrev} vs ${LABEL[mesPrev]}. Buena base — dales acompañamiento para que escalen.` });

    // Proveedores
    if (provActivosCur < provActivosPrev) alertas.push({ icon: "🏭", text: `Proveedores activos: ${provActivosCur} vs ${provActivosPrev} el mes pasado. Sumá proveedores para no depender de pocos y ampliar catálogo.` });

    if (reforzar.length > 0) alertas.push({ icon: "🤝", text: `${reforzar.length} dropshippers que movían fuerte cayeron este mes. Contactalos para acompañamiento cercano y recuperarlos (datos abajo).` });

    return {
      N, diasMes, diasRestantes, cur, prev, metaMov, ritmoActual, proyeccion,
      ritmoNecesario, restanteMeta, onTrack, serie, barras, tasaDevCur, tasaDevPrev,
      dsActivosCur, dsActivosPrev, provActivosCur, provActivosPrev, prodCur, prodPrev,
      reforzar: reforzar.slice(0, 8), enAlza: enAlza.slice(0, 5),
      refuerzos, mejoras, alertas, dMov,
      ritmoPrev, tasaEntCur, tasaEntPrev, topDsPrev, topProvPrev, topProdPrev,
    };
  }, [opCurr, opPrev, dailyCurr, dailyPrev, metaInfo, realMes, mesPrev]);

  // ── Estados de carga / sin data ──
  if (loading) {
    return <div className="glass-card p-8 text-center t-secondary">Analizando la data de {LABEL[realMes]}…</div>;
  }
  if (!A) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-lg font-bold t-primary">Todavía no hay data cargada de {LABEL[realMes]}</p>
        <p className="mt-2 text-sm t-secondary">
          Cargá la operación del mes en la pestaña <b>General → Cargar operación</b>. Apenas esté,
          este panel compara automáticamente el tramo de días de {LABEL[realMes]} contra {LABEL[mesPrev]}.
        </p>
      </div>
    );
  }

  const usuariosReg = comunidades?.reduce((a, c) => a + (c.registrados || 0), 0) || 0;
  const usuariosAct = comunidades?.reduce((a, c) => a + (c.activos || 0), 0) || 0;
  const pctAct = usuariosReg > 0 ? (usuariosAct / usuariosReg) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado + rango */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 t-primary">🚨 Acciones Urgentes — Seguimiento diario</h2>
        <p className="text-sm mt-1 t-secondary">
          Comparando <b className="t-primary">días 1 al {A.N} de {LABEL[realMes]}</b> contra el mismo tramo de{" "}
          <b className="t-primary">{LABEL[mesPrev]}</b>. Ingresadas de Seguimiento Diario · movilizadas de Operaciones.
        </p>
      </div>

      {/* KPIs del mes: ingresadas + movilizadas (lo más importante, arriba) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ActivityCard label={`Ingresadas (1–${A.N} ${LABEL[realMes]})`} cur={A.cur.ing} prev={A.prev.ing} mesPrev={LABEL[mesPrev]} />
        <ActivityCard label={`Movilizadas (1–${A.N} ${LABEL[realMes]})`} cur={A.cur.mov} prev={A.prev.mov} mesPrev={LABEL[mesPrev]} />
        <div className="glass-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">% Movilización</div>
          {(() => {
            const tCur = A.cur.ing > 0 ? (A.cur.mov / A.cur.ing) * 100 : 0;
            const tPrev = A.prev.ing > 0 ? (A.prev.mov / A.prev.ing) * 100 : 0;
            const dd = Math.round((tCur - tPrev) * 10) / 10;
            return (
              <>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold t-primary">{tCur.toFixed(1)}%</span>
                  <span className="text-xs font-semibold" style={{ color: dd >= 0 ? "#10b981" : "#ef4444" }}>
                    {dd > 0 ? "+" : ""}{dd} pp
                  </span>
                </div>
                <div className="text-xs mt-1 t-secondary">vs {tPrev.toFixed(1)}% en {LABEL[mesPrev]} · mov / ing</div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Veredicto meta */}
      {A.metaMov > 0 && (
        <div
          className="rounded-xl p-5 border"
          style={{
            background: A.onTrack ? "rgba(16,185,129,0.12)" : "rgba(249,115,22,0.12)",
            borderColor: A.onTrack ? "rgba(16,185,129,0.4)" : "rgba(249,115,22,0.4)",
          }}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">
                {A.onTrack ? "En ritmo para la meta" : "Atrasado vs la meta"}
              </div>
              <div className="mt-1 text-2xl font-bold t-primary">
                {fmt(A.cur.mov)} <span className="text-base t-secondary">/ {fmt(A.metaMov)} movilizadas</span>
              </div>
              <div className="text-sm mt-1 t-secondary">
                Proyección al cierre: <b className="t-primary">{fmt(A.proyeccion)}</b> · Ritmo actual {fmt(A.ritmoActual)}/día
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">
                {A.diasRestantes > 0 ? "Necesitás / día" : "Mes cerrado"}
              </div>
              <div className="text-2xl font-bold" style={{ color: A.onTrack ? "#10b981" : "#f97316" }}>
                {A.diasRestantes > 0 ? `${fmt(A.ritmoNecesario)}/día` : "—"}
              </div>
              {A.diasRestantes > 0 && (
                <div className="text-xs mt-1 t-secondary">faltan {A.diasRestantes} días · {fmt(A.restanteMeta)} movilizadas</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recomendaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecoColumn title="Reforzar lo que funciona" color="#10b981" recos={A.refuerzos} empty="Sin señales positivas fuertes todavía." />
        <RecoColumn title="Mejorar para llegar a la meta" color="#f97316" recos={A.mejoras} empty="Vas bien, nada crítico por mejorar." />
        <RecoColumn title="Alertas" color="#ef4444" recos={A.alertas} empty="Sin alertas activas 🎉" />
      </div>

      {/* Lo que funcionó en el mes anterior — replicar */}
      {(A.topDsPrev.length > 0 || A.topProdPrev.length > 0 || A.topProvPrev.length > 0) && (
        <div className="glass-card p-5" style={{ borderTop: "3px solid #10b981" }}>
          <h3 className="text-sm font-bold" style={{ color: "#10b981" }}>
            ✅ Lo que funcionó en {LABEL[mesPrev]} — replicá en {LABEL[realMes]}
          </h3>
          <p className="text-xs t-secondary mt-1">
            Lo que movió el mismo tramo de días en {LABEL[mesPrev]}. Copiá este trabajo para fortalecer {LABEL[realMes]}.
          </p>

          {/* Benchmarks del tramo */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">Ritmo del tramo (mov/día)</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold t-primary">{fmt(A.ritmoActual)}</span>
                <span className="text-xs t-secondary">{LABEL[realMes]}</span>
                <span className="text-xs t-muted">· {LABEL[mesPrev]} {fmt(A.ritmoPrev)}</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: A.ritmoActual >= A.ritmoPrev ? "#10b981" : "#f97316" }}>
                {A.ritmoActual >= A.ritmoPrev ? "Igualando o superando 👍" : `Replicá para recuperar ${fmt(A.ritmoPrev - A.ritmoActual)}/día`}
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">Tasa de entrega del tramo</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold t-primary">{A.tasaEntCur.toFixed(1)}%</span>
                <span className="text-xs t-secondary">{LABEL[realMes]}</span>
                <span className="text-xs t-muted">· {LABEL[mesPrev]} {A.tasaEntPrev.toFixed(1)}%</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: A.tasaEntCur >= A.tasaEntPrev ? "#10b981" : "#f97316" }}>
                {A.tasaEntCur >= A.tasaEntPrev ? "Manteniendo la entrega 👍" : "Volvé a la gestión que daba esa entrega"}
              </div>
            </div>
          </div>

          {/* Dropshippers que lideraron el tramo en el mes anterior */}
          {A.topDsPrev.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-semibold t-primary mb-2">Dropshippers que empujaron el tramo en {LABEL[mesPrev]}</div>
              <DsTable rows={A.topDsPrev} mesPrev={LABEL[mesPrev]} mesCur={LABEL[realMes]} />
            </div>
          )}

          {/* Top productos y proveedores del mes anterior */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {A.topProdPrev.length > 0 && (
              <div>
                <div className="text-xs font-semibold t-primary mb-2">Productos ganadores de {LABEL[mesPrev]} <span className="t-muted font-normal">(mes, referencial)</span></div>
                <ul className="space-y-1.5">
                  {A.topProdPrev.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="t-secondary truncate pr-2">
                        <span className="t-muted">#{i + 1}</span> {p.nombre}
                        {p.proveedor ? <span className="t-muted text-xs"> · {p.proveedor}</span> : null}
                      </span>
                      <span className="font-semibold t-primary shrink-0">{fmt(p.ordenes)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {A.topProvPrev.length > 0 && (
              <div>
                <div className="text-xs font-semibold t-primary mb-2">Proveedores clave del tramo en {LABEL[mesPrev]}</div>
                <ul className="space-y-1.5">
                  {A.topProvPrev.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="t-secondary truncate pr-2"><span className="t-muted">#{i + 1}</span> {p.nombre}</span>
                      <span className="shrink-0 t-secondary">
                        <b className="t-primary">{fmt(p.prev)}</b>
                        <span className="text-xs t-muted"> → {fmt(p.cur)} en {LABEL[realMes]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary mb-3">Movilizadas acumuladas — {LABEL[realMes]} vs {LABEL[mesPrev]}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={A.serie} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={48} />
              <Tooltip contentStyle={{ background: "var(--bg-tooltip)", border: "1px solid var(--border-tooltip)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="actual" name={LABEL[realMes]} stroke="#f97316" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="anterior" name={LABEL[mesPrev]} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              {A.metaMov > 0 && (
                <Line type="monotone" dataKey="meta" name="Ritmo meta" stroke="#10b981" strokeWidth={1.5} strokeDasharray="2 2" dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary mb-3">Por área — tramo 1 al {A.N} ({LABEL[realMes]} vs {LABEL[mesPrev]})</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={A.barras} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" />
              <XAxis dataKey="area" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={48} />
              <Tooltip contentStyle={{ background: "var(--bg-tooltip)", border: "1px solid var(--border-tooltip)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="anterior" name={LABEL[mesPrev]} fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" name={LABEL[realMes]} fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comercial: métricas de actividad */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ActivityCard label="Dropshippers activos" cur={A.dsActivosCur} prev={A.dsActivosPrev} mesPrev={LABEL[mesPrev]} />
        <ActivityCard label="Proveedores activos" cur={A.provActivosCur} prev={A.provActivosPrev} mesPrev={LABEL[mesPrev]} />
        <div className="glass-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">Productos con ventas</div>
          <div className="mt-1 text-2xl font-bold t-primary">{fmt(A.prodCur)}</div>
          <div className="text-xs mt-1 t-secondary">en el tramo 1–{A.N} de {LABEL[realMes]}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">Activación usuarios</div>
          <div className="mt-1 text-2xl font-bold t-primary">{comunidades ? `${pctAct.toFixed(1)}%` : "—"}</div>
          <div className="text-xs mt-1 t-secondary">{comunidades ? `${fmt(usuariosAct)} activos / ${fmt(usuariosReg)} reg.` : "sin data de usuarios"}</div>
        </div>
      </div>

      {/* Usuarios a reforzar */}
      {A.reforzar.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary">🤝 Usuarios a reforzar — cayeron vs {LABEL[mesPrev]}</h3>
          <p className="text-xs t-secondary mt-1 mb-3">Movían fuerte el mes pasado y bajaron en el mismo tramo. Acompañamiento cercano para recuperarlos.</p>
          <DsTable rows={A.reforzar} mesPrev={LABEL[mesPrev]} mesCur={LABEL[realMes]} />
        </div>
      )}

      {/* Usuarios en alza */}
      {A.enAlza.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary">🔥 Usuarios en alza — para empujar y escalar</h3>
          <p className="text-xs t-secondary mt-1 mb-3">Crecieron vs {LABEL[mesPrev]}. Dales continuidad y acompañamiento para que sigan subiendo.</p>
          <DsTable rows={A.enAlza} mesPrev={LABEL[mesPrev]} mesCur={LABEL[realMes]} />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
function RecoColumn({ title, color, recos, empty }: { title: string; color: string; recos: Reco[]; empty: string }) {
  return (
    <div className="glass-card p-4" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-sm font-bold mb-3" style={{ color }}>{title}</div>
      {recos.length === 0 ? (
        <p className="text-xs t-muted">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {recos.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm t-secondary">
              <span className="shrink-0">{r.icon}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityCard({ label, cur, prev, mesPrev }: { label: string; cur: number; prev: number; mesPrev: string }) {
  const d = deltaPct(cur, prev);
  const good = d >= 0;
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider t-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold t-primary">{fmt(cur)}</span>
        <span className="text-xs font-semibold" style={{ color: good ? "#10b981" : "#ef4444" }}>
          {d > 0 ? "+" : ""}{d}%
        </span>
      </div>
      <div className="text-xs mt-1 t-secondary">vs {fmt(prev)} en {mesPrev}</div>
    </div>
  );
}

function DsTable({ rows, mesPrev, mesCur }: { rows: DsReforzar[]; mesPrev: string; mesCur: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="t-muted text-[11px] uppercase tracking-wider">
            <th className="text-left py-2 pr-3">Dropshipper</th>
            <th className="text-right py-2 px-2">{mesPrev}</th>
            <th className="text-right py-2 px-2">{mesCur}</th>
            <th className="text-right py-2 px-2">Δ</th>
            <th className="text-left py-2 pl-3">Contacto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const d = deltaPct(r.cur, r.prev);
            return (
              <tr key={i} className="border-t" style={{ borderColor: "var(--bg-card-border)" }}>
                <td className="py-2 pr-3 t-primary font-medium">{r.nombre}</td>
                <td className="text-right py-2 px-2 t-secondary">{fmt(r.prev)}</td>
                <td className="text-right py-2 px-2 t-secondary">{fmt(r.cur)}</td>
                <td className="text-right py-2 px-2 font-semibold" style={{ color: d >= 0 ? "#10b981" : "#ef4444" }}>{d > 0 ? "+" : ""}{d}%</td>
                <td className="py-2 pl-3 t-muted text-xs">
                  {r.celular ? <span>{r.celular}</span> : null}
                  {r.celular && r.email ? " · " : null}
                  {r.email ? <span>{r.email}</span> : null}
                  {!r.celular && !r.email ? "—" : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
