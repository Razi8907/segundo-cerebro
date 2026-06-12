"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface UserDetail {
  email: string;
  nombre: string;
  telefono: string;
  comunidad: string | null;
  orders: number;
}

interface Segment2Bin {
  count: number;
  usuarios: UserDetail[];
}

interface ComunidadEntry { comunidad: string; registrados: number; activos: number; pct_activacion: number }

interface CohortData {
  total_registrados: number;
  total_ordenes: number;
  activos_total: number;
  inactivos_total: number;
  windows_note?: string;
  segmento_1_pareto75: { count: number; ordenes_acumuladas: number; pct_ordenes: number; usuarios: UserDetail[] };
  segmento_2_bins: Record<string, Segment2Bin>;
  segmento_3_1_a_19: { count: number; usuarios: UserDetail[] };
  segmento_4_cero: { count: number; usuarios: UserDetail[] };
  comunidades?: ComunidadEntry[];
}

interface Payload {
  updated_at?: string;
  data_window?: string;
  cohorts?: Record<string, CohortData>;
  comunidades_globales?: ComunidadEntry[];
}

const MESES_ORDER = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MES_LABEL: Record<string, string> = {
  enero:"Enero", febrero:"Febrero", marzo:"Marzo", abril:"Abril",
  mayo:"Mayo", junio:"Junio", julio:"Julio", agosto:"Agosto",
  septiembre:"Septiembre", octubre:"Octubre", noviembre:"Noviembre", diciembre:"Diciembre",
};

type SegmentKey = "seg1" | "seg2" | "seg3" | "seg4";

