"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend,
} from "recharts";

// Estados que se consideran NO movilizadas (alineado con el resto del dashboard)
const NO_MOV = new Set([
  "PENDIENTE","PENDIENTE CONFIRMACION","GUIA_GENERADA","PREPARADO PARA TRANSPORTADORA",
  "CANCELADO","RECHAZADO","GUIA ANULADA","CANCELADO POR TRANSPORTADORA",
]);

type Mes = "abril" | "mayo" | "junio";
type ByDS = { nombre: string; total: number; estados: Record<string, number> };
type ByDSDaily = { ds: string; fecha: string; ordenes: number };
type ByDate = { fecha: string; total: number; estados: Record<string, number> };

function dayOfMonth(fechaStr: string): number | null {
  const m = fechaStr.match(/^(\d{1,2})[-/]/);
  return m ? parseInt(m[1], 10) : null;
}

function movFromEstados(estados: Record<string, number>): number {
  let total = 0;
  let noMov = 0;
  for (const k in estados) {
    total += estados[k] || 0;
    if (NO_MOV.has(k)) noMov += estados[k] || 0;
  }
  return Math.max(total - noMov, 0);
}

const MES_MONTH_NUM: Record<Mes, number> = { abril: 4, mayo: 5, junio: 6 };
const MES_LABEL: Record<Mes, string> = { abril: "Abril", mayo: "Mayo", junio: "Junio" };
const MES_DIAS_DEFAULT: Record<Mes, number> = { abril: 30, mayo: 31, junio: 30 };

function prevMes(m: Mes): Mes | null {
  if (m === "junio") return "mayo";
  if (m === "mayo") return "abril";
  return null; // abril no tiene mes anterior con data
}

function aggregateDS(rows: ByDS[]): Map<string, { ing: number; mov: number; nombre: string }> {
  const map = new Map<string, { ing: number; mov: number; nombre: string }>();
  for (const r of rows) {
    const e = r.estados || {};
    let noMov = 0;
    for (const k in e) if (NO_MOV.has(k)) noMov += e[k] || 0;
    const total = r.total || 0;
    const mov = total - noMov;
    const clean = String(r.nombre).replace(/\s*\(\d+\)\s*$/, "").trim();
    map.set(clean, { ing: total, mov, nombre: r.nombre });
  }
  return map;
}

function activeDaysByDS(daily: ByDSDaily[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of daily) {
    if (!r.ds || !r.ordenes) continue;
    const clean = String(r.ds).replace(/\s*\(\d+\)\s*$/, "").trim();
    if (!map.has(clean)) map.set(clean, new Set());
    map.get(clean)!.add(r.fecha);
  }
  return map;
}

