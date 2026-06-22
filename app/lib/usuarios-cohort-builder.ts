// Pure logic to build usuarios_segmentados from registered users + operational data.
// Replica del script Python /tmp/build_py_users_v2.py.

const NO_MOV = new Set([
  "PENDIENTE","ANULADO","CANCELADO","RECHAZADO","NULO","GUIA_GENERADA","PENDIENTE CONFIRMACION",
]);

const Q1 = ["enero","febrero","marzo"] as const;
const Q2 = ["abril","mayo","junio"] as const;
const MES_NUM: Record<number, string> = {
  1:"enero",2:"febrero",3:"marzo",4:"abril",5:"mayo",6:"junio",
  7:"julio",8:"agosto",9:"septiembre",10:"octubre",11:"noviembre",12:"diciembre",
};

export interface RegisteredUser {
  email: string;
  nombre: string;
  telefono: string;
  comunidad: string | null;
  reg_mes: string;
  fecha_registro: string;
}

export interface OpsPerMonth { ing: number; mov: number; }

export interface OperationalSnapshot {
  mes: string;
  by_dropshipper?: { nombre: string; total: number; estados?: Record<string, number> }[];
  by_ds_daily?: { ds?: string; dsEmail?: string; dsCelular?: string }[];
}

export interface LegacyDropshipper {
  email: string;
  ene?: { ing?: number; mov?: number };
  feb?: { ing?: number; mov?: number };
  mar?: { ing?: number; mov?: number };
}

interface UserWithOps extends RegisteredUser {
  ops: Record<string, OpsPerMonth>;
  q1_ing: number; q1_mov: number;
  q2_ing: number; q2_mov: number;
  cohort_ing: number; cohort_mov: number;
}

interface UserRecord {
  email: string; nombre: string; telefono: string; comunidad: string | null;
  orders: number; ing: number;
}

interface CommunityUser {
  email: string; nombre: string; telefono: string; ing: number; mov: number;
}

interface CommunityEntry {
  comunidad: string; registrados: number; activos: number;
  pct_activacion: number; ingresadas: number; movilizadas: number;
}

interface CohortOut {
  total_registrados: number;
  total_ordenes: number;
  total_movilizadas: number;
  total_ingresadas: number;
  activos_total: number;
  intentaron_total: number;
  inactivos_total: number;
  windows_note: string;
  segmento_1_pareto75: { count: number; ordenes_acumuladas: number; ingresadas_acumuladas: number; pct_ordenes: number; usuarios: UserRecord[] };
  segmento_2_bins: Record<string, { count: number; ingresadas: number; movilizadas: number; usuarios: UserRecord[] }>;
  segmento_3_1_a_19: { count: number; ingresadas: number; movilizadas: number; usuarios: UserRecord[] };
  segmento_intentaron: { count: number; ingresadas: number; usuarios: UserRecord[] };
  segmento_4_cero: { count: number; usuarios: UserRecord[]; truncated: boolean };
  comunidades: CommunityEntry[];
  comunidades_detalle: Record<string, CommunityUser[]>;
}

export interface UsuariosSegmentados {
  updated_at: string;
  data_window: string;
  cohorts: Record<string, CohortOut>;
  comunidades_globales: { comunidad: string; registrados: number; activos: number; pct_activacion: number }[];
  retention: Record<string, Record<string, Record<string, RetUser[]>>>;
  retention_summary: Record<string, Record<string, Record<string, number>>>;
}

interface RetUser {
  email: string; nombre: string; telefono: string; comunidad: string | null;
  mov_cohort: number; ing_cohort: number; mov_post: number; ing_post: number;
  mov_q2: number; ing_q2: number;
  mov_abril: number; mov_mayo: number; mov_junio: number;
  ing_abril: number; ing_mayo: number; ing_junio: number;
}

export function mesFromDate(date: Date): string | null {
  if (!date || isNaN(date.getTime())) return null;
  if (date.getFullYear() !== 2026) return null;
  return MES_NUM[date.getMonth() + 1] || null;
}

