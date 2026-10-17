import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

// GET /api/data/py or /api/data/ar — returns latest dashboard data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ country: string }> }
) {
  try {
    const { country } = await params;

    if (country !== "py" && country !== "ar") {
      return NextResponse.json({ error: "Country must be 'py' or 'ar'" }, { status: 400 });
    }

    // ?solo=meta_info → devuelve solo las metas (el snapshot completo de PY pesa ~6 MB)
    if (req.nextUrl.searchParams.get("solo") === "meta_info") {
      const r = await getSupabase().from("dashboard_snapshots").select("meta_info:data->meta_info, updated_at").eq("country", country).single();
      if (r.error || !r.data) return NextResponse.json({ error: "Data not found" }, { status: 404 });
      return NextResponse.json({ meta_info: (r.data as { meta_info: unknown }).meta_info ?? {}, _updated_at: (r.data as { updated_at: string }).updated_at });
    }

    const { data, error } = await getSupabase()
      .from("dashboard_snapshots")
      .select("data, updated_at")
      .eq("country", country)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Data not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...data.data,
      _updated_at: data.updated_at,
    });
  } catch (err) {
    console.error("Data fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