export default function UsuariosRegistrados({ country }: { country: "ar" | "py" }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMes, setSelectedMes] = useState<string | null>(null);
  const [expandedSegment, setExpandedSegment] = useState<SegmentKey | null>(null);
  const [expandedBin, setExpandedBin] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/data/usuarios?country=${country}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPayload(data);
    } catch (e: any) {
      setError(e.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const meses = useMemo(() => {
    if (!payload?.cohorts) return [];
    return MESES_ORDER.filter((m) => payload.cohorts && m in payload.cohorts);
  }, [payload]);

  // Default month: most recent available
  useEffect(() => {
    if (!selectedMes && meses.length > 0) setSelectedMes(meses[meses.length - 1]);
  }, [meses, selectedMes]);

  const cohort = selectedMes && payload?.cohorts?.[selectedMes];

  // Global totals across all cohorts
  const globalSummary = useMemo(() => {
    if (!payload?.cohorts) return null;
    let registrados = 0, activos = 0, inactivos = 0, ordenes = 0;
    let pareto = 0, seg2 = 0, seg3 = 0, seg4 = 0;
    Object.values(payload.cohorts).forEach((c) => {
      registrados += c.total_registrados;
      activos += c.activos_total;
      inactivos += c.inactivos_total;
      ordenes += c.total_ordenes;
      pareto += c.segmento_1_pareto75.count;
      seg2 += Object.values(c.segmento_2_bins).reduce((s, b) => s + b.count, 0);
      seg3 += c.segmento_3_1_a_19.count;
      seg4 += c.segmento_4_cero.count;
    });
    return { registrados, activos, inactivos, ordenes, pareto, seg2, seg3, seg4 };
  }, [payload]);

  const filterUsers = useCallback((users: UserDetail[]) => {
    if (!search.trim()) return users;
    const s = search.toLowerCase();
    return users.filter((u) =>
      u.email.toLowerCase().includes(s) ||
      u.nombre.toLowerCase().includes(s) ||
      (u.comunidad || "").toLowerCase().includes(s) ||
      u.telefono.includes(s)
    );
  }, [search]);

  const exportCsv = useCallback((users: UserDetail[], filename: string) => {
    const header = "Email,Nombre,Teléfono,Comunidad,Órdenes\n";
    const lines = users.map((u) => {
      const safe = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
      return [safe(u.email), safe(u.nombre), safe(u.telefono), safe(u.comunidad || ""), u.orders].join(",");
    }).join("\n");
    const blob = new Blob(["﻿" + header + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (loading) return <div className="glass-card p-6 t-muted text-sm">Cargando usuarios registrados…</div>;
  if (error) return <div className="glass-card p-6 text-red-400 text-sm">⚠️ {error}</div>;
  if (!payload || !cohort || !selectedMes) return <div className="glass-card p-6 t-muted">Sin datos cargados.</div>;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <h2 className="text-base font-bold t-primary mb-1">👥 Usuarios Registrados / Activos — {country.toUpperCase()} 2026</h2>
        <p className="text-[11px] t-muted">
          Cruce de los usuarios registrados en Dropi vs los que efectivamente generaron órdenes en segundo cerebro (Apr–Jun observados).
          {payload.data_window && <span className="block mt-1 text-amber-300">ⓘ Ventana de datos: {payload.data_window}</span>}
        </p>
      </div>

      {/* KPIs globales */}
      {globalSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Kpi label="Total registrados" value={globalSummary.registrados.toLocaleString("es-AR")} color="#a78bfa" />
          <Kpi label="Activos reales" value={globalSummary.activos.toLocaleString("es-AR")} color="#10b981" sub={`${(globalSummary.activos / globalSummary.registrados * 100).toFixed(1)}% activación`} />
          <Kpi label="Sin órdenes" value={globalSummary.inactivos.toLocaleString("es-AR")} color="#dc2626" sub={`${(globalSummary.inactivos / globalSummary.registrados * 100).toFixed(1)}%`} />
          <Kpi label="Órdenes generadas" value={globalSummary.ordenes.toLocaleString("es-AR")} color="#f97316" />
          <Kpi label="Pareto 75%" value={globalSummary.pareto.toLocaleString("es-AR")} color="#10b981" sub="VIP" />
          <Kpi label="20+ órdenes" value={globalSummary.seg2.toLocaleString("es-AR")} color="#0891b2" sub="medianos" />
          <Kpi label="1-19 órdenes" value={globalSummary.seg3.toLocaleString("es-AR")} color="#f59e0b" sub="bajos" />
          <Kpi label="0 órdenes" value={globalSummary.seg4.toLocaleString("es-AR")} color="#dc2626" sub="dormidos" />
        </div>
      )}

      {/* Tabs por mes */}
      <div className="flex flex-wrap gap-2">
        {meses.map((m) => {
          const c = payload.cohorts![m];
          const pct = c.total_registrados > 0 ? (c.activos_total / c.total_registrados) * 100 : 0;
          const isSel = selectedMes === m;
          return (
            <button key={m} onClick={() => { setSelectedMes(m); setExpandedSegment(null); setExpandedBin(null); setSearch(""); }}
              className={`text-xs px-3 py-2 rounded-lg border transition-all ${
                isSel ? "bg-orange-500 text-white border-orange-500 shadow shadow-orange-500/20"
                      : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40"
              }`}>
              {MES_LABEL[m]} <span className="text-[10px] opacity-75 ml-1">({c.total_registrados})</span>
              <span className="text-[10px] block">{pct.toFixed(0)}% real</span>
            </button>
          );
        })}
      </div>

      {/* Resumen del cohort seleccionado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label={`Registrados ${MES_LABEL[selectedMes]}`} value={cohort.total_registrados.toLocaleString("es-AR")} color="#a78bfa" />
        <Kpi label={`Órdenes en ${MES_LABEL[selectedMes]}`} value={cohort.total_ordenes.toLocaleString("es-AR")} color="#f97316" />
        <Kpi label="Activos reales" value={cohort.activos_total.toLocaleString("es-AR")} color="#10b981" sub={`${(cohort.activos_total / cohort.total_registrados * 100).toFixed(1)}%`} />
        <Kpi label="Sin órdenes" value={cohort.inactivos_total.toLocaleString("es-AR")} color="#dc2626" sub={`${(cohort.inactivos_total / cohort.total_registrados * 100).toFixed(1)}%`} />
      </div>

      {cohort.windows_note && (
        <p className="text-[10px] text-amber-300 px-2">ⓘ {cohort.windows_note}</p>
      )}

      {/* SEGMENTO 1 — Pareto 75% */}
      <SegmentCard
        title={`[1] ⭐ Pareto 75% del movimiento`}
        subtitle={`${cohort.segmento_1_pareto75.count} usuarios generan el ${cohort.segmento_1_pareto75.pct_ordenes}% del total de órdenes del cohort (${cohort.segmento_1_pareto75.ordenes_acumuladas.toLocaleString("es-AR")} órdenes)`}
        color="#10b981"
        count={cohort.segmento_1_pareto75.count}
        isExpanded={expandedSegment === "seg1"}
        onToggle={() => { setExpandedSegment(expandedSegment === "seg1" ? null : "seg1"); setExpandedBin(null); setSearch(""); }}
        onExport={() => exportCsv(cohort.segmento_1_pareto75.usuarios, `pareto75_${selectedMes}_${country}.csv`)}
      >
        {expandedSegment === "seg1" && (
          <UserList users={filterUsers(cohort.segmento_1_pareto75.usuarios)} search={search} setSearch={setSearch} />
        )}
      </SegmentCard>

      {/* SEGMENTO 2 — 20+ órdenes en bins de 10 */}
      <SegmentCard
        title={`[2] 📊 20+ órdenes (fuera del pareto)`}
        subtitle={`Bins de 10. Total: ${Object.values(cohort.segmento_2_bins).reduce((s, b) => s + b.count, 0)} usuarios.`}
        color="#0891b2"
        count={Object.values(cohort.segmento_2_bins).reduce((s, b) => s + b.count, 0)}
        isExpanded={expandedSegment === "seg2"}
        onToggle={() => { setExpandedSegment(expandedSegment === "seg2" ? null : "seg2"); setExpandedBin(null); setSearch(""); }}
        onExport={() => {
          const all: UserDetail[] = [];
          Object.values(cohort.segmento_2_bins).forEach((b) => all.push(...b.usuarios));
          exportCsv(all, `bins10_${selectedMes}_${country}.csv`);
        }}
      >
        {expandedSegment === "seg2" && (
          <div className="space-y-2">
            {Object.entries(cohort.segmento_2_bins)
              .sort((a, b) => parseInt(a[0].split("-")[0]) - parseInt(b[0].split("-")[0]))
              .map(([binLabel, binData]) => (
                <div key={binLabel} className="rounded-lg border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
                  <button
                    onClick={() => setExpandedBin(expandedBin === binLabel ? null : binLabel)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-orange-500/5"
                  >
                    <span className="text-xs t-primary font-medium">Bin {binLabel} órdenes — {binData.count} usuarios</span>
                    <span className="text-[10px] t-muted">{expandedBin === binLabel ? "▼" : "▶"}</span>
                  </button>
                  {expandedBin === binLabel && (
                    <div className="p-3 pt-0">
                      <UserList users={filterUsers(binData.usuarios)} search={search} setSearch={setSearch} />
                    </div>
                  )}
                </div>
              ))}
            {Object.keys(cohort.segmento_2_bins).length === 0 && (
              <p className="text-xs t-muted text-center py-4">Sin usuarios en este segmento para este mes.</p>
            )}
          </div>
        )}
      </SegmentCard>

      {/* SEGMENTO 3 — 1 a 19 órdenes */}
      <SegmentCard
        title={`[3] 📉 1 a 19 órdenes`}
        subtitle={`Volumen bajo — candidatos a despertar.`}
        color="#f59e0b"
        count={cohort.segmento_3_1_a_19.count}
        isExpanded={expandedSegment === "seg3"}
        onToggle={() => { setExpandedSegment(expandedSegment === "seg3" ? null : "seg3"); setExpandedBin(null); setSearch(""); }}
        onExport={() => exportCsv(cohort.segmento_3_1_a_19.usuarios, `bajos_${selectedMes}_${country}.csv`)}
      >
        {expandedSegment === "seg3" && (
          <UserList users={filterUsers(cohort.segmento_3_1_a_19.usuarios)} search={search} setSearch={setSearch} />
        )}
      </SegmentCard>

      {/* SEGMENTO 4 — 0 órdenes */}
      <SegmentCard
        title={`[4] 💤 Registrados sin órdenes`}
        subtitle={`Nunca operaron en la ventana observada.`}
        color="#dc2626"
        count={cohort.segmento_4_cero.count}
        isExpanded={expandedSegment === "seg4"}
        onToggle={() => { setExpandedSegment(expandedSegment === "seg4" ? null : "seg4"); setExpandedBin(null); setSearch(""); }}
        onExport={() => exportCsv(cohort.segmento_4_cero.usuarios, `cero_${selectedMes}_${country}.csv`)}
      >
        {expandedSegment === "seg4" && (
          <UserList users={filterUsers(cohort.segmento_4_cero.usuarios)} search={search} setSearch={setSearch} />
        )}
      </SegmentCard>

      {/* Comunidades del cohort seleccionado */}
      {cohort.comunidades && cohort.comunidades.length > 0 && (
        <ComunidadesCard
          title={`🏘️ Comunidades — registrados en ${MES_LABEL[selectedMes]}`}
          subtitle={`De los usuarios registrados en ${MES_LABEL[selectedMes]}, qué comunidad los trajo y cuántos activaron.`}
          comunidades={cohort.comunidades}
        />
      )}

      {/* Comunidades globales (todo el año) */}
      {payload.comunidades_globales && payload.comunidades_globales.length > 0 && (
        <ComunidadesCard
          title="🌐 Comunidades — Global 2026"
          subtitle="Ranking acumulado de todas las cohortes. Activación = al menos una orden en la ventana observada."
          comunidades={payload.comunidades_globales}
        />
      )}

      {payload.updated_at && (
        <p className="text-[10px] t-muted text-center">Actualizado: {new Date(payload.updated_at).toLocaleString("es-AR")}</p>
      )}
    </div>
  );
}

function ComunidadesCard({ title, subtitle, comunidades }: { title: string; subtitle: string; comunidades: ComunidadEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return comunidades;
    const s = search.toLowerCase();
    return comunidades.filter((c) => c.comunidad.toLowerCase().includes(s));
  }, [comunidades, search]);
  const visible = showAll ? filtered : filtered.slice(0, 10);

  const exportCsv = () => {
    const header = "Comunidad,Registrados,Activos,% Activación\n";
    const lines = comunidades.map((c) => {
      const safe = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
      return [safe(c.comunidad), c.registrados, c.activos, `${c.pct_activacion}%`].join(",");
    }).join("\n");
    const blob = new Blob(["﻿" + header + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = title.replace(/[^a-z0-9]+/gi, "_") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl p-4 border border-purple-500/20" style={{ background: "var(--bg-card)" }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-bold t-primary mb-1">{title}</h3>
          <p className="text-[11px] t-muted">{subtitle}</p>
        </div>
        <button onClick={exportCsv} className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-orange-500/40 shrink-0">⬇️ CSV</button>
      </div>
      <input type="text" placeholder="🔍 Buscar comunidad…" value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-purple-500 mb-3" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-[10px] t-muted">
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Comunidad (referidor)</th>
              <th className="text-right py-2 px-2">Registrados</th>
              <th className="text-right py-2 px-2">Activos</th>
              <th className="text-right py-2 px-2">% Activación</th>
              <th className="text-left py-2 px-2 w-32">Barra</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => {
              const color = c.pct_activacion >= 40 ? "#10b981" : c.pct_activacion >= 20 ? "#f59e0b" : "#dc2626";
              return (
                <tr key={c.comunidad + i} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                  <td className="py-2 px-2 t-muted text-[10px]">{i + 1}</td>
                  <td className="py-2 px-2 t-primary font-mono text-[11px] max-w-[280px] truncate" title={c.comunidad}>{c.comunidad}</td>
                  <td className="py-2 px-2 text-right font-mono">{c.registrados.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold" style={{ color }}>{c.activos.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold" style={{ color }}>{c.pct_activacion}%</td>
                  <td className="py-2 px-2">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full" style={{ width: `${Math.min(c.pct_activacion, 100)}%`, background: color }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="py-4 px-3 text-center t-muted text-xs">Sin comunidades que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 10 && !showAll && (
        <button onClick={() => setShowAll(true)} className="mt-2 text-[11px] text-orange-400 hover:underline">
          Ver todas ({filtered.length.toLocaleString("es-AR")})
        </button>
      )}
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3 border border-cyan-500/10" style={{ background: "var(--bg-card)" }}>
      <p className="text-[10px] t-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] t-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function SegmentCard({
  title, subtitle, color, count, isExpanded, onToggle, onExport, children,
}: {
  title: string; subtitle: string; color: string; count: number;
  isExpanded: boolean; onToggle: () => void; onExport: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border" style={{ background: "var(--bg-card)", borderColor: color + "30" }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold t-primary mb-1">{title}</h3>
            <p className="text-[11px] t-muted">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-bold" style={{ color }}>{count.toLocaleString("es-AR")}</span>
            {count > 0 && (
              <button onClick={onExport} className="text-[10px] px-2 py-1 rounded border border-gray-700 t-secondary hover:border-orange-500/40">
                ⬇️ CSV
              </button>
            )}
            <button onClick={onToggle} className="text-[11px] px-3 py-1.5 rounded-lg border" style={{ borderColor: color + "40", color }}>
              {isExpanded ? "Ocultar" : "Ver usuarios"}
            </button>
          </div>
        </div>
      </div>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function UserList({ users, search, setSearch }: { users: UserDetail[]; search: string; setSearch: (s: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? users : users.slice(0, 100);
  return (
    <div className="space-y-2">
      <input type="text" placeholder="🔍 Buscar por email, nombre, teléfono o comunidad…" value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-orange-500" />
      <div className="overflow-x-auto rounded-lg border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-[10px] t-muted">
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Email</th>
              <th className="text-left py-2 px-3">Nombre</th>
              <th className="text-left py-2 px-3">Teléfono</th>
              <th className="text-left py-2 px-3">Comunidad</th>
              <th className="text-right py-2 px-3">Órdenes</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u, i) => (
              <tr key={u.email + i} className="border-b border-gray-800/40 hover:bg-orange-500/5">
                <td className="py-2 px-3 t-muted text-[10px]">{i + 1}</td>
                <td className="py-2 px-3 t-primary font-mono text-[11px]">{u.email}</td>
                <td className="py-2 px-3 t-secondary max-w-[180px] truncate" title={u.nombre}>{u.nombre}</td>
                <td className="py-2 px-3 t-muted font-mono">{u.telefono}</td>
                <td className="py-2 px-3 t-muted text-[10px] max-w-[200px] truncate" title={u.comunidad || ""}>{u.comunidad || "—"}</td>
                <td className="py-2 px-3 text-right font-mono font-bold text-orange-300">{u.orders.toLocaleString("es-AR")}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="py-4 px-3 text-center t-muted text-xs">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {users.length > 100 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-[11px] text-orange-400 hover:underline">
          Ver todos ({users.length.toLocaleString("es-AR")})
        </button>
      )}
    </div>
  );
}
