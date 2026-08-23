"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface DailyOrd { dia: number; ordenes: number; movilizadas: number }
interface Clasif {
  total: number; cancelado: number; rechazado: number; cancelado_transp: number;
  pend_confirmacion: number; pendiente: number; guia_generada: number; preparado: number;
  movilizadas: number; entregadas: number; devueltas: number; en_proceso: number;
}

const DIAS_MES: Record<string, number> = { enero: 31, febrero: 28, marzo: 31, abril: 30, mayo: 31, junio: 30, julio: 31, agosto: 31, septiembre: 30, octubre: 31, noviembre: 30, diciembre: 31 };
const fmt = (n: number): string => Math.round(n).toLocaleString("es-AR");
const pp = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Semáforo por tasa de movilización (%)
function semTasa(t: number): { emoji: string; color: string } {
  if (t >= 75) return { emoji: "🟢", color: "#10b981" };
  if (t >= 65) return { emoji: "🟡", color: "#eab308" };
  return { emoji: "🔴", color: "#ef4444" };
}
// Semáforo por diferencia en pp vs mes anterior
function semDiff(d: number): { emoji: string; color: string } {
  if (d > 0.5) return { emoji: "🟢", color: "#10b981" };
  if (d >= -0.5) return { emoji: "🟡", color: "#eab308" };
  return { emoji: "🔴", color: "#ef4444" };
}

