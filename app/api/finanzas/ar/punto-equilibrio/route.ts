import { NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

export const runtime = "nodejs";

// Meses con operación medible para el punto de equilibrio (Informe Utilidad desde enero,
// pero el detalle por transportadora solo tiene sentido desde abril: Urbano arrancó en marzo).
const MESES = ["abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// GET /api/finanzas/ar/punto-equilibrio
// Devuelve, por mes: ingresadas/movilizadas (resumen_operacional, misma fuente que Operaciones)
// y el desglose por transportadora del último snapshot de operations_data (mix + ticket real).
export async function GET() {
  const sb = getSupabase();
  const { data: resumen, error } = await sb
    .from("resumen_operacional")
    .select("mes, ingresadas, movilizadas, entregadas, devueltas, en_proceso, updated_at")
    .eq("country", "ar")
    .in("mes", MESES);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meses = (resumen ?? []).filter((r) => (r.movilizadas ?? 0) > 0).map((r) => r.mes);
  let transportadoras: { mes: string; transportadora: string; total: number; movilizadas: number; entregadas: number; ticket: number }[] = [];
  if (meses.length > 0) {
    const { data, error: e2 } = await sb.rpc("get_ops_transportadora", { p_country: "ar", p_meses: meses });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    transportadoras = (data ?? []).map((t: Record<string, unknown>) => ({
      mes: String(t.mes),
      transportadora: String(t.transportadora),
      total: Number(t.total) || 0,
      movilizadas: Number(t.movilizadas) || 0,
      entregadas: Number(t.entregadas) || 0,
      ticket: Number(t.ticket) || 0,
    }));
  }

  return NextResponse.json(
    { resumen: resumen ?? [], transportadoras },
    { headers: { "Cache-Control": "no-store" } },
  );
}