// Build ops_by_month[mes][email] = {ing, mov}
export function buildOpsByMonth(
  legacyDropshippers: LegacyDropshipper[],
  q2Snapshots: OperationalSnapshot[],
): Record<string, Record<string, OpsPerMonth>> {
  const ops: Record<string, Record<string, OpsPerMonth>> = {};
  for (const m of [...Q1, ...Q2]) ops[m] = {};

  // Q1 from legacy dropshippers list
  for (const d of legacyDropshippers) {
    const email = (d.email || "").trim().toLowerCase();
    if (!email) continue;
    if (d.ene) ops.enero[email] = { ing: d.ene.ing ?? 0, mov: d.ene.mov ?? 0 };
    if (d.feb) ops.febrero[email] = { ing: d.feb.ing ?? 0, mov: d.feb.mov ?? 0 };
    if (d.mar) ops.marzo[email] = { ing: d.mar.ing ?? 0, mov: d.mar.mov ?? 0 };
  }

  // Q2 from operational_snapshots
  for (const snap of q2Snapshots) {
    if (!Q2.includes(snap.mes as typeof Q2[number])) continue;
    const nameToEmail = new Map<string, string>();
    for (const r of snap.by_ds_daily || []) {
      const nm = r.ds || "";
      const em = (r.dsEmail || "").trim().toLowerCase();
      if (nm && em) nameToEmail.set(nm, em);
    }
    for (const ds of snap.by_dropshipper || []) {
      const nm = ds.nombre || "";
      const email = nameToEmail.get(nm);
      if (!email) continue;
      const total = ds.total || 0;
      const estados = ds.estados || {};
      let noMovSum = 0;
      for (const k of Object.keys(estados)) if (NO_MOV.has(k)) noMovSum += estados[k];
      const mov = Math.max(0, total - noMovSum);
      const prev = ops[snap.mes][email] || { ing: 0, mov: 0 };
      ops[snap.mes][email] = { ing: prev.ing + total, mov: prev.mov + mov };
    }
  }

  return ops;
}

function enrichUsers(users: RegisteredUser[], opsByMonth: Record<string, Record<string, OpsPerMonth>>): UserWithOps[] {
  return users.map((u) => {
    const ops: Record<string, OpsPerMonth> = {};
    for (const m of [...Q1, ...Q2]) ops[m] = opsByMonth[m]?.[u.email] || { ing: 0, mov: 0 };
    const q1_ing = Q1.reduce((s, m) => s + ops[m].ing, 0);
    const q1_mov = Q1.reduce((s, m) => s + ops[m].mov, 0);
    const q2_ing = Q2.reduce((s, m) => s + ops[m].ing, 0);
    const q2_mov = Q2.reduce((s, m) => s + ops[m].mov, 0);
    const cohort_ing = ops[u.reg_mes]?.ing ?? 0;
    const cohort_mov = ops[u.reg_mes]?.mov ?? 0;
    return { ...u, ops, q1_ing, q1_mov, q2_ing, q2_mov, cohort_ing, cohort_mov };
  });
}

