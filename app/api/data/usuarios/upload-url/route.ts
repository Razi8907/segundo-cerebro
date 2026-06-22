import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";

export const runtime = "nodejs";

// POST /api/data/usuarios/upload-url
// Body: { country: "ar"|"py", filename: string }
// Devuelve: { path, signedUrl, token }
// El cliente luego hace PUT a signedUrl con el archivo. Storage bypasses
// el límite de 4.5MB del runtime de Vercel.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  let user;
  try { user = await verifyToken(token); } catch { return NextResponse.json({ error: "Token inválido" }, { status: 401 }); }
  if (user.role !== "admin" && !user.access_comercial) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let body: { country?: string; filename?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const country = (body.country || "py").toLowerCase();
  const filename = (body.filename || "upload.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!["ar", "py"].includes(country)) return NextResponse.json({ error: "country inválido" }, { status: 400 });

  const supabase = getSupabase();
  const ts = Date.now();
  const path = `usuarios/${country}/${ts}-${filename}`;

  const { data, error } = await supabase.storage.from("uploads").createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo generar URL: " + (error?.message || "desconocido") }, { status: 500 });
  }
  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl, token: data.token });
}
