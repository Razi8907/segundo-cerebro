// app/api/data/upload-xlsx/route.ts
//
// Endpoint para que una tarea programada (Cowork) suba el .xlsx de Dropi
// sin pasar por el file picker del browser.
//
// Replica 1:1 lo que hace el handleUpload del componente OperationalUpload
// pero en el servidor: parsea, agrega y hace upsert en operational_snapshots.
//
// Auth: header `Authorization: Bearer $DATA_UPLOAD_SECRET` (misma env que
// usa /api/data/upload para Power BI).
//
// Uso:
//   curl -X POST https://segundo-cerebro-sigma.vercel.app/api/data/upload-xlsx \
//     -H "Authorization: Bearer $DATA_UPLOAD_SECRET" \
//     -F "country=py" \
//     -F "file=@paraguay_abril.xlsx"
//
// Matcher del middleware: tiene que agregar `api/data/upload-xlsx` a la
// lista de paths exentos (ver middleware.ts).

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import {
  parseXlsxBuffer,
  aggregateRows,
  buildCompactRows,
} from "../../../lib/operational-parse";

const UPLOAD_SECRET = process.env.DATA_UPLOAD_SECRET || "";
const ALLOWED_COUNTRIES = new Set(["py", "ar"]);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — Paraguay suele rondar 11 MB

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1) Auth
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!UPLOAD_SECRET || token !== UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Form
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart inválido" }, { status: 400 });
  }
  const country = String(form.get("country") ?? "").toLowerCase().trim();
  const file = form.get("file");

  if (!ALLOWED_COUNTRIES.has(country)) {
    return NextResponse.json(
      { error: "country debe ser 'py' o 'ar'" },
      { status: 400 }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file requerido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `archivo > ${MAX_BYTES} bytes` },
      { status: 413 }
    );
  }
  const name = file.name ?? "";
  if (!/\.(xlsx|xls|csv)$/i.test(name)) {
    return NextResponse.json({ error: "tipo no permitido" }, { status: 400 });
  }

  // 3) Parse + aggregate
  const buf = await file.arrayBuffer();
  let agg;
  let rows;
  try {
    rows = parseXlsxBuffer(buf);
    agg = aggregateRows(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "parseo falló", detail: msg }, { status: 422 });
  }

  // 4) Guardar con mismo shape que OperationalUpload.tsx.
  //    Intentamos primero con compact_rows; si el payload supera el límite de
  //    Vercel (4 MB), lo guardamos sin rows (mismo fallback que el front).
  const baseData = { ...agg } as Record<string, unknown>;
  const compactRows = buildCompactRows(rows);

  let payloadBody: Record<string, unknown> = {
    country,
    data: { ...baseData, compact_rows: compactRows },
    raw_count: agg.total_orders,
  };
  const payloadSize = JSON.stringify(payloadBody).length;
  if (payloadSize > 4_000_000) {
    payloadBody = {
      country,
      data: baseData,
      raw_count: agg.total_orders,
    };
  }

  const nowIso = new Date().toISOString();
  const { error } = await getSupabase()
    .from("operational_snapshots")
    .upsert(
      {
        country,
        data: payloadBody.data,
        raw_count: agg.total_orders,
        uploaded_at: nowIso,
      },
      { onConflict: "country" }
    );

  if (error) {
    return NextResponse.json(
      { error: "db upsert falló", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    country,
    filename: name,
    size: file.size,
    raw_count: agg.total_orders,
    date_range: agg.date_range,
    compact_rows_included: payloadSize <= 4_000_000,
    uploaded_at: nowIso,
  });
}
