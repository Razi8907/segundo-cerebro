"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Estados que se consideran NO movilizadas (alineado con el resto del dashboard)
const NO_MOV = new Set([
  "PENDIENTE","PENDIENTE CONFIRMACION","GUIA_GENERADA","PREPARADO PARA TRANSPORTADORA",
  "CANCELADO","RECHAZADO","GUIA ANULADA","CANCELADO POR TRANSPORTADORA",
]);

type ByDS = { nombre: string; total: number; estados: Record<string, number> };
type ByDSDaily = { ds: string; fecha: string; ordenes: number };

interface MetaInfoLike {
  meta_movilizadas_junio?: number;
  meta_ingresadas_junio?: number;
  meta_movilizadas_mayo?: number;
  meta_ingresadas_mayo?: number;
  meta_movilizadas_abril?: number;
  meta_ingresadas_abril?: number;
  dias_junio?: number;
  dias_mayo?: number;
  [k: string]: any;
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

// Días en los que un DS estuvo "activo" (con al menos 1 orden ingresada)
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

export default function MinimoDiario({ country }: { country: "ar" | "py" }) {
  const [opsMayo, setOpsMayo] = useState<ByDS[]>([]);
  const [opsJunio, setOpsJunio] = useState<ByDS[]>([]);
  const [dailyMayo, setDailyMayo] = useState<ByDSDaily[]>([]);
  const [dailyJunio, setDailyJunio] = useState<ByDSDaily[]>([]);
  const [metaInfo, setMetaInfo] = useState<MetaInfoLike>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [opMay, opJun, dash] = await Promise.all([
        fetch(`/api/data/operational?country=${country}&mes=mayo`).then(r => r.json()).catch(() => null),
        fetch(`/api/data/operational?country=${country}&mes=junio`).then(r => r.json()).catch(() => null),
        fetch(`/api/data/${country}`).then(r => r.json()).catch(() => null),
      ]);
      setOpsMayo(Array.isArray(opMay?.data?.by_dropshipper) ? opMay.data.by_dropshipper : []);
      setOpsJunio(Array.isArray(opJun?.data?.by_dropshipper) ? opJun.data.by_dropshipper : []);
      setDailyMayo(Array.isArray(opMay?.data?.by_ds_daily) ? opMay.data.by_ds_daily : []);
      setDailyJunio(Array.isArray(opJun?.data?.by_ds_daily) ? opJun.data.by_ds_daily : []);
      setMetaInfo(dash?.meta_info || {});
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Día actual (1..30) — hoy es en Junio 2026
  const today = new Date();
  const isInJunio = today.getFullYear() === 2026 && today.getMonth() === 5;
  const diaActualJunio = isInJunio ? today.getDate() : 30;
  const diasJunio = metaInfo.dias_junio ?? 30;
  const diasTranscurridos = Math.max(1, Math.min(diaActualJunio, diasJunio));
  const diasRestantes = Math.max(1, diasJunio - diasTranscurridos);

  // % movilización país (basado en Mayo cerrado)
  const totalsMayo = useMemo(() => {
    const m = aggregateDS(opsMayo);
    let ing = 0, mov = 0;
    m.forEach((v) => { ing += v.ing; mov += v.mov; });
    return { ing, mov, pctMov: ing > 0 ? mov / ing : 0 };
  }, [opsMayo]);

  // DSs activos en Mayo (con ≥1 ingresada en el mes)
  const dsMayo = useMemo(() => aggregateDS(opsMayo), [opsMayo]);
  const dsJunio = useMemo(() => aggregateDS(opsJunio), [opsJunio]);
  const activeDaysMayo = useMemo(() => activeDaysByDS(dailyMayo), [dailyMayo]);
  const activeDaysJunio = useMemo(() => activeDaysByDS(dailyJunio), [dailyJunio]);

  const activosMayo = Array.from(dsMayo.values()).filter(v => v.ing > 0).length;
  const activosJunio = Array.from(dsJunio.values()).filter(v => v.ing > 0).length;

  // Metas Junio (con fallback)
  const metaMovJunio = metaInfo.meta_movilizadas_junio ?? metaInfo.meta_movilizadas_mayo ?? 0;
  const metaIngJunio = metaInfo.meta_ingresadas_junio
    ?? (totalsMayo.pctMov > 0 ? Math.round(metaMovJunio / totalsMayo.pctMov) : metaInfo.meta_ingresadas_mayo ?? 0);

  // Mov real Junio (a la fecha)
  const movRealJunio = useMemo(() => {
    let mov = 0;
    dsJunio.forEach((v) => { mov += v.mov; });
    return mov;
  }, [dsJunio]);
  const ingRealJunio = useMemo(() => {
    let ing = 0;
    dsJunio.forEach((v) => { ing += v.ing; });
    return ing;
  }, [dsJunio]);

  // Brecha pendiente para llegar a la meta
  const movPendiente = Math.max(metaMovJunio - movRealJunio, 0);
  const ingPendiente = Math.max(metaIngJunio - ingRealJunio, 0);

  // ─── BASELINE (basado en DSs activos de Mayo) ───
  const baselineDsCount = Math.max(activosMayo, 1);
  const baselineMovPerDsTotal = metaMovJunio / baselineDsCount;
  const baselineIngPerDsTotal = metaIngJunio / baselineDsCount;
  const baselineMovPerDsPerDay = baselineMovPerDsTotal / diasJunio;
  const baselineIngPerDsPerDay = baselineIngPerDsTotal / diasJunio;

  // ─── LIVE (basado en DSs activos de Junio hasta hoy) ───
  const liveDsCount = Math.max(activosJunio, 1);
  const liveMovPerDsRemaining = movPendiente / liveDsCount / diasRestantes;
  const liveIngPerDsRemaining = ingPendiente / liveDsCount / diasRestantes;

  // ─── Tabla por DS ───
  const tabla = useMemo(() => {
    const rows: {
      nombre: string;
      mayoIng: number;
      mayoMov: number;
      mayoDiasActivos: number;
      mayoMovPorDia: number;
      juniIng: number;
      juniMov: number;
      juniDiasActivos: number;
      juniMovPorDia: number;
      reqMovPorDia: number;  // necesario por día para llegar a su cuota
      reqIngPorDia: number;
      gap: number; // diferencia entre lo que necesita y lo que está haciendo
    }[] = [];

    // Cuota por DS basada en Mayo (proporción del % de Mayo)
    let totalMovMayo = 0;
    dsMayo.forEach((v) => { totalMovMayo += v.mov; });

    const allKeys = new Set<string>([...dsMayo.keys(), ...dsJunio.keys()]);
    allKeys.forEach((nombre) => {
      const may = dsMayo.get(nombre) || { ing: 0, mov: 0, nombre };
      const jun = dsJunio.get(nombre) || { ing: 0, mov: 0, nombre };
      const mayDays = (activeDaysMayo.get(nombre)?.size) || 0;
      const junDays = (activeDaysJunio.get(nombre)?.size) || 0;
      const mayoMovPorDia = mayDays > 0 ? may.mov / mayDays : 0;
      const juniMovPorDia = junDays > 0 ? jun.mov / junDays : 0;

      // Cuota mensual = share del DS en Mayo aplicada a la meta de Junio
      const share = totalMovMayo > 0 ? may.mov / totalMovMayo : 1 / Math.max(allKeys.size, 1);
      const cuotaMov = metaMovJunio * share;
      const cuotaMovRestante = Math.max(cuotaMov - jun.mov, 0);
      const reqMovPorDia = diasRestantes > 0 ? cuotaMovRestante / diasRestantes : 0;
      const reqIngPorDia = totalsMayo.pctMov > 0 ? reqMovPorDia / totalsMayo.pctMov : 0;
      const gap = reqMovPorDia - juniMovPorDia;

      rows.push({
        nombre,
        mayoIng: may.ing, mayoMov: may.mov, mayoDiasActivos: mayDays, mayoMovPorDia,
        juniIng: jun.ing, juniMov: jun.mov, juniDiasActivos: junDays, juniMovPorDia,
        reqMovPorDia, reqIngPorDia, gap,
      });
    });

    rows.sort((a, b) => (b.mayoMov + b.juniMov) - (a.mayoMov + a.juniMov));
    return rows;
  }, [dsMayo, dsJunio, activeDaysMayo, activeDaysJunio, metaMovJunio, diasRestantes, totalsMayo.pctMov]);

  const tablaFiltrada = useMemo(() => {
    let r = tabla;
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter((x) => x.nombre.toLowerCase().includes(s));
    }
    return r;
  }, [tabla, search]);

