import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// PUT /api/data/update-meta — update meta_info in dashboard_snapshots
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const { country, meta_info } = await req.json();
    if (!country || !meta_info) {
      return NextResponse.json({ error: "country and meta_info required" }, { status: 400 });
    }

    // Get current data
    const { data: current, error: fetchErr } = await getSupabase()
      .from("dashboard_snapshots")
      .select("data")
      .eq("country", country)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "No data found for country" }, { status: 404 });
    }

    // Merge meta_info
    const updatedData = { ...current.data, meta_info: { ...current.data.meta_info, ...meta_info } };

    const { error } = await getSupabase()
      .from("dashboard_snapshots")
      .update({ data: updatedData, updated_at: new Date().toISOString() })
      .eq("country", country);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, meta_info: updatedData.meta_info });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}
