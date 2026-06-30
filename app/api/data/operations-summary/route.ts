import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cancelaciones (idéntico a STATUS_GROUPS.cancelacion en OperationsDashboard).
const CANCELACION_PY = new Set([
  "CANCELADO", "RECHAZADO", "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA",
]);
const CANCELACION_AR = new Set([
  "CANCELADO", "RECHAZADO", "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA",
]);

// GET /api/data/operations-summary?country=ar|py&mes=abril
// Devuelve { mes, ingresadas (daily), movilizadas, entregadas, devueltas, en_proceso, canceladas, total_rows }
// Replica EXACTAMENTE la regla de Operaciones para movilizadas:
//   movilizada = fecha_procesamiento != null AND estatus NOT IN cancelacion
// Lee de operations_data (último fecha_carga) — la misma fuente que el dashboard.
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  const mes = (req.nextUrl.searchParams.get("mes") || "abril").toLowerCase();
  if (!["ar", "py"].includes(country)) {
    return NextResponse.json({ error: "country inválido" }, { status: 400 });
  }

  const supabase = getSupabase();
  const cancelacion = country === "ar" ? CANCELACION_AR : CANCELACION_PY;

  // 1) Última fecha_carga del mes
  const latest = await supabase
    .from("operations_data")
    .select("fecha_carga")
    .eq("country", country)
    .eq("mes", mes)
    .order("fecha_carga", { ascending: false })
    .limit(1);
  if (latest.error) return NextResponse.json({ error: latest.error.message }, { status: 500 });
  const fechaCarga = latest.data?.[0]?.fecha_carga as string | undefined;
  if (!fechaCarga) {
    return NextResponse.json({
      mes, ingresadas: 0, movilizadas: 0, entregadas: 0, devueltas: 0, en_proceso: 0, canceladas: 0, total_rows: 0,
    });
  }

  // 2) Paginar todas las rows del último fecha_carga
  const PAGE = 1000;
  let from = 0;
  let movilizadas = 0;
  let entregadas = 0;
  let devueltas = 0;
  let enProceso = 0;
  let canceladas = 0;
  let totalRows = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await supabase
      .from("operations_data")
      .select("estatus, fecha_procesamiento")
      .eq("country", country)
      .eq("mes", mes)
      .eq("fecha_carga", fechaCarga)
      .range(from, from + PAGE - 1);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    const data = r.data || [];
    if (data.length === 0) break;
    for (const row of data) {
      const s = String(row.estatus || "").trim();
      const procRaw = row.fecha_procesamiento;
      const hasProc = procRaw && String(procRaw).trim().length > 0 && String(procRaw).trim() !== "null";
      const isCanc = cancelacion.has(s);
      totalRows++;
      if (isCanc) canceladas++;
      if (hasProc && !isCanc) movilizadas++;
      if (s === "ENTREGADO") entregadas++;
      else if (s === "DEVOLUCION" || s === "EN PROCESO DE DEVOLUCION" || s === "DEVOLUCION EN PROCESO") devueltas++;
      else if (hasProc && !isCanc) enProceso++; // otra cosa con proc, no entregada ni devuelta
    }
    from += PAGE;
    hasMore = data.length === PAGE;
    if (from > 200000) break;
  }

  // 3) Ingresadas vienen de daily_tracking (Seguimiento Diario)
  const daily = await supabase
    .from("daily_tracking")
    .select("ordenes")
    .eq("country", country)
    .eq("mes", mes);
  const ingresadas = (daily.data || []).reduce((s, r) => s + (r.ordenes || 0), 0);

  return NextResponse.json({
    mes, fecha_carga: fechaCarga,
    ingresadas, movilizadas, entregadas, devueltas, en_proceso: enProceso, canceladas, total_rows: totalRows,
  });
}
