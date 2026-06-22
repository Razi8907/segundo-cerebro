import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { buildEstrategia } from "../../../../lib/estrategia-builder";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/data/estrategia/rebuild?country=ar|py
// Reconstruye dashboard_snapshots.data.estrategia_usuarios desde la data actual
// en operational_snapshots + dashboard_snapshots.dropshippers.
export async function POST(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  if (!["ar", "py"].includes(country)) {
    return NextResponse.json({ error: "country inválido" }, { status: 400 });
  }
  return rebuildEstrategia(country as "ar" | "py");
}

// Helper exportable para invocar desde otros endpoints (write-through cache)
export async function rebuildEstrategia(country: "ar" | "py") {
  const supabase = getSupabase();
  const [snapRes, opsRes] = await Promise.all([
    supabase.from("dashboard_snapshots").select("data").eq("country", country).maybeSingle(),
    supabase.from("operational_snapshots").select("mes, data").eq("country", country).in("mes", ["abril","mayo","junio"]),
  ]);
  if (snapRes.error) return NextResponse.json({ error: "Read dashboard failed: " + snapRes.error.message }, { status: 500 });
  if (opsRes.error) return NextResponse.json({ error: "Read operational failed: " + opsRes.error.message }, { status: 500 });

  const snap = (snapRes.data?.data as Record<string, unknown>) || {};
  const q2 = (opsRes.data || []).map((r) => ({ mes: r.mes as string, data: r.data as Parameters<typeof buildEstrategia>[2][number]["data"] }));
  const existing = (snap.estrategia_usuarios as Parameters<typeof buildEstrategia>[3] extends { existing?: infer E } ? E : null) || null;

  const estrategia = buildEstrategia(country, snap as Parameters<typeof buildEstrategia>[1], q2, { existing });
  snap.estrategia_usuarios = estrategia;

  const { error: writeErr } = await supabase
    .from("dashboard_snapshots")
    .update({ data: snap, updated_at: new Date().toISOString() })
    .eq("country", country);
  if (writeErr) return NextResponse.json({ error: "Write failed: " + writeErr.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    country,
    total_usuarios: estrategia.usuarios.length,
    updated_at: estrategia.updated_at,
  });
}
