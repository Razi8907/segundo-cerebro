import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME, type TokenPayload } from "../../../lib/auth";
import { FINANZAS_AR_DEFAULT } from "../../../lib/finanzas-ar-types";

async function getUser(req: NextRequest): Promise<TokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

function canEdit(user: TokenPayload | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.access_finanzas) return true;
  return false;
}

// GET — devuelve la data financiera. Si la fila no existe, devuelve los defaults.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await getSupabase()
    .from("ar_finanzas_data")
    .select("data, updated_at, updated_by")
    .eq("id", "singleton")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      data: FINANZAS_AR_DEFAULT,
      updated_at: null,
      updated_by: null,
      isDefault: true,
      canEdit: canEdit(user),
    });
  }

  return NextResponse.json({
    data: data.data,
    updated_at: data.updated_at,
    updated_by: data.updated_by,
    isDefault: false,
    canEdit: canEdit(user),
  });
}

// PUT — actualiza la data. Solo admin o usuarios con access_finanzas.
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!canEdit(user)) {
    return NextResponse.json({ error: "Sin permiso para editar finanzas" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body vacío o inválido" }, { status: 400 });
  }

  // Validación mínima de la forma — confiamos en el cliente para el resto
  // (los campos faltantes se completan con default al leer)
  const required = ["meses", "caja", "deuda", "salarioRazielAr", "gastosBreakdownYtd", "liquidaciones"];
  for (const k of required) {
    if (!(k in body)) {
      return NextResponse.json({ error: `Falta campo: ${k}` }, { status: 400 });
    }
  }

  const { error } = await getSupabase()
    .from("ar_finanzas_data")
    .upsert(
      {
        id: "singleton",
        data: body,
        updated_by: user!.id,
      },
      { onConflict: "id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
