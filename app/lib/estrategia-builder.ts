// Pure logic to build estrategia_usuarios from current Supabase data.
// Mirrors /tmp/build_estrategia_v2.py.

const NO_MOV = new Set([
  "PENDIENTE","ANULADO","CANCELADO","RECHAZADO","NULO","GUIA_GENERADA","PENDIENTE CONFIRMACION",
]);

const Q2 = ["abril","mayo","junio"] as const;

export const SEGMENTS_BY_COUNTRY: Record<"py" | "ar", SegmentConfig[]> = {
  py: [
    { key: "iniciados", label: "Iniciados", min: 1, max: 300, color: "#3b82f6", next: 300, near_floor: 250 },
    { key: "master", label: "Master", min: 300, max: 900, color: "#10b981", next: 900, near_floor: 800 },
    { key: "experto", label: "Experto", min: 900, max: 2000, color: "#a855f7", next: 2000, near_floor: 1800 },
    { key: "sabio_vip", label: "Sabio VIP", min: 2000, max: null, color: "#f59e0b", next: null, near_floor: null },
  ],
  ar: [
    { key: "esporadicos", label: "Dropshipper Esporádicos", min: 1, max: 11, color: "#3b82f6", next: 11, near_floor: 8 },
    { key: "en_desarrollo", label: "Dropshipper en Desarrollo", min: 11, max: 66, color: "#10b981", next: 66, near_floor: 55 },
    { key: "master_ar", label: "Master", min: 66, max: 300, color: "#a855f7", next: 300, near_floor: 270 },
    { key: "sabio_vip_ar", label: "Sabio VIP", min: 300, max: null, color: "#f59e0b", next: null, near_floor: null },
  ],
};

export interface SegmentConfig {
  key: string; label: string;
  min: number; max: number | null;
  color: string;
  next: number | null;
  near_floor: number | null;
}

interface MesData { ing: number; mov: number; }

interface UsuarioBase {
  email: string; nombre: string; telefono: string; comunidad: string | null;
  por_mes: Record<string, MesData>;
}

interface OperationalSnapshotData {
  by_dropshipper?: { nombre: string; total: number; estados?: Record<string, number> }[];
  by_ds_daily?: { ds?: string; dsEmail?: string; dsCelular?: string }[];
}

interface DashboardSnapshotData {
  dropshippers?: { email: string; ene?: { ing?: number; mov?: number }; feb?: { ing?: number; mov?: number }; mar?: { ing?: number; mov?: number } }[];
  usuarios_segmentados?: {
    cohorts?: Record<string, {
      segmento_1_pareto75?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
      segmento_3_1_a_19?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
      segmento_intentaron?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
      segmento_4_cero?: { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] };
      segmento_2_bins?: Record<string, { usuarios?: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[] }>;
    }>;
  };
}

export interface EstrategiaUsuariosOut {
  updated_at: string;
  window_note: string;
  segments_config: SegmentConfig[];
  meses_disponibles: string[];
  usuarios: UsuarioBase[];
}

const MES_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// Devuelve el mes actual en español (basado en la fecha del servidor).
// 2026-06-22 → "junio"
export function getMesCorriente(now: Date = new Date()): string {
  return MES_NAMES[now.getMonth()];
}

/**
 * Reconstruye estrategia_usuarios mergeando con la versión existente:
 * - Para meses cerrados (≠ currentMes): mantiene la data previa intacta.
 * - Para mes corriente: recalcula desde operational_snapshots[currentMes].
 * - Si no hay estrategia previa (primer build), hace rebuild completo de todos los meses.
 *
 * Esto protege los datos de meses anteriores aunque por error se suba data nueva
 * a operational_snapshots de meses cerrados.
 */
