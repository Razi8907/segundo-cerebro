import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/stock?country=ar
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "ar";
  const { data, error } = await getSupabase()
    .from("product_stock")
    .select("*")
    .eq("country", country)
    .order("product_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data || [] });
}

// PUT /api/data/stock — update stock for a product
export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado (sin token)" }, { status: 401 });
    try {
      await verifyToken(token);
    } catch (e: any) {
      return NextResponse.json({ error: `Token invalido: ${e?.message || e}` }, { status: 401 });
    }

    const { country, product_id, stock_actual } = await req.json();
    if (!country || !product_id || stock_actual === undefined) {
      return NextResponse.json({ error: "country, product_id, stock_actual required" }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from("product_stock")
      .upsert(
        { country, product_id, stock_actual, updated_at: new Date().toISOString() },
        { onConflict: "country,product_id" }
      );

    if (error) {
      console.error("[stock PUT] Supabase error:", error);
      return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[stock PUT] Exception:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}

// POST /api/data/stock — add new product to track
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado (sin token)" }, { status: 401 });
    try {
      await verifyToken(token);
    } catch (e: any) {
      return NextResponse.json({ error: `Token invalido: ${e?.message || e}` }, { status: 401 });
    }

    const { country, product_id, product_name, proveedor, stock_actual } = await req.json();
    if (!country || !product_id || !product_name) {
      return NextResponse.json({ error: "country, product_id, product_name required" }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from("product_stock")
      .upsert(
        { country, product_id, product_name, proveedor: proveedor || "", stock_actual: stock_actual || 0, updated_at: new Date().toISOString() },
        { onConflict: "country,product_id" }
      );

    if (error) {
      console.error("[stock POST] Supabase error:", error);
      return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[stock POST] Exception:", err);
    return NextResponse.json({ error: `Error interno: ${err?.message || err}` }, { status: 500 });
  }
}
