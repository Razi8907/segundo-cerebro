"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface UsuarioEstrategia {
  email: string;
  nombre: string;
  telefono: string;
  comunidad: string | null;
  mov: number;
  ing: number;
  meses_activos: string[];
  segmento: string;
  falta_para_subir: number | null;
  near_upgrade: boolean;
}

interface Segmento {
  key: string;
  label: string;
  min: number;
  max: number | null;
  color: string;
  next_threshold: number | null;
  near_floor: number | null;
  count: number;
  near_count: number;
  total_mov: number;
  total_ing: number;
  usuarios: UsuarioEstrategia[];
}

interface Payload {
  updated_at?: string;
  window_note?: string;
  segmentos?: Segmento[];
}

const STRATEGIES: Record<string, { icon: string; titulo: string; acciones: string[]; herramientas: string[]; upgrade?: string[] }> = {
  iniciados: {
    icon: "🌱",
    titulo: "Iniciados (1-299 movilizadas)",
    acciones: [
      "Onboarding intensivo: video tutoriales del producto y la plataforma",
      "Llamadas semanales de seguimiento (10-15 min)",
      "Catálogo curado de los TOP 20 productos del mes para que arranquen con ganadores",
      "Pruebas gratuitas de envíos para que prueben el flujo sin riesgo",
      "Asignar mentor (DS Sabio VIP o Experto) — programa de padrino",
    ],
    herramientas: [
      "Plantillas de Meta Ads (creativos validados)",
      "Scripts de venta + objeciones comunes",
      "WhatsApp group de Iniciados (peer support)",
      "Mini-curso: Dropshipping 101 grabado",
      "Checklist diario de actividades (3-5 tareas)",
    ],
    upgrade: [
      "Capacitación 'Tu primera venta a 300': cómo escalar de 1 a 10 órdenes diarias",
      "Análisis 1:1 de sus campañas actuales con feedback accionable",
      "Lista de productos con mejor margen + menor devolución",
      "Bonus de Dropi: 50 envíos gratis si llegan a 300 mov en 30 días",
    ],
  },
  master: {
    icon: "⚡",
    titulo: "Master (300-899 movilizadas)",
    acciones: [
      "Capacitación intermedia: scaling de ads, manejo de devoluciones, retención de cliente",
      "Acceso anticipado a productos nuevos (48-72hs antes del catálogo público)",
      "Bonus por volumen: descuento en envíos cada X órdenes/mes",
      "Cuenta dedicada de Customer Success (atención prioritaria)",
      "Eventos online quincenales con casos de éxito",
    ],
    herramientas: [
      "Pixel manager + tracking avanzado",
      "Automatizaciones (chatbot WhatsApp, email post-venta)",
      "Reportes semanales personalizados",
      "Acceso a comunidad cerrada de Masters (peer learning)",
      "Plantillas de funnels probados",
    ],
    upgrade: [
      "Plan 'Camino al Experto': roadmap personalizado de 60-90 días",
      "Coaching mensual 1:1 con un Sabio VIP",
      "Acceso a proveedores premium (mejor precio, mejor stock)",
      "Bonus: comisión reducida cuando crucen 900 mov en un mes",
    ],
  },
  experto: {
    icon: "🚀",
    titulo: "Experto (900-1999 movilizadas)",
    acciones: [
      "Programa Beta Tester de features nuevas de Dropi",
      "Mejores tarifas de envío (acuerdos por volumen)",
      "Acceso a fulfillment premium (preparación y empaque prioritario)",
      "Reuniones de estrategia 1:1 mensuales con el equipo comercial",
      "Networking trimestral con otros Expertos (Zoom o presencial)",
    ],
    herramientas: [
      "CRM dedicado para gestión de clientes recurrentes",
      "Analytics avanzados: cohort retention, LTV, CAC por canal",
      "API access para integraciones propias",
      "Prioridad en resolución de incidencias (< 4hs)",
      "Catálogo extendido (productos exclusivos por categoría)",
    ],
    upgrade: [
      "Programa 'Top 10': mentoría con C-level de Dropi",
      "Plan de expansión multi-país (PY ↔ AR)",
      "Co-inversión en campañas: Dropi cubre parte del ad spend si validan ROAS",
      "Bonus: revenue share por referir a nuevos DSs que se vuelvan Master+",
    ],
  },
  sabio_vip: {
    icon: "👑",
    titulo: "Sabio VIP (2000+ movilizadas)",
    acciones: [
      "Programa de embajadores: revenue share por DSs referidos que escalen",
      "Mejores condiciones comerciales del mercado",
      "Beta de proveedores exclusivos antes que cualquier otro",
      "Eventos presenciales (cumbres anuales de DSs)",
      "Acceso directo a C-level de Dropi (canal privado)",
    ],
    herramientas: [
      "API completa + white label para marca propia",
      "Soporte 24/7 dedicado",
      "Fulfillment exclusivo con SLA garantizado",
      "Dashboard ejecutivo con métricas en tiempo real",
      "Acceso a financiamiento de stock (cash advance)",
    ],
  },
};

