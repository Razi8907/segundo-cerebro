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
}

const DIAS_SEMANA_ABRIL = [
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES",
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
const MES_LABELS: Record<string, string> = { enero: "Enero 2026", febrero: "Febrero 2026", marzo: "Marzo 2026" };

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
  const META_DIARIA = metaInfo.promedio_diario_necesario;
  const META_TOTAL = metaInfo.meta_ingresadas_abril;
  const isAbril = mesFilter === "abril";

  const STORAGE_KEY = `segundo-cerebro-abril-${country}`;

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

  // Load from DB on mount — DB is source of truth
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/data/daily-tracking?country=${country}`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res.days) && res.days.length > 0) {
          setAbrilData(res.days);
        }
        setDbLoaded(true);
      })
      .catch(() => { if (!cancelled) setDbLoaded(true); });
    return () => { cancelled = true; };
  }, [country]);

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
    if (isNaN(day) || isNaN(ordenes) || day < 1 || day > 30) return;

    const dia_semana = DIAS_SEMANA_ABRIL[day - 1];
    setTrackingError(null);

    // Persist to DB FIRST so the user gets immediate error feedback
    try {
      const res = await fetch("/api/data/daily-tracking", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, fecha: day, ordenes, dia_semana }),
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
  }, [inputDay, inputOrdenes, country]);

  const deleteDay = useCallback(async (day: number) => {
    setTrackingError(null);
    try {
      const res = await fetch(`/api/data/daily-tracking?country=${country}&fecha=${day}`, {
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
  }, [country]);

  const analysis = useMemo(() => {
    // Marzo analysis
    const marzoByDow: Record<string, number[]> = {};
    marzoData.forEach((d) => {
      if (!marzoByDow[d.dia_semana]) marzoByDow[d.dia_semana] = [];
      marzoByDow[d.dia_semana].push(d.ordenes);
    });
    const dowAvg: Record<string, number> = {};
    Object.entries(marzoByDow).forEach(([dow, vals]) => {
      dowAvg[dow] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });

    // Abril progress
    const abrilTotal = abrilData.reduce((s, d) => s + d.ordenes, 0);
    const diasCargados = abrilData.length;
    const diasRestantes = 30 - diasCargados;
    const promedioAbril = diasCargados > 0 ? abrilTotal / diasCargados : 0;
    const proyeccionFinal = diasCargados > 0 ? Math.round(promedioAbril * 30) : 0;
    const pctMeta = diasCargados > 0 ? (proyeccionFinal / META_TOTAL) * 100 : 0;
    const necesarioPorDiaRestante = diasRestantes > 0 ? Math.round((META_TOTAL - abrilTotal) / diasRestantes) : 0;

    const coloredAbril = abrilData.map((d) => {
      let color: "verde" | "amarillo" | "rojo";
      if (d.ordenes >= META_DIARIA) color = "verde";
      else if (d.ordenes >= META_DIARIA * 0.8) color = "amarillo";
      else color = "rojo";
      return { ...d, color };
    });

    // Projection using actual April average for remaining days
    const abrilProjected: { fecha: number; ordenes: number | null; proyectado: number; dia_semana: string }[] = [];
    // Use April's own average if we have data, otherwise fall back to March pattern
    const proyBase = diasCargados > 0 ? Math.round(promedioAbril) : metaInfo.marzo_promedio_diario;
    for (let i = 1; i <= 30; i++) {
      const existing = abrilData.find((d) => d.fecha === i);
      const dow = DIAS_SEMANA_ABRIL[i - 1];
      abrilProjected.push({
        fecha: i,
        ordenes: existing ? existing.ordenes : null,
        proyectado: existing ? existing.ordenes : proyBase,
        dia_semana: dow,
      });
    }

    // Projected movilizadas based on actual April data
    const proyMovilizadas = diasCargados > 0 ? Math.round(proyeccionFinal * (metaInfo.meta_movilizadas_abril / META_TOTAL)) : 0;

    // Weekly breakdown for April
    const META_MOV = metaInfo.meta_movilizadas_abril;
    const weeks = [
      { label: "S1 (1-6)", start: 1, end: 6, dias: 6 },
      { label: "S2 (7-13)", start: 7, end: 13, dias: 7 },
      { label: "S3 (14-20)", start: 14, end: 20, dias: 7 },
      { label: "S4 (21-27)", start: 21, end: 27, dias: 7 },
      { label: "S5 (28-30)", start: 28, end: 30, dias: 3 },
    ];

    let acumReal = 0;
    const weeklyData = weeks.map((w) => {
      // Real data for loaded days
      const realDays = abrilData.filter((d) => d.fecha >= w.start && d.fecha <= w.end);
      const realTotal = realDays.reduce((s, d) => s + d.ordenes, 0);
      const diasCargadosWeek = realDays.length;
      acumReal += realTotal;

      // Meta semanal proporcional (ingresadas)
      const metaSemanalIng = Math.round(META_TOTAL * (w.dias / 30));
      // Meta semanal movilizadas
      const metaSemanalMov = Math.round(META_MOV * (w.dias / 30));

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
      const acumMetaIng = Math.round(META_TOTAL * (w.end / 30));
      const acumMetaMov = Math.round(META_MOV * (w.end / 30));

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

    // Marzo vs Abril comparison (day by day) + projection
    const marzoTotal = marzoData.reduce((s, d) => s + d.ordenes, 0);
    const marzoByDay = new Map<number, number>();
    marzoData.forEach((d) => marzoByDay.set(d.fecha, d.ordenes));
    const maxDays = Math.max(31, 30); // marzo 31, abril 30

    const comparisonData: { dia: number; marzo: number | null; abril: number | null; proyAbril: number | null; necesarioParaSuperarMarzo: number | null }[] = [];
    let acumMarzo = 0;
    let acumAbril = 0;
    const marzoFinalTotal = marzoTotal;
    for (let i = 1; i <= 31; i++) {
      const mVal = marzoByDay.get(i) || 0;
      acumMarzo += mVal;
      const aDay = abrilData.find((d) => d.fecha === i);
      const aVal = aDay ? aDay.ordenes : null;
      if (aVal !== null) acumAbril += aVal;

      // Projected April (for days not yet loaded)
      let proyAbril: number | null = null;
      if (i <= 30) {
        if (aVal !== null) {
          proyAbril = aVal;
        } else if (diasCargados > 0) {
          proyAbril = Math.round(promedioAbril);
        }
      }

      comparisonData.push({
        dia: i,
        marzo: i <= 31 ? mVal : null,
        abril: i <= 30 ? aVal : null,
        proyAbril: i <= 30 ? proyAbril : null,
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
    for (let i = 1; i <= 31; i++) {
      cMarzo += marzoByDay.get(i) || 0;
      const aDay = abrilData.find((d) => d.fecha === i);
      if (aDay) cAbril += aDay.ordenes;

      acumComparisonData.push({
        dia: i,
        acumMarzo: i <= 31 ? cMarzo : cMarzo,
        acumAbril: i <= 30 && abrilData.some((d) => d.fecha <= i) ? cAbril : null,
        acumProy: i <= 30 && i > diasCargados && diasCargados > 0
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
  }, [marzoData, abrilData, META_DIARIA, META_TOTAL, metaInfo]);

  const colorMap = { verde: "#10B981", amarillo: "#F59E0B", rojo: "#EF4444" };

  const marzoChartData = marzoData.map((d) => ({
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
  if (!isAbril) {
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
        🎯 Seguimiento Diario &mdash; Meta Abril: {META_TOTAL.toLocaleString()} ingresadas
      </h2>
      <p className="text-xs text-gray-400 mb-6">
        Carga diaria de Abril &middot; Meta diaria: {META_DIARIA.toLocaleString()} órdenes &middot; Objetivo: {metaInfo.meta_movilizadas_abril.toLocaleString()} movilizadas
      </p>

      {/* KPIs row - solo Abril */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Acumulado Abril</p>
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
          <p className={`text-lg font-bold ${analysis.proyMovilizadas >= metaInfo.meta_movilizadas_abril * 0.9 ? "text-green-400" : analysis.proyMovilizadas >= metaInfo.meta_movilizadas_abril * 0.7 ? "text-yellow-400" : "text-orange-400"}`}>
            {analysis.proyMovilizadas > 0 ? analysis.proyMovilizadas.toLocaleString() : "—"}
          </p>
          <p className="text-[10px] text-gray-500">Meta: {metaInfo.meta_movilizadas_abril.toLocaleString()} mov.</p>
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
        <h3 className="text-sm font-medium text-green-400 mb-3">Cargar datos de Abril</h3>
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
            Abril 2026 &mdash; Real vs Meta Necesaria
            <span className="text-[10px] text-gray-500 ml-2">
              🟢 &ge;{META_DIARIA.toLocaleString()} &middot; 🟡 &ge;{Math.round(META_DIARIA * 0.8).toLocaleString()} &middot; 🔴 &lt;{Math.round(META_DIARIA * 0.8).toLocaleString()}
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={analysis.abrilProjected.map((d) => ({
              ...d,
              real: d.ordenes,
              necesario: d.ordenes != null ? null : analysis.necesarioPorDiaRestante,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="fecha" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
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
              <Bar dataKey="real" name="real" radius={[4, 4, 0, 0]} barSize={16}>
                {analysis.abrilProjected.map((d, i) => {
                  const color = d.ordenes != null
                    ? d.ordenes >= META_DIARIA ? "#10B981" : d.ordenes >= META_DIARIA * 0.8 ? "#F59E0B" : "#EF4444"
                    : "transparent";
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
              <Bar dataKey="necesario" name="necesario" radius={[4, 4, 0, 0]} barSize={16} opacity={0.35}>
                {analysis.abrilProjected.map((d, i) => (
                  <Cell key={i} fill={d.ordenes != null ? "transparent" : "#8B5CF6"} />
                ))}
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
              <span className="w-3 h-3 rounded" style={{ background: "#8B5CF6", opacity: 0.35 }} />
              <span className="text-gray-400">Necesario/día restante ({analysis.necesarioPorDiaRestante.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-8 border-t border-dashed border-gray-500" />
              <span className="text-gray-400">Proyección base (Marzo)</span>
            </div>
          </div>
        </div>
      )}

      {/* Weekly projection chart */}
      <div className="mb-6 p-4 rounded-xl border border-cyan-500/20" style={{ background: "rgba(6,182,212,0.03)" }}>
        <h3 className="text-sm font-bold mb-1 text-black dark:text-white">
          📅 Proyección Semanal — Camino a {META_TOTAL.toLocaleString()} ingresadas → {metaInfo.meta_movilizadas_abril.toLocaleString()} movilizadas
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
                <td className="py-2 px-2 text-right font-bold text-black dark:text-white">{metaInfo.meta_movilizadas_abril.toLocaleString()}</td>
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
            📊 Marzo vs Abril — Comparación y Proyección de Crecimiento
          </h3>
          <p className="text-[10px] mb-4" style={{ color: "var(--text-secondary)" }}>
            Acumulado diario: Marzo (real) vs Abril (real + proyección). El país siempre tiene que crecer vs mes anterior.
          </p>

          {/* KPIs de comparación */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total Marzo</p>
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
                {analysis.crecimientoVsMarzo > 0 ? "📈" : "📉"} {analysis.crecimientoVsMarzo > 0 ? "+" : ""}{analysis.crecimientoVsMarzo.toFixed(1)}% vs Marzo
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

          {/* Gráfico barras lado a lado: Marzo vs Abril día a día */}
          <p className="text-[10px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>Órdenes diarias: Marzo (naranja) vs Abril (verde) — día a día</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analysis.comparisonData.filter(d => d.dia <= 30)} barGap={0} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="dia" tick={{ fill: "#9ca3af", fontSize: 9 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "12px", color: "#e5e7eb", fontSize: 11 }}
                formatter={(value, name) => {
                  if (value == null) return ["—", name];
                  const labels: Record<string, string> = { marzo: "Marzo", abril: "Abril (real)", proyAbril: "Abril (proyección)" };
                  return [Number(value).toLocaleString(), labels[String(name)] || String(name)];
                }}
                labelFormatter={(dia) => `Día ${dia}`}
              />
              <ReferenceLine y={META_DIARIA} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `Meta/día: ${META_DIARIA.toLocaleString()}`, fill: "#EF4444", fontSize: 9, position: "insideTopRight" }} />
              <ReferenceLine y={metaInfo.marzo_promedio_diario} stroke="#F97316" strokeDasharray="4 4" label={{ value: `Prom Marzo: ${metaInfo.marzo_promedio_diario.toLocaleString()}`, fill: "#F97316", fontSize: 9, position: "insideBottomRight" }} />
              <Bar dataKey="marzo" name="marzo" fill="#F97316" opacity={0.6} radius={[3, 3, 0, 0]} />
              <Bar dataKey="abril" name="abril" fill="#10B981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="proyAbril" name="proyAbril" fill="#10B981" opacity={0.25} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center flex-wrap text-[10px]">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" style={{ opacity: 0.6 }} />Marzo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Abril real</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" style={{ opacity: 0.25 }} />Abril proyección</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" />Meta diaria</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block" />Prom. Marzo</span>
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
                ? `✅ Excelente: La proyeccion de Abril (${analysis.proyeccionFinal.toLocaleString()}) supera a Marzo (${analysis.marzoTotal.toLocaleString()}) y alcanza la meta (${META_TOTAL.toLocaleString()}). Mantener el ritmo de ${Math.round(analysis.promedioAbril).toLocaleString()}/día.`
                : analysis.proyeccionFinal > analysis.marzoTotal
                ? `⚠ Abril (${analysis.proyeccionFinal.toLocaleString()}) supera a Marzo (${analysis.marzoTotal.toLocaleString()}) pero no alcanza la meta (${META_TOTAL.toLocaleString()}). Necesitas ${analysis.necesarioPorDiaRestante.toLocaleString()}/día los próximos ${analysis.diasRestantes} días.`
                : `🚨 Alerta: Al ritmo actual, Abril (${analysis.proyeccionFinal.toLocaleString()}) NO supera a Marzo (${analysis.marzoTotal.toLocaleString()}). Necesitas al menos ${analysis.necesarioParaSuperarMarzo.toLocaleString()}/día para superar Marzo, y ${analysis.necesarioPorDiaRestante.toLocaleString()}/día para la meta.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Marzo reference chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Referencia Marzo 2026
          <span className="text-[10px] text-gray-500 ml-2">
            Total: {metaInfo.marzo_total_ordenes.toLocaleString()} &middot; Prom: {metaInfo.marzo_promedio_diario.toLocaleString()}/día
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
