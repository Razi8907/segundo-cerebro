"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface ByProducto { nombre: string; ordenes: number; proveedor?: string }
interface StockRow { producto_nombre: string; stock_real: number | null; updated_by_name?: string; updated_at?: string }

const MES_NUM: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const DIAS_MES: Record<string, number> = { enero: 31, febrero: 28, marzo: 31, abril: 30, mayo: 31, junio: 30, julio: 31, agosto: 31, septiembre: 30, octubre: 31, noviembre: 30, diciembre: 31 };
const fmt = (n: number): string => Math.round(n).toLocaleString("es-AR");
const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function StockTop50({ country, mes }: { country: "ar" | "py"; mes: string }) {
  const labelMes = mes.charAt(0).toUpperCase() + mes.slice(1);
  const [productos, setProductos] = useState<ByProducto[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [critico, setCritico] = useState(7);
  const [warning, setWarning] = useState(14);
  const [search, setSearch] = useState("");
  const [copiado, setCopiado] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [op, st] = await Promise.all([
        fetch(`/api/data/operational?country=${country}&mes=${mes}`, { credentials: "include" }).then((r) => r.json()).catch(() => null),
        fetch(`/api/data/producto-stock?country=${country}`, { credentials: "include" }).then((r) => r.json()).catch(() => null),
      ]);
      const bp: ByProducto[] = op?.data?.by_producto || [];
      // Agregar por nombre (por si viene repetido)
      const agg = new Map<string, ByProducto>();
      for (const p of bp) {
        const nombre = (p.nombre || "").trim();
        if (!nombre) continue;
        const a = agg.get(nombre);
        if (a) { a.ordenes += p.ordenes || 0; if (!a.proveedor && p.proveedor) a.proveedor = p.proveedor; }
        else agg.set(nombre, { nombre, ordenes: p.ordenes || 0, proveedor: p.proveedor });
      }
      setProductos([...agg.values()].sort((a, b) => b.ordenes - a.ordenes).slice(0, 50));
      if (st && Array.isArray(st.rows)) {
        const m: Record<string, number | null> = {};
        for (const r of st.rows as StockRow[]) m[r.producto_nombre] = r.stock_real;
        setStockMap(m);
      }
    } catch (e: any) { setError(e.message || "Error al cargar"); }
    finally { setLoading(false); }
  }, [country, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveStock = useCallback(async (nombre: string, val: string) => {
    const num = val === "" ? null : Math.max(0, Math.round(Number(val)) || 0);
    setStockMap((m) => ({ ...m, [nombre]: num }));
    setSavingKey(nombre);
    try {
      await fetch(`/api/data/producto-stock`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ country, producto_nombre: nombre, stock_real: num }),
      });
    } finally { setSavingKey((k) => (k === nombre ? null : k)); }
  }, [country]);

  const { elapsed, esMesEnCurso, todayUTC } = useMemo(() => {
    const now = new Date();
    const esCurso = now.getFullYear() === 2026 && now.getMonth() + 1 === MES_NUM[mes];
    const el = esCurso ? Math.max(1, now.getDate() - 1) : (DIAS_MES[mes] || 30);
    return { elapsed: el, esMesEnCurso: esCurso, todayUTC: Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) };
  }, [mes]);

  const rows = useMemo(() => {
    let arr = productos.map((p, i) => {
      const stock = stockMap[p.nombre] ?? null;
      const velocity = elapsed > 0 ? p.ordenes / elapsed : 0;
      const diasCob = stock != null && velocity > 0 ? stock / velocity : null;
      let quiebre: string | null = null;
      if (diasCob != null) {
        const d = new Date(todayUTC + Math.round(diasCob) * 86400000);
        quiebre = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      }
      return { ...p, rank: i + 1, stock, velocity, diasCob, quiebre };
    });
    if (search) arr = arr.filter((r) => r.nombre.toLowerCase().includes(search.toLowerCase()) || (r.proveedor || "").toLowerCase().includes(search.toLowerCase()));
    return arr;
  }, [productos, stockMap, elapsed, todayUTC, search]);

  const alertas = useMemo(() =>
    rows.filter((r) => r.diasCob != null && r.diasCob < warning).sort((a, b) => (a.diasCob! - b.diasCob!)),
    [rows, warning]);

  const sinStock = rows.filter((r) => r.stock == null).length;

  const mensajePaulina = useMemo(() => {
    if (alertas.length === 0) return "";
    const lineas = alertas.map((r, i) => {
      const cob = r.diasCob != null ? `${fmt1(r.diasCob)}d` : "—";
      const crit = r.diasCob != null && r.diasCob < critico ? " 🔴" : " 🟡";
      return `${i + 1}. ${r.nombre}${r.proveedor ? ` (${r.proveedor})` : ""} — stock ${r.stock != null ? fmt(r.stock) : "?"}, cobertura ${cob}, vende ${fmt1(r.velocity)}/día${crit}`;
    });
    return `⚠️ Alerta de stock — Top productos ${labelMes} (${country.toUpperCase()})\n${alertas.length} producto(s) por quebrar (cobertura < ${warning} días):\n\n${lineas.join("\n")}\n\n🔴 = crítico (< ${critico} días) · 🟡 = a vigilar`;
  }, [alertas, labelMes, country, warning, critico]);

  const copiar = () => {
    if (!mensajePaulina) return;
    navigator.clipboard?.writeText(mensajePaulina).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  };

  const semColor = (r: { diasCob: number | null; stock: number | null }) => {
    if (r.stock === 0) return "#ef4444";
    if (r.diasCob == null) return "var(--text-muted)";
    if (r.diasCob < critico) return "#ef4444";
    if (r.diasCob < warning) return "#eab308";
    return "#10b981";
  };
  const semEmoji = (r: { diasCob: number | null; stock: number | null }) => {
    if (r.stock === 0) return "🔴";
    if (r.diasCob == null) return "⚪";
    if (r.diasCob < critico) return "🔴";
    if (r.diasCob < warning) return "🟡";
    return "🟢";
  };

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold t-primary flex items-center gap-2">📊 Stock — Top 50 productos ({labelMes})</h2>
            <p className="text-sm t-secondary mt-1">
              Cargá el stock real en Dropi de cada producto. El sistema proyecta la cobertura (días hasta quiebre) según la velocidad de venta y avisa qué está por agotarse.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs t-secondary">
            <label className="flex items-center gap-1">Crítico &lt;<input type="number" min={1} value={critico} onChange={(e) => setCritico(Math.max(1, Number(e.target.value) || 1))} className="w-14 px-1.5 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />d</label>
            <label className="flex items-center gap-1">Vigilar &lt;<input type="number" min={1} value={warning} onChange={(e) => setWarning(Math.max(1, Number(e.target.value) || 1))} className="w-14 px-1.5 py-1 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />d</label>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Top productos" value={fmt(rows.length)} sub={`por ventas de ${labelMes}`} />
          <Kpi label="Sin stock cargado" value={fmt(sinStock)} sub="cargá para proyectar" tone="#94a3b8" />
          <Kpi label="A vigilar" value={fmt(alertas.filter((a) => a.diasCob != null && a.diasCob >= critico).length)} sub={`cobertura < ${warning}d`} tone="#eab308" />
          <Kpi label="Críticos" value={fmt(alertas.filter((a) => a.stock === 0 || (a.diasCob != null && a.diasCob < critico)).length)} sub={`cobertura < ${critico}d`} tone="#ef4444" />
        </div>
      </div>

      {/* Alertas + mensaje para Paulina */}
      {alertas.length > 0 && (
        <div className="glass-card p-5" style={{ borderTop: "3px solid #ef4444" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold" style={{ color: "#ef4444" }}>⚠️ {alertas.length} producto(s) por quebrar</h3>
            <button onClick={copiar} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white bg-orange-500 hover:opacity-90">
              {copiado ? "✓ Copiado" : "📋 Copiar mensaje para Paulina"}
            </button>
          </div>
          <pre className="mt-3 text-xs t-secondary whitespace-pre-wrap rounded-lg p-3" style={{ background: "var(--bg-kpi)" }}>{mensajePaulina}</pre>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="Buscar producto o proveedor…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded border bg-transparent t-primary" style={{ borderColor: "var(--bg-card-border)" }} />
        <span className="text-[11px] t-muted ml-auto">🔴 &lt;{critico}d · 🟡 &lt;{warning}d · 🟢 ok · ⚪ sin stock</span>
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center t-secondary">Cargando productos…</div>
      ) : error ? (
        <div className="glass-card p-8 text-center text-red-400">{error}</div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-8 text-center t-secondary">No hay datos de productos para {labelMes}. Cargá la operación del mes en General → Cargar operación.</div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="t-muted text-[11px] uppercase tracking-wider border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                <th className="text-left py-2.5 px-3">#</th>
                <th className="text-left py-2.5 px-2">Producto</th>
                <th className="text-left py-2.5 px-2">Proveedor</th>
                <th className="text-right py-2.5 px-2">Ventas {labelMes}</th>
                <th className="text-right py-2.5 px-2">Vel./día</th>
                <th className="text-right py-2.5 px-2">Stock real Dropi</th>
                <th className="text-right py-2.5 px-2">Cobertura</th>
                <th className="text-left py-2.5 px-2">Quiebre est.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.nombre} className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                  <td className="py-2 px-3 t-muted">{r.rank}</td>
                  <td className="py-2 px-2 t-primary font-medium max-w-[240px] truncate" title={r.nombre}>{semEmoji(r)} {r.nombre}</td>
                  <td className="py-2 px-2 t-secondary text-xs max-w-[120px] truncate" title={r.proveedor || ""}>{r.proveedor || "—"}</td>
                  <td className="py-2 px-2 text-right t-secondary">{fmt(r.ordenes)}</td>
                  <td className="py-2 px-2 text-right t-secondary">{fmt1(r.velocity)}</td>
                  <td className="py-2 px-2 text-right">
                    <input type="number" min={0} defaultValue={r.stock ?? ""} placeholder="—"
                      onBlur={(e) => { const v = e.target.value; if ((v === "" ? null : Math.round(Number(v))) !== r.stock) saveStock(r.nombre, v); }}
                      className="w-20 px-1.5 py-1 rounded border bg-transparent t-primary text-right" style={{ borderColor: "var(--bg-card-border)" }} />
                    {savingKey === r.nombre && <span className="ml-1 text-[10px] t-muted">…</span>}
                  </td>
                  <td className="py-2 px-2 text-right font-bold" style={{ color: semColor(r) }}>
                    {r.diasCob == null ? "—" : `${fmt1(r.diasCob)} d`}
                  </td>
                  <td className="py-2 px-2 t-secondary text-xs">{r.quiebre || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] t-muted">
        Cobertura = stock real ÷ velocidad de venta (ventas de {labelMes} ÷ {elapsed} días{esMesEnCurso ? " transcurridos" : ""}). El quiebre estimado es la fecha en que se agota al ritmo actual.
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
