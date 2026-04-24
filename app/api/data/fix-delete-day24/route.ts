import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

// TEMPORARY: delete day 24 from both countries. DELETE THIS FILE AFTER USE.
export async function GET() {
  try {
    const results: string[] = [];
    for (const country of ["py", "ar"]) {
      const { error } = await getSupabase()
        .from("daily_tracking")
        .delete()
        .eq("country", country)
        .eq("fecha", 24);
      results.push(`${country}: ${error ? error.message : "deleted day 24"}`);
    }
    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
