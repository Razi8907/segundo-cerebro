import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";

// GET /api/data/estrategia?country=py
// Devuelve data.estrategia_usuarios del dashboard_snapshots.
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";

  const { data, error } = await getSupabase()
    .from("dashboard_snapshots")
    .select("data")
    .eq("country", country)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const e = (data?.data as { estrategia_usuarios?: unknown })?.estrategia_usuarios;
  if (!e) return NextResponse.json({ error: "No data" }, { status: 404 });
  return NextResponse.json(e);
}
