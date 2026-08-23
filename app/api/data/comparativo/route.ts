import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const PREV: Record<string, string> = {
  enero: "diciembre", febrero: "enero", marzo: "febrero", abril: "marzo",
  mayo: "abril", junio: "mayo", julio: "junio", agosto: "julio",
  septiembre: "agosto", octubre: "septiembre", noviembre: "octubre", diciembre: "noviembre",
};

// GET /api/data/comparativo?country=py&mes=agosto
// Devuelve: clasificación del mes (grupos A/B/C) + desglose diario (órdenes/movilizadas)
// del mes actual y del anterior, para el módulo Comparativo + Proyección.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "Token inválido" }, { status: 401 }); }

  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  const mes = (req.nextUrl.searchParams.get("mes") || "agosto").toLowerCase();
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });
  const mesPrev = PREV[mes] || "";

  const sb = getSupabase();
  const [clasifRes, dActualRes, dPrevRes] = await Promise.all([
    sb.rpc("get_ops_clasif", { p_country: country, p_mes: mes }),
    sb.rpc("get_ops_daily_ord", { p_country: country, p_mes: mes }),
    mesPrev ? sb.rpc("get_ops_daily_ord", { p_country: country, p_mes: mesPrev }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (clasifRes.error) return NextResponse.json({ error: clasifRes.error.message }, { status: 500 });
  if (dActualRes.error) return NextResponse.json({ error: dActualRes.error.message }, { status: 500 });

  return NextResponse.json({
    mes, mesPrev,
    clasif: (clasifRes.data && clasifRes.data[0]) || null,
    dailyActual: dActualRes.data || [],
    dailyPrev: (dPrevRes as { data?: unknown[] }).data || [],
  });
}
