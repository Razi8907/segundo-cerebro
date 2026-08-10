"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

interface Orden {
  orden_id: string;
  proveedor_nombre: string;
  bodega?: string | null;
  estatus: string;
  fecha_pendiente?: string | null;
  fecha_guia?: string | null;
  fecha_ultimo_mov?: string | null;
}
interface Meta { fecha_carga?: string | null; updated_by_name?: string }

const fmt = (n: number): string => Math.round(n).toLocaleString("es-AR");
const ymdUTC = (s?: string | null): number | null => {
  if (!s) return null;
  const p = s.slice(0, 10).split("-").map(Number);
  if (p.length < 3 || p.some(isNaN)) return null;
  return Date.UTC(p[0], p[1] - 1, p[2]);
};
const fmtFecha = (s?: string | null): string => {
  const u = ymdUTC(s);
  if (u == null) return "—";
  const d = new Date(u);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const fmtFechaHora = (iso?: string | null): string => {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (isNaN(t)) return "—";
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const norm = (s?: string) => (s || "").trim().toUpperCase();

type Etapa = "pendiente" | "guia" | "preparado";
function etapaDe(est: string): Etapa | null {
  const e = norm(est);
  if (e === "PENDIENTE") return "pendiente";
  if (e.includes("GUIA") && e.includes("GENERADA")) return "guia";
  if (e.includes("PREPARADO")) return "preparado";
  return null;
}
const RECLAMO: Record<Etapa, string> = {
  pendiente: "Reclamo a PROVEEDOR: no generó guía",
  guia: "Reclamo a PROVEEDOR: no despachó/escaneó",
  preparado: "Reclamo a TRANSPORTADORA: no recolectó",
};

export default function GuiasNoDespachadas({ country }: { country: "ar" | "py" }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [umbral, setUmbral] = useState(1);
  const [soloReclamo, setSoloReclamo] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/data/proveedor-seguimiento?country=${country}`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) throw new Error("Sesión expirada — recargá la página e iniciá sesión de nuevo.");
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const data = await res.json();
      setOrdenes(Array.isArray(data.ordenes) ? data.ordenes : []);
      setMeta(data.meta || null);
    } catch (e: any) { setError(e.message || "Error al cargar"); }
    finally { setLoading(false); }
  }, [country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const todayUTC = useMemo(() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }, []);
  const diasDesde = useCallback((s?: string | null): number => {
    const u = ymdUTC(s); return u == null ? 0 : Math.max(0, Math.floor((todayUTC - u) / 86400000));
  }, [todayUTC]);

  const enriched = useMemo(() => {
    const out = [];
    for (const o of ordenes) {
      const etapa = etapaDe(o.estatus);
      if (!etapa) continue;
      const fechaRef = etapa === "pendiente" ? o.fecha_pendiente
        : etapa === "guia" ? o.fecha_guia
        : (o.fecha_ultimo_mov ? o.fecha_ultimo_mov.slice(0, 10) : null);
      const dias = diasDesde(fechaRef);
      const reclamo = dias > umbral;
      out.push({ ...o, etapa, fechaRef, dias, reclamo });
    }
    return out;
  }, [ordenes, diasDesde, umbral]);

  const proveedores = useMemo(() => {
    const map = new Map<string, { proveedor: string; pend: typeof enriched; guia: typeof enriched; prep: typeof enriched; reclamos: number }>();
    for (const o of enriched) {
      const key = o.proveedor_nombre || "(sin proveedor)";
      let a = map.get(key);
      if (!a) { a = { proveedor: key, pend: [], guia: [], prep: [], reclamos: 0 }; map.set(key, a); }
      if (o.etapa === "pendiente") a.pend.push(o);
      else if (o.etapa === "guia") a.guia.push(o);
      else a.prep.push(o);
      if (o.reclamo) a.reclamos++;
    }
    let arr = [...map.values()].map((a) => ({ ...a, total: a.pend.length + a.guia.length + a.prep.length }));
    if (search) arr = arr.filter((a) => a.proveedor.toLowerCase().includes(search.toLowerCase()));
    if (soloReclamo) arr = arr.filter((a) => a.reclamos > 0);
    arr.sort((a, b) => b.reclamos - a.reclamos || b.total - a.total);
    for (const a of arr) { a.pend.sort((x, y) => y.dias - x.dias); a.guia.sort((x, y) => y.dias - x.dias); a.prep.sort((x, y) => y.dias - x.dias); }
    return arr;
  }, [enriched, search, soloReclamo]);

  const tot = useMemo(() => {
    const t = { pend: 0, guia: 0, prep: 0, reclamos: 0 };
    for (const o of enriched) { if (o.etapa === "pendiente") t.pend++; else if (o.etapa === "guia") t.guia++; else t.prep++; if (o.reclamo) t.reclamos++; }
    return t;
  }, [enriched]);

  const subTabla = (titulo: string, color: string, rows: typeof enriched, fechaLabel: string, esPreparado?: boolean) => (
    <div>
      <div className="text-xs font-semibold mb-1.5" style={{ color }}>{titulo} ({rows.length})</div>
      {rows.length === 0 ? <p className="text-[11px] t-muted">Sin guías.</p> : (
        <table className="w-full text-xs">
          <thead>
            <tr className="t-muted uppercase tracking-wider">
              <th className="text-left py-1 px-2">ID Guía</th>
              <th className="text-left py-1 px-2">{fechaLabel}</th>
              <th className="text-right py-1 px-2">Días</th>
              <th className="text-left py-1 px-2">¿Reclamo?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.orden_id} className="border-t" style={{ borderColor: "var(--bg-card-border)" }}>
                <td className="py-1 px-2 t-primary font-mono">{o.orden_id}</td>
                <td className="py-1 px-2 t-secondary">{esPreparado ? fmtFechaHora(o.fecha_ultimo_mov) : fmtFecha(o.fechaRef)}</td>
                <td className="py-1 px-2 text-right font-semibold" style={{ color: o.reclamo ? "#ef4444" : undefined }}>{o.reclamo ? "🔴 " : ""}{o.dias}</td>
                <td className="py-1 px-2 text-[11px]" style={{ color: o.reclamo ? "#ef4444" : "var(--text-muted)" }}>{o.reclamo ? RECLAMO[o.etapa] : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold t-primary flex items-center gap-2">🚚 Guías no despachadas por proveedor</h2>
            <p className="text-sm t-secondary mt-1">
              Guías aún no recolectadas por la transportadora, separadas por etapa (Pendiente / Guía Generada / Preparado) con días en cada estado.
              {meta?.fecha_carga && <> Datos al <b className="t-primary">{fmtFecha(meta.fecha_carga)}</b>.</>}
            </p>
          </div>
          <label className="text-xs t-secondary flex items-center gap-1">Reclamo si &gt;
            <input type="number" min={0} value={umbral} onChange={(e) => setUmbral(Math.max(0, Number(e.target.value) || 0))} className="w-14 px-1.5 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} /> día(s)
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="En Pendiente" value={fmt(tot.pend)} sub="sin generar guía" tone="#eab308" />
          <Kpi label="En Guía Generada" value={fmt(tot.guia)} sub="sin despachar" tone="#f97316" />
          <Kpi label="En Preparado" value={fmt(tot.prep)} sub="esperando transportadora" tone="#3b82f6" />
          <Kpi label="Con reclamo" value={fmt(tot.reclamos)} sub={`más de ${umbral} día(s)`} tone="#ef4444" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="Buscar proveedor…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
        <label className="text-xs t-secondary flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={soloReclamo} onChange={(e) => setSoloReclamo(e.target.checked)} /> Solo con reclamo
        </label>
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center t-secondary">Cargando…</div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-red-400">{error}</div>
      ) : enriched.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-lg font-bold t-primary">No hay guías activas cargadas</p>
          <p className="mt-2 text-sm t-secondary">Subí el archivo del día en la pestaña <b>Órdenes en poder del proveedor</b>. Este panel usa la misma carga.</p>
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="t-muted text-[11px] uppercase tracking-wider border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                <th className="text-left py-2.5 px-3">Proveedor</th>
                <th className="text-right py-2.5 px-2">Pendiente</th>
                <th className="text-right py-2.5 px-2">Guía Generada</th>
                <th className="text-right py-2.5 px-2">Preparado</th>
                <th className="text-right py-2.5 px-2">Total activas</th>
                <th className="text-right py-2.5 px-2">Con reclamo</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => {
                const isOpen = expanded === p.proveedor;
                return (
                  <Fragment key={p.proveedor}>
                    <tr className="border-b hover:bg-orange-500/5 cursor-pointer" style={{ borderColor: "var(--bg-card-border)" }} onClick={() => setExpanded(isOpen ? null : p.proveedor)}>
                      <td className="py-2 px-3 t-primary font-medium">{p.reclamos > 0 ? "🔴 " : ""}{p.proveedor}</td>
                      <td className="py-2 px-2 text-right" style={{ color: p.pend.length > 0 ? "#eab308" : "var(--text-muted)" }}>{fmt(p.pend.length)}</td>
                      <td className="py-2 px-2 text-right" style={{ color: p.guia.length > 0 ? "#f97316" : "var(--text-muted)" }}>{fmt(p.guia.length)}</td>
                      <td className="py-2 px-2 text-right" style={{ color: p.prep.length > 0 ? "#3b82f6" : "var(--text-muted)" }}>{fmt(p.prep.length)}</td>
                      <td className="py-2 px-2 text-right font-semibold t-primary">{fmt(p.total)}</td>
                      <td className="py-2 px-2 text-right font-bold" style={{ color: p.reclamos > 0 ? "#ef4444" : "var(--text-muted)" }}>{fmt(p.reclamos)}</td>
                      <td className="py-2 px-2 text-right t-muted text-xs">{isOpen ? "▲" : "▼"}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="px-3 pb-3 space-y-3" style={{ background: "var(--bg-kpi)" }}>
                          <div className="pt-2">{subTabla("A) Pendientes", "#eab308", p.pend, "Fecha en Pendiente")}</div>
                          {subTabla("B) Guía Generada", "#f97316", p.guia, "Fecha Generación Guía")}
                          {subTabla("C) Preparado para Transportadora", "#3b82f6", p.prep, "Fecha+Hora Últ. Mov.", true)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] t-muted">
        Días = HOY − fecha de inicio de la etapa (Pendiente→fecha en pendiente · Guía Generada→fecha de guía · Preparado→último movimiento).
        Reclamo cuando supera {umbral} día(s). Se recalcula con cada carga diaria; salen del panel las guías con fecha en procesamiento.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider t-muted">{label}</div>
      <div className="text-xl font-bold mt-0.5" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="text-[11px] t-secondary">{sub}</div>
    </div>
  );
}
