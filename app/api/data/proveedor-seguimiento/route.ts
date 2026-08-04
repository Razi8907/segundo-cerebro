import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

const COLS = "orden_id, proveedor_nombre, proveedor_id, bodega, bodega_id, estatus, fecha_pendiente, fecha_guia, fecha_ultimo_mov";

// GET /api/data/proveedor-seguimiento?country=py → órdenes activas + meta de la carga
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "Token inválido" }, { status: 401 }); }

  const country = req.nextUrl.searchParams.get("country") || "py";
  const sb = getSupabase();
  const [ordRes, metaRes] = await Promise.all([
    sb.from("proveedor_ordenes_seguimiento").select(COLS).eq("country", country).limit(20000),
    sb.from("proveedor_seguimiento_meta").select("fecha_carga, total_activas, updated_by_name, updated_at").eq("country", country).maybeSingle(),
  ]);
  if (ordRes.error) return NextResponse.json({ error: ordRes.error.message }, { status: 500 });
  return NextResponse.json({ ordenes: ordRes.data || [], meta: metaRes.data || null });
}