export default function ComparativoProyeccion({ country, mes }: { country: "ar" | "py"; mes: string }) {
  const labelMes = cap(mes);
  const [clasif, setClasif] = useState<Clasif | null>(null);
  const [dailyActual, setDailyActual] = useState<DailyOrd[]>([]);
  const [dailyPrev, setDailyPrev] = useState<DailyOrd[]>([]);
  const [mesPrev, setMesPrev] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/data/comparativo?country=${country}&mes=${mes}`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) throw new Error("Sesión expirada — recargá la página.");
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const d = await res.json();
      setClasif(d.clasif || null);
      setDailyActual(Array.isArray(d.dailyActual) ? d.dailyActual : []);
      setDailyPrev(Array.isArray(d.dailyPrev) ? d.dailyPrev : []);
      setMesPrev(d.mesPrev || "");
    } catch (e: any) { setError(e.message || "Error al cargar"); }
    finally { setLoading(false); }
  }, [country, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const labelPrev = mesPrev ? cap(mesPrev) : "—";
  const diasMes = DIAS_MES[mes] || 30;

  const A = useMemo(() => {
    if (!clasif || clasif.total === 0) return null;
    const total = clasif.total;
    const grupoA = clasif.cancelado + clasif.rechazado + clasif.cancelado_transp;
    const grupoB = clasif.pend_confirmacion + clasif.pendiente + clasif.guia_generada + clasif.preparado;
    const mov = clasif.movilizadas;
    const pctMov = total > 0 ? (mov / total) * 100 : 0;
    const pctCancel = total > 0 ? (grupoA / total) * 100 : 0;
    const pctPend = total > 0 ? (grupoB / total) * 100 : 0;
    const techo = total > 0 ? ((mov + grupoB) / total) * 100 : 0;

    // Mapas por día
    const mapA = new Map<number, DailyOrd>(); for (const d of dailyActual) mapA.set(d.dia, d);
    const mapP = new Map<number, DailyOrd>(); for (const d of dailyPrev) mapP.set(d.dia, d);
    const maxDiaActual = dailyActual.reduce((m, d) => (d.ordenes > 0 && d.dia > m ? d.dia : m), 0);
    const N = maxDiaActual; // día de corte (último con data en el mes actual)

    // Serie acumulada día a día hasta N
    const serie: { dia: number; ordA: number; movA: number; pctA: number; ordP: number; movP: number; pctP: number; diff: number }[] = [];
    let accOA = 0, accMA = 0, accOP = 0, accMP = 0;
    for (let d = 1; d <= N; d++) {
      accOA += mapA.get(d)?.ordenes || 0; accMA += mapA.get(d)?.movilizadas || 0;
      accOP += mapP.get(d)?.ordenes || 0; accMP += mapP.get(d)?.movilizadas || 0;
      const pctA = accOA > 0 ? (accMA / accOA) * 100 : 0;
      const pctP = accOP > 0 ? (accMP / accOP) * 100 : 0;
      serie.push({ dia: d, ordA: accOA, movA: accMA, pctA, ordP: accOP, movP: accMP, pctP, diff: pctA - pctP });
    }
    const hayPrev = dailyPrev.length > 0;

    // Totales al corte
    const ordActualN = accOA, movActualN = accMA, ordPrevN = accOP;
    const pctActualN = ordActualN > 0 ? (movActualN / ordActualN) * 100 : 0;
    const pctPrevN = ordPrevN > 0 ? (accMP / ordPrevN) * 100 : 0;

    // ── Proyección ──
    const ordPrevTotal = dailyPrev.reduce((s, d) => s + d.ordenes, 0);
    const factor = ordPrevN > 0 ? ordPrevTotal / ordPrevN : 1;
    const ordenesProy = Math.round(ordActualN * factor);
    const ordenesRestantesProy = Math.max(0, ordenesProy - ordActualN);
    // Tasa de los días restantes en el mes anterior (N+1 .. diasMes)
    let ordRest = 0, movRest = 0;
    for (let d = N + 1; d <= diasMes; d++) { ordRest += mapP.get(d)?.ordenes || 0; movRest += mapP.get(d)?.movilizadas || 0; }
    const tasaRestPrev = ordRest > 0 ? (movRest / ordRest) * 100 : pctPrevN;

    const escenarios = [
      { key: "conservador", label: "🔴 Conservador", delta: -2.5 },
      { key: "base", label: "🟡 Base", delta: 0 },
      { key: "optimista", label: "🟢 Optimista", delta: 2.5 },
    ].map((e) => {
      const tasa = Math.max(0, Math.min(100, tasaRestPrev + e.delta));
      const movProy = Math.round(movActualN + ordenesRestantesProy * (tasa / 100));
      const pctFinal = ordenesProy > 0 ? (movProy / ordenesProy) * 100 : 0;
      return { ...e, tasa, movProy, pctFinal };
    });

    // Narrativa
    const diffN = pctActualN - pctPrevN;
    const quiebres = serie.filter((s, i) => i > 0 && Math.sign(s.diff) !== Math.sign(serie[i - 1].diff) && Math.abs(s.diff) > 0.3).map((s) => s.dia);
    const masOrdenes = ordActualN > ordPrevN;

    return {
      total, grupoA, grupoB, mov, pctMov, pctCancel, pctPend, techo,
      N, serie, hayPrev, ordActualN, movActualN, ordPrevN, pctActualN, pctPrevN, diffN,
      ordPrevTotal, factor, ordenesProy, ordenesRestantesProy, tasaRestPrev, escenarios,
      quiebres, masOrdenes,
    };
  }, [clasif, dailyActual, dailyPrev, diasMes]);

  if (loading) return <div className="glass-card p-8 text-center t-secondary">Analizando {labelMes}…</div>;
  if (error) return <div className="glass-card p-8 text-center text-red-400">{error} <button onClick={() => fetchData()} className="ml-2 underline">Reintentar</button></div>;
  if (!A) return <div className="glass-card p-8 text-center t-secondary">No hay data de {labelMes} cargada en Operaciones.</div>;

  const semMov = semTasa(A.pctMov);

  return (
    <div className="space-y-5">
      {/* 1 — RESUMEN RÁPIDO */}
      <div className="glass-card p-5" style={{ borderLeft: `3px solid ${semMov.color}` }}>
        <h2 className="text-lg font-bold t-primary flex items-center gap-2">📊 Comparativo + Proyección — {labelMes} {country.toUpperCase()}</h2>
        <p className="text-sm t-secondary mt-2 leading-relaxed">
          Al día <b className="t-primary">{A.N}</b>: <b className="t-primary">{fmt(A.total)}</b> ingresadas ·
          <b className="t-primary"> {fmt(A.mov)}</b> movilizadas ·
          movilización <b style={{ color: semMov.color }}>{semMov.emoji} {pp(A.pctMov)}%</b> ·
          techo posible <b className="t-primary">{pp(A.techo)}%</b> (si se despacha todo lo pendiente).
          {A.hayPrev && <> Vs {labelPrev} al mismo día: <b style={{ color: semDiff(A.diffN).color }}>{A.diffN >= 0 ? "+" : ""}{pp(A.diffN)} pp</b> ({A.diffN >= 0 ? "mejor" : "peor"}).</>}
        </p>
      </div>

      {/* 2 — CLASIFICACIÓN (Grupos A/B/C) */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold t-primary mb-3">Clasificación de órdenes ingresadas ({fmt(A.total)})</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Grupo A */}
          <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#ef4444" }}>🔴 A — No se movilizarán ({pp(A.pctCancel)}%)</div>
            <Row l="Cancelado" v={clasif!.cancelado} t={A.total} />
            <Row l="Rechazado" v={clasif!.rechazado} t={A.total} />
            <Row l="Cancelado x transp." v={clasif!.cancelado_transp} t={A.total} />
            <RowTot l="Total Grupo A" v={A.grupoA} t={A.total} />
          </div>
          {/* Grupo B */}
          <div className="rounded-lg p-3" style={{ background: "rgba(234,179,8,0.08)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#eab308" }}>🟡 B — Aún no movilizadas ({pp(A.pctPend)}%)</div>
            <Row l="Pendiente confirmación" v={clasif!.pend_confirmacion} t={A.total} />
            <Row l="Pendiente (sin guía)" v={clasif!.pendiente} t={A.total} />
            <Row l="Guía generada" v={clasif!.guia_generada} t={A.total} />
            <Row l="Preparado p/ transp." v={clasif!.preparado} t={A.total} />
            <RowTot l="Total Grupo B (oportunidad)" v={A.grupoB} t={A.total} />
          </div>
          {/* Grupo C */}
          <div className="rounded-lg p-3" style={{ background: "rgba(16,185,129,0.08)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#10b981" }}>🟢 C — Movilizadas ({pp(A.pctMov)}% del total)</div>
            <Row l="Entregadas" v={clasif!.entregadas} t={A.mov} suf="de mov." />
            <Row l="Devueltas" v={clasif!.devueltas} t={A.mov} suf="de mov." />
            <Row l="En proceso" v={clasif!.en_proceso} t={A.mov} suf="de mov." />
            <RowTot l="Total movilizadas" v={A.mov} t={A.total} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Ingresadas" value={fmt(A.total)} tone="#3b82f6" />
          <Kpi label="Movilizadas" value={fmt(A.mov)} tone={semMov.color} />
          <Kpi label="% Movilización" value={`${pp(A.pctMov)}%`} tone={semMov.color} sub="mov / ingresadas" />
          <Kpi label="% Cancelación" value={`${pp(A.pctCancel)}%`} tone="#ef4444" />
          <Kpi label="% Pendiente (Grupo B)" value={`${pp(A.pctPend)}%`} tone="#eab308" />
          <Kpi label="Techo máx. posible" value={`${pp(A.techo)}%`} tone="#3b82f6" sub="si se despacha todo B" />
        </div>
      </div>

      {A.hayPrev ? (
        <>
          {/* 3 — COMPARATIVO DÍA A DÍA */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold t-primary mb-1">Comparativo día a día — {labelMes} vs {labelPrev} (mismo día)</h3>
            <p className="text-[11px] t-muted mb-3">Acumulado a cada día. Diferencia en puntos porcentuales de % movilización.</p>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: "var(--bg-card)" }}>
                  <tr className="t-muted uppercase tracking-wider">
                    <th className="text-left py-2 px-2">Día</th>
                    <th className="text-right py-2 px-2">Ingr {labelPrev}</th>
                    <th className="text-right py-2 px-2">Mov {labelPrev}</th>
                    <th className="text-right py-2 px-2">% Mov {labelPrev}</th>
                    <th className="text-right py-2 px-2">Ingr {labelMes}</th>
                    <th className="text-right py-2 px-2">Mov {labelMes}</th>
                    <th className="text-right py-2 px-2">% Mov {labelMes}</th>
                    <th className="text-right py-2 px-2">Δ pp</th>
                  </tr>
                </thead>
                <tbody>
                  {A.serie.map((s) => {
                    const sd = semDiff(s.diff);
                    return (
                      <tr key={s.dia} className="border-t" style={{ borderColor: "var(--bg-card-border)" }}>
                        <td className="py-1.5 px-2 t-primary font-medium">{s.dia}</td>
                        <td className="py-1.5 px-2 text-right t-secondary">{fmt(s.ordP)}</td>
                        <td className="py-1.5 px-2 text-right t-secondary">{fmt(s.movP)}</td>
                        <td className="py-1.5 px-2 text-right t-secondary">{pp(s.pctP)}%</td>
                        <td className="py-1.5 px-2 text-right t-primary">{fmt(s.ordA)}</td>
                        <td className="py-1.5 px-2 text-right t-primary">{fmt(s.movA)}</td>
                        <td className="py-1.5 px-2 text-right font-semibold" style={{ color: semTasa(s.pctA).color }}>{pp(s.pctA)}%</td>
                        <td className="py-1.5 px-2 text-right font-bold" style={{ color: sd.color }}>{sd.emoji} {s.diff >= 0 ? "+" : ""}{pp(s.diff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4 — ANÁLISIS */}
          <div className="glass-card p-5" style={{ borderLeft: `3px solid ${semDiff(A.diffN).color}` }}>
            <h3 className="text-sm font-bold t-primary mb-2">🔍 Análisis</h3>
            <ul className="text-sm t-secondary space-y-1.5 leading-relaxed">
              <li>• Al día {A.N}, {labelMes} va <b style={{ color: semDiff(A.diffN).color }}>{A.diffN >= 0 ? "mejor" : "peor"}</b> que {labelPrev}: {pp(A.pctActualN)}% vs {pp(A.pctPrevN)}% ({A.diffN >= 0 ? "+" : ""}{pp(A.diffN)} pp).</li>
              <li>• Ingresadas: {fmt(A.ordActualN)} vs {fmt(A.ordPrevN)} en {labelPrev} ({A.masOrdenes ? "+" : ""}{pp(A.ordPrevN > 0 ? ((A.ordActualN - A.ordPrevN) / A.ordPrevN) * 100 : 0)}%).</li>
              <li>• La diferencia se explica principalmente por <b className="t-primary">{Math.abs(A.diffN) >= 1 ? "la gestión de movilización" : "el volumen de órdenes"}</b>{A.masOrdenes ? " (entraron más órdenes este mes)" : ""}.</li>
              {A.quiebres.length > 0 && <li>• Quiebres de tendencia (días donde cambió el signo vs {labelPrev}): {A.quiebres.join(", ")}.</li>}
            </ul>
          </div>

          {/* 5 — PROYECCIÓN */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold t-primary mb-1">📈 Proyección de cierre — {labelMes}</h3>
            <p className="text-[11px] t-muted mb-3">
              Factor de crecimiento {pp(A.factor)}× (patrón {labelPrev}) → <b className="t-primary">{fmt(A.ordenesProy)}</b> ingresadas proyectadas al cierre.
              Tasa de movilización de los días restantes en {labelPrev}: {pp(A.tasaRestPrev)}%.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {A.escenarios.map((e) => {
                const st = semTasa(e.pctFinal);
                return (
                  <div key={e.key} className="rounded-lg p-4 border" style={{ borderColor: `${st.color}40`, background: `${st.color}0f` }}>
                    <div className="text-sm font-bold" style={{ color: st.color }}>{e.label}</div>
                    <div className="text-2xl font-bold mt-1" style={{ color: st.color }}>{pp(e.pctFinal)}%</div>
                    <div className="text-[11px] t-secondary mt-0.5">movilización final estimada</div>
                    <div className="mt-2 text-xs t-secondary space-y-0.5">
                      <div>Ingresadas: <b className="t-primary">{fmt(A.ordenesProy)}</b></div>
                      <div>Movilizadas: <b className="t-primary">{fmt(e.movProy)}</b></div>
                      <div className="t-muted">tasa días restantes: {pp(e.tasa)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card p-6 text-center t-secondary">
          Falta el archivo/carga de <b className="t-primary">{labelPrev}</b> como referencia. Con solo el mes actual se muestra únicamente la clasificación (arriba). Cargá el mes anterior en Operaciones para ver el comparativo día a día y la proyección.
        </div>
      )}
    </div>
  );
}

function Row({ l, v, t, suf }: { l: string; v: number; t: number; suf?: string }) {
  const pctv = t > 0 ? (v / t) * 100 : 0;
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="t-secondary">{l}</span>
      <span className="t-primary font-medium">{fmt(v)} <span className="t-muted">({pp(pctv)}%{suf ? " " + suf : ""})</span></span>
    </div>
  );
}
function RowTot({ l, v, t }: { l: string; v: number; t: number }) {
  const pctv = t > 0 ? (v / t) * 100 : 0;
  return (
    <div className="flex items-center justify-between text-xs py-1 mt-1 border-t font-semibold" style={{ borderColor: "var(--bg-card-border)" }}>
      <span className="t-primary">{l}</span>
      <span className="t-primary">{fmt(v)} <span className="t-muted">({pp(pctv)}%)</span></span>
    </div>
  );
}
function Kpi({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">{label}</div>
      <div className="text-xl font-bold mt-0.5" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="text-[10px] t-secondary">{sub}</div>}
    </div>
  );
}
