import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";
import { buildEstrategia } from "../../../lib/estrategia-builder";

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

    // Write-through: reconstruir estrategia_usuarios para que refleje la data nueva.
    // Si falla, no rompemos el upload — solo logueamos.
    let estrategia_users = 0;
    try {
      if (["ar", "py"].includes(country)) {
        const [snapRes, opsRes] = await Promise.all([
          supabase.from("dashboard_snapshots").select("data").eq("country", country).maybeSingle(),
          supabase.from("operational_snapshots").select("mes, data").eq("country", country).in("mes", ["abril","mayo","junio"]),
        ]);
        if (!snapRes.error && !opsRes.error) {
          const snap = (snapRes.data?.data as Record<string, unknown>) || {};
          const q2 = (opsRes.data || []).map((r) => ({ mes: r.mes as string, data: r.data as Parameters<typeof buildEstrategia>[2][number]["data"] }));
          const estrategia = buildEstrategia(country as "ar" | "py", snap as Parameters<typeof buildEstrategia>[1], q2);
          snap.estrategia_usuarios = estrategia;
          await supabase.from("dashboard_snapshots").update({ data: snap, updated_at: new Date().toISOString() }).eq("country", country);
          estrategia_users = estrategia.usuarios.length;
        }
      }
    } catch (e) {
      console.warn("[operational/POST] estrategia rebuild failed (non-blocking):", e);
    }

    return NextResponse.json({ success: true, estrategia_users });
  } catch (err) {
    console.error("Operational upload error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
