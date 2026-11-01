import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";
import { cargarFletes } from "../../../lib/flete-cierre";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════
// GET /api/data/cierre?country=ar|py — sector "Cierre del año 2026"
// Junta octubre–diciembre por dropshipper (get_ops_mes_cached kind 'ds', regla de
// Operaciones), arma el Pareto del Q4 (los que suman el 80 % de las guías) y devuelve
// solo esos usuarios con todo su detalle + los totales del país, asignaciones de
// comerciales, encargados, wallet (última carga), configuración y últimas alertas.
// ═══════════════════════════════════════════════════════════════════

const Q4 = ["octubre", "noviembre", "diciembre"] as const;
const NUM_KEYS = ["guias", "movilizadas", "entregadas", "devueltas", "en_proc_dev", "novedad", "novedad_sol", "canceladas", "pendientes", "valor_total", "valor_en_proc_dev", "valor_novedad"] as const;
type NumKey = (typeof NUM_KEYS)[number];

type DsMes = Record<NumKey, number> & {
  ds_id: string; ds_nombre: string; ds_email: string; ds_cel: string;
  por_estado: Record<string, number>; por_novedad: Record<string, number>; por_dia: Record<string, number>;
  por_transp: Record<string, { mov: number; ent: number; dev: number; pdev: number }>;
};
export type DsQ4 = Record<NumKey, number> & {
  ds_id: string; ds_nombre: string; ds_email: string; ds_cel: string;
  por_estado: Record<string, number>; por_novedad: Record<string, number>;
  por_mes: Record<string, { guias: number; movilizadas: number; entregadas: number; en_proc_dev: number }>;
  por_dia: Record<string, number>; // clave "mes-dia" (ej. "octubre-5")
  por_transp: Record<string, { mov: number; ent: number; dev: number; pdev: number }>;
};

const sumMap = (a: Record<string, number>, b: Record<string, number> | undefined) => {
  for (const k in b ?? {}) a[k] = (a[k] ?? 0) + Number(b![k] || 0);
};

async function user(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try { return await verifyToken(token); } catch { return null; }
}

