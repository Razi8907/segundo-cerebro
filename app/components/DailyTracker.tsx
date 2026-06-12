"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { MesFilter } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

interface DailyData {
  dia_semana: string;
  fecha: number;
  ordenes: number;
  nota: string | null;
}

interface MetaInfo {
  meta_movilizadas_abril: number;
  tasa_movilizacion: number;
  meta_ingresadas_abril: number;
  dias_abril: number;
  promedio_diario_necesario: number;
  marzo_total_ordenes: number;
  marzo_promedio_diario: number;
  meta_movilizadas_mayo?: number;
  meta_ingresadas_mayo?: number;
  dias_mayo?: number;
  promedio_diario_necesario_mayo?: number;
  abril_total_ordenes?: number;
  abril_promedio_diario?: number;
}

const DIAS_SEMANA_ABRIL = [
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES",
];

// Mayo 2026 — día 1 es viernes
const DIAS_SEMANA_MAYO = [
  "VIERNES","SÁBADO","DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES",
  "VIERNES","SÁBADO","DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES",
  "VIERNES","SÁBADO","DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES",
  "VIERNES","SÁBADO","DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES",
  "VIERNES","SÁBADO","DOMINGO",
];

// Junio 2026 — día 1 es lunes (30 días)
const DIAS_SEMANA_JUNIO = [
  "LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO",
  "LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO",
  "LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO",
  "LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO",
  "LUNES","MARTES",
];

interface ResumenMes {
  ingresadas: number;
  movilizadas: number;
  entregados: number;
  devoluciones: number;
}

interface Resumen {
  enero: ResumenMes;
  febrero: ResumenMes;
  marzo: ResumenMes;
  [key: string]: any;
}

const DIAS_MES: Record<string, number> = { enero: 31, febrero: 28, marzo: 31 };
const MES_LABELS: Record<string, string> = { enero: "Enero 2026", febrero: "Febrero 2026", marzo: "Marzo 2026", abril: "Abril 2026", mayo: "Mayo 2026", junio: "Junio 2026" };