  // Escenarios "cuántos DSs necesito activar para que cada uno necesite N/día"
  const escenarios = useMemo(() => {
    const targets = [1.5, 2, 3]; // multiplicadores sobre baseline
    return targets.map((mult) => {
      const movPorDsTarget = baselineMovPerDsPerDay / mult;
      // ¿cuántos DSs hacen falta para que cada uno necesite movPorDsTarget?
      const dsNecesarios = movPorDsTarget > 0 ? Math.ceil(metaMovJunio / diasJunio / movPorDsTarget) : 0;
      const adicionales = Math.max(dsNecesarios - activosMayo, 0);
      return { mult, dsNecesarios, adicionales, movPorDsTarget, ingPorDsTarget: totalsMayo.pctMov > 0 ? movPorDsTarget / totalsMayo.pctMov : 0 };
    });
  }, [baselineMovPerDsPerDay, metaMovJunio, diasJunio, activosMayo, totalsMayo.pctMov]);

  if (loading) {
    return <div className="glass-card p-6 t-muted text-sm">Cargando análisis de mínimo diario…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">📐 Mínimo Diario — Proyección de Crecimiento</h2>
        <p className="text-[11px] t-muted">
          Cuánto necesita movilizar cada Dropshipper activo por día para llegar a la meta de Junio.
          Basado en la cartera de Mayo y ajustado por los DSs activos de Junio hasta el día {diasTranscurridos}.
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Meta Movilizadas Junio" value={metaMovJunio.toLocaleString("es-AR")} color="#f97316" />
        <Kpi label="Meta Ingresadas Junio" value={metaIngJunio.toLocaleString("es-AR")} color="#0891b2" />
        <Kpi label="% Movilización país (Mayo)" value={`${(totalsMayo.pctMov * 100).toFixed(1)}%`} color="#10b981" sub={`${totalsMayo.mov.toLocaleString("es-AR")} / ${totalsMayo.ing.toLocaleString("es-AR")}`} />
        <Kpi label="DSs activos Mayo" value={activosMayo.toLocaleString("es-AR")} color="#a78bfa" />
        <Kpi label="DSs activos Junio" value={activosJunio.toLocaleString("es-AR")} color="#a78bfa" sub={`hasta día ${diasTranscurridos}`} />
        <Kpi label="Días restantes Junio" value={diasRestantes.toLocaleString("es-AR")} color="#dc2626" sub={`de ${diasJunio}`} />
      </div>

      {/* Progreso real vs meta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ProgressCard
          label="Movilizadas Junio (real vs meta)"
          actual={movRealJunio}
          target={metaMovJunio}
          color="#10b981"
        />
        <ProgressCard
          label="Ingresadas Junio (real vs meta)"
          actual={ingRealJunio}
          target={metaIngJunio}
          color="#0891b2"
        />
      </div>

      {/* Comparación BASELINE vs LIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">📊 BASELINE — Si mantenés la cartera de Mayo</h3>
          <p className="text-[11px] t-muted mb-3">{activosMayo} dropshippers activos, distribuidos en {diasJunio} días.</p>
          <div className="space-y-2">
            <PerDsRow label="Movilizadas / DS / día" value={baselineMovPerDsPerDay} color="#10b981" suffix=" guías" />
            <PerDsRow label="Ingresadas / DS / día" value={baselineIngPerDsPerDay} color="#0891b2" suffix=" guías" />
            <PerDsRow label="Total mensual / DS — movilizadas" value={baselineMovPerDsTotal} color="#f59e0b" suffix=" guías" />
            <PerDsRow label="Total mensual / DS — ingresadas" value={baselineIngPerDsTotal} color="#f59e0b" suffix=" guías" />
          </div>
        </div>
        <div className="rounded-xl p-4 border border-orange-500/30" style={{ background: "rgba(249,115,22,0.05)" }}>
          <h3 className="text-sm font-bold t-primary mb-2">🎯 LIVE — Ajustado a los activos de Junio</h3>
          <p className="text-[11px] t-muted mb-3">{activosJunio} DSs activos al día {diasTranscurridos}. Resto = brecha / activos / {diasRestantes} días.</p>
          <div className="space-y-2">
            <PerDsRow label="Movilizadas / DS / día (necesario)" value={liveMovPerDsRemaining} color="#10b981" suffix=" guías" />
            <PerDsRow label="Ingresadas / DS / día (necesario)" value={liveIngPerDsRemaining} color="#0891b2" suffix=" guías" />
            <PerDsRow label="Brecha movilizadas pendiente" value={movPendiente} color="#f59e0b" suffix=" guías" intRound />
            <PerDsRow label="Brecha ingresadas pendiente" value={ingPendiente} color="#f59e0b" suffix=" guías" intRound />
          </div>
        </div>
      </div>

      {/* Escenarios estratégicos */}
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

      {/* Tabla por DS */}
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
                <th className="text-right py-2 px-2">Mayo mov</th>
                <th className="text-right py-2 px-2">Mayo días</th>
                <th className="text-right py-2 px-2">Mayo mov/día</th>
                <th className="text-right py-2 px-2">Junio mov</th>
                <th className="text-right py-2 px-2">Junio días</th>
                <th className="text-right py-2 px-2">Junio mov/día</th>
                <th className="text-right py-2 px-2 text-orange-300">Necesario mov/día</th>
                <th className="text-right py-2 px-2 text-cyan-300">Necesario ing/día</th>
                <th className="text-right py-2 px-2">Gap</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? tablaFiltrada : tablaFiltrada.slice(0, 50)).map((r, i) => (
                <tr key={r.nombre} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                  <td className="py-2 px-2 t-muted text-[10px]">{i + 1}</td>
                  <td className="py-2 px-2 t-primary max-w-[220px] truncate" title={r.nombre}>{r.nombre}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.mayoMov.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right t-muted">{r.mayoDiasActivos}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.mayoMovPorDia.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right font-mono text-orange-400">{r.juniMov.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right t-muted">{r.juniDiasActivos}</td>
                  <td className="py-2 px-2 text-right font-mono">{r.juniMovPorDia.toFixed(1)}</td>
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
          <strong>Gap</strong> = lo que falta movilizar por día para cumplir su cuota (proporcional a Mayo). Verde = ya está al ritmo o sobrado.
          Rojo = está por debajo del ritmo necesario.
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
