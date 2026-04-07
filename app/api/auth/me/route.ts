import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

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

    return NextResponse.json({
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        can_download: payload.can_download,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Token inválido o expirado" },
      { status: 401 }
    );
  }
}
