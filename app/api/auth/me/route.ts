import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";
import { getSupabase } from "../../../lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);

    // Leemos los permisos frescos desde la DB para que cualquier cambio que
    // haga un admin en /admin se refleje en el próximo refresh del usuario.
    // Si la lectura falla, caemos al payload del token (no rompemos la sesión).
    const { data: dbUser } = await getSupabase()
      .from("users")
      .select("id, email, name, role, can_download, active, access_comercial, access_operaciones, access_finanzas")
      .eq("id", payload.id)
      .single();

    if (dbUser && dbUser.active === false) {
      return NextResponse.json({ error: "Usuario inactivo" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: dbUser?.id ?? payload.id,
        email: dbUser?.email ?? payload.email,
        name: dbUser?.name ?? payload.name,
        role: dbUser?.role ?? payload.role,
        can_download: dbUser?.can_download ?? payload.can_download ?? false,
        access_comercial: dbUser?.access_comercial ?? payload.access_comercial ?? true,
        access_operaciones: dbUser?.access_operaciones ?? payload.access_operaciones ?? true,
        access_finanzas: dbUser?.access_finanzas ?? payload.access_finanzas ?? true,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Token inválido o expirado" },
      { status: 401 }
    );
  }
}