export function buildEstrategia(
  country: "ar" | "py",
  dashboardData: DashboardSnapshotData,
  q2Snapshots: { mes: string; data: OperationalSnapshotData }[],
  options?: { currentMes?: string; existing?: EstrategiaUsuariosOut | null },
): EstrategiaUsuariosOut {
  const currentMes = options?.currentMes ?? getMesCorriente();
  const existing = options?.existing ?? null;
  const onlyCurrentMonth = !!existing; // si hay estrategia previa, solo tocamos el mes corriente
  const ds = new Map<string, { nombre: string; telefono: string; comunidad: string | null; por_mes: Record<string, MesData> }>();
  const ensure = (em: string) => {
    let cur = ds.get(em);
    if (!cur) {
      cur = { nombre: "", telefono: "", comunidad: null, por_mes: {} };
      ds.set(em, cur);
    }
    return cur;
  };

  // Si hay estrategia previa: pre-cargar TODOS los meses EXCEPTO el corriente.
  // Para meses cerrados, mantenemos exactamente la data que ya estaba.
  if (existing) {
    for (const u of existing.usuarios || []) {
      const em = (u.email || "").trim().toLowerCase();
      if (!em) continue;
      const cur = ensure(em);
      cur.nombre = u.nombre || cur.nombre;
      cur.telefono = u.telefono || cur.telefono;
      cur.comunidad = u.comunidad ?? cur.comunidad;
      for (const [m, data] of Object.entries(u.por_mes || {})) {
        if (m === currentMes) continue; // el corriente lo recalculamos
        cur.por_mes[m] = data;
      }
    }
  }

  // Q1 from dashboard_snapshots.dropshippers — solo si NO estamos en modo "solo mes corriente"
  if (!onlyCurrentMonth) {
    for (const d of dashboardData.dropshippers || []) {
      const em = (d.email || "").trim().toLowerCase();
      if (!em) continue;
      const u = ensure(em);
      if (d.ene) u.por_mes.enero = { ing: d.ene.ing ?? 0, mov: d.ene.mov ?? 0 };
      if (d.feb) u.por_mes.febrero = { ing: d.feb.ing ?? 0, mov: d.feb.mov ?? 0 };
      if (d.mar) u.por_mes.marzo = { ing: d.mar.ing ?? 0, mov: d.mar.mov ?? 0 };
    }
  }

  // Q2 from operational_snapshots — si onlyCurrentMonth, filtramos solo el mes corriente
  for (const snap of q2Snapshots) {
    if (!Q2.includes(snap.mes as typeof Q2[number])) continue;
    if (onlyCurrentMonth && snap.mes !== currentMes) continue;
    const nameToEmail = new Map<string, string>();
    const nameToPhone = new Map<string, string>();
    for (const r of snap.data.by_ds_daily || []) {
      const nm = r.ds || "";
      const em = (r.dsEmail || "").trim().toLowerCase();
      const ph = r.dsCelular || "";
      if (nm && em) nameToEmail.set(nm, em);
      if (nm && ph && !nameToPhone.has(nm)) nameToPhone.set(nm, ph);
    }
    for (const d of snap.data.by_dropshipper || []) {
      const nm = d.nombre || "";
      const em = nameToEmail.get(nm);
      if (!em) continue;
      const total = d.total || 0;
      const estados = d.estados || {};
      let noMovSum = 0;
      for (const k of Object.keys(estados)) if (NO_MOV.has(k)) noMovSum += estados[k];
      const mov = Math.max(0, total - noMovSum);
      const u = ensure(em);
      u.por_mes[snap.mes] = { ing: total, mov };
      if (!u.nombre) {
        const bare = nm.split("(")[0].trim();
        u.nombre = bare;
      }
      if (!u.telefono && nameToPhone.has(nm)) u.telefono = nameToPhone.get(nm) || "";
    }
  }

  // Cross-ref usuarios_segmentados for nombre/comunidad/telefono
  const us = dashboardData.usuarios_segmentados;
  if (us?.cohorts) {
    for (const c of Object.values(us.cohorts)) {
      const pools: { email: string; nombre?: string; telefono?: string; comunidad?: string | null }[][] = [];
      for (const k of ["segmento_1_pareto75", "segmento_3_1_a_19", "segmento_intentaron", "segmento_4_cero"] as const) {
        const seg = c?.[k];
        if (seg?.usuarios) pools.push(seg.usuarios);
      }
      for (const bin of Object.values(c?.segmento_2_bins || {})) {
        if (bin.usuarios) pools.push(bin.usuarios);
      }
      for (const pool of pools) {
        for (const u of pool) {
          const em = (u.email || "").trim().toLowerCase();
          if (!ds.has(em)) continue;
          const cur = ds.get(em)!;
          if (u.nombre) cur.nombre = u.nombre;
          if (u.telefono) cur.telefono = u.telefono;
          if (u.comunidad) cur.comunidad = u.comunidad;
        }
      }
    }
  }

  // Output: DSs con al menos 1 mov en cualquier mes
  const usuarios: UsuarioBase[] = [];
  for (const [email, info] of ds.entries()) {
    let totalMov = 0;
    for (const m of Object.values(info.por_mes)) totalMov += m.mov;
    if (totalMov < 1) continue;
    usuarios.push({
      email,
      nombre: info.nombre || email.split("@")[0],
      telefono: info.telefono,
      comunidad: info.comunidad,
      por_mes: info.por_mes,
    });
  }

  return {
    updated_at: new Date().toISOString(),
    window_note: onlyCurrentMonth
      ? `Solo el mes corriente (${currentMes}) se recalcula. Meses cerrados quedan congelados.`
      : "mov/ing por mes — segmentos se calculan en cliente según el filtro del header.",
    segments_config: SEGMENTS_BY_COUNTRY[country],
    meses_disponibles: ["enero","febrero","marzo","abril","mayo","junio"],
    usuarios,
  };
}
