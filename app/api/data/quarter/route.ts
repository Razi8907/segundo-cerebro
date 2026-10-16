import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MESES_VALIDOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// GET /api/data/quarter?country=ar|py&meses=julio,agosto,septiembre
// Desglose diario por mes con la regla de Operaciones (get_ops_daily_mes): solo
// cuenta guías cuya fecha de orden es del mes, último archivo cargado del mes.
// Ingresadas = Seguimiento Diario (daily_tracking).
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  const meses = (req.nextUrl.searchParams.get("meses") || "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter((m) => MESES_VALIDOS.includes(m));
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });
  if (meses.length === 0) return NextResponse.json({ error: "meses requerido" }, { status: 400 });

  const sb = getSupabase();
  const results = await Promise.all(meses.map((m) => sb.rpc("get_ops_daily_mes", { p_country: country, p_mes: m })));
  const out: Record<string, unknown[]> = {};
  for (let i = 0; i < meses.length; i++) {
    const r = results[i];
    if (r.error) return NextResponse.json({ error: `${meses[i]}: ${r.error.message}` }, { status: 500 });
    out[meses[i]] = r.data ?? [];
  }
  return NextResponse.json({ meses: out }, { headers: { "Cache-Control": "no-store" } });
}
