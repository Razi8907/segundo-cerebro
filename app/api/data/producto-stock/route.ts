import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

const COLS = "producto_nombre, stock_real, updated_by_name, updated_at";

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try { return await verifyToken(token); } catch { return null; }
}

// GET /api/data/producto-stock?country=py → stock por producto
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const country = req.nextUrl.searchParams.get("country") || "py";
  const { data, error } = await getSupabase()
    .from("producto_stock").select(COLS).eq("country", country).limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// PUT /api/data/producto-stock → upsert del stock de un producto
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "admin" && !user.access_comercial) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  try {
    const b = await req.json();
    if (!b.country || !b.producto_nombre) {
      return NextResponse.json({ error: "country y producto_nombre requeridos" }, { status: 400 });
    }
    const stock = b.stock_real === null || b.stock_real === undefined || b.stock_real === ""
      ? null : Math.max(0, Math.round(Number(b.stock_real)) || 0);
    const { data, error } = await getSupabase()
      .from("producto_stock")
      .upsert({ country: b.country, producto_nombre: String(b.producto_nombre), stock_real: stock, updated_by_name: user.name || "", updated_at: new Date().toISOString() },
        { onConflict: "country,producto_nombre" })
      .select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    console.error("[producto-stock PUT]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
