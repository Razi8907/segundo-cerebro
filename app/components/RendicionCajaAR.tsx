"use client";

// ═══════════════════════════════════════════════════════════════════
// Rendición de caja mensual — Argentina.
// Sigue al mes elegido en el selector de arriba (un mes o un trimestre).
// Se alimenta del Excel "CAJA <MES> 2026.xlsx" de la Gerencia Administrativa.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState } from "react";
import { MES_LABELS, type MesKey, type RendicionCaja, type RendicionMovimiento } from "../lib/finanzas-ar-types";
import { parseRendicionCaja, type RendicionParseada } from "../lib/rendicion-caja-parse";

const ORANGE = "#E8692A";
const BLUE = "#2F5597";
const GREEN = "#10B981";
const RED = "#EF4444";

const ars = (v: number) => `$ ${Math.round(v).toLocaleString("es-AR")}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fecha = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "varios");

const ORDEN: MesKey[] = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

interface Props {
  rendiciones: Partial<Record<MesKey, RendicionCaja>>;
  mesKeys: MesKey[];      // meses del período elegido arriba
  periodoLabel: string;   // "Agosto 2026", "Q3 2026 (Jul-Sep)"
  canEdit: boolean;
  onSave: (mes: MesKey, r: RendicionCaja) => Promise<{ ok: boolean; error?: string }>;
}

export default function RendicionCajaAR({ rendiciones, mesKeys, periodoLabel, canEdit, onSave }: Props) {
  const cargados = mesKeys.filter((m) => rendiciones[m]);
  const faltan = mesKeys.filter((m) => !rendiciones[m]);

  const agg = useMemo(() => {
    if (cargados.length === 0) return null;
    const first = rendiciones[cargados[0]]!;
    const last = rendiciones[cargados[cargados.length - 1]]!;
    const movs: (RendicionMovimiento & { mes: MesKey })[] = cargados.flatMap((m) => rendiciones[m]!.movimientos.map((x) => ({ ...x, mes: m })));
    const total = movs.reduce((s, m) => s + m.monto, 0);
    const fijos = movs.filter((m) => m.tipo === "fijo").reduce((s, m) => s + m.monto, 0);
    const porGrupo = new Map<string, number>();
    for (const m of movs) porGrupo.set(m.grupo, (porGrupo.get(m.grupo) ?? 0) + m.monto);
    const grupos = [...porGrupo.entries()].map(([grupo, monto]) => ({ grupo, monto })).sort((a, b) => b.monto - a.monto);
    const porMes = cargados.map((m) => {
      const r = rendiciones[m]!;
      const t = r.movimientos.reduce((s, x) => s + x.monto, 0);
      const f = r.movimientos.filter((x) => x.tipo === "fijo").reduce((s, x) => s + x.monto, 0);
      return { m, total: t, fijos: f, variables: t - f, saldoFinal: r.saldoFinal.efectivo + r.saldoFinal.banco };
    });
    return {
      ini: first.saldoInicial, fin: last.saldoFinal, banco: last.banco, fondos: cargados.reduce((s, m) => s + (rendiciones[m]!.fondosRecibidos || 0), 0),
      movs, total, fijos, variables: total - fijos, grupos, porMes,
    };
  }, [rendiciones, cargados.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold t-primary">🧾 Rendición de caja — {periodoLabel}</h3>
          <p className="text-[11px] t-muted">
            {cargados.length > 0 ? `Meses cargados: ${cargados.map((m) => MES_LABELS[m]).join(", ")}` : "Sin rendición cargada para este período"}
            {cargados.length > 0 && faltan.length > 0 && ` · Sin cargar: ${faltan.map((m) => MES_LABELS[m]).join(", ")}`}
          </p>
        </div>
        {canEdit && <UploadRendicion defaultMes={faltan[0] ?? mesKeys[mesKeys.length - 1]} existentes={rendiciones} onSave={onSave} />}
      </div>

      {!agg && (
        <div className="glass-card p-8 text-center">
          <div className="text-3xl mb-2">🗂️</div>
          <p className="text-sm t-secondary">Todavía no hay rendición de caja para {periodoLabel}.</p>
          <p className="text-[11px] t-muted mt-1">
            {canEdit ? "Subí el Excel \"CAJA <MES> 2026.xlsx\" con el botón de arriba." : "Pedile a la Gerencia Administrativa que la cargue."}
          </p>
        </div>
      )}

      {agg && (
        <>
          {/* Saldos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SaldoCard titulo="Saldo inicial" total={agg.ini.efectivo + agg.ini.banco} efectivo={agg.ini.efectivo} banco={agg.ini.banco} bancoLabel={agg.banco} color={BLUE} />
            <div className="glass-card p-5 text-center" style={{ borderTop: `4px solid ${ORANGE}` }}>
              <div className="text-[11px] t-muted uppercase tracking-wider font-semibold">Total egresos</div>
              <div className="font-mono text-2xl font-bold t-primary mt-2">{ars(agg.total)}</div>
              <div className="text-[11px] t-muted mt-1">ARS{agg.fondos > 0 ? ` · Fondos recibidos ${ars(agg.fondos)}` : ""}</div>
            </div>
            <SaldoCard titulo="Saldo final" total={agg.fin.efectivo + agg.fin.banco} efectivo={agg.fin.efectivo} banco={agg.fin.banco} bancoLabel={agg.banco} color={BLUE} />
          </div>

          {/* Fijos vs variables */}
          <div className="glass-card p-5 space-y-4">
            <h4 className="text-sm font-semibold t-primary">Composición del gasto — fijos vs. variables / extraordinarios</h4>
            <div className="flex h-9 rounded-lg overflow-hidden text-xs font-semibold text-white">
              <div className="flex items-center justify-center" style={{ width: `${(agg.fijos / agg.total) * 100}%`, background: BLUE }}>{pct(agg.fijos / agg.total)} Fijos</div>
              <div className="flex items-center justify-center" style={{ width: `${(agg.variables / agg.total) * 100}%`, background: ORANGE, minWidth: 90 }}>{pct(agg.variables / agg.total)} Variables</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg p-4" style={{ background: `${BLUE}14` }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BLUE }}>Gastos fijos</div>
                <div className="font-mono text-xl font-bold" style={{ color: BLUE }}>{ars(agg.fijos)} <span className="text-sm">{pct(agg.fijos / agg.total)}</span></div>
                <div className="text-[11px] t-muted">Compromisos recurrentes de pago mensual</div>
              </div>
              <div className="rounded-lg p-4" style={{ background: `${ORANGE}14` }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ORANGE }}>Gastos variables</div>
                <div className="font-mono text-xl font-bold" style={{ color: ORANGE }}>{ars(agg.variables)} <span className="text-sm">{pct(agg.variables / agg.total)}</span></div>
                <div className="text-[11px] t-muted">No recurrentes del período</div>
              </div>
            </div>
          </div>

          {/* Comparativo mensual (solo trimestre con más de un mes) */}
          {agg.porMes.length > 1 && (
            <div className="glass-card overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 t-muted uppercase text-[10px] tracking-wider">
                    <th className="text-left py-3 px-4">Mes</th>
                    <th className="text-right py-3 px-4">Egresos</th>
                    <th className="text-right py-3 px-4">Fijos</th>
                    <th className="text-right py-3 px-4">Variables</th>
                    <th className="text-right py-3 px-4">Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.porMes.map((r) => (
                    <tr key={r.m} className="border-b border-gray-800/50">
                      <td className="py-2 px-4 font-semibold t-primary">{MES_LABELS[r.m]}</td>
                      <td className="py-2 px-4 text-right font-mono t-primary">{ars(r.total)}</td>
                      <td className="py-2 px-4 text-right font-mono" style={{ color: BLUE }}>{ars(r.fijos)}</td>
                      <td className="py-2 px-4 text-right font-mono" style={{ color: ORANGE }}>{ars(r.variables)}</td>
                      <td className="py-2 px-4 text-right font-mono" style={{ color: GREEN }}>{ars(r.saldoFinal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Egresos por grupo */}
          <div className="glass-card p-5">
            <h4 className="text-sm font-semibold t-primary mb-3">Egresos por grupo</h4>
            <div className="space-y-1.5">
              {agg.grupos.map((g) => {
                const p = g.monto / agg.total;
                return (
                  <div key={g.grupo} className="flex items-center gap-3 text-xs">
                    <div className="w-40 sm:w-64 t-secondary truncate" title={g.grupo}>{g.grupo}</div>
                    <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: "rgba(148,163,184,0.12)" }}>
                      <div className="h-full" style={{ width: `${p * 100}%`, background: ORANGE }} />
                    </div>
                    <div className="w-28 text-right font-mono font-semibold t-primary">{ars(g.monto)}</div>
                    <div className="w-12 text-right font-mono" style={{ color: ORANGE }}>{pct(p)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <DetalleTabla titulo="Gastos fijos" color={BLUE} movs={agg.movs.filter((m) => m.tipo === "fijo")} total={agg.total} conMes={cargados.length > 1} />
          <DetalleTabla titulo="Gastos variables / extraordinarios" color={ORANGE} movs={agg.movs.filter((m) => m.tipo === "variable")} total={agg.total} conMes={cargados.length > 1} />

          <p className="text-[11px] t-muted leading-relaxed">
            <b>Criterio de registro de sueldos:</b> los sueldos se abonan el último día hábil del mes y se registran como gasto del mes siguiente,
            para mantener un criterio parejo mes a mes (evita duplicar sueldos en el mes de transición).
          </p>
        </>
      )}
    </div>
  );
}

function SaldoCard({ titulo, total, efectivo, banco, bancoLabel, color }: { titulo: string; total: number; efectivo: number; banco: number; bancoLabel: string; color: string }) {
  return (
    <div className="glass-card p-5 text-center" style={{ borderTop: `4px solid ${color}` }}>
      <div className="text-[11px] t-muted uppercase tracking-wider font-semibold">{titulo}</div>
      <div className="font-mono text-2xl font-bold t-primary mt-2">{ars(total)}</div>
      <div className="text-[11px] t-muted">ARS total</div>
      <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-1 text-xs">
        <div className="flex justify-between"><span style={{ color: BLUE }}>Efectivo (Caja)</span><span className="font-mono font-semibold t-primary">{ars(efectivo)}</span></div>
        <div className="flex justify-between"><span style={{ color: ORANGE }}>{bancoLabel}</span><span className="font-mono font-semibold t-primary">{ars(banco)}</span></div>
      </div>
    </div>
  );
}

function DetalleTabla({ titulo, color, movs, total, conMes }: { titulo: string; color: string; movs: (RendicionMovimiento & { mes: MesKey })[]; total: number; conMes: boolean }) {
  const [abierto, setAbierto] = useState(true);
  const sub = movs.reduce((s, m) => s + m.monto, 0);
  const rows = [...movs].sort((a, b) => ORDEN.indexOf(a.mes) - ORDEN.indexOf(b.mes) || (a.fecha ?? "").localeCompare(b.fecha ?? ""));
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setAbierto(!abierto)} className="w-full flex items-center justify-between px-5 py-3 text-left">
        <span className="text-sm font-semibold t-primary">{abierto ? "▾" : "▸"} {titulo} <span className="t-muted font-normal">({movs.length})</span></span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{ars(sub)} · {pct(total > 0 ? sub / total : 0)}</span>
      </button>
      {abierto && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white text-[10px] uppercase tracking-wider" style={{ background: color }}>
                {conMes && <th className="text-left py-2 px-4">Mes</th>}
                <th className="text-left py-2 px-4">Fecha</th>
                <th className="text-left py-2 px-4">Concepto</th>
                <th className="text-right py-2 px-4">Monto ARS</th>
                <th className="text-left py-2 px-4">Grupo</th>
                <th className="text-left py-2 px-4">Origen</th>
                <th className="text-left py-2 px-4">Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={i} className="border-b border-gray-800/40">
                  {conMes && <td className="py-2 px-4 t-muted whitespace-nowrap">{MES_LABELS[m.mes]}</td>}
                  <td className="py-2 px-4 t-muted font-mono">{fecha(m.fecha)}</td>
                  <td className="py-2 px-4 t-primary">{m.concepto}</td>
                  <td className="py-2 px-4 text-right font-mono font-semibold t-primary whitespace-nowrap">{ars(m.monto)}</td>
                  <td className="py-2 px-4 text-[10px] font-semibold whitespace-nowrap" style={{ color }}>{m.grupo}</td>
                  <td className="py-2 px-4 t-muted capitalize">{m.origen}</td>
                  <td className="py-2 px-4 t-muted italic">{m.nota ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Carga del Excel mensual ───
function UploadRendicion({ defaultMes, existentes, onSave }: { defaultMes: MesKey; existentes: Partial<Record<MesKey, RendicionCaja>>; onSave: Props["onSave"] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<RendicionParseada | null>(null);
  const [mes, setMes] = useState<MesKey>(defaultMes);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setError(null); setDone(null);
    try {
      const p = parseRendicionCaja(await f.arrayBuffer(), f.name);
      setParsed(p);
      setMes(p.mes ?? defaultMes);
    } catch (e: any) {
      setError(e?.message || "No se pudo leer el archivo");
      setParsed(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const toggleTipo = (i: number) => {
    if (!parsed) return;
    const movimientos = parsed.rendicion.movimientos.map((m, j) => (j === i ? { ...m, tipo: m.tipo === "fijo" ? "variable" as const : "fijo" as const } : m));
    setParsed({ ...parsed, rendicion: { ...parsed.rendicion, movimientos } });
  };

  const confirmar = async () => {
    if (!parsed) return;
    setSaving(true);
    const res = await onSave(mes, parsed.rendicion);
    setSaving(false);
    if (res.ok) { setDone(`Rendición de ${MES_LABELS[mes]} guardada.`); setParsed(null); }
    else setError(res.error || "Error al guardar");
  };

  const movs = parsed?.rendicion.movimientos ?? [];
  const total = movs.reduce((s, m) => s + m.monto, 0);
  const fijos = movs.filter((m) => m.tipo === "fijo").reduce((s, m) => s + m.monto, 0);
  const cuadra = parsed?.totalEgresosArchivo == null || Math.abs(parsed.totalEgresosArchivo - total) < 1;

  return (
    <>
      <div className="flex items-center gap-2">
        {done && <span className="text-[11px]" style={{ color: GREEN }}>✓ {done}</span>}
        {error && !parsed && <span className="text-[11px]" style={{ color: RED }}>{error}</span>}
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button onClick={() => inputRef.current?.click()} className="text-xs px-3 py-1.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-all">
          ⬆ Subir Excel de caja
        </button>
      </div>

      {parsed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4" style={{ background: "var(--bg-page)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold t-primary">Revisar rendición antes de guardar</h3>
              <label className="text-xs t-secondary flex items-center gap-2">
                Mes
                <select value={mes} onChange={(e) => setMes(e.target.value as MesKey)} className="rounded px-2 py-1 text-xs" style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--bg-card-border)" }}>
                  {ORDEN.map((m) => <option key={m} value={m}>{MES_LABELS[m]}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Mini label="Egresos" value={ars(total)} />
              <Mini label="Fijos" value={`${ars(fijos)} (${pct(total ? fijos / total : 0)})`} />
              <Mini label="Saldo inicial" value={ars(parsed.rendicion.saldoInicial.efectivo + parsed.rendicion.saldoInicial.banco)} />
              <Mini label="Saldo final" value={ars(parsed.rendicion.saldoFinal.efectivo + parsed.rendicion.saldoFinal.banco)} />
            </div>
            {!cuadra && <p className="text-[11px]" style={{ color: RED }}>⚠ La suma de movimientos ({ars(total)}) no coincide con el total del archivo ({ars(parsed.totalEgresosArchivo!)}).</p>}
            {existentes[mes] && <p className="text-[11px]" style={{ color: ORANGE }}>⚠ Ya hay una rendición de {MES_LABELS[mes]}: se va a reemplazar.</p>}
            <p className="text-[11px] t-muted">Tocá la etiqueta Fijo/Variable para corregir la clasificación.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {movs.map((m, i) => (
                    <tr key={i} className="border-b border-gray-800/40">
                      <td className="py-1.5 pr-3 t-muted font-mono">{fecha(m.fecha)}</td>
                      <td className="py-1.5 pr-3 t-primary">{m.concepto}</td>
                      <td className="py-1.5 pr-3 text-[10px] t-muted">{m.grupo}</td>
                      <td className="py-1.5 pr-3 text-right font-mono t-primary whitespace-nowrap">{ars(m.monto)}</td>
                      <td className="py-1.5">
                        <button onClick={() => toggleTipo(i)} className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: m.tipo === "fijo" ? BLUE : ORANGE }}>
                          {m.tipo === "fijo" ? "Fijo" : "Variable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="text-[11px]" style={{ color: RED }}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setParsed(null); setError(null); }} className="text-xs px-4 py-2 rounded-full border border-gray-600 t-secondary">Cancelar</button>
              <button onClick={confirmar} disabled={saving} className="text-xs px-4 py-2 rounded-full bg-orange-500 text-white disabled:opacity-50">
                {saving ? "Guardando…" : `Guardar ${MES_LABELS[mes]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: "var(--bg-card)" }}>
      <div className="text-[10px] t-muted uppercase">{label}</div>
      <div className="font-mono font-semibold t-primary">{value}</div>
    </div>
  );
}
