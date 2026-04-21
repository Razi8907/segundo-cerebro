import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

// TEMPORARY: one-time fix for Argentina meta
// DELETE THIS FILE AFTER USE
export async function GET() {
  try {
    const { data: current, error: fetchErr } = await getSupabase()
      .from("dashboard_snapshots")
      .select("data")
      .eq("country", "ar")
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "No AR data found", detail: fetchErr?.message }, { status: 404 });
    }

    const updatedData = {
      ...current.data,
      meta_info: {
        ...current.data.meta_info,
        meta_movilizadas_abril: 9382,
        meta_ingresadas_abril: 12509,
        promedio_diario_necesario: 417,
      },
    };

    const { error } = await getSupabase()
      .from("dashboard_snapshots")
      .update({ data: updatedData, updated_at: new Date().toISOString() })
      .eq("country", "ar");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Argentina meta updated: movilizadas=9382, ingresadas=12509, diario=417",
      meta_info: updatedData.meta_info,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
