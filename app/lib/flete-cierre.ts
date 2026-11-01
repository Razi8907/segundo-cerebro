import type { SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════
// Flete por orden para el sector Cierre 2026.
// El débito de una devolución = su flete. Operaciones no trae el flete, pero el archivo
// comercial (operational-rows/<pais>/<mes>.json en Storage) sí: una fila por orden con
// usuario (di), transportadora (t), ciudad (ci) y flete (fl). No trae número de guía, así
// que el flete de cada guía se estima con el promedio del grano más fino disponible:
// usuario+transportadora+ciudad → usuario+transportadora → transportadora+ciudad →
// transportadora → país. Se cachea en memoria hasta que cambie el archivo en Storage.
// ═══════════════════════════════════════════════════════════════════

const Q4 = ["octubre", "noviembre", "diciembre"];
type Acc = Map<string, [number, number]>; // clave → [suma, n]
export type NivelFlete = "usuario_ciudad" | "usuario" | "ciudad" | "transportadora" | "pais";
export interface Fletes {
  meses: string[];
  ordenes: number;
  estimar: (ds: string, transp: string, ciudad?: string) => { flete: number; nivel: NivelFlete } | null;
}

const cache = new Map<string, { firma: string; fletes: Fletes }>();
const up = (s: unknown) => String(s ?? "").trim().toUpperCase();

export async function cargarFletes(sb: SupabaseClient, country: string): Promise<Fletes | null> {
  const ls = await sb.storage.from("uploads").list(`operational-rows/${country}`);
  const archivos = (ls.data ?? []).filter((f) => Q4.includes(f.name.replace(/\.json$/, "")));
  if (!archivos.length) return null;
  const firma = archivos.map((f) => `${f.name}@${f.updated_at}`).sort().join(",");
  const hit = cache.get(country);
  if (hit && hit.firma === firma) return hit.fletes;

  const acc: Acc = new Map();
  const sumar = (k: string, fl: number) => { const a = acc.get(k); if (a) { a[0] += fl; a[1]++; } else acc.set(k, [fl, 1]); };
  let ordenes = 0;
  const meses: string[] = [];
  for (const f of archivos) {
    const r = await sb.storage.from("uploads").download(`operational-rows/${country}/${f.name}`);
    if (r.error || !r.data) continue;
    let filas: { di?: string; t?: string; ci?: string; fl?: number }[] = [];
    try { filas = JSON.parse(await r.data.text()); } catch { continue; }
    if (!Array.isArray(filas)) continue;
    meses.push(f.name.replace(/\.json$/, ""));
    for (const x of filas) {
      const fl = Number(x.fl);
      if (!(fl > 0)) continue;
      const ds = String(x.di ?? ""), t = up(x.t), ci = up(x.ci);
      ordenes++;
      sumar(`u|${ds}|${t}|${ci}`, fl); sumar(`u|${ds}|${t}`, fl); sumar(`c|${t}|${ci}`, fl); sumar(`t|${t}`, fl); sumar("p", fl);
    }
  }
  const prom = (k: string) => { const a = acc.get(k); return a ? a[0] / a[1] : null; };
  const fletes: Fletes = {
    meses: Q4.filter((m) => meses.includes(m)),
    ordenes,
    estimar: (ds, transp, ciudad) => {
      const t = up(transp), ci = up(ciudad);
      const pasos: [string | null, NivelFlete][] = [
        [ci ? `u|${ds}|${t}|${ci}` : null, "usuario_ciudad"], [`u|${ds}|${t}`, "usuario"], [ci ? `c|${t}|${ci}` : null, "ciudad"], [`t|${t}`, "transportadora"], ["p", "pais"],
      ];
      for (const [k, nivel] of pasos) { if (!k) continue; const v = prom(k); if (v !== null) return { flete: v, nivel }; }
      return null;
    },
  };
  cache.set(country, { firma, fletes });
  return fletes;
}
