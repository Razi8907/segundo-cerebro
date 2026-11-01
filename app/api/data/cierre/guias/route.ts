import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";
import { cargarFletes } from "../../../../lib/flete-cierre";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/data/cierre/guias?country=py&ds_id=75300
// Guías abiertas del dropshipper en el Q4 (todo lo que no está entregado, cancelado ni ya
// devuelto): novedades, en proceso de devolución, en tránsito, pendientes. Una fila por guía.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  const dsId = (req.nextUrl.searchParams.get("ds_id") || "").trim();
  if (!["ar", "py"].includes(country) || !dsId) return NextResponse.json({ error: "country y ds_id requeridos" }, { status: 400 });

  const sb = getSupabase();
  const [r, fletes] = await Promise.all([
    sb.rpc("get_ops_ds_guias", { p_country: country, p_meses: ["octubre", "noviembre", "diciembre"], p_ds_id: dsId }),
    cargarFletes(sb, country).catch(() => null),
  ]);
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  // Flete estimado de cada guía (= lo que se debita si termina en devolución)
  const guias = ((r.data ?? []) as { transportadora: string; ciudad: string }[]).map((g) => {
    const e = fletes?.estimar(dsId, g.transportadora, g.ciudad);
    return { ...g, flete_est: e ? Math.round(e.flete) : null, flete_nivel: e?.nivel ?? null };
  });
  return NextResponse.json({ guias }, { headers: { "Cache-Control": "no-store" } });
}
