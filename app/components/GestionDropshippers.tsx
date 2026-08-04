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
// Umbrales de movilizadas por país: [min N1, min N2, min N3, min N4, min N5]
const UMBRALES: Record<string, number[]> = {
  py: [1, 100, 300, 900, 5000],
  ar: [1, 50, 200, 900, 3000],
};
function nivelDe(mov: number, country: string): number {
  const u = UMBRALES[country] || UMBRALES.py;
  if (mov >= u[4]) return 5;
  if (mov >= u[3]) return 4;
  if (mov >= u[2]) return 3;
  if (mov >= u[1]) return 2;
  if (mov >= u[0]) return 1;
  return 0;
}
function umbralesTexto(country: string): string {
  const u = UMBRALES[country] || UMBRALES.py;
  return `🔴 0 · ⚪ ${u[0]}–${u[1] - 1} · 🟡 ${u[1]}–${u[2] - 1} · 🟠 ${u[2]}–${u[3] - 1} · 🟣 ${u[3]}–${u[4] - 1} · 🔵 ${u[4]}+`;
}

const ESTADOS = [
  { v: "contactado", label: "🟢 Contactado", color: "#10b981" },
  { v: "volver_a_contactar", label: "🟡 Volver a contactar", color: "#eab308" },
  { v: "en_seguimiento", label: "🔵 En seguimiento", color: "#3b82f6" },
  { v: "sin_gestionar", label: "🔴 Sin gestionar", color: "#ef4444" },
];

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

