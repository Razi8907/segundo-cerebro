import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "sc-auth-token";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production");
}

function getCurrentHourPY(): number {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Asuncion" })
  ).getHours();
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Check admin access for /admin routes
    if (req.nextUrl.pathname.startsWith("/admin")) {
      if (payload.role !== "admin") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // Check time-based access
    const start = (payload.access_start_hour as number) ?? 0;
    const end = (payload.access_end_hour as number) ?? 24;

    if (start !== 0 || end !== 24) {
      const currentHour = getCurrentHourPY();
      let allowed = false;
      if (start <= end) {
        allowed = currentHour >= start && currentHour < end;
      } else {
        allowed = currentHour >= start || currentHour < end;
      }
      if (!allowed) {
        // Delete the cookie and redirect with error
        const response = NextResponse.redirect(
          new URL("/login?error=horario", req.url)
        );
        response.cookies.set(COOKIE_NAME, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
        return response;
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid token - clear cookie and redirect
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth/* (login, logout, me)
     * - /_next (Next.js internals)
     * - /favicon.ico
     * - Static files (images, etc.)
     */
    "/((?!login|api/auth|_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
