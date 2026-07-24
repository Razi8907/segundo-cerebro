import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";
import {
  buildUsuariosSegmentados,
  mesFromDate,
  type RegisteredUser,
  type OperationalSnapshot,
  type LegacyDropshipper,
} from "../../../../lib/usuarios-cohort-builder";

export const runtime = "nodejs";
export const maxDuration = 300;

const Q2 = ["abril", "mayo", "junio"];
const Q3 = ["julio", "agosto", "septiembre"];
// Meses con data operacional (Q2 en adelante) que se leen de operational_snapshots.
const OPS_MESES = [...Q2, ...Q3];
// Meses mensuales válidos para reconstruir la base previa de usuarios.
const MESES_VALIDOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre"];

interface Cell { v?: unknown }

function findHeaderIndices(headerRow: unknown[]): {
  email: number; nombre: number; telefono: number; comunidad: number; fecha: number;
} {
  const lower = headerRow.map((c) => String(c ?? "").trim().toLowerCase());
  const find = (...needles: string[]) => {
    for (const n of needles) {
      const i = lower.findIndex((c) => c === n || c.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    email: find("email", "correo"),
    nombre: find("nombre_usuario", "nombre"),
    telefono: find("telefono", "teléfono", "celular"),
    // En el nuevo export Dropi la columna se llama "referido_por" en lugar de "comunidad"
    comunidad: find("referido_por", "referidor", "comunidad"),
    // Acepta "fecha de creación" (export viejo) y "fecha_creacion" (export nuevo)
    fecha: find("fecha_creacion", "fecha de creación", "fecha de creacion", "fecha"),
  };
}

// Limpia strings tipo "NULL" que vienen en algunos exports de Dropi.
function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NULL") return "";
  return s;
}

function excelDateToJs(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date: days since 1899-12-30
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + v * 24 * 60 * 60 * 1000);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // ISO o formato reconocido nativamente
    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) return d1;
    // DD/MM/YYYY o DD-MM-YYYY (formato común AR/PY)
    let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
      const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss));
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY-MM-DD HH:MM:SS
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const [, yyyy, mm, dd, hh = "0", mi = "0", ss = "0"] = m;
      const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss));
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  let user;
  try { user = await verifyToken(token); } catch { return NextResponse.json({ error: "Token inválido" }, { status: 401 }); }
  if (user.role !== "admin" && !user.access_comercial) {
    return NextResponse.json({ error: "Sin permisos para subir usuarios" }, { status: 403 });
  }

  let country = "py";
  let fileBuffer: ArrayBuffer | null = null;
  try {
    // Soporta TRES modos:
    //   A) ?path=storage/path → baja archivo de Supabase Storage (uploads bucket).
    //      Es el modo recomendado para archivos >4MB (evita límite de Vercel).
    //   B) multipart/form-data (legacy)
    //   C) body crudo binario (legacy)
    const storagePath = req.nextUrl.searchParams.get("path");
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    country = req.nextUrl.searchParams.get("country") || country;

    if (storagePath) {
      // Modo A: bajar de Storage
      const sb = getSupabase();
      const dl = await sb.storage.from("uploads").download(storagePath);
      if (dl.error || !dl.data) {
        return NextResponse.json({ error: "No se pudo leer el archivo de Storage: " + (dl.error?.message || "missing") }, { status: 400 });
      }
      fileBuffer = await dl.data.arrayBuffer();
      // limpiar el path después de procesar (best-effort, no bloqueante)
      sb.storage.from("uploads").remove([storagePath]).catch(() => {});
    } else if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      country = String(form.get("country") || country);
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido (form-data)" }, { status: 400 });
      fileBuffer = await file.arrayBuffer();
    } else {
      fileBuffer = await req.arrayBuffer();
      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return NextResponse.json({ error: "Body vacío" }, { status: 400 });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: "Error leyendo body: " + (e as Error).message }, { status: 400 });
  }
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });

  // Parsear xlsx
  let registered: RegisteredUser[] = [];
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(fileBuffer, { type: "array", cellDates: true });
    // Buscar primera sheet con headers reconocibles
    let usedSheet: string | null = null;
    let rows: unknown[][] = [];
    let idx = { email: -1, nombre: -1, telefono: -1, comunidad: -1, fecha: -1 };
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd hh:mm:ss" });
      // headers pueden estar en row 0 o row 1 si hay título
      for (const headerIdx of [0, 1, 2]) {
        if (!sheetRows[headerIdx]) continue;
        const cand = findHeaderIndices(sheetRows[headerIdx] as unknown[]);
        if (cand.email >= 0 && cand.fecha >= 0) {
          idx = cand;
          rows = sheetRows.slice(headerIdx + 1);
          usedSheet = sn;
          break;
        }
      }
      if (usedSheet) break;
    }
    if (!usedSheet) {
      return NextResponse.json({ error: "No encontré columnas 'email' y 'fecha de creación' en ninguna sheet" }, { status: 400 });
    }

    // Re-parsear con cellDates true para fechas reales
    const wb2 = XLSX.read(fileBuffer, { type: "array", cellDates: true });
    const ws2 = wb2.Sheets[usedSheet];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws2, { header: 1 });
    // detectar offset de header en wb2 igual que arriba
    let headerOffset = 0;
    for (const hi of [0, 1, 2]) {
      if (!rawRows[hi]) continue;
      const c = findHeaderIndices(rawRows[hi] as unknown[]);
      if (c.email >= 0 && c.fecha >= 0) { headerOffset = hi; break; }
    }
    const dataRows = rawRows.slice(headerOffset + 1);

    const byEmail = new Map<string, RegisteredUser>();
    for (const r of dataRows) {
      if (!r || !r[idx.email]) continue;
      const email = cleanCell(r[idx.email]).toLowerCase();
      if (!email || !email.includes("@")) continue;
      const fechaRaw = r[idx.fecha];
      const fc = excelDateToJs(fechaRaw);
      if (!fc) continue;
      const mes = mesFromDate(fc);
      if (!mes) continue;
      const iso = fc.toISOString();
      const existing = byEmail.get(email);
      if (existing && existing.fecha_registro < iso) continue;
      const comunidadRaw = idx.comunidad >= 0 ? cleanCell(r[idx.comunidad]) : "";
      byEmail.set(email, {
        email,
        nombre: cleanCell(r[idx.nombre]),
        telefono: cleanCell(r[idx.telefono]),
        comunidad: comunidadRaw || null,
        reg_mes: mes,
        fecha_registro: iso,
      });
    }
    registered = Array.from(byEmail.values());
  } catch (e) {
    console.error("[usuarios/upload] parse error", e);
    return NextResponse.json({ error: "Error parseando xlsx: " + (e as Error).message }, { status: 400 });
  }

  if (registered.length === 0) {
    return NextResponse.json({ error: "El xlsx no tiene registros 2026 válidos" }, { status: 400 });
  }

  // Cargar data operacional + dashboard snapshot
  const supabase = getSupabase();
  const [snapRes, opsRes] = await Promise.all([
    supabase.from("dashboard_snapshots").select("data").eq("country", country).maybeSingle(),
    supabase.from("operational_snapshots").select("mes, data").eq("country", country).in("mes", OPS_MESES),
  ]);
  if (snapRes.error) return NextResponse.json({ error: "Supabase read failed: " + snapRes.error.message }, { status: 500 });
  if (opsRes.error) return NextResponse.json({ error: "operational read failed: " + opsRes.error.message }, { status: 500 });

  const snap = (snapRes.data?.data as Record<string, unknown>) || {};
  const legacyDS = (snap.dropshippers as LegacyDropshipper[]) || [];
  const q2Snaps: OperationalSnapshot[] = (opsRes.data || []).map((r) => ({ mes: r.mes as string, ...(r.data as Omit<OperationalSnapshot, "mes">) }));

  // MERGE con base previa. El xlsx puede ser incremental (solo registros nuevos
  // de un mes). Extraemos la base anterior de usuarios_segmentados.cohorts y
  // mergeamos por email: el archivo nuevo gana en caso de conflicto.
  const previousUS = snap.usuarios_segmentados as { cohorts?: Record<string, {
    segmento_1_pareto75?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
    segmento_3_1_a_19?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
    segmento_intentaron?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
    segmento_4_cero?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
    segmento_2_bins?: Record<string, { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] }>;
  }> } | undefined;
  const previousReg = new Map<string, RegisteredUser>();
  if (previousUS?.cohorts) {
    for (const [mes, c] of Object.entries(previousUS.cohorts)) {
      // Solo nos importan los cohorts mensuales (no q1/q2/q3 que son acumulados)
      if (!MESES_VALIDOS.includes(mes)) continue;
      const pools: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[][] = [];
      for (const k of ["segmento_1_pareto75","segmento_3_1_a_19","segmento_intentaron","segmento_4_cero"] as const) {
        const seg = c?.[k];
        if (seg?.usuarios) pools.push(seg.usuarios);
      }
      for (const bin of Object.values(c?.segmento_2_bins || {})) {
        if (bin.usuarios) pools.push(bin.usuarios);
      }
      for (const pool of pools) {
        for (const u of pool) {
          const em = (u.email || "").trim().toLowerCase();
          if (!em || !em.includes("@")) continue;
          if (previousReg.has(em)) continue;
          previousReg.set(em, {
            email: em,
            nombre: u.nombre || "",
            telefono: u.telefono || "",
            comunidad: u.comunidad ?? null,
            reg_mes: mes,
            fecha_registro: "", // desconocido, se mantiene reg_mes
          });
        }
      }
    }
  }

  // Aplicar merge: nuevos del xlsx tienen prioridad
  const newEmails = new Set(registered.map((r) => r.email));
  const merged: RegisteredUser[] = [...registered];
  for (const [em, prev] of previousReg.entries()) {
    if (!newEmails.has(em)) merged.push(prev);
  }
  const fromPrev = merged.length - registered.length;
  console.log(`[usuarios/upload] xlsx=${registered.length} + previos=${fromPrev} → total merged=${merged.length}`);
  registered = merged;

  // Build
  let usuarios_segmentados;
  try {
    usuarios_segmentados = buildUsuariosSegmentados(registered, legacyDS, q2Snaps);
  } catch (e) {
    console.error("[usuarios/upload] build error", e);
    return NextResponse.json({ error: "Error armando cohorts: " + (e as Error).message }, { status: 500 });
  }

  // Persist
  snap.usuarios_segmentados = usuarios_segmentados;
  const { error: writeErr } = await supabase
    .from("dashboard_snapshots")
    .update({ data: snap, updated_at: new Date().toISOString() })
    .eq("country", country);
  if (writeErr) return NextResponse.json({ error: "Supabase write failed: " + writeErr.message }, { status: 500 });

  // Summary para mostrar en el UI
  const summary: Record<string, { reg: number; act: number; intent: number; mov: number }> = {};
  for (const [mes, c] of Object.entries(usuarios_segmentados.cohorts)) {
    summary[mes] = { reg: c.total_registrados, act: c.activos_total, intent: c.intentaron_total, mov: c.total_movilizadas };
  }
  return NextResponse.json({
    success: true,
    parsed_users: registered.length,
    summary,
  });
}