export default function MinimoDiario({ country, mes }: { country: "ar" | "py"; mes: Mes }) {
  const mesBase: Mes = prevMes(mes) ?? mes;
  const isSameBase = prevMes(mes) === null;

  const [opsBase, setOpsBase] = useState<ByDS[]>([]);
  const [opsTarget, setOpsTarget] = useState<ByDS[]>([]);
  const [dailyBase, setDailyBase] = useState<ByDSDaily[]>([]);
  const [dailyTarget, setDailyTarget] = useState<ByDSDaily[]>([]);
  const [byDateTarget, setByDateTarget] = useState<ByDate[]>([]);
  const [metaInfo, setMetaInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  // Simulador: # de DSs activos hipotéticos para el target
  const [simDs, setSimDs] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [opBase, opTar, dash] = await Promise.all([
        fetch(`/api/data/operational?country=${country}&mes=${mesBase}`).then(r => r.json()).catch(() => null),
        fetch(`/api/data/operational?country=${country}&mes=${mes}`).then(r => r.json()).catch(() => null),
        fetch(`/api/data/${country}`).then(r => r.json()).catch(() => null),
      ]);
      setOpsBase(Array.isArray(opBase?.data?.by_dropshipper) ? opBase.data.by_dropshipper : []);
      setOpsTarget(Array.isArray(opTar?.data?.by_dropshipper) ? opTar.data.by_dropshipper : []);
      setDailyBase(Array.isArray(opBase?.data?.by_ds_daily) ? opBase.data.by_ds_daily : []);
      setDailyTarget(Array.isArray(opTar?.data?.by_ds_daily) ? opTar.data.by_ds_daily : []);
      setByDateTarget(Array.isArray(opTar?.data?.by_date) ? opTar.data.by_date : []);
      setMetaInfo(dash?.meta_info || {});
    } finally {
      setLoading(false);
    }
  }, [country, mes, mesBase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Determinar si el mes target está EN CURSO según el calendario (no por filtro)
  const today = new Date();
  const monthInCourse = today.getFullYear() === 2026 && (today.getMonth() + 1) === MES_MONTH_NUM[mes];
  const diasMes = (metaInfo[`dias_${mes}`] as number) ?? MES_DIAS_DEFAULT[mes];
  const diaActual = monthInCourse ? today.getDate() : diasMes;
  const diasTranscurridos = Math.max(1, Math.min(diaActual, diasMes));
  const diasRestantes = monthInCourse ? Math.max(1, diasMes - diasTranscurridos) : 0;

  // % movilización país basado en mes base (cerrado)
  const totalsBase = useMemo(() => {
    const m = aggregateDS(opsBase);
    let ing = 0, mov = 0;
    m.forEach((v) => { ing += v.ing; mov += v.mov; });
    return { ing, mov, pctMov: ing > 0 ? mov / ing : 0 };
  }, [opsBase]);

  const dsBase = useMemo(() => aggregateDS(opsBase), [opsBase]);
  const dsTarget = useMemo(() => aggregateDS(opsTarget), [opsTarget]);
  const activeDaysBase = useMemo(() => activeDaysByDS(dailyBase), [dailyBase]);
  const activeDaysTarget = useMemo(() => activeDaysByDS(dailyTarget), [dailyTarget]);

  const activosBase = Array.from(dsBase.values()).filter(v => v.ing > 0).length;
  const activosTarget = Array.from(dsTarget.values()).filter(v => v.ing > 0).length;

  // Metas del mes target (con fallback al mes base)
  const metaMov = metaInfo[`meta_movilizadas_${mes}`]
    ?? metaInfo[`meta_movilizadas_${mesBase}`] ?? 0;
  const metaIng = metaInfo[`meta_ingresadas_${mes}`]
    ?? (totalsBase.pctMov > 0 ? Math.round(metaMov / totalsBase.pctMov) : (metaInfo[`meta_ingresadas_${mesBase}`] ?? 0));

  // Real del target (a la fecha si está en curso, o total si está cerrado)
  const movRealTarget = useMemo(() => {
    let mov = 0;
    dsTarget.forEach((v) => { mov += v.mov; });
    return mov;
  }, [dsTarget]);
  const ingRealTarget = useMemo(() => {
    let ing = 0;
    dsTarget.forEach((v) => { ing += v.ing; });
    return ing;
  }, [dsTarget]);

  const movPendiente = Math.max(metaMov - movRealTarget, 0);
  // La brecha de ingresadas debe ser al menos la brecha de movilizadas / % de
  // movilización del país (porque movilizadas es un subconjunto de ingresadas).
  // Si ya ingresaste de más pero te falta movilizar, igual tenés que cargar
  // más para que el % de mov real cubra la meta de mov.
  const ingPendienteRaw = Math.max(metaIng - ingRealTarget, 0);
  const ingPendienteFromMov = totalsBase.pctMov > 0 ? movPendiente / totalsBase.pctMov : ingPendienteRaw;
  const ingPendiente = Math.max(ingPendienteRaw, ingPendienteFromMov);

  // ─── BASELINE (DSs activos del mes base) ───
  const baselineDsCount = Math.max(activosBase, 1);
  const baselineMovPerDsTotal = metaMov / baselineDsCount;
  const baselineIngPerDsTotal = metaIng / baselineDsCount;
  const baselineMovPerDsPerDay = baselineMovPerDsTotal / diasMes;
  const baselineIngPerDsPerDay = baselineIngPerDsTotal / diasMes;

  // ─── LIVE / RETROSPECTIVE ───
  // En curso → brecha / activos / días restantes (lo que falta desde mañana).
  // Cerrado → meta total / activos del mes / días del mes (lo que cada uno tuvo que hacer en promedio).
  const liveDsCount = Math.max(activosTarget, 1);
  const liveMovPerDs = monthInCourse
    ? movPendiente / liveDsCount / diasRestantes
    : metaMov / liveDsCount / diasMes;
  const liveIngPerDs = monthInCourse
    ? ingPendiente / liveDsCount / diasRestantes
    : metaIng / liveDsCount / diasMes;

  // ─── Tabla por DS (cuota proporcional al share en mes base) ───
  const tabla = useMemo(() => {
    let totalMovBase = 0;
    dsBase.forEach((v) => { totalMovBase += v.mov; });
    const allKeys = new Set<string>([...dsBase.keys(), ...dsTarget.keys()]);
    const rows: any[] = [];
    allKeys.forEach((nombre) => {
      const b = dsBase.get(nombre) || { ing: 0, mov: 0, nombre };
      const t = dsTarget.get(nombre) || { ing: 0, mov: 0, nombre };
      const baseDays = (activeDaysBase.get(nombre)?.size) || 0;
      const targetDays = (activeDaysTarget.get(nombre)?.size) || 0;
      const baseMovPorDia = baseDays > 0 ? b.mov / baseDays : 0;
      const targetMovPorDia = targetDays > 0 ? t.mov / targetDays : 0;

      // Cuota mensual = share del DS en mes base aplicada a la meta del target
      const share = totalMovBase > 0 ? b.mov / totalMovBase : 1 / Math.max(allKeys.size, 1);
      const cuotaMov = metaMov * share;
      const cuotaRestante = monthInCourse ? Math.max(cuotaMov - t.mov, 0) : cuotaMov;
      const divisor = monthInCourse ? diasRestantes : diasMes;
      const reqMovPorDia = divisor > 0 ? cuotaRestante / divisor : 0;
      const reqIngPorDia = totalsBase.pctMov > 0 ? reqMovPorDia / totalsBase.pctMov : 0;
      const gap = reqMovPorDia - targetMovPorDia;

      rows.push({
        nombre,
        baseIng: b.ing, baseMov: b.mov, baseDays, baseMovPorDia,
        targetIng: t.ing, targetMov: t.mov, targetDays, targetMovPorDia,
        reqMovPorDia, reqIngPorDia, gap,
        cuotaMov,
      });
    });
    rows.sort((a, b) => (b.baseMov + b.targetMov) - (a.baseMov + a.targetMov));
    return rows;
  }, [dsBase, dsTarget, activeDaysBase, activeDaysTarget, metaMov, diasMes, diasRestantes, monthInCourse, totalsBase.pctMov]);

  const tablaFiltrada = useMemo(() => {
    let r = tabla;
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter((x) => x.nombre.toLowerCase().includes(s));
    }
    return r;
  }, [tabla, search]);

  // Escenarios: cuántos DSs activar para diluir la carga
  const escenarios = useMemo(() => {
    const targets = [1.5, 2, 3];
    return targets.map((mult) => {
      const movPorDsTarget = baselineMovPerDsPerDay / mult;
      const dsNecesarios = movPorDsTarget > 0 ? Math.ceil(metaMov / diasMes / movPorDsTarget) : 0;
      const adicionales = Math.max(dsNecesarios - activosBase, 0);
      return {
        mult,
        dsNecesarios,
        adicionales,
        movPorDsTarget,
        ingPorDsTarget: totalsBase.pctMov > 0 ? movPorDsTarget / totalsBase.pctMov : 0,
      };
    });
  }, [baselineMovPerDsPerDay, metaMov, diasMes, activosBase, totalsBase.pctMov]);

  // ─── Simulador ───
  // Cuando cambia el mes base recalculamos el default del simulador.
  useEffect(() => {
    if (simDs === null && activosBase > 0) setSimDs(activosBase);
  }, [activosBase, simDs]);

  const simDsValue = simDs ?? Math.max(activosBase, 1);
  const simMovPerDsPerDay = simDsValue > 0 ? metaMov / simDsValue / diasMes : 0;
  const simIngPerDsPerDay = totalsBase.pctMov > 0 ? simMovPerDsPerDay / totalsBase.pctMov : 0;

  // Curva: para un rango de #DSs (de 10% a 200% del baseline), calcular
  // las guías mov/día/DS necesarias para llegar a la meta del target.
  // Y otra curva con la meta del mes base como referencia.
  const simChart = useMemo(() => {
    const minDs = Math.max(10, Math.floor(activosBase * 0.3));
    const maxDs = Math.max(Math.ceil(activosBase * 2.0), simDsValue + 50, 200);
    const step = Math.max(1, Math.round((maxDs - minDs) / 40));
    const data: { ds: number; targetMov: number; targetIng: number; baseMov: number; baseIng: number }[] = [];
    const metaMovBase = metaInfo[`meta_movilizadas_${mesBase}`] ?? totalsBase.mov;
    const metaIngBase = metaInfo[`meta_ingresadas_${mesBase}`] ?? totalsBase.ing;
    const diasBase = (metaInfo[`dias_${mesBase}`] as number) ?? MES_DIAS_DEFAULT[mesBase];
    for (let n = minDs; n <= maxDs; n += step) {
      data.push({
        ds: n,
        targetMov: n > 0 ? metaMov / n / diasMes : 0,
        targetIng: n > 0 && totalsBase.pctMov > 0 ? (metaMov / n / diasMes) / totalsBase.pctMov : 0,
        baseMov: n > 0 ? metaMovBase / n / diasBase : 0,
        baseIng: n > 0 && totalsBase.pctMov > 0 ? (metaMovBase / n / diasBase) / totalsBase.pctMov : 0,
      });
    }
    return data;
  }, [activosBase, simDsValue, metaMov, diasMes, totalsBase, mesBase, metaInfo]);

  // ─── Análisis día por día (target mes) ───
  // Para cada día del mes: # DSs activos ese día, ing/mov del día, promedios
  // por DS activo, y cuánto cada activo tuvo que mover según la brecha al
  // arranque del día.
  const dailyAnalysis = useMemo(() => {
    // Build day → { activeDs, ing, mov } maps
    type DaySlot = { dia: number; activeDs: number; ing: number; mov: number };
    const slots: DaySlot[] = [];
    for (let d = 1; d <= diasMes; d++) slots.push({ dia: d, activeDs: 0, ing: 0, mov: 0 });

    // ing y activos desde by_ds_daily
    const dsByDay = new Map<number, Set<string>>();
    for (const row of dailyTarget) {
      const d = dayOfMonth(row.fecha);
      if (!d || d < 1 || d > diasMes) continue;
      slots[d - 1].ing += row.ordenes || 0;
      if (!dsByDay.has(d)) dsByDay.set(d, new Set());
      if (row.ds && (row.ordenes || 0) > 0) {
        dsByDay.get(d)!.add(String(row.ds).replace(/\s*\(\d+\)\s*$/, "").trim());
      }
    }
    dsByDay.forEach((set, d) => { slots[d - 1].activeDs = set.size; });

    // mov desde by_date
    for (const row of byDateTarget) {
      const d = dayOfMonth(row.fecha);
      if (!d || d < 1 || d > diasMes) continue;
      slots[d - 1].mov = movFromEstados(row.estados || {});
    }

    // Acumulado + necesario por día
    let movAcum = 0;
    const out = slots.map((s) => {
      const movAcumPrev = movAcum;
      movAcum += s.mov;
      const movRestante = Math.max(metaMov - movAcumPrev, 0);
      const diasRestantesAlInicio = Math.max(diasMes - s.dia + 1, 1);
      const reqMovDiaPais = movRestante / diasRestantesAlInicio;
      const reqIngDiaPais = totalsBase.pctMov > 0 ? reqMovDiaPais / totalsBase.pctMov : 0;
      const movPerDsReal = s.activeDs > 0 ? s.mov / s.activeDs : 0;
      const ingPerDsReal = s.activeDs > 0 ? s.ing / s.activeDs : 0;
      const reqMovPerDs = s.activeDs > 0 ? reqMovDiaPais / s.activeDs : 0;
      const reqIngPerDs = s.activeDs > 0 ? reqIngDiaPais / s.activeDs : 0;
      const tieneData = s.activeDs > 0 || s.ing > 0;
      return {
        dia: s.dia,
        activeDs: s.activeDs,
        ing: s.ing,
        mov: s.mov,
        ingPerDsReal,
        movPerDsReal,
        reqMovPerDs,
        reqIngPerDs,
        reqMovDiaPais,
        gap: reqMovPerDs - movPerDsReal,
        tieneData,
        // Para mes en curso: si el día ya pasó (≤ diasTranscurridos) → "real"; sino → "futuro/proyección"
        isPast: !monthInCourse ? true : s.dia <= diasTranscurridos,
      };
    });
    return out;
  }, [dailyTarget, byDateTarget, diasMes, metaMov, totalsBase.pctMov, monthInCourse, diasTranscurridos]);

  if (loading) {
    return <div className="glass-card p-6 t-muted text-sm">Cargando análisis de mínimo diario…</div>;
  }

  const labelTarget = MES_LABEL[mes];
  const labelBase = MES_LABEL[mesBase];

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">
          📐 Mínimo Diario — {labelTarget} 2026 {monthInCourse && <span className="text-[11px] text-green-400 ml-1">(EN CURSO)</span>}
          {!monthInCourse && <span className="text-[11px] text-gray-400 ml-1">(cerrado)</span>}
        </h2>
        <p className="text-[11px] t-muted">
          {monthInCourse
            ? `Cuánto necesita movilizar cada DS por día para llegar a la meta de ${labelTarget}. Basado en la cartera de ${labelBase} y ajustado por los activos de ${labelTarget} hasta el día ${diasTranscurridos}.`
            : `Análisis retrospectivo: cuántos DSs estuvieron activos en ${labelTarget}, cuánto hizo cada uno y cuánto deberían haber hecho para llegar a la meta. Base: ${labelBase}.`}
        </p>
        {isSameBase && (
          <p className="text-[10px] mt-1 text-amber-300">⚠️ Para {labelTarget} no hay snapshot Comercial del mes anterior — el "base" usa los mismos datos de {labelTarget}.</p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label={`Meta Movilizadas ${labelTarget}`} value={metaMov.toLocaleString("es-AR")} color="#f97316" />
        <Kpi label={`Meta Ingresadas ${labelTarget}`} value={metaIng.toLocaleString("es-AR")} color="#0891b2" />
        <Kpi label={`% Movilización país (${labelBase})`} value={`${(totalsBase.pctMov * 100).toFixed(1)}%`} color="#10b981" sub={`${totalsBase.mov.toLocaleString("es-AR")} / ${totalsBase.ing.toLocaleString("es-AR")}`} />
        <Kpi label={`DSs activos ${labelBase}`} value={activosBase.toLocaleString("es-AR")} color="#a78bfa" />
        <Kpi label={`DSs activos ${labelTarget}`} value={activosTarget.toLocaleString("es-AR")} color="#a78bfa" sub={monthInCourse ? `hasta día ${diasTranscurridos}` : "mes cerrado"} />
        <Kpi label={monthInCourse ? "Días restantes" : "Días del mes"} value={(monthInCourse ? diasRestantes : diasMes).toLocaleString("es-AR")} color="#dc2626" sub={`de ${diasMes}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ProgressCard label={`Movilizadas ${labelTarget} (real vs meta)`} actual={movRealTarget} target={metaMov} color="#10b981" />
        <ProgressCard label={`Ingresadas ${labelTarget} (real vs meta)`} actual={ingRealTarget} target={metaIng} color="#0891b2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">📊 BASELINE — Cartera {labelBase}</h3>
          <p className="text-[11px] t-muted mb-3">{activosBase} DSs activos, distribuidos en {diasMes} días.</p>
          <div className="space-y-2">
            <PerDsRow label="Movilizadas / DS / día" value={baselineMovPerDsPerDay} color="#10b981" suffix=" guías" />
            <PerDsRow label="Ingresadas / DS / día" value={baselineIngPerDsPerDay} color="#0891b2" suffix=" guías" />
            <PerDsRow label="Total mensual / DS — movilizadas" value={baselineMovPerDsTotal} color="#f59e0b" suffix=" guías" />
            <PerDsRow label="Total mensual / DS — ingresadas" value={baselineIngPerDsTotal} color="#f59e0b" suffix=" guías" />
          </div>
        </div>
        <div className="rounded-xl p-4 border border-orange-500/30" style={{ background: "rgba(249,115,22,0.05)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">
            {monthInCourse ? `🎯 LIVE — Ajustado a activos de ${labelTarget}` : `📈 PROMEDIO — Cartera ${labelTarget}`}
          </h3>
          <p className="text-[11px] t-muted mb-3">
            {monthInCourse
              ? `${activosTarget} DSs activos al día ${diasTranscurridos}. Brecha / activos / ${diasRestantes} días restantes.`
              : `${activosTarget} DSs activos en el mes cerrado. Meta total / activos / ${diasMes} días.`}
          </p>
          <div className="space-y-2">
            <PerDsRow label="Movilizadas / DS / día" value={liveMovPerDs} color="#10b981" suffix=" guías" />
            <PerDsRow label="Ingresadas / DS / día" value={liveIngPerDs} color="#0891b2" suffix=" guías" />
            {monthInCourse && (
              <>
                <PerDsRow label="Brecha movilizadas pendiente" value={movPendiente} color="#f59e0b" suffix=" guías" intRound />
                <PerDsRow label="Brecha ingresadas pendiente" value={ingPendiente} color="#f59e0b" suffix=" guías" intRound />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Escenarios */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h3 className="text-sm font-bold t-primary mb-2">🧭 Escenarios — ¿Crecer con los actuales o activar más?</h3>
        <p className="text-[11px] t-muted mb-3">Cuántos DSs activos necesitarías para que cada uno tenga una carga más liviana.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {escenarios.map((e) => (
            <div key={e.mult} className="rounded-lg p-3 border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
              <p className="text-[10px] t-muted uppercase tracking-wider">{e.mult.toFixed(1)}× más DSs activos</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#a78bfa" }}>{e.dsNecesarios.toLocaleString("es-AR")}</p>
              <p className="text-[11px] t-secondary">DSs activos totales</p>
              <p className="text-[11px] mt-1" style={{ color: e.adicionales > 0 ? "#f59e0b" : "#10b981" }}>
                {e.adicionales > 0 ? `+${e.adicionales} nuevos` : "≤ activos actuales"}
              </p>
              <hr className="my-2 border-gray-700/40" />
              <p className="text-[10px] t-muted">Cada uno necesita por día:</p>
              <p className="text-[11px]">
                <span className="font-bold" style={{ color: "#10b981" }}>{e.movPorDsTarget.toFixed(1)}</span> mov
                {" · "}
                <span className="font-bold" style={{ color: "#0891b2" }}>{e.ingPorDsTarget.toFixed(1)}</span> ing
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Análisis día por día */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h3 className="text-sm font-bold t-primary mb-1">📅 Análisis día por día — {labelTarget}</h3>
        <p className="text-[11px] t-muted mb-3">
          Movimiento real por DS activo cada día vs lo que cada uno necesitaba mover (según la brecha al arranque del día y los DSs activos esa jornada).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 text-[10px] t-muted">
                <th className="text-left py-2 px-2">Día</th>
                <th className="text-right py-2 px-2">DSs activos</th>
                <th className="text-right py-2 px-2">Ing. del día</th>
                <th className="text-right py-2 px-2">Mov. del día</th>
                <th className="text-right py-2 px-2">Ing/DS real</th>
                <th className="text-right py-2 px-2">Mov/DS real</th>
                <th className="text-right py-2 px-2 text-cyan-300">Ing/DS necesario</th>
                <th className="text-right py-2 px-2 text-orange-300">Mov/DS necesario</th>
                <th className="text-right py-2 px-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {dailyAnalysis.map((d) => (
                <tr key={d.dia} className={`border-b border-gray-800/40 ${d.isPast ? "" : "opacity-60"}`}>
                  <td className="py-2 px-2 t-primary font-medium">{d.dia}{!d.isPast && <span className="text-[9px] t-muted ml-1">(proy)</span>}</td>
                  <td className="py-2 px-2 text-right font-mono">{d.activeDs.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right font-mono">{d.tieneData ? d.ing.toLocaleString("es-AR") : "—"}</td>
                  <td className="py-2 px-2 text-right font-mono text-orange-400">{d.tieneData ? d.mov.toLocaleString("es-AR") : "—"}</td>
                  <td className="py-2 px-2 text-right font-mono">{d.tieneData ? d.ingPerDsReal.toFixed(1) : "—"}</td>
                  <td className="py-2 px-2 text-right font-mono">{d.tieneData ? d.movPerDsReal.toFixed(1) : "—"}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-cyan-300">{d.activeDs > 0 ? d.reqIngPerDs.toFixed(1) : "—"}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-orange-300">{d.activeDs > 0 ? d.reqMovPerDs.toFixed(1) : "—"}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold" style={{
                    color: !d.tieneData ? "#6b7280" : d.gap > 0 ? "#dc2626" : "#10b981",
                  }}>
                    {d.tieneData ? (d.gap > 0 ? "+" : "") + d.gap.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] t-muted mt-3">
          Verde = los activos del día movieron al ritmo necesario o por encima. Rojo = quedaron por debajo de lo que cada uno tenía que aportar ese día.
        </p>
      </div>

      {/* Simulador */}
      <div className="rounded-xl p-4 border border-purple-500/30" style={{ background: "rgba(167,139,250,0.05)" }}>
        <h3 className="text-sm font-bold t-primary mb-1">🧪 Simulador — ¿Y si tengo N DSs activos?</h3>
        <p className="text-[11px] t-muted mb-3">
          Probá distintas cantidades de DSs activos en {labelTarget} y comparalos con {labelBase}. La curva muestra cuánto necesita cada uno por día para llegar a la meta.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg p-3 border border-purple-500/20" style={{ background: "var(--bg-input)" }}>
            <label className="text-[10px] t-muted uppercase tracking-wider block mb-1">DSs activos en {labelTarget}</label>
            <input type="number" min={1} value={simDsValue}
              onChange={(e) => setSimDs(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full text-2xl font-bold px-2 py-1 rounded border border-gray-700 bg-transparent t-primary outline-none focus:border-purple-500" />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setSimDs(activosBase)} className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-purple-500/50">
                = Base ({activosBase})
              </button>
              <button type="button" onClick={() => setSimDs(activosTarget)} className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-purple-500/50">
                = {labelTarget} actual ({activosTarget})
              </button>
              {simDsValue !== Math.round(activosBase * 1.5) && (
                <button type="button" onClick={() => setSimDs(Math.round(activosBase * 1.5))} className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-purple-500/50">
                  +50%
                </button>
              )}
            </div>
          </div>
          <div className="rounded-lg p-3 border border-orange-500/30" style={{ background: "var(--bg-input)" }}>
            <p className="text-[10px] t-muted uppercase tracking-wider mb-1">Necesario por DS / día — {labelTarget}</p>
            <p className="text-[11px] t-secondary mb-1">Para meta de {metaMov.toLocaleString("es-AR")} mov / {metaIng.toLocaleString("es-AR")} ing</p>
            <p className="text-2xl font-bold" style={{ color: "#10b981" }}>{simMovPerDsPerDay.toFixed(1)} <span className="text-sm">mov</span></p>
            <p className="text-base font-bold" style={{ color: "#0891b2" }}>{simIngPerDsPerDay.toFixed(1)} <span className="text-xs">ing</span></p>
          </div>
          <div className="rounded-lg p-3 border border-cyan-500/30" style={{ background: "var(--bg-input)" }}>
            <p className="text-[10px] t-muted uppercase tracking-wider mb-1">Comparación con {labelBase}</p>
            <p className="text-[11px] t-secondary mb-1">
              {activosBase} DSs activos · {totalsBase.mov.toLocaleString("es-AR")} mov
            </p>
            {(() => {
              const baseMovPerDsPerDay = activosBase > 0 ? totalsBase.mov / activosBase / ((metaInfo[`dias_${mesBase}`] as number) ?? MES_DIAS_DEFAULT[mesBase]) : 0;
              const delta = simMovPerDsPerDay - baseMovPerDsPerDay;
              const pctChange = baseMovPerDsPerDay > 0 ? (delta / baseMovPerDsPerDay) * 100 : 0;
              return (
                <>
                  <p className="text-sm t-primary">Real en {labelBase}: <strong style={{ color: "#10b981" }}>{baseMovPerDsPerDay.toFixed(1)}</strong> mov/DS/día</p>
                  <p className="text-sm" style={{ color: delta > 0 ? "#dc2626" : "#10b981" }}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)} mov/DS/día ({pctChange > 0 ? "+" : ""}{pctChange.toFixed(0)}%)
                  </p>
                  <p className="text-[10px] t-muted mt-1">
                    {delta > baseMovPerDsPerDay * 0.5
                      ? "🚨 Salto enorme — más fácil activar más DSs"
                      : delta > baseMovPerDsPerDay * 0.2
                      ? "⚠️ Requiere crecimiento fuerte por DS"
                      : delta > 0
                      ? "✓ Crecimiento moderado y alcanzable"
                      : "✅ Por debajo de lo que ya hacían"}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={simChart} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="ds" tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "# DSs activos", position: "insideBottom", offset: -5, fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Guías / DS / día", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ background: "rgba(22,33,62,0.95)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, fontSize: 11 }}
                formatter={(v: any, n: any) => [Number(v).toFixed(1), String(n)]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="targetMov" name={`${labelTarget} — Mov/DS/día`} stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="targetIng" name={`${labelTarget} — Ing/DS/día`} stroke="#0891b2" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="baseMov" name={`${labelBase} — Mov/DS/día`} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="baseIng" name={`${labelBase} — Ing/DS/día`} stroke="#0891b2" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              <ReferenceDot x={simDsValue} y={simMovPerDsPerDay} r={5} fill="#a78bfa" stroke="#fff" strokeWidth={1.5} />
              <ReferenceDot x={activosBase} y={activosBase > 0 ? totalsBase.mov / activosBase / ((metaInfo[`dias_${mesBase}`] as number) ?? MES_DIAS_DEFAULT[mesBase]) : 0} r={4} fill="#f97316" stroke="#fff" strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] t-muted text-center mt-2">
          🟣 = simulación · 🟧 = punto real en {labelBase}. Líneas sólidas: necesidad para meta {labelTarget}. Líneas punteadas: ritmo real de {labelBase}.
        </p>
      </div>

      {/* Tabla */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold t-primary">📋 Detalle por Dropshipper ({tabla.length})</h3>
          <input type="text" placeholder="🔍 Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500 w-48" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 text-[10px] t-muted">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Dropshipper</th>
                <th className="text-right py-2 px-2">{labelBase} mov</th>
                <th className="text-right py-2 px-2">{labelBase} días</th>
                <th className="text-right py-2 px-2">{labelBase} mov/día</th>
                <th className="text-right py-2 px-2">{labelTarget} mov</th>
                <th className="text-right py-2 px-2">{labelTarget} días</th>
                <th className="text-right py-2 px-2">{labelTarget} mov/día</th>
                <th className="text-right py-2 px-2 text-orange-300">Necesario mov/día</th>
                <th className="text-right py-2 px-2 text-cyan-300">Necesario ing/día</th>
                <th className="text-right py-2 px-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? tablaFiltrada : tablaFiltrada.slice(0, 50)).map((r: any, i: number) => (
                <tr key={r.nombre} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                  <td className="py-2 px-2 t-muted text-[10px]">{i + 1}</td>
                  <td className="py-2 px-2 t-primary max-w-[220px] truncate" title={r.nombre}>{r.nombre}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.baseMov.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right t-muted">{r.baseDays}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.baseMovPorDia.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right font-mono text-orange-400">{r.targetMov.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right t-muted">{r.targetDays}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.targetMovPorDia.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-orange-300">{r.reqMovPorDia.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-cyan-300">{r.reqIngPorDia.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: r.gap > 0 ? "#dc2626" : "#10b981" }}>
                    {r.gap > 0 ? "+" : ""}{r.gap.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tablaFiltrada.length > 50 && !showAll && (
            <button onClick={() => setShowAll(true)} className="mt-3 text-[11px] text-orange-400 hover:underline">
              Ver todos los {tablaFiltrada.length.toLocaleString("es-AR")} DSs
            </button>
          )}
        </div>
        <p className="text-[10px] t-muted mt-3">
          <strong>Gap</strong> = lo que falta movilizar por día para cumplir la cuota (proporcional al share en {labelBase}).
          Verde = al ritmo o sobrado. Rojo = por debajo del ritmo necesario.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3 border border-cyan-500/10" style={{ background: "var(--bg-card)" }}>
      <p className="text-[10px] t-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] t-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressCard({ label, actual, target, color }: { label: string; actual: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  return (
    <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
      <p className="text-[11px] t-muted mb-1">{label}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-lg font-bold" style={{ color }}>{actual.toLocaleString("es-AR")}</p>
        <p className="text-[11px] t-muted">de {target.toLocaleString("es-AR")}</p>
        <p className="text-[11px] t-secondary ml-auto">{pct.toFixed(1)}%</p>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PerDsRow({ label, value, color, suffix = "", intRound = false }: { label: string; value: number; color: string; suffix?: string; intRound?: boolean }) {
  const displayValue = intRound ? Math.round(value).toLocaleString("es-AR") : (value < 100 ? value.toFixed(1) : Math.round(value).toLocaleString("es-AR"));
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="t-secondary">{label}</span>
      <span className="font-bold font-mono" style={{ color }}>{displayValue}{suffix}</span>
    </div>
  );
}
