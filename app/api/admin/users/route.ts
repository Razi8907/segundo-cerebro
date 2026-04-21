import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

// GET - List all users
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: users, error } = await getSupabase()
    .from("users")
    .select("id, name, email, role, can_download, active, access_start_hour, access_end_hour, access_comercial, access_operaciones, access_finanzas, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users });
}

// POST - Create user
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, password, role, can_download, access_start_hour, access_end_hour, access_comercial, access_operaciones, access_finanzas } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await getSupabase()
      .from("users")
      .insert({
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role || "viewer",
        can_download: can_download ?? false,
        active: true,
        access_start_hour: access_start_hour ?? 0,
        access_end_hour: access_end_hour ?? 24,
        access_comercial: access_comercial ?? true,
        access_operaciones: access_operaciones ?? true,
        access_finanzas: access_finanzas ?? true,
      })
      .select("id, name, email, role, can_download, active, access_start_hour, access_end_hour, access_comercial, access_operaciones, access_finanzas, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 201 });
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT - Update user
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    // If password is being updated, hash it
    if (fields.password) {
      fields.password = await bcrypt.hash(fields.password, 10);
    }

    const { data, error } = await getSupabase()
      .from("users")
      .update(fields)
      .eq("id", id)
      .select("id, name, email, role, can_download, active, access_start_hour, access_end_hour, access_comercial, access_operaciones, access_finanzas, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("Update user error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE - Delete user
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    const { error } = await getSupabase().from("users").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
