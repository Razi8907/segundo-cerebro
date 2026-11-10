import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════
// GET /api/data/anio?country=ar|py — Resumen del año 2026
// Ene–Mar: totales mensuales de dashboard_snapshots.resumen (no hay detalle diario).
// Abr→hoy: Operaciones por mes (get_ops_mes_cached: diario, por transportadora y por
// ciudad × transportadora; misma regla que Operaciones) + Seguimiento Diario (ingresadas)
// + archivo comercial (operational_snapshots: usuarios, proveedores, productos).
// Los meses se agregan solos a medida que hay datos.
// ═══════════════════════════════════════════════════════════════════

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const Q1 = ["enero", "febrero", "marzo"];
const OPS = MESES.slice(3);

type Kind = "daily" | "transp" | "ciudad";
interface Daily { dia: number; guias: number; ingresadas: number; movilizadas: number; entregadas: number; devueltas: number; en_proceso: number; canceladas: number }
interface Transp { transportadora: string; guias: number; movilizadas: number; entregadas: number; devueltas: number; en_proceso: number; canceladas: number }
interface Ciudad extends Transp { ciudad: string; departamento: string }
interface Entidad { nombre: string; total?: number; ordenes?: number; estados?: Record<string, number>; proveedor?: string }

const n = (v: unknown) => Number(v || 0);
const NO_DESPACHADO = new Set(["CANCELADO", "RECHAZADO", "PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA ANULADA", "GUIA_ANULADA", "GENERANDO GUIA", "ERROR_GENERANDO_GUIA"]);

