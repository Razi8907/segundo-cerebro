import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/kpis-okr?country=py
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";

  const { data, error } = await getSupabase()
    .from("kpis_okr")
    .select("data, uploaded_at")
    .eq("country", country)
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: data.data,
    uploaded_at: data.uploaded_at,
  });
}

// POST /api/data/kpis-okr — save full dataset (upload or bulk)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const body = await req.json();
    const { country, data } = body;

    if (!country || !data) {
      return NextResponse.json({ error: "country and data required" }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from("kpis_okr")
      .upsert(
        { country, data, uploaded_at: new Date().toISOString() },
        { onConflict: "country" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("KPIs OKR POST error:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}

// PUT /api/data/kpis-okr — update individual field
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado (sin token de sesion)" }, { status: 401 });
    try {
      await verifyToken(token);
    } catch (e: any) {
      return NextResponse.json({ error: `Token invalido o expirado: ${e?.message || e}. Hace logout y login de nuevo.` }, { status: 401 });
    }

    const { country, path, value } = await req.json();
    if (!country || !path) {
      return NextResponse.json({ error: "country, path required" }, { status: 400 });
    }

    // Load existing data
    const supabase = getSupabase();
    const { data: existing, error: fetchError } = await supabase
      .from("kpis_okr")
      .select("data")
      .eq("country", country)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "No data found for country" }, { status: 404 });
    }

    const currentData = existing.data;

    // path is an array of keys to navigate the JSON, e.g. ["objectives", 0, "krs", 1, "months", 3, "objetivo"]
    let target = currentData;
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]];
      if (!target) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
      }
    }
    target[path[path.length - 1]] = value;

    const { error } = await supabase
      .from("kpis_okr")
      .upsert(
        { country, data: currentData, uploaded_at: new Date().toISOString() },
        { onConflict: "country" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("KPIs OKR PUT error:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}