export default function DailyTracker({
  marzoData,
  metaInfo,
  abrilRealData,
  mesFilter,
  resumen,
  country = "py",
}: {
  marzoData: DailyData[];
  metaInfo: MetaInfo;
  abrilRealData?: DailyData[];
  mesFilter: MesFilter;
  resumen?: Resumen;
  country?: "py" | "ar";
}) {
  const isAbril = mesFilter === "abril";
  const isMayo = mesFilter === "mayo";
  const isJunio = mesFilter === "junio";
  const isPlanning = isAbril || isMayo || isJunio;
  const mi = metaInfo as any;

  // Configuración del mes activo — todo lo "actual" se resuelve dinámicamente
  const META_DIARIA = isJunio
    ? (mi.promedio_diario_necesario_junio ?? mi.promedio_diario_necesario_mayo ?? mi.promedio_diario_necesario)
    : isMayo
    ? (metaInfo.promedio_diario_necesario_mayo ?? metaInfo.promedio_diario_necesario)
    : metaInfo.promedio_diario_necesario;
  const META_TOTAL = isJunio
    ? (mi.meta_ingresadas_junio ?? mi.meta_ingresadas_mayo ?? metaInfo.meta_ingresadas_abril)
    : isMayo
    ? (metaInfo.meta_ingresadas_mayo ?? metaInfo.meta_ingresadas_abril)
    : metaInfo.meta_ingresadas_abril;
  const META_MOV_ACTIVE = isJunio
    ? (mi.meta_movilizadas_junio ?? mi.meta_movilizadas_mayo ?? metaInfo.meta_movilizadas_abril)
    : isMayo
    ? (metaInfo.meta_movilizadas_mayo ?? metaInfo.meta_movilizadas_abril)
    : metaInfo.meta_movilizadas_abril;
  const TOTAL_DAYS = isJunio ? (mi.dias_junio ?? 30) : isMayo ? (metaInfo.dias_mayo ?? 31) : (metaInfo.dias_abril ?? 30);
  const DIAS_SEMANA_ACTIVE = isJunio ? DIAS_SEMANA_JUNIO : isMayo ? DIAS_SEMANA_MAYO : DIAS_SEMANA_ABRIL;
  const ACTIVE_LABEL = isJunio ? "Junio" : isMayo ? "Mayo" : "Abril";
  const ACTIVE_LABEL_FULL = isJunio ? "Junio 2026" : isMayo ? "Mayo 2026" : "Abril 2026";
  const COMP_LABEL = isJunio ? "Mayo" : isMayo ? "Abril" : "Marzo";
  const COMP_LABEL_FULL = isJunio ? "Mayo 2026" : isMayo ? "Abril 2026" : "Marzo 2026";
  const COMP_TOTAL_REF = isJunio
    ? (mi.mayo_total_ordenes ?? 0)
    : isMayo
    ? (metaInfo.abril_total_ordenes ?? 0)
    : metaInfo.marzo_total_ordenes;
  const COMP_PROMEDIO_REF = isJunio
    ? (mi.mayo_promedio_diario ?? 0)
    : isMayo
    ? (metaInfo.abril_promedio_diario ?? 0)
    : metaInfo.marzo_promedio_diario;
  const ACTIVE_MES_KEY = isJunio ? "junio" : isMayo ? "mayo" : "abril";
  const COMP_DAYS = isJunio ? (metaInfo.dias_mayo ?? 31) : isMayo ? (metaInfo.dias_abril ?? 30) : 31;

  const STORAGE_KEY = `segundo-cerebro-${ACTIVE_MES_KEY}-${country}`;

  // Abril tracking state — hydrated from DB (with localStorage fallback + JSON fallback)
  const [abrilData, setAbrilData] = useState<{ fecha: number; ordenes: number; dia_semana: string }[]>(
    () => {
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch { /* ignore */ }
      }
      return (abrilRealData || []).map((d) => ({ fecha: d.fecha, ordenes: d.ordenes, dia_semana: d.dia_semana }));
    }
  );
  const [inputDay, setInputDay] = useState("");
  const [inputOrdenes, setInputOrdenes] = useState("");
  const [dbLoaded, setDbLoaded] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingSuccess, setTrackingSuccess] = useState<string | null>(null);
  const [manualDays, setManualDays] = useState<Set<number>>(new Set());
  const [opsData, setOpsData] = useState<any>(null);
  // Para Mayo: data real de Abril (mes de comparación) traída de daily_tracking
  const [compMonthLive, setCompMonthLive] = useState<DailyData[] | null>(null);

  // Load from DB only (manual entries) — no auto-sync from operational data
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/data/daily-tracking?country=${country}&mes=${ACTIVE_MES_KEY}`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res.days) && res.days.length > 0) {
          setAbrilData(res.days);
        } else {
          // Reset si cambiamos a un mes sin data
          setAbrilData([]);
        }
        setDbLoaded(true);
      })
      .catch(() => { if (!cancelled) setDbLoaded(true); });
    return () => { cancelled = true; };
  }, [country, ACTIVE_MES_KEY]);

  // En meses de planificación (Mayo/Junio) traer la data real del mes
  // anterior desde daily_tracking para que las referencias y el patrón por
  // día de semana usen los días reales en vez del fallback estático.
  useEffect(() => {
    if (!isMayo && !isJunio) {
      setCompMonthLive(null);
      return;
    }
    const compMes = isJunio ? "mayo" : "abril";
    let cancelled = false;
    fetch(`/api/data/daily-tracking?country=${country}&mes=${compMes}`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res.days) && res.days.length > 0) setCompMonthLive(res.days);
        else setCompMonthLive([]);
      })
      .catch(() => { if (!cancelled) setCompMonthLive([]); });
    return () => { cancelled = true; };
  }, [isMayo, isJunio, country]);

  // Data efectiva para la comparación (Marzo en Abril, Abril en Mayo, Mayo en Junio)
  const effectiveCompData: DailyData[] = (isMayo || isJunio) && compMonthLive && compMonthLive.length > 0
    ? compMonthLive
    : marzoData;

  // Persist to localStorage (backup)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(abrilData));
    } catch { /* ignore quota errors */ }
  }, [abrilData, STORAGE_KEY]);

  const showSuccess = (msg: string) => {
    setTrackingSuccess(msg);
    setTimeout(() => setTrackingSuccess(null), 3000);
  };

  const addDay = useCallback(async () => {
    const day = parseInt(inputDay);
    const ordenes = parseInt(inputOrdenes);
    if (isNaN(day) || isNaN(ordenes) || day < 1 || day > TOTAL_DAYS) return;

    const dia_semana = DIAS_SEMANA_ACTIVE[day - 1];
    setTrackingError(null);

    // Persist to DB FIRST so the user gets immediate error feedback
    try {
      const res = await fetch("/api/data/daily-tracking", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, mes: ACTIVE_MES_KEY, fecha: day, ordenes, dia_semana }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        setTrackingError(`No se pudo guardar el dia ${day} (${res.status}): ${msg || res.statusText}. Verifica tu sesion (re-login).`);
        return;
      }
      // Update local state only after successful save
      setAbrilData((prev) => {
        const filtered = prev.filter((d) => d.fecha !== day);
        return [...filtered, { fecha: day, ordenes, dia_semana }].sort((a, b) => a.fecha - b.fecha);
      });
      setInputDay(String(day + 1));
      setInputOrdenes("");
      showSuccess(`✓ Dia ${day} guardado: ${ordenes.toLocaleString()} ordenes`);
    } catch (e: any) {
      setTrackingError(`Error de red guardando dia ${day}: ${e?.message || e}`);
    }
  }, [inputDay, inputOrdenes, country, TOTAL_DAYS, DIAS_SEMANA_ACTIVE, ACTIVE_MES_KEY]);

  const deleteDay = useCallback(async (day: number) => {
    setTrackingError(null);
    try {
      const res = await fetch(`/api/data/daily-tracking?country=${country}&mes=${ACTIVE_MES_KEY}&fecha=${day}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        setTrackingError(`No se pudo eliminar el dia ${day} (${res.status}): ${msg || res.statusText}`);
        return;
      }
      setAbrilData((prev) => prev.filter((d) => d.fecha !== day));
      showSuccess(`✓ Dia ${day} eliminado`);
    } catch (e: any) {
      setTrackingError(`Error de red eliminando dia ${day}: ${e?.message || e}`);
    }
  }, [country, ACTIVE_MES_KEY]);

  const analysis = useMemo(() => {
    // Comparison-month analysis (Marzo en Abril, Abril en Mayo)
    const marzoByDow: Record<string, number[]> = {};
    effectiveCompData.forEach((d) => {
      if (!marzoByDow[d.dia_semana]) marzoByDow[d.dia_semana] = [];
      marzoByDow[d.dia_semana].push(d.ordenes);
    });
    const dowAvg: Record<string, number> = {};
    Object.entries(marzoByDow).forEach(([dow, vals]) => {
      dowAvg[dow] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });

    // Abril/Mayo progress (active month)
    const abrilTotal = abrilData.reduce((s, d) => s + d.ordenes, 0);
    const diasCargados = abrilData.length;
    const diasRestantes = TOTAL_DAYS - diasCargados;
    const promedioAbril = diasCargados > 0 ? abrilTotal / diasCargados : 0;
    const proyeccionFinal = diasCargados > 0 ? Math.round(promedioAbril * TOTAL_DAYS) : 0;
    const pctMeta = diasCargados > 0 ? (proyeccionFinal / META_TOTAL) * 100 : 0;
    const necesarioPorDiaRestante = diasRestantes > 0 ? Math.round((META_TOTAL - abrilTotal) / diasRestantes) : 0;

    const coloredAbril = abrilData.map((d) => {
      let color: "verde" | "amarillo" | "rojo";
      if (d.ordenes >= META_DIARIA) color = "verde";
      else if (d.ordenes >= META_DIARIA * 0.8) color = "amarillo";
      else color = "rojo";
      return { ...d, color };
    });

    // Projection using actual active-month average for remaining days
    const abrilProjected: { fecha: number; ordenes: number | null; proyectado: number; dia_semana: string }[] = [];
    // Use current month's own average if we have data, otherwise fall back to comparison-month pattern
    const proyBase = diasCargados > 0 ? Math.round(promedioAbril) : COMP_PROMEDIO_REF;
    for (let i = 1; i <= TOTAL_DAYS; i++) {
      const existing = abrilData.find((d) => d.fecha === i);
      const dow = DIAS_SEMANA_ACTIVE[i - 1];
      abrilProjected.push({
        fecha: i,
        ordenes: existing ? existing.ordenes : null,
        proyectado: existing ? existing.ordenes : proyBase,
        dia_semana: dow,
      });
    }

    // Projected movilizadas based on actual active-month data
    const proyMovilizadas = diasCargados > 0 ? Math.round(proyeccionFinal * (META_MOV_ACTIVE / META_TOTAL)) : 0;

    // Weekly breakdown — generated dinámicamente para soportar 30 o 31 días
    const META_MOV = META_MOV_ACTIVE;
    const weeks = (() => {
      const out: { label: string; start: number; end: number; dias: number }[] = [];
      let start = 1;
      let weekNum = 1;
      while (start <= TOTAL_DAYS) {
        const targetDias = weekNum === 1 ? 6 : 7;
        const end = Math.min(start + targetDias - 1, TOTAL_DAYS);
        out.push({ label: `S${weekNum} (${start}-${end})`, start, end, dias: end - start + 1 });
        start = end + 1;
        weekNum++;
      }
      return out;
    })();

    let acumReal = 0;
    const weeklyData = weeks.map((w) => {
      // Real data for loaded days
      const realDays = abrilData.filter((d) => d.fecha >= w.start && d.fecha <= w.end);
      const realTotal = realDays.reduce((s, d) => s + d.ordenes, 0);
      const diasCargadosWeek = realDays.length;
      acumReal += realTotal;

      // Meta semanal proporcional (ingresadas)
      const metaSemanalIng = Math.round(META_TOTAL * (w.dias / TOTAL_DAYS));
      // Meta semanal movilizadas
      const metaSemanalMov = Math.round(META_MOV * (w.dias / TOTAL_DAYS));

      // What's still needed from remaining days in this week
      const diasFaltantesWeek = w.dias - diasCargadosWeek;
      const necesarioRestanteWeek = diasFaltantesWeek > 0
        ? Math.round((metaSemanalIng - realTotal) / diasFaltantesWeek)
        : 0;

      // Projected: real + estimated for missing days
      const estimadoFaltante = diasFaltantesWeek > 0
        ? diasFaltantesWeek * (diasCargados > 0 ? promedioAbril : META_DIARIA)
        : 0;
      const proyectadoSemanal = realTotal + Math.round(estimadoFaltante);

      // Acumulado meta
      const acumMetaIng = Math.round(META_TOTAL * (w.end / TOTAL_DAYS));
      const acumMetaMov = Math.round(META_MOV * (w.end / TOTAL_DAYS));

      return {
        semana: w.label,
        dias: w.dias,
        diasCargados: diasCargadosWeek,
        real: realTotal,
        metaIng: metaSemanalIng,
        metaMov: metaSemanalMov,
        proyectado: proyectadoSemanal,
        necesarioDiario: necesarioRestanteWeek,
        acumReal: acumReal,
        acumMetaIng,
        acumMetaMov,
      };
    });

    // Comp month vs Active month comparison (day by day) + projection
    const marzoTotal = effectiveCompData.reduce((s, d) => s + d.ordenes, 0);
    const marzoByDay = new Map<number, number>();
    effectiveCompData.forEach((d) => marzoByDay.set(d.fecha, d.ordenes));
    const maxDays = Math.max(COMP_DAYS, TOTAL_DAYS);

    const comparisonData: { dia: number; marzo: number | null; abril: number | null; proyAbril: number | null; necesarioParaSuperarMarzo: number | null }[] = [];
    let acumMarzo = 0;
    let acumAbril = 0;
    const marzoFinalTotal = marzoTotal;
    for (let i = 1; i <= maxDays; i++) {
      const mVal = marzoByDay.get(i) || 0;
      if (i <= COMP_DAYS) acumMarzo += mVal;
      const aDay = abrilData.find((d) => d.fecha === i);
      const aVal = aDay ? aDay.ordenes : null;
      if (aVal !== null) acumAbril += aVal;

      // Projected active month (for days not yet loaded)
      let proyAbril: number | null = null;
      if (i <= TOTAL_DAYS) {
        if (aVal !== null) {
          proyAbril = aVal;
        } else if (diasCargados > 0) {
          proyAbril = Math.round(promedioAbril);
        }
      }

      comparisonData.push({
        dia: i,
        marzo: i <= COMP_DAYS ? mVal : null,
        abril: i <= TOTAL_DAYS ? aVal : null,
        proyAbril: i <= TOTAL_DAYS ? proyAbril : null,
        necesarioParaSuperarMarzo: null,
      });
    }

    // Calculate what's needed per remaining day to beat March
    const necesarioParaSuperarMarzo = diasRestantes > 0
      ? Math.round((marzoFinalTotal - abrilTotal + 1) / diasRestantes)
      : 0;
    // Also what's needed per remaining day to hit meta
    const necesarioParaMeta = necesarioPorDiaRestante;

    // Acumulado comparison for chart
    const acumComparisonData: { dia: number; acumMarzo: number; acumAbril: number | null; acumProy: number | null }[] = [];
    let cMarzo = 0, cAbril = 0;
    for (let i = 1; i <= maxDays; i++) {
      if (i <= COMP_DAYS) cMarzo += marzoByDay.get(i) || 0;
      const aDay = abrilData.find((d) => d.fecha === i);
      if (aDay) cAbril += aDay.ordenes;

      acumComparisonData.push({
        dia: i,
        acumMarzo: cMarzo,
        acumAbril: i <= TOTAL_DAYS && abrilData.some((d) => d.fecha <= i) ? cAbril : null,
        acumProy: i <= TOTAL_DAYS && i > diasCargados && diasCargados > 0
          ? cAbril + Math.round(promedioAbril * (i - diasCargados))
          : null,
      });
    }

    return {
      dowAvg,
      abrilTotal,
      diasCargados,
      diasRestantes,
      promedioAbril,
      proyeccionFinal,
      pctMeta,
      necesarioPorDiaRestante,
      coloredAbril,
      abrilProjected,
      weeklyData,
      proyMovilizadas,
      // New: comparison
      marzoTotal: marzoFinalTotal,
      comparisonData,
      acumComparisonData,
      necesarioParaSuperarMarzo,
      crecimientoVsMarzo: marzoFinalTotal > 0 ? ((proyeccionFinal - marzoFinalTotal) / marzoFinalTotal * 100) : 0,
    };
  }, [effectiveCompData, abrilData, META_DIARIA, META_TOTAL, metaInfo, TOTAL_DAYS, COMP_DAYS, COMP_PROMEDIO_REF, META_MOV_ACTIVE, DIAS_SEMANA_ACTIVE]);

  const colorMap = { verde: "#10B981", amarillo: "#F59E0B", rojo: "#EF4444" };

  const marzoChartData = effectiveCompData.map((d) => ({
    name: `${d.fecha}`,
    Órdenes: d.ordenes,
    dia: d.dia_semana,
  }));

  // ─── Enero / Febrero: resumen mensual (no hay data diaria) ───
  if ((mesFilter === "enero" || mesFilter === "febrero") && resumen) {
    const mesData = resumen[mesFilter];
    const dias = DIAS_MES[mesFilter];
    const promDiario = Math.round(mesData.ingresadas / dias);
    const pctEnt = mesData.movilizadas > 0 ? ((mesData.entregados / mesData.movilizadas) * 100).toFixed(1) : "0";
    const pctDev = mesData.movilizadas > 0 ? ((mesData.devoluciones / mesData.movilizadas) * 100).toFixed(1) : "0";

    return (
      <ChartDownloadBtn filename="Seguimiento_Diario">
      <div className="glass-card p-6 border-orange-500/30">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
          📅 Seguimiento &mdash; {MES_LABELS[mesFilter]}
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          Resumen del mes &middot; {dias} días &middot; Mes cerrado
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl p-4 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Ingresadas</p>
            <p className="text-2xl font-bold text-blue-400">{mesData.ingresadas.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">~{promDiario.toLocaleString()}/día</p>
          </div>
          <div className="rounded-xl p-4 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Movilizadas</p>
            <p className="text-2xl font-bold text-orange-400">{mesData.movilizadas.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">{dias} días</p>
          </div>
          <div className="rounded-xl p-4 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Entregados</p>
            <p className="text-2xl font-bold text-green-400">{mesData.entregados.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">{pctEnt}% de movilizadas</p>
          </div>
          <div className="rounded-xl p-4 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Devoluciones</p>
            <p className="text-2xl font-bold text-red-400">{mesData.devoluciones.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">{pctDev}% de movilizadas</p>
          </div>
        </div>

        {/* Comparativa trimestral */}
        {resumen && (
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Comparativa Mensual Q1</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={[
                { mes: "Enero", Ingresadas: resumen.enero.ingresadas, Movilizadas: resumen.enero.movilizadas, Entregados: resumen.enero.entregados },
                { mes: "Febrero", Ingresadas: resumen.febrero.ingresadas, Movilizadas: resumen.febrero.movilizadas, Entregados: resumen.febrero.entregados },
                { mes: "Marzo", Ingresadas: resumen.marzo.ingresadas, Movilizadas: resumen.marzo.movilizadas, Entregados: resumen.marzo.entregados },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316", fontSize: 12 }}
                  formatter={(value) => Number(value).toLocaleString()}
                />
                <Bar dataKey="Ingresadas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Movilizadas" fill="#F97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Entregados" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      </ChartDownloadBtn>
    );
  }

  // ─── Q1 / Marzo view: histórico con data diaria de marzo ───
  if (!isPlanning) {
    const isQ1 = mesFilter === "q1";
    const title = isQ1 ? "Histórico Q1 (Ene-Mar)" : "Marzo 2026";

    return (
      <ChartDownloadBtn filename="Seguimiento_Diario">
      <div className="glass-card p-6 border-orange-500/30">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
          📅 Seguimiento Diario &mdash; {title}
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          {isQ1 ? "Resumen trimestral + detalle diario de Marzo" : "Órdenes ingresadas día a día"} &middot; Mes cerrado
        </p>

        {/* Q1 monthly comparison */}
        {isQ1 && resumen && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Comparativa Mensual Q1</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { mes: "Enero", Ingresadas: resumen.enero.ingresadas, Movilizadas: resumen.enero.movilizadas, Entregados: resumen.enero.entregados },
                { mes: "Febrero", Ingresadas: resumen.febrero.ingresadas, Movilizadas: resumen.febrero.movilizadas, Entregados: resumen.febrero.entregados },
                { mes: "Marzo", Ingresadas: resumen.marzo.ingresadas, Movilizadas: resumen.marzo.movilizadas, Entregados: resumen.marzo.entregados },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="mes" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316", fontSize: 12 }}
                  formatter={(value) => Number(value).toLocaleString()}
                />
                <Bar dataKey="Ingresadas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Movilizadas" fill="#F97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Entregados" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* KPIs histórico */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Marzo Total</p>
            <p className="text-lg font-bold text-gray-300">{metaInfo.marzo_total_ordenes.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">31 días</p>
          </div>
          <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Promedio Diario</p>
            <p className="text-lg font-bold text-orange-400">{metaInfo.marzo_promedio_diario.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">órdenes/día</p>
          </div>
          <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Mejor Día</p>
            <p className="text-lg font-bold text-green-400">
              {Math.max(...marzoData.map((d) => d.ordenes)).toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500">máximo registrado</p>
          </div>
        </div>

        {/* Marzo Chart */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Marzo 2026 &mdash; Día a día
            <span className="text-[10px] text-gray-500 ml-2">
              Total: {metaInfo.marzo_total_ordenes.toLocaleString()} &middot; Prom: {metaInfo.marzo_promedio_diario.toLocaleString()}/día
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marzoChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
                itemStyle={{ color: "#F97316" }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(value) => `${Number(value).toLocaleString()} órdenes`}
              />
              <ReferenceLine y={metaInfo.marzo_promedio_diario} stroke="#6B7280" strokeDasharray="4 4" label={{ value: `Prom: ${metaInfo.marzo_promedio_diario.toLocaleString()}`, fill: "#6B7280", fontSize: 10, position: "right" }} />
              <Bar dataKey="Órdenes" radius={[4, 4, 0, 0]} fill="#F97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day-of-week pattern */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Patrón por Día de Semana (Marzo)</h3>
          <div className="grid grid-cols-7 gap-2">
            {["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"].map((dow) => {
              const avg = analysis.dowAvg[dow] || 0;
              return (
                <div key={dow} className="text-center p-2 rounded-xl border border-gray-800" style={{ background: "rgba(15,52,96,0.15)" }}>
                  <p className="text-[10px] text-gray-400">{dow.slice(0, 3)}</p>
                  <p className="text-lg font-bold text-orange-400">{avg.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">prom/día</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </ChartDownloadBtn>
    );
  }

  // ─── ABRIL view: meta, semáforo, carga diaria, proyección ───
  return (
    <ChartDownloadBtn filename="Seguimiento_Diario">
    <div className="glass-card p-6 border-green-500/30">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
        🎯 Seguimiento Diario &mdash; Meta {ACTIVE_LABEL}: {META_TOTAL.toLocaleString()} ingresadas
      </h2>
      <p className="text-xs text-gray-400 mb-6">
        Carga diaria de {ACTIVE_LABEL} &middot; Meta diaria: {META_DIARIA.toLocaleString()} órdenes &middot; Objetivo: {META_MOV_ACTIVE.toLocaleString()} movilizadas
      </p>

      {/* KPIs row - mes activo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Acumulado {ACTIVE_LABEL}</p>
          <p className="text-lg font-bold text-blue-400">{analysis.abrilTotal > 0 ? analysis.abrilTotal.toLocaleString() : "—"}</p>
          <p className="text-[10px] text-gray-500">{analysis.diasCargados} días cargados</p>
        </div>
        <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Proy. Ingresadas</p>
          <p className={`text-lg font-bold ${analysis.pctMeta >= 90 ? "text-green-400" : analysis.pctMeta >= 70 ? "text-yellow-400" : "text-red-400"}`}>
            {analysis.proyeccionFinal > 0 ? analysis.proyeccionFinal.toLocaleString() : "—"}
          </p>
          <p className="text-[10px] text-gray-500">{analysis.pctMeta > 0 ? `${analysis.pctMeta.toFixed(1)}% de meta (${META_TOTAL.toLocaleString()})` : "Sin datos"}</p>
        </div>
        <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Proy. Movilizadas</p>
          <p className={`text-lg font-bold ${analysis.proyMovilizadas >= META_MOV_ACTIVE * 0.9 ? "text-green-400" : analysis.proyMovilizadas >= META_MOV_ACTIVE * 0.7 ? "text-yellow-400" : "text-orange-400"}`}>
            {analysis.proyMovilizadas > 0 ? analysis.proyMovilizadas.toLocaleString() : "—"}
          </p>
          <p className="text-[10px] text-gray-500">Meta: {META_MOV_ACTIVE.toLocaleString()} mov.</p>
        </div>
        <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: "rgba(139,92,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Promedio diario actual</p>
          <p className="text-lg font-bold text-purple-400">
            {analysis.diasCargados > 0 ? Math.round(analysis.promedioAbril).toLocaleString() : "—"}
          </p>
          <p className="text-[10px] text-gray-500">{analysis.diasCargados > 0 ? `${Math.round(analysis.promedioAbril) >= META_DIARIA ? "✅ Sobre meta" : "⚠ Bajo meta"} (meta: ${META_DIARIA.toLocaleString()}/día)` : "Sin datos"}</p>
        </div>
        <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Necesario/día rest.</p>
          <p className="text-lg font-bold text-red-400">
            {analysis.necesarioPorDiaRestante > 0 ? analysis.necesarioPorDiaRestante.toLocaleString() : META_DIARIA.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500">{analysis.diasRestantes} días restantes</p>
        </div>
      </div>
      {/* Progress bar toward meta */}
      {analysis.diasCargados > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Progreso: {analysis.abrilTotal.toLocaleString()} / {META_TOTAL.toLocaleString()} ingresadas</span>
            <span>{((analysis.abrilTotal / META_TOTAL) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(249,115,22,0.15)" }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min((analysis.abrilTotal / META_TOTAL) * 100, 100)}%`,
              background: analysis.pctMeta >= 90 ? "#10B981" : analysis.pctMeta >= 70 ? "#F59E0B" : "#EF4444",
            }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>Proy. final: {analysis.proyeccionFinal.toLocaleString()} ing. → {analysis.proyMovilizadas.toLocaleString()} mov.</span>
            <span>{analysis.pctMeta >= 100 ? "✅ Se alcanza la meta" : `Faltan ${(META_TOTAL - analysis.abrilTotal).toLocaleString()} ingresadas`}</span>
          </div>
        </div>
      )}

      {/* Save status banners */}
      {trackingError && (
        <div className="mb-3 p-3 rounded-lg border border-red-500/40 bg-red-500/10 flex items-start justify-between gap-3">
          <p className="text-xs text-red-600 font-medium">⚠ {trackingError}</p>
          <button onClick={() => setTrackingError(null)} className="text-red-500 text-xs">✕</button>
        </div>
      )}
      {trackingSuccess && (
        <div className="mb-3 p-2 rounded-lg border border-green-500/40 bg-green-500/10">
          <p className="text-xs text-green-600 font-medium">{trackingSuccess}</p>
        </div>
      )}

      {/* Input form for Abril */}
      <div className="mb-6 p-4 rounded-xl border border-green-500/20" style={{ background: "rgba(16,185,129,0.03)" }}>
        <h3 className="text-sm font-medium text-green-400 mb-3">Cargar datos de {ACTIVE_LABEL}</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Día (1-30)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={inputDay}
              onChange={(e) => setInputDay(e.target.value)}
              placeholder="Día"
              className="w-20 text-sm px-3 py-2 rounded-lg bg-[#16213e] border border-green-500/30 text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Órdenes ingresadas</label>
            <input
              type="number"
              value={inputOrdenes}
              onChange={(e) => setInputOrdenes(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDay()}
              placeholder="Ej: 1500"
              className="w-32 text-sm px-3 py-2 rounded-lg bg-[#16213e] border border-green-500/30 text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <button
            onClick={addDay}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
          >
            Agregar
          </button>
          {abrilData.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("¿Eliminar TODOS los dias cargados de Abril?")) return;
                setTrackingError(null);
                try {
                  const res = await fetch(`/api/data/daily-tracking?country=${country}`, { method: "DELETE", credentials: "include" });
                  if (!res.ok) {
                    const msg = await res.text().catch(() => "");
                    setTrackingError(`No se pudo borrar todo (${res.status}): ${msg || res.statusText}`);
                    return;
                  }
                  setAbrilData([]);
                  try { localStorage.removeItem(STORAGE_KEY); } catch {}
                  showSuccess("✓ Todos los dias eliminados");
                } catch (e: any) {
                  setTrackingError(`Error de red borrando todo: ${e?.message || e}`);
                }
              }}
              className="px-3 py-2 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Abril loaded days with semaphore */}
        {abrilData.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {analysis.coloredAbril.map((d) => (
              <div
                key={d.fecha}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                style={{
                  borderColor: colorMap[d.color] + "40",
                  background: colorMap[d.color] + "10",
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: colorMap[d.color] }} />
                <span className="text-gray-300">Día {d.fecha}:</span>
                <span className="font-bold" style={{ color: colorMap[d.color] }}>
                  {d.ordenes.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abril projection chart with semaphore colors */}
      {abrilData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            {ACTIVE_LABEL_FULL} &mdash; Real vs Meta Necesaria
            <span className="text-[10px] text-gray-500 ml-2">
              🟢 &ge;{META_DIARIA.toLocaleString()} &middot; 🟡 &ge;{Math.round(META_DIARIA * 0.8).toLocaleString()} &middot; 🔴 &lt;{Math.round(META_DIARIA * 0.8).toLocaleString()}
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart
              data={analysis.abrilProjected.map((d) => ({
                ...d,
                real: d.ordenes,
              }))}
              margin={{ top: 20, right: 90, bottom: 10, left: 70 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="fecha" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} domain={[0, "dataMax + 200"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "12px", color: "#e5e7eb", fontSize: 12 }}
                itemStyle={{ color: "#F97316" }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(value, name) => {
                  if (value == null) return ["—", name];
                  const label = name === "necesario" ? "Necesario/día" : name === "real" ? "Real" : String(name);
                  return [Number(value).toLocaleString(), label];
                }}
                labelFormatter={(label) => {
                  const d = analysis.abrilProjected.find((p) => p.fecha === label);
                  return d ? `Día ${label} (${d.dia_semana})` : `Día ${label}`;
                }}
              />
              <ReferenceLine y={META_DIARIA} stroke="#F97316" strokeDasharray="4 4" label={{ value: `Meta: ${META_DIARIA.toLocaleString()}`, fill: "#F97316", fontSize: 10, position: "right" }} />
              {analysis.necesarioPorDiaRestante > 0 && analysis.necesarioPorDiaRestante !== META_DIARIA && (
                <ReferenceLine y={analysis.necesarioPorDiaRestante} stroke="#8B5CF6" strokeDasharray="4 4" label={{ value: `Necesario: ${analysis.necesarioPorDiaRestante.toLocaleString()}`, fill: "#8B5CF6", fontSize: 10, position: "left" }} />
              )}
              <Bar dataKey="real" name="real" radius={[4, 4, 0, 0]} barSize={20}>
                {analysis.abrilProjected.map((d, i) => {
                  const color = d.ordenes != null
                    ? d.ordenes >= META_DIARIA ? "#10B981" : d.ordenes >= META_DIARIA * 0.8 ? "#F59E0B" : "#EF4444"
                    : "transparent";
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
              <Line type="monotone" dataKey="proyectado" stroke="#6B7280" strokeWidth={1} strokeDasharray="6 3" dot={false} name="Proyección base" />
            </ComposedChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex gap-4 mt-2 justify-center flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded" style={{ background: "#10B981" }} />
              <span className="text-gray-400">Cumple meta ({">="}{META_DIARIA.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded" style={{ background: "#F59E0B" }} />
              <span className="text-gray-400">Aceptable ({">="}{Math.round(META_DIARIA * 0.8).toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded" style={{ background: "#EF4444" }} />
              <span className="text-gray-400">Bajo meta ({"<"}{Math.round(META_DIARIA * 0.8).toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-8 border-t-2 border-dashed" style={{ borderColor: "#8B5CF6" }} />
              <span className="text-gray-400">Necesario/día restante ({analysis.necesarioPorDiaRestante.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-8 border-t border-dashed border-gray-500" />
              <span className="text-gray-400">Proyección base (Marzo)</span>
            </div>
          </div>
        </div>
      )}

      {/* Current week status — above proyección semanal */}
      {(() => {
        const totalDaysLoaded = abrilData.length;
        const ultimoDiaCargado = totalDaysLoaded > 0 ? Math.max(...abrilData.map((d) => d.fecha)) : 0;
        // Detectar la semana donde está el último día cargado (cae en esa semana)
        const currentWeek = analysis.weeklyData.find((w) => {
          // Extract numeric range from "Sx (X-Y)"
          const m = w.semana.match(/\((\d+)-(\d+)\)/);
          if (!m) return false;
          const start = parseInt(m[1], 10);
          const end = parseInt(m[2], 10);
          return ultimoDiaCargado >= start && ultimoDiaCargado <= end;
        }) || analysis.weeklyData[0];
        if (!currentWeek) return null;
        const m = currentWeek.semana.match(/\((\d+)-(\d+)\)/);
        const wStart = m ? parseInt(m[1], 10) : 1;
        const wEnd = m ? parseInt(m[2], 10) : 7;
        const diasRestSemana = Math.max(wEnd - ultimoDiaCargado, 0);
        const ingPendienteSem = Math.max(currentWeek.metaIng - currentWeek.real, 0);
        const necesarioRestoSem = diasRestSemana > 0 ? Math.round(ingPendienteSem / diasRestSemana) : 0;
        const pct = currentWeek.metaIng > 0 ? (currentWeek.real / currentWeek.metaIng) * 100 : 0;
        const statusColor = pct >= 100 ? "#10B981" : pct >= 80 ? "#F59E0B" : pct >= 50 ? "#F97316" : "#EF4444";
        const statusLabel = pct >= 100 ? "🟢 Cumpliendo" : pct >= 80 ? "🟡 En rango" : pct >= 50 ? "🟠 Atrasados" : "🔴 Muy atrasados";
        return (
          <div className="mb-4 p-4 rounded-xl border border-purple-500/30" style={{ background: "rgba(167,139,250,0.05)" }}>
            <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white">
                  🎯 Esta semana — {currentWeek.semana} {ultimoDiaCargado > 0 && <span className="text-[10px] text-gray-500">· último día cargado: {ultimoDiaCargado}</span>}
                </h3>
                <p className="text-[10px] text-gray-700 dark:text-gray-400 mt-0.5">
                  Meta semanal proporcional al mes — cuánto necesitamos esta semana y cómo vamos.
                </p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: statusColor + "20", color: statusColor }}>
                {statusLabel} · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="rounded-lg p-2 border border-cyan-500/15" style={{ background: "rgba(15,23,42,0.4)" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Meta semanal Ing.</p>
                <p className="text-base font-bold text-orange-400">{currentWeek.metaIng.toLocaleString()}</p>
                <p className="text-[9px] text-gray-500">{currentWeek.dias} días</p>
              </div>
              <div className="rounded-lg p-2 border border-cyan-500/15" style={{ background: "rgba(15,23,42,0.4)" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Meta semanal Mov.</p>
                <p className="text-base font-bold text-orange-300">{currentWeek.metaMov.toLocaleString()}</p>
                <p className="text-[9px] text-gray-500">{currentWeek.dias} días</p>
              </div>
              <div className="rounded-lg p-2 border border-cyan-500/15" style={{ background: "rgba(15,23,42,0.4)" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Real esta semana</p>
                <p className="text-base font-bold" style={{ color: statusColor }}>{currentWeek.real.toLocaleString()}</p>
                <p className="text-[9px] text-gray-500">{currentWeek.diasCargados}/{currentWeek.dias} días cargados</p>
              </div>
              <div className="rounded-lg p-2 border border-cyan-500/15" style={{ background: "rgba(15,23,42,0.4)" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pendiente semana</p>
                <p className="text-base font-bold text-red-400">{ingPendienteSem.toLocaleString()}</p>
                <p className="text-[9px] text-gray-500">{diasRestSemana} día{diasRestSemana !== 1 ? "s" : ""} restantes</p>
              </div>
              <div className="rounded-lg p-2 border border-purple-500/30" style={{ background: "rgba(167,139,250,0.08)" }}>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Necesario / día</p>
                <p className="text-base font-bold text-purple-400">{necesarioRestoSem > 0 ? necesarioRestoSem.toLocaleString() : "—"}</p>
                <p className="text-[9px] text-gray-500">para cerrar la semana</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="h-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: statusColor }} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>0</span>
                <span>{currentWeek.metaIng.toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Weekly projection chart */}
      <div className="mb-6 p-4 rounded-xl border border-cyan-500/20" style={{ background: "rgba(6,182,212,0.03)" }}>
        <h3 className="text-sm font-bold mb-1 text-black dark:text-white">
          📅 Proyección Semanal — Camino a {META_TOTAL.toLocaleString()} ingresadas → {META_MOV_ACTIVE.toLocaleString()} movilizadas
        </h3>
        <p className="text-[10px] mb-4 text-gray-700 dark:text-gray-400">
          Meta semanal proporcional &middot; Acumulado real vs necesario para llegar al objetivo
        </p>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={analysis.weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="semana" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "12px", color: "#e5e7eb", fontSize: 11 }}
              formatter={(value, name) => {
                if (value == null) return ["—", name];
                const labels: Record<string, string> = {
                  real: "Real ingresadas",
                  metaIng: "Meta ingresadas",
                  metaMov: "Meta movilizadas",
                  proyectado: "Proyectado",
                  acumReal: "Acum. real",
                  acumMetaIng: "Acum. meta ing.",
                };
                return [Number(value).toLocaleString(), labels[String(name)] || String(name)];
              }}
            />
            <Bar yAxisId="left" dataKey="metaIng" name="metaIng" fill="#F97316" opacity={0.2} radius={[4, 4, 0, 0]} barSize={28} />
            <Bar yAxisId="left" dataKey="real" name="real" radius={[4, 4, 0, 0]} barSize={28}>
              {analysis.weeklyData.map((w, i) => (
                <Cell key={i} fill={w.real >= w.metaIng ? "#10B981" : w.real >= w.metaIng * 0.8 ? "#F59E0B" : w.diasCargados > 0 ? "#EF4444" : "#374151"} />
              ))}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="acumReal" stroke="#06B6D4" strokeWidth={2} dot={{ fill: "#06B6D4", r: 4 }} name="acumReal" />
            <Line yAxisId="right" type="monotone" dataKey="acumMetaIng" stroke="#F97316" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: "#F97316", r: 3 }} name="acumMetaIng" />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex gap-4 mt-2 justify-center flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-3 rounded" style={{ background: "#10B981" }} />
            <span className="text-gray-700 dark:text-gray-400">Real (cumple meta)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-3 rounded" style={{ background: "#F97316", opacity: 0.2 }} />
            <span className="text-gray-700 dark:text-gray-400">Meta semanal ingresadas</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-4 border-t-2 border-cyan-500" />
            <span className="text-gray-700 dark:text-gray-400">Acumulado real</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="w-4 border-t-2 border-dashed border-orange-500" />
            <span className="text-gray-700 dark:text-gray-400">Acumulado meta</span>
          </div>
        </div>

        {/* Weekly table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs text-black dark:text-white">
            <thead>
              <tr className="border-b border-cyan-500/20">
                <th className="text-left py-2 px-2 font-bold text-black dark:text-white">Semana</th>
                <th className="text-right py-2 px-2 font-bold text-black dark:text-white">Días</th>
                <th className="text-right py-2 px-2 font-bold text-black dark:text-white">Meta Ing.</th>
                <th className="text-right py-2 px-2 font-bold text-black dark:text-white">Meta Mov.</th>
                <th className="text-right py-2 px-2 font-bold text-black dark:text-white">Real</th>
                <th className="text-right py-2 px-2 font-bold text-black dark:text-white">Acum. Real</th>
                <th className="text-right py-2 px-2 font-bold text-black dark:text-white">Acum. Meta</th>
                <th className="text-right py-2 px-2 font-bold text-black dark:text-white">Necesario/día</th>
                <th className="text-center py-2 px-2 font-bold text-black dark:text-white">Estado</th>
              </tr>
            </thead>
            <tbody>
              {analysis.weeklyData.map((w) => {
                const pct = w.metaIng > 0 && w.diasCargados > 0 ? (w.real / w.metaIng) * 100 : 0;
                const estado = w.diasCargados === 0 ? "Pendiente" : pct >= 100 ? "Cumplida" : pct >= 80 ? "En rango" : "Bajo meta";
                const estadoColor = w.diasCargados === 0 ? "#6b7280" : pct >= 100 ? "#16a34a" : pct >= 80 ? "#ca8a04" : "#dc2626";
                return (
                  <tr key={w.semana} className="border-b border-gray-300/30 dark:border-gray-800/40">
                    <td className="py-2 px-2 font-medium text-black dark:text-white">{w.semana}</td>
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-400">{w.dias} ({w.diasCargados} carg.)</td>
                    <td className="py-2 px-2 text-right font-bold text-black dark:text-white">{w.metaIng.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-black dark:text-white">{w.metaMov.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right font-bold text-black dark:text-white">{w.real > 0 ? w.real.toLocaleString() : "—"}</td>
                    <td className="py-2 px-2 text-right text-black dark:text-white">{w.acumReal > 0 ? w.acumReal.toLocaleString() : "—"}</td>
                    <td className="py-2 px-2 text-right text-black dark:text-white">{w.acumMetaIng.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-black dark:text-white">
                      {w.necesarioDiario > 0 ? w.necesarioDiario.toLocaleString() + "/día" : w.diasCargados > 0 ? "—" : META_DIARIA.toLocaleString() + "/día"}
                    </td>
                    <td className="py-2 px-2 text-center text-[10px] font-medium" style={{ color: estadoColor }}>{estado}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-cyan-500/30">
                <td className="py-2 px-2 font-bold text-black dark:text-white">TOTAL</td>
                <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-400">30</td>
                <td className="py-2 px-2 text-right font-bold text-black dark:text-white">{META_TOTAL.toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-bold text-black dark:text-white">{META_MOV_ACTIVE.toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-bold text-black dark:text-white">{analysis.abrilTotal > 0 ? analysis.abrilTotal.toLocaleString() : "—"}</td>
                <td colSpan={2} className="py-2 px-2 text-right text-gray-700 dark:text-gray-400">
                  {analysis.abrilTotal > 0 ? `${analysis.pctMeta.toFixed(1)}% de meta (proy.)` : ""}
                </td>
                <td className="py-2 px-2 text-right font-bold text-black dark:text-white">
                  {analysis.necesarioPorDiaRestante > 0 ? analysis.necesarioPorDiaRestante.toLocaleString() + "/día" : META_DIARIA.toLocaleString() + "/día"}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MARZO vs ABRIL COMPARISON ═══ */}
      {analysis.diasCargados > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-emerald-500/20" style={{ background: "rgba(16,185,129,0.03)" }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            📊 {COMP_LABEL} vs {ACTIVE_LABEL} — Comparación y Proyección de Crecimiento
          </h3>
          <p className="text-[10px] mb-4" style={{ color: "var(--text-secondary)" }}>
            Acumulado diario: {COMP_LABEL} (real) vs {ACTIVE_LABEL} (real + proyección). El país siempre tiene que crecer vs mes anterior.
          </p>

          {/* KPIs de comparación */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total {COMP_LABEL}</p>
              <p className="text-lg font-bold text-orange-400">{analysis.marzoTotal.toLocaleString()}</p>
            </div>
            <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Acumulado Abril</p>
              <p className="text-lg font-bold text-blue-400">{analysis.abrilTotal.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{analysis.diasCargados} días</p>
            </div>
            <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Proy. Final Abril</p>
              <p className={`text-lg font-bold ${analysis.proyeccionFinal > analysis.marzoTotal ? "text-green-400" : "text-red-400"}`}>
                {analysis.proyeccionFinal.toLocaleString()}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {analysis.crecimientoVsMarzo > 0 ? "📈" : "📉"} {analysis.crecimientoVsMarzo > 0 ? "+" : ""}{analysis.crecimientoVsMarzo.toFixed(1)}% vs {COMP_LABEL}
              </p>
            </div>
            <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Necesario/día para superar Marzo</p>
              <p className="text-lg font-bold text-purple-400">{analysis.necesarioParaSuperarMarzo.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{analysis.diasRestantes} días restantes</p>
            </div>
            <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Necesario/día para Meta</p>
              <p className="text-lg font-bold text-red-400">{analysis.necesarioPorDiaRestante > 0 ? analysis.necesarioPorDiaRestante.toLocaleString() : META_DIARIA.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Meta: {META_TOTAL.toLocaleString()}</p>
            </div>
          </div>

          {/* ═══ 1. GAUGE VELOCÍMETROS ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[
              { label: `vs ${COMP_LABEL}`, pct: analysis.marzoTotal > 0 ? Math.min((analysis.proyeccionFinal / analysis.marzoTotal) * 100, 150) : 0, target: 100, color: analysis.proyeccionFinal > analysis.marzoTotal ? "#10B981" : "#EF4444", sub: `Proy: ${analysis.proyeccionFinal.toLocaleString()} / ${COMP_LABEL}: ${analysis.marzoTotal.toLocaleString()}` },
              { label: "vs Meta", pct: Math.min(analysis.pctMeta, 150), target: 100, color: analysis.pctMeta >= 100 ? "#10B981" : analysis.pctMeta >= 80 ? "#F59E0B" : "#EF4444", sub: `Proy: ${analysis.proyeccionFinal.toLocaleString()} / Meta: ${META_TOTAL.toLocaleString()}` },
              { label: "Ritmo diario", pct: META_DIARIA > 0 ? Math.min((Math.round(analysis.promedioAbril) / META_DIARIA) * 100, 150) : 0, target: 100, color: analysis.promedioAbril >= META_DIARIA ? "#10B981" : analysis.promedioAbril >= META_DIARIA * 0.8 ? "#F59E0B" : "#EF4444", sub: `Actual: ${Math.round(analysis.promedioAbril).toLocaleString()} / Necesario: ${META_DIARIA.toLocaleString()}` },
            ].map((g) => {
              const angle = Math.min(g.pct, 150) / 150 * 180;
              return (
                <div key={g.label} className="flex flex-col items-center p-4 rounded-xl border" style={{ borderColor: `${g.color}30`, background: "var(--bg-card)" }}>
                  <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{g.label}</p>
                  <svg width="140" height="80" viewBox="0 0 140 80">
                    {/* Background arc */}
                    <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke="#374151" strokeWidth="10" strokeLinecap="round" />
                    {/* Colored arc */}
                    <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke={g.color} strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${angle / 180 * 188.5} 188.5`}
                      style={{ transition: "stroke-dasharray 0.8s ease" }} />
                    {/* Needle */}
                    {(() => {
                      const needleAngle = (angle - 90) * Math.PI / 180;
                      const cx = 70, cy = 75, len = 45;
                      const nx = cx + len * Math.cos(needleAngle - Math.PI);
                      const ny = cy + len * Math.sin(needleAngle - Math.PI);
                      return <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={g.color} strokeWidth="2.5" strokeLinecap="round" style={{ transition: "all 0.8s ease" }} />;
                    })()}
                    <circle cx="70" cy="75" r="4" fill={g.color} />
                    {/* Labels */}
                    <text x="10" y="78" fontSize="8" fill="#6b7280" textAnchor="start">0%</text>
                    <text x="130" y="78" fontSize="8" fill="#6b7280" textAnchor="end">150%</text>
                  </svg>
                  <p className="text-2xl font-bold mt-1" style={{ color: g.color }}>{Math.round(g.pct)}%</p>
                  <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>{g.sub}</p>
                </div>
              );
            })}
          </div>

          {/* ═══ 2. DONUT RINGS ═══ */}
          <div className="flex flex-col items-center mb-5">
            <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>Progreso: Meta vs {COMP_LABEL} vs {ACTIVE_LABEL}</p>
            <svg width="200" height="200" viewBox="0 0 200 200">
              {/* Meta ring (outer) */}
              <circle cx="100" cy="100" r="85" fill="none" stroke="#374151" strokeWidth="12" />
              <circle cx="100" cy="100" r="85" fill="none" stroke="#EF4444" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${Math.min(analysis.abrilTotal / META_TOTAL, 1) * 534} 534`}
                transform="rotate(-90 100 100)" style={{ transition: "stroke-dasharray 1s ease" }} />
              {/* Marzo ring (middle) */}
              <circle cx="100" cy="100" r="68" fill="none" stroke="#374151" strokeWidth="12" />
              <circle cx="100" cy="100" r="68" fill="none" stroke="#F97316" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${Math.min(analysis.abrilTotal / analysis.marzoTotal, 1) * 427} 427`}
                transform="rotate(-90 100 100)" style={{ transition: "stroke-dasharray 1s ease" }} />
              {/* Abril ring (inner) */}
              <circle cx="100" cy="100" r="51" fill="none" stroke="#374151" strokeWidth="12" />
              <circle cx="100" cy="100" r="51" fill="none" stroke="#10B981" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${Math.min(analysis.diasCargados / 30, 1) * 320} 320`}
                transform="rotate(-90 100 100)" style={{ transition: "stroke-dasharray 1s ease" }} />
              {/* Center text */}
              <text x="100" y="95" textAnchor="middle" fontSize="22" fontWeight="bold" fill={analysis.proyeccionFinal > analysis.marzoTotal ? "#10B981" : "#EF4444"}>
                {analysis.diasCargados > 0 ? `${Math.round(analysis.abrilTotal / analysis.marzoTotal * 100)}%` : "—"}
              </text>
              <text x="100" y="112" textAnchor="middle" fontSize="10" fill="#6b7280">vs {COMP_LABEL}</text>
            </svg>
            <div className="flex gap-4 mt-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#EF4444" }} />Meta ({Math.round(analysis.abrilTotal / META_TOTAL * 100)}%)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#F97316" }} />vs {COMP_LABEL} ({Math.round(analysis.abrilTotal / analysis.marzoTotal * 100)}%)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#10B981" }} />Días cargados ({analysis.diasCargados}/30)</span>
            </div>
          </div>

          {/* ═══ 3. HEATMAP CALENDAR ═══ */}
          <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>Calendario {ACTIVE_LABEL} — Rendimiento diario vs {COMP_LABEL}</p>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Lun", "Mar", "Mie", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d} className="text-center text-[9px] font-medium py-1" style={{ color: "var(--text-muted)" }}>{d}</div>
            ))}
            {/* Offset según día de la semana del día 1 del mes activo.
                Lun=0, Mar=1, Mié=2, Jue=3, Vie=4, Sáb=5, Dom=6.
                Abril 2026 = miércoles (2), Mayo 2026 = viernes (4), Junio 2026 = lunes (0). */}
            {(() => {
              const dow0 = DIAS_SEMANA_ACTIVE[0];
              const offset = { LUNES: 0, MARTES: 1, MIÉRCOLES: 2, JUEVES: 3, VIERNES: 4, SÁBADO: 5, DOMINGO: 6 }[dow0] ?? 0;
              return Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />);
            })()}
            {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
              const dia = i + 1;
              const abrilDay = abrilData.find((d) => d.fecha === dia);
              const marzoDay = analysis.comparisonData.find((d) => d.dia === dia);
              const marzoVal = marzoDay?.marzo || 0;
              const abrilVal = abrilDay?.ordenes || 0;
              const isLoaded = !!abrilDay;
              const isProjected = !isLoaded && analysis.diasCargados > 0;
              const proyVal = isProjected ? Math.round(analysis.promedioAbril) : 0;
              const displayVal = isLoaded ? abrilVal : proyVal;

              let bg = "#1f2937";
              let textCol = "#6b7280";
              if (isLoaded) {
                const ratio = marzoVal > 0 ? abrilVal / marzoVal : 1;
                if (ratio >= 1.2) { bg = "#065f46"; textCol = "#6ee7b7"; }
                else if (ratio >= 1) { bg = "#047857"; textCol = "#a7f3d0"; }
                else if (ratio >= 0.8) { bg = "#92400e"; textCol = "#fcd34d"; }
                else { bg = "#7f1d1d"; textCol = "#fca5a5"; }
              } else if (isProjected) {
                bg = "#1e3a5f"; textCol = "#60a5fa";
              }

              return (
                <div key={dia} className="relative rounded-lg p-1 text-center cursor-default" style={{ background: bg, minHeight: "48px" }}
                  title={isLoaded ? `Día ${dia}: ${abrilVal.toLocaleString()} (${COMP_LABEL}: ${marzoVal.toLocaleString()}) ${abrilVal >= marzoVal ? "✓ Superó" : "✗ Bajo"}` : isProjected ? `Día ${dia}: Proyección ${proyVal.toLocaleString()}` : `Día ${dia}: Sin datos`}>
                  <p className="text-[9px] font-bold" style={{ color: textCol }}>{dia}</p>
                  <p className="text-[11px] font-bold" style={{ color: textCol }}>
                    {isLoaded ? abrilVal.toLocaleString() : isProjected ? `~${proyVal.toLocaleString()}` : "—"}
                  </p>
                  {isLoaded && (
                    <p className="text-[8px]" style={{ color: textCol, opacity: 0.7 }}>
                      {abrilVal >= marzoVal ? "▲" : "▼"}{marzoVal > 0 ? Math.round((abrilVal / marzoVal - 1) * 100) : 0}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 justify-center flex-wrap text-[9px]" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#065f46" }} />+20% vs {COMP_LABEL}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#047857" }} />Superó Marzo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#92400e" }} />80-100% de {COMP_LABEL}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#7f1d1d" }} />Bajo Marzo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "#1e3a5f" }} />Proyección</span>
          </div>

          {/* Status message */}
          <div className="mt-3 p-3 rounded-lg border" style={{
            borderColor: analysis.proyeccionFinal > analysis.marzoTotal && analysis.pctMeta >= 100
              ? "rgba(16,185,129,0.3)" : analysis.proyeccionFinal > analysis.marzoTotal
              ? "rgba(234,179,8,0.3)" : "rgba(239,68,68,0.3)",
            background: analysis.proyeccionFinal > analysis.marzoTotal && analysis.pctMeta >= 100
              ? "rgba(16,185,129,0.06)" : analysis.proyeccionFinal > analysis.marzoTotal
              ? "rgba(234,179,8,0.06)" : "rgba(239,68,68,0.06)",
          }}>
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {analysis.proyeccionFinal > analysis.marzoTotal && analysis.pctMeta >= 100
                ? `✅ Excelente: La proyeccion de ${ACTIVE_LABEL} (${analysis.proyeccionFinal.toLocaleString()}) supera a ${COMP_LABEL} (${analysis.marzoTotal.toLocaleString()}) y alcanza la meta (${META_TOTAL.toLocaleString()}). Mantener el ritmo de ${Math.round(analysis.promedioAbril).toLocaleString()}/día.`
                : analysis.proyeccionFinal > analysis.marzoTotal
                ? `⚠ ${ACTIVE_LABEL} (${analysis.proyeccionFinal.toLocaleString()}) supera a ${COMP_LABEL} (${analysis.marzoTotal.toLocaleString()}) pero no alcanza la meta (${META_TOTAL.toLocaleString()}). Necesitas ${analysis.necesarioPorDiaRestante.toLocaleString()}/día los próximos ${analysis.diasRestantes} días.`
                : `🚨 Alerta: Al ritmo actual, ${ACTIVE_LABEL} (${analysis.proyeccionFinal.toLocaleString()}) NO supera a ${COMP_LABEL} (${analysis.marzoTotal.toLocaleString()}). Necesitas al menos ${analysis.necesarioParaSuperarMarzo.toLocaleString()}/día para superar ${COMP_LABEL}, y ${analysis.necesarioPorDiaRestante.toLocaleString()}/día para la meta.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Comparison reference chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Referencia {COMP_LABEL_FULL}
          <span className="text-[10px] text-gray-500 ml-2">
            Total: {COMP_TOTAL_REF.toLocaleString()} &middot; Prom: {COMP_PROMEDIO_REF.toLocaleString()}/día
          </span>
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={marzoChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
              itemStyle={{ color: "#F97316" }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value) => `${Number(value).toLocaleString()} órdenes`}
            />
            <ReferenceLine y={COMP_PROMEDIO_REF} stroke="#6B7280" strokeDasharray="4 4" label={{ value: `Prom: ${COMP_PROMEDIO_REF.toLocaleString()}`, fill: "#6B7280", fontSize: 10, position: "right" }} />
            <Bar dataKey="Órdenes" radius={[4, 4, 0, 0]} fill="#F97316" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Day-of-week pattern */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Patrón por Día de Semana ({COMP_LABEL})</h3>
        <div className="grid grid-cols-7 gap-2">
          {["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"].map((dow) => {
            const avg = analysis.dowAvg[dow] || 0;
            return (
              <div key={dow} className="text-center p-2 rounded-xl border border-gray-800" style={{ background: "rgba(15,52,96,0.15)" }}>
                <p className="text-[10px] text-gray-400">{dow.slice(0, 3)}</p>
                <p className="text-lg font-bold text-orange-400">{avg.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">prom/día</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </ChartDownloadBtn>
  );
}
