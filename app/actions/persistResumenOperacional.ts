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
  console.log("[server persistResumen] received", { country: input.country, mes: input.mes });
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("resumen_operacional")
      .upsert(
        {
          country: input.country,
          mes: input.mes,
          ingresadas: input.ingresadas,
          movilizadas: input.movilizadas,
          entregadas: input.entregadas,
          devueltas: input.devueltas,
          en_proceso: input.en_proceso,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "country,mes" }
      );

    if (error) {
      console.warn("[persistResumenOperacional] upsert failed", error);
    }
  } catch (e) {
    console.warn("[persistResumenOperacional] unexpected error", e);
  }
}
