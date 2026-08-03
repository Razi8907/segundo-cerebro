import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

const COLS =
  "id, country, ds_key, ds_nombre, ds_email, ds_celular, comercial_asignado, estado, nota, fecha_gestion, proxima_fecha_contacto, updated_by_name, updated_at";

const ESTADOS = ["contactado", "volver_a_contactar", "en_seguimiento", "sin_gestionar"];

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try { return await verifyToken(token); } catch { return null; }
}

// GET /api/data/dropshipper-gestion?country=py → todas las gestiones del país.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const country = req.nextUrl.searchParams.get("country") || "py";
  const { data, error } = await getSupabase()
    .from("dropshipper_gestion")
    .select(COLS)
    .eq("country", country)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// PUT /api/data/dropshipper-gestion → upsert de la gestión de un DS (por country+ds_key).
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "admin" && !user.access_comercial) {
    return NextResponse.json({ error: "Sin permisos para gestionar dropshippers" }, { status: 403 });
  }

  try {
    const b = await req.json();
    if (!b.country || !b.ds_key) {
      return NextResponse.json({ error: "country y ds_key requeridos" }, { status: 400 });
    }
    const estado = ESTADOS.includes(b.estado) ? b.estado : "sin_gestionar";
    const row = {
      country: b.country,
      ds_key: String(b.ds_key),
      ds_nombre: b.ds_nombre || "",
      ds_email: b.ds_email || null,
      ds_celular: b.ds_celular || null,
      comercial_asignado: b.comercial_asignado || null,
      estado,
      nota: b.nota ?? "",
      fecha_gestion: b.fecha_gestion || null,
      proxima_fecha_contacto: b.proxima_fecha_contacto || null,
      updated_by: user.id,
      updated_by_name: user.name || "",
    };
    const { data, error } = await getSupabase()
      .from("dropshipper_gestion")
      .upsert(row, { onConflict: "country,ds_key" })
      .select(COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    console.error("[dropshipper-gestion PUT]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
