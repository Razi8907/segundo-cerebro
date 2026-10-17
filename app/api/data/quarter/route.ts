import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MESES_VALIDOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// GET /api/data/quarter?country=ar|py&meses=julio,agosto,septiembre[&transp=julio,agosto,septiembre]
// Desglose diario por mes con la regla de Operaciones (get_ops_daily_mes): solo
// cuenta guías cuya fecha de orden es del mes, última carga completa del mes.
// Ingresadas = Seguimiento Diario (daily_tracking).
// transp: meses para los que además se devuelve el desglose por transportadora
// (get_ops_transp_mes, misma regla que Operaciones → Por Logística).
// Todo pasa por get_ops_mes_cached: solo recalcula si hubo una carga nueva del mes.
// Si un mes falla (p. ej. timeout justo después de una carga), se reintenta una vez y si
// no, se devuelve el último resultado guardado; si tampoco hay, el mes va en `avisos`
// como faltante y el resto del trimestre se muestra igual.
type Kind = "daily" | "transp";
type Resultado = { rows: unknown[]; estado: "ok" | "guardado" | "faltante"; guardadoEl?: string };

async function cargarMes(sb: ReturnType<typeof getSupabase>, country: string, mes: string, kind: Kind): Promise<Resultado> {
  for (let intento = 1; intento <= 2; intento++) {
    const r = await sb.rpc("get_ops_mes_cached", { p_country: country, p_mes: mes, p_kind: kind });
    if (!r.error) return { rows: Array.isArray(r.data) ? r.data : [], estado: "ok" };
  }
  const stale = await sb.from("ops_mes_cache").select("rows, updated_at").eq("country", country).eq("mes", mes).eq("kind", kind).maybeSingle();
  if (!stale.error && stale.data) {
    return { rows: Array.isArray(stale.data.rows) ? stale.data.rows : [], estado: "guardado", guardadoEl: stale.data.updated_at as string };
  }
  return { rows: [], estado: "faltante" };
}

export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  const parse = (k: string) => (req.nextUrl.searchParams.get(k) || "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter((m) => MESES_VALIDOS.includes(m));
  const meses = parse("meses");
  const transpMeses = parse("transp");
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });
  if (meses.length === 0) return NextResponse.json({ error: "meses requerido" }, { status: 400 });

  const sb = getSupabase();
  const [daily, transpRes] = await Promise.all([
    Promise.all(meses.map((m) => cargarMes(sb, country, m, "daily"))),
    Promise.all(transpMeses.map((m) => cargarMes(sb, country, m, "transp"))),
  ]);

  const out: Record<string, unknown[]> = {};
  const transp: Record<string, unknown[]> = {};
  const avisos: { mes: string; tipo: Kind; estado: "guardado" | "faltante"; guardadoEl?: string }[] = [];
  const registrar = (m: string, tipo: Kind, r: Resultado) => {
    if (r.estado !== "ok") avisos.push({ mes: m, tipo, estado: r.estado, guardadoEl: r.guardadoEl });
  };
  meses.forEach((m, i) => { out[m] = daily[i].rows; registrar(m, "daily", daily[i]); });
  transpMeses.forEach((m, i) => { transp[m] = transpRes[i].rows; registrar(m, "transp", transpRes[i]); });

  return NextResponse.json({ meses: out, transp, avisos }, { headers: { "Cache-Control": "no-store" } });
}