function buildCohort(cu: UserWithOps[], useQTotal?: "q1" | "q2"): CohortOut {
  const getMov = useQTotal === "q1" ? (u: UserWithOps) => u.q1_mov : useQTotal === "q2" ? (u: UserWithOps) => u.q2_mov : (u: UserWithOps) => u.cohort_mov;
  const getIng = useQTotal === "q1" ? (u: UserWithOps) => u.q1_ing : useQTotal === "q2" ? (u: UserWithOps) => u.q2_ing : (u: UserWithOps) => u.cohort_ing;

  const us = [...cu].sort((a, b) => getMov(b) - getMov(a));
  const totalMov = us.reduce((s, u) => s + getMov(u), 0);
  const totalIng = us.reduce((s, u) => s + getIng(u), 0);
  const activos = us.filter((u) => getMov(u) > 0);

  const ur = (u: UserWithOps): UserRecord => ({
    email: u.email, nombre: u.nombre, telefono: u.telefono, comunidad: u.comunidad,
    orders: getMov(u), ing: getIng(u),
  });

  // Pareto 75%
  let cum = 0; const tgt = totalMov * 0.75;
  const paretoUsers: UserRecord[] = [];
  for (const u of activos) {
    if (cum >= tgt) break;
    paretoUsers.push(ur(u)); cum += getMov(u);
  }
  const paretoEmails = new Set(paretoUsers.map((u) => u.email));
  const pareto = {
    count: paretoUsers.length, ordenes_acumuladas: cum,
    ingresadas_acumuladas: activos.filter((u) => paretoEmails.has(u.email)).reduce((s, u) => s + getIng(u), 0),
    pct_ordenes: totalMov > 0 ? Math.round((cum / totalMov) * 1000) / 10 : 0,
    usuarios: paretoUsers,
  };

  // Seg 2 (20+) bins
  const s2u = activos.filter((u) => getMov(u) >= 20 && !paretoEmails.has(u.email));
  const bins: Record<string, UserRecord[]> = {};
  for (const u of s2u) {
    const o = getMov(u); const low = Math.floor(o / 10) * 10;
    const key = `${low}-${low + 9}`;
    (bins[key] = bins[key] || []).push(ur(u));
  }
  const segmento_2_bins: CohortOut["segmento_2_bins"] = {};
  for (const [k, lst] of Object.entries(bins)) {
    lst.sort((a, b) => b.orders - a.orders);
    segmento_2_bins[k] = {
      count: lst.length,
      ingresadas: lst.reduce((s, u) => s + u.ing, 0),
      movilizadas: lst.reduce((s, u) => s + u.orders, 0),
      usuarios: lst,
    };
  }

  // Seg 3 (1-19)
  const s3u = activos.filter((u) => getMov(u) >= 1 && getMov(u) <= 19 && !paretoEmails.has(u.email));
  s3u.sort((a, b) => getMov(b) - getMov(a));
  const segmento_3_1_a_19 = {
    count: s3u.length,
    ingresadas: s3u.reduce((s, u) => s + getIng(u), 0),
    movilizadas: s3u.reduce((s, u) => s + getMov(u), 0),
    usuarios: s3u.map(ur),
  };

  // Seg intentaron (mov=0, ing>0)
  const intentU = us.filter((u) => getMov(u) === 0 && getIng(u) > 0).sort((a, b) => getIng(b) - getIng(a));
  const segmento_intentaron = {
    count: intentU.length,
    ingresadas: intentU.reduce((s, u) => s + getIng(u), 0),
    usuarios: intentU.map(ur),
  };

  // Seg 4 (cero)
  const ceroU = us.filter((u) => getMov(u) === 0 && getIng(u) === 0);
  const s4Cap = 1000;
  const segmento_4_cero = {
    count: ceroU.length,
    usuarios: ceroU.slice(0, s4Cap).map(ur),
    truncated: ceroU.length > s4Cap,
  };

  // Comunidades
  const comStats: Record<string, { registrados: number; activos: number; ing: number; mov: number; users: CommunityUser[] }> = {};
  for (const u of us) {
    const com = u.comunidad || "SIN COMUNIDAD";
    if (!comStats[com]) comStats[com] = { registrados: 0, activos: 0, ing: 0, mov: 0, users: [] };
    comStats[com].registrados++;
    if (getMov(u) > 0) comStats[com].activos++;
    comStats[com].ing += getIng(u);
    comStats[com].mov += getMov(u);
    comStats[com].users.push({ email: u.email, nombre: u.nombre, telefono: u.telefono, ing: getIng(u), mov: getMov(u) });
  }
  const comunidades: CommunityEntry[] = [];
  const comunidades_detalle: Record<string, CommunityUser[]> = {};
  const sortedComs = Object.entries(comStats).sort((a, b) => b[1].registrados - a[1].registrados);
  for (const [com, st] of sortedComs) {
    const pct = st.registrados > 0 ? Math.round((st.activos / st.registrados) * 1000) / 10 : 0;
    comunidades.push({
      comunidad: com, registrados: st.registrados, activos: st.activos,
      pct_activacion: pct, ingresadas: st.ing, movilizadas: st.mov,
    });
    st.users.sort((a, b) => b.mov - a.mov || b.ing - a.ing);
    comunidades_detalle[com] = st.users;
  }

  return {
    total_registrados: us.length,
    total_ordenes: totalMov,
    total_movilizadas: totalMov,
    total_ingresadas: totalIng,
    activos_total: activos.length,
    intentaron_total: intentU.length,
    inactivos_total: ceroU.length,
    windows_note: useQTotal ? `orders acumulados ${useQTotal.toUpperCase()}` : "",
    segmento_1_pareto75: pareto,
    segmento_2_bins,
    segmento_3_1_a_19,
    segmento_intentaron,
    segmento_4_cero,
    comunidades,
    comunidades_detalle,
  };
}

