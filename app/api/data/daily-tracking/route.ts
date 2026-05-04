import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/daily-tracking?country=py&mes=abril
// Resiliente: si la columna `mes` no existe (migración pendiente),
// para abril cae al SELECT sin filtro; para mayo devuelve vacío.
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";
  const mes = req.nextUrl.searchParams.get("mes") || "abril";
  const supabase = getSupabase();

  // Intento con filtro de mes
  const filtered = await supabase
    .from("daily_tracking")
    .select("fecha, ordenes, dia_semana")
    .eq("country", country)
    .eq("mes", mes)
    .order("fecha");

  if (!filtered.error) {
    return NextResponse.json({ days: filtered.data || [] });
  }

  // Si el error es por columna inexistente (migración pendiente):
  const msg = String(filtered.error.message || "").toLowerCase();
  const columnMissing = msg.includes("column") && msg.includes("mes");
  if (columnMissing && mes === "abril") {
    // Legacy: toda la data existente es de abril
    const legacy = await supabase
      .from("daily_tracking")
      .select("fecha, ordenes, dia_semana")
      .eq("country", country)
      .order("fecha");
    if (!legacy.error) return NextResponse.json({ days: legacy.data || [] });
  }
  if (columnMissing && mes !== "abril") {
    // Pre-migración no hay forma de tener data de mayo
    return NextResponse.json({ days: [] });
  }

  console.error("[daily-tracking GET] Supabase error:", filtered.error);
  return NextResponse.json({ days: [] });
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

    const { country, mes, fecha, ordenes, dia_semana } = await req.json();
    const mesValue = mes || "abril";
    if (!country || fecha === undefined || ordenes === undefined || !dia_semana) {
      return NextResponse.json({ error: "country, fecha, ordenes, dia_semana required" }, { status: 400 });
    }

    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const activeKey = svcKey || anonKey;
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

    // Delete existing row first (matched by country+mes+fecha), then insert
    let delQ = supabase.from("daily_tracking").delete().eq("country", country).eq("fecha", fecha);
    // Probar con mes; si falla por columna inexistente, hacer delete sin mes
    let delErr: any = (await delQ.eq("mes", mesValue)).error;
    let columnMissing = delErr && String(delErr.message || "").toLowerCase().includes("column") && String(delErr.message || "").toLowerCase().includes("mes");
    if (columnMissing) {
      // Solo se puede usar abril en pre-migración
      if (mesValue !== "abril") {
        return NextResponse.json({ error: "Migración pendiente: agregá la columna 'mes' antes de cargar mayo." }, { status: 503 });
      }
      delErr = (await supabase.from("daily_tracking").delete().eq("country", country).eq("fecha", fecha)).error;
    }

    let insertObj: any = { country, fecha, ordenes, dia_semana, updated_at: new Date().toISOString() };
    if (!columnMissing) insertObj.mes = mesValue;

    const { error } = await supabase
      .from("daily_tracking")
      .insert(insertObj);

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

// DELETE /api/data/daily-tracking?country=py&mes=abril&fecha=5 — delete a specific day
// DELETE /api/data/daily-tracking?country=py&mes=abril — delete all days of a month for country
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
    const mes = req.nextUrl.searchParams.get("mes") || "abril";
    const fechaStr = req.nextUrl.searchParams.get("fecha");
    if (!country) return NextResponse.json({ error: "country required" }, { status: 400 });

    const supabase = getSupabase();
    // Intento con filtro de mes
    let q = supabase.from("daily_tracking").delete().eq("country", country);
    let withMes = q.eq("mes", mes);
    if (fechaStr) withMes = withMes.eq("fecha", parseInt(fechaStr));
    let { error } = await withMes;
    const msg = String(error?.message || "").toLowerCase();
    const columnMissing = error && msg.includes("column") && msg.includes("mes");
    if (columnMissing && mes === "abril") {
      let fallback = supabase.from("daily_tracking").delete().eq("country", country);
      if (fechaStr) fallback = fallback.eq("fecha", parseInt(fechaStr));
      const r2 = await fallback;
      error = r2.error;
    }
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
