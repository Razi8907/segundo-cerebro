import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

// GET /api/data/comerciales — nombres de usuarios activos con acceso comercial (o admin).
// Alimenta el desplegable de "comercial asignado" en la gestión de dropshippers.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try { await verifyToken(token); } catch { return NextResponse.json({ error: "Token inválido" }, { status: 401 }); }

  const { data, error } = await getSupabase()
    .from("users")
    .select("name, role, active, access_comercial");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const comerciales = Array.from(
    new Set(
      (data || [])
        .filter((u) => u.active && (u.access_comercial || u.role === "admin"))
        .map((u) => (u.name || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ comerciales });
}
