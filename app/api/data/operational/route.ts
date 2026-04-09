import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/operational?country=ar
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "ar";

  const { data, error } = await getSupabase()
    .from("operational_snapshots")
    .select("data, raw_count, uploaded_at")
    .eq("country", country)
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: data.data,
    raw_count: data.raw_count,
    uploaded_at: data.uploaded_at,
  });
}

// POST /api/data/operational — save aggregated data
export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const body = await req.json();
    const { country, data, raw_count } = body;

    if (!country || !data) {
      return NextResponse.json({ error: "country and data required" }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from("operational_snapshots")
      .upsert(
        { country, data, raw_count: raw_count || 0, uploaded_at: new Date().toISOString() },
        { onConflict: "country" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Operational upload error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
