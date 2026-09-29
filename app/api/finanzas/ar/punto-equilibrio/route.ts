import { NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

export const runtime = "nodejs";

// Meses con detalle por transportadora (Urbano arrancó en marzo '26).
const MESES = ["abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// GET /api/finanzas/ar/punto-equilibrio
// Guías movilizadas EN VIVO con la misma regla y snapshot que el Dashboard operativo,
// por mes / día de orden / transportadora (+ valor para el ticket real), e ingresadas
// de resumen_operacional (Seguimiento Diario).
export async function GET() {
  const sb = getSupabase();
  const [ops, resumen] = await Promise.all([
    sb.rpc("get_ops_transportadora", { p_country: "ar", p_meses: MESES }),
    sb.from("resumen_operacional").select("mes, ingresadas").eq("country", "ar").in("mes", MESES),
  ]);
  if (ops.error) return NextResponse.json({ error: ops.error.message }, { status: 500 });
  if (resumen.error) return NextResponse.json({ error: resumen.error.message }, { status: 500 });

  const rows = (ops.data ?? []).map((t: Record<string, unknown>) => ({
    mes: String(t.mes),
    mesOrden: t.mes_orden == null ? null : Number(t.mes_orden),
    dia: t.dia == null ? null : Number(t.dia),
    transportadora: String(t.transportadora),
    total: Number(t.total) || 0,
    movilizadas: Number(t.movilizadas) || 0,
    entregadas: Number(t.entregadas) || 0,
    valor: Number(t.valor_movilizadas) || 0,
  }));

  return NextResponse.json(
    { rows, ingresadas: resumen.data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
