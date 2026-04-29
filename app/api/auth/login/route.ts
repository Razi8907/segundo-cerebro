import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "../../../lib/supabase";
import { signToken, COOKIE_NAME } from "../../../lib/auth";

function getCurrentHourPY(): number {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Asuncion" })
  ).getHours();
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Query user from supabase
    const { data: user, error } = await getSupabase()
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.active) {
      return NextResponse.json(
        { error: "Tu cuenta está desactivada. Contacta al administrador." },
        { status: 403 }
      );
    }

    // Check time-based access
    const currentHour = getCurrentHourPY();
    const start = user.access_start_hour ?? 0;
    const end = user.access_end_hour ?? 24;

    if (start !== 0 || end !== 24) {
      let allowed = false;
      if (start <= end) {
        allowed = currentHour >= start && currentHour < end;
      } else {
        // Wraps midnight, e.g., 22 to 6
        allowed = currentHour >= start || currentHour < end;
      }
      if (!allowed) {
        return NextResponse.json(
          {
            error: `Acceso permitido solo entre las ${start}:00 y ${end}:00 (hora Paraguay). Hora actual: ${currentHour}:00`,
          },
          { status: 403 }
        );
      }
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Create JWT
    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      can_download: user.can_download,
      access_start_hour: user.access_start_hour,
      access_end_hour: user.access_end_hour,
      access_comercial: user.access_comercial ?? true,
      access_operaciones: user.access_operaciones ?? true,
      access_finanzas: user.access_finanzas ?? true,
    });

    // Set cookie and return user info
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        can_download: user.can_download,
        active: user.active,
        access_start_hour: user.access_start_hour,
        access_end_hour: user.access_end_hour,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
