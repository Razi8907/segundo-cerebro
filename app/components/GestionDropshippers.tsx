"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────
interface DsDailyRow { ds: string; dsEmail?: string; dsCelular?: string; fecha: string; ordenes: number }

interface Gestion {
  ds_key: string;
  ds_nombre: string;
  ds_email?: string | null;
  ds_celular?: string | null;
  comercial_asignado?: string | null;
  estado: string;
  nota: string;
  fecha_gestion?: string | null;
  proxima_fecha_contacto?: string | null;
  updated_by_name?: string;
  updated_at?: string;
}

// ────────────────────────────────────────────────────────────────────────
// Niveles por umbral (movilizadas del mes) — definidos por negocio
// ────────────────────────────────────────────────────────────────────────
const NIVELES = [
  { n: 0, label: "Inactivo", emoji: "🔴", color: "#ef4444" },
  { n: 1, label: "Principiante", emoji: "⚪", color: "#94a3b8" },
  { n: 2, label: "Intermedio", emoji: "🟡", color: "#eab308" },
  { n: 3, label: "Nivel 3", emoji: "🟠", color: "#f97316" },
  { n: 4, label: "Experto", emoji: "🟣", color: "#a855f7" },
  { n: 5, label: "Élite", emoji: "🔵", color: "#3b82f6" },
];
function nivelDe(mov: number): number {
  if (mov >= 5000) return 5;
  if (mov >= 900) return 4;
  if (mov >= 300) return 3;
  if (mov >= 100) return 2;
  if (mov >= 1) return 1;
  return 0;
}

const ESTADOS = [
  { v: "contactado", label: "🟢 Contactado", color: "#10b981" },
  { v: "volver_a_contactar", label: "🟡 Volver a contactar", color: "#eab308" },
  { v: "en_seguimiento", label: "🔵 En seguimiento", color: "#3b82f6" },
  { v: "sin_gestionar", label: "🔴 Sin gestionar", color: "#ef4444" },
];
const estadoLabel = (v: string) => ESTADOS.find((e) => e.v === v)?.label || "🔴 Sin gestionar";

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────
const dayOf = (s: string): number => {
  const m = s?.match(/^(\d{1,2})-/);
  return m ? +m[1] : 0;
};
const fmt = (n: number): string => Math.round(n).toLocaleString("es-AR");
const deltaPct = (curr: number, prev: number): number => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};
const digits = (s?: string | null) => (s ? s.replace(/[^0-9]/g, "") : "");
function normKey(email?: string | null, celular?: string | null, nombre?: string): string {
  const e = (email || "").trim().toLowerCase();
  if (e && e.includes("@")) return `e:${e}`;
  const c = digits(celular);
  if (c.length >= 6) return `c:${c}`;
  return `n:${(nombre || "").trim().toLowerCase()}`;
}

interface Agg { nombre: string; email?: string; celular?: string; total: number; byDay: Map<number, number> }
function buildAgg(rows: DsDailyRow[] | undefined): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const r of rows || []) {
    const key = normKey(r.dsEmail, r.dsCelular, r.ds);
    if (!key || key === "n:") continue;
    let a = m.get(key);
    if (!a) { a = { nombre: r.ds || "", email: r.dsEmail, celular: r.dsCelular, total: 0, byDay: new Map() }; m.set(key, a); }
    const d = dayOf(r.fecha);
    const o = r.ordenes || 0;
    a.total += o;
    if (d >= 1) a.byDay.set(d, (a.byDay.get(d) || 0) + o);
    if (!a.email && r.dsEmail) a.email = r.dsEmail;
    if (!a.celular && r.dsCelular) a.celular = r.dsCelular;
    if (!a.nombre && r.ds) a.nombre = r.ds;
  }
  return m;
}

