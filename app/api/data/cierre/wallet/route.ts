import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";

export const runtime = "nodejs";

// GET /api/data/cierre/wallet?country=py&ds_id=75300
// Extracto de wallet del usuario: último informe cargado (con todos sus movimientos)
// + historial de saldos de los informes anteriores.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  const dsId = (req.nextUrl.searchParams.get("ds_id") || "").trim();
  if (!["ar", "py"].includes(country) || !dsId) return NextResponse.json({ error: "country y ds_id requeridos" }, { status: 400 });

  const sb = getSupabase();
  const hist = await sb.from("wallet_saldos")
    .select("carga_id, saldo_disponible, informe_fecha:raw->>informe_fecha, cargado_el:raw->>cargado_el")
    .eq("country", country).eq("ds_id", dsId).order("carga_id", { ascending: false }).limit(50);
  if (hist.error) return NextResponse.json({ error: hist.error.message }, { status: 500 });
  const filas = (hist.data ?? []) as { carga_id: number; saldo_disponible: number | null; informe_fecha: string | null; cargado_el: string | null }[];
  if (!filas.length) return NextResponse.json({ ultimo: null, historial: [] }, { headers: { "Cache-Control": "no-store" } });

  const ult = await sb.from("wallet_saldos").select("carga_id, saldo_disponible, raw").eq("country", country).eq("carga_id", filas[0].carga_id).eq("ds_id", dsId).limit(1).single();
  if (ult.error) return NextResponse.json({ error: ult.error.message }, { status: 500 });
  const raw = (ult.data.raw ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    ultimo: {
      carga_id: ult.data.carga_id, saldo: ult.data.saldo_disponible,
      archivo: raw.archivo ?? "", cargado_el: raw.cargado_el ?? null, cargado_por: raw.cargado_por ?? "",
      informe_fecha: raw.informe_fecha ?? null, desde: raw.desde ?? null,
      ingresos: Number(raw.ingresos ?? 0), egresos: Number(raw.egresos ?? 0),
      movimientos: Array.isArray(raw.movimientos) ? raw.movimientos : [],
    },
    historial: filas.map((f) => ({ carga_id: f.carga_id, saldo: f.saldo_disponible, informe_fecha: f.informe_fecha, cargado_el: f.cargado_el })),
  }, { headers: { "Cache-Control": "no-store" } });
}
