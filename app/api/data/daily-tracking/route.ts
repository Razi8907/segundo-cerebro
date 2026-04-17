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
    console.error("[daily-tracking GET] Supabase error:", error);
    // Table may not exist yet — return empty instead of failing
    return NextResponse.json({ days: [] });
  }
  return NextResponse.json({ days: data || [] });
}

// PUT /api/data/daily-tracking — upsert a single day
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado (sin token de sesion)" }, { status: 401 });
    try {
      await verifyToken(token);
    } catch (e: any) {
      return NextResponse.json({ error: `Token invalido o expirado: ${e?.message || e}. Hace logout y login de nuevo.` }, { status: 401 });
    }

    const { country, fecha, ordenes, dia_semana } = await req.json();
    if (!country || fecha === undefined || ordenes === undefined || !dia_semana) {
      return NextResponse.json({ error: "country, fecha, ordenes, dia_semana required" }, { status: 400 });
    }

    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const activeKey = svcKey || anonKey;
    // Decode JWT payload to check actual role
    let jwtRole = "unknown";
    try {
      const parts = activeKey.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        jwtRole = payload.role || "no-role-field";
      }
    } catch { jwtRole = "decode-error"; }
    const sameKey = svcKey === anonKey;

    const supabase = getSupabase();

    // Delete existing row first, then insert
    await supabase.from("daily_tracking").delete().eq("country", country).eq("fecha", fecha);

    const { error } = await supabase
      .from("daily_tracking")
      .insert({ country, fecha, ordenes, dia_semana, updated_at: new Date().toISOString() });

    if (error) {
      console.error("[daily-tracking PUT]", error, "role:", jwtRole, "sameAsAnon:", sameKey);
      return NextResponse.json({
        error: `DB error (role=${jwtRole}, sameAsAnon=${sameKey}): ${error.message}`,
      }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[daily-tracking PUT] Exception:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}

// DELETE /api/data/daily-tracking?country=py&fecha=5 — delete a day
// DELETE /api/data/daily-tracking?country=py — delete all days for country
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado (sin token de sesion)" }, { status: 401 });
    try {
      await verifyToken(token);
    } catch (e: any) {
      return NextResponse.json({ error: `Token invalido o expirado: ${e?.message || e}` }, { status: 401 });
    }

    const country = req.nextUrl.searchParams.get("country");
    const fechaStr = req.nextUrl.searchParams.get("fecha");
    if (!country) return NextResponse.json({ error: "country required" }, { status: 400 });

    let q = getSupabase().from("daily_tracking").delete().eq("country", country);
    if (fechaStr) q = q.eq("fecha", parseInt(fechaStr));

    const { error } = await q;
    if (error) {
      console.error("[daily-tracking DELETE] Supabase error:", error);
      return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[daily-tracking DELETE] Exception:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}
