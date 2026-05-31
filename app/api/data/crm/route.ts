import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

const SELECT_COLS = "id, country, entity_type, entity_name, entity_dropi_id, canal, resumen, oportunidades, compromisos, observaciones, fecha_proximo, state, state_context, es_alerta, score, nivel_volumen, comercial_asignado, created_by, created_by_name, created_at, updated_at";

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try { return await verifyToken(token); } catch { return null; }
}

// GET /api/data/crm?country=ar&entity_type=&state=&comercial=&search=
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const country = req.nextUrl.searchParams.get("country");
  const entity_type = req.nextUrl.searchParams.get("entity_type");
  const state = req.nextUrl.searchParams.get("state");
  const comercial = req.nextUrl.searchParams.get("comercial");
  const search = req.nextUrl.searchParams.get("search");

  let q = getSupabase().from("crm_interacciones").select(SELECT_COLS);
  if (country) q = q.eq("country", country);
  if (entity_type) q = q.eq("entity_type", entity_type);
  if (state) q = q.eq("state", state);
  if (comercial) q = q.eq("comercial_asignado", comercial);
  if (search) q = q.ilike("entity_name", `%${search}%`);
  q = q.order("created_at", { ascending: false }).limit(500);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

// POST /api/data/crm — crear interacción nueva
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.country || !body.entity_type || !body.entity_name || !body.canal) {
      return NextResponse.json({ error: "country, entity_type, entity_name y canal son requeridos" }, { status: 400 });
    }
    const row: Record<string, unknown> = {
      country: body.country,
      entity_type: body.entity_type,
      entity_name: body.entity_name,
      entity_dropi_id: body.entity_dropi_id || null,
      canal: body.canal,
      resumen: body.resumen || "",
      oportunidades: body.oportunidades || "",
      compromisos: body.compromisos || "",
      observaciones: body.observaciones || "",
      fecha_proximo: body.fecha_proximo || null,
      state: body.state || "Pendiente",
      state_context: body.state_context || "",
      es_alerta: !!body.es_alerta,
      score: body.score ?? null,
      nivel_volumen: body.nivel_volumen || null,
      comercial_asignado: body.comercial_asignado || user.name,
      created_by: user.id,
      created_by_name: user.name,
    };
    const { data, error } = await getSupabase()
      .from("crm_interacciones")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data }, { status: 201 });
  } catch (e) {
    console.error("[crm POST]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/data/crm — editar interacción (admin = todo; viewer = solo lo suyo)
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    // Si no es admin, validar ownership
    if (user.role !== "admin") {
      const owner = await getSupabase().from("crm_interacciones").select("created_by").eq("id", id).single();
      if (owner.error || owner.data?.created_by !== user.id) {
        return NextResponse.json({ error: "No autorizado a editar esta interacción" }, { status: 403 });
      }
    }
    // Whitelist de campos editables
    const allowed = ["entity_type","entity_name","entity_dropi_id","canal","resumen","oportunidades","compromisos","observaciones","fecha_proximo","state","state_context","es_alerta","score","nivel_volumen","comercial_asignado"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (k in fields) update[k] = fields[k];

    const { data, error } = await getSupabase()
      .from("crm_interacciones")
      .update(update)
      .eq("id", id)
      .select(SELECT_COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  } catch (e) {
    console.error("[crm PUT]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/data/crm
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    if (user.role !== "admin") {
      const owner = await getSupabase().from("crm_interacciones").select("created_by").eq("id", id).single();
      if (owner.error || owner.data?.created_by !== user.id) {
        return NextResponse.json({ error: "No autorizado a eliminar esta interacción" }, { status: 403 });
      }
    }
    const { error } = await getSupabase().from("crm_interacciones").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[crm DELETE]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
