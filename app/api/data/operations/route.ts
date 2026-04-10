import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/operations?country=py
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";

  // Paginate to get all rows (Supabase default limit is 1000)
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await getSupabase()
      .from("operations_data")
      .select("*")
      .eq("country", country)
      .order("fecha_carga", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return NextResponse.json({ rows: allRows, count: allRows.length });
}

// POST /api/data/operations — upload daily data (accumulative)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    await verifyToken(token);

    const { country, rows, fecha_carga } = await req.json();

    if (!country || !rows || !fecha_carga) {
      return NextResponse.json({ error: "country, rows, fecha_carga required" }, { status: 400 });
    }

    // Upsert rows — if same guia+fecha_carga exists, update it
    const toInsert = rows.map((r: any) => ({
      country,
      guia: String(r.guia || ""),
      fecha_reporte: r.fecha_reporte || "",
      fecha_orden: r.fecha_orden || "",
      dropshipper: r.dropshipper || "",
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
    }));

    // Insert in batches of 500
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      const { error } = await getSupabase()
        .from("operations_data")
        .upsert(batch, { onConflict: "country,guia,fecha_carga" });
      if (error) {
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
