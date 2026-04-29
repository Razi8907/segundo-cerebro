"use client";

import { useState } from "react";
import type { FinanzasARData, MesData, MesKey, Liquidacion, GastoBreakdown } from "../lib/finanzas-ar-types";
import { MES_LABELS } from "../lib/finanzas-ar-types";

interface Props {
  initial: FinanzasARData;
  saving: boolean;
  onCancel: () => void;
  onSave: (next: FinanzasARData) => Promise<{ ok: boolean; error?: string }>;
}

export default function FinanzasEditor({ initial, saving, onCancel, onSave }: Props) {
  const [data, setData] = useState<FinanzasARData>(JSON.parse(JSON.stringify(initial)));
  const [section, setSection] = useState<"meses" | "caja" | "liquidaciones" | "gastos" | "deuda">("meses");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const mesKeys = Object.keys(data.meses) as MesKey[];

  const updateMes = (k: MesKey, field: keyof MesData, value: number | string) => {
    setData({ ...data, meses: { ...data.meses, [k]: { ...data.meses[k]!, [field]: value } } });
  };

  const addMes = () => {
    const used = new Set(mesKeys);
    const candidate = (["may", "jun", "jul", "ago", "sep", "oct", "nov", "dic", "ene", "feb", "mar", "abr"] as MesKey[]).find((m) => !used.has(m));
    if (!candidate) return;
    setData({
      ...data,
      meses: {
        ...data.meses,
        [candidate]: {
          label: MES_LABELS[candidate],
          movilizadas: 0, fleteCod: 0, comisionCod: 0, fleteFf: 0,
          egrFijos: 0, egrVar: 0,
          ffEntregadas: 0, ffNoEntregadas: 0, ffPrecioEnt: 1500, ffPrecioNoEnt: 750,
        },
      },
    });
  };

  const removeMes = (k: MesKey) => {
    const next = { ...data.meses };
    delete next[k];
    setData({ ...data, meses: next });
  };

  const updateLiq = (idx: number, field: keyof Liquidacion, value: number | string | null) => {
    const next = [...data.liquidaciones];
    next[idx] = { ...next[idx], [field]: value } as Liquidacion;
    setData({ ...data, liquidaciones: next });
  };

  const addLiq = () => {
    setData({
      ...data,
      liquidaciones: [...data.liquidaciones, { periodo: "Nuevo período", ordenes: null, bruto: null, fixy: null, neto: null, estado: "conciliar", deposito: "Pendiente" }],
    });
  };

  const removeLiq = (idx: number) => {
    setData({ ...data, liquidaciones: data.liquidaciones.filter((_, i) => i !== idx) });
  };

  const updateGasto = (idx: number, field: keyof GastoBreakdown, value: number | string) => {
    const next = [...data.gastosBreakdownYtd];
    next[idx] = { ...next[idx], [field]: value } as GastoBreakdown;
    setData({ ...data, gastosBreakdownYtd: next });
  };

  const addGasto = () => {
    setData({ ...data, gastosBreakdownYtd: [...data.gastosBreakdownYtd, { concepto: "Nuevo gasto", monto: 0 }] });
  };

  const removeGasto = (idx: number) => {
    setData({ ...data, gastosBreakdownYtd: data.gastosBreakdownYtd.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    setErrMsg(null);
    const res = await onSave(data);
    if (!res.ok) setErrMsg(res.error || "Error al guardar");
  };

  const sectionTabs: { key: typeof section; label: string }[] = [
    { key: "meses", label: "📅 Meses" },
    { key: "caja", label: "💰 Caja" },
    { key: "liquidaciones", label: "🏦 Liquidaciones" },
    { key: "gastos", label: "📋 Gastos YTD" },
    { key: "deuda", label: "⚠ Deuda" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onCancel}>
      <div className="w-full max-w-3xl h-full overflow-y-auto" style={{ background: "var(--bg-page, #1a1a2e)" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-700 flex items-center justify-between" style={{ background: "var(--bg-page, #1a1a2e)" }}>
          <div>
            <h2 className="text-lg font-bold t-primary">Editar datos financieros</h2>
            <p className="text-[11px] t-muted">Cambiá los valores y guardá. Se sincroniza con todos los usuarios al instante.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="text-xs px-3 py-2 rounded border border-gray-700 t-secondary hover:border-gray-500">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="text-xs px-4 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50">
              {saving ? "Guardando..." : "💾 Guardar"}
            </button>
          </div>
        </div>

        {errMsg && (
          <div className="mx-6 mt-4 p-3 rounded bg-red-500/15 border border-red-500/30 text-xs text-red-300">
            {errMsg}
          </div>
        )}

        {/* Sub-nav secciones */}
        <div className="px-6 pt-4 flex flex-wrap gap-2">
          {sectionTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setSection(t.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                section === t.key
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* SECCIÓN: MESES */}
          {section === "meses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs t-muted">Datos por mes — ingreso Dropi (flete COD + comisión + flete FF), egresos, fulfillment</p>
                <button onClick={addMes} className="text-xs px-3 py-1.5 rounded border border-dashed border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                  + Agregar mes
                </button>
              </div>
              {mesKeys.map((k) => {
                const m = data.meses[k]!;
                return (
                  <div key={k} className="glass-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold t-primary">{m.label}</h3>
                      <button onClick={() => removeMes(k)} className="text-[11px] text-red-400 hover:text-red-300">
                        🗑 Quitar mes
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <NumField label="Movilizadas" value={m.movilizadas} onChange={(v) => updateMes(k, "movilizadas", v)} />
                      <NumField label="Flete COD ($)" value={m.fleteCod} onChange={(v) => updateMes(k, "fleteCod", v)} />
                      <NumField label="Comisión COD ($)" value={m.comisionCod} onChange={(v) => updateMes(k, "comisionCod", v)} />
                      <NumField label="Flete FF ($)" value={m.fleteFf} onChange={(v) => updateMes(k, "fleteFf", v)} />
                      <NumField label="Egresos fijos ($)" value={m.egrFijos} onChange={(v) => updateMes(k, "egrFijos", v)} />
                      <NumField label="Egresos variables ($)" value={m.egrVar} onChange={(v) => updateMes(k, "egrVar", v)} />
                      <NumField label="FF entregadas" value={m.ffEntregadas} onChange={(v) => updateMes(k, "ffEntregadas", v)} />
                      <NumField label="FF no entregadas" value={m.ffNoEntregadas} onChange={(v) => updateMes(k, "ffNoEntregadas", v)} />
                      <NumField label="FF precio entregada" value={m.ffPrecioEnt} onChange={(v) => updateMes(k, "ffPrecioEnt", v)} />
                      <NumField label="FF precio no entregada" value={m.ffPrecioNoEnt} onChange={(v) => updateMes(k, "ffPrecioNoEnt", v)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SECCIÓN: CAJA */}
          {section === "caja" && (
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold t-primary mb-2">Saldos de caja al día de hoy</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <NumField label="Banco BBVA ($)" value={data.caja.bbva} onChange={(v) => setData({ ...data, caja: { ...data.caja, bbva: v } })} />
                <NumField label="Caja efectivo ($)" value={data.caja.efectivo} onChange={(v) => setData({ ...data, caja: { ...data.caja, efectivo: v } })} />
                <NumField label="Fixy retenido confirmado ($)" value={data.caja.fixyConfirmado} onChange={(v) => setData({ ...data, caja: { ...data.caja, fixyConfirmado: v } })} />
                <NumField label="Fixy pendiente estimado ($)" value={data.caja.fixyPendienteEst} onChange={(v) => setData({ ...data, caja: { ...data.caja, fixyPendienteEst: v } })} />
              </div>
              <p className="text-[11px] t-muted mt-2">El total líquido (BBVA + Efectivo) se calcula automáticamente. El runway depende de estos valores.</p>
            </div>
          )}

          {/* SECCIÓN: LIQUIDACIONES */}
          {section === "liquidaciones" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs t-muted">Estado quincena por quincena de las cobranzas Fixy/Urbano</p>
                <button onClick={addLiq} className="text-xs px-3 py-1.5 rounded border border-dashed border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                  + Agregar liquidación
                </button>
              </div>
              {data.liquidaciones.map((l, i) => (
                <div key={i} className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={l.periodo}
                      onChange={(e) => updateLiq(i, "periodo", e.target.value)}
                      className="text-sm font-semibold bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none flex-1 mr-3 t-primary"
                    />
                    <button onClick={() => removeLiq(i)} className="text-[11px] text-red-400 hover:text-red-300 whitespace-nowrap">
                      🗑 Quitar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <NumFieldNullable label="Órdenes" value={l.ordenes} onChange={(v) => updateLiq(i, "ordenes", v)} />
                    <NumFieldNullable label="Recaudo bruto ($)" value={l.bruto} onChange={(v) => updateLiq(i, "bruto", v)} />
                    <NumFieldNullable label="Descuento Fixy ($)" value={l.fixy} onChange={(v) => updateLiq(i, "fixy", v)} />
                    <NumFieldNullable label="Neto Dropi ($)" value={l.neto} onChange={(v) => updateLiq(i, "neto", v)} />
                    <div>
                      <label className="text-[10px] uppercase tracking-wider t-muted block mb-1">Estado</label>
                      <select
                        value={l.estado}
                        onChange={(e) => updateLiq(i, "estado", e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs t-primary focus:border-orange-500 outline-none"
                      >
                        <option value="cobrado">✅ Cobrado</option>
                        <option value="retenido">🔴 Retenido</option>
                        <option value="conciliar">⏳ A conciliar</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider t-muted block mb-1">Depósito / nota</label>
                      <input
                        type="text"
                        value={l.deposito}
                        onChange={(e) => updateLiq(i, "deposito", e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs t-primary focus:border-orange-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SECCIÓN: GASTOS */}
          {section === "gastos" && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold t-primary">Breakdown de gastos YTD</h3>
                <button onClick={addGasto} className="text-xs px-3 py-1.5 rounded border border-dashed border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                  + Agregar
                </button>
              </div>
              <p className="text-[11px] t-muted mb-3">Total acumulado por categoría — usado en el chart de "¿En qué se gastó?"</p>
              {data.gastosBreakdownYtd.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={g.concepto}
                    onChange={(e) => updateGasto(i, "concepto", e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs t-primary focus:border-orange-500 outline-none"
                    placeholder="Concepto"
                  />
                  <input
                    type="number"
                    value={g.monto}
                    onChange={(e) => updateGasto(i, "monto", Number(e.target.value) || 0)}
                    className="w-32 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs t-primary font-mono focus:border-orange-500 outline-none"
                    placeholder="Monto"
                  />
                  <button onClick={() => removeGasto(i)} className="text-[11px] text-red-400 hover:text-red-300 px-2">
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* SECCIÓN: DEUDA */}
          {section === "deuda" && (
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold t-primary">Deuda intercompany & salario Raziel</h3>
              <p className="text-[11px] t-muted">Estos montos no aparecen en el P&L pero impactan el cálculo de runway y los escenarios.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <NumField label="Deuda Colombia ($)" value={data.deuda.colombia} onChange={(v) => setData({ ...data, deuda: { ...data.deuda, colombia: v } })} />
                <NumField label="Deuda Paraguay ($)" value={data.deuda.paraguay} onChange={(v) => setData({ ...data, deuda: { ...data.deuda, paraguay: v } })} />
                <NumField label="Salario Raziel mensual AR ($)" value={data.salarioRazielAr} onChange={(v) => setData({ ...data, salarioRazielAr: v })} />
              </div>
            </div>
          )}
        </div>

        {/* Footer fijo con guardar duplicado para no scrollear arriba */}
        <div className="sticky bottom-0 px-6 py-3 border-t border-gray-700 flex items-center justify-end gap-2" style={{ background: "var(--bg-page, #1a1a2e)" }}>
          <button onClick={onCancel} className="text-xs px-3 py-2 rounded border border-gray-700 t-secondary hover:border-gray-500">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="text-xs px-4 py-2 rounded bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50">
            {saving ? "Guardando..." : "💾 Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider t-muted block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs t-primary font-mono focus:border-orange-500 outline-none"
      />
    </div>
  );
}

function NumFieldNullable({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider t-muted block mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        placeholder="(vacío)"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value) || 0)}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs t-primary font-mono focus:border-orange-500 outline-none"
      />
    </div>
  );
}
