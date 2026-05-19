"use server";

import { getSupabase } from "../lib/supabase";

type ResumenInput = {
  country: "ar" | "py";
  mes: string;
  ingresadas: number;
  movilizadas: number;
  entregadas: number;
  devueltas: number;
  en_proceso: number;
};

export async function persistResumenOperacional(input: ResumenInput): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: row, error: readErr } = await supabase
      .from("dashboard_snapshots")
      .select("data")
      .eq("country", input.country)
      .single();
    if (readErr) {
      console.warn("[persistResumenOperacional] read failed", readErr);
      return;
    }
    const prevData = (row?.data as Record<string, unknown>) ?? {};
    const prevResumen = (prevData.resumen as Record<string, unknown> | undefined) ?? {};
    const newData = {
      ...prevData,
      resumen: {
        ...prevResumen,
        [input.mes]: {
          ingresadas: input.ingresadas,
          movilizadas: input.movilizadas,
          entregadas: input.entregadas,
          devueltas: input.devueltas,
          en_proceso: input.en_proceso,
        },
      },
    };
    const { error: writeErr } = await supabase
      .from("dashboard_snapshots")
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq("country", input.country);
    if (writeErr) {
      console.warn("[persistResumenOperacional] write failed", writeErr);
    }
  } catch (e) {
    console.warn("[persistResumenOperacional] unexpected error", e);
  }
}
