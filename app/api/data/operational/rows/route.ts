import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";

export const runtime = "nodejs";

// Las filas crudas (compact_rows) del Análisis Operacional pesan más de lo que
// Vercel acepta en un body (~4.5MB), así que se guardan como JSON en Storage
// (bucket "uploads") y el cliente las sube/baja directo con URLs firmadas.
const MESES = ["abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function parseParams(country: unknown, mes: unknown) {
  const c = String(country || "").toLowerCase();
  const m = String(mes || "").toLowerCase();
  if (!["ar", "py"].includes(c) || !MESES.includes(m)) return null;
  return { path: `operational-rows/${c}/${m}.json` };
}

async function auth(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try { await verifyToken(token); return true; } catch { return false; }
}

// GET /api/data/operational/rows?country=ar&mes=agosto → { url } (null si no hay filas)
export async function GET(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const p = parseParams(req.nextUrl.searchParams.get("country"), req.nextUrl.searchParams.get("mes"));
  if (!p) return NextResponse.json({ error: "country/mes inválido" }, { status: 400 });

  const { data, error } = await getSupabase().storage.from("uploads").createSignedUrl(p.path, 600);
  if (error || !data) return NextResponse.json({ url: null });
  return NextResponse.json({ url: data.signedUrl });
}

// POST /api/data/operational/rows { country, mes } → { signedUrl } para subir el JSON (sobrescribe)
export async function POST(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let body: { country?: string; mes?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const p = parseParams(body.country, body.mes);
  if (!p) return NextResponse.json({ error: "country/mes inválido" }, { status: 400 });

  const { data, error } = await getSupabase().storage.from("uploads").createSignedUploadUrl(p.path, { upsert: true });
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo generar URL: " + (error?.message || "desconocido") }, { status: 500 });
  }
  return NextResponse.json({ signedUrl: data.signedUrl });
}
