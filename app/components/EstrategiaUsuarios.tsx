"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MesFilter } from "../types";

interface MesData { ing: number; mov: number; }

interface UsuarioBase {
  email: string;
  nombre: string;
  telefono: string;
  comunidad: string | null;
  por_mes: Record<string, MesData>;
}

interface SegmentConfig {
  key: string; label: string;
  min: number; max: number | null;
  color: string;
  next: number | null;
  near_floor: number | null;
}

interface Payload {
  updated_at?: string;
  window_note?: string;
  segments_config: SegmentConfig[];
  meses_disponibles: string[];
  usuarios: UsuarioBase[];
}

interface UsuarioComputed extends UsuarioBase {
  mov: number;          // mov en la ventana seleccionada
  ing: number;          // ing en la ventana seleccionada
  mov_lifetime: number; // mov acumulado en toda la base (todos los meses)
  segmento: string | null;
  falta_para_subir: number | null;
  near_upgrade: boolean;
}

const Q1_MESES = new Set(["enero","febrero","marzo"]);
const Q2_MESES = new Set(["abril","mayo","junio"]);

const STRATEGIES: Record<string, { icon: string; titulo: string; acciones: string[]; herramientas: string[]; upgrade?: string[] }> = {
  // ===== AR-specific segments =====
  esporadicos: {
    icon: "🎯",
    titulo: "Dropshipper Esporádicos (1-10 movilizadas)",
    acciones: [
      "Diagnóstico inicial: por qué movieron tan poco — falta de tráfico, producto débil, falla en checkout, abandono de carrito",
      "Llamada de bienvenida personalizada en las primeras 48hs de su primera venta",
      "Reto 'Primera Decena': desafío en 7-14 días de pasar a 11+ órdenes con coaching diario",
      "Catálogo curado de 5 productos winners de bajo riesgo y alto margen",
      "Mini-mentoría grupal semanal (15 min) — peer learning con otros Esporádicos",
    ],
    herramientas: [
      "Creativos de Meta/TikTok validados (plug & play)",
      "Audiencias semilla compartidas de Dropi por nicho",
      "Plantilla de respuesta automática WhatsApp post-venta",
      "Calculadora de ROAS y break-even",
      "WhatsApp group de Esporádicos para compartir aprendizajes",
    ],
    upgrade: [
      "Cuando llegan a 8+ mov: invitación al programa 'En Desarrollo' con menu intensivo",
      "50% de descuento en fulfillment los siguientes 20 envíos si cruzan el umbral",
      "Sesión 1:1 de optimización de campaña con un Master",
      "Acceso a 3 productos premium del catálogo restringido por una semana",
    ],
  },
  master_ar: {
    icon: "⚡",
    titulo: "Master AR (66-299 movilizadas)",
    acciones: [
      "Capacitación avanzada: scaling de presupuestos, gestión de retención de cliente y LTV",
      "Acceso anticipado a productos nuevos (48-72hs antes del catálogo público)",
      "Bonus por volumen: descuento en fletes cada X órdenes/mes",
      "Cuenta dedicada de Customer Success con QBR (quarterly business review)",
      "Eventos online quincenales con casos de éxito + Q&A con C-level",
    ],
    herramientas: [
      "Pixel manager + tracking server-side (CAPI)",
      "Automatizaciones: chatbot WhatsApp + email post-venta",
      "Reportes semanales personalizados con benchmarking por nicho",
      "Acceso a la comunidad cerrada Master (peer learning)",
      "Banco de funnels probados y templates de landing pages",
    ],
    upgrade: [
      "Cuando llegan a 270+: roadmap 'Camino al Sabio VIP' (300+ mov/mes)",
      "Coaching mensual 1:1 con un Sabio VIP de Dropi",
      "Acceso a proveedores premium con stock prioritario",
      "Comisión reducida los primeros 100 envíos si cruzan el umbral",
    ],
  },
  sabio_vip_ar: {
    icon: "👑",
    titulo: "Sabio VIP AR (300+ movilizadas)",
    acciones: [
      "Programa de embajadores: revenue share por DSs referidos que escalen a Master+",
      "Mejores condiciones comerciales (fletes, comisiones, plazos)",
      "Beta de proveedores exclusivos antes que cualquier otro DS",
      "Invitación a eventos presenciales y cumbres anuales de Dropi",
      "Acceso directo a C-level via canal privado",
    ],
    herramientas: [
      "API completa + posibilidad de integración white label",
      "Soporte 24/7 con SLA garantizado (<2hs)",
      "Fulfillment exclusivo con preparación prioritaria",
      "Dashboard ejecutivo con métricas en tiempo real",
      "Acceso a financiamiento de stock (cash advance hasta cierto monto)",
    ],
  },
  en_desarrollo: {
    icon: "📈",
    titulo: "Dropshipper en Desarrollo (11-65 movilizadas)",
    acciones: [
      "Auditoría mensual de campañas: CTR, CPM, conversion rate, devoluciones",
      "Capacitación intermedia: optimización de Meta Ads, retargeting básico, mejora de creativos",
      "Asignación a un Customer Success específico (no cuenta dedicada todavía)",
      "Acceso a la comunidad cerrada 'En Desarrollo' (Slack o Discord)",
      "Reto mensual con bonus: pasar a 60+ mov en 30 días = envíos bonificados",
    ],
    herramientas: [
      "Pixel manager con eventos custom (purchase, add_to_cart, lead)",
      "Plantillas de retargeting + lookalike audiences",
      "Reporte semanal automatizado con KPIs clave",
      "Acceso a banco de creativos probados (200+ assets)",
      "Mini-curso: 'De 10 a 100 órdenes/mes' (5 módulos grabados)",
    ],
    upgrade: [
      "Cuando llegan a 55+: roadmap personalizado para cruzar a Master (66+)",
      "Coaching mensual 1:1 con un Sabio VIP",
      "Acceso anticipado a productos nuevos del catálogo",
      "Comisión reducida los primeros 50 envíos del mes siguiente si suben",
    ],
  },
  // ===== PY-specific (also generic) =====
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

const MES_LABEL: Record<string, string> = {
  q1: "Q1 (Ene+Feb+Mar)", q2: "Q2 (Abr+May+Jun)",
  enero: "Enero", febrero: "Febrero", marzo: "Marzo",
  abril: "Abril", mayo: "Mayo", junio: "Junio",
};

function getMesesForWindow(mesFilter?: MesFilter | null): string[] {
  if (!mesFilter) return ["enero","febrero","marzo","abril","mayo","junio"];
  if (mesFilter === "q1") return ["enero","febrero","marzo"];
  if (mesFilter === "q2") return ["abril","mayo","junio"];
  return [mesFilter];
}

function classifyUser(mov: number, segments: SegmentConfig[]): { segmento: string | null; falta: number | null; near: boolean } {
  if (mov < 1) return { segmento: null, falta: null, near: false };
  for (const s of segments) {
    const max = s.max ?? Number.POSITIVE_INFINITY;
    if (mov >= s.min && mov < max) {
      const falta = s.next ? s.next - mov : null;
      const near = s.near_floor !== null && mov >= s.near_floor;
      return { segmento: s.key, falta, near };
    }
  }
  return { segmento: null, falta: null, near: false };
}

export default function EstrategiaUsuarios({ country, mesFilter }: { country: "ar" | "py"; mesFilter?: MesFilter | null }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  const [showStrategy, setShowStrategy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterNear, setFilterNear] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data/estrategia?country=${country}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, [country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rebuildNow = useCallback(async () => {
    setRebuilding(true); setRebuildMsg("");
    try {
      const res = await fetch(`/api/data/estrategia/rebuild?country=${country}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRebuildMsg(`✅ Reconstruido — ${json.total_usuarios} usuarios.`);
      await fetchData();
    } catch (e: unknown) {
      setRebuildMsg("⚠️ " + (e instanceof Error ? e.message : "Error"));
    } finally {
      setRebuilding(false);
    }
  }, [country, fetchData]);

  // Reset estado cuando cambia el mes
  useEffect(() => { setOpenSegment(null); setShowStrategy(null); setSearch(""); setFilterNear(false); }, [mesFilter]);

  const windowMeses = useMemo(() => getMesesForWindow(mesFilter), [mesFilter]);
  const ventanaLabel = useMemo(() => {
    if (!mesFilter) return "Todos los meses";
    return MES_LABEL[mesFilter] || mesFilter;
  }, [mesFilter]);

  // Recompute users for current window
  const usuariosComputed: UsuarioComputed[] = useMemo(() => {
    if (!data?.usuarios) return [];
    const segs = data.segments_config;
    return data.usuarios.map((u) => {
      let mov = 0, ing = 0, movLife = 0;
      for (const m in u.por_mes) {
        movLife += u.por_mes[m].mov;
        if (windowMeses.includes(m)) {
          mov += u.por_mes[m].mov;
          ing += u.por_mes[m].ing;
        }
      }
      const c = classifyUser(mov, segs);
      return { ...u, mov, ing, mov_lifetime: movLife, segmento: c.segmento, falta_para_subir: c.falta, near_upgrade: c.near };
    }).filter((u) => u.mov >= 1);
  }, [data, windowMeses]);

  const segmentsWithUsers = useMemo(() => {
    if (!data?.segments_config) return [];
    return data.segments_config.map((s) => {
      const users = usuariosComputed
        .filter((u) => u.segmento === s.key)
        .sort((a, b) => b.mov - a.mov);
      const totalMov = users.reduce((acc, u) => acc + u.mov, 0);
      const totalIng = users.reduce((acc, u) => acc + u.ing, 0);
      const nearCount = users.filter((u) => u.near_upgrade).length;
      return { ...s, users, totalMov, totalIng, count: users.length, nearCount };
    });
  }, [data, usuariosComputed]);

  const totals = useMemo(() => ({
    users: usuariosComputed.length,
    mov: usuariosComputed.reduce((s, u) => s + u.mov, 0),
    near: usuariosComputed.filter((u) => u.near_upgrade).length,
    sabioCount: usuariosComputed.filter((u) => u.segmento === "sabio_vip").length,
  }), [usuariosComputed]);

  const applyFilters = useCallback((users: UsuarioComputed[]) => {
    return users.filter((u) => {
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
  }, [search, filterNear]);

  const exportCsv = useCallback((users: UsuarioComputed[], filename: string) => {
    const header = "Email,Nombre,Teléfono,Comunidad,Segmento,Movilizadas_ventana,Ingresadas_ventana,Mov_lifetime,Falta_para_subir\n";
    const lines = users.map((u) => {
      const safe = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
      return [safe(u.email), safe(u.nombre), safe(u.telefono), safe(u.comunidad || ""), u.segmento || "", u.mov, u.ing, u.mov_lifetime, u.falta_para_subir ?? ""].join(",");
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
  if (!data) return <div className="glass-card p-6 t-muted">Sin datos cargados.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 border border-purple-500/20" style={{ background: "var(--bg-card)" }}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold t-primary mb-1">🎯 Estrategia de Usuarios — {country.toUpperCase()} <span className="text-sm t-muted font-normal">· ventana: {ventanaLabel}</span></h1>
            <p className="text-[11px] t-muted">
              Segmentación de DSs activos por <strong>movilizadas en la ventana seleccionada</strong>. Cambiá el mes/Q en el header
              para recalcular. Foco en los <strong className="text-amber-300">próximos a subir</strong>.
            </p>
            {data.window_note && <p className="text-[10px] text-amber-300 mt-2">ⓘ {data.window_note}</p>}
            {data.updated_at && (
              <p className="text-[10px] t-muted mt-1">
                Última actualización: <strong>{new Date(data.updated_at).toLocaleString("es-AR")}</strong>{" "}
                <span className="t-muted">(se reconstruye automáticamente cuando se actualiza el análisis operacional)</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={rebuildNow}
              disabled={rebuilding}
              className="text-xs px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
            >
              {rebuilding ? "Reconstruyendo…" : "🔄 Refrescar ahora"}
            </button>
            {rebuildMsg && <span className="text-[10px] t-secondary">{rebuildMsg}</span>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={`DSs con mov ≥1 en ${ventanaLabel}`} value={totals.users.toLocaleString("es-AR")} color="#a78bfa" />
        <Kpi label="Movilizadas en la ventana" value={totals.mov.toLocaleString("es-AR")} color="#f97316" />
        <Kpi label="🚀 Próximos a subir nivel" value={totals.near.toLocaleString("es-AR")} color="#fbbf24" sub="los más rentables HOY" />
        <Kpi label="👑 Sabio VIP" value={totals.sabioCount.toLocaleString("es-AR")} color="#f59e0b" sub="≥2000 mov en la ventana" />
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
            filterNear ? "bg-amber-500/20 border-amber-500 text-amber-300" : "border-gray-700 t-secondary hover:border-amber-500/40"
          }`}
        >
          {filterNear ? "🚀 Solo próximos a subir" : "🚀 Filtrar próximos a subir"}
        </button>
      </div>

      {/* Segmentos */}
      <div className="space-y-3">
        {segmentsWithUsers.map((seg) => (
          <SegmentBlock
            key={seg.key}
            seg={seg}
            usuariosFiltered={applyFilters(seg.users)}
            isOpen={openSegment === seg.key}
            onToggle={() => setOpenSegment(openSegment === seg.key ? null : seg.key)}
            showStrategy={showStrategy === seg.key}
            onToggleStrategy={() => setShowStrategy(showStrategy === seg.key ? null : seg.key)}
            onExport={() => exportCsv(seg.users, `estrategia_${country}_${mesFilter || "all"}_${seg.key}.csv`)}
            onExportNear={() => exportCsv(seg.users.filter((u) => u.near_upgrade), `estrategia_${country}_${mesFilter || "all"}_${seg.key}_cerca.csv`)}
          />
        ))}
      </div>

    </div>
  );
}

function SegmentBlock({
  seg, usuariosFiltered, isOpen, onToggle, showStrategy, onToggleStrategy, onExport, onExportNear,
}: {
  seg: SegmentConfig & { users: UsuarioComputed[]; totalMov: number; totalIng: number; count: number; nearCount: number };
  usuariosFiltered: UsuarioComputed[];
  isOpen: boolean; onToggle: () => void;
  showStrategy: boolean; onToggleStrategy: () => void;
  onExport: () => void; onExportNear: () => void;
}) {
  const strat = STRATEGIES[seg.key];
  const rangoLabel = seg.max ? `${seg.min}-${seg.max - 1}` : `${seg.min}+`;
  const cercaUsers = seg.users.filter((u) => u.near_upgrade);
  return (
    <div className="rounded-xl border" style={{ background: "var(--bg-card)", borderColor: seg.color + "40" }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold t-primary mb-1">
              {strat?.icon || "📊"} {seg.label}{" "}
              <span className="text-xs t-muted font-normal">({rangoLabel} movilizadas)</span>
            </h2>
            <div className="flex flex-wrap gap-3 text-[11px] t-muted">
              <span><strong className="t-primary text-base" style={{ color: seg.color }}>{seg.count.toLocaleString("es-AR")}</strong> usuarios</span>
              <span>·</span>
              <span><strong className="text-orange-300">{seg.totalMov.toLocaleString("es-AR")}</strong> mov</span>
              <span>·</span>
              <span><strong className="text-cyan-300">{seg.totalIng.toLocaleString("es-AR")}</strong> ing</span>
              {seg.nearCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-300">🚀 <strong>{seg.nearCount}</strong> próximos a subir</span>
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
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">🚀 Para los próximos a subir nivel</h3>
              <ul className="space-y-1 text-[11px] t-secondary">
                {strat.upgrade.map((u, i) => <li key={i}>• {u}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {seg.nearCount > 0 && (
        <div className="px-4 pb-4">
          <div className="rounded-lg p-3 border border-amber-500/40" style={{ background: "rgba(251,191,36,0.08)" }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-sm font-bold text-amber-300">🚀 {seg.nearCount} cerca del siguiente nivel</h3>
                <p className="text-[10px] t-muted">Faltan ≤ {seg.next ? (seg.next - (seg.near_floor || 0)) : "?"} órdenes para pasar al siguiente segmento. Foco máximo.</p>
              </div>
              <button onClick={onExportNear}
                className="text-[10px] px-2 py-1 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0">
                ⬇️ CSV cerca de subir
              </button>
            </div>
            <UserTable users={cercaUsers} color={seg.color} highlightNear />
          </div>
        </div>
      )}

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

function UserTable({ users, color, highlightNear = false }: { users: UsuarioComputed[]; color: string; highlightNear?: boolean }) {
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
              <th className="text-right py-2 px-2" title="Mov acumulado en TODA la base (todos los meses)">Mov life</th>
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
                <td className="py-2 px-2 text-right font-mono t-muted text-[10px]">{u.mov_lifetime.toLocaleString("es-AR")}</td>
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
