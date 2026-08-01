"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const NO_MOV = new Set([
  "PENDIENTE","PENDIENTE CONFIRMACION","GUIA_GENERADA","PREPARADO PARA TRANSPORTADORA",
  "CANCELADO","RECHAZADO","GUIA ANULADA","CANCELADO POR TRANSPORTADORA",
]);

type Mes = "abril" | "mayo" | "junio" | "julio" | "agosto";
type ByDS = { nombre: string; total: number; estados: Record<string, number> };
type ByDSDaily = { ds: string; fecha: string; ordenes: number };
type ByDate = { fecha: string; total: number; estados: Record<string, number> };

const MES_LABEL: Record<Mes, string> = { abril: "Abril", mayo: "Mayo", junio: "Junio", julio: "Julio", agosto: "Agosto" };
const MES_DIAS: Record<Mes, number> = { abril: 30, mayo: 31, junio: 30, julio: 31, agosto: 31 };
const MES_MONTH_NUM: Record<Mes, number> = { abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8 };

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

// Genera semanas del mes (S1 corta inicial + 7 días después)
function buildWeeks(totalDays: number): { label: string; num: number; start: number; end: number; dias: number }[] {
  const out: { label: string; num: number; start: number; end: number; dias: number }[] = [];
  let start = 1;
  let n = 1;
  while (start <= totalDays) {
    const target = n === 1 ? 6 : 7;
    const end = Math.min(start + target - 1, totalDays);
    out.push({ label: `S${n} (${start}–${end})`, num: n, start, end, dias: end - start + 1 });
    start = end + 1;
    n++;
  }
  return out;
}

// Agrega by_ds_daily filtrando por rango y aplicando ratio mov/ing mensual
function aggregateRange(
  daily: ByDSDaily[],
  monthly: Map<string, { ing: number; mov: number; nombre: string }>,
  from: number,
  to: number,
): Map<string, { ing: number; mov: number; nombre: string }> {
  const map = new Map<string, { ing: number; mov: number; nombre: string }>();
  for (const r of daily) {
    const d = dayOfMonth(r.fecha);
    if (d === null || d < from || d > to) continue;
    const clean = String(r.ds).replace(/\s*\(\d+\)\s*$/, "").trim();
    const cur = map.get(clean) || { ing: 0, mov: 0, nombre: r.ds };
    cur.ing += r.ordenes || 0;
    map.set(clean, cur);
  }
  map.forEach((v, k) => {
    const m = monthly.get(k);
    const ratio = m && m.ing > 0 ? m.mov / m.ing : 0;
    v.mov = Math.round(v.ing * ratio);
  });
  return map;
}

