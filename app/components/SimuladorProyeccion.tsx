"use client";

import { useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

interface DailyRow {
  dia: number;
  ingresadas: number;
  movilizadas: number;
  entregadas: number;
  devueltas: number;
  canceladas: number;
}

const fmt = (n: number): string => Math.round(n).toLocaleString("es-AR");

// ════════════════════════════════════════════════════════════════════════
// Simulador de seguimiento diario + proyección — "jugar" con escenarios.
// ════════════════════════════════════════════════════════════════════════
export default function SimuladorProyeccion({
  labelMes, diasMes, N, dailyCurr, metaMov, metaIng,
}: {
  labelMes: string;
  diasMes: number;
  N: number;            // días transcurridos con data (tramo real)
  dailyCurr: DailyRow[];
  metaMov: number;
  metaIng: number;
}) {
  const [unidad, setUnidad] = useState<"movilizadas" | "ingresadas">("movilizadas");
  // baseRitmo = ritmo/día que se aplica a los días restantes (null → default = ritmo actual).
  const [baseRitmo, setBaseRitmo] = useState<number | null>(null);
  // overrides = valor proyectado manual por día (para afinar día por día).
  const [overrides, setOverrides] = useState<Record<number, number>>({});

  // Al cambiar de unidad, reseteo el escenario.
  useEffect(() => { setBaseRitmo(null); setOverrides({}); }, [unidad]);

  const metaVal = unidad === "movilizadas" ? metaMov : metaIng;

  // Valor real por día (de la unidad elegida)
  const realByDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of dailyCurr) {
      const dia = Number(d.dia);
      if (dia >= 1) m.set(dia, Number(unidad === "movilizadas" ? d.movilizadas : d.ingresadas) || 0);
    }
    return m;
  }, [dailyCurr, unidad]);

  const realAcum = useMemo(() => {
    let s = 0;
    for (let d = 1; d <= N; d++) s += realByDay.get(d) || 0;
    return s;
  }, [realByDay, N]);

  const diasRestantes = Math.max(0, diasMes - N);
  const ritmoActual = N > 0 ? realAcum / N : 0;
  const ritmoActualRound = Math.round(ritmoActual);
  const ritmoNecesario = diasRestantes > 0 ? Math.max(0, Math.ceil((metaVal - realAcum) / diasRestantes)) : 0;

  const effectiveBase = baseRitmo ?? ritmoActualRound;
  const planFor = (d: number) => overrides[d] ?? Math.max(0, Math.round(effectiveBase));

  const planTotal = useMemo(() => {
    let s = 0;
    for (let d = N + 1; d <= diasMes; d++) s += planFor(d);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, effectiveBase, N, diasMes]);

  const proyeccion = realAcum + planTotal;
  const gap = metaVal - proyeccion;
  const pctMeta = metaVal > 0 ? (proyeccion / metaVal) * 100 : 0;
  const llega = metaVal > 0 && proyeccion >= metaVal;

  // Serie para el gráfico (acumulado real + acumulado proyectado + meta lineal)
  const serie = useMemo(() => {
    const out: { dia: number; real: number | null; proy: number; meta: number }[] = [];
    let accReal = 0, accProy = 0;
    const metaDia = metaVal > 0 ? metaVal / diasMes : 0;
    for (let d = 1; d <= diasMes; d++) {
      if (d <= N) { const v = realByDay.get(d) || 0; accReal += v; accProy += v; }
      else { accProy += planFor(d); }
      out.push({ dia: d, real: d <= N ? accReal : null, proy: accProy, meta: Math.round(metaDia * d) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realByDay, N, diasMes, metaVal, overrides, effectiveBase]);

  const setRitmo = (v: number) => { setBaseRitmo(Math.max(0, Math.round(v))); setOverrides({}); };

  return (
    <div className="glass-card p-5" style={{ borderTop: "3px solid #f97316" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold t-primary">🎛️ Simulador de proyección — {labelMes}</h3>
          <p className="text-xs t-secondary mt-1">
            Datos reales cargados hasta el día {N}. Ajustá el ritmo de los días que faltan (o editá día por día) y mirá cómo cierra el mes.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-kpi)" }}>
          {(["movilizadas", "ingresadas"] as const).map((u) => (
            <button key={u} onClick={() => setUnidad(u)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium capitalize transition-all ${unidad === u ? "bg-orange-500 text-white" : "t-secondary hover:text-orange-400"}`}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs del escenario */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">Real al día {N}</div>
          <div className="text-lg font-bold t-primary mt-0.5">{fmt(realAcum)}</div>
          <div className="text-[11px] t-secondary">{fmt(ritmoActual)}/día</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">Proyección cierre</div>
          <div className="text-lg font-bold mt-0.5" style={{ color: "#f97316" }}>{fmt(proyeccion)}</div>
          <div className="text-[11px] t-secondary">+{fmt(planTotal)} en {diasRestantes} días</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">Meta</div>
          <div className="text-lg font-bold t-primary mt-0.5">{metaVal > 0 ? fmt(metaVal) : "—"}</div>
          <div className="text-[11px] t-secondary">{unidad}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">{gap >= 0 ? "Falta para meta" : "Sobre la meta"}</div>
          <div className="text-lg font-bold mt-0.5" style={{ color: llega ? "#10b981" : "#ef4444" }}>{metaVal > 0 ? fmt(Math.abs(gap)) : "—"}</div>
          <div className="text-[11px] t-secondary">{metaVal > 0 ? `${pctMeta.toFixed(0)}% de la meta` : ""}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">Necesario/día</div>
          <div className="text-lg font-bold t-primary mt-0.5">{metaVal > 0 && diasRestantes > 0 ? fmt(ritmoNecesario) : "—"}</div>
          <div className="text-[11px] t-secondary">para llegar a la meta</div>
        </div>
      </div>

      {/* Controles de escenario */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs t-secondary">Ritmo/día para los {diasRestantes} días restantes:</span>
        <input type="number" min={0} value={effectiveBase}
          onChange={(e) => setRitmo(Number(e.target.value) || 0)}
          className="w-24 px-2 py-1.5 rounded border bg-transparent t-primary text-sm font-semibold" style={{ borderColor: "var(--bg-card-border)" }} />
        <button onClick={() => setRitmo(ritmoActual)} className="text-xs px-2.5 py-1.5 rounded border t-secondary hover:text-orange-400" style={{ borderColor: "var(--bg-card-border)" }}>
          = Ritmo actual ({fmt(ritmoActual)})
        </button>
        {metaVal > 0 && diasRestantes > 0 && (
          <button onClick={() => setRitmo(ritmoNecesario)} className="text-xs px-2.5 py-1.5 rounded border" style={{ borderColor: "#10b981", color: "#10b981" }}>
            = Necesario p/ meta ({fmt(ritmoNecesario)})
          </button>
        )}
        <span className={`text-xs font-semibold ml-1 ${llega ? "text-green-500" : "text-red-500"}`}>
          {metaVal > 0 ? (llega ? "✓ Con este ritmo llegás a la meta" : "✗ Con este ritmo no llegás") : ""}
        </span>
      </div>

      {/* Gráfico */}
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={serie} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-card-border)" />
            <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={52} tickFormatter={(v) => fmt(v)} />
            <Tooltip contentStyle={{ background: "var(--bg-tooltip)", border: "1px solid var(--border-tooltip)", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {N > 0 && <ReferenceLine x={N} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: "hoy", fontSize: 10, fill: "var(--text-muted)" }} />}
            <Line type="monotone" dataKey="real" name={`${labelMes} real`} stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="proy" name="Proyección (escenario)" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            {metaVal > 0 && <Line type="monotone" dataKey="meta" name="Ritmo meta" stroke="#10b981" strokeWidth={1.5} strokeDasharray="2 2" dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Plan por día: reales (solo lectura) + proyectados (editables) */}
      {diasMes > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="text-xs font-semibold t-primary">Detalle por día</div>
            <span className="text-[10px] t-muted flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(148,163,184,0.25)" }} /> reales (cargados · no editables)</span>
            <span className="text-[10px] t-muted flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(249,115,22,0.18)" }} /> proyectados (editá para simular)</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {Array.from({ length: diasMes }, (_, i) => i + 1).map((d) => {
              const esReal = d <= N;
              return (
                <div key={d} className="rounded-lg p-1.5 text-center border"
                  style={{ background: esReal ? "rgba(148,163,184,0.12)" : "rgba(249,115,22,0.10)", borderColor: esReal ? "transparent" : "rgba(249,115,22,0.30)" }}>
                  <div className="text-[10px] t-muted">Día {d} {esReal ? "· real" : ""}</div>
                  {esReal ? (
                    <div className="w-full mt-0.5 px-1 py-0.5 text-xs text-center font-semibold t-secondary">{fmt(realByDay.get(d) || 0)}</div>
                  ) : (
                    <input type="number" min={0} value={planFor(d)}
                      onChange={(e) => setOverrides((o) => ({ ...o, [d]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-full mt-0.5 px-1 py-0.5 rounded border bg-transparent t-primary text-xs text-center font-semibold" style={{ borderColor: "var(--bg-card-border)" }} />
                  )}
                </div>
              );
            })}
          </div>
          {Object.keys(overrides).length > 0 && (
            <button onClick={() => setOverrides({})} className="mt-2 text-[11px] underline t-muted hover:text-orange-400">
              limpiar ajustes por día (volver al ritmo {fmt(effectiveBase)}/día)
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] t-muted">
        Es un simulador: no modifica los datos reales cargados. La proyección = real acumulado + el plan que definas para los días restantes.
      </p>
    </div>
  );
}
