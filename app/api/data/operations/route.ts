import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const isColumnMissing = (err: any) => {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("mes");
};

// GET /api/data/operations?country=py&mes=abril
// Devuelve SOLO las filas de la última fecha_carga (la única que se renderiza
// tras el dedup por guía). Históricamente la tabla tiene cientos de miles
// de filas acumuladas día a día → bajarlas todas tumba el endpoint.
// El historial agregado (count por fecha_carga) se trae con un RPC.
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";
  const mes = req.nextUrl.searchParams.get("mes") || "abril";

  const supabase = getSupabase();
  let columnMissing = false;

  // 1) Buscar la última fecha_carga
  let latestQ = supabase
    .from("operations_data")
    .select("fecha_carga")
    .eq("country", country)
    .order("fecha_carga", { ascending: false })
    .limit(1);
  if (!columnMissing) latestQ = latestQ.eq("mes", mes);

  const latestRes = await latestQ;
  if (latestRes.error) {
    if (isColumnMissing(latestRes.error) && mes === "abril") {
      columnMissing = true;
    } else if (isColumnMissing(latestRes.error)) {
      // Pre-migración no hay forma de tener data de mayo
      return NextResponse.json({ rows: [], uploadHistory: [], latestFechaCarga: "" });
    } else {
      return NextResponse.json({ error: latestRes.error.message }, { status: 500 });
    }
  }

  let latestFechaCarga = "";
  if (columnMissing) {
    const r = await supabase
      .from("operations_data")
      .select("fecha_carga")
      .eq("country", country)
      .order("fecha_carga", { ascending: false })
      .limit(1);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    latestFechaCarga = r.data?.[0]?.fecha_carga || "";
  } else {
    latestFechaCarga = latestRes.data?.[0]?.fecha_carga || "";
  }

  if (!latestFechaCarga) {
    return NextResponse.json({ rows: [], uploadHistory: [], latestFechaCarga: "" });
  }

  // 2) Traer todas las filas SOLO de esa fecha_carga (paginado)
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let q = supabase
      .from("operations_data")
      .select("*")
      .eq("country", country)
      .eq("fecha_carga", latestFechaCarga);
    if (!columnMissing) q = q.eq("mes", mes);
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data && data.length > 0) {
      allRows.push(...data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  // 3) Historial agregado vía RPC (si existe). Si no, devolvemos solo último día.
  let uploadHistory: { fecha_carga: string; cnt: number }[] = [];
  const rpc = await supabase.rpc("ops_upload_history", { p_country: country, p_mes: mes });
  if (!rpc.error && Array.isArray(rpc.data)) {
    uploadHistory = rpc.data.map((r: any) => ({
      fecha_carga: r.fecha_carga,
      cnt: Number(r.cnt) || 0,
    }));
  } else {
    uploadHistory = [{ fecha_carga: latestFechaCarga, cnt: allRows.length }];
  }

  return NextResponse.json({
    rows: allRows,
    uploadHistory,
    latestFechaCarga,
    count: allRows.length,
  });
}

// POST /api/data/operations — upload daily data (accumulative)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const body = await req.json();
    const { country, rows, fecha_carga } = body;
    const mes = body.mes || "abril";

    if (!country || !rows || !fecha_carga) {
      return NextResponse.json({ error: "country, rows, fecha_carga required" }, { status: 400 });
    }

    const baseRow = (r: any) => ({
      country,
      guia: String(r.guia || ""),
      fecha_reporte: r.fecha_reporte || "",
      fecha_orden: r.fecha_orden || "",
      dropshipper: r.dropshipper || "",
      dropshipper_id: r.dropshipper_id || "",
      dropshipper_email: r.dropshipper_email || "",
      dropshipper_celular: r.dropshipper_celular || "",
      tienda: r.tienda || "",
      proveedor: r.proveedor || "",
      proveedor_id: r.proveedor_id || 0,
      transportadora: r.transportadora || "",
      estatus: r.estatus || "",
      fecha_procesamiento: r.fecha_procesamiento || "",
      fecha_ultimo_movimiento: r.fecha_ultimo_movimiento || "",
      hora_ultimo_movimiento: r.hora_ultimo_movimiento || "",
      ciudad_destino: r.ciudad_destino || "",
      departamento_destino: r.departamento_destino || "",
      cliente: r.cliente || "",
      telefono: r.telefono || "",
      novedad: r.novedad || "",
      concepto_ultimo_mov: r.concepto_ultimo_mov || "",
      comercial: r.comercial || "",
      valor_orden: r.valor_orden || 0,
      ganancia_si_entregado: r.ganancia_si_entregado || 0,
      producto: r.producto || "",
      fecha_carga,
      dias_sin_cambio: r.dias_sin_cambio || 0,
      primera_vez_parada: r.primera_vez_parada || "",
    });

    // Deduplicar por guía (clave del upsert: country+mes+guia+fecha_carga, con
    // country/mes/fecha_carga constantes en este request). Si el Excel trae la
    // misma guía repetida, la última gana. Evita el error de Postgres
    // "ON CONFLICT DO UPDATE command cannot affect row a second time".
    const dedupMap = new Map<string, any>();
    for (const r of rows) dedupMap.set(String(r?.guia || ""), r);
    const dedupedRows = Array.from(dedupMap.values());

    const supabase = getSupabase();
    let inserted = 0;
    let columnMissing = false;

    for (let i = 0; i < dedupedRows.length; i += 1000) {
      const batch = dedupedRows.slice(i, i + 1000).map((r: any) => {
        const b: any = baseRow(r);
        if (!columnMissing) b.mes = mes;
        return b;
      });
      const onConflict = columnMissing ? "country,guia,fecha_carga" : "country,mes,guia,fecha_carga";
      const { error } = await supabase
        .from("operations_data")
        .upsert(batch, { onConflict });

      if (error) {
        if (isColumnMissing(error)) {
          if (mes !== "abril") {
            return NextResponse.json(
              { error: "Migración pendiente: agregá la columna 'mes' a operations_data antes de cargar mayo." },
              { status: 503 },
            );
          }
          columnMissing = true;
          const legacyBatch = batch.map((r: any) => {
            const { mes: _omit, ...rest } = r;
            return rest;
          });
          const r2 = await supabase
            .from("operations_data")
            .upsert(legacyBatch, { onConflict: "country,guia,fecha_carga" });
          if (r2.error) {
            console.error("Legacy batch insert error:", r2.error);
            return NextResponse.json({ error: r2.error.message }, { status: 500 });
          }
          inserted += batch.length;
          continue;
        }
        console.error("Batch insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      inserted += batch.length;
    }

    return NextResponse.json({ success: true, inserted });
  } catch (err) {
    console.error("Operations upload error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