export default function MinimoSemanal({ country, mes }: { country: "ar" | "py"; mes: Mes }) {
  const mesAnterior: Mes | null = mes === "agosto" ? "julio" : mes === "julio" ? "junio" : mes === "junio" ? "mayo" : mes === "mayo" ? "abril" : null;

  const [opsTarget, setOpsTarget] = useState<ByDS[]>([]);
  const [opsBase, setOpsBase] = useState<ByDS[]>([]);
  const [dailyTarget, setDailyTarget] = useState<ByDSDaily[]>([]);
  const [dailyBase, setDailyBase] = useState<ByDSDaily[]>([]);
  const [byDateTarget, setByDateTarget] = useState<ByDate[]>([]);
  const [byDateBase, setByDateBase] = useState<ByDate[]>([]);
  const [metaInfo, setMetaInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const meses: Mes[] = ["abril", "mayo", "junio", "julio", "agosto"];
      const results = await Promise.all(
        meses.map((m) => fetch(`/api/data/operational?country=${country}&mes=${m}`).then(r => r.json()).catch(() => null))
      );
      const dash = await fetch(`/api/data/${country}`).then(r => r.json()).catch(() => null);
      const idxT = meses.indexOf(mes);
      const idxB = mesAnterior ? meses.indexOf(mesAnterior) : -1;
      setOpsTarget(Array.isArray(results[idxT]?.data?.by_dropshipper) ? results[idxT].data.by_dropshipper : []);
      setDailyTarget(Array.isArray(results[idxT]?.data?.by_ds_daily) ? results[idxT].data.by_ds_daily : []);
      setByDateTarget(Array.isArray(results[idxT]?.data?.by_date) ? results[idxT].data.by_date : []);
      if (idxB >= 0) {
        setOpsBase(Array.isArray(results[idxB]?.data?.by_dropshipper) ? results[idxB].data.by_dropshipper : []);
        setDailyBase(Array.isArray(results[idxB]?.data?.by_ds_daily) ? results[idxB].data.by_ds_daily : []);
        setByDateBase(Array.isArray(results[idxB]?.data?.by_date) ? results[idxB].data.by_date : []);
      } else {
        setOpsBase([]); setDailyBase([]); setByDateBase([]);
      }
      setMetaInfo(dash?.meta_info || {});
    } finally {
      setLoading(false);
    }
  }, [country, mes, mesAnterior]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const diasMes = (metaInfo[`dias_${mes}`] as number) ?? MES_DIAS[mes];
  const weeks = useMemo(() => buildWeeks(diasMes), [diasMes]);

  // Detectar semana actual (si el mes está en curso)
  const today = new Date();
  const monthInCourse = today.getFullYear() === 2026 && (today.getMonth() + 1) === MES_MONTH_NUM[mes];
  const diaActual = monthInCourse ? today.getDate() : 0;
  const currentWeekNum = useMemo(() => {
    if (!monthInCourse) return weeks.length;
    const wk = weeks.find((w) => diaActual >= w.start && diaActual <= w.end);
    return wk ? wk.num : 1;
  }, [monthInCourse, diaActual, weeks]);

  // Defaultear a semana actual
  useEffect(() => {
    if (selectedWeek === null && weeks.length > 0) setSelectedWeek(currentWeekNum);
  }, [selectedWeek, weeks.length, currentWeekNum]);

  const activeWeek = weeks.find((w) => w.num === selectedWeek) || weeks[0];

  // Totales mensuales y ratios para estimar mov por DS
  const dsTargetFull = useMemo(() => aggregateDS(opsTarget), [opsTarget]);
  const dsBaseFull = useMemo(() => aggregateDS(opsBase), [opsBase]);

  const totalsBase = useMemo(() => {
    let ing = 0, mov = 0;
    dsBaseFull.forEach((v) => { ing += v.ing; mov += v.mov; });
    return { ing, mov, pctMov: ing > 0 ? mov / ing : 0 };
  }, [dsBaseFull]);

  // Meta mensual completa
  const metaMovMonth = metaInfo[`meta_movilizadas_${mes}`] ?? metaInfo[`meta_movilizadas_${mesAnterior ?? mes}`] ?? 0;
  const metaIngMonth = metaInfo[`meta_ingresadas_${mes}`]
    ?? (totalsBase.pctMov > 0 ? Math.round(metaMovMonth / totalsBase.pctMov) : metaInfo[`meta_ingresadas_${mesAnterior ?? mes}`] ?? 0);

  // Meta semanal proporcional
  const metaMovWeek = activeWeek ? Math.round(metaMovMonth * (activeWeek.dias / diasMes)) : 0;
  const metaIngWeek = activeWeek ? Math.round(metaIngMonth * (activeWeek.dias / diasMes)) : 0;

  // Real de la semana (filtrado al rango)
  const dsTargetWeek = useMemo(() => activeWeek ? aggregateRange(dailyTarget, dsTargetFull, activeWeek.start, activeWeek.end) : new Map(),
    [activeWeek, dailyTarget, dsTargetFull]);
  const dsBaseWeek = useMemo(() => activeWeek ? aggregateRange(dailyBase, dsBaseFull, activeWeek.start, activeWeek.end) : new Map(),
    [activeWeek, dailyBase, dsBaseFull]);

  // Real ingresadas / movilizadas de la semana
  const realIngWeek = useMemo(() => {
    let sum = 0;
    if (activeWeek) for (const r of dailyTarget) {
      const d = dayOfMonth(r.fecha);
      if (d !== null && d >= activeWeek.start && d <= activeWeek.end) sum += r.ordenes || 0;
    }
    return sum;
  }, [activeWeek, dailyTarget]);

  const realMovWeek = useMemo(() => {
    let sum = 0;
    if (activeWeek) for (const r of byDateTarget) {
      const d = dayOfMonth(r.fecha);
      if (d !== null && d >= activeWeek.start && d <= activeWeek.end) {
        sum += movFromEstados(r.estados || {});
      }
    }
    return sum;
  }, [activeWeek, byDateTarget]);

  // Cuántos días ya pasaron de la semana activa
  const diasTranscurridosWeek = activeWeek
    ? (!monthInCourse || diaActual > activeWeek.end ? activeWeek.dias : Math.max(0, diaActual - activeWeek.start + 1))
    : 0;
  const diasRestantesWeek = activeWeek ? Math.max(activeWeek.dias - diasTranscurridosWeek, 0) : 0;

  // Brecha pendiente
  const movPendiente = Math.max(metaMovWeek - realMovWeek, 0);
  const ingPendienteRaw = Math.max(metaIngWeek - realIngWeek, 0);
  const ingPendienteFromMov = totalsBase.pctMov > 0 ? movPendiente / totalsBase.pctMov : ingPendienteRaw;
  const ingPendiente = Math.max(ingPendienteRaw, ingPendienteFromMov);

  // DSs activos
  const activosWeek = Array.from(dsTargetWeek.values() as Iterable<{ ing: number }>).filter((v) => v.ing > 0).length;
  const activosBaseWeek = Array.from(dsBaseWeek.values() as Iterable<{ ing: number }>).filter((v) => v.ing > 0).length;

  // Tabla por DS
  const tabla = useMemo(() => {
    let totalMovBase = 0;
    dsBaseWeek.forEach((v) => { totalMovBase += (v as any).mov; });
    const allKeys = new Set<string>([...(dsBaseWeek as any).keys(), ...(dsTargetWeek as any).keys()]);
    const rows: any[] = [];
    allKeys.forEach((nombre) => {
      const b = (dsBaseWeek as any).get(nombre) || { ing: 0, mov: 0, nombre };
      const t = (dsTargetWeek as any).get(nombre) || { ing: 0, mov: 0, nombre };
      const share = totalMovBase > 0 ? b.mov / totalMovBase : 1 / Math.max(allKeys.size, 1);
      const cuotaMov = metaMovWeek * share;
      const cuotaIng = totalsBase.pctMov > 0 ? cuotaMov / totalsBase.pctMov : 0;
      const cumplimiento = cuotaMov > 0 ? (t.mov / cuotaMov) * 100 : (t.mov > 0 ? 200 : 100);
      const deltaIng = t.ing - b.ing;
      const deltaMov = t.mov - b.mov;
      const pctIng = b.ing > 0 ? (deltaIng / b.ing) * 100 : (t.ing > 0 ? 100 : 0);
      const pctMov = b.mov > 0 ? (deltaMov / b.mov) * 100 : (t.mov > 0 ? 100 : 0);

      let status: "verde" | "amarillo" | "rojo" | "nuevo" | "perdido";
      if (b.mov === 0 && t.mov > 0) status = "nuevo";
      else if (b.mov > 0 && t.mov === 0) status = "perdido";
      else if (cumplimiento >= 100) status = "verde";
      else if (cumplimiento >= 75) status = "amarillo";
      else status = "rojo";

      rows.push({
        nombre,
        baseIng: b.ing, baseMov: b.mov,
        targetIng: t.ing, targetMov: t.mov,
        cuotaMov: Math.max(cuotaMov, 0), cuotaIng: Math.max(cuotaIng, 0),
        gap: cuotaMov - t.mov,
        share: share * 100,
        deltaIng, deltaMov, pctIng, pctMov,
        status,
      });
    });
    rows.sort((a, b) => b.cuotaMov - a.cuotaMov);
    return rows;
  }, [dsBaseWeek, dsTargetWeek, metaMovWeek, totalsBase.pctMov]);

  const tablaFiltrada = useMemo(() => {
    if (!search.trim()) return tabla;
    const s = search.toLowerCase();
    return tabla.filter((r) => r.nombre.toLowerCase().includes(s));
  }, [tabla, search]);

  const statusCount = useMemo(() => {
    const c = { verde: 0, amarillo: 0, rojo: 0, nuevo: 0, perdido: 0 };
    tabla.forEach((r) => { c[r.status as "verde" | "amarillo" | "rojo" | "nuevo" | "perdido"]++; });
    return c;
  }, [tabla]);

  if (loading) {
    return <div className="glass-card p-6 t-muted text-sm">Cargando análisis semanal…</div>;
  }

  const labelTarget = MES_LABEL[mes];
  const labelBase = mesAnterior ? MES_LABEL[mesAnterior] : labelTarget;
  const isCurrentWeek = monthInCourse && activeWeek?.num === currentWeekNum;

  return (
    <div className="space-y-4">
      {/* Header + week selector */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">
          📆 Mínimo Semanal — {labelTarget} 2026
          {activeWeek && <span className="text-[11px] text-purple-300 ml-1">· {activeWeek.label}</span>}
          {isCurrentWeek && <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded ml-2">EN CURSO</span>}
        </h2>
        <p className="text-[11px] t-muted mb-3">
          Análisis semanal del cumplimiento de meta. Comparativa contra la misma semana de {labelBase}.
          {activeWeek && ` Días ${activeWeek.start}–${activeWeek.end} (${activeWeek.dias} días).`}
        </p>
        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-700/40">
          {weeks.map((w) => {
            const isSelected = w.num === selectedWeek;
            const isCurrent = monthInCourse && w.num === currentWeekNum;
            return (
              <button key={w.num} type="button" onClick={() => setSelectedWeek(w.num)}
                className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${
                  isSelected
                    ? "bg-purple-500 text-white border-purple-500 shadow shadow-purple-500/20"
                    : "bg-transparent t-secondary border-gray-700 hover:border-purple-500/40"
                }`}>
                {w.label}
                {isCurrent && !isSelected && <span className="ml-1 text-[9px] text-green-300">●</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Meta semana — mov" value={metaMovWeek.toLocaleString("es-AR")} color="#f97316" sub={`${activeWeek?.dias} días`} />
        <Kpi label="Meta semana — ing" value={metaIngWeek.toLocaleString("es-AR")} color="#0891b2" sub={`${activeWeek?.dias} días`} />
        <Kpi label="Real mov" value={realMovWeek.toLocaleString("es-AR")} color="#10b981" sub={`${metaMovWeek > 0 ? ((realMovWeek / metaMovWeek) * 100).toFixed(0) : 0}% de meta`} />
        <Kpi label="Real ing" value={realIngWeek.toLocaleString("es-AR")} color="#10b981" sub={`${metaIngWeek > 0 ? ((realIngWeek / metaIngWeek) * 100).toFixed(0) : 0}% de meta`} />
        <Kpi label="Brecha mov" value={movPendiente.toLocaleString("es-AR")} color="#dc2626" sub={isCurrentWeek ? `${diasRestantesWeek} días restantes` : "—"} />
        <Kpi label="Brecha ing" value={ingPendiente.toLocaleString("es-AR")} color="#dc2626" sub={isCurrentWeek ? `${diasRestantesWeek} días restantes` : "—"} />
      </div>

      {/* Progress + análisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ProgressCard label="Movilizadas — real vs meta semanal" actual={realMovWeek} target={metaMovWeek} color="#10b981" />
        <ProgressCard label="Ingresadas — real vs meta semanal" actual={realIngWeek} target={metaIngWeek} color="#0891b2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">📊 Promedio diario necesario</h3>
          <p className="text-[11px] t-muted mb-3">
            {isCurrentWeek
              ? `Para los ${diasRestantesWeek} días restantes de la semana.`
              : `Para los ${activeWeek?.dias} días de la semana.`}
          </p>
          {(() => {
            const divisor = isCurrentWeek ? Math.max(diasRestantesWeek, 1) : (activeWeek?.dias || 7);
            const necMov = isCurrentWeek ? movPendiente / divisor : metaMovWeek / divisor;
            const necIng = isCurrentWeek ? ingPendiente / divisor : metaIngWeek / divisor;
            const necMovPerDs = activosWeek > 0 ? necMov / activosWeek : 0;
            const necIngPerDs = activosWeek > 0 ? necIng / activosWeek : 0;
            return (
              <>
                <Row label="Movilizadas / día (país)" value={necMov} color="#10b981" />
                <Row label="Ingresadas / día (país)" value={necIng} color="#0891b2" />
                <Row label={`Mov / DS activo (${activosWeek}) / día`} value={necMovPerDs} color="#f59e0b" />
                <Row label={`Ing / DS activo (${activosWeek}) / día`} value={necIngPerDs} color="#f59e0b" />
              </>
            );
          })()}
        </div>
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">🚦 Cumplimiento por DS</h3>
          <p className="text-[11px] t-muted mb-3">Semáforo: verde ≥100%, amarillo 75-99%, rojo &lt;75% de su cuota semanal.</p>
          <div className="grid grid-cols-5 gap-2">
            <StatusCard label="🔴" count={statusCount.rojo} color="#dc2626" />
            <StatusCard label="⚫" count={statusCount.perdido} color="#6b7280" />
            <StatusCard label="🟡" count={statusCount.amarillo} color="#f59e0b" />
            <StatusCard label="🟢" count={statusCount.verde} color="#10b981" />
            <StatusCard label="✨" count={statusCount.nuevo} color="#0891b2" />
          </div>
          <p className="text-[10px] t-muted mt-3">
            <strong>{activosWeek}</strong> DSs activos en {labelTarget} vs <strong>{activosBaseWeek}</strong> en {labelBase} (misma semana).
          </p>
        </div>
      </div>

      {/* Tabla por DS */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold t-primary">📋 Cuota semanal por Dropshipper ({tabla.length}) · {activeWeek?.label}</h3>
          <input type="text" placeholder="🔍 Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none w-40" />
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
                <th className="text-right py-2 px-2">Δ / %</th>
                <th className="text-right py-2 px-2">{labelBase} mov</th>
                <th className="text-right py-2 px-2">{labelTarget} mov</th>
                <th className="text-right py-2 px-2">Δ / %</th>
                <th className="text-right py-2 px-2 text-orange-300">Cuota mov</th>
                <th className="text-right py-2 px-2 text-cyan-300">Cuota ing</th>
                <th className="text-right py-2 px-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? tablaFiltrada : tablaFiltrada.slice(0, 50)).map((r: any, i: number) => {
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
                      {(r.baseIng > 0 || r.targetIng > 0) ? `${r.deltaIng > 0 ? "+" : ""}${r.deltaIng.toLocaleString("es-AR")} (${r.pctIng > 0 ? "+" : ""}${r.pctIng.toFixed(0)}%)` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono t-muted">{r.baseMov.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono text-orange-400">{r.targetMov.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: r.deltaMov > 0 ? "#10b981" : r.deltaMov < 0 ? "#dc2626" : "#6b7280" }}>
                      {(r.baseMov > 0 || r.targetMov > 0) ? `${r.deltaMov > 0 ? "+" : ""}${r.deltaMov.toLocaleString("es-AR")} (${r.pctMov > 0 ? "+" : ""}${r.pctMov.toFixed(0)}%)` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-orange-300">{Math.round(r.cuotaMov).toLocaleString("es-AR")}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-cyan-300">{Math.round(r.cuotaIng).toLocaleString("es-AR")}</td>
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
          Mov por DS por día se estima aplicando el ratio mov/ing mensual del DS a su ingresadas de la semana.
          Cuota semanal = share del DS en {labelBase} × meta semanal de {labelTarget}.
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

function Row({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs py-1">
      <span className="t-secondary">{label}</span>
      <span className="font-bold font-mono" style={{ color }}>{value.toFixed(0)}</span>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg p-2 border text-center" style={{ background: "var(--bg-input)", borderColor: color + "40" }}>
      <p className="text-[14px]">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{count}</p>
    </div>
  );
}
