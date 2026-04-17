import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/seguimiento-comercial?country=py
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";

  const { data, error } = await getSupabase()
    .from("seguimiento_comercial")
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

// POST /api/data/seguimiento-comercial — save full dataset (upload or bulk)
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
      .from("seguimiento_comercial")
      .upsert(
        { country, data, uploaded_at: new Date().toISOString() },
        { onConflict: "country" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Seguimiento comercial POST error:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}

// PUT /api/data/seguimiento-comercial — update individual record fields
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado (sin token de sesion)" }, { status: 401 });
    try {
      await verifyToken(token);
    } catch (e: any) {
      return NextResponse.json({ error: `Token invalido o expirado: ${e?.message || e}. Hace logout y login de nuevo.` }, { status: 401 });
    }

    const { country, sheet, rowIndex, field, value } = await req.json();
    if (!country || !sheet || rowIndex === undefined || !field) {
      return NextResponse.json({ error: "country, sheet, rowIndex, field required" }, { status: 400 });
    }

    // Load existing data
    const supabase = getSupabase();
    const { data: existing, error: fetchError } = await supabase
      .from("seguimiento_comercial")
      .select("data")
      .eq("country", country)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "No data found for country" }, { status: 404 });
    }

    const currentData = existing.data;
    if (!currentData[sheet] || !currentData[sheet][rowIndex]) {
      return NextResponse.json({ error: "Invalid sheet or rowIndex" }, { status: 400 });
    }

    currentData[sheet][rowIndex][field] = value;

    const { error } = await supabase
      .from("seguimiento_comercial")
      .upsert(
        { country, data: currentData, uploaded_at: new Date().toISOString() },
        { onConflict: "country" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Seguimiento comercial PUT error:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}