export function buildUsuariosSegmentados(
  registered: RegisteredUser[],
  legacyDropshippers: LegacyDropshipper[],
  q2Snapshots: OperationalSnapshot[],
): UsuariosSegmentados {
  const opsByMonth = buildOpsByMonth(legacyDropshippers, q2Snapshots);
  const users = enrichUsers(registered, opsByMonth);

  const cohorts: Record<string, CohortOut> = {};
  for (const m of [...Q1, ...Q2]) {
    const cu = users.filter((u) => u.reg_mes === m);
    cohorts[m] = buildCohort(cu);
    cohorts[m].windows_note = `orders solo de ${m}`;
  }
  const q1u = users.filter((u) => (Q1 as readonly string[]).includes(u.reg_mes));
  cohorts.q1 = buildCohort(q1u, "q1");
  cohorts.q1.windows_note = "orders acumulados Ene+Feb+Mar para registrados en Q1";

  const q2u = users.filter((u) => (Q2 as readonly string[]).includes(u.reg_mes));
  cohorts.q2 = buildCohort(q2u, "q2");
  cohorts.q2.windows_note = "orders acumulados Abr+May+Jun para registrados en Q2";

  // Comunidades globales
  const cg: Record<string, { registrados: number; activos: number }> = {};
  for (const u of users) {
    const com = u.comunidad || "SIN COMUNIDAD";
    if (!cg[com]) cg[com] = { registrados: 0, activos: 0 };
    cg[com].registrados++;
    if (u.q1_mov + u.q2_mov > 0) cg[com].activos++;
  }
  const comunidades_globales = Object.entries(cg)
    .sort((a, b) => b[1].registrados - a[1].registrados)
    .map(([com, st]) => ({
      comunidad: com, registrados: st.registrados, activos: st.activos,
      pct_activacion: st.registrados > 0 ? Math.round((st.activos / st.registrados) * 1000) / 10 : 0,
    }));

  // Retention
  const toRet = (u: UserWithOps): RetUser => ({
    email: u.email, nombre: u.nombre, telefono: u.telefono, comunidad: u.comunidad,
    mov_cohort: u.cohort_mov, ing_cohort: u.cohort_ing,
    mov_post: Math.max(0, u.q2_mov - u.cohort_mov),
    ing_post: Math.max(0, u.q2_ing - u.cohort_ing),
    mov_q2: u.q2_mov, ing_q2: u.q2_ing,
    mov_abril: u.ops.abril.mov, mov_mayo: u.ops.mayo.mov, mov_junio: u.ops.junio.mov,
    ing_abril: u.ops.abril.ing, ing_mayo: u.ops.mayo.ing, ing_junio: u.ops.junio.ing,
  });

  // Retención de cohorts previas — para cada mes vista (abril/mayo/junio/q2),
  // mirar todos los cohorts de meses anteriores y clasificar usuarios en
  // buckets genéricos:
  //   nunca_operaron: nunca movilizó en ningún mes
  //   solo_<cohort>: movilizó en su cohort pero NO en el mes vista
  //   activo_<vista>: movilizó en el mes vista (= retención positiva)
  //   bajaron_<vista>: movilizó en vista pero menos que su mejor mes previo
  const ALL_MESES = ["enero","febrero","marzo","abril","mayo","junio"];
  const Q1_MES = new Set(["enero","febrero","marzo"]);
  const Q2_MES = new Set(["abril","mayo","junio"]);

  const byCohortMes: Record<string, UserWithOps[]> = {};
  for (const m of ALL_MESES) byCohortMes[m] = users.filter((u) => u.reg_mes === m);
  // Cohort virtual "q1" = todos los registrados en Q1
  const byCohortQ1 = users.filter((u) => Q1_MES.has(u.reg_mes));

  function movInMes(u: UserWithOps, mes: string): number {
    return u.ops[mes]?.mov ?? 0;
  }
  function totalMovLifetime(u: UserWithOps): number {
    return u.q1_mov + u.q2_mov;
  }
  function bestMonthBefore(u: UserWithOps, vista: string): number {
    const idx = ALL_MESES.indexOf(vista);
    if (idx < 0) return 0;
    let best = 0;
    for (let i = 0; i < idx; i++) {
      const v = movInMes(u, ALL_MESES[i]);
      if (v > best) best = v;
    }
    return best;
  }

  type Bucket = "nunca_operaron" | "solo_cohort" | "activo_vista" | "bajaron_vista";

  // Para vista=q2 (acumulado), se usa q2_mov como métrica del mes vista.
  function classify(u: UserWithOps, cohortMes: string, vista: string): Bucket {
    const lifetime = totalMovLifetime(u);
    const inVista = vista === "q2" ? u.q2_mov : movInMes(u, vista);
    if (lifetime === 0) return "nunca_operaron";
    if (inVista === 0) return "solo_cohort";
    const best = bestMonthBefore(u, vista === "q2" ? "junio" : vista);
    if (inVista < best && best > 0) return "bajaron_vista";
    return "activo_vista";
  }

  // Construye los buckets para una (vista, cohortKey, cohortUsers)
  function buildBuckets(vista: string, cohortKey: string, cohortUsers: UserWithOps[]) {
    const buckets: Record<string, RetUser[]> = {
      nunca_operaron: [],
      [`solo_${cohortKey}`]: [],
      [`activo_${vista}`]: [],
      [`bajaron_${vista}`]: [],
    };
    for (const u of cohortUsers) {
      const b = classify(u, cohortKey, vista);
      const key = b === "nunca_operaron" ? "nunca_operaron"
        : b === "solo_cohort" ? `solo_${cohortKey}`
        : b === "bajaron_vista" ? `bajaron_${vista}`
        : `activo_${vista}`;
      buckets[key].push(toRet(u));
    }
    return buckets;
  }

  const retention: UsuariosSegmentados["retention"] = {} as never;

  // Vistas Q2: abril, mayo, junio, q2 (acumulado)
  const Q2_VIEWS = ["abril", "mayo", "junio", "q2"] as const;
  for (const vista of Q2_VIEWS) {
    retention[vista] = {};
    // Cohorts previos en orden: q1 (acumulado) + meses Q2 anteriores al vista
    const prevCohorts: { key: string; users: UserWithOps[] }[] = [];
    if (byCohortQ1.length > 0) prevCohorts.push({ key: "q1", users: byCohortQ1 });
    if (vista !== "abril") {
      // agregar abril (si vista no es abril)
      if (byCohortMes.abril.length > 0) prevCohorts.push({ key: "abril", users: byCohortMes.abril });
    }
    if (vista === "junio" || vista === "q2") {
      if (byCohortMes.mayo.length > 0) prevCohorts.push({ key: "mayo", users: byCohortMes.mayo });
    }
    for (const { key, users: cu } of prevCohorts) {
      retention[vista][key] = buildBuckets(vista, key, cu);
    }
  }

  // Sort + cap
  const RET_CAP = 1000; const seenLists = new Set<unknown>();
  for (const view of Object.values(retention)) {
    for (const buckets of Object.values(view)) {
      for (const [bk, lst] of Object.entries(buckets)) {
        if (seenLists.has(lst)) continue;
        seenLists.add(lst);
        lst.sort((a, b) => b.mov_q2 - a.mov_q2 || b.ing_q2 - a.ing_q2 || b.mov_cohort - a.mov_cohort);
        if (bk.startsWith("nunca_") && lst.length > RET_CAP) lst.length = RET_CAP;
      }
    }
  }

  const retention_summary: UsuariosSegmentados["retention_summary"] = {};
  for (const [v, bc] of Object.entries(retention)) {
    retention_summary[v] = {};
    for (const [c, buckets] of Object.entries(bc)) {
      retention_summary[v][c] = {};
      for (const [bk, lst] of Object.entries(buckets)) retention_summary[v][c][bk] = lst.length;
    }
  }

  return {
    updated_at: new Date().toISOString(),
    data_window: "Q1 y Q2 per-DS preciso desde operational_snapshots. Retention con separación mes a mes.",
    cohorts,
    comunidades_globales,
    retention,
    retention_summary,
  };
}