function NivelBadge({ n }: { n: number }) {
  const lv = NIVELES[n] || NIVELES[0];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
      style={{ background: `${lv.color}22`, color: lv.color }}>
      {lv.emoji} N{lv.n} {lv.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════
export default function GestionDropshippers({
  country, realMes, mesPrev, labelMes, labelPrev, diasMes, esMesEnCurso, dsCurDaily, dsPrevDaily,
}: {
  country: "ar" | "py";
  realMes: string; mesPrev: string;
  labelMes: string; labelPrev: string;
  diasMes: number;
  esMesEnCurso: boolean;
  dsCurDaily: DsDailyRow[];
  dsPrevDaily: DsDailyRow[];
}) {
  const [mode, setMode] = useState<"mensual" | "diario">("mensual");
  const hoyDia = new Date().getDate();
  const [diaSel, setDiaSel] = useState<number>(esMesEnCurso ? Math.min(hoyDia, diasMes) : diasMes);

  const [gestionMap, setGestionMap] = useState<Record<string, Gestion>>({});
  const [comerciales, setComerciales] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Filtros
  const [fComercial, setFComercial] = useState("");
  const [fNivel, setFNivel] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fGestionDesde, setFGestionDesde] = useState("");
  const [fProxHasta, setFProxHasta] = useState("");
  const [search, setSearch] = useState("");

  // Notas en edición local (se guardan al salir del campo)
  const [notaDraft, setNotaDraft] = useState<Record<string, string>>({});

  // ── Cargar gestión + comerciales ──
  const fetchGestion = useCallback(async () => {
    try {
      const [g, c] = await Promise.all([
        fetch(`/api/data/dropshipper-gestion?country=${country}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/comerciales`).then((r) => r.json()).catch(() => null),
      ]);
      if (g && Array.isArray(g.rows)) {
        const map: Record<string, Gestion> = {};
        for (const row of g.rows as Gestion[]) map[row.ds_key] = row;
        setGestionMap(map);
      }
      if (c && Array.isArray(c.comerciales)) setComerciales(c.comerciales);
    } catch { /* ignore */ }
  }, [country]);

  useEffect(() => { fetchGestion(); }, [fetchGestion]);

  const curAgg = useMemo(() => buildAgg(dsCurDaily), [dsCurDaily]);
  const prevAgg = useMemo(() => buildAgg(dsPrevDaily), [dsPrevDaily]);

  // ── Guardar (upsert) ──
  const saveGestion = useCallback(async (key: string, agg: Agg, patch: Partial<Gestion>) => {
    const base = gestionMap[key] || {
      ds_key: key, ds_nombre: agg.nombre, ds_email: agg.email, ds_celular: agg.celular,
      comercial_asignado: null, estado: "sin_gestionar", nota: "", fecha_gestion: null, proxima_fecha_contacto: null,
    };
    const merged: Gestion = { ...base, ...patch, ds_key: key, ds_nombre: agg.nombre, ds_email: agg.email, ds_celular: agg.celular };
    setGestionMap((m) => ({ ...m, [key]: merged }));
    setSavingKey(key);
    try {
      await fetch(`/api/data/dropshipper-gestion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ country, ...merged }),
      });
    } finally {
      setSavingKey((k) => (k === key ? null : k));
    }
  }, [gestionMap, country]);

  // ── Filas ──
  const rows = useMemo(() => {
    const keys = new Set<string>([...curAgg.keys(), ...prevAgg.keys()]);
    const out = [];
    for (const key of keys) {
      const cur = curAgg.get(key);
      const prev = prevAgg.get(key);
      const agg: Agg = cur || prev!;
      const movCur = cur?.total || 0;
      const movPrev = prev?.total || 0;
      const nivelCur = nivelDe(movCur);
      const nivelPrev = nivelDe(movPrev);
      const diaCur = cur?.byDay.get(diaSel) || 0;
      const diaPrev = prev?.byDay.get(diaSel) || 0;
      const g = gestionMap[key];
      out.push({
        key, agg,
        nombre: agg.nombre, email: agg.email, celular: agg.celular,
        movCur, movPrev, nivelCur, nivelPrev, diaCur, diaPrev,
        comercial: g?.comercial_asignado || "",
        estado: g?.estado || "sin_gestionar",
        nota: g?.nota || "",
        fecha_gestion: g?.fecha_gestion || "",
        proxima_fecha_contacto: g?.proxima_fecha_contacto || "",
      });
    }
    // Filtros
    let filtered = out.filter((r) => {
      if (fComercial === "__none__" && r.comercial) return false;
      if (fComercial && fComercial !== "__none__" && r.comercial !== fComercial) return false;
      if (fNivel !== "" && String(r.nivelCur) !== fNivel) return false;
      if (fEstado && r.estado !== fEstado) return false;
      if (fGestionDesde && (!r.fecha_gestion || r.fecha_gestion < fGestionDesde)) return false;
      if (fProxHasta && (!r.proxima_fecha_contacto || r.proxima_fecha_contacto > fProxHasta)) return false;
      if (search && !r.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    // Orden: por volumen del modo activo
    filtered = filtered.sort((a, b) => (mode === "diario" ? b.diaCur - a.diaCur : b.movCur - a.movCur));
    return filtered;
  }, [curAgg, prevAgg, gestionMap, diaSel, mode, fComercial, fNivel, fEstado, fGestionDesde, fProxHasta, search]);

  const totalDs = curAgg.size;

  return (
    <div className="glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold t-primary">📋 Gestión de dropshippers — {labelMes} vs {labelPrev}</h3>
          <p className="text-xs t-secondary mt-1">
            Nivel por umbral de movilizadas, cambio de nivel vs {labelPrev}, y gestión comercial editable. {totalDs} dropshippers.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-kpi)" }}>
          {(["mensual", "diario"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${mode === m ? "bg-orange-500 text-white" : "t-secondary hover:text-orange-400"}`}>
              {m === "mensual" ? `Mensual (${labelMes} vs ${labelPrev})` : "Diario (día a día)"}
            </button>
          ))}
        </div>
      </div>

      {mode === "diario" && (
        <div className="mt-3 flex items-center gap-2 text-xs t-secondary">
          <span>Comparar el día</span>
          <input type="number" min={1} max={diasMes} value={diaSel}
            onChange={(e) => setDiaSel(Math.max(1, Math.min(diasMes, Number(e.target.value) || 1)))}
            className="w-16 px-2 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
          <span>de cada mes → <b className="t-primary">{String(diaSel).padStart(2, "0")}/{labelMes}</b> vs <b className="t-primary">{String(diaSel).padStart(2, "0")}/{labelPrev}</b></span>
        </div>
      )}

      {/* Filtros */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <select value={fComercial} onChange={(e) => setFComercial(e.target.value)} className="text-xs px-2 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }}>
          <option value="">Comercial: todos</option>
          <option value="__none__">Sin asignar</option>
          {comerciales.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fNivel} onChange={(e) => setFNivel(e.target.value)} className="text-xs px-2 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }}>
          <option value="">Nivel: todos</option>
          {NIVELES.map((l) => <option key={l.n} value={String(l.n)}>{l.emoji} N{l.n} {l.label}</option>)}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="text-xs px-2 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }}>
          <option value="">Estado: todos</option>
          {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
        </select>
        <label className="text-[10px] t-muted flex flex-col">Gestión desde
          <input type="date" value={fGestionDesde} onChange={(e) => setFGestionDesde(e.target.value)} className="text-xs px-2 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
        </label>
        <label className="text-[10px] t-muted flex flex-col">Próx. contacto hasta
          <input type="date" value={fProxHasta} onChange={(e) => setFProxHasta(e.target.value)} className="text-xs px-2 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
        </label>
        <input type="text" placeholder="Buscar dropshipper…" value={search} onChange={(e) => setSearch(e.target.value)} className="text-xs px-2 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
      </div>

      {(fComercial || fNivel || fEstado || fGestionDesde || fProxHasta || search) && (
        <div className="mt-2 flex items-center gap-2 text-[11px] t-muted">
          <span>{rows.length} resultados</span>
          <button onClick={() => { setFComercial(""); setFNivel(""); setFEstado(""); setFGestionDesde(""); setFProxHasta(""); setSearch(""); }} className="underline hover:text-orange-400">limpiar filtros</button>
        </div>
      )}

      {/* Tabla */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="t-muted text-[11px] uppercase tracking-wider">
              <th className="text-left py-2 pr-3">Dropshipper</th>
              <th className="text-left py-2 px-2">Nivel</th>
              <th className="text-left py-2 px-2">Cambio</th>
              {mode === "mensual" ? (
                <>
                  <th className="text-right py-2 px-2">{labelMes}</th>
                  <th className="text-right py-2 px-2">{labelPrev}</th>
                  <th className="text-right py-2 px-2">Δ</th>
                </>
              ) : (
                <>
                  <th className="text-right py-2 px-2">{String(diaSel).padStart(2, "0")}/{labelMes}</th>
                  <th className="text-right py-2 px-2">{String(diaSel).padStart(2, "0")}/{labelPrev}</th>
                  <th className="text-right py-2 px-2">Δ</th>
                </>
              )}
              <th className="text-left py-2 px-2">Comercial</th>
              <th className="text-left py-2 px-2">Estado</th>
              <th className="text-left py-2 px-2">Nota</th>
              <th className="text-left py-2 px-2">Fecha gestión</th>
              <th className="text-left py-2 px-2">Próx. contacto</th>
              <th className="text-left py-2 pl-2">WA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cVal = mode === "diario" ? r.diaCur : r.movCur;
              const pVal = mode === "diario" ? r.diaPrev : r.movPrev;
              const d = deltaPct(cVal, pVal);
              const subio = r.nivelCur > r.nivelPrev;
              const bajo = r.nivelCur < r.nivelPrev;
              const wa = digits(r.celular);
              const estadoColor = ESTADOS.find((e) => e.v === r.estado)?.color || "#ef4444";
              return (
                <tr key={r.key} className="border-t align-top" style={{ borderColor: "var(--bg-card-border)" }}>
                  <td className="py-2 pr-3 t-primary font-medium max-w-[180px] truncate" title={r.nombre}>{r.nombre}</td>
                  <td className="py-2 px-2"><NivelBadge n={r.nivelCur} /></td>
                  <td className="py-2 px-2 text-[11px] whitespace-nowrap">
                    {subio ? <span style={{ color: "#10b981" }}>▲ N{r.nivelPrev}→N{r.nivelCur}</span>
                      : bajo ? <span style={{ color: "#ef4444" }}>▼ N{r.nivelPrev}→N{r.nivelCur}</span>
                      : <span className="t-muted">= N{r.nivelCur}</span>}
                  </td>
                  <td className="text-right py-2 px-2 t-primary font-semibold">{fmt(cVal)}</td>
                  <td className="text-right py-2 px-2 t-secondary">{fmt(pVal)}</td>
                  <td className="text-right py-2 px-2 font-semibold" style={{ color: d >= 0 ? "#10b981" : "#ef4444" }}>{d > 0 ? "+" : ""}{d}%</td>
                  <td className="py-2 px-2">
                    <select value={r.comercial} onChange={(e) => saveGestion(r.key, r.agg, { comercial_asignado: e.target.value || null })}
                      className="text-xs px-1.5 py-1 rounded border bg-transparent t-primary max-w-[130px]" style={{ borderColor: "var(--bg-card-border)" }}>
                      <option value="">—</option>
                      {comerciales.map((c) => <option key={c} value={c}>{c}</option>)}
                      {r.comercial && !comerciales.includes(r.comercial) && <option value={r.comercial}>{r.comercial}</option>}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <select value={r.estado} onChange={(e) => saveGestion(r.key, r.agg, { estado: e.target.value })}
                      className="text-xs px-1.5 py-1 rounded border font-medium" style={{ borderColor: "var(--bg-card-border)", background: `${estadoColor}18`, color: estadoColor }}>
                      {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input type="text" placeholder="nota…"
                      value={notaDraft[r.key] ?? r.nota}
                      onChange={(e) => setNotaDraft((n) => ({ ...n, [r.key]: e.target.value }))}
                      onBlur={(e) => { if ((e.target.value || "") !== r.nota) saveGestion(r.key, r.agg, { nota: e.target.value }); }}
                      className="text-xs px-1.5 py-1 rounded border bg-transparent t-primary w-[130px]" style={{ borderColor: "var(--bg-card-border)" }} />
                  </td>
                  <td className="py-2 px-2">
                    <input type="date" value={r.fecha_gestion || ""} onChange={(e) => saveGestion(r.key, r.agg, { fecha_gestion: e.target.value || null })}
                      className="text-xs px-1 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
                  </td>
                  <td className="py-2 px-2">
                    <input type="date" value={r.proxima_fecha_contacto || ""} onChange={(e) => saveGestion(r.key, r.agg, { proxima_fecha_contacto: e.target.value || null })}
                      className="text-xs px-1 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
                  </td>
                  <td className="py-2 pl-2">
                    {wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline text-xs" title={r.celular || ""}>💬</a> : <span className="t-muted text-xs">—</span>}
                    {savingKey === r.key && <span className="ml-1 text-[10px] t-muted">…</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={12} className="py-6 text-center t-muted text-xs">Sin dropshippers para los filtros seleccionados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] t-muted">
        El nivel se calcula sobre las movilizadas del mes ({labelMes}). Los cambios de gestión se guardan automáticamente.
        Umbrales: 🔴 0 · ⚪ 1–99 · 🟡 100–299 · 🟠 300–899 · 🟣 900–4999 · 🔵 5000+.
      </p>
    </div>
  );
}