export default function EstrategiaUsuarios({ country }: { country: "ar" | "py" }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  const [showStrategy, setShowStrategy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterNear, setFilterNear] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data/estrategia?country=${country}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredSegments = useMemo(() => {
    if (!data?.segmentos) return [];
    return data.segmentos.map((s) => {
      const users = s.usuarios.filter((u) => {
        if (filterNear && !u.near_upgrade) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!u.email.toLowerCase().includes(q) &&
              !u.nombre.toLowerCase().includes(q) &&
              !(u.comunidad || "").toLowerCase().includes(q) &&
              !u.telefono.includes(search)) return false;
        }
        return true;
      });
      return { ...s, usuariosFiltered: users };
    });
  }, [data, search, filterNear]);

  const globalNearCount = useMemo(() => {
    if (!data?.segmentos) return 0;
    return data.segmentos.reduce((s, seg) => s + seg.near_count, 0);
  }, [data]);

  const totalUsers = useMemo(() => {
    if (!data?.segmentos) return 0;
    return data.segmentos.reduce((s, seg) => s + seg.count, 0);
  }, [data]);

  const totalMov = useMemo(() => {
    if (!data?.segmentos) return 0;
    return data.segmentos.reduce((s, seg) => s + seg.total_mov, 0);
  }, [data]);

  const exportCsv = useCallback((users: UsuarioEstrategia[], filename: string) => {
    const header = "Email,Nombre,Teléfono,Comunidad,Segmento,Movilizadas,Ingresadas,Falta_para_subir,Meses_activos\n";
    const lines = users.map((u) => {
      const safe = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
      return [safe(u.email), safe(u.nombre), safe(u.telefono), safe(u.comunidad || ""), u.segmento, u.mov, u.ing, u.falta_para_subir ?? "", safe(u.meses_activos.join("|"))].join(",");
    }).join("\n");
    const blob = new Blob(["﻿" + header + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (loading) return <div className="glass-card p-6 t-muted text-sm">Cargando estrategia de usuarios…</div>;
  if (error) return <div className="glass-card p-6 text-red-400 text-sm">⚠️ {error}</div>;
  if (!data || !data.segmentos) return <div className="glass-card p-6 t-muted">Sin datos cargados.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 border border-purple-500/20" style={{ background: "var(--bg-card)" }}>
        <h1 className="text-lg font-bold t-primary mb-1">🎯 Estrategia de Usuarios — {country.toUpperCase()}</h1>
        <p className="text-[11px] t-muted">
          Segmentación por movilizadas lifetime de toda la base activa. Sirve para definir el siguiente paso por nivel
          y enfocar esfuerzo en los <strong className="text-amber-300">próximos a subir</strong> (los más rentables de empujar).
        </p>
        {data.window_note && <p className="text-[10px] text-amber-300 mt-2">ⓘ {data.window_note}</p>}
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Usuarios activos totales" value={totalUsers.toLocaleString("es-AR")} color="#a78bfa" />
        <Kpi label="Movilizadas lifetime" value={totalMov.toLocaleString("es-AR")} color="#f97316" />
        <Kpi label="🚀 Próximos a subir nivel" value={globalNearCount.toLocaleString("es-AR")} color="#fbbf24"
          sub="los más rentables de trabajar HOY" />
        <Kpi label="Sabio VIP" value={(data.segmentos.find((s) => s.key === "sabio_vip")?.count || 0).toLocaleString("es-AR")} color="#f59e0b" sub="top de la base" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="🔍 Buscar por email, nombre, teléfono o comunidad…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] text-xs px-3 py-2 rounded-lg border border-gray-700 bg-transparent t-primary outline-none focus:border-purple-500"
        />
        <button
          onClick={() => setFilterNear(!filterNear)}
          className={`text-xs px-3 py-2 rounded-lg border ${
            filterNear
              ? "bg-amber-500/20 border-amber-500 text-amber-300"
              : "border-gray-700 t-secondary hover:border-amber-500/40"
          }`}
        >
          {filterNear ? "🚀 Solo próximos a subir" : "🚀 Filtrar próximos a subir"}
        </button>
      </div>

      {/* Segmentos */}
      <div className="space-y-3">
        {filteredSegments.map((seg) => (
          <SegmentBlock
            key={seg.key}
            seg={seg}
            usuariosFiltered={seg.usuariosFiltered}
            isOpen={openSegment === seg.key}
            onToggle={() => setOpenSegment(openSegment === seg.key ? null : seg.key)}
            showStrategy={showStrategy === seg.key}
            onToggleStrategy={() => setShowStrategy(showStrategy === seg.key ? null : seg.key)}
            onExport={() => exportCsv(seg.usuarios, `estrategia_${country}_${seg.key}.csv`)}
            onExportNear={() => exportCsv(seg.usuarios.filter((u) => u.near_upgrade), `estrategia_${country}_${seg.key}_cerca_subir.csv`)}
          />
        ))}
      </div>

      {data.updated_at && (
        <p className="text-[10px] t-muted text-center">Actualizado: {new Date(data.updated_at).toLocaleString("es-AR")}</p>
      )}
    </div>
  );
}

function SegmentBlock({
  seg, usuariosFiltered, isOpen, onToggle, showStrategy, onToggleStrategy, onExport, onExportNear,
}: {
  seg: Segmento & { usuariosFiltered: UsuarioEstrategia[] };
  usuariosFiltered: UsuarioEstrategia[];
  isOpen: boolean; onToggle: () => void;
  showStrategy: boolean; onToggleStrategy: () => void;
  onExport: () => void; onExportNear: () => void;
}) {
  const strat = STRATEGIES[seg.key];
  const rangoLabel = seg.max ? `${seg.min}-${seg.max - 1}` : `${seg.min}+`;
  return (
    <div className="rounded-xl border" style={{ background: "var(--bg-card)", borderColor: seg.color + "40" }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold t-primary mb-1">
              {strat?.icon || "📊"} {seg.label}{" "}
              <span className="text-xs t-muted font-normal">({rangoLabel} movilizadas lifetime)</span>
            </h2>
            <div className="flex flex-wrap gap-3 text-[11px] t-muted">
              <span><strong className="t-primary text-base" style={{ color: seg.color }}>{seg.count.toLocaleString("es-AR")}</strong> usuarios</span>
              <span>·</span>
              <span><strong className="text-orange-300">{seg.total_mov.toLocaleString("es-AR")}</strong> mov totales</span>
              <span>·</span>
              <span><strong className="text-cyan-300">{seg.total_ing.toLocaleString("es-AR")}</strong> ing totales</span>
              {seg.near_count > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-300">🚀 <strong>{seg.near_count}</strong> próximos a subir</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onToggleStrategy}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
              {showStrategy ? "Ocultar estrategia" : "💡 Estrategia"}
            </button>
            <button onClick={onExport}
              className="text-[10px] px-2 py-1.5 rounded border border-gray-700 t-secondary hover:border-orange-500/40">
              ⬇️ CSV
            </button>
            <button onClick={onToggle}
              className="text-[11px] px-3 py-1.5 rounded-lg border" style={{ borderColor: seg.color, color: seg.color }}>
              {isOpen ? "Ocultar usuarios" : "Ver usuarios"}
            </button>
          </div>
        </div>
      </div>

      {/* Estrategia */}
      {showStrategy && strat && (
        <div className="px-4 pb-4 space-y-3">
          <div className="rounded-lg p-3 border border-purple-500/20" style={{ background: "var(--bg-input)" }}>
            <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2">🎯 Acciones de fortalecimiento</h3>
            <ul className="space-y-1 text-[11px] t-secondary">
              {strat.acciones.map((a, i) => <li key={i}>• {a}</li>)}
            </ul>
          </div>
          <div className="rounded-lg p-3 border border-cyan-500/20" style={{ background: "var(--bg-input)" }}>
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">🛠️ Herramientas recomendadas</h3>
            <ul className="space-y-1 text-[11px] t-secondary">
              {strat.herramientas.map((h, i) => <li key={i}>• {h}</li>)}
            </ul>
          </div>
          {strat.upgrade && (
            <div className="rounded-lg p-3 border border-amber-500/30" style={{ background: "rgba(251,191,36,0.05)" }}>
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">🚀 Para los que están cerca del siguiente nivel</h3>
              <ul className="space-y-1 text-[11px] t-secondary">
                {strat.upgrade.map((u, i) => <li key={i}>• {u}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Cerca de subir (mini-cuadro destacado) */}
      {seg.near_count > 0 && (
        <div className="px-4 pb-4">
          <div className="rounded-lg p-3 border border-amber-500/40" style={{ background: "rgba(251,191,36,0.08)" }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-sm font-bold text-amber-300">🚀 {seg.near_count} cerca del siguiente nivel</h3>
                <p className="text-[10px] t-muted">Faltan ≤ {seg.next_threshold ? (seg.next_threshold - (seg.near_floor || 0)) : "?"} órdenes para pasar al siguiente segmento. Foco máximo.</p>
              </div>
              <button onClick={onExportNear}
                className="text-[10px] px-2 py-1 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0">
                ⬇️ CSV cerca de subir
              </button>
            </div>
            <UserTable users={seg.usuarios.filter((u) => u.near_upgrade)} color={seg.color} highlightNear />
          </div>
        </div>
      )}

      {/* Tabla expandida */}
      {isOpen && (
        <div className="px-4 pb-4">
          <UserTable users={usuariosFiltered} color={seg.color} />
          {usuariosFiltered.length === 0 && (
            <p className="text-xs t-muted text-center py-4">Sin usuarios que coincidan con los filtros.</p>
          )}
        </div>
      )}
    </div>
  );
}

function UserTable({ users, color, highlightNear = false }: { users: UsuarioEstrategia[]; color: string; highlightNear?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? users : users.slice(0, 50);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border" style={{ background: "var(--bg-input)", borderColor: color + "20" }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700 text-[10px] t-muted">
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Email</th>
              <th className="text-left py-2 px-2">Nombre</th>
              <th className="text-left py-2 px-2">Teléfono</th>
              <th className="text-left py-2 px-2">Comunidad</th>
              <th className="text-right py-2 px-2">Ing</th>
              <th className="text-right py-2 px-2">Mov</th>
              <th className="text-right py-2 px-2">Faltan p/ subir</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u, i) => (
              <tr key={u.email + i} className={`border-b border-gray-800/40 hover:bg-orange-500/5 ${highlightNear || u.near_upgrade ? "bg-amber-500/5" : ""}`}>
                <td className="py-2 px-2 t-muted text-[10px]">{i + 1}</td>
                <td className="py-2 px-2 t-primary font-mono text-[10px]">{u.email}</td>
                <td className="py-2 px-2 t-secondary max-w-[160px] truncate" title={u.nombre}>{u.nombre}</td>
                <td className="py-2 px-2 t-muted font-mono">{u.telefono || "—"}</td>
                <td className="py-2 px-2 t-muted text-[10px] max-w-[160px] truncate" title={u.comunidad || ""}>{u.comunidad || "—"}</td>
                <td className="py-2 px-2 text-right font-mono text-cyan-300">{u.ing.toLocaleString("es-AR")}</td>
                <td className="py-2 px-2 text-right font-mono font-bold text-orange-300">{u.mov.toLocaleString("es-AR")}</td>
                <td className="py-2 px-2 text-right font-mono">
                  {u.falta_para_subir !== null ? (
                    <span className={u.near_upgrade ? "text-amber-300 font-bold" : "t-muted"}>
                      {u.falta_para_subir.toLocaleString("es-AR")}
                    </span>
                  ) : <span className="t-muted">top</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length > 50 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-[11px] text-orange-400 hover:underline">
          Ver todos ({users.length.toLocaleString("es-AR")})
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