export async function GET(req: NextRequest) {
  if (!(await user(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });
  const sb = getSupabase();

  const [meses, asig, enc, cfg, cargaRes, alertas, checks] = await Promise.all([
    Promise.all(Q4.map((m) => sb.rpc("get_ops_mes_cached", { p_country: country, p_mes: m, p_kind: "ds" }))),
    sb.from("cierre_asignaciones").select("ds_id, ds_nombre, comercial, updated_by, updated_at").eq("country", country),
    sb.from("cierre_encargados").select("nombre, telefono, activo, rol").eq("country", country).order("nombre"),
    sb.from("cierre_config").select("*").eq("country", country).maybeSingle(),
    sb.from("wallet_cargas").select("id, archivo, filas, cargado_por, cargado_el, mapeo").eq("country", country).order("cargado_el", { ascending: false }).limit(1),
    sb.from("cierre_alertas").select("ds_id, tipo, detalle, encargado, enviado_por, enviado_el").eq("country", country).order("enviado_el", { ascending: false }).limit(500),
    // seguimiento de retiros: el último evento de cada retiro manda (confirmado / pendiente)
    sb.from("cierre_alertas").select("ds_id, tipo, detalle, encargado, enviado_por, enviado_el").eq("country", country).in("tipo", ["retiro_ok", "retiro_pendiente"]).order("enviado_el", { ascending: false }).limit(5000),
  ]);

  // ── Juntar los 3 meses por dropshipper ──
  const map = new Map<string, DsQ4>();
  const mesesConDatos: string[] = [];
  Q4.forEach((mes, i) => {
    const r = meses[i];
    if (r.error) return;
    const rows = (Array.isArray(r.data) ? r.data : []) as DsMes[];
    if (rows.length) mesesConDatos.push(mes);
    for (const d of rows) {
      let cur = map.get(d.ds_id);
      if (!cur) {
        cur = { ds_id: d.ds_id, ds_nombre: d.ds_nombre, ds_email: d.ds_email, ds_cel: d.ds_cel, por_estado: {}, por_novedad: {}, por_mes: {}, por_dia: {}, por_transp: {} } as DsQ4;
        for (const k of NUM_KEYS) cur[k] = 0;
        map.set(d.ds_id, cur);
      }
      for (const k of NUM_KEYS) cur[k] += Number(d[k] || 0);
      sumMap(cur.por_estado, d.por_estado);
      sumMap(cur.por_novedad, d.por_novedad);
      for (const dia in d.por_dia ?? {}) cur.por_dia[`${mes}-${dia}`] = Number(d.por_dia[dia] || 0);
      cur.por_mes[mes] = { guias: Number(d.guias || 0), movilizadas: Number(d.movilizadas || 0), entregadas: Number(d.entregadas || 0), en_proc_dev: Number(d.en_proc_dev || 0) };
      for (const t in d.por_transp ?? {}) {
        const a = (cur.por_transp[t] ??= { mov: 0, ent: 0, dev: 0, pdev: 0 });
        const b = d.por_transp[t];
        a.mov += Number(b.mov || 0); a.ent += Number(b.ent || 0); a.dev += Number(b.dev || 0); a.pdev += Number(b.pdev || 0);
      }
      if (d.ds_nombre) cur.ds_nombre = d.ds_nombre;
    }
  });

  // ── Pareto del Q4: los que suman el 80 % de las guías ──
  const todos = [...map.values()].sort((a, b) => b.guias - a.guias);
  const totalGuias = todos.reduce((s, d) => s + d.guias, 0);
  const pareto: DsQ4[] = [];
  let acum = 0;
  for (const d of todos) {
    if (acum >= totalGuias * 0.8) break;
    pareto.push(d);
    acum += d.guias;
  }
  // Usuarios asignados a mano que no están en el Pareto se siguen mostrando (quedaron en seguimiento)
  const asignados = new Set((asig.data ?? []).filter((a) => a.comercial).map((a) => a.ds_id));
  for (const d of todos) if (asignados.has(d.ds_id) && !pareto.includes(d)) pareto.push(d);

  // ── Débito estimado de las devoluciones en proceso = su flete (archivo comercial) ──
  const fletes = await cargarFletes(sb, country).catch(() => null);
  const conFlete = pareto.map((d) => {
    if (!fletes || !d.en_proc_dev) return { ...d, flete_pdev: fletes ? 0 : null, flete_prom: null as number | null };
    let total = 0, n = 0;
    for (const t in d.por_transp) {
      const k = d.por_transp[t].pdev;
      const e = k ? fletes.estimar(d.ds_id, t) : null;
      if (e) { total += k * e.flete; n += k; }
    }
    // guías en proceso de devolución sin transportadora identificada → promedio del país
    const resto = d.en_proc_dev - n;
    if (resto > 0) { const e = fletes.estimar(d.ds_id, ""); if (e) total += resto * e.flete; }
    return { ...d, flete_pdev: Math.round(total), flete_prom: Math.round(total / d.en_proc_dev) };
  });

  const totales: Record<NumKey, number> = Object.fromEntries(NUM_KEYS.map((k) => [k, todos.reduce((s, d) => s + d[k], 0)])) as Record<NumKey, number>;

  // ── Wallet: último extracto cargado de cada usuario del Pareto ──
  const carga = cargaRes.data?.[0] ?? null;
  const ids = pareto.map((d) => d.ds_id);
  const ws = ids.length
    ? await sb.from("wallet_saldos")
        .select("ds_id, ds_email, ds_nombre, saldo_disponible, carga_id, informe_fecha:raw->>informe_fecha, cargado_el:raw->>cargado_el, n_mov:raw->>n_mov, retiros:raw->retiros")
        .eq("country", country).in("ds_id", ids).order("carga_id", { ascending: false })
    : { data: [] as Record<string, unknown>[] };
  const visto = new Map<string, Record<string, unknown>>();
  for (const w of (ws.data ?? []) as Record<string, unknown>[]) {
    const k = String(w.ds_id);
    const prev = visto.get(k);
    if (!prev) visto.set(k, { ...w, saldo_anterior: null, informe_anterior: null });
    else if (prev.saldo_anterior === null) { prev.saldo_anterior = w.saldo_disponible; prev.informe_anterior = w.informe_fecha; }
  }
  const wallet = [...visto.values()];

  return NextResponse.json({
    country,
    mesesConDatos,
    totalUsuarios: todos.length,
    totales,
    pareto: conFlete,
    fleteInfo: fletes ? { meses: fletes.meses, ordenes: fletes.ordenes } : null,
    asignaciones: asig.data ?? [],
    encargados: enc.data ?? [],
    config: cfg.data ?? { country, costo_devolucion: null, debitos_max_dia: 10, umbral_pdev: 10, umbral_novedad: 20 },
    walletCarga: carga ? { id: carga.id, archivo: carga.archivo, filas: carga.filas, cargado_por: carga.cargado_por, cargado_el: carga.cargado_el } : null,
    wallet,
    alertas: (alertas.data ?? []).filter((a) => !String(a.tipo).startsWith("retiro_")),
    retiroChecks: checks.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/data/cierre — acciones del sector (todas requieren sesión)
//   { accion: "asignar", country, ds_id, ds_nombre, comercial }
//   { accion: "encargado", country, nombre, telefono, activo?, rol?: "comercial" | "head" }
//   { accion: "config", country, costo_devolucion?, debitos_max_dia?, umbral_pdev?, umbral_novedad? }
//   { accion: "alerta", country, ds_id, tipo, detalle, encargado }
//   { accion: "wallet-extracto", country, ds_id, ds_nombre, ds_email, archivo, informe_fecha, saldo, movimientos[] }
//   { accion: "retiro", country, ds_id, clave, estado: "ok" | "pendiente", nota? }
//   { accion: "wallet-carga", country, archivo, mapeo }            → { carga_id }
//   { accion: "wallet-filas", country, carga_id, filas: [...] }     (en tandas)
//   { accion: "wallet-cerrar", country, carga_id, filas }
export async function POST(req: NextRequest) {
  const u = await user(req);
  if (!u) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const country = String(body.country || "").toLowerCase();
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });
  const sb = getSupabase();
  const quien = u.name || u.email;

  switch (body.accion) {
    case "asignar": {
      const r = await sb.from("cierre_asignaciones").upsert({
        country, ds_id: String(body.ds_id), ds_nombre: String(body.ds_nombre || ""), comercial: body.comercial ? String(body.comercial) : null,
        updated_by: quien, updated_at: new Date().toISOString(),
      }, { onConflict: "country,ds_id" });
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true });
    }
    case "encargado": {
      const nombre = String(body.nombre || "").trim();
      if (!nombre) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });
      const r = await sb.from("cierre_encargados").upsert({
        country, nombre, telefono: body.telefono ? String(body.telefono).replace(/[^\d+]/g, "") : null,
        activo: body.activo === undefined ? true : Boolean(body.activo), updated_at: new Date().toISOString(),
        ...(body.rol === "head" || body.rol === "comercial" ? { rol: body.rol } : {}),
      }, { onConflict: "country,nombre" });
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true });
    }
    case "config": {
      const num = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number(v));
      const patch: Record<string, unknown> = { country, updated_by: quien, updated_at: new Date().toISOString() };
      if ("costo_devolucion" in body) patch.costo_devolucion = num(body.costo_devolucion);
      for (const k of ["debitos_max_dia", "umbral_pdev", "umbral_novedad"]) if (k in body && num(body[k]) !== null) patch[k] = num(body[k]);
      const r = await sb.from("cierre_config").upsert(patch, { onConflict: "country" });
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true });
    }
    case "alerta": {
      const r = await sb.from("cierre_alertas").insert({
        country, ds_id: String(body.ds_id), tipo: String(body.tipo || ""), detalle: String(body.detalle || ""),
        encargado: body.encargado ? String(body.encargado) : null, enviado_por: quien,
      });
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true });
    }
    case "wallet-extracto": {
      // Extracto de wallet de UN usuario: saldo = monto previo del último movimiento del informe
      const dsId = String(body.ds_id || "").trim();
      const movs = Array.isArray(body.movimientos) ? body.movimientos : [];
      if (!dsId || movs.length === 0) return NextResponse.json({ error: "ds_id y movimientos requeridos" }, { status: 400 });
      const n = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
      const sinAcento = (x: unknown) => String(x ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const retiros = (movs as { fecha: string; monto: number; previo: number | null; desc: string; tipo: string }[])
        .filter((m) => /retiro/.test(sinAcento(m.desc)) || /retiro/.test(sinAcento(m.tipo)))
        .map((m) => ({ clave: `${m.fecha}|${m.monto}`, fecha: m.fecha, monto: m.monto, previo: m.previo, desc: m.desc }));
      const c = await sb.from("wallet_cargas").insert({
        country, archivo: String(body.archivo || ""), mapeo: { tipo: "extracto", ds_id: dsId, columnas: body.columnas ?? {} }, filas: movs.length, cargado_por: quien,
      }).select("id, cargado_el").single();
      if (c.error) return NextResponse.json({ error: c.error.message }, { status: 500 });
      const r = await sb.from("wallet_saldos").insert({
        country, carga_id: c.data.id, ds_id: dsId,
        ds_email: body.ds_email ? String(body.ds_email).trim().toLowerCase() : null, ds_nombre: body.ds_nombre ? String(body.ds_nombre) : null,
        saldo_disponible: n(body.saldo), saldo_retenido: null, fecha_retiro: null, monto_retiro: null,
        raw: {
          tipo: "extracto", informe_fecha: body.informe_fecha ?? null, desde: body.desde ?? null, ingresos: n(body.ingresos) ?? 0, egresos: n(body.egresos) ?? 0,
          n_mov: movs.length, retiros, archivo: String(body.archivo || ""), cargado_el: c.data.cargado_el, cargado_por: quien, movimientos: movs,
        },
      });
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true, carga_id: c.data.id });
    }
    case "retiro": {
      // check del equipo: el usuario confirmó que recibió el retiro (o se vuelve a pendiente)
      const estado = body.estado === "pendiente" ? "retiro_pendiente" : "retiro_ok";
      if (!body.ds_id || !body.clave) return NextResponse.json({ error: "ds_id y clave requeridos" }, { status: 400 });
      const r = await sb.from("cierre_alertas").insert({
        country, ds_id: String(body.ds_id), tipo: estado, detalle: String(body.clave), encargado: body.nota ? String(body.nota) : null, enviado_por: quien,
      });
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true });
    }
    case "wallet-carga": {
      const r = await sb.from("wallet_cargas").insert({ country, archivo: String(body.archivo || ""), mapeo: body.mapeo ?? {}, filas: 0, cargado_por: quien }).select("id").single();
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ carga_id: r.data.id });
    }
    case "wallet-filas": {
      const cargaId = Number(body.carga_id);
      const filas = Array.isArray(body.filas) ? (body.filas as Record<string, unknown>[]) : [];
      if (!cargaId || filas.length === 0) return NextResponse.json({ error: "carga_id y filas requeridos" }, { status: 400 });
      const num = (v: unknown) => {
        if (v === null || v === undefined || v === "") return null;
        if (typeof v === "number") return v;
        const s = String(v).replace(/[^\d,.-]/g, "");
        const n = Number(s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const rows = filas.map((f) => ({
        country, carga_id: cargaId,
        ds_id: f.ds_id ? String(f.ds_id).trim() : null,
        ds_email: f.ds_email ? String(f.ds_email).trim().toLowerCase() : null,
        ds_nombre: f.ds_nombre ? String(f.ds_nombre).trim() : null,
        saldo_disponible: num(f.saldo_disponible), saldo_retenido: num(f.saldo_retenido),
        fecha_retiro: f.fecha_retiro ? String(f.fecha_retiro) : null, monto_retiro: num(f.monto_retiro),
        raw: (f.raw as object) ?? {},
      }));
      const r = await sb.from("wallet_saldos").insert(rows);
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true, filas: rows.length });
    }
    case "wallet-cerrar": {
      const r = await sb.from("wallet_cargas").update({ filas: Number(body.filas || 0) }).eq("id", Number(body.carga_id)).eq("country", country);
      return r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "acción desconocida" }, { status: 400 });
  }
}
