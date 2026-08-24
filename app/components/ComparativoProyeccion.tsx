"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface DailyRow { dia: number; ingresadas: number; movilizadas: number; entregadas: number; devueltas: number; canceladas: number }
interface Clasif {
  total: number; cancelado: number; rechazado: number; cancelado_transp: number;
  pend_confirmacion: number; pendiente: number; guia_generada: number; preparado: number;
  movilizadas: number; entregadas: number; devueltas: number; en_proceso: number;
}

const DIAS_MES: Record<string, number> = { enero: 31, febrero: 28, marzo: 31, abril: 30, mayo: 31, junio: 30, julio: 31, agosto: 31, septiembre: 30, octubre: 31, noviembre: 30, diciembre: 31 };
const fmt = (n: number): string => Math.round(n).toLocaleString("es-AR");
const pp = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function semTasa(t: number): { emoji: string; color: string } {
  if (t >= 75) return { emoji: "🟢", color: "#10b981" };
  if (t >= 65) return { emoji: "🟡", color: "#eab308" };
  return { emoji: "🔴", color: "#ef4444" };
}
function semDiff(d: number): { emoji: string; color: string } {
  if (d > 0.5) return { emoji: "🟢", color: "#10b981" };
  if (d >= -0.5) return { emoji: "🟡", color: "#eab308" };
  return { emoji: "🔴", color: "#ef4444" };
}

