"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

interface Orden {
  orden_id: string;
  proveedor_nombre: string;
  proveedor_id?: string | null;
  bodega?: string | null;
  bodega_id?: string | null;
  estatus: string;
  fecha_pendiente?: string | null;
  fecha_guia?: string | null;
  fecha_ultimo_mov?: string | null;
}
interface Meta { fecha_carga?: string | null; total_activas?: number; updated_by_name?: string; updated_at?: string }

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
const norm = (s?: string) => (s || "").trim().toUpperCase();
const PREPARADO = "PREPARADO PARA TRANSPORTADORA";

function semaforo(dias: number): { emoji: string; color: string; label: string } {
  if (dias <= 1) return { emoji: "🟢", color: "#10b981", label: "0-1 día" };
  if (dias <= 3) return { emoji: "🟡", color: "#eab308", label: "2-3 días" };
  return { emoji: "🔴", color: "#ef4444", label: "+3 días" };
}

export default function ProveedorSeguimiento({ country }: { country: "ar" | "py" }) {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/data/proveedor-seguimiento?country=${country}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const data = await res.json();
      setOrdenes(Array.isArray(data.ordenes) ? data.ordenes : []);
      setMeta(data.meta || null);
    } catch (e: any) { setError(e.message || "Error al cargar"); }
    finally { setLoading(false); }
  }, [country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setUploadMsg("");
    try {
      const urlRes = await fetch("/api/data/proveedor-seguimiento/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, filename: file.name }),
      });
      if (!urlRes.ok) throw new Error(`No se pudo obtener URL (HTTP ${urlRes.status})`);
      const { path, signedUrl } = await urlRes.json();
      const upRes = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!upRes.ok) throw new Error(`Subida a Storage falló (HTTP ${upRes.status})`);
      const res = await fetch(`/api/data/proveedor-seguimiento/upload?country=${country}&path=${encodeURIComponent(path)}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setUploadMsg(`✓ Cargado: ${fmt(j.total_activas || 0)} órdenes activas al ${fmtFecha(j.fecha_carga)}`);
      setFile(null);
      await fetchData();
    } catch (e: any) { setUploadMsg("✗ " + (e.message || "Error al cargar")); }
    finally { setUploading(false); }
  };

  const todayUTC = useMemo(() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }, []);
  const nowMs = useMemo(() => Date.now(), []);
  const diasDesde = useCallback((s?: string | null): number => {
    const u = ymdUTC(s); return u == null ? 0 : Math.max(0, Math.floor((todayUTC - u) / 86400000));
  }, [todayUTC]);

  // Enriquecer órdenes + detectar proveedores que usan Ecom Scanner
  const { enriched, provUsaScanner } = useMemo(() => {
    const usa = new Set<string>();
    for (const o of ordenes) if (norm(o.estatus) === PREPARADO) usa.add(o.proveedor_nombre);
    const enriched = ordenes.map((o) => {
      const diasTotal = diasDesde(o.fecha_pendiente);
      const tieneGuia = !!o.fecha_guia;
      const est = norm(o.estatus);
      const guiaMs = o.fecha_guia ? ymdUTC(o.fecha_guia) : null;
      let horasPrep: number | null = null;
      if (est === PREPARADO && guiaMs != null && o.fecha_ultimo_mov) {
        horasPrep = Math.max(0, (Date.parse(o.fecha_ultimo_mov) - guiaMs) / 3600000);
      } else if (usa.has(o.proveedor_nombre) && est.includes("GUIA") && guiaMs != null) {
        horasPrep = Math.max(0, (nowMs - guiaMs) / 3600000); // corriendo
      }
      const etapa = !tieneGuia ? "Sin guía (pendiente)" : est === PREPARADO ? "Preparado ✓" : est.includes("GUIA") ? "Guía generada" : (o.estatus || "—");
      return { ...o, diasTotal, tieneGuia, horasPrep, etapa };
    });
    return { enriched, provUsaScanner: usa };
  }, [ordenes, diasDesde, nowMs]);

  // Agregado por proveedor
  const proveedores = useMemo(() => {
    const map = new Map<string, {
      proveedor: string; bodegas: Set<string>; total: number; sumDias: number; oldest: number;
      n3: number; n5: number; sinGuia: number; ordenes: typeof enriched;
    }>();
    for (const o of enriched) {
      const key = o.proveedor_nombre || "(sin proveedor)";
      let a = map.get(key);
      if (!a) { a = { proveedor: key, bodegas: new Set(), total: 0, sumDias: 0, oldest: 0, n3: 0, n5: 0, sinGuia: 0, ordenes: [] }; map.set(key, a); }
      a.total++; a.sumDias += o.diasTotal; a.oldest = Math.max(a.oldest, o.diasTotal);
      if (o.diasTotal >= 3) a.n3++;
      if (o.diasTotal >= 5) a.n5++;
      if (!o.tieneGuia) a.sinGuia++;
      if (o.bodega) a.bodegas.add(o.bodega);
      a.ordenes.push(o);
    }
    let arr = [...map.values()].map((a) => ({ ...a, promDias: a.total > 0 ? a.sumDias / a.total : 0 }));
    if (search) arr = arr.filter((a) => a.proveedor.toLowerCase().includes(search.toLowerCase()));
    if (soloCriticos) arr = arr.filter((a) => a.n5 > 0);
    arr.sort((a, b) => b.n5 - a.n5 || b.n3 - a.n3 || b.oldest - a.oldest || b.total - a.total);
    for (const a of arr) a.ordenes.sort((x, y) => y.diasTotal - x.diasTotal);
    return arr;
  }, [enriched, search, soloCriticos]);

  // Totales del panel
  const tot = useMemo(() => {
    const t = { activas: enriched.length, provs: new Set(enriched.map((o) => o.proveedor_nombre)).size, n3: 0, n5: 0, sinGuia: 0 };
    for (const o of enriched) { if (o.diasTotal >= 3) t.n3++; if (o.diasTotal >= 5) t.n5++; if (!o.tieneGuia) t.sinGuia++; }
    return t;
  }, [enriched]);

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold t-primary flex items-center gap-2">📦 Órdenes en poder del proveedor</h2>
            <p className="text-sm t-secondary mt-1">
              Panel en vivo: órdenes aún no recolectadas por la transportadora (sin fecha en procesamiento) y cuánto llevan sin despachar.
              {meta?.fecha_carga && <> Datos al <b className="t-primary">{fmtFecha(meta.fecha_carga)}</b>{meta.updated_by_name ? ` · por ${meta.updated_by_name}` : ""}.</>}
            </p>
          </div>
          {/* Carga diaria */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadMsg(""); }}
                className="text-xs t-secondary file:mr-2 file:text-xs file:rounded file:border-0 file:bg-orange-500 file:text-white file:px-2 file:py-1 file:cursor-pointer" />
              <button onClick={handleUpload} disabled={!file || uploading}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-orange-500 disabled:opacity-40 hover:opacity-90">
                {uploading ? "Cargando…" : "Cargar archivo del día"}
              </button>
            </div>
            {uploadMsg && <span className="text-[11px]" style={{ color: uploadMsg.startsWith("✓") ? "#10b981" : "#ef4444" }}>{uploadMsg}</span>}
          </div>
        </div>

        {/* KPIs del panel */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Órdenes activas" value={fmt(tot.activas)} sub="en poder del proveedor" />
          <Kpi label="Proveedores" value={fmt(tot.provs)} sub="con órdenes activas" />
          <Kpi label="Sin guía aún" value={fmt(tot.sinGuia)} sub="siguen en pendiente" tone="#eab308" />
          <Kpi label="3+ días" value={fmt(tot.n3)} sub="demorando" tone="#f97316" />
          <Kpi label="5+ días (crítico)" value={fmt(tot.n5)} sub="alerta máxima" tone="#ef4444" />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="Buscar proveedor…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
        <label className="text-xs t-secondary flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={soloCriticos} onChange={(e) => setSoloCriticos(e.target.checked)} />
          Solo con críticas (5+ días)
        </label>
        <span className="text-[11px] t-muted ml-auto">🟢 0-1 día · 🟡 2-3 días · 🔴 +3 días</span>
      </div>

      {/* Estado de carga */}
      {loading ? (
        <div className="glass-card p-8 text-center t-secondary">Cargando panel…</div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-red-400">{error}</div>
      ) : enriched.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-lg font-bold t-primary">Todavía no hay datos cargados</p>
          <p className="mt-2 text-sm t-secondary">Subí el archivo del día (con columnas ID, Proveedor, Estatus, Fecha en Pendiente, Fecha Generación de Guía, Fecha/Hora de último movimiento y Fecha en Procesamiento) con el botón de arriba.</p>
        </div>
      ) : (
        /* Vista principal por proveedor */
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="t-muted text-[11px] uppercase tracking-wider border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                <th className="text-left py-2.5 px-3">Proveedor</th>
                <th className="text-left py-2.5 px-2">Bodega</th>
                <th className="text-right py-2.5 px-2">Activas</th>
                <th className="text-right py-2.5 px-2">Prom. días</th>
                <th className="text-right py-2.5 px-2">Más antigua</th>
                <th className="text-right py-2.5 px-2">Sin guía</th>
                <th className="text-right py-2.5 px-2">3+ días</th>
                <th className="text-right py-2.5 px-2">5+ días</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => {
                const sem = semaforo(p.oldest);
                const isOpen = expanded === p.proveedor;
                const bodega = p.bodegas.size === 0 ? "—" : p.bodegas.size === 1 ? [...p.bodegas][0] : `Varias (${p.bodegas.size})`;
                return (
                  <Fragment key={p.proveedor}>
                    <tr className="border-b hover:bg-orange-500/5 cursor-pointer" style={{ borderColor: "var(--bg-card-border)" }}
                      onClick={() => setExpanded(isOpen ? null : p.proveedor)}>
                      <td className="py-2 px-3 t-primary font-medium">{sem.emoji} {p.proveedor}</td>
                      <td className="py-2 px-2 t-secondary text-xs max-w-[140px] truncate" title={bodega}>{bodega}</td>
                      <td className="py-2 px-2 text-right font-semibold t-primary">{fmt(p.total)}</td>
                      <td className="py-2 px-2 text-right t-secondary">{p.promDias.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right font-semibold" style={{ color: semaforo(p.oldest).color }}>{fmt(p.oldest)} d</td>
                      <td className="py-2 px-2 text-right" style={{ color: p.sinGuia > 0 ? "#eab308" : undefined }}>{fmt(p.sinGuia)}</td>
                      <td className="py-2 px-2 text-right font-semibold" style={{ color: p.n3 > 0 ? "#f97316" : "var(--text-muted)" }}>{fmt(p.n3)}</td>
                      <td className="py-2 px-2 text-right font-bold" style={{ color: p.n5 > 0 ? "#ef4444" : "var(--text-muted)" }}>{fmt(p.n5)}</td>
                      <td className="py-2 px-2 text-right t-muted text-xs">{isOpen ? "▲" : "▼"}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={9} className="px-3 pb-3" style={{ background: "var(--bg-kpi)" }}>
                          <div className="overflow-x-auto py-2">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="t-muted uppercase tracking-wider">
                                  <th className="text-left py-1.5 px-2">ID Orden</th>
                                  <th className="text-left py-1.5 px-2">Fecha Pendiente</th>
                                  <th className="text-right py-1.5 px-2">Días</th>
                                  <th className="text-left py-1.5 px-2">Estado</th>
                                  <th className="text-left py-1.5 px-2">Fecha Guía</th>
                                  <th className="text-left py-1.5 px-2">Etapa actual</th>
                                  <th className="text-right py-1.5 px-2">Guía→Prep. (hs)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.ordenes.map((o) => {
                                  const sm = semaforo(o.diasTotal);
                                  return (
                                    <tr key={o.orden_id} className="border-t" style={{ borderColor: "var(--bg-card-border)" }}>
                                      <td className="py-1.5 px-2 t-primary font-mono">{o.orden_id}</td>
                                      <td className="py-1.5 px-2 t-secondary">{fmtFecha(o.fecha_pendiente)}</td>
                                      <td className="py-1.5 px-2 text-right font-semibold" style={{ color: sm.color }}>{sm.emoji} {o.diasTotal}</td>
                                      <td className="py-1.5 px-2 t-secondary">{o.estatus || "—"}</td>
                                      <td className="py-1.5 px-2 t-secondary">{fmtFecha(o.fecha_guia)}</td>
                                      <td className="py-1.5 px-2 t-secondary">{o.etapa}</td>
                                      <td className="py-1.5 px-2 text-right t-secondary">{o.horasPrep == null ? "—" : o.horasPrep.toFixed(1)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
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
