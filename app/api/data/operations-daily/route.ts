import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/data/operations-daily?country=ar|py&mes=julio
// Desglose DIARIO (por fecha_orden) desde operations_data, aplicando la regla
// oficial de Operaciones vía la función SQL get_ops_daily:
//   movilizada = fecha_procesamiento != null AND estatus NOT IN cancelacion.
// Usa la última fecha_carga del mes (misma fuente que el dashboard de Operaciones).
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  const mes = (req.nextUrl.searchParams.get("mes") || "abril").toLowerCase();
  if (!["ar", "py"].includes(country)) {
    return NextResponse.json({ error: "country inválido" }, { status: 400 });
  }

  const { data, error } = await getSupabase().rpc("get_ops_daily", {
    p_country: country,
    p_mes: mes,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dias: data ?? [] });
}
