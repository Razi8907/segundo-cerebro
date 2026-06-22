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
    comunidad: find("comunidad"),
    fecha: find("fecha de creación", "fecha de creacion", "fecha"),
  };
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
    // Soporta dos modos:
    //   A) multipart/form-data (cliente original con FormData)
    //   B) body crudo (binario) con country en query param ?country=...
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      country = String(form.get("country") || country);
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido (form-data)" }, { status: 400 });
      fileBuffer = await file.arrayBuffer();
    } else {
      country = req.nextUrl.searchParams.get("country") || country;
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
      const email = String(r[idx.email]).trim().toLowerCase();
      if (!email || !email.includes("@")) continue;
      const fechaRaw = r[idx.fecha];
      const fc = excelDateToJs(fechaRaw);
      if (!fc) continue;
      const mes = mesFromDate(fc);
      if (!mes) continue;
      const iso = fc.toISOString();
      const existing = byEmail.get(email);
      if (existing && existing.fecha_registro < iso) continue;
      byEmail.set(email, {
        email,
        nombre: String(r[idx.nombre] ?? "").trim(),
        telefono: String(r[idx.telefono] ?? "").trim(),
        comunidad: idx.comunidad >= 0 && r[idx.comunidad] ? String(r[idx.comunidad]).trim() : null,
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
    supabase.from("operational_snapshots").select("mes, data").eq("country", country).in("mes", Q2),
  ]);
  if (snapRes.error) return NextResponse.json({ error: "Supabase read failed: " + snapRes.error.message }, { status: 500 });
  if (opsRes.error) return NextResponse.json({ error: "operational read failed: " + opsRes.error.message }, { status: 500 });

  const snap = (snapRes.data?.data as Record<string, unknown>) || {};
  const legacyDS = (snap.dropshippers as LegacyDropshipper[]) || [];
  const q2Snaps: OperationalSnapshot[] = (opsRes.data || []).map((r) => ({ mes: r.mes as string, ...(r.data as Omit<OperationalSnapshot, "mes">) }));

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
