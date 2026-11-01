"use client";

// ═══════════════════════════════════════════════════════════════════
// CIERRE DEL AÑO 2026 — seguimiento comercial + operativo del Pareto del Q4.
// Datos: /api/data/cierre (Operaciones por usuario, oct–dic, misma regla que
// Operaciones) + asignación de comerciales, encargados, wallet y alertas.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useUser } from "../lib/useUser";
import { ExtractoWallet, SubirExtracto, fechaLinda } from "./WalletExtracto";

type Pais = "ar" | "py";
interface Transp { mov: number; ent: number; dev: number; pdev: number }
interface Ds {
  ds_id: string; ds_nombre: string; ds_email: string; ds_cel: string;
  guias: number; movilizadas: number; entregadas: number; devueltas: number; en_proc_dev: number; novedad: number; novedad_sol: number;
  canceladas: number; pendientes: number; valor_total: number; valor_en_proc_dev: number; valor_novedad: number;
  por_estado: Record<string, number>; por_novedad: Record<string, number>; por_dia: Record<string, number>;
  por_mes: Record<string, { guias: number; movilizadas: number; entregadas: number; en_proc_dev: number }>;
  por_transp: Record<string, Transp>;
  flete_pdev: number | null; flete_prom: number | null; // débito estimado = flete de cada guía en proceso de devolución
}
interface Retiro { clave: string; fecha: string; monto: number; previo: number | null; desc: string }
interface Wallet {
  ds_id: string | null; ds_email: string | null; ds_nombre: string | null; saldo_disponible: number | null; carga_id: number;
  informe_fecha: string | null; cargado_el: string | null; n_mov: string | null; saldo_anterior: number | null; informe_anterior: string | null; retiros: Retiro[] | null;
}
interface Config { costo_devolucion: number | null; debitos_max_dia: number; umbral_pdev: number; umbral_novedad: number }
interface Encargado { nombre: string; telefono: string | null; activo: boolean; rol: "comercial" | "head" }
interface Alerta { ds_id: string; tipo: string; detalle: string; encargado: string | null; enviado_por: string; enviado_el: string }
interface Data {
  mesesConDatos: string[]; totalUsuarios: number; totales: Record<string, number>; pareto: Ds[];
  asignaciones: { ds_id: string; comercial: string | null; updated_by: string; updated_at: string }[];
  encargados: Encargado[]; config: Config; walletCarga: { id: number; archivo: string; filas: number; cargado_por: string; cargado_el: string } | null;
  wallet: Wallet[]; alertas: Alerta[]; retiroChecks: Alerta[]; fleteInfo: { meses: string[]; ordenes: number } | null;
}
interface Guia { mes: string; guia: string; fecha_orden: string; estatus: string; transportadora: string; novedad: string | null; concepto: string | null; dias_sin_cambio: number; fecha_ultimo_mov: string; valor: number; cliente: string; telefono: string; ciudad: string; producto: string; flete_est: number | null; flete_nivel: string | null }

const SIN = "Sin asignar";
const MESES = ["octubre", "noviembre", "diciembre"];
const NUM_MES: Record<string, number> = { octubre: 10, noviembre: 11, diciembre: 12 };
const PDEV = new Set(["EN PROCESO DE DEVOLUCION", "DEVOLUCION EN PROCESO"]);
const PEND = new Set(["PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA", "PREPARADO PARA TRANSPORTADORA", "GENERANDO GUIA", "ERROR_GENERANDO_GUIA"]);
const COLORES = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#eab308", "#ef4444", "#06b6d4", "#9ca3af"];

const fmt = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("es-AR"));
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const tip = { contentStyle: { background: "#1a1a1a", border: "1px solid #f97316", fontSize: 12 }, itemStyle: { color: "#fff" }, labelStyle: { color: "#fff" } };

type Sev = "critica" | "alta" | "media";
interface AlertaCalc { ds: Ds; tipo: "devoluciones" | "saldo" | "novedades" | "retiro"; sev: Sev; titulo: string; texto: string }

// ─── UI chicos ───
function Kpi({ label, value, sub, color = "#f97316" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 border" style={{ background: "var(--bg-card)", borderColor: `${color}40`, borderTop: `3px solid ${color}` }}>
      <p className="text-[10px] t-muted uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold font-mono mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-1 t-muted">{sub}</p>}
    </div>
  );
}
function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <th className={`py-2 px-2 text-[10px] uppercase tracking-wider t-muted whitespace-nowrap ${left ? "text-left" : "text-right"}`}>{children}</th>;
}
function Td({ children, left, bold, color }: { children: React.ReactNode; left?: boolean; bold?: boolean; color?: string }) {
  return <td className={`py-1.5 px-2 text-xs whitespace-nowrap ${left ? "text-left" : "text-right font-mono"} ${bold ? "font-bold" : ""}`} style={{ color }}>{children}</td>;
}
const SEV_COLOR: Record<Sev, string> = { critica: "#ef4444", alta: "#f97316", media: "#eab308" };

