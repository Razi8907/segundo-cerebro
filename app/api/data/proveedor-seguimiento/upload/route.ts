import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NULL") return "";
  return s;
}

// dd/mm/aaaa o dd-mm-aaaa o serial Excel o Date → "YYYY-MM-DD"
function parseDMY(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NULL") return null;
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); }
  return null;
}

// fecha (dd-mm-aaaa) + hora (hh:mm) → ISO timestamp
function parseDateTime(fecha: unknown, hora: unknown): string | null {
  const dstr = parseDMY(fecha);
  if (!dstr) return null;
  let hh = 0, mi = 0, ss = 0;
  const hs = String(hora ?? "").trim();
  const hm = hs.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (hm) { hh = +hm[1]; mi = +hm[2]; ss = hm[3] ? +hm[3] : 0; }
  const d = new Date(`${dstr}T00:00:00Z`);
  d.setUTCHours(hh, mi, ss, 0);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function findHeader(headerRow: unknown[]) {
  const lower = headerRow.map((c) => String(c ?? "").trim().toLowerCase());
  const find = (...needles: string[]) => {
    for (const n of needles) {
      const i = lower.findIndex((c) => c === n || c.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    id: find("id de la orden", "id orden", "id"),
    provNombre: find("proveedor nombre", "nombre proveedor", "proveedor"),
    provId: find("proveedor id", "id proveedor", "id de proveedor"),
    bodega: find("bodega nombre", "nombre bodega", "bodega"),
    bodegaId: find("id de bodega", "bodega id", "id bodega"),
    estatus: find("estatus", "estado"),
    fPendiente: find("fecha en pendiente", "fecha pendiente"),
    fGuia: find("fecha generacion de guia", "fecha generación de guía", "fecha generacion guia", "generacion de guia", "fecha guia"),
    fUltMovFecha: find("fecha de ultimo movimiento", "fecha de último movimiento", "fecha ultimo movimiento", "fecha último movimiento"),
    fUltMovHora: find("hora de ultimo movimiento", "hora de último movimiento", "hora ultimo movimiento", "hora último movimiento"),
    fProcesamiento: find("fecha en procesamiendo", "fecha en procesamiento", "fecha procesamiento", "procesamiendo", "procesamiento", "procesando"),
  };
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  let user;
  try { user = await verifyToken(token); } catch { return NextResponse.json({ error: "Token inválido" }, { status: 401 }); }
  if (user.role !== "admin" && !user.access_comercial) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let country = (req.nextUrl.searchParams.get("country") || "py").toLowerCase();
  let fileBuffer: ArrayBuffer | null = null;
  try {
    const storagePath = req.nextUrl.searchParams.get("path");
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (storagePath) {
      const sb = getSupabase();
      const dl = await sb.storage.from("uploads").download(storagePath);
      if (dl.error || !dl.data) return NextResponse.json({ error: "No se pudo leer de Storage: " + (dl.error?.message || "missing") }, { status: 400 });
      fileBuffer = await dl.data.arrayBuffer();
      sb.storage.from("uploads").remove([storagePath]).catch(() => {});
    } else if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      country = String(form.get("country") || country).toLowerCase();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
      fileBuffer = await file.arrayBuffer();
    } else {
      fileBuffer = await req.arrayBuffer();
    }
  } catch (e) {
    return NextResponse.json({ error: "Error leyendo body: " + (e as Error).message }, { status: 400 });
  }
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });
  if (!fileBuffer || fileBuffer.byteLength === 0) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });

  // Parsear xlsx
  let rows: Record<string, unknown>[] = [];
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(fileBuffer, { type: "array", cellDates: true });
    let usedSheet: string | null = null;
    let idx = findHeader([]);
    let dataRows: unknown[][] = [];
    for (const sn of wb.SheetNames) {
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1 });
      for (const hi of [0, 1, 2]) {
        if (!sheetRows[hi]) continue;
        const cand = findHeader(sheetRows[hi] as unknown[]);
        if (cand.id >= 0 && cand.fPendiente >= 0) { idx = cand; dataRows = sheetRows.slice(hi + 1); usedSheet = sn; break; }
      }
      if (usedSheet) break;
    }
    if (!usedSheet) return NextResponse.json({ error: "No encontré columnas 'ID' y 'FECHA EN PENDIENTE' en el archivo" }, { status: 400 });

    for (const r of dataRows) {
      if (!r) continue;
      const ordenId = cleanCell(r[idx.id]);
      if (!ordenId) continue;
      const fPend = parseDMY(idx.fPendiente >= 0 ? r[idx.fPendiente] : null);
      if (!fPend) continue; // sin fecha pendiente → no entra al panel
      const fProc = idx.fProcesamiento >= 0 ? parseDMY(r[idx.fProcesamiento]) : null;
      if (fProc) continue;  // ya recolectada por transportadora → sale del panel
      rows.push({
        orden_id: ordenId,
        proveedor_nombre: idx.provNombre >= 0 ? cleanCell(r[idx.provNombre]) : "",
        proveedor_id: idx.provId >= 0 ? cleanCell(r[idx.provId]) || null : null,
        bodega: idx.bodega >= 0 ? cleanCell(r[idx.bodega]) || null : null,
        bodega_id: idx.bodegaId >= 0 ? cleanCell(r[idx.bodegaId]) || null : null,
        estatus: idx.estatus >= 0 ? cleanCell(r[idx.estatus]) : "",
        fecha_pendiente: fPend,
        fecha_guia: idx.fGuia >= 0 ? parseDMY(r[idx.fGuia]) : null,
        fecha_ultimo_mov: idx.fUltMovFecha >= 0 ? parseDateTime(r[idx.fUltMovFecha], idx.fUltMovHora >= 0 ? r[idx.fUltMovHora] : null) : null,
      });
    }
  } catch (e) {
    console.error("[proveedor-seg/upload] parse error", e);
    return NextResponse.json({ error: "Error parseando xlsx: " + (e as Error).message }, { status: 400 });
  }

  const supabase = getSupabase();
  const fechaCarga = new Date().toISOString().slice(0, 10);

  // Reemplazar snapshot del país
  const del = await supabase.from("proveedor_ordenes_seguimiento").delete().eq("country", country);
  if (del.error) return NextResponse.json({ error: "Error limpiando snapshot: " + del.error.message }, { status: 500 });

  if (rows.length > 0) {
    const toInsert = rows.map((r) => ({ country, fecha_carga: fechaCarga, ...r }));
    // insertar en lotes de 1000
    for (let i = 0; i < toInsert.length; i += 1000) {
      const chunk = toInsert.slice(i, i + 1000);
      const ins = await supabase.from("proveedor_ordenes_seguimiento").insert(chunk);
      if (ins.error) return NextResponse.json({ error: "Error insertando: " + ins.error.message }, { status: 500 });
    }
  }

  await supabase.from("proveedor_seguimiento_meta").upsert(
    { country, fecha_carga: fechaCarga, total_activas: rows.length, updated_by_name: user.name || "", updated_at: new Date().toISOString() },
    { onConflict: "country" },
  );

  return NextResponse.json({ success: true, total_activas: rows.length, fecha_carga: fechaCarga });
}
