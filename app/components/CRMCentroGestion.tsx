"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Entity = "dropshipper" | "proveedor" | "marca";
type Canal = "Llamada" | "WhatsApp" | "Email" | "Reunión" | "Visita" | "Otro";
type State = "Pendiente" | "En proceso" | "Cerrado" | "Alerta";
type Nivel = "Alto" | "Medio" | "Bajo" | "Potencial";

interface Interaccion {
  id: string;
  country: "ar" | "py";
  entity_type: Entity;
  entity_name: string;
  entity_dropi_id?: string | null;
  canal: Canal;
  resumen: string;
  oportunidades: string;
  compromisos: string;
  observaciones: string;
  fecha_proximo: string | null;
  state: State;
  state_context: string;
  es_alerta: boolean;
  score: number | null;
  nivel_volumen: Nivel | null;
  comercial_asignado: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

const CANALES: Canal[] = ["Llamada", "WhatsApp", "Email", "Reunión", "Visita", "Otro"];
const ESTADOS: State[] = ["Pendiente", "En proceso", "Cerrado", "Alerta"];
const NIVELES: Nivel[] = ["Alto", "Medio", "Bajo", "Potencial"];

const STATE_COLORS: Record<State, string> = {
  Pendiente: "#f59e0b",
  "En proceso": "#0891b2",
  Cerrado: "#10b981",
  Alerta: "#dc2626",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CRMCentroGestion({ country }: { country: "ar" | "py" }) {
  const [rows, setRows] = useState<Interaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filtros del historial
  const [search, setSearch] = useState("");
  const [fEntity, setFEntity] = useState<"all" | Entity>("all");
  const [fState, setFState] = useState<"all" | State>("all");
  const [fComercial, setFComercial] = useState<"all" | string>("all");
  const [fVencimiento, setFVencimiento] = useState<"all" | "vencidos" | "proximos">("all");

  // Entidades sugeridas (DS + Prov del snapshot Comercial)
  const [entidades, setEntidades] = useState<{ name: string; type: Entity; dropiId?: string }[]>([]);

  // Form de nueva interacción
  const [form, setForm] = useState({
    entity_type: "dropshipper" as Entity,
    entity_name: "",
    entity_dropi_id: "",
    canal: "WhatsApp" as Canal,
    resumen: "",
    oportunidades: "",
    compromisos: "",
    observaciones: "",
    fecha_proximo: "",
    state: "Pendiente" as State,
    state_context: "",
    es_alerta: false,
    score: 3 as number,
    nivel_volumen: "Medio" as Nivel,
    comercial_asignado: "",
  });

  const [editId, setEditId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ country });
      const res = await fetch(`/api/data/crm?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
      } else if (res.status === 401) {
        setError("Sesión expirada. Volvé a iniciar sesión.");
      }
    } catch {
      setError("Error al cargar interacciones");
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cargar entidades sugeridas de operational_snapshots
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/data/operational?country=${country}&mes=abril`).then(r => r.json()).catch(() => null),
      fetch(`/api/data/operational?country=${country}&mes=mayo`).then(r => r.json()).catch(() => null),
    ]).then(([abr, may]) => {
      if (cancelled) return;
      const map = new Map<string, { name: string; type: Entity; dropiId?: string }>();
      const ingest = (snap: any) => {
        if (!snap?.data) return;
        for (const r of (snap.data.by_dropshipper || [])) {
          const k = `ds:${r.nombre}`;
          if (!map.has(k)) {
            const m = String(r.nombre).match(/\((\d+)\)\s*$/);
            map.set(k, { name: r.nombre, type: "dropshipper", dropiId: m?.[1] });
          }
        }
        for (const r of (snap.data.by_proveedor || [])) {
          const k = `prov:${r.nombre}`;
          if (!map.has(k)) {
            const m = String(r.nombre).match(/\((\d+)\)\s*$/);
            map.set(k, { name: r.nombre, type: "proveedor", dropiId: m?.[1] || (r.id ? String(r.id) : undefined) });
          }
        }
      };
      ingest(abr); ingest(may);
      setEntidades(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => { cancelled = true; };
  }, [country]);

  const handleEntityName = (v: string) => {
    setForm((f) => ({ ...f, entity_name: v }));
    const match = entidades.find((e) => e.name.toLowerCase() === v.toLowerCase());
    if (match) {
      setForm((f) => ({ ...f, entity_name: match.name, entity_type: match.type, entity_dropi_id: match.dropiId || "" }));
    }
  };

  const presetFecha = (preset: "semana" | "15" | "30") => {
    const days = preset === "semana" ? 7 : preset === "15" ? 15 : 30;
    setForm((f) => ({ ...f, fecha_proximo: addDays(todayIso(), days) }));
  };

  const resetForm = () => {
    setForm({
      entity_type: "dropshipper", entity_name: "", entity_dropi_id: "",
      canal: "WhatsApp", resumen: "", oportunidades: "", compromisos: "",
      observaciones: "", fecha_proximo: "", state: "Pendiente", state_context: "",
      es_alerta: false, score: 3, nivel_volumen: "Medio", comercial_asignado: "",
    });
    setEditId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.entity_name.trim()) { setError("Entidad requerida"); return; }
    setSaving(true);
    try {
      const payload = { country, ...form, score: Number(form.score) || null };
      const url = "/api/data/crm";
      const method = editId ? "PUT" : "POST";
      const body = editId ? { id: editId, ...payload } : payload;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al guardar"); return; }
      setSuccess(editId ? "Interacción actualizada" : "Interacción guardada");
      resetForm();
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: Interaccion) => {
    setEditId(r.id);
    setForm({
      entity_type: r.entity_type, entity_name: r.entity_name, entity_dropi_id: r.entity_dropi_id || "",
      canal: r.canal, resumen: r.resumen, oportunidades: r.oportunidades, compromisos: r.compromisos,
      observaciones: r.observaciones, fecha_proximo: r.fecha_proximo || "", state: r.state,
      state_context: r.state_context, es_alerta: r.es_alerta, score: r.score ?? 3,
      nivel_volumen: (r.nivel_volumen || "Medio") as Nivel, comercial_asignado: r.comercial_asignado || "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta interacción? No se puede deshacer.")) return;
    try {
      const res = await fetch("/api/data/crm", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setSuccess("Eliminada"); setTimeout(() => setSuccess(""), 2500);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "No se pudo eliminar");
      }
    } catch { setError("Error de red al eliminar"); }
  };

  // Derived data
  const comerciales = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.comercial_asignado && s.add(r.comercial_asignado));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const today = todayIso();
    return rows.filter((r) => {
      if (fEntity !== "all" && r.entity_type !== fEntity) return false;
      if (fState !== "all" && r.state !== fState) return false;
      if (fComercial !== "all" && r.comercial_asignado !== fComercial) return false;
      if (search && !r.entity_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (fVencimiento === "vencidos") {
        if (!r.fecha_proximo || r.fecha_proximo >= today || r.state === "Cerrado") return false;
      } else if (fVencimiento === "proximos") {
        if (!r.fecha_proximo || r.state === "Cerrado") return false;
        if (r.fecha_proximo < today || r.fecha_proximo > addDays(today, 7)) return false;
      }
      return true;
    });
  }, [rows, fEntity, fState, fComercial, search, fVencimiento]);

  const kpis = useMemo(() => {
    const today = todayIso();
    return {
      total: rows.length,
      pendientes: rows.filter((r) => r.state === "Pendiente").length,
      enProceso: rows.filter((r) => r.state === "En proceso").length,
      cerrados: rows.filter((r) => r.state === "Cerrado").length,
      alertas: rows.filter((r) => r.es_alerta || r.state === "Alerta").length,
      vencidos: rows.filter((r) => r.fecha_proximo && r.fecha_proximo < today && r.state !== "Cerrado").length,
      proximos7: rows.filter((r) => r.fecha_proximo && r.fecha_proximo >= today && r.fecha_proximo <= addDays(today, 7) && r.state !== "Cerrado").length,
    };
  }, [rows]);

  const isVencido = (r: Interaccion) => !!r.fecha_proximo && r.fecha_proximo < todayIso() && r.state !== "Cerrado";

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiBox label="Total" value={kpis.total} color="#06b6d4" />
        <KpiBox label="Pendientes" value={kpis.pendientes} color="#f59e0b" />
        <KpiBox label="En proceso" value={kpis.enProceso} color="#0891b2" />
        <KpiBox label="Cerrados" value={kpis.cerrados} color="#10b981" />
        <KpiBox label="🚨 Alertas" value={kpis.alertas} color="#dc2626" />
        <KpiBox label="⏰ Vencidos" value={kpis.vencidos} color="#dc2626" highlight={kpis.vencidos > 0} />
        <KpiBox label="📅 Próximos 7d" value={kpis.proximos7} color="#f97316" />
      </div>

      {kpis.vencidos > 0 && (
        <div className="rounded-lg p-3 border border-red-500/40 text-xs text-red-300" style={{ background: "rgba(220,38,38,0.08)" }}>
          ⚠️ Tenés <strong>{kpis.vencidos} compromiso(s) vencido(s)</strong> sin cerrar. Filtralos arriba para gestionarlos.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* FORM */}
        <form onSubmit={handleSubmit} className="rounded-xl p-4 border border-cyan-500/20 space-y-3" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold t-primary">{editId ? "✏️ Editar interacción" : "✍️ Nueva interacción"}</h3>
            {editId && (
              <button type="button" onClick={resetForm} className="text-[11px] text-gray-400 underline">Cancelar edición</button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value as Entity })}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none">
              <option value="dropshipper">👤 Dropshipper</option>
              <option value="proveedor">📦 Proveedor</option>
              <option value="marca">🏷️ Marca</option>
            </select>
            <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as Canal })}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none">
              {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <input list="crm-entidades" type="text" placeholder="Nombre del Dropshipper / Proveedor / Marca"
              value={form.entity_name} onChange={(e) => handleEntityName(e.target.value)}
              className="w-full text-xs px-2 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500" />
            <datalist id="crm-entidades">
              {entidades.filter((e) => e.type === form.entity_type).slice(0, 200).map((e) => (
                <option key={`${e.type}:${e.name}`} value={e.name} />
              ))}
            </datalist>
            {form.entity_dropi_id && (
              <p className="text-[10px] t-muted mt-1">ID Dropi: <span className="font-mono text-cyan-300">{form.entity_dropi_id}</span></p>
            )}
          </div>

          <textarea placeholder="📝 Resumen — qué se conversó" value={form.resumen}
            onChange={(e) => setForm({ ...form, resumen: e.target.value })} rows={3}
            className="w-full text-xs px-2 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500" />
          <textarea placeholder="📌 Oportunidades detectadas" value={form.oportunidades}
            onChange={(e) => setForm({ ...form, oportunidades: e.target.value })} rows={2}
            className="w-full text-xs px-2 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500" />
          <textarea placeholder="🤝 Compromisos acordados" value={form.compromisos}
            onChange={(e) => setForm({ ...form, compromisos: e.target.value })} rows={2}
            className="w-full text-xs px-2 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500" />
          <textarea placeholder="🗒️ Observaciones (opcional)" value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={1}
            className="w-full text-xs px-2 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500" />

          <div className="space-y-2 p-3 rounded-lg border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
            <p className="text-[10px] t-muted uppercase tracking-wider">Próximo seguimiento</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => presetFecha("semana")} className="text-[10px] px-2 py-1 rounded border border-gray-700 hover:border-orange-500/50 t-secondary">Próxima semana</button>
              <button type="button" onClick={() => presetFecha("15")} className="text-[10px] px-2 py-1 rounded border border-gray-700 hover:border-orange-500/50 t-secondary">15 días</button>
              <button type="button" onClick={() => presetFecha("30")} className="text-[10px] px-2 py-1 rounded border border-gray-700 hover:border-orange-500/50 t-secondary">30 días</button>
              <input type="date" value={form.fecha_proximo} onChange={(e) => setForm({ ...form, fecha_proximo: e.target.value })}
                className="text-[11px] px-2 py-1 rounded border border-gray-700 bg-transparent t-primary outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] t-muted uppercase block mb-1">Estado</label>
              <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as State })}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] t-muted uppercase block mb-1">Score (1-5)</label>
              <input type="number" min={1} max={5} value={form.score}
                onChange={(e) => setForm({ ...form, score: Number(e.target.value) })}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] t-muted uppercase block mb-1">Nivel volumen</label>
              <select value={form.nivel_volumen} onChange={(e) => setForm({ ...form, nivel_volumen: e.target.value as Nivel })}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none">
                {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] t-muted uppercase block mb-1">Comercial</label>
              <input type="text" value={form.comercial_asignado} placeholder="(yo)" onChange={(e) => setForm({ ...form, comercial_asignado: e.target.value })}
                className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none" />
            </div>
          </div>

          <input type="text" placeholder="Motivo / contexto del estado (opcional)" value={form.state_context}
            onChange={(e) => setForm({ ...form, state_context: e.target.value })}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary outline-none" />

          <label className="flex items-center gap-2 text-xs t-primary cursor-pointer">
            <input type="checkbox" checked={form.es_alerta} onChange={(e) => setForm({ ...form, es_alerta: e.target.checked })} className="accent-red-500" />
            🚨 Marcar como alerta (caso crítico)
          </label>

          {error && <p className="text-[11px] text-red-400">{error}</p>}
          {success && <p className="text-[11px] text-green-400">{success}</p>}

          <button type="submit" disabled={saving} className="w-full px-4 py-2.5 rounded-lg dropi-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? "Guardando..." : editId ? "Guardar cambios" : "Guardar interacción"}
          </button>
        </form>

        {/* HISTORIAL */}
        <div className="rounded-xl p-4 border border-cyan-500/20 space-y-3" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold t-primary">📜 Historial ({filtered.length})</h3>
          </div>

          {/* Filtros */}
          <div className="space-y-2 p-2 rounded-lg" style={{ background: "var(--bg-input)" }}>
            <input type="text" placeholder="🔍 Buscar por nombre (copiá+pegá)" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500" />
            <div className="grid grid-cols-2 gap-2">
              <select value={fEntity} onChange={(e) => setFEntity(e.target.value as any)} className="text-[11px] px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none">
                <option value="all">Todos los tipos</option>
                <option value="dropshipper">Dropshipper</option>
                <option value="proveedor">Proveedor</option>
                <option value="marca">Marca</option>
              </select>
              <select value={fState} onChange={(e) => setFState(e.target.value as any)} className="text-[11px] px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none">
                <option value="all">Todos los estados</option>
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={fComercial} onChange={(e) => setFComercial(e.target.value)} className="text-[11px] px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none">
                <option value="all">Todos los comerciales</option>
                {comerciales.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={fVencimiento} onChange={(e) => setFVencimiento(e.target.value as any)} className="text-[11px] px-2 py-1.5 rounded border border-gray-700 bg-transparent t-primary outline-none">
                <option value="all">Cualquier vencimiento</option>
                <option value="vencidos">⏰ Vencidos</option>
                <option value="proximos">📅 Próximos 7 días</option>
              </select>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {loading && <p className="text-xs t-muted">Cargando...</p>}
            {!loading && filtered.length === 0 && <p className="text-xs t-muted">No hay interacciones que coincidan con los filtros.</p>}
            {filtered.map((r) => {
              const vencido = isVencido(r);
              return (
                <div key={r.id} className={`rounded-lg p-3 border ${vencido ? "border-red-500/40" : "border-cyan-500/10"}`}
                  style={{ background: vencido ? "rgba(220,38,38,0.06)" : "var(--bg-input)" }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-orange-400 truncate" title={r.entity_name}>
                        {r.entity_type === "dropshipper" ? "👤" : r.entity_type === "proveedor" ? "📦" : "🏷️"} {r.entity_name}
                      </p>
                      <p className="text-[10px] t-muted">
                        Por: {r.created_by_name || "—"} · {fmtDateTime(r.created_at)} · {r.canal}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: STATE_COLORS[r.state] + "20", color: STATE_COLORS[r.state] }}>
                        {r.state}
                      </span>
                      {r.score && <span className="text-[10px] t-muted">{r.score}/5 ⭐</span>}
                    </div>
                  </div>
                  {r.resumen && <p className="text-[11px] t-secondary mt-1">📝 {r.resumen}</p>}
                  {r.oportunidades && <p className="text-[11px] mt-0.5" style={{ color: "#ec4899" }}>📌 {r.oportunidades}</p>}
                  {r.compromisos && <p className="text-[11px] mt-0.5" style={{ color: "#10b981" }}>🤝 {r.compromisos}</p>}
                  {r.observaciones && <p className="text-[11px] t-muted mt-0.5">🗒️ {r.observaciones}</p>}
                  {r.state_context && <p className="text-[10px] t-muted mt-0.5 italic">→ {r.state_context}</p>}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/30">
                    <div className="flex items-center gap-2 text-[10px] t-muted">
                      {r.fecha_proximo && (
                        <span className={vencido ? "text-red-400 font-bold" : ""}>
                          {vencido ? "⏰ Vencido: " : "📅 Próximo: "}{fmtDate(r.fecha_proximo)}
                        </span>
                      )}
                      {r.es_alerta && <span className="text-red-400 font-bold">🚨 ALERTA</span>}
                      {r.nivel_volumen && <span>· {r.nivel_volumen}</span>}
                      {r.comercial_asignado && <span>· {r.comercial_asignado}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(r)} className="text-[10px] text-orange-400 hover:underline">Editar</button>
                      <button onClick={() => handleDelete(r.id)} className="text-[10px] text-red-400 hover:underline">Eliminar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiBox({ label, value, color, highlight = false }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? "border-red-500/50 shadow-lg shadow-red-500/10" : "border-cyan-500/10"}`}
      style={{ background: "var(--bg-card)" }}>
      <p className="text-[10px] t-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value.toLocaleString("es-AR")}</p>
    </div>
  );
}
