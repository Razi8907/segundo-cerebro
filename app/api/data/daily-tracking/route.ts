import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/daily-tracking?country=py
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";
  const { data, error } = await getSupabase()
    .from("daily_tracking")
    .select("fecha, ordenes, dia_semana")
    .eq("country", country)
    .order("fecha");

  if (error) {
    // Table may not exist yet — return empty instead of failing
    return NextResponse.json({ days: [] });
  }
  return NextResponse.json({ days: data || [] });
}

// PUT /api/data/daily-tracking — upsert a single day
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const { country, fecha, ordenes, dia_semana } = await req.json();
    if (!country || fecha === undefined || ordenes === undefined || !dia_semana) {
      return NextResponse.json({ error: "country, fecha, ordenes, dia_semana required" }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from("daily_tracking")
      .upsert(
        { country, fecha, ordenes, dia_semana, updated_at: new Date().toISOString() },
        { onConflict: "country,fecha" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/data/daily-tracking?country=py&fecha=5 — delete a day
// DELETE /api/data/daily-tracking?country=py — delete all days for country
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const country = req.nextUrl.searchParams.get("country");
    const fechaStr = req.nextUrl.searchParams.get("fecha");
    if (!country) return NextResponse.json({ error: "country required" }, { status: 400 });

    let q = getSupabase().from("daily_tracking").delete().eq("country", country);
    if (fechaStr) q = q.eq("fecha", parseInt(fechaStr));

    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
