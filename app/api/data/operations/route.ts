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
// Devuelve las filas de la carga a usar del mes: la última, salvo que esté cortada
// (menos del 70% de las ingresadas del Seguimiento Diario) → la anterior completa
// (ops_mes_fecha_carga). Las filas se leen por páginas con get_ops_page, que fuerza el
// índice (country, mes, fecha_carga): en días con muchas cargas, el índice de fecha_carga
// sola recorría cientos de miles de filas de otros meses y la consulta se cortaba (julio).
// El historial de cargas viene de ops_upload_history_fast (sin contar todo el mes).
const COLS = [
  "guia", "fecha_reporte", "dropshipper", "dropshipper_id", "dropshipper_email", "dropshipper_celular", "tienda", "proveedor",
  "transportadora", "estatus", "fecha_procesamiento", "fecha_ultimo_movimiento", "hora_ultimo_movimiento", "ciudad_destino",
  "departamento_destino", "cliente", "telefono", "novedad", "concepto_ultimo_mov", "comercial", "valor_orden",
  "ganancia_si_entregado", "producto",
] as const;

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || "py";
  const mes = req.nextUrl.searchParams.get("mes") || "abril";
  const supabase = getSupabase();

  // ?al=YYYY-MM-DD → usa la carga de ese momento (la última con fecha_carga <= al), para
  // comparar el mes anterior tal como estaba en el mismo punto del mes (no ya cerrado).
  const al = req.nextUrl.searchParams.get("al") || "";
  let latestFechaCarga = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(al)) {
    const r = await supabase.from("operations_data").select("fecha_carga")
      .eq("country", country).eq("mes", mes).lte("fecha_carga", al)
      .order("fecha_carga", { ascending: false }).limit(1);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    latestFechaCarga = (r.data?.[0]?.fecha_carga as string) || "";
  }
  if (!latestFechaCarga) {
    let fcRes = await supabase.rpc("ops_mes_fecha_carga", { p_country: country, p_mes: mes });
    if (fcRes.error) fcRes = await supabase.rpc("ops_mes_fecha_carga", { p_country: country, p_mes: mes }); // reintento si la base estaba ocupada
    if (fcRes.error) return NextResponse.json({ error: fcRes.error.message }, { status: 500 });
    latestFechaCarga = (fcRes.data as string | null) || "";
  }
  if (!latestFechaCarga) {
    return NextResponse.json({ rows: [], uploadHistory: [], latestFechaCarga: "" });
  }

  // Historial primero: trae el total de filas de la última carga, así las páginas se piden
  // en paralelo (de a 4) en vez de una por una — octubre PY son ~60 páginas y en serie
  // se pasaba del minuto que permite Vercel.
  let uploadHistory: { fecha_carga: string; cnt: number }[] = [];
  let rpc = await supabase.rpc("ops_upload_history_fast", { p_country: country, p_mes: mes });
  if (rpc.error) rpc = await supabase.rpc("ops_upload_history_fast", { p_country: country, p_mes: mes });
  if (!rpc.error && Array.isArray(rpc.data)) {
    uploadHistory = rpc.data.map((r: any) => ({ fecha_carga: r.fecha_carga, cnt: Number(r.cnt) || 0 }));
  }

  // ── Datos de la carga ──
  // Se arman UNA vez por carga y se guardan listos en Storage (ops-cache/<pais>/<mes>/<fecha>_<filas>.json);
  // las siguientes aperturas bajan ese archivo directo desde Supabase, sin consultar la base
  // ni pasar los datos por Vercel (octubre PY = 60k guías: armarlo en cada apertura pasaba del minuto).
  const total = uploadHistory.find((h) => h.fecha_carga === latestFechaCarga)?.cnt || 0;
  const cachePath = `ops-cache/${country}/${mes}/${latestFechaCarga}${total ? `_${total}` : ""}.json`;
  const bucket = supabase.storage.from("uploads");
  const firmada = await bucket.createSignedUrl(cachePath, 600);
  if (!firmada.error && firmada.data?.signedUrl) {
    return NextResponse.json({ url: firmada.data.signedUrl, uploadHistory, latestFechaCarga });
  }

  const PAGE_SIZE = 5000;
  const CONCURRENCY = 3;
  const getPage = async (from: number): Promise<unknown[][]> => {
    for (let intento = 1; ; intento++) {
      const { data, error } = await supabase.rpc("get_ops_compact", {
        p_country: country, p_mes: mes, p_fecha_carga: latestFechaCarga, p_offset: from, p_limit: PAGE_SIZE,
      });
      if (!error) return Array.isArray(data) ? (data as unknown[][]) : [];
      if (intento >= 3) throw new Error(`bloque ${from / PAGE_SIZE + 1}: ${error.message}`);
    }
  };
  const data: unknown[][] = [];
  try {
    if (total > 0) {
      const offsets = Array.from({ length: Math.ceil(total / PAGE_SIZE) + 1 }, (_, i) => i * PAGE_SIZE);
      const paginas: unknown[][][] = new Array(offsets.length);
      let next = 0;
      await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (next < offsets.length) { const i = next++; paginas[i] = await getPage(offsets[i]); }
      }));
      for (const p of paginas) data.push(...p);
    } else {
      for (let from = 0; ; from += PAGE_SIZE) {
        const page = await getPage(from);
        data.push(...page);
        if (page.length < PAGE_SIZE || from > 300000) break;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error leyendo la carga" }, { status: 500 });
  }
  if (!uploadHistory.length) uploadHistory = [{ fecha_carga: latestFechaCarga, cnt: data.length }];

  const payload = { cols: COLS, data, latestFechaCarga, count: data.length };
  const cuerpo = JSON.stringify(payload);
  // Guardar el armado para las próximas aperturas y devolver el link (no los datos) si es grande
  const subida = await bucket.upload(cachePath, new Blob([cuerpo], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (!subida.error && cuerpo.length > 3_000_000) {
    const f2 = await bucket.createSignedUrl(cachePath, 600);
    if (!f2.error && f2.data?.signedUrl) return NextResponse.json({ url: f2.data.signedUrl, uploadHistory, latestFechaCarga });
  }
  return NextResponse.json({ ...payload, uploadHistory });
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

    // La carga cambió: borrar los armados guardados de esa fecha para que se rearmen
    const carpeta = `ops-cache/${country}/${mes}`;
    const ls = await supabase.storage.from("uploads").list(carpeta, { search: String(fecha_carga) });
    const viejos = (ls.data ?? []).filter((f) => f.name.startsWith(String(fecha_carga))).map((f) => `${carpeta}/${f.name}`);
    if (viejos.length) await supabase.storage.from("uploads").remove(viejos);

    return NextResponse.json({ success: true, inserted });
  } catch (err) {
    console.error("Operations upload error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