// Acumulado de órdenes del día 1 al día D (inclusive).
function accToDay(a: Agg | undefined, D: number): number {
  if (!a) return 0;
  let s = 0;
  for (const [d, v] of a.byDay) if (d >= 1 && d <= D) s += v;
  return s;
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
  country, realMes, mesPrev, labelMes, labelPrev, labelPrevPrev, diasMes, esMesEnCurso, dsCurDaily, dsPrevDaily, dsPrevPrevDaily,
}: {
  country: "ar" | "py";
  realMes: string; mesPrev: string;
  labelMes: string; labelPrev: string; labelPrevPrev: string;
  diasMes: number;
  esMesEnCurso: boolean;
  dsCurDaily: DsDailyRow[];
  dsPrevDaily: DsDailyRow[];
  dsPrevPrevDaily: DsDailyRow[];
}) {
  const [mode, setMode] = useState<"mensual" | "mensual_cerrado" | "diario">("mensual");
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
  const prevPrevAgg = useMemo(() => buildAgg(dsPrevPrevDaily), [dsPrevPrevDaily]);

  // Mensual cerrado: compara los dos meses cerrados anteriores (ej. Julio vs Junio).
  const cerradoMode = mode === "mensual_cerrado";

  // Días transcurridos con data en el mes corriente (para proyectar el cierre).
  const maxDayCur = useMemo(() => {
    let mx = 0;
    for (const a of curAgg.values()) for (const d of a.byDay.keys()) if (d > mx) mx = d;
    return mx;
  }, [curAgg]);
  const elapsed = esMesEnCurso ? Math.max(1, Math.min(maxDayCur || 1, Math.max(1, hoyDia - 1))) : (maxDayCur || diasMes);

  // Modo proyección: mensual + mes corriente (ej. Agosto vs Julio cerrado).
  const projMode = mode === "mensual" && esMesEnCurso;
  const proyectar = (movCur: number) => (projMode && elapsed > 0 ? Math.round((movCur / elapsed) * diasMes) : movCur);
  // La gestión (comercial, estado, nota, fechas) vive solo en la vista Diario.
  // Las vistas mensuales (proyección y cerrado) son analíticas: banner + comparación.
  const showGestion = mode === "diario";

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
    const keys = new Set<string>([...curAgg.keys(), ...prevAgg.keys(), ...(cerradoMode ? prevPrevAgg.keys() : [])]);
    const out = [];
    for (const key of keys) {
      const cur = curAgg.get(key);
      const prev = prevAgg.get(key);
      const prevPrev = prevPrevAgg.get(key);
      const agg: Agg = cur || prev || prevPrev!;
      const movCur = cur?.total || 0;
      const movPrev = prev?.total || 0;
      const movPrevPrev = prevPrev?.total || 0;
      const proj = proyectar(movCur);
      // Nivel según el modo:
      //  · cerrado: mes reciente cerrado (prev) vs anterior cerrado (prevPrev)
      //  · proyección: cierre proyectado de agosto vs julio
      //  · resto: mes corriente vs anterior
      const nivelCur = nivelDe(cerradoMode ? movPrev : projMode ? proj : movCur, country);
      const nivelPrev = nivelDe(cerradoMode ? movPrevPrev : movPrev, country);
      // Diario = comparación de RANGOS acumulados: del 1 al día seleccionado.
      const diaCur = accToDay(cur, diaSel);
      const diaPrev = accToDay(prev, diaSel);
      const g = gestionMap[key];
      out.push({
        key, agg,
        nombre: agg.nombre, email: agg.email, celular: agg.celular,
        movCur, movPrev, movPrevPrev, proj, nivelCur, nivelPrev, diaCur, diaPrev,
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
    filtered = filtered.sort((a, b) =>
      mode === "diario" ? b.diaCur - a.diaCur
        : cerradoMode ? b.movPrev - a.movPrev
        : projMode ? b.proj - a.proj
        : b.movCur - a.movCur,
    );
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curAgg, prevAgg, prevPrevAgg, gestionMap, diaSel, mode, projMode, cerradoMode, elapsed, fComercial, fNivel, fEstado, fGestionDesde, fProxHasta, search]);

  const totalDs = curAgg.size;

  // Banner headline para las vistas mensuales (proyección y cerrado): mismo formato.
  const mensualBanner = useMemo(() => {
    if (mode === "diario") return null;
    const tot = (m: Map<string, Agg>) => { let s = 0; for (const a of m.values()) s += a.total; return s; };
    const curTot = tot(curAgg), prevTot = tot(prevAgg), prevPrevTot = tot(prevPrevAgg);
    if (projMode) {
      let projTot = 0;
      for (const a of curAgg.values()) projTot += elapsed > 0 ? (a.total / elapsed) * diasMes : a.total;
      const proj = Math.round(projTot);
      return {
        tiles: [
          { lbl: `${labelMes} al día ${elapsed}`, val: curTot, sub: "movilizadas acumuladas", accent: false },
          { lbl: `Proyección cierre ${labelMes}`, val: proj, sub: `${fmt(elapsed > 0 ? curTot / elapsed : 0)}/día × ${diasMes}`, accent: true },
          { lbl: `${labelPrev} cerrado`, val: prevTot, sub: "movilizadas totales", accent: false },
        ],
        growth: deltaPct(proj, prevTot), growthLbl: "Crecimiento proyectado", growthSub: `${labelMes} proy. vs ${labelPrev}`,
      };
    }
    if (cerradoMode) {
      return {
        tiles: [
          { lbl: `${labelPrev} cerrado`, val: prevTot, sub: "movilizadas totales", accent: true },
          { lbl: `${labelPrevPrev} cerrado`, val: prevPrevTot, sub: "movilizadas totales", accent: false },
        ],
        growth: deltaPct(prevTot, prevPrevTot), growthLbl: "Crecimiento", growthSub: `${labelPrev} vs ${labelPrevPrev}`,
      };
    }
    return {
      tiles: [
        { lbl: labelMes, val: curTot, sub: "movilizadas totales", accent: true },
        { lbl: labelPrev, val: prevTot, sub: "movilizadas totales", accent: false },
      ],
      growth: deltaPct(curTot, prevTot), growthLbl: "Crecimiento", growthSub: `${labelMes} vs ${labelPrev}`,
    };
  }, [mode, projMode, cerradoMode, curAgg, prevAgg, prevPrevAgg, elapsed, diasMes, labelMes, labelPrev, labelPrevPrev]);

  const colSpan = mode === "diario" ? 12 : 7;

  return (
    <div className="glass-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold t-primary">📋 Gestión de dropshippers — {labelMes} vs {labelPrev}</h3>
          <p className="text-xs t-secondary mt-1">
            {projMode
              ? `Proyección de cierre de ${labelMes} (mes corriente) vs ${labelPrev} cerrado. ${totalDs} dropshippers.`
              : cerradoMode
              ? `Comparativo de meses cerrados: ${labelPrev} vs ${labelPrevPrev}. Nivel y cambio sobre ${labelPrev}.`
              : mode === "diario"
              ? `Seguimiento diario acumulado + gestión comercial editable. ${totalDs} dropshippers.`
              : `Comparativo mensual ${labelMes} vs ${labelPrev}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg p-1" style={{ background: "var(--bg-kpi)" }}>
          {(["mensual", "mensual_cerrado", "diario"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${mode === m ? "bg-orange-500 text-white" : "t-secondary hover:text-orange-400"}`}>
              {m === "mensual" ? `${projMode ? "Proyección Mensual" : "Mensual"} (${labelMes} vs ${labelPrev})`
                : m === "mensual_cerrado" ? `Mensual cerrado (${labelPrev} vs ${labelPrevPrev})`
                : "Diario (acumulado 1→día)"}
            </button>
          ))}
        </div>
      </div>

      {/* Headline de crecimiento — mismo formato en Proyección Mensual y Mensual cerrado */}
      {mode !== "diario" && mensualBanner && (
        <div className="mt-4 rounded-xl p-4 border grid grid-cols-2 md:grid-cols-4 gap-3"
          style={{
            background: mensualBanner.growth >= 0 ? "rgba(16,185,129,0.10)" : "rgba(249,115,22,0.10)",
            borderColor: mensualBanner.growth >= 0 ? "rgba(16,185,129,0.35)" : "rgba(249,115,22,0.35)",
          }}>
          {mensualBanner.tiles.map((t, i) => (
            <div key={i}>
              <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">{t.lbl}</div>
              <div className={`text-xl font-bold mt-0.5 ${t.accent ? "" : "t-primary"}`} style={t.accent ? { color: "#f97316" } : undefined}>{fmt(t.val)}</div>
              <div className="text-[11px] t-secondary">{t.sub}</div>
            </div>
          ))}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">{mensualBanner.growthLbl}</div>
            <div className="text-xl font-bold mt-0.5" style={{ color: mensualBanner.growth >= 0 ? "#10b981" : "#ef4444" }}>
              {mensualBanner.growth > 0 ? "+" : ""}{mensualBanner.growth}%
            </div>
            <div className="text-[11px] t-secondary">{mensualBanner.growthSub}</div>
          </div>
        </div>
      )}

      {mode === "diario" && (
        <div className="mt-3 flex items-center gap-2 text-xs t-secondary">
          <span>Acumulado del 1 al día</span>
          <input type="number" min={1} max={diasMes} value={diaSel}
            onChange={(e) => setDiaSel(Math.max(1, Math.min(diasMes, Number(e.target.value) || 1)))}
            className="w-16 px-2 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
          <span>de cada mes → <b className="t-primary">1–{String(diaSel).padStart(2, "0")} {labelMes}</b> vs <b className="t-primary">1–{String(diaSel).padStart(2, "0")} {labelPrev}</b></span>
        </div>
      )}

      {/* Filtros — la gestión no aplica en la vista de proyección */}
      {showGestion && (
        <>
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
        </>
      )}

      {/* Vistas mensuales (analíticas): solo filtros de nivel y búsqueda (sin gestión) */}
      {mode !== "diario" && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          <select value={fNivel} onChange={(e) => setFNivel(e.target.value)} className="text-xs px-2 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }}>
            <option value="">{projMode ? "Nivel proyectado: todos" : "Nivel: todos"}</option>
            {NIVELES.map((l) => <option key={l.n} value={String(l.n)}>{l.emoji} N{l.n} {l.label}</option>)}
          </select>
          <input type="text" placeholder="Buscar dropshipper…" value={search} onChange={(e) => setSearch(e.target.value)} className="text-xs px-2 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
        </div>
      )}

      {/* Tabla */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="t-muted text-[11px] uppercase tracking-wider">
              <th className="text-left py-2 pr-3">Dropshipper</th>
              <th className="text-left py-2 px-2">Nivel{projMode ? " proy." : ""}</th>
              <th className="text-left py-2 px-2">Cambio{projMode ? " proy." : ""}</th>
              {mode === "diario" ? (
                <>
                  <th className="text-right py-2 px-2">1–{String(diaSel).padStart(2, "0")} {labelMes}</th>
                  <th className="text-right py-2 px-2">1–{String(diaSel).padStart(2, "0")} {labelPrev}</th>
                  <th className="text-right py-2 px-2">Δ</th>
                </>
              ) : projMode ? (
                <>
                  <th className="text-right py-2 px-2">{labelMes} (día {elapsed})</th>
                  <th className="text-right py-2 px-2">Proy. {labelMes}</th>
                  <th className="text-right py-2 px-2">{labelPrev} (cerrado)</th>
                  <th className="text-right py-2 px-2">Crec. proy.</th>
                </>
              ) : cerradoMode ? (
                <>
                  <th className="text-right py-2 px-2">{labelPrev}</th>
                  <th className="text-right py-2 px-2">{labelPrevPrev}</th>
                  <th className="text-right py-2 px-2">Δ</th>
                </>
              ) : (
                <>
                  <th className="text-right py-2 px-2">{labelMes}</th>
                  <th className="text-right py-2 px-2">{labelPrev}</th>
                  <th className="text-right py-2 px-2">Δ</th>
                </>
              )}
              {showGestion && (
                <>
                  <th className="text-left py-2 px-2">Comercial</th>
                  <th className="text-left py-2 px-2">Estado</th>
                  <th className="text-left py-2 px-2">Nota</th>
                  <th className="text-left py-2 px-2">Fecha gestión</th>
                  <th className="text-left py-2 px-2">Próx. contacto</th>
                  <th className="text-left py-2 pl-2">WA</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const subio = r.nivelCur > r.nivelPrev;
              const bajo = r.nivelCur < r.nivelPrev;
              const wa = digits(r.celular);
              const estadoColor = ESTADOS.find((e) => e.v === r.estado)?.color || "#ef4444";
              const dDiario = deltaPct(r.diaCur, r.diaPrev);
              const dMensual = deltaPct(r.movCur, r.movPrev);
              const dProj = deltaPct(r.proj, r.movPrev);
              const dCerr = deltaPct(r.movPrev, r.movPrevPrev);
              return (
                <tr key={r.key} className="border-t align-top" style={{ borderColor: "var(--bg-card-border)" }}>
                  <td className="py-2 pr-3 t-primary font-medium max-w-[180px] truncate" title={r.nombre}>{r.nombre}</td>
                  <td className="py-2 px-2"><NivelBadge n={r.nivelCur} /></td>
                  <td className="py-2 px-2 text-[11px] whitespace-nowrap">
                    {subio ? <span style={{ color: "#10b981" }}>▲ N{r.nivelPrev}→N{r.nivelCur}</span>
                      : bajo ? <span style={{ color: "#ef4444" }}>▼ N{r.nivelPrev}→N{r.nivelCur}</span>
                      : <span className="t-muted">= N{r.nivelCur}</span>}
                  </td>
                  {mode === "diario" ? (
                    <>
                      <td className="text-right py-2 px-2 t-primary font-semibold">{fmt(r.diaCur)}</td>
                      <td className="text-right py-2 px-2 t-secondary">{fmt(r.diaPrev)}</td>
                      <td className="text-right py-2 px-2 font-semibold" style={{ color: dDiario >= 0 ? "#10b981" : "#ef4444" }}>{dDiario > 0 ? "+" : ""}{dDiario}%</td>
                    </>
                  ) : projMode ? (
                    <>
                      <td className="text-right py-2 px-2 t-secondary">{fmt(r.movCur)}</td>
                      <td className="text-right py-2 px-2 t-primary font-semibold" style={{ color: "#f97316" }}>{fmt(r.proj)}</td>
                      <td className="text-right py-2 px-2 t-secondary">{fmt(r.movPrev)}</td>
                      <td className="text-right py-2 px-2 font-semibold" style={{ color: dProj >= 0 ? "#10b981" : "#ef4444" }}>{dProj > 0 ? "+" : ""}{dProj}%</td>
                    </>
                  ) : cerradoMode ? (
                    <>
                      <td className="text-right py-2 px-2 t-primary font-semibold">{fmt(r.movPrev)}</td>
                      <td className="text-right py-2 px-2 t-secondary">{fmt(r.movPrevPrev)}</td>
                      <td className="text-right py-2 px-2 font-semibold" style={{ color: dCerr >= 0 ? "#10b981" : "#ef4444" }}>{dCerr > 0 ? "+" : ""}{dCerr}%</td>
                    </>
                  ) : (
                    <>
                      <td className="text-right py-2 px-2 t-primary font-semibold">{fmt(r.movCur)}</td>
                      <td className="text-right py-2 px-2 t-secondary">{fmt(r.movPrev)}</td>
                      <td className="text-right py-2 px-2 font-semibold" style={{ color: dMensual >= 0 ? "#10b981" : "#ef4444" }}>{dMensual > 0 ? "+" : ""}{dMensual}%</td>
                    </>
                  )}
                  {showGestion && (
                    <>
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
                    </>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={colSpan} className="py-6 text-center t-muted text-xs">Sin dropshippers para los filtros seleccionados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] t-muted">
        {projMode
          ? `Proyección = ritmo diario de ${labelMes} (acumulado ÷ ${elapsed} días con data) × ${diasMes} días. El nivel y el cambio usan el cierre proyectado. La gestión comercial está disponible en la vista Diario y en meses cerrados.`
          : `El nivel se calcula sobre las movilizadas del mes (${labelMes}). Los cambios de gestión se guardan automáticamente.`}
        {" "}Umbrales: {umbralesTexto(country)}.
      </p>
    </div>
  );
}