export default function CierreAnio({ country }: { country: Pais }) {
  const { canDownload } = useUser();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"resumen" | "usuarios" | "detalle" | "retiros" | "alertas" | "config">("resumen");
  const [walletVer, setWalletVer] = useState(0);
  const [filtroRet, setFiltroRet] = useState<"pendientes" | "confirmados" | "todos">("pendientes");
  const [sel, setSel] = useState<string | null>(null);
  const [filtroCom, setFiltroCom] = useState<string>("todos");
  const moneda = country === "ar" ? "$" : "Gs";
  const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${moneda} ${fmt(n)}`);
  const pais = country === "ar" ? "Argentina" : "Paraguay";

  const cargar = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/data/cierre?country=${country}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al cargar"); }
    finally { setLoading(false); }
  }, [country]);
  useEffect(() => { cargar(); }, [cargar]);

  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/data/cierre", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  };

  // ─── Derivados ───
  const asig = useMemo(() => new Map((data?.asignaciones ?? []).map((a) => [a.ds_id, a.comercial || SIN])), [data]);
  const walletDe = useMemo(() => {
    const porId = new Map<string, Wallet>(), porEmail = new Map<string, Wallet>();
    for (const w of data?.wallet ?? []) { if (w.ds_id) porId.set(String(w.ds_id), w); if (w.ds_email) porEmail.set(w.ds_email.toLowerCase(), w); }
    return (d: Ds) => porId.get(d.ds_id) ?? porEmail.get((d.ds_email || "").toLowerCase()) ?? null;
  }, [data]);
  const activos = data?.encargados.filter((e) => e.activo) ?? [];
  const encargados = activos.filter((e) => e.rol !== "head"); // comerciales: se asignan a los usuarios
  const head = activos.find((e) => e.rol === "head") ?? null; // recibe los escalamientos
  const telDe = (nombre: string) => activos.find((e) => e.nombre === nombre)?.telefono || null;
  const cfg = data?.config ?? { costo_devolucion: null, debitos_max_dia: 10, umbral_pdev: 10, umbral_novedad: 20 };
  const comDe = (d: Ds) => asig.get(d.ds_id) || SIN;

  const usuarios = useMemo(() => (data?.pareto ?? []).map((d) => {
    const w = walletDe(d);
    const debito = cfg.costo_devolucion ? d.en_proc_dev * cfg.costo_devolucion : d.flete_pdev;
    const porDia = debito !== null && d.en_proc_dev ? (debito / d.en_proc_dev) * Math.min(cfg.debitos_max_dia, d.en_proc_dev) : null;
    return { d, com: comDe(d), w, debito, porDia, dias: Math.ceil(d.en_proc_dev / Math.max(cfg.debitos_max_dia, 1)) };
  }), [data, walletDe, cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retiros detectados en los extractos + check del equipo (el último evento de cada retiro manda)
  const retiros = useMemo(() => {
    const est = new Map<string, Alerta>();
    for (const c of data?.retiroChecks ?? []) { const k = `${c.ds_id}|${c.detalle}`; if (!est.has(k)) est.set(k, c); }
    return usuarios.flatMap((u) => (u.w?.retiros ?? []).map((r) => {
      const ev = est.get(`${u.d.ds_id}|${r.clave}`);
      return { u, r, ok: ev?.tipo === "retiro_ok", ev: ev ?? null };
    })).sort((a, b) => b.r.fecha.localeCompare(a.r.fecha));
  }, [usuarios, data]);

  const alertasCalc: AlertaCalc[] = useMemo(() => {
    const out: AlertaCalc[] = [];
    for (const u of usuarios) {
      const { d, w, debito, dias } = u;
      if (debito !== null && w?.saldo_disponible !== null && w?.saldo_disponible !== undefined && w.saldo_disponible < debito) {
        out.push({ ds: d, tipo: "saldo", sev: "critica", titulo: "Saldo de wallet menor a los débitos que vienen",
          texto: `${d.en_proc_dev} guías en proceso de devolución ≈ ${money(debito)} de débitos (flete de cada guía); saldo ${money(w.saldo_disponible)} al ${fechaLinda(w.informe_fecha)}.` });
      }
      if (d.en_proc_dev >= cfg.umbral_pdev) {
        out.push({ ds: d, tipo: "devoluciones", sev: d.en_proc_dev >= cfg.umbral_pdev * 5 ? "alta" : "media", titulo: `${d.en_proc_dev} guías en proceso de devolución`,
          texto: `Débito estimado ${money(debito)} (fletes). Limitar a ${cfg.debitos_max_dia} débitos por día con Vicky: ${dias} días, ≈ ${money(u.porDia)} por día.` });
      }
      if (d.novedad >= cfg.umbral_novedad) {
        out.push({ ds: d, tipo: "novedades", sev: d.novedad >= cfg.umbral_novedad * 5 ? "alta" : "media", titulo: `${d.novedad} novedades sin solucionar`,
          texto: `Solucionadas ${d.novedad_sol} (${pct(d.novedad_sol, d.novedad + d.novedad_sol)}). Valor en novedad ${money(d.valor_novedad)}.` });
      }
    }
    for (const x of retiros) if (!x.ok) {
      out.push({ ds: x.u.d, tipo: "retiro", sev: "alta", titulo: `Retiro de ${money(Math.abs(x.r.monto))} pedido el ${fechaLinda(x.r.fecha)}`,
        texto: `Confirmar con el usuario que recibió el dinero y darle el check en Retiros. ${x.r.desc}` });
    }
    const peso: Record<Sev, number> = { critica: 0, alta: 1, media: 2 };
    return out.sort((a, b) => peso[a.sev] - peso[b.sev] || b.ds.en_proc_dev - a.ds.en_proc_dev);
  }, [usuarios, cfg, retiros]); // eslint-disable-line react-hooks/exhaustive-deps

  const ultimaAlerta = useMemo(() => {
    const m = new Map<string, Alerta>();
    for (const a of data?.alertas ?? []) { const k = `${a.ds_id}|${a.tipo}`; if (!m.has(k)) m.set(k, a); }
    return m;
  }, [data]);

  const comerciales = useMemo(() => {
    const nombres = [...new Set([...encargados.map((e) => e.nombre), ...usuarios.map((u) => u.com)])];
    return nombres.map((nombre) => {
      const us = usuarios.filter((u) => u.com === nombre);
      const s = (k: keyof Ds) => us.reduce((a, u) => a + Number(u.d[k] || 0), 0);
      return { nombre, n: us.length, guias: s("guias"), mov: s("movilizadas"), ent: s("entregadas"), dev: s("devueltas"), pdev: s("en_proc_dev"), vpdev: us.reduce((a, u) => a + (u.debito ?? 0), 0), nov: s("novedad"),
        alertas: alertasCalc.filter((a) => (asig.get(a.ds.ds_id) || SIN) === nombre).length };
    }).filter((c) => c.n > 0 || c.nombre !== SIN).sort((a, b) => b.guias - a.guias);
  }, [usuarios, encargados, alertasCalc, asig]);

  // Guías por día de cada comercial (Q4)
  const serieDiaria = useMemo(() => {
    const dias: { key: string; label: string }[] = [];
    for (const m of data?.mesesConDatos ?? []) for (let d = 1; d <= new Date(2026, NUM_MES[m], 0).getDate(); d++) dias.push({ key: `${m}-${d}`, label: `${d}/${NUM_MES[m]}` });
    const rows = dias.map(({ key, label }) => {
      const row: Record<string, number | string> = { dia: label };
      let total = 0;
      for (const c of comerciales) {
        const v = usuarios.filter((u) => u.com === c.nombre).reduce((a, u) => a + (u.d.por_dia[key] ?? 0), 0);
        row[c.nombre] = v; total += v;
      }
      return { row, total };
    });
    let ultimo = rows.length - 1;
    while (ultimo >= 0 && rows[ultimo].total === 0) ultimo--;
    return rows.slice(0, ultimo + 1).map((r) => r.row);
  }, [data, comerciales, usuarios]);

  // ─── WhatsApp al encargado ───
  const mensaje = (a: AlertaCalc, encargado: string) => {
    const u = usuarios.find((x) => x.d.ds_id === a.ds.ds_id);
    const w = u?.w;
    return [
      `Hola ${encargado}, alerta Cierre 2026 · ${pais}`,
      head && encargado === head.nombre ? `Comercial a cargo: ${asig.get(a.ds.ds_id) || SIN}` : "",
      `Usuario: ${a.ds.ds_nombre} (ID ${a.ds.ds_id})`,
      `• ${a.titulo}`,
      `• En proceso de devolución: ${a.ds.en_proc_dev} guías · débito estimado ${money(u?.debito)} (flete de cada guía)`,
      `• Novedades sin solucionar: ${a.ds.novedad}`,
      w ? `• Wallet: saldo ${money(w.saldo_disponible)} al ${fechaLinda(w.informe_fecha)} (según informe)` : "",
      a.tipo === "retiro" ? `• ${a.texto}` : "",
      a.ds.en_proc_dev > 0 ? `• Pedir a Vicky débitos de máximo ${cfg.debitos_max_dia} por día (${u?.dias ?? 0} días, ≈ ${money(u?.porDia)} por día)` : "",
      `Por favor contactá al usuario hoy y contame cómo queda.`,
    ].filter(Boolean).join("\n");
  };
  const marcarRetiro = async (dsId: string, clave: string, ok: boolean) => {
    try { await post({ accion: "retiro", ds_id: dsId, clave, estado: ok ? "ok" : "pendiente" }); await cargar(); }
    catch (er) { alert(er instanceof Error ? er.message : "No se pudo guardar"); }
  };
  const enviar = async (a: AlertaCalc, aHead = false) => {
    const comercial = asig.get(a.ds.ds_id) || SIN;
    const encargado = (aHead || comercial === SIN) && head ? head.nombre : comercial; // sin comercial asignado → al Head
    const tel = telDe(encargado);
    if (!tel) { alert(`Falta el teléfono de ${encargado === SIN ? "un encargado (el usuario no tiene comercial asignado)" : encargado}. Cargalo en Configuración.`); return; }
    window.open(`https://wa.me/${tel.replace(/[^\d]/g, "")}?text=${encodeURIComponent(mensaje(a, encargado))}`, "_blank", "noopener");
    try { await post({ accion: "alerta", ds_id: a.ds.ds_id, tipo: a.tipo, detalle: a.titulo, encargado }); await cargar(); } catch { /* el aviso igual salió */ }
  };

  if (loading && !data) return <div className="glass-card p-6 t-muted text-sm">Cargando Cierre del año 2026… (junta octubre a diciembre por usuario)</div>;
  if (err) return <div className="glass-card p-6 text-sm text-red-400">No se pudo cargar el sector: {err}</div>;
  if (!data) return null;

  const t = data.totales;
  const pGuias = usuarios.reduce((a, u) => a + u.d.guias, 0);
  const lista = usuarios.filter((u) => filtroCom === "todos" || u.com === filtroCom);
  const elegido = usuarios.find((u) => u.d.ds_id === sel) ?? null;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="rounded-xl p-5 border-2 border-orange-500/40" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.10), rgba(16,185,129,0.06))" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold t-primary">🏁 Cierre del año 2026 — {pais}</h2>
            <p className="text-xs t-muted mt-1">
              Pareto del Q4 ({data.mesesConDatos.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ") || "sin datos"}): {usuarios.length} usuarios de {fmt(data.totalUsuarios)} hacen {pct(pGuias, t.guias)} de las guías.
              Datos de Operaciones (última carga de cada mes) · fletes {data.fleteInfo ? `del archivo comercial (${fmt(data.fleteInfo.ordenes)} órdenes)` : "sin archivo comercial del Q4"} · wallet: {fmt(data.wallet.length)} de {usuarios.length} usuarios con extracto cargado.
            </p>
          </div>
          <button onClick={cargar} className="text-xs px-3 py-1.5 rounded-full border border-orange-500/40 text-orange-400 hover:bg-orange-500/10">{loading ? "Actualizando…" : "↻ Actualizar"}</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {([["resumen", "📊 Resumen por comercial"], ["usuarios", `👥 Usuarios del Pareto (${usuarios.length})`], ["detalle", "🔎 Detalle del usuario"], ["retiros", `💸 Retiros (${retiros.filter((x) => !x.ok).length} pendientes)`], ["alertas", `🚨 Alertas (${alertasCalc.length})`], ["config", "⚙️ Configuración y wallet"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`text-xs px-4 py-2 rounded-full border transition-all ${tab === k ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* ═══ RESUMEN ═══ */}
      {tab === "resumen" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            <Kpi label="Guías Q4 (Pareto)" value={fmt(pGuias)} sub={`${pct(pGuias, t.guias)} del país (${fmt(t.guias)})`} />
            <Kpi label="Entrega (Pareto)" value={pct(usuarios.reduce((a, u) => a + u.d.entregadas, 0), usuarios.reduce((a, u) => a + u.d.movilizadas, 0))} sub="entregadas ÷ movilizadas, en curso" color="#10b981" />
            <Kpi label="En proceso de devolución" value={fmt(usuarios.reduce((a, u) => a + u.d.en_proc_dev, 0))} sub={`débitos ≈ ${money(usuarios.reduce((a, u) => a + (u.debito ?? 0), 0))}`} color="#ef4444" />
            <Kpi label="Novedades sin solucionar" value={fmt(usuarios.reduce((a, u) => a + u.d.novedad, 0))} sub={`${fmt(usuarios.reduce((a, u) => a + u.d.novedad_sol, 0))} solucionadas`} color="#eab308" />
            <Kpi label="Alertas activas" value={fmt(alertasCalc.length)} sub={`${alertasCalc.filter((a) => a.sev === "critica").length} críticas`} color="#a855f7" />
            <Kpi label="Sin comercial asignado" value={fmt(usuarios.filter((u) => u.com === SIN).length)} sub="asignalos en Usuarios del Pareto" color="#9ca3af" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {comerciales.map((c) => (
              <div key={c.nombre} className="glass-card p-4" style={{ borderTop: `3px solid ${c.nombre === SIN ? "#9ca3af" : "#f97316"}` }}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold t-primary">{c.nombre}</h3>
                  <span className="text-[11px] t-muted">{c.n} usuarios</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div><p className="t-muted text-[10px]">Guías Q4</p><p className="font-mono font-bold t-primary">{fmt(c.guias)} <span className="t-muted font-normal">({pct(c.guias, pGuias)})</span></p></div>
                  <div><p className="t-muted text-[10px]">Entrega</p><p className="font-mono font-bold" style={{ color: "#10b981" }}>{pct(c.ent, c.mov)}</p></div>
                  <div><p className="t-muted text-[10px]">En proc. devolución</p><p className="font-mono font-bold" style={{ color: "#ef4444" }}>{fmt(c.pdev)}</p><p className="text-[10px] t-muted">débito ≈ {money(c.vpdev)}</p></div>
                  <div><p className="t-muted text-[10px]">Novedades</p><p className="font-mono font-bold" style={{ color: "#eab308" }}>{fmt(c.nov)}</p></div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px]" style={{ color: c.alertas ? "#ef4444" : "#10b981" }}>{c.alertas ? `🚨 ${c.alertas} alertas` : "✓ sin alertas"}</span>
                  <button onClick={() => { setFiltroCom(c.nombre); setTab("usuarios"); }} className="text-[11px] text-orange-400 hover:underline">Ver usuarios →</button>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-bold t-primary">📈 Guías por día de cada comercial (usuarios del Pareto)</h3>
            <p className="text-[11px] t-muted mb-3">Por fecha de orden. Las últimas fechas pueden estar incompletas hasta la próxima carga de Operaciones.</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={serieDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="dia" fontSize={10} stroke="#888" interval={Math.max(Math.floor(serieDiaria.length / 15), 0)} />
                <YAxis fontSize={10} stroke="#888" />
                <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {comerciales.map((c, i) => <Line key={c.nombre} dataKey={c.nombre} stroke={c.nombre === SIN ? "#9ca3af" : COLORES[i % COLORES.length]} strokeWidth={2} dot={false} strokeDasharray={c.nombre === SIN ? "4 3" : undefined} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-bold t-primary mb-3">📋 Comerciales: cartera y calidad</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-700"><Th left>Comercial</Th><Th>Usuarios</Th><Th>Guías Q4</Th><Th>% del Pareto</Th><Th>Movilizadas</Th><Th>Entrega</Th><Th>Devolución</Th><Th>En proc. dev.</Th><Th>Débito estimado</Th><Th>Novedades</Th><Th>Alertas</Th></tr></thead>
                <tbody>
                  {comerciales.map((c) => (
                    <tr key={c.nombre} className="border-b border-gray-800/50">
                      <Td left bold>{c.nombre}</Td><Td>{c.n}</Td><Td bold>{fmt(c.guias)}</Td><Td>{pct(c.guias, pGuias)}</Td><Td>{fmt(c.mov)}</Td>
                      <Td color="#10b981">{pct(c.ent, c.mov)}</Td><Td color="#ef4444">{pct(c.dev, c.mov)}</Td><Td color="#ef4444" bold>{fmt(c.pdev)}</Td><Td>{money(c.vpdev)}</Td><Td color="#eab308">{fmt(c.nov)}</Td>
                      <Td color={c.alertas ? "#ef4444" : undefined} bold>{c.alertas}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ USUARIOS DEL PARETO ═══ */}
      {tab === "usuarios" && (
        <div className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-bold t-primary">👥 Usuarios del Pareto del Q4</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="t-muted">Comercial:</span>
              <select value={filtroCom} onChange={(e) => setFiltroCom(e.target.value)} className="px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary">
                <option value="todos">Todos</option>
                {comerciales.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre} ({c.n})</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead><tr className="border-b border-gray-700"><Th left>#</Th><Th left>Usuario</Th><Th left>Comercial</Th><Th>Guías Q4</Th><Th>% país</Th><Th>Entrega</Th><Th>En proc. dev.</Th><Th>Débito estimado</Th><Th>Novedades</Th><Th>Saldo wallet</Th><Th>Días de débito</Th><Th left>Alertas</Th></tr></thead>
              <tbody>
                {lista.map((u, i) => {
                  const als = alertasCalc.filter((a) => a.ds.ds_id === u.d.ds_id);
                  return (
                    <tr key={u.d.ds_id} className="border-b border-gray-800/50 hover:bg-orange-500/5">
                      <Td left>{i + 1}</Td>
                      <td className="py-1.5 px-2 text-xs">
                        <button onClick={() => { setSel(u.d.ds_id); setTab("detalle"); }} className="text-left t-primary hover:text-orange-400 font-medium">{u.d.ds_nombre}</button>
                        <div className="text-[10px] t-muted">ID {u.d.ds_id} · {u.d.ds_email}</div>
                      </td>
                      <td className="py-1.5 px-2">
                        <select value={u.com} onChange={async (e) => { try { await post({ accion: "asignar", ds_id: u.d.ds_id, ds_nombre: u.d.ds_nombre, comercial: e.target.value === SIN ? null : e.target.value }); await cargar(); } catch (er) { alert(er instanceof Error ? er.message : "No se pudo guardar"); } }}
                          className="text-xs px-2 py-1 rounded-lg border bg-transparent t-primary" style={{ borderColor: u.com === SIN ? "#9ca3af80" : "#f9731680" }}>
                          <option value={SIN}>{SIN}</option>
                          {encargados.map((e) => <option key={e.nombre} value={e.nombre}>{e.nombre}</option>)}
                        </select>
                      </td>
                      <Td bold>{fmt(u.d.guias)}</Td><Td>{pct(u.d.guias, t.guias)}</Td><Td color="#10b981">{pct(u.d.entregadas, u.d.movilizadas)}</Td>
                      <Td bold color={u.d.en_proc_dev >= cfg.umbral_pdev ? "#ef4444" : undefined}>{fmt(u.d.en_proc_dev)}</Td><Td>{money(u.debito)}</Td>
                      <Td color={u.d.novedad >= cfg.umbral_novedad ? "#eab308" : undefined}>{fmt(u.d.novedad)}</Td>
                      <Td color={u.debito !== null && u.w?.saldo_disponible !== null && u.w?.saldo_disponible !== undefined && u.w.saldo_disponible < u.debito ? "#ef4444" : undefined}>{u.w ? <>{money(u.w.saldo_disponible)}<div className="text-[9px] t-muted font-normal">al {fechaLinda(u.w.informe_fecha)}</div></> : "—"}</Td>
                      <Td>{u.d.en_proc_dev ? u.dias : "—"}</Td>
                      <td className="py-1.5 px-2 text-[11px]">{als.length ? als.map((a) => <span key={a.tipo} className="inline-block mr-1 px-1.5 py-0.5 rounded" style={{ background: `${SEV_COLOR[a.sev]}25`, color: SEV_COLOR[a.sev] }}>{a.tipo}</span>) : <span className="t-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] t-muted mt-3">Débito estimado = suma del flete de cada guía en proceso de devolución (promedio de flete del usuario por transportadora, del archivo comercial). Días de débito = guías en proceso de devolución ÷ {cfg.debitos_max_dia} débitos por día. El comercial elegido se guarda al instante. Usuarios asignados que salen del Pareto siguen apareciendo.</p>
        </div>
      )}

      {/* ═══ DETALLE ═══ */}
      {tab === "detalle" && (
        <Detalle u={elegido} usuarios={usuarios} setSel={setSel} country={country} money={money} cfg={cfg}
          alertas={alertasCalc.filter((a) => a.ds.ds_id === sel)} enviar={enviar} ultimaAlerta={ultimaAlerta} canDownload={canDownload}
          post={post} walletVer={walletVer} onWallet={() => { setWalletVer((v) => v + 1); cargar(); }}
          retiros={retiros.filter((x) => x.u.d.ds_id === sel)} marcarRetiro={marcarRetiro} />
      )}

      {/* ═══ RETIROS ═══ */}
      {tab === "retiros" && (
        <div className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold t-primary">💸 Retiros pedidos por los usuarios</h3>
              <p className="text-[11px] t-muted">Salen de los extractos de wallet cargados (movimientos con "retiro" en la descripción). El equipo da el check cuando el usuario confirma que recibió el dinero; queda registrado quién y cuándo.</p>
            </div>
            <div className="flex gap-2">
              {(["pendientes", "confirmados", "todos"] as const).map((k) => (
                <button key={k} onClick={() => setFiltroRet(k)} className={`text-[11px] px-3 py-1 rounded-full border ${filtroRet === k ? "bg-orange-500 text-white border-orange-500" : "border-gray-700 t-secondary"}`}>
                  {k === "pendientes" ? `Pendientes (${retiros.filter((x) => !x.ok).length})` : k === "confirmados" ? `Confirmados (${retiros.filter((x) => x.ok).length})` : `Todos (${retiros.length})`}
                </button>
              ))}
            </div>
          </div>
          {retiros.length === 0 ? <p className="text-xs t-muted">Todavía no hay retiros: cargá el extracto de wallet de cada usuario en su Detalle.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead><tr className="border-b border-gray-700"><Th left>Fecha y hora</Th><Th left>Usuario</Th><Th left>Comercial</Th><Th>Monto</Th><Th>Saldo previo</Th><Th left>Descripción</Th><Th left>Estado</Th><Th left> </Th></tr></thead>
                <tbody>
                  {retiros.filter((x) => filtroRet === "todos" || (filtroRet === "pendientes" ? !x.ok : x.ok)).map((x) => (
                    <tr key={`${x.u.d.ds_id}|${x.r.clave}`} className="border-b border-gray-800/50">
                      <Td left>{fechaLinda(x.r.fecha)}</Td>
                      <td className="py-1.5 px-2 text-xs"><button onClick={() => { setSel(x.u.d.ds_id); setTab("detalle"); }} className="t-primary hover:text-orange-400">{x.u.d.ds_nombre}</button></td>
                      <Td left>{x.u.com}</Td>
                      <Td bold>{money(Math.abs(x.r.monto))}</Td>
                      <Td>{money(x.r.previo)}</Td>
                      <td className="py-1.5 px-2 text-[11px] t-secondary max-w-[260px] truncate" title={x.r.desc}>{x.r.desc}</td>
                      <td className="py-1.5 px-2 text-[11px]">{x.ok ? <span style={{ color: "#10b981" }}>✓ Recibido{x.ev ? ` · ${x.ev.enviado_por} ${new Date(x.ev.enviado_el).toLocaleDateString("es-AR")}` : ""}</span> : <span style={{ color: "#f97316" }}>Pendiente de confirmar</span>}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        <button onClick={() => marcarRetiro(x.u.d.ds_id, x.r.clave, !x.ok)} className={`text-[11px] px-3 py-0.5 rounded-full ${x.ok ? "border border-gray-700 t-muted" : "bg-green-600 text-white"}`}>{x.ok ? "Desmarcar" : "✓ Recibió el dinero"}</button>
                        {!x.ok && <button onClick={() => { const a = alertasCalc.find((al) => al.tipo === "retiro" && al.ds.ds_id === x.u.d.ds_id); if (a) enviar(a); }} className="ml-2 text-[11px] px-3 py-0.5 rounded-full border border-green-600 text-green-500">WhatsApp</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ ALERTAS ═══ */}
      {tab === "alertas" && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary">🚨 Alertas para los encargados</h3>
          <p className="text-[11px] t-muted mb-3">
            Reglas: en proceso de devolución ≥ {cfg.umbral_pdev} · novedades sin solucionar ≥ {cfg.umbral_novedad} · saldo de wallet menor a los débitos que vienen ({cfg.costo_devolucion ? `débito fijo de ${money(cfg.costo_devolucion)} por devolución` : "débito = flete de cada guía"}).
            El botón abre WhatsApp con el mensaje armado al comercial asignado y queda registrado.
          </p>
          <div className="space-y-2">
            {alertasCalc.length === 0 && <p className="text-xs t-muted">Sin alertas con los umbrales actuales.</p>}
            {alertasCalc.map((a, i) => {
              const enc = asig.get(a.ds.ds_id) || SIN;
              const ult = ultimaAlerta.get(`${a.ds.ds_id}|${a.tipo}`);
              return (
                <div key={`${a.ds.ds_id}-${a.tipo}-${i}`} className="rounded-xl p-3 border flex flex-wrap items-center gap-3 justify-between" style={{ borderColor: `${SEV_COLOR[a.sev]}50`, background: `${SEV_COLOR[a.sev]}0d` }}>
                  <div className="min-w-[260px] flex-1">
                    <p className="text-xs font-bold" style={{ color: SEV_COLOR[a.sev] }}>{a.sev.toUpperCase()} · {a.titulo}</p>
                    <p className="text-xs t-primary mt-0.5"><button className="hover:text-orange-400" onClick={() => { setSel(a.ds.ds_id); setTab("detalle"); }}>{a.ds.ds_nombre}</button> <span className="t-muted">(ID {a.ds.ds_id})</span> · {a.texto}</p>
                    {ult && <p className="text-[10px] t-muted mt-0.5">Último aviso: {new Date(ult.enviado_el).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} a {ult.encargado ?? "—"} por {ult.enviado_por}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] t-muted">{enc}</span>
                    {enc !== SIN && <button onClick={() => enviar(a)} className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: telDe(enc) ? "#16a34a" : "#6b7280" }} title={telDe(enc) ? "Abrir WhatsApp con el mensaje" : "Falta el teléfono del comercial"}>WhatsApp a {enc}</button>}
                    {head && <button onClick={() => enviar(a, true)} className="text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: "#16a34a", color: telDe(head.nombre) ? "#22c55e" : "#6b7280" }} title={a.sev === "critica" || enc === SIN ? "Escalar al Head" : "Copia al Head"}>{enc === SIN ? "WhatsApp" : "Escalar"} a {head.nombre} (Head)</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ CONFIGURACIÓN ═══ */}
      {tab === "config" && <Configuracion country={country} data={data} post={post} recargar={cargar} money={money} usuarios={usuarios} irA={(id) => { setSel(id); setTab("detalle"); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Detalle operativo de un usuario
// ═══════════════════════════════════════════════════════════════════
function Detalle({ u, usuarios, setSel, country, money, cfg, alertas, enviar, ultimaAlerta, canDownload, post, walletVer, onWallet, retiros, marcarRetiro }: {
  u: { d: Ds; com: string; w: Wallet | null; debito: number | null; porDia: number | null; dias: number } | null;
  usuarios: { d: Ds; com: string }[]; setSel: (id: string) => void; country: Pais; money: (n: number | null | undefined) => string; cfg: Config;
  alertas: AlertaCalc[]; enviar: (a: AlertaCalc) => void; ultimaAlerta: Map<string, Alerta>; canDownload: boolean;
  post: (b: Record<string, unknown>) => Promise<unknown>; walletVer: number; onWallet: () => void;
  retiros: { r: Retiro; ok: boolean; ev: Alerta | null }[]; marcarRetiro: (dsId: string, clave: string, ok: boolean) => void;
}) {
  const [guias, setGuias] = useState<Guia[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [grupo, setGrupo] = useState<"novedad" | "pdev" | "transito" | "pendiente">("pdev");

  useEffect(() => {
    if (!u) return;
    let vivo = true;
    setGuias(null); setCargando(true);
    fetch(`/api/data/cierre/guias?country=${country}&ds_id=${encodeURIComponent(u.d.ds_id)}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (vivo) setGuias(Array.isArray(j.guias) ? j.guias : []); })
      .catch(() => { if (vivo) setGuias([]); }).finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [u?.d.ds_id, country]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupoDe = (g: Guia) => (g.estatus === "NOVEDAD" ? "novedad" : PDEV.has(g.estatus) ? "pdev" : PEND.has(g.estatus) ? "pendiente" : "transito");
  const filtradas = useMemo(() => (guias ?? []).filter((g) => grupoDe(g) === grupo).sort((a, b) => b.dias_sin_cambio - a.dias_sin_cambio), [guias, grupo]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuenta = (k: string) => (guias ?? []).filter((g) => grupoDe(g) === k).length;

  const descargar = () => {
    const cols: (keyof Guia)[] = ["guia", "fecha_orden", "estatus", "transportadora", "novedad", "dias_sin_cambio", "valor", "flete_est", "cliente", "telefono", "ciudad", "producto"];
    const csv = [cols.join(";"), ...filtradas.map((g) => cols.map((c) => `"${String(g[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${u?.d.ds_nombre ?? "usuario"}-${grupo}.csv`;
    a.click();
  };

  if (!u) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold t-primary mb-2">🔎 Elegí un usuario del Pareto</h3>
        <div className="flex flex-wrap gap-2">
          {usuarios.slice(0, 60).map((x) => <button key={x.d.ds_id} onClick={() => setSel(x.d.ds_id)} className="text-xs px-3 py-1.5 rounded-full border border-gray-700 t-secondary hover:border-orange-500/50">{x.d.ds_nombre}</button>)}
        </div>
      </div>
    );
  }
  const { d, w } = u;
  const estados = Object.entries(d.por_estado).map(([estado, n]) => ({ estado, n })).sort((a, b) => b.n - a.n).slice(0, 14);
  const motivos = Object.entries(d.por_novedad).map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n).slice(0, 10);
  const transp = Object.entries(d.por_transp).map(([nombre, x]) => ({ nombre, ...x })).sort((a, b) => b.mov - a.mov);

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <select value={d.ds_id} onChange={(e) => setSel(e.target.value)} className="text-sm font-bold px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary">
              {usuarios.map((x) => <option key={x.d.ds_id} value={x.d.ds_id}>{x.d.ds_nombre}</option>)}
            </select>
            <p className="text-[11px] t-muted mt-1">ID {d.ds_id} · {d.ds_email} · cel {d.ds_cel || "—"} · comercial: <b className="t-secondary">{u.com}</b></p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertas.map((a) => {
              const ult = ultimaAlerta.get(`${d.ds_id}|${a.tipo}`);
              return <button key={a.tipo} onClick={() => enviar(a)} className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: SEV_COLOR[a.sev] }} title={ult ? `Último aviso ${new Date(ult.enviado_el).toLocaleString("es-AR")}` : "Sin avisos previos"}>WhatsApp · {a.tipo}</button>;
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mt-4">
          <Kpi label="Guías Q4" value={fmt(d.guias)} sub={MESES.filter((m) => d.por_mes[m]).map((m) => `${m.slice(0, 3)} ${fmt(d.por_mes[m].guias)}`).join(" · ")} />
          <Kpi label="Movilizadas" value={fmt(d.movilizadas)} sub={pct(d.movilizadas, d.guias) + " de las guías"} color="#3b82f6" />
          <Kpi label="Entregadas" value={fmt(d.entregadas)} sub={pct(d.entregadas, d.movilizadas) + " de movilizadas"} color="#10b981" />
          <Kpi label="Devueltas" value={fmt(d.devueltas)} sub={pct(d.devueltas, d.movilizadas)} color="#ef4444" />
          <Kpi label="En proc. de devolución" value={fmt(d.en_proc_dev)} sub={money(d.valor_en_proc_dev)} color="#ef4444" />
          <Kpi label="Novedades sin solucionar" value={fmt(d.novedad)} sub={`${fmt(d.novedad_sol)} solucionadas (${pct(d.novedad_sol, d.novedad + d.novedad_sol)})`} color="#eab308" />
          <Kpi label="Pendientes" value={fmt(d.pendientes)} sub="sin despachar" color="#9ca3af" />
          <Kpi label="Canceladas" value={fmt(d.canceladas)} sub={pct(d.canceladas, d.guias)} color="#9ca3af" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Wallet y débitos */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary mb-3">💳 Wallet y plan de débitos</h3>
          {w ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="t-muted">Saldo actualizado</span><b className="font-mono t-primary">{money(w.saldo_disponible)}</b></div>
              <div className="flex justify-between"><span className="t-muted">Al (según informe)</span><b className="font-mono">{fechaLinda(w.informe_fecha)}</b></div>
              {w.saldo_anterior !== null && <div className="flex justify-between"><span className="t-muted">Informe anterior</span><span className="font-mono">{money(w.saldo_anterior)} al {fechaLinda(w.informe_anterior)}</span></div>}
              {retiros.filter((x) => !x.ok).length > 0 && <p className="text-[11px]" style={{ color: "#f97316" }}>💸 {retiros.filter((x) => !x.ok).length} retiro(s) sin confirmar</p>}
            </div>
          ) : <p className="text-xs t-muted">Todavía no se cargó el extracto de wallet de este usuario (abajo).</p>}
          <div className="mt-4 rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)" }}>
            <p className="text-xs t-primary"><b>{fmt(d.en_proc_dev)}</b> guías en proceso de devolución → con un tope de <b>{cfg.debitos_max_dia} débitos por día</b>, son <b>{u.dias} días</b> de débitos.</p>
            {u.debito !== null && <p className="text-xs t-primary mt-1">Débito estimado (flete de cada guía): <b>{money(u.debito)}</b>{d.flete_prom ? <span className="t-muted"> · flete promedio {money(d.flete_prom)}</span> : null}{w?.saldo_disponible !== null && w?.saldo_disponible !== undefined ? <> · {w.saldo_disponible >= u.debito ? <span style={{ color: "#10b981" }}>el saldo lo cubre</span> : <span style={{ color: "#ef4444" }}>faltan {money(u.debito - w.saldo_disponible)}</span>}</> : null}</p>}
            {u.porDia !== null && <p className="text-xs t-primary mt-1">Con el tope: ≈ <b>{money(u.porDia)} por día</b> durante {u.dias} días.</p>}
            {u.debito === null && <p className="text-[11px] t-muted mt-1">Sin fletes del Q4: subí el archivo comercial del mes para estimar el monto.</p>}
          </div>
        </div>

        {/* Estados */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary mb-3">📦 Guías por estado (Q4)</h3>
          <ResponsiveContainer width="100%" height={Math.max(estados.length * 22, 160)}>
            <BarChart data={estados} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" fontSize={10} stroke="#888" />
              <YAxis type="category" dataKey="estado" width={170} fontSize={9} stroke="#888" />
              <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="n" name="Guías" fill="#f97316" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Novedades */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary mb-1">⚠️ Gestión de novedades</h3>
          <p className="text-[11px] t-muted mb-3">{fmt(d.novedad)} sin solucionar · {fmt(d.novedad_sol)} solucionadas · {pct(d.novedad_sol, d.novedad + d.novedad_sol)} gestionado</p>
          <div className="space-y-1.5">
            {motivos.map((m) => (
              <div key={m.motivo} className="flex items-center gap-2">
                <div className="text-[10px] w-44 shrink-0 t-secondary truncate" title={m.motivo}>{m.motivo}</div>
                <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: "rgba(148,163,184,0.15)" }}><div className="h-full rounded" style={{ width: `${ratio(m.n, motivos[0]?.n ?? 1) * 100}%`, background: "#eab308" }} /></div>
                <div className="text-[10px] font-mono w-8 text-right t-primary">{m.n}</div>
              </div>
            ))}
            {motivos.length === 0 && <p className="text-xs t-muted">Sin novedades en el Q4.</p>}
          </div>
        </div>
      </div>

      {/* Extracto de wallet */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold t-primary">💳 Extracto de wallet</h3>
        {retiros.length > 0 && (
          <div>
            <p className="text-[11px] t-muted mb-1">Retiros pedidos por el usuario — dale el check cuando confirme que recibió el dinero:</p>
            <div className="space-y-1">
              {retiros.map((x) => (
                <div key={x.r.clave} className="flex flex-wrap items-center gap-3 text-xs rounded-lg px-3 py-1.5" style={{ background: x.ok ? "rgba(16,185,129,0.08)" : "rgba(249,115,22,0.08)" }}>
                  <span className="font-mono t-secondary">{fechaLinda(x.r.fecha)}</span>
                  <b className="font-mono">{money(Math.abs(x.r.monto))}</b>
                  <span className="t-muted flex-1 truncate">{x.r.desc}</span>
                  {x.ok && x.ev && <span className="text-[10px] t-muted">✓ {x.ev.enviado_por} · {new Date(x.ev.enviado_el).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                  <button onClick={() => marcarRetiro(d.ds_id, x.r.clave, !x.ok)} className={`text-[11px] px-3 py-0.5 rounded-full ${x.ok ? "border border-gray-700 t-muted" : "bg-green-600 text-white"}`}>{x.ok ? "Desmarcar" : "✓ Recibió el dinero"}</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <ExtractoWallet country={country} dsId={d.ds_id} moneda={country === "ar" ? "$" : "Gs"} version={walletVer} />
        <SubirExtracto ds={d} post={post} onListo={onWallet} moneda={country === "ar" ? "$" : "Gs"} />
      </div>

      {transp.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary mb-3">🚚 Por transportadora</h3>
          <div className="overflow-x-auto">
            <table className="w-full"><thead><tr className="border-b border-gray-700"><Th left>Transportadora</Th><Th>Movilizadas</Th><Th>Entrega</Th><Th>Devueltas</Th><Th>En proc. dev.</Th></tr></thead>
              <tbody>{transp.map((x) => <tr key={x.nombre} className="border-b border-gray-800/50"><Td left bold>{x.nombre}</Td><Td>{fmt(x.mov)}</Td><Td color="#10b981">{pct(x.ent, x.mov)}</Td><Td>{fmt(x.dev)}</Td><Td color="#ef4444" bold>{fmt(x.pdev)}</Td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guías abiertas */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-bold t-primary">📄 Guías abiertas del usuario</h3>
          <div className="flex flex-wrap gap-2">
            {([["pdev", "En proceso de devolución"], ["novedad", "Novedad"], ["transito", "En tránsito"], ["pendiente", "Pendientes"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setGrupo(k)} className={`text-[11px] px-3 py-1 rounded-full border ${grupo === k ? "bg-orange-500 text-white border-orange-500" : "border-gray-700 t-secondary"}`}>{l} ({guias ? cuenta(k) : "…"})</button>
            ))}
            {canDownload && filtradas.length > 0 && <button onClick={descargar} className="text-[11px] px-3 py-1 rounded-full border border-gray-700 t-secondary hover:border-orange-500/50">⬇ CSV</button>}
          </div>
        </div>
        {cargando && <p className="text-xs t-muted">Buscando las guías del usuario…</p>}
        {!cargando && filtradas.length > 0 && <p className="text-[11px] t-muted mb-2">{fmt(filtradas.length)} guías · flete estimado total {money(filtradas.reduce((a, g) => a + (g.flete_est ?? 0), 0))}{grupo === "pdev" ? " (lo que se va a debitar)" : ""}. Flete estimado con el promedio del usuario en esa transportadora y ciudad (el archivo comercial no trae número de guía).</p>}
        {!cargando && (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="sticky top-0" style={{ background: "var(--bg-card)" }}><tr className="border-b border-gray-700"><Th left>Guía</Th><Th left>Fecha orden</Th><Th left>Estado</Th><Th left>Transportadora</Th><Th left>Novedad</Th><Th>Días sin cambio</Th><Th>Valor</Th><Th>Flete est.</Th><Th left>Cliente</Th><Th left>Teléfono</Th><Th left>Ciudad</Th></tr></thead>
              <tbody>
                {filtradas.slice(0, 500).map((g) => (
                  <tr key={`${g.mes}-${g.guia}`} className="border-b border-gray-800/50">
                    <Td left>{g.guia}</Td><Td left>{g.fecha_orden}</Td><Td left>{g.estatus}</Td><Td left>{g.transportadora}</Td>
                    <td className="py-1.5 px-2 text-[11px] t-secondary max-w-[220px] truncate" title={g.novedad ?? ""}>{g.novedad ?? "—"}</td>
                    <Td bold color={g.dias_sin_cambio >= 5 ? "#ef4444" : g.dias_sin_cambio >= 3 ? "#eab308" : undefined}>{g.dias_sin_cambio}</Td>
                    <Td>{money(g.valor)}</Td><Td>{money(g.flete_est)}</Td><Td left>{g.cliente}</Td><Td left>{g.telefono}</Td><Td left>{g.ciudad}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtradas.length > 500 && <p className="text-[11px] t-muted mt-2">Mostrando 500 de {fmt(filtradas.length)} (las de más días sin cambio). Descargá el CSV para verlas todas.</p>}
            {guias && filtradas.length === 0 && <p className="text-xs t-muted mt-2">No hay guías en este grupo.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Configuración: encargados, umbrales y extractos de wallet por usuario
// ═══════════════════════════════════════════════════════════════════
function Configuracion({ country, data, post, recargar, money, usuarios, irA }: { country: Pais; data: Data; post: (b: Record<string, unknown>) => Promise<unknown>; recargar: () => Promise<void>; money: (n: number | null | undefined) => string; usuarios: { d: Ds; w: Wallet | null }[]; irA: (dsId: string) => void }) {
  const [encs, setEncs] = useState(data.encargados.map((e) => ({ ...e, telefono: e.telefono ?? "" })));
  const [nuevo, setNuevo] = useState({ nombre: "", telefono: "" });
  const [cfg, setCfg] = useState({ costo_devolucion: data.config.costo_devolucion ?? "", debitos_max_dia: data.config.debitos_max_dia, umbral_pdev: data.config.umbral_pdev, umbral_novedad: data.config.umbral_novedad });
  const [msg, setMsg] = useState("");
  const [walletDs, setWalletDs] = useState<string>("");

  const guardarEnc = async (e: { nombre: string; telefono: string; activo: boolean; rol?: string }) => {
    try { await post({ accion: "encargado", ...e }); setMsg(`✓ ${e.nombre} guardado`); await recargar(); } catch (er) { setMsg(`✗ ${er instanceof Error ? er.message : "error"}`); }
  };
  const guardarCfg = async () => {
    try { await post({ accion: "config", ...cfg }); setMsg("✓ Configuración guardada"); await recargar(); } catch (er) { setMsg(`✗ ${er instanceof Error ? er.message : "error"}`); }
  };

  return (
    <div className="space-y-4">
      {msg && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: msg.startsWith("✓") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: msg.startsWith("✓") ? "#10b981" : "#ef4444" }}>{msg}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary">👤 Encargados de {country === "ar" ? "Argentina" : "Paraguay"}</h3>
          <p className="text-[11px] t-muted mb-3">Los comerciales se asignan a los usuarios y reciben las alertas por WhatsApp; el Head recibe los escalamientos y las alertas de usuarios sin comercial. Teléfono con código de país (ej. {country === "ar" ? "5491123456789" : "595981123456"}).</p>
          <div className="space-y-2">
            {encs.map((e, i) => (
              <div key={e.nombre} className="flex flex-wrap items-center gap-2">
                <span className="text-xs t-primary w-28 font-medium">{e.nombre}</span>
                <select value={e.rol} onChange={(ev) => setEncs(encs.map((x, j) => (j === i ? { ...x, rol: ev.target.value as "comercial" | "head" } : x)))} className="text-[11px] px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary">
                  <option value="comercial">Comercial</option><option value="head">Head</option>
                </select>
                <input value={e.telefono} onChange={(ev) => setEncs(encs.map((x, j) => (j === i ? { ...x, telefono: ev.target.value } : x)))} placeholder="Teléfono WhatsApp" className="text-xs px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary w-44" />
                <label className="text-[11px] t-muted flex items-center gap-1"><input type="checkbox" checked={e.activo} onChange={(ev) => setEncs(encs.map((x, j) => (j === i ? { ...x, activo: ev.target.checked } : x)))} /> activo</label>
                <button onClick={() => guardarEnc(e)} className="text-[11px] px-3 py-1 rounded-full bg-orange-500 text-white">Guardar</button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800/50">
              <input value={nuevo.nombre} onChange={(ev) => setNuevo({ ...nuevo, nombre: ev.target.value })} placeholder="Nuevo encargado" className="text-xs px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary w-28" />
              <input value={nuevo.telefono} onChange={(ev) => setNuevo({ ...nuevo, telefono: ev.target.value })} placeholder="Teléfono WhatsApp" className="text-xs px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary w-44" />
              <button disabled={!nuevo.nombre.trim()} onClick={async () => { await guardarEnc({ ...nuevo, activo: true, rol: "comercial" }); setEncs([...encs, { ...nuevo, activo: true, rol: "comercial" }]); setNuevo({ nombre: "", telefono: "" }); }} className="text-[11px] px-3 py-1 rounded-full border border-orange-500 text-orange-400 disabled:opacity-40">+ Agregar</button>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-bold t-primary">🎚️ Reglas de alertas y débitos</h3>
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
            {([["costo_devolucion", `Débito fijo por devolución (${country === "ar" ? "$" : "Gs"}, opcional)`, "vacío = se usa el flete de cada guía"], ["debitos_max_dia", "Débitos máximos por día", "acordado con Vicky"], ["umbral_pdev", "Alerta desde (en proc. de devolución)", "guías"], ["umbral_novedad", "Alerta desde (novedades sin solucionar)", "guías"]] as const).map(([k, l, h]) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="t-muted text-[11px]">{l}</span>
                <input type="number" value={cfg[k] as number | string} onChange={(ev) => setCfg({ ...cfg, [k]: ev.target.value })} className="px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary" />
                <span className="text-[10px] t-muted">{h}</span>
              </label>
            ))}
          </div>
          <button onClick={guardarCfg} className="mt-3 text-[11px] px-4 py-1.5 rounded-full bg-orange-500 text-white">Guardar reglas</button>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-bold t-primary">💳 Extractos de wallet por usuario</h3>
        <p className="text-[11px] t-muted mb-3">El informe de wallet de Dropi se baja por usuario. Saldo = MONTO PREVIO del último movimiento, a la fecha y hora de ese movimiento en el informe. Cada carga nueva actualiza el saldo y las anteriores quedan como historial.</p>
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="t-muted">Usuario:</span>
          <select value={walletDs} onChange={(e) => setWalletDs(e.target.value)} className="px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary">
            <option value="">Elegí un usuario…</option>
            {usuarios.map((x) => <option key={x.d.ds_id} value={x.d.ds_id}>{x.d.ds_nombre}{x.w ? " ✓" : ""}</option>)}
          </select>
        </div>
        {walletDs && (() => { const x = usuarios.find((y) => y.d.ds_id === walletDs); return x ? <SubirExtracto ds={x.d} post={post} onListo={recargar} moneda={country === "ar" ? "$" : "Gs"} /> : null; })()}
        <div className="overflow-x-auto mt-4">
          <table className="w-full">
            <thead><tr className="border-b border-gray-700"><Th left>Usuario</Th><Th>Saldo</Th><Th left>Al (según informe)</Th><Th>Movimientos</Th><Th left>Subido</Th></tr></thead>
            <tbody>
              {usuarios.map((x) => (
                <tr key={x.d.ds_id} className="border-b border-gray-800/50">
                  <td className="py-1.5 px-2 text-xs"><button onClick={() => irA(x.d.ds_id)} className="t-primary hover:text-orange-400">{x.d.ds_nombre}</button></td>
                  <Td bold>{x.w ? money(x.w.saldo_disponible) : "—"}</Td>
                  <Td left>{x.w ? fechaLinda(x.w.informe_fecha) : <span className="t-muted">sin extracto</span>}</Td>
                  <Td>{x.w?.n_mov ?? "—"}</Td>
                  <Td left>{x.w?.cargado_el ? new Date(x.w.cargado_el).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {data.config.costo_devolucion ? <p className="text-[11px] t-muted">Débito por devolución vigente: {money(data.config.costo_devolucion)}.</p> : null}
    </div>
  );
}
