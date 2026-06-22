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

type MesQ2 = "abril" | "mayo" | "junio";
const MESES_Q2: MesQ2[] = ["abril", "mayo", "junio"];
const MES_LABEL: Record<string, string> = { abril: "Abril", mayo: "Mayo", junio: "Junio" };
const MES_DIAS: Record<MesQ2, number> = { abril: 30, mayo: 31, junio: 30 };
const MES_NUM: Record<MesQ2, number> = { abril: 4, mayo: 5, junio: 6 };

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
  const [mesActual, setMesActual] = useState<MesQ2>("junio");
  const [opCurr, setOpCurr] = useState<OpSnapshot | null>(null);
  const [opPrev, setOpPrev] = useState<OpSnapshot | null>(null);
  const [resumenes, setResumenes] = useState<Record<string, ResumenMes>>({});
  const [meta, setMeta] = useState<MetaInfo>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const mesPrev: MesQ2 = mesActual === "junio" ? "mayo" : mesActual === "mayo" ? "abril" : "abril";

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [curRes, prevRes, mainRes] = await Promise.all([
        fetch(`/api/data/operational?country=${country}&mes=${mesActual}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/operational?country=${country}&mes=${mesPrev}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/${country}`).then((r) => r.json()).catch(() => null),
      ]);
      setOpCurr(curRes?.data || null);
      setOpPrev(prevRes?.data || null);
      const allData = (mainRes?.data || {}) as { resumen?: Record<string, ResumenMes>; meta_info?: MetaInfo };
      if (allData.resumen) {
        const map: Record<string, ResumenMes> = {};
        for (const m of MESES_Q2) {
          const r = allData.resumen[m];
          if (r) map[m] = { mes: m, ingresadas: r.ingresadas || 0, movilizadas: r.movilizadas || 0, entregadas: r.entregadas || 0, devueltas: r.devueltas || 0, en_proceso: r.en_proceso || 0 };
        }
        setResumenes(map);
      }
      if (allData.meta_info) setMeta(allData.meta_info);
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

  // Recomendaciones (heurísticas)
  const recomendaciones = useMemo(() => {
    const inmediatas: { titulo: string; detalle: string; impacto: "alto" | "medio" | "bajo" }[] = [];
    const inicio_mes: { titulo: string; detalle: string }[] = [];
    if (!kpis || !projeccion) return { inmediatas, inicio_mes };

    // 1. Caída de movilizadas
    if (kpis.mov.delta < -10) {
      inmediatas.push({
        titulo: `⬇️ Movilizadas cayeron ${Math.abs(kpis.mov.delta)}% vs ${MES_LABEL[mesPrev]}`,
        detalle: `Estás ${fmt(kpis.mov.prev - kpis.mov.curr)} órdenes por debajo del mes anterior. Identificá los productos/proveedores que más cayeron y reactivá su catálogo o promoción urgente.`,
        impacto: "alto",
      });
    } else if (kpis.mov.delta > 10) {
      inmediatas.push({
        titulo: `📈 Movilizadas crecieron ${kpis.mov.delta}% vs ${MES_LABEL[mesPrev]}`,
        detalle: `Buena tendencia (+${fmt(kpis.mov.curr - kpis.mov.prev)}). Sostené la inversión en los winners y empujá los DSs Top con incentivos.`,
        impacto: "medio",
      });
    }

    // 2. Tasa de entrega bajó
    if (kpis.pctEnt.curr < kpis.pctEnt.prev - 3) {
      inmediatas.push({
        titulo: `🚚 Tasa de entrega cayó ${(kpis.pctEnt.prev - kpis.pctEnt.curr).toFixed(1)} pp`,
        detalle: `Pasó de ${kpis.pctEnt.prev.toFixed(1)}% a ${kpis.pctEnt.curr.toFixed(1)}%. Revisá las transportadoras: si alguna bajó el pct_entrega, escalá con su responsable de logística HOY.`,
        impacto: "alto",
      });
    }

    // 3. Tasa de devolución subió
    if (kpis.pctDev.curr > kpis.pctDev.prev + 3) {
      inmediatas.push({
        titulo: `↩️ Devoluciones crecieron ${(kpis.pctDev.curr - kpis.pctDev.prev).toFixed(1)} pp`,
        detalle: `Pasó de ${kpis.pctDev.prev.toFixed(1)}% a ${kpis.pctDev.curr.toFixed(1)}%. Auditar los productos con más devoluciones, reforzar confirmación de teléfono y validación de dirección antes del despacho.`,
        impacto: "alto",
      });
    }

    // 4. Proyección vs meta
    if (metaMes.mov > 0) {
      if (!projeccion.onTrack && projeccion.diasRestantes > 0) {
        inmediatas.push({
          titulo: `🎯 No estás llegando a la meta de ${MES_LABEL[mesActual]}`,
          detalle: `Necesitás ${fmt(projeccion.necesarioDiario)} mov/día en los ${projeccion.diasRestantes} días restantes vs los ${fmt(projeccion.promedioDiarioActual)}/día actuales. Brecha total: ${fmt(projeccion.brechaAMeta)} órdenes. Acciones: contactar a los top 10 DSs con plan de empuje, lanzar promo de envío bonificado.`,
          impacto: "alto",
        });
      } else if (projeccion.onTrack) {
        inmediatas.push({
          titulo: `✅ Vas en camino a superar la meta (${projeccion.pctMeta}%)`,
          detalle: `Manteniendo el ritmo actual proyectás ${fmt(projeccion.proyectado)} vs meta ${fmt(metaMes.mov)}. Foco en sostener el ritmo y empujar hasta cerrar el mes.`,
          impacto: "medio",
        });
      }
    }

    // 5. Top productos en caída
    const prodCaida = topProductos
      .filter((p) => p.prev > 50 && p.delta < -25)
      .slice(0, 5);
    if (prodCaida.length > 0) {
      inmediatas.push({
        titulo: `📉 ${prodCaida.length} productos top cayeron >25%`,
        detalle: `Top en caída: ${prodCaida.slice(0, 3).map((p) => `${p.nombre} (${p.delta}%)`).join(" · ")}. Coordinar con sus proveedores: hay tema de stock, precio o demanda. Recuperar o reemplazar.`,
        impacto: "medio",
      });
    }

    // 6. Productos winners — replicar
    const prodWinner = topProductos
      .filter((p) => p.prev > 30 && p.delta > 30)
      .slice(0, 5);
    if (prodWinner.length > 0) {
      inmediatas.push({
        titulo: `🚀 ${prodWinner.length} productos crecieron >30%`,
        detalle: `Top winners: ${prodWinner.slice(0, 3).map((p) => `${p.nombre} (+${p.delta}%)`).join(" · ")}. Pedir al proveedor stock extra, dar visibilidad en el catálogo y a los Sabios VIP.`,
        impacto: "medio",
      });
    }

    // 7. Proveedores que cayeron mucho
    const provCaida = topProveedores
      .filter((p) => p.prev > 100 && p.delta < -20)
      .slice(0, 5);
    if (provCaida.length > 0) {
      inmediatas.push({
        titulo: `⚠️ ${provCaida.length} proveedores con caída >20%`,
        detalle: `Llamar HOY a: ${provCaida.slice(0, 3).map((p) => `${p.nombre.split("(")[0].trim()} (${p.delta}%)`).join(", ")}. Detectar si es stock, comisiones, problemas operativos.`,
        impacto: "alto",
      });
    }

    // === Acciones para arranque de mes ===
    inicio_mes.push({
      titulo: "🎯 Definir y comunicar la meta del mes el día 1",
      detalle: `Compartir la meta con todo el equipo desde el primer día — visibilidad genera urgencia. Para ${MES_LABEL[mesActual]} la meta fue ${fmt(metaMes.mov)} mov.`,
    });
    inicio_mes.push({
      titulo: "🚀 Reactivar dormidos en la primera semana",
      detalle: `Los registrados de los últimos 90 días que NO operaron son la pesca fácil. Lanzar campaña de bienvenida con bonus en envíos los primeros 7 días.`,
    });
    inicio_mes.push({
      titulo: "📦 Curar el catálogo con los winners del mes anterior",
      detalle: `Tomar los TOP 20 productos que mejor movieron en ${MES_LABEL[mesPrev]} y promocionarlos como "ganadores comprobados" a los nuevos DSs.`,
    });
    inicio_mes.push({
      titulo: "👥 Asignación de comerciales a los DSs Master+",
      detalle: `Los DSs con 300+ mov merecen un punto de contacto fijo. Asignar comercial por cartera y agendar 1 llamada quincenal en la primera semana.`,
    });
    inicio_mes.push({
      titulo: "📊 Setup del reporte semanal con los KPIs del mes",
      detalle: `Cada lunes: ingresadas vs meta, % entrega por transportadora, productos en caída/winners. Discusión 30 min con el equipo comercial y operaciones.`,
    });

    return { inmediatas, inicio_mes };
  }, [kpis, projeccion, metaMes, mesActual, mesPrev, topProductos, topProveedores]);

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
              <RowDelta label="% Entrega" curr={kpis.pctEnt.curr} prev={kpis.pctEnt.prev} suffix="%" />
              <RowDelta label="% Devolución" curr={kpis.pctDev.curr} prev={kpis.pctDev.prev} suffix="%" invertColor />
            </div>
          </div>
          <div className="rounded-lg p-4 border border-amber-500/30" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-[10px] t-muted uppercase tracking-wider mb-2">Progreso a meta {MES_LABEL[mesActual]}</h3>
            <div className="text-2xl font-bold t-primary">{fmt(kpis.mov.curr)}<span className="text-sm t-muted"> / {fmt(metaMes.mov)}</span></div>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
              <div className="h-full" style={{ width: `${Math.min(100, projeccion.pctMeta)}%`, background: projeccion.onTrack ? "#10b981" : "#f59e0b" }}></div>
            </div>
            <p className="text-[10px] t-muted mt-1">{projeccion.pctMeta}% de la meta — {projeccion.diasTranscurridos}/{projeccion.diasMes} días</p>
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

      {/* Recomendaciones */}
      <div className="rounded-xl p-4 border border-amber-500/40" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-3">💡 Recomendaciones — Acciones inmediatas</h2>
        {recomendaciones.inmediatas.length === 0 ? (
          <p className="text-xs t-muted">Sin acciones críticas detectadas con la data actual.</p>
        ) : (
          <div className="space-y-2">
            {recomendaciones.inmediatas.map((r, i) => (
              <div key={i} className="rounded-lg p-3 border" style={{ background: "var(--bg-input)",
                borderColor: r.impacto === "alto" ? "rgba(220,38,38,0.4)" : r.impacto === "medio" ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)" }}>
                <p className="text-sm font-bold t-primary mb-1">{r.titulo}</p>
                <p className="text-[11px] t-secondary">{r.detalle}</p>
                <span className="text-[9px] uppercase tracking-wider mt-1 inline-block" style={{
                  color: r.impacto === "alto" ? "#fca5a5" : r.impacto === "medio" ? "#fcd34d" : "#86efac" }}>
                  Impacto {r.impacto}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

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
