import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";

// GET /api/data/usuarios?country=py
// Devuelve solo data.usuarios_segmentados del dashboard_snapshots.
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";

  const { data, error } = await getSupabase()
    .from("dashboard_snapshots")
    .select("data")
    .eq("country", country)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const us = (data?.data as any)?.usuarios_segmentados;
  if (!us) return NextResponse.json({ error: "No data" }, { status: 404 });
  return NextResponse.json(us);
}
