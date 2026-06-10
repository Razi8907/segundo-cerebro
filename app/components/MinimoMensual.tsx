"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const NO_MOV = new Set([
  "PENDIENTE","PENDIENTE CONFIRMACION","GUIA_GENERADA","PREPARADO PARA TRANSPORTADORA",
  "CANCELADO","RECHAZADO","GUIA ANULADA","CANCELADO POR TRANSPORTADORA",
]);

type Mes = "abril" | "mayo" | "junio";
type ByDS = { nombre: string; total: number; estados: Record<string, number> };
type ByDSDaily = { ds: string; fecha: string; ordenes: number };
type ByDate = { fecha: string; total: number; estados: Record<string, number> };

const MES_LABEL: Record<Mes, string> = { abril: "Abril", mayo: "Mayo", junio: "Junio" };
const MES_DIAS: Record<Mes, number> = { abril: 30, mayo: 31, junio: 30 };

function dayOfMonth(s: string): number | null {
  const m = s.match(/^(\d{1,2})[-/]/);
  return m ? parseInt(m[1], 10) : null;
}

function movFromEstados(estados: Record<string, number>): number {
  let total = 0, noMov = 0;
  for (const k in estados) {
    total += estados[k] || 0;
    if (NO_MOV.has(k)) noMov += estados[k] || 0;
  }
  return Math.max(total - noMov, 0);
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

// Filtra by_ds_daily a un rango de días y agrega por DS aplicando el ratio
// mensual de mov/ing para estimar movilizadas en el rango.
function aggregateRange(
  daily: ByDSDaily[],
  monthlyTotals: Map<string, { ing: number; mov: number; nombre: string }>,
  fromDay: number,
  toDay: number,
): Map<string, { ing: number; mov: number; nombre: string }> {
  const map = new Map<string, { ing: number; mov: number; nombre: string }>();
  for (const r of daily) {
    const d = dayOfMonth(r.fecha);
    if (d === null || d < fromDay || d > toDay) continue;
    const clean = String(r.ds).replace(/\s*\(\d+\)\s*$/, "").trim();
    const prev = map.get(clean) || { ing: 0, mov: 0, nombre: r.ds };
    prev.ing += r.ordenes || 0;
    map.set(clean, prev);
  }
  // Estimar mov con ratio mensual
  map.forEach((v, k) => {
    const m = monthlyTotals.get(k);
    const ratio = m && m.ing > 0 ? m.mov / m.ing : 0;
    v.mov = Math.round(v.ing * ratio);
  });
  return map;
}

export default function MinimoMensual({ country, mes }: { country: "ar" | "py"; mes: Mes }) {
  const mesAnterior: Mes | null = mes === "junio" ? "mayo" : mes === "mayo" ? "abril" : null;
  const mesAntAnt: Mes | null = mes === "junio" ? "abril" : null;

  const [opsTarget, setOpsTarget] = useState<ByDS[]>([]);
  const [opsBase, setOpsBase] = useState<ByDS[]>([]);
  const [opsHist, setOpsHist] = useState<ByDS[]>([]); // mes anterior al base, opcional
  const [dailyTarget, setDailyTarget] = useState<ByDSDaily[]>([]);
  const [dailyBase, setDailyBase] = useState<ByDSDaily[]>([]);
  const [dailyHist, setDailyHist] = useState<ByDSDaily[]>([]);
  const [byDateTarget, setByDateTarget] = useState<ByDate[]>([]);
  const [byDateBase, setByDateBase] = useState<ByDate[]>([]);
  const [metaInfo, setMetaInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<"share" | "gap" | "growth">("share");
  // Filtro temporal
  const [filterMode, setFilterMode] = useState<"full" | "single" | "range">("full");
  const [filterFrom, setFilterFrom] = useState<number>(1);
  const [filterTo, setFilterTo] = useState<number>(10);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const meses: Mes[] = ["abril", "mayo", "junio"];
      const results = await Promise.all(
        meses.map((m) => fetch(`/api/data/operational?country=${country}&mes=${m}`).then(r => r.json()).catch(() => null))
      );
      const dash = await fetch(`/api/data/${country}`).then(r => r.json()).catch(() => null);
      const map: Record<Mes, ByDS[]> = { abril: [], mayo: [], junio: [] };
      const dailyMap: Record<Mes, ByDSDaily[]> = { abril: [], mayo: [], junio: [] };
      const byDateMap: Record<Mes, ByDate[]> = { abril: [], mayo: [], junio: [] };
      meses.forEach((m, i) => {
        map[m] = Array.isArray(results[i]?.data?.by_dropshipper) ? results[i].data.by_dropshipper : [];
        dailyMap[m] = Array.isArray(results[i]?.data?.by_ds_daily) ? results[i].data.by_ds_daily : [];
        byDateMap[m] = Array.isArray(results[i]?.data?.by_date) ? results[i].data.by_date : [];
      });
      setOpsTarget(map[mes]);
      setDailyTarget(dailyMap[mes]);
      setByDateTarget(byDateMap[mes]);
      if (mesAnterior) { setOpsBase(map[mesAnterior]); setDailyBase(dailyMap[mesAnterior]); setByDateBase(byDateMap[mesAnterior]); }
      else { setOpsBase([]); setDailyBase([]); setByDateBase([]); }
      if (mesAntAnt) { setOpsHist(map[mesAntAnt]); setDailyHist(dailyMap[mesAntAnt]); }
      else { setOpsHist([]); setDailyHist([]); }
      setMetaInfo(dash?.meta_info || {});
    } finally {
      setLoading(false);
    }
  }, [country, mes, mesAnterior, mesAntAnt]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Determinar mes en curso
  const today = new Date();
  const isCurrent = today.getFullYear() === 2026 && (today.getMonth() + 1) === ({ abril: 4, mayo: 5, junio: 6 }[mes]);
  const diasMes = (metaInfo[`dias_${mes}`] as number) ?? MES_DIAS[mes];
  const diasTranscurridos = isCurrent ? today.getDate() : diasMes;

  // Totales mensuales completos (referencia para ratios)
  const dsTargetFull = useMemo(() => aggregateDS(opsTarget), [opsTarget]);
  const dsBaseFull = useMemo(() => aggregateDS(opsBase), [opsBase]);
  const dsHistFull = useMemo(() => aggregateDS(opsHist), [opsHist]);

  // Rango efectivo (días)
  const maxDias = Math.max(diasMes, 31);
  const rangeFrom = filterMode === "full" ? 1 : Math.max(1, Math.min(filterFrom, maxDias));
  const rangeTo = filterMode === "full"
    ? maxDias
    : filterMode === "single"
    ? Math.max(1, Math.min(filterFrom, maxDias))
    : Math.max(rangeFrom, Math.min(filterTo, maxDias));
  const isFiltered = filterMode !== "full";
  const daysInFilter = isFiltered ? Math.max(rangeTo - rangeFrom + 1, 1) : diasMes;

  // dsTarget/Base/Hist según el filtro (si no hay filtro = full)
  const dsTarget = useMemo(() => isFiltered ? aggregateRange(dailyTarget, dsTargetFull, rangeFrom, rangeTo) : dsTargetFull,
    [isFiltered, dailyTarget, dsTargetFull, rangeFrom, rangeTo]);
  const dsBase = useMemo(() => isFiltered ? aggregateRange(dailyBase, dsBaseFull, rangeFrom, rangeTo) : dsBaseFull,
    [isFiltered, dailyBase, dsBaseFull, rangeFrom, rangeTo]);
  const dsHist = useMemo(() => isFiltered ? aggregateRange(dailyHist, dsHistFull, rangeFrom, rangeTo) : dsHistFull,
    [isFiltered, dailyHist, dsHistFull, rangeFrom, rangeTo]);

  // Totales mensuales país
  const totals = useMemo(() => {
    const sum = (m: Map<string, any>) => {
      let ing = 0, mov = 0;
      m.forEach((v) => { ing += v.ing; mov += v.mov; });
      return { ing, mov, pctMov: ing > 0 ? mov / ing : 0 };
    };
    return { target: sum(dsTarget), base: sum(dsBase), hist: sum(dsHist) };
  }, [dsTarget, dsBase, dsHist]);

  // Metas mensuales (mes completo)
  const metaMovFull = metaInfo[`meta_movilizadas_${mes}`] ?? metaInfo[`meta_movilizadas_${mesAnterior ?? mes}`] ?? 0;
  const metaIngFull = metaInfo[`meta_ingresadas_${mes}`]
    ?? (totals.base.pctMov > 0 ? Math.round(metaMovFull / totals.base.pctMov) : metaInfo[`meta_ingresadas_${mesAnterior ?? mes}`] ?? 0);

  // Metas escaladas al período filtrado (proporcional)
  const metaMov = isFiltered ? Math.round(metaMovFull * (daysInFilter / diasMes)) : metaMovFull;
  const metaIng = isFiltered ? Math.round(metaIngFull * (daysInFilter / diasMes)) : metaIngFull;

  // DSs activos por mes (con ≥1 ingresada)
  const activos = {
    target: Array.from(dsTarget.values()).filter(v => v.ing > 0).length,
    base: Array.from(dsBase.values()).filter(v => v.ing > 0).length,
    hist: Array.from(dsHist.values()).filter(v => v.ing > 0).length,
  };

  // Brecha
  const movGap = Math.max(metaMov - totals.target.mov, 0);
  const ingGapRaw = Math.max(metaIng - totals.target.ing, 0);
  const ingGapFromMov = totals.base.pctMov > 0 ? movGap / totals.base.pctMov : ingGapRaw;
  const ingGap = Math.max(ingGapRaw, ingGapFromMov);

  // Cuota mensual por DS (proporcional al share del DS en el mes base)
  const tabla = useMemo(() => {
    let totalMovBase = 0;
    dsBase.forEach((v) => { totalMovBase += v.mov; });
    const allKeys = new Set<string>([...dsBase.keys(), ...dsTarget.keys(), ...dsHist.keys()]);
    const rows: {
      nombre: string;
      histMov: number; histIng: number;
      baseMov: number; baseIng: number;
      targetMov: number; targetIng: number;
      cuotaMov: number; cuotaIng: number;
      share: number; growthReq: number;
      gap: number;
      // Comparativa directa base vs target en el rango (Δ y %)
      deltaIng: number; deltaMov: number;
      pctIng: number; pctMov: number;
      status: "verde" | "amarillo" | "rojo" | "nuevo" | "perdido";
    }[] = [];
    allKeys.forEach((nombre) => {
      const h = dsHist.get(nombre) || { ing: 0, mov: 0, nombre };
      const b = dsBase.get(nombre) || { ing: 0, mov: 0, nombre };
      const t = dsTarget.get(nombre) || { ing: 0, mov: 0, nombre };
      const share = totalMovBase > 0 ? b.mov / totalMovBase : 1 / Math.max(allKeys.size, 1);
      const cuotaMov = metaMov * share;
      const cuotaIng = totals.base.pctMov > 0 ? cuotaMov / totals.base.pctMov : 0;
      const growthReq = b.mov > 0 ? ((cuotaMov - b.mov) / b.mov) * 100 : (cuotaMov > 0 ? 100 : 0);
      const gap = cuotaMov - t.mov;

      // Status:
      // - Con filtro: comparamos cuotaMov (ya escalada al período) vs target real (también filtrado).
      // - Sin filtro, mes EN CURSO: cuota proporcional al avance del mes.
      // - Sin filtro, mes CERRADO: cuota completa vs total real.
      let status: "verde" | "amarillo" | "rojo" | "nuevo" | "perdido";
      const cuotaActual = isFiltered ? cuotaMov : (isCurrent ? cuotaMov * (diasTranscurridos / diasMes) : cuotaMov);
      const cumplimiento = cuotaActual > 0 ? (t.mov / cuotaActual) * 100 : (t.mov > 0 ? 200 : 100);
      if (b.mov === 0 && t.mov > 0) status = "nuevo";
      else if (b.mov > 0 && t.mov === 0) status = "perdido";
      else if (cumplimiento >= 100) status = "verde";
      else if (cumplimiento >= 75) status = "amarillo";
      else status = "rojo";

      const deltaIng = t.ing - b.ing;
      const deltaMov = t.mov - b.mov;
      const pctIng = b.ing > 0 ? (deltaIng / b.ing) * 100 : (t.ing > 0 ? 100 : 0);
      const pctMov = b.mov > 0 ? (deltaMov / b.mov) * 100 : (t.mov > 0 ? 100 : 0);
      rows.push({
        nombre,
        histMov: h.mov, histIng: h.ing,
        baseMov: b.mov, baseIng: b.ing,
        targetMov: t.mov, targetIng: t.ing,
        cuotaMov, cuotaIng,
        share: share * 100,
        growthReq,
        gap,
        deltaIng, deltaMov, pctIng, pctMov,
        status,
      });
    });
    return rows;
  }, [dsBase, dsTarget, dsHist, metaMov, totals.base.pctMov, isCurrent, diasTranscurridos, diasMes, isFiltered]);

  const tablaOrdenada = useMemo(() => {
    const r = [...tabla];
    if (sortBy === "share") r.sort((a, b) => b.share - a.share);
    else if (sortBy === "gap") r.sort((a, b) => b.gap - a.gap);
    else if (sortBy === "growth") r.sort((a, b) => b.growthReq - a.growthReq);
    return r;
  }, [tabla, sortBy]);

  const tablaFiltrada = useMemo(() => {
    if (!search.trim()) return tablaOrdenada;
    const s = search.toLowerCase();
    return tablaOrdenada.filter((r) => r.nombre.toLowerCase().includes(s));
  }, [tablaOrdenada, search]);

  // Summary de status mensual
  const statusCount = useMemo(() => {
    const c = { verde: 0, amarillo: 0, rojo: 0, nuevo: 0, perdido: 0 };
    tabla.forEach((r) => { c[r.status]++; });
    return c;
  }, [tabla]);

  // Top 20 DSs por cuota — incluye avance % vs cuota y delta vs base
  const top20 = useMemo(() => {
    return [...tabla]
      .sort((a, b) => b.cuotaMov - a.cuotaMov)
      .slice(0, 20)
      .map((r) => ({
        nombre: r.nombre,
        cuota: Math.max(Math.round(r.cuotaMov), 0),
        target: Math.max(Math.round(r.targetMov), 0),
        base: Math.max(Math.round(r.baseMov), 0),
        pctCuota: r.cuotaMov > 0 ? (r.targetMov / r.cuotaMov) * 100 : (r.targetMov > 0 ? 100 : 0),
        deltaVsBase: r.targetMov - r.baseMov,
        pctVsBase: r.baseMov > 0 ? ((r.targetMov - r.baseMov) / r.baseMov) * 100 : (r.targetMov > 0 ? 100 : 0),
        status: r.status,
      }));
  }, [tabla]);

  const maxCuotaTop = useMemo(() => Math.max(1, ...top20.map((r) => Math.max(r.cuota, r.target))), [top20]);

  if (loading) {
    return <div className="glass-card p-6 t-muted text-sm">Cargando análisis de mínimo mensual…</div>;
  }

  const labelTarget = MES_LABEL[mes];
  const labelBase = mesAnterior ? MES_LABEL[mesAnterior] : labelTarget;
  const labelHist = mesAntAnt ? MES_LABEL[mesAntAnt] : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">
          📆 Mínimo Mensual — {labelTarget} 2026
          {isFiltered ? (
            <span className="text-[11px] text-purple-300 ml-1">
              {filterMode === "single" ? `(día ${rangeFrom})` : `(días ${rangeFrom}–${rangeTo})`}
            </span>
          ) : isCurrent ? (
            <span className="text-[11px] text-green-400 ml-1">(EN CURSO)</span>
          ) : (
            <span className="text-[11px] text-gray-400 ml-1">(cerrado)</span>
          )}
        </h2>
        <p className="text-[11px] t-muted">
          {isFiltered
            ? `Comparando ${filterMode === "single" ? `el día ${rangeFrom}` : `los días ${rangeFrom}–${rangeTo}`} de ${labelTarget} con los mismos días de ${labelBase}. Las metas están escaladas a ${daysInFilter} día${daysInFilter > 1 ? "s" : ""} (${((daysInFilter / diasMes) * 100).toFixed(0)}% del mes).`
            : isCurrent
            ? `Total mensual que cada Dropshipper tiene que aportar a la meta de ${labelTarget}, basado en su share de ${labelBase}. Status proporcional al avance del mes (día ${diasTranscurridos}/${diasMes}).`
            : `Análisis retrospectivo del aporte mensual de cada DS a la meta de ${labelTarget}. Base: ${labelBase}.`}
        </p>

        {/* Filtro temporal */}
        <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-gray-700/40">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] t-muted uppercase tracking-wider">Período</label>
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as "full" | "single" | "range")}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none">
              <option value="full">Mes completo</option>
              <option value="single">Día único</option>
              <option value="range">Rango de días</option>
            </select>
          </div>
          {filterMode === "single" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] t-muted uppercase tracking-wider">Día (1–{maxDias})</label>
              <input type="number" min={1} max={maxDias} value={filterFrom}
                onChange={(e) => setFilterFrom(Math.max(1, Math.min(maxDias, parseInt(e.target.value) || 1)))}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none w-20" />
              <span className="text-[9px] t-muted">{rangeFrom} {labelBase} vs {rangeFrom} {labelTarget}</span>
            </div>
          )}
          {filterMode === "range" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] t-muted uppercase tracking-wider">Desde</label>
                <input type="number" min={1} max={maxDias} value={filterFrom}
                  onChange={(e) => setFilterFrom(Math.max(1, Math.min(maxDias, parseInt(e.target.value) || 1)))}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none w-20" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] t-muted uppercase tracking-wider">Hasta</label>
                <input type="number" min={1} max={maxDias} value={filterTo}
                  onChange={(e) => setFilterTo(Math.max(1, Math.min(maxDias, parseInt(e.target.value) || 1)))}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none w-20" />
              </div>
              <span className="text-[10px] t-muted self-end pb-1">
                {rangeFrom > rangeTo ? <span className="text-red-400">⚠️ rango inválido</span> : `${daysInFilter} días: ${rangeFrom}–${rangeTo}`}
              </span>
            </>
          )}
          {isFiltered && (
            <button type="button" onClick={() => { setFilterMode("full"); setFilterFrom(1); setFilterTo(10); }}
              className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-orange-500/40 self-end">
              ↺ Volver a mes completo
            </button>
          )}
        </div>
      </div>

      {/* KPIs mensuales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label={`Meta ${labelTarget} mov`} value={metaMov.toLocaleString("es-AR")} color="#f97316" />
        <Kpi label={`Meta ${labelTarget} ing`} value={metaIng.toLocaleString("es-AR")} color="#0891b2" />
        <Kpi label={`Real ${labelTarget} mov`} value={totals.target.mov.toLocaleString("es-AR")} color="#10b981" sub={metaMov > 0 ? `${((totals.target.mov / metaMov) * 100).toFixed(0)}% de meta` : ""} />
        <Kpi label={`Brecha mensual mov`} value={movGap.toLocaleString("es-AR")} color="#dc2626" />
        <Kpi label={`Brecha mensual ing`} value={ingGap.toLocaleString("es-AR")} color="#dc2626" />
        <Kpi label={`DSs activos ${labelTarget}`} value={activos.target.toLocaleString("es-AR")} color="#a78bfa" sub={`vs ${activos.base} en ${labelBase}`} />
      </div>

      {/* Avance proporcional + comparativa con mes base */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">📊 Promedio mensual por DS — {labelTarget}</h3>
          <p className="text-[11px] t-muted mb-3">Con {Math.max(activos.base, 1)} DSs activos (base de {labelBase}).</p>
          <Row label="Movilizadas / DS / mes (meta)" value={metaMov / Math.max(activos.base, 1)} color="#10b981" />
          <Row label="Ingresadas / DS / mes (meta)" value={metaIng / Math.max(activos.base, 1)} color="#0891b2" />
          <Row label="Movilizadas / DS / mes (real)" value={totals.target.mov / Math.max(activos.target, 1)} color="#f59e0b" />
          <Row label="Ingresadas / DS / mes (real)" value={totals.target.ing / Math.max(activos.target, 1)} color="#f59e0b" />
        </div>
        <div className="rounded-xl p-4 border border-orange-500/30" style={{ background: "rgba(249,115,22,0.05)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">🎯 Crecimiento promedio requerido</h3>
          <p className="text-[11px] t-muted mb-3">¿Cuánto más por DS vs lo que hicieron en {labelBase}?</p>
          {(() => {
            const baseMovPorDs = activos.base > 0 ? totals.base.mov / activos.base : 0;
            const baseIngPorDs = activos.base > 0 ? totals.base.ing / activos.base : 0;
            const metaMovPorDs = activos.base > 0 ? metaMov / activos.base : 0;
            const metaIngPorDs = activos.base > 0 ? metaIng / activos.base : 0;
            const growthMov = baseMovPorDs > 0 ? ((metaMovPorDs - baseMovPorDs) / baseMovPorDs) * 100 : 0;
            const growthIng = baseIngPorDs > 0 ? ((metaIngPorDs - baseIngPorDs) / baseIngPorDs) * 100 : 0;
            return (
              <>
                <div className="space-y-1 text-xs">
                  <p className="t-secondary">Real {labelBase}: <strong>{baseMovPorDs.toFixed(0)}</strong> mov · <strong>{baseIngPorDs.toFixed(0)}</strong> ing por DS/mes</p>
                  <p className="t-secondary">Necesario {labelTarget}: <strong style={{ color: "#10b981" }}>{metaMovPorDs.toFixed(0)}</strong> mov · <strong style={{ color: "#0891b2" }}>{metaIngPorDs.toFixed(0)}</strong> ing por DS/mes</p>
                </div>
                <div className="mt-3 flex gap-3">
                  <div className="rounded-lg p-2 border border-gray-700 flex-1" style={{ background: "var(--bg-input)" }}>
                    <p className="text-[10px] t-muted">Crecimiento mov</p>
                    <p className="text-xl font-bold" style={{ color: growthMov > 0 ? "#dc2626" : "#10b981" }}>{growthMov > 0 ? "+" : ""}{growthMov.toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg p-2 border border-gray-700 flex-1" style={{ background: "var(--bg-input)" }}>
                    <p className="text-[10px] t-muted">Crecimiento ing</p>
                    <p className="text-xl font-bold" style={{ color: growthIng > 0 ? "#dc2626" : "#10b981" }}>{growthIng > 0 ? "+" : ""}{growthIng.toFixed(0)}%</p>
                  </div>
                </div>
                <p className="text-[10px] t-muted mt-2">
                  {growthMov > 50 ? "🚨 Crecimiento muy agresivo — considera activar más DSs" :
                   growthMov > 20 ? "⚠️ Crecimiento fuerte por DS" :
                   growthMov > 0 ? "✓ Crecimiento alcanzable" : "✅ Por debajo del ritmo base"}
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Status mensual semáforo */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h3 className="text-sm font-bold t-primary mb-2">🚦 Cumplimiento mensual por DS</h3>
        <p className="text-[11px] t-muted mb-3">
          Verde: cumpliendo cuota (≥100%) · Amarillo: 75-99% · Rojo: &lt;75% · Nuevo / Perdido.
          {isCurrent && ` Como el mes está en curso, la cuota se compara proporcional al día ${diasTranscurridos}/${diasMes}.`}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatusCard label="🔴 Rojo (<75%)" count={statusCount.rojo} color="#dc2626" />
          <StatusCard label="⚫ Perdidos" count={statusCount.perdido} color="#6b7280" />
          <StatusCard label="🟡 Amarillo" count={statusCount.amarillo} color="#f59e0b" />
          <StatusCard label="🟢 Verde (≥100%)" count={statusCount.verde} color="#10b981" />
          <StatusCard label="✨ Nuevos" count={statusCount.nuevo} color="#0891b2" />
        </div>
      </div>

      {/* Top 20 — Avance de cuota */}
      <div className="rounded-xl p-5 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold t-primary">📊 Top 20 DSs — Avance de cuota {labelTarget}</h3>
          <div className="flex items-center gap-3 text-[10px] t-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "#10b981" }} /> ≥ 100%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "#f59e0b" }} /> 75–99%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: "#dc2626" }} /> &lt; 75%</span>
          </div>
        </div>
        <p className="text-[11px] t-muted mb-4">% de cumplimiento de la cuota mensual y crecimiento vs {labelBase}.</p>
        <div className="space-y-2.5">
          {top20.map((r, i) => {
            const pct = r.pctCuota;
            const fillColor = pct >= 100 ? "#10b981" : pct >= 75 ? "#f59e0b" : "#dc2626";
            const widthPct = Math.min((r.target / maxCuotaTop) * 100, 100);
            const cuotaPct = Math.min((r.cuota / maxCuotaTop) * 100, 100);
            const pctVsBaseColor = r.pctVsBase > 0 ? "#10b981" : r.pctVsBase < 0 ? "#dc2626" : "#6b7280";
            return (
              <div key={r.nombre} className="grid grid-cols-12 gap-3 items-center text-xs">
                {/* Rank + nombre */}
                <div className="col-span-12 sm:col-span-4 flex items-baseline gap-2 min-w-0">
                  <span className="t-muted text-[10px] font-mono tabular-nums w-6 text-right">{i + 1}.</span>
                  <span className="t-primary truncate font-medium" title={r.nombre}>{r.nombre}</span>
                </div>
                {/* Barra + marker de cuota */}
                <div className="col-span-8 sm:col-span-5 relative h-6 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  {/* Marker de la cuota */}
                  <div className="absolute top-0 bottom-0 w-px"
                    style={{ left: `${cuotaPct}%`, background: "rgba(255,255,255,0.35)" }} />
                  <div className="absolute -top-0.5 text-[8px] t-muted whitespace-nowrap"
                    style={{ left: `${cuotaPct}%`, transform: "translateX(-50%)" }}>▼</div>
                  {/* Fill real */}
                  <div className="h-full rounded-md transition-all"
                    style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${fillColor}cc, ${fillColor})` }} />
                  {/* Cifras dentro de la barra */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                    <span className="text-[10px] font-bold text-white drop-shadow">{r.target.toLocaleString("es-AR")}</span>
                    <span className="text-[10px] t-muted font-mono">/ {r.cuota.toLocaleString("es-AR")}</span>
                  </div>
                </div>
                {/* % cuota + delta vs base */}
                <div className="col-span-4 sm:col-span-3 flex items-baseline justify-end gap-2">
                  <span className="text-sm font-bold tabular-nums" style={{ color: fillColor }}>{pct.toFixed(0)}%</span>
                  <span className="text-[10px] tabular-nums" style={{ color: pctVsBaseColor }}>
                    {r.pctVsBase > 0 ? "↑" : r.pctVsBase < 0 ? "↓" : "→"}{Math.abs(r.pctVsBase).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] t-muted mt-4">
          La barra muestra lo movilizado en {labelTarget}. El marcador <span className="t-secondary">▼</span> indica la cuota mensual del DS.
          El segundo número (gris pequeño a la derecha) es la flecha de cambio vs {labelBase}.
        </p>
      </div>

      {/* Tabla por DS */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-bold t-primary">
            📋 Cuota mensual por Dropshipper ({tabla.length})
            {isFiltered && <span className="text-[10px] text-purple-300 ml-1">{filterMode === "single" ? `· día ${rangeFrom}` : `· días ${rangeFrom}–${rangeTo}`}</span>}
          </h3>
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none">
              <option value="share">Por share (volumen)</option>
              <option value="gap">Por gap (más atrasados)</option>
              <option value="growth">Por crecimiento requerido</option>
            </select>
            <input type="text" placeholder="🔍 Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="text-xs px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none w-40" />
          </div>
        </div>

        {/* Filtro temporal (igual al de arriba, accesible desde el card) */}
        <div className="flex flex-wrap items-end gap-3 mb-3 p-3 rounded-lg" style={{ background: "var(--bg-input)" }}>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] t-muted uppercase tracking-wider">Período de comparación</label>
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as "full" | "single" | "range")}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none">
              <option value="full">Mes completo</option>
              <option value="single">Día único</option>
              <option value="range">Rango de días</option>
            </select>
          </div>
          {filterMode === "single" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] t-muted uppercase tracking-wider">Día</label>
              <input type="number" min={1} max={maxDias} value={filterFrom}
                onChange={(e) => setFilterFrom(Math.max(1, Math.min(maxDias, parseInt(e.target.value) || 1)))}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none w-20" />
              <span className="text-[9px] t-muted">{rangeFrom} {labelBase} vs {rangeFrom} {labelTarget}</span>
            </div>
          )}
          {filterMode === "range" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] t-muted uppercase tracking-wider">Desde</label>
                <input type="number" min={1} max={maxDias} value={filterFrom}
                  onChange={(e) => setFilterFrom(Math.max(1, Math.min(maxDias, parseInt(e.target.value) || 1)))}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none w-20" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] t-muted uppercase tracking-wider">Hasta</label>
                <input type="number" min={1} max={maxDias} value={filterTo}
                  onChange={(e) => setFilterTo(Math.max(1, Math.min(maxDias, parseInt(e.target.value) || 1)))}
                  className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none w-20" />
              </div>
              <span className="text-[10px] t-muted self-end pb-1">
                {rangeFrom > rangeTo ? <span className="text-red-400">⚠️ rango inválido</span> : `${daysInFilter} días: ${rangeFrom}–${rangeTo} de ${labelBase} vs ${rangeFrom}–${rangeTo} de ${labelTarget}`}
              </span>
            </>
          )}
          {isFiltered && (
            <button type="button" onClick={() => { setFilterMode("full"); setFilterFrom(1); setFilterTo(10); }}
              className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-orange-500/40 self-end">
              ↺ Reset
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700 text-[10px] t-muted">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Dropshipper</th>
                <th className="text-center py-2 px-2">Status</th>
                <th className="text-right py-2 px-2">{labelBase} ing</th>
                <th className="text-right py-2 px-2">{labelTarget} ing</th>
                <th className="text-right py-2 px-2">Δ ing</th>
                <th className="text-right py-2 px-2">% ing</th>
                <th className="text-right py-2 px-2">{labelBase} mov</th>
                <th className="text-right py-2 px-2">{labelTarget} mov</th>
                <th className="text-right py-2 px-2">Δ mov</th>
                <th className="text-right py-2 px-2">% mov</th>
                <th className="text-right py-2 px-2 text-orange-300">Cuota mov</th>
                <th className="text-right py-2 px-2 text-cyan-300">Cuota ing</th>
                <th className="text-right py-2 px-2">Share</th>
                <th className="text-right py-2 px-2">Crec. req</th>
                <th className="text-right py-2 px-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? tablaFiltrada : tablaFiltrada.slice(0, 50)).map((r, i) => {
                const colors: Record<string, string> = { verde: "#10b981", amarillo: "#f59e0b", rojo: "#dc2626", nuevo: "#0891b2", perdido: "#6b7280" };
                const lbl: Record<string, string> = { verde: "🟢", amarillo: "🟡", rojo: "🔴", nuevo: "✨", perdido: "⚫" };
                return (
                  <tr key={r.nombre} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                    <td className="py-2 px-2 t-muted text-[10px]">{i + 1}</td>
                    <td className="py-2 px-2 t-primary max-w-[200px] truncate" title={r.nombre}>{r.nombre}</td>
                    <td className="py-2 px-2 text-center"><span style={{ color: colors[r.status] }}>{lbl[r.status]}</span></td>
                    <td className="py-2 px-2 text-right font-mono t-muted">{r.baseIng.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono text-cyan-300">{r.targetIng.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: r.deltaIng > 0 ? "#10b981" : r.deltaIng < 0 ? "#dc2626" : "#6b7280" }}>
                      {(r.baseIng > 0 || r.targetIng > 0) ? (r.deltaIng > 0 ? "+" : "") + r.deltaIng.toLocaleString("es-AR") : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[10px]" style={{ color: r.pctIng > 0 ? "#10b981" : r.pctIng < 0 ? "#dc2626" : "#6b7280" }}>
                      {(r.baseIng > 0 || r.targetIng > 0) ? (r.pctIng > 0 ? "+" : "") + r.pctIng.toFixed(0) + "%" : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono t-muted">{r.baseMov.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono text-orange-400">{r.targetMov.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: r.deltaMov > 0 ? "#10b981" : r.deltaMov < 0 ? "#dc2626" : "#6b7280" }}>
                      {(r.baseMov > 0 || r.targetMov > 0) ? (r.deltaMov > 0 ? "+" : "") + r.deltaMov.toLocaleString("es-AR") : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[10px]" style={{ color: r.pctMov > 0 ? "#10b981" : r.pctMov < 0 ? "#dc2626" : "#6b7280" }}>
                      {(r.baseMov > 0 || r.targetMov > 0) ? (r.pctMov > 0 ? "+" : "") + r.pctMov.toFixed(0) + "%" : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-orange-300">{Math.round(r.cuotaMov).toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-cyan-300">{Math.round(r.cuotaIng).toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono">{r.share.toFixed(1)}%</td>
                    <td className="py-2 px-2 text-right font-mono" style={{ color: r.growthReq > 50 ? "#dc2626" : r.growthReq > 20 ? "#f59e0b" : "#10b981" }}>
                      {r.growthReq > 0 ? "+" : ""}{r.growthReq.toFixed(0)}%
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: r.gap > 0 ? "#dc2626" : "#10b981" }}>
                      {r.gap > 0 ? "+" : ""}{Math.round(r.gap).toLocaleString("es-AR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tablaFiltrada.length > 50 && !showAll && (
            <button onClick={() => setShowAll(true)} className="mt-3 text-[11px] text-orange-400 hover:underline">
              Ver todos los {tablaFiltrada.length.toLocaleString("es-AR")} DSs
            </button>
          )}
        </div>
        <p className="text-[10px] t-muted mt-3">
          <strong>{labelBase} ing/mov</strong> y <strong>{labelTarget} ing/mov</strong> son los acumulados de cada mes en el período seleccionado (o mes completo si no hay filtro).
          <strong> Δ y %</strong> = diferencia y crecimiento de {labelTarget} vs {labelBase} para el mismo rango.
          <strong> Cuota mensual</strong> = share del DS en {labelBase} aplicado a la meta de {labelTarget} (escalada al período).
          <strong> Gap</strong> = cuánto le falta para llegar a su cuota.
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

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs py-1">
      <span className="t-secondary">{label}</span>
      <span className="font-bold font-mono" style={{ color }}>{Math.round(value).toLocaleString("es-AR")}</span>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg p-2 border" style={{ background: "var(--bg-input)", borderColor: color + "40" }}>
      <p className="text-[10px] t-muted">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{count}</p>
    </div>
  );
}
