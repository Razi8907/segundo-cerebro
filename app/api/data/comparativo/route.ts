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
const MESNUM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
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
  // Ingresadas vienen del Seguimiento Diario (daily_tracking) vía get_ops_daily;
  // movilizadas/entregadas/devueltas/canceladas de operations_data. get_ops_clasif
  // aporta el desglose de estados pendientes (grupo B).
  const [clasifRes, dActualRes, dPrevRes] = await Promise.all([
    sb.rpc("get_ops_clasif", { p_country: country, p_mes: mes }),
    sb.rpc("get_ops_daily", { p_country: country, p_mes: mes }),
    mesPrev ? sb.rpc("get_ops_daily", { p_country: country, p_mes: mesPrev }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (clasifRes.error) return NextResponse.json({ error: clasifRes.error.message }, { status: 500 });
  if (dActualRes.error) return NextResponse.json({ error: dActualRes.error.message }, { status: 500 });

  // Día N = último día del mes actual con datos (ingresadas o movilizadas > 0).
  type Row = { dia: number; ingresadas: number; movilizadas: number };
  const dActual = (dActualRes.data || []) as Row[];
  const N = dActual.reduce((m, d) =>
    ((Number(d.ingresadas) > 0 || Number(d.movilizadas) > 0) && d.dia > m ? d.dia : m), 0);

  // Movilización EN VIVO del mes anterior al mismo día N (snapshot histórico de operations,
  // NO el snapshot ya maduro). Base correcta para el factor de maduración de la proyección.
  let prevLive: { movLive: number; fechaLive: string; totalLive: number } | null = null;
  if (mesPrev && N > 0 && MESNUM[mesPrev]) {
    const r = await sb.rpc("get_ops_mov_live", {
      p_country: country, p_mes: mesPrev, p_mesnum: MESNUM[mesPrev], p_dia: N,
    });
    const row = r.data && (r.data as any[])[0];
    if (!r.error && row) {
      prevLive = {
        movLive: Number(row.movilizadas) || 0,
        fechaLive: String(row.fecha_carga_usada || ""),
        totalLive: Number(row.total_snapshot) || 0,
      };
    }
  }

  return NextResponse.json({
    mes, mesPrev, N,
    clasif: (clasifRes.data && clasifRes.data[0]) || null,
    dailyActual: dActualRes.data || [],
    dailyPrev: (dPrevRes as { data?: unknown[] }).data || [],
    prevLive,
  });
}
