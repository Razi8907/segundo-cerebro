import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

const isColumnMissing = (err: any) => {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("mes");
};

// GET /api/data/operational?country=ar&mes=abril
// Resiliente: si la columna `mes` no existe, para abril cae al SELECT sin filtro.
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "ar";
  const mes = req.nextUrl.searchParams.get("mes") || "abril";
  const supabase = getSupabase();

  // Intento con filtro mes
  const filtered = await supabase
    .from("operational_snapshots")
    .select("data, raw_count, uploaded_at")
    .eq("country", country)
    .eq("mes", mes)
    .maybeSingle();

  if (!filtered.error && filtered.data) {
    return NextResponse.json({
      data: filtered.data.data,
      raw_count: filtered.data.raw_count,
      uploaded_at: filtered.data.uploaded_at,
    });
  }

  // Si la columna mes no existe (migración pendiente) y pidió abril → query legacy
  if (filtered.error && isColumnMissing(filtered.error) && mes === "abril") {
    const legacy = await supabase
      .from("operational_snapshots")
      .select("data, raw_count, uploaded_at")
      .eq("country", country)
      .maybeSingle();
    if (!legacy.error && legacy.data) {
      return NextResponse.json({
        data: legacy.data.data,
        raw_count: legacy.data.raw_count,
        uploaded_at: legacy.data.uploaded_at,
      });
    }
  }

  return NextResponse.json({ data: null });
}

// POST /api/data/operational — save aggregated data, scoped por country+mes
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const body = await req.json();
    const { country, data, raw_count } = body;
    const mes = body.mes || "abril";

    if (!country || !data) {
      return NextResponse.json({ error: "country and data required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const row = { country, mes, data, raw_count: raw_count || 0, uploaded_at: new Date().toISOString() };

    // Intento con onConflict country+mes
    let { error } = await supabase
      .from("operational_snapshots")
      .upsert(row, { onConflict: "country,mes" });

    if (error && isColumnMissing(error)) {
      if (mes !== "abril") {
        return NextResponse.json(
          { error: "Migración pendiente: agregá la columna 'mes' a operational_snapshots antes de cargar mayo." },
          { status: 503 },
        );
      }
      // Pre-migración legacy: upsert por country sin mes
      const legacyRow: any = { country, data: row.data, raw_count: row.raw_count, uploaded_at: row.uploaded_at };
      const r2 = await supabase
        .from("operational_snapshots")
        .upsert(legacyRow, { onConflict: "country" });
      error = r2.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Operational upload error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
