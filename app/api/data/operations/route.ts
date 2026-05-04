import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

const isColumnMissing = (err: any) => {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("mes");
};

// GET /api/data/operations?country=py&mes=abril
// Resiliente: si la columna `mes` no existe (migración pendiente),
// para abril cae al SELECT sin filtro (data legacy es implícitamente abril).
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";
  const mes = req.nextUrl.searchParams.get("mes") || "abril";

  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;
  let columnMissing = false;

  while (hasMore) {
    let q = getSupabase()
      .from("operations_data")
      .select("*")
      .eq("country", country);
    if (!columnMissing) q = q.eq("mes", mes);
    const { data, error } = await q
      .order("fecha_carga", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      // Si la columna mes no existe, retry sin filtro de mes (solo si pidió abril)
      if (isColumnMissing(error) && mes === "abril" && !columnMissing) {
        columnMissing = true;
        continue; // mismo `from`, ahora sin .eq("mes", ...)
      }
      if (isColumnMissing(error) && mes !== "abril") {
        // Pre-migración no hay forma de tener data de mayo
        return NextResponse.json({ rows: [], count: 0 });
      }
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

    const supabase = getSupabase();
    let inserted = 0;
    let columnMissing = false;

    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500).map((r: any) => {
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
          // Pre-migración: retry sin mes y con onConflict legacy
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
