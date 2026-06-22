import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";

// GET /api/data/resumen-operacional?country=ar|py
// Devuelve { rows: [{country, mes, ingresadas, movilizadas, entregadas, devueltas, en_proceso, updated_at}] }
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";
  const { data, error } = await getSupabase()
    .from("resumen_operacional")
    .select("*")
    .eq("country", country)
    .order("mes");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}
