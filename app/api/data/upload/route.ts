import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

const UPLOAD_SECRET = process.env.DATA_UPLOAD_SECRET || "";

// POST /api/data/upload — Power BI pushes data here
// Body: { country: "py" | "ar", data: { ...dashboard data }, secret: "..." }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { country, data, secret } = body;

    // Verify upload secret
    if (!UPLOAD_SECRET || secret !== UPLOAD_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (country !== "py" && country !== "ar") {
      return NextResponse.json({ error: "Country must be 'py' or 'ar'" }, { status: 400 });
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Data is required and must be an object" }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from("dashboard_snapshots")
      .upsert(
        { country, data, updated_at: new Date().toISOString() },
        { onConflict: "country" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      country,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