async function cache(sb: ReturnType<typeof getSupabase>, country: string, mes: string, kind: Kind): Promise<unknown[] | null> {
  for (let i = 0; i < 2; i++) {
    const r = await sb.rpc("get_ops_mes_cached", { p_country: country, p_mes: mes, p_kind: kind });
    if (!r.error) return Array.isArray(r.data) ? r.data : [];
  }
  const stale = await sb.from("ops_mes_cache").select("rows").eq("country", country).eq("mes", mes).eq("kind", kind).maybeSingle();
  return stale.data && Array.isArray(stale.data.rows) ? stale.data.rows : null;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });
  const sb = getSupabase();

  const hoy = new Date();
  const mesActual = hoy.getFullYear() === 2026 ? hoy.getMonth() : 11; // índice 0-11
  const opsMeses = OPS.filter((m) => MESES.indexOf(m) <= mesActual);

  const [snap, comercial, ...porMes] = await Promise.all([
    sb.from("dashboard_snapshots").select("resumen:data->resumen, meta_info:data->meta_info").eq("country", country).maybeSingle(),
    sb.from("operational_snapshots")
      .select("mes, total_orders:data->total_orders, by_status:data->by_status, by_dropshipper:data->by_dropshipper, by_proveedor:data->by_proveedor, by_producto:data->by_producto, by_departamento:data->by_departamento")
      .eq("country", country),
    ...opsMeses.map(async (m) => {
      const [daily, transp, ciudad] = await Promise.all([cache(sb, country, m, "daily"), cache(sb, country, m, "transp"), cache(sb, country, m, "ciudad")]);
      return { mes: m, daily: (daily ?? []) as Daily[], transp: (transp ?? []) as Transp[], ciudad: (ciudad ?? []) as Ciudad[], falta: daily === null };
    }),
  ]);
  const resumen = (snap.data?.resumen ?? {}) as Record<string, Record<string, number>>;
  const meta = (snap.data?.meta_info ?? {}) as Record<string, number>;
  const avisos: string[] = porMes.filter((p) => p.falta).map((p) => `${p.mes}: Operaciones no respondió`);

  // ── Meses ──
  const meses = MESES.filter((m) => MESES.indexOf(m) <= mesActual).map((m) => {
    const idx = MESES.indexOf(m);
    const base = {
      mes: m, num: idx + 1, dias_mes: new Date(2026, idx + 1, 0).getDate(),
      meta_mov: meta[`meta_movilizadas_${m}`] ?? null, meta_ing: meta[`meta_ingresadas_${m}`] ?? null, cierre_mov: meta[`cierre_movilizadas_${m}`] ?? null,
      en_curso: idx === mesActual,
    };
    const p = porMes.find((x) => x.mes === m);
    if (Q1.includes(m) || !p || p.daily.length === 0) {
      const r = resumen[m];
      if (!r || !n(r.ingresadas)) return null;
      return { ...base, fuente: "resumen" as const, ingresadas: n(r.ingresadas), movilizadas: n(r.movilizadas), entregadas: n(r.entregadas), devueltas: n(r.devueltas), en_proceso: n(r.en_proceso), canceladas: null as number | null, dias_con_datos: base.dias_mes };
    }
    const s = (k: keyof Daily) => p.daily.reduce((a, d) => a + n(d[k]), 0);
    const diasConDatos = p.daily.filter((d) => n(d.ingresadas) > 0 || n(d.movilizadas) > 0).reduce((a, d) => Math.max(a, n(d.dia)), 0);
    return { ...base, fuente: "operaciones" as const, ingresadas: s("ingresadas"), movilizadas: s("movilizadas"), entregadas: s("entregadas"), devueltas: s("devueltas"), en_proceso: s("en_proceso"), canceladas: s("canceladas") as number | null, dias_con_datos: diasConDatos };
  }).filter(Boolean);

  // ── Diario (abril en adelante) ──
  const diario = porMes.flatMap((p) => p.daily.map((d) => ({
    mes: p.mes, dia: n(d.dia), fecha: `2026-${String(MESES.indexOf(p.mes) + 1).padStart(2, "0")}-${String(n(d.dia)).padStart(2, "0")}`,
    ingresadas: n(d.ingresadas), movilizadas: n(d.movilizadas), entregadas: n(d.entregadas), devueltas: n(d.devueltas), en_proceso: n(d.en_proceso),
  }))).sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ── Logística: transportadora × mes ──
  const transp: Record<string, Record<string, { guias: number; mov: number; ent: number; dev: number; proc: number; canc: number }>> = {};
  for (const p of porMes) for (const t of p.transp) {
    const k = t.transportadora || "SIN TRANSPORTADORA";
    (transp[k] ??= {})[p.mes] = { guias: n(t.guias), mov: n(t.movilizadas), ent: n(t.entregadas), dev: n(t.devueltas), proc: n(t.en_proceso), canc: n(t.canceladas) };
  }

  // ── Ciudades: total del año, por transportadora y por mes ──
  type Acc = { mov: number; ent: number; dev: number; proc: number; guias: number };
  const nuevo = (): Acc => ({ mov: 0, ent: 0, dev: 0, proc: 0, guias: 0 });
  const sumar = (a: Acc, c: Ciudad) => { a.mov += n(c.movilizadas); a.ent += n(c.entregadas); a.dev += n(c.devueltas); a.proc += n(c.en_proceso); a.guias += n(c.guias); };
  const ciu = new Map<string, Acc & { ciudad: string; departamento: string; por_transp: Record<string, Acc>; por_mes: Record<string, Acc> }>();
  const deps = new Map<string, Acc & { departamento: string; por_transp: Record<string, Acc> }>();
  for (const p of porMes) for (const c of p.ciudad) {
    const k = `${c.ciudad}|${c.departamento}`;
    let x = ciu.get(k);
    if (!x) { x = { ...nuevo(), ciudad: c.ciudad, departamento: c.departamento, por_transp: {}, por_mes: {} }; ciu.set(k, x); }
    sumar(x, c); sumar((x.por_transp[c.transportadora] ??= nuevo()), c); sumar((x.por_mes[p.mes] ??= nuevo()), c);
    let d = deps.get(c.departamento);
    if (!d) { d = { ...nuevo(), departamento: c.departamento, por_transp: {} }; deps.set(c.departamento, d); }
    sumar(d, c); sumar((d.por_transp[c.transportadora] ??= nuevo()), c);
  }
  const ciudades = [...ciu.values()].sort((a, b) => b.mov - a.mov).slice(0, 150);
  const departamentos = [...deps.values()].sort((a, b) => b.mov - a.mov);

  // ── Comercial: usuarios, proveedores y productos del año ──
  type Ent = { nombre: string; total: number; entregado: number; devolucion: number; cancelado: number; despachado: number; por_mes: Record<string, number>; proveedor?: string; meses: number };
  const juntar = (campo: "by_dropshipper" | "by_proveedor" | "by_producto") => {
    const m = new Map<string, Ent>();
    for (const row of (comercial.data ?? []) as Record<string, unknown>[]) {
      const mes = String(row.mes);
      if (MESES.indexOf(mes) > mesActual) continue;
      for (const e of (Array.isArray(row[campo]) ? row[campo] : []) as Entidad[]) {
        const nombre = String(e.nombre || "").trim();
        if (!nombre) continue;
        let x = m.get(nombre);
        if (!x) { x = { nombre, total: 0, entregado: 0, devolucion: 0, cancelado: 0, despachado: 0, por_mes: {}, meses: 0, ...(e.proveedor ? { proveedor: e.proveedor } : {}) }; m.set(nombre, x); }
        const tot = n(e.total ?? e.ordenes);
        x.total += tot;
        if (!x.por_mes[mes]) x.meses++;
        x.por_mes[mes] = (x.por_mes[mes] ?? 0) + tot;
        const est = e.estados ?? {};
        x.entregado += n(est.ENTREGADO); x.devolucion += n(est.DEVOLUCION) + n(est["EN PROCESO DE DEVOLUCION"]);
        x.cancelado += n(est.CANCELADO) + n(est.RECHAZADO);
        x.despachado += Object.entries(est).filter(([k]) => !NO_DESPACHADO.has(k)).reduce((a, [, v]) => a + n(v), 0);
      }
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };
  const ds = juntar("by_dropshipper"), pv = juntar("by_proveedor"), pr = juntar("by_producto");
  const comercialMeses = ((comercial.data ?? []) as Record<string, unknown>[])
    .filter((r) => MESES.indexOf(String(r.mes)) <= mesActual)
    .map((r) => ({
      mes: String(r.mes), ordenes: n(r.total_orders), estados: (r.by_status ?? {}) as Record<string, number>,
      usuarios: Array.isArray(r.by_dropshipper) ? r.by_dropshipper.length : 0,
      proveedores: Array.isArray(r.by_proveedor) ? r.by_proveedor.length : 0,
      productos: Array.isArray(r.by_producto) ? r.by_producto.length : 0,
    }))
    .sort((a, b) => MESES.indexOf(a.mes) - MESES.indexOf(b.mes));

  return NextResponse.json({
    country, generado: new Date().toISOString(), mesActual: MESES[mesActual],
    meses, diario, transp, ciudades, departamentos,
    comercial: {
      meses: comercialMeses,
      usuarios: ds.slice(0, 100), usuariosTotal: ds.length,
      proveedores: pv.slice(0, 60), proveedoresTotal: pv.length,
      productos: pr.slice(0, 100), productosTotal: pr.length,
    },
    avisos,
  }, { headers: { "Cache-Control": "no-store" } });
}