export default function ComparativoProyeccion({ country, mes }: { country: "ar" | "py"; mes: string }) {
  const labelMes = cap(mes);
  const [clasif, setClasif] = useState<Clasif | null>(null);
  const [dailyActual, setDailyActual] = useState<DailyRow[]>([]);
  const [dailyPrev, setDailyPrev] = useState<DailyRow[]>([]);
  const [mesPrev, setMesPrev] = useState("");
  const [prevLive, setPrevLive] = useState<{ movLive: number; fechaLive: string; totalLive: number } | null>(null);
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
      setPrevLive(d.prevLive || null);
    } catch (e: any) { setError(e.message || "Error al cargar"); }
    finally { setLoading(false); }
  }, [country, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const labelPrev = mesPrev ? cap(mesPrev) : "—";
  const diasMes = DIAS_MES[mes] || 30;

  const A = useMemo(() => {
    const sum = (arr: DailyRow[], k: keyof DailyRow) => arr.reduce((s, d) => s + (Number(d[k]) || 0), 0);
    const ingresadas = sum(dailyActual, "ingresadas");
    const mov = sum(dailyActual, "movilizadas");
    if (dailyActual.length === 0 || (ingresadas === 0 && mov === 0)) return null;
    // ── CLASIFICACIÓN sobre el TOTAL DEL ARCHIVO (todos los registros del snapshot de operations) ──
    // Regla de validación: Total archivo = Grupo A + Grupo B + Grupo C ;
    // Grupo C = Entregadas + Devueltas + En proceso. Nunca se silencia el descuadre.
    const totalArch = clasif?.total || 0;
    const cCancel = clasif?.cancelado || 0;
    const cRechazo = clasif?.rechazado || 0;
    const canceladas = cCancel + cRechazo;                       // GRUPO A: CANCELADO + RECHAZADO
    const cMov = clasif?.movilizadas || 0;                       // GRUPO C base: con fecha procesamiento y no en A
    const entregadas = clasif?.entregadas || 0;                  // ENTREGADO (terminal)
    const devueltas = clasif?.devueltas || 0;                    // DEVOLUCION (terminal; PY solo este)
    const enProceso = Math.max(0, cMov - entregadas - devueltas); // resto movilizado = en proceso
    const bPendConf = clasif?.pend_confirmacion || 0;            // B1 Pendiente confirmación
    const bPendiente = clasif?.pendiente || 0;                   // B2 Pendiente (sin guía)
    const bGuia = clasif?.guia_generada || 0;                    // B3 Guía generada
    const bPreparado = clasif?.preparado || 0;                   // B4 Preparado p/ transp.
    const grupoB = Math.max(0, totalArch - canceladas - cMov);   // GRUPO B total (por diferencia)
    const bResto = Math.max(0, grupoB - (bPendConf + bPendiente + bGuia + bPreparado)); // B5 por confirmar / sin exportar
    // Validación obligatoria.
    const sumABC = canceladas + grupoB + cMov;
    const descuadre = totalArch - sumABC;                        // debe ser 0
    const reconcOk = descuadre === 0 && (entregadas + devueltas + enProceso) === cMov;
    // % SOBRE TOTAL del archivo (clasificación).
    const pctCancel = totalArch > 0 ? (canceladas / totalArch) * 100 : 0;
    const pctPend = totalArch > 0 ? (grupoB / totalArch) * 100 : 0;
    const pctMovC = totalArch > 0 ? (cMov / totalArch) * 100 : 0;
    const techo = totalArch > 0 ? ((cMov + grupoB) / totalArch) * 100 : 0; // máx si se despacha todo B
    // Movilización OPERATIVA (mov del día / ingresadas del seguimiento diario) — para comparación/proyección.
    const pctMov = ingresadas > 0 ? (mov / ingresadas) * 100 : 0;

    const mapA = new Map<number, DailyRow>(); for (const d of dailyActual) mapA.set(d.dia, d);
    const mapP = new Map<number, DailyRow>(); for (const d of dailyPrev) mapP.set(d.dia, d);
    const N = dailyActual.reduce((m, d) => ((d.ingresadas > 0 || d.movilizadas > 0) && d.dia > m ? d.dia : m), 0);

    const serie: { dia: number; ingA: number; movA: number; pctA: number; ingP: number; movP: number; pctP: number; diff: number }[] = [];
    let accIA = 0, accMA = 0, accIP = 0, accMP = 0;
    for (let d = 1; d <= N; d++) {
      accIA += mapA.get(d)?.ingresadas || 0; accMA += mapA.get(d)?.movilizadas || 0;
      accIP += mapP.get(d)?.ingresadas || 0; accMP += mapP.get(d)?.movilizadas || 0;
      const pctA = accIA > 0 ? (accMA / accIA) * 100 : 0;
      const pctP = accIP > 0 ? (accMP / accIP) * 100 : 0;
      serie.push({ dia: d, ingA: accIA, movA: accMA, pctA, ingP: accIP, movP: accMP, pctP, diff: pctA - pctP });
    }
    const hayPrev = dailyPrev.length > 0 && accIP > 0;
    const ingActualN = accIA, movActualN = accMA, ingPrevN = accIP;
    const pctActualN = ingActualN > 0 ? (movActualN / ingActualN) * 100 : 0;
    // % del mes anterior al día N tomado del snapshot YA MADURO (referencia de cierre por día).
    const pctPrevN = ingPrevN > 0 ? (accMP / ingPrevN) * 100 : 0;

    // Proyección por MADURACIÓN: durante el mes la movilización es MENOR a la final,
    // porque las órdenes recientes todavía no se movilizaron. Para que la comparación sea
    // real hay que ver cómo estaba el mes anterior EN VIVO ese mismo día (no ya cerrado):
    // movLive = movilizadas del snapshot histórico del mes anterior al día N.
    // Ej: julio al día 22 iba 70% EN VIVO y cerró 83% (×1,19); agosto hoy 76% → ~90%.
    const ingPrevTotal = sum(dailyPrev, "ingresadas");
    const movPrevTotal = sum(dailyPrev, "movilizadas");
    const pctPrevFinal = ingPrevTotal > 0 ? (movPrevTotal / ingPrevTotal) * 100 : 0;
    // % EN VIVO del mes anterior al día N (base correcta para la maduración).
    const pctPrevLiveN = (prevLive && ingPrevN > 0) ? (prevLive.movLive / ingPrevN) * 100 : pctPrevN;
    const factor = ingPrevN > 0 ? ingPrevTotal / ingPrevN : 1;      // crecimiento de ingresadas
    const ingProy = Math.round(ingActualN * factor);
    const maduracion = pctPrevLiveN > 0 ? pctPrevFinal / pctPrevLiveN : 1;  // sube el % del día N (en vivo) al cierre
    const pctProyBase = Math.min(100, pctActualN * maduracion);
    const escenarios = [
      { key: "conservador", label: "🔴 Conservador", delta: -2.5 },
      { key: "base", label: "🟡 Base", delta: 0 },
      { key: "optimista", label: "🟢 Optimista", delta: 2.5 },
    ].map((e) => {
      const pctFinal = Math.max(0, Math.min(100, pctProyBase + e.delta));
      const movProy = Math.round(ingProy * (pctFinal / 100));
      return { ...e, pctFinal, movProy };
    });

    // Comparación con el mes anterior AL MISMO DÍA: se usa el % acumulado del mes anterior
    // hasta ese día (movilizadas acum. / ingresadas acum.), NO el cierre final del mes.
    const diffN = pctActualN - pctPrevN;
    const quiebres = serie.filter((s, i) => i > 0 && Math.sign(s.diff) !== Math.sign(serie[i - 1].diff) && Math.abs(s.diff) > 0.3).map((s) => s.dia);
    const masIngresadas = ingActualN > ingPrevN;

    return {
      ingresadas, mov, canceladas, entregadas, devueltas, enProceso, grupoB, pctMov, pctCancel, pctPend, techo,
      totalArch, cCancel, cRechazo, cMov, pctMovC, reconcOk, descuadre,
      bPendConf, bPendiente, bGuia, bPreparado, bResto,
      N, serie, hayPrev, ingActualN, movActualN, ingPrevN, pctActualN, pctPrevN, pctPrevLiveN, diffN,
      ingPrevTotal, pctPrevFinal, factor, ingProy, maduracion, pctProyBase, escenarios, quiebres, masIngresadas,
    };
  }, [clasif, dailyActual, dailyPrev, prevLive, diasMes]);

  if (loading) return <div className="glass-card p-8 text-center t-secondary">Analizando {labelMes}…</div>;
  if (error) return <div className="glass-card p-8 text-center text-red-400">{error} <button onClick={() => fetchData()} className="ml-2 underline">Reintentar</button></div>;
  if (!A) return <div className="glass-card p-8 text-center t-secondary">No hay data de {labelMes} cargada (necesita operaciones + seguimiento diario).</div>;

  const semMov = semTasa(A.pctMov);

  return (
    <div className="space-y-5">
      {/* 1 — RESUMEN RÁPIDO */}
      <div className="glass-card p-5" style={{ borderLeft: `3px solid ${semMov.color}` }}>
        <h2 className="text-lg font-bold t-primary flex items-center gap-2">📊 Comparativo + Proyección — {labelMes} {country.toUpperCase()}</h2>
        <p className="text-sm t-secondary mt-2 leading-relaxed">
          Al día <b className="t-primary">{A.N}</b>: <b className="t-primary">{fmt(A.ingresadas)}</b> ingresadas ·
          <b className="t-primary"> {fmt(A.mov)}</b> movilizadas ·
          movilización <b style={{ color: semMov.color }}>{semMov.emoji} {pp(A.pctMov)}%</b>.
          {A.hayPrev && <> Vs {labelPrev} al mismo día ({pp(A.pctPrevN)}% acumulado al día {A.N}): <b style={{ color: semDiff(A.diffN).color }}>{A.diffN >= 0 ? "+" : ""}{pp(A.diffN)} pp</b> ({A.diffN >= 0 ? "mejor" : "peor"}).</>}
        </p>
      </div>

      {/* 2 — CLASIFICACIÓN (Grupos A/B/C sobre el TOTAL DEL ARCHIVO) */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-sm font-bold t-primary">Clasificación sobre {fmt(A.totalArch)} registros del archivo</h3>
          {A.totalArch > 0 && (
            A.reconcOk
              ? <span className="text-[11px] font-semibold" style={{ color: "#10b981" }}>✓ Total = A + B + C ({fmt(A.canceladas)} + {fmt(A.grupoB)} + {fmt(A.cMov)})</span>
              : <span className="text-[11px] font-semibold" style={{ color: "#ef4444" }}>⚠ Descuadre de {fmt(Math.abs(A.descuadre))} registros sin clasificar</span>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#ef4444" }}>🔴 A — No se recuperarán ({pp(A.pctCancel)}%)</div>
            <Row l="Cancelado" v={A.cCancel} t={A.totalArch} />
            <Row l="Rechazado" v={A.cRechazo} t={A.totalArch} />
            <RowTot l="Total A (pérdida definitiva)" v={A.canceladas} t={A.totalArch} />
          </div>
          <div className="rounded-lg p-3" style={{ background: "rgba(234,179,8,0.08)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#eab308" }}>🟡 B — Aún no movilizadas ({pp(A.pctPend)}%)</div>
            <Row l="Pendiente confirmación" v={A.bPendConf} t={A.totalArch} />
            <Row l="Pendiente (sin guía)" v={A.bPendiente} t={A.totalArch} />
            <Row l="Guía generada" v={A.bGuia} t={A.totalArch} />
            <Row l="Preparado p/ transp." v={A.bPreparado} t={A.totalArch} />
            <Row l="Por confirmar / sin exportar" v={A.bResto} t={A.totalArch} />
            <RowTot l="Total B (oportunidad)" v={A.grupoB} t={A.totalArch} />
          </div>
          <div className="rounded-lg p-3" style={{ background: "rgba(16,185,129,0.08)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#10b981" }}>🟢 C — Movilizadas ({pp(A.pctMovC)}% del archivo)</div>
            <Row l="Entregadas" v={A.entregadas} t={A.cMov} suf="de mov." />
            <Row l="Devueltas" v={A.devueltas} t={A.cMov} suf="de mov." />
            <Row l="En proceso" v={A.enProceso} t={A.cMov} suf="de mov." />
            <RowTot l="Total movilizadas" v={A.cMov} t={A.totalArch} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Total archivo" value={fmt(A.totalArch)} tone="#3b82f6" sub="registros operations" />
          <Kpi label="Movilizadas (C)" value={fmt(A.cMov)} tone={semMov.color} sub={`${pp(A.pctMovC)}% del archivo`} />
          <Kpi label="No recuperable (A)" value={`${pp(A.pctCancel)}%`} tone="#ef4444" sub={fmt(A.canceladas)} />
          <Kpi label="Pendiente (B)" value={`${pp(A.pctPend)}%`} tone="#eab308" sub={fmt(A.grupoB)} />
          <Kpi label="En proceso" value={fmt(A.enProceso)} tone="#0ea5e9" sub="de movilizadas" />
          <Kpi label="Techo máx. posible" value={`${pp(A.techo)}%`} tone="#3b82f6" sub="si se despacha todo B" />
        </div>
        <div className="mt-3 text-[11px] t-muted">
          Movilización operativa (día {A.N}): <b className="t-primary">{fmt(A.mov)}</b> movilizadas / <b className="t-primary">{fmt(A.ingresadas)}</b> ingresadas del seguimiento diario = <b style={{ color: semMov.color }}>{pp(A.pctMov)}%</b>. Es la base de la comparación y proyección de abajo (distinta del % sobre archivo).
        </div>
      </div>

      {A.hayPrev ? (
        <>
          {/* 3 — COMPARATIVO DÍA A DÍA */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold t-primary mb-1">Comparativo día a día — {labelMes} vs {labelPrev} (mismo día)</h3>
            <p className="text-[11px] t-muted mb-3">Acumulado a cada día (movilizadas acum. / ingresadas acum.). Cada fila de {labelPrev} es cómo estaba ese mismo día, <b className="t-primary">no</b> el cierre final. Δ en puntos porcentuales.</p>
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
                        <td className="py-1.5 px-2 text-right t-secondary">{fmt(s.ingP)}</td>
                        <td className="py-1.5 px-2 text-right t-secondary">{fmt(s.movP)}</td>
                        <td className="py-1.5 px-2 text-right t-secondary">{pp(s.pctP)}%</td>
                        <td className="py-1.5 px-2 text-right t-primary">{fmt(s.ingA)}</td>
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
              <li>• Al día {A.N}, {labelMes} va <b style={{ color: semDiff(A.diffN).color }}>{A.diffN >= 0 ? "mejor" : "peor"}</b> que {labelPrev} <b className="t-primary">al mismo día</b>: {pp(A.pctActualN)}% vs {pp(A.pctPrevN)}% ({A.diffN >= 0 ? "+" : ""}{pp(A.diffN)} pp). <span className="t-muted">(acumulado al día {A.N}, no el cierre final de {labelPrev} que fue {pp(A.pctPrevFinal)}%.)</span></li>
              <li>• Ingresadas: {fmt(A.ingActualN)} vs {fmt(A.ingPrevN)} en {labelPrev} ({A.masIngresadas ? "+" : ""}{pp(A.ingPrevN > 0 ? ((A.ingActualN - A.ingPrevN) / A.ingPrevN) * 100 : 0)}%).</li>
              <li>• La diferencia se explica principalmente por <b className="t-primary">{Math.abs(A.diffN) >= 1 ? "la gestión de movilización" : "el volumen de ingresadas"}</b>{A.masIngresadas ? " (entraron más órdenes este mes)" : ""}.</li>
              {A.quiebres.length > 0 && <li>• Quiebres de tendencia vs {labelPrev}: día(s) {A.quiebres.join(", ")}.</li>}
            </ul>
          </div>

          {/* 5 — PROYECCIÓN */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold t-primary mb-1">📈 Proyección de cierre — {labelMes}</h3>
            <p className="text-[11px] t-muted mb-3">
              Para proyectar el cierre no sirve el {pp(A.pctPrevN)}% (así quedó {labelPrev} ya maduro a ese día): hay que ver cómo se <b className="t-primary">veía en vivo</b> ese día, porque {labelMes} hoy también está sin madurar.
              {" "}En {labelPrev}, al día {A.N} la movilización se veía en <b className="t-primary">{pp(A.pctPrevLiveN)}%</b> y cerró en <b className="t-primary">{pp(A.pctPrevFinal)}%</b> → maduró ×{pp(A.maduracion)}.
              {" "}{labelMes} hoy va {pp(A.pctActualN)}% → proyección de cierre <b className="t-primary">{pp(A.pctProyBase)}%</b>.
              {" "}Ingresadas proyectadas: <b className="t-primary">{fmt(A.ingProy)}</b> (crecimiento {pp(A.factor)}×).
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
                      <div>Ingresadas: <b className="t-primary">{fmt(A.ingProy)}</b></div>
                      <div>Movilizadas: <b className="t-primary">{fmt(e.movProy)}</b></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card p-6 text-center t-secondary">
          Falta la referencia de <b className="t-primary">{labelPrev}</b> (operaciones + seguimiento diario). Con solo el mes actual se muestra únicamente la clasificación de arriba.
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
