// ═══════════════════════════════════════════════════════════════════
// Parser del Excel mensual de rendición de caja de Argentina
// ("CAJA AGOSTO 2026 .xlsx"). Hojas esperadas:
//   - "Cta Cte Banco Galicia"  → movimientos del banco (fecha, concepto, egreso, observaciones)
//   - "Caja Efectivo"          → movimientos en efectivo
//   - "Resumen Consolidado"    → saldos inicial/final y detalle de egresos por grupo
// El detalle por grupo manda (es la clasificación de la Gerencia Administrativa);
// de las hojas de cuenta sacamos la fecha y la observación de cada egreso.
// ═══════════════════════════════════════════════════════════════════

import * as XLSX from "xlsx";
import type { MesKey, RendicionCaja, RendicionMovimiento } from "./finanzas-ar-types";

type Row = unknown[];

const MESES_ES: Record<string, MesKey> = {
  enero: "ene", febrero: "feb", marzo: "mar", abril: "abr", mayo: "may", junio: "jun",
  julio: "jul", agosto: "ago", septiembre: "sep", setiembre: "sep", octubre: "oct",
  noviembre: "nov", diciembre: "dic",
};

// Compromisos recurrentes mensuales → gasto fijo. Todo lo demás es variable/extraordinario.
const FIJO_RE = /sueldo|alquiler|vi[aá]tico|cochera|tusfacturas|cargas sociales|ingresos brutos|aut[oó]nomos|honorarios|membres[ií]a|fulfillment|simplifica/i;
const VARIABLE_RE = /recarga|bonificaci|tr[aá]mite|ley 25413/i;

export function clasificarTipo(concepto: string): "fijo" | "variable" {
  if (VARIABLE_RE.test(concepto)) return "variable";
  return FIJO_RE.test(concepto) ? "fijo" : "variable";
}

const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function toNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    // "$50.679.749,71" → 50679749.71
    const s = v.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return s !== "" && isFinite(n) ? n : null;
  }
  return null;
}

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, "0"), d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface CuentaMov { fecha: string | null; concepto: string; monto: number; nota?: string; categoria?: string; usado?: boolean }

function parseCuenta(rows: Row[]): CuentaMov[] {
  const h = rows.findIndex((r) => norm(r[0]) === "fecha");
  if (h < 0) return [];
  const header = rows[h].map(norm);
  const col = (s: string) => header.findIndex((c) => c.startsWith(s));
  const cConcepto = col("concepto"), cEgreso = col("egreso"), cObs = col("observaciones"), cCat = col("categoria");
  const out: CuentaMov[] = [];
  for (const r of rows.slice(h + 1)) {
    if (norm(r[cConcepto]).startsWith("saldo inicial")) continue;
    if (norm(r[0]).includes("total")) break;
    const monto = toNum(r[cEgreso]);
    if (!monto || monto <= 0) continue;
    const obs = cObs >= 0 ? String(r[cObs] ?? "").trim() : "";
    out.push({
      fecha: toIsoDate(r[0]),
      concepto: String(r[cConcepto] ?? "").trim(),
      monto: round2(monto),
      nota: obs || undefined,
      categoria: cCat >= 0 ? String(r[cCat] ?? "").trim() || undefined : undefined,
    });
  }
  return out;
}

export interface RendicionParseada {
  mes: MesKey | null;       // detectado del título ("… — AGOSTO 2026")
  rendicion: RendicionCaja;
  totalEgresosArchivo: number | null; // para validar contra la suma de movimientos
}

export function parseRendicionCaja(buf: ArrayBuffer, fileName?: string): RendicionParseada {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = (re: RegExp) => {
    const name = wb.SheetNames.find((n) => re.test(norm(n)));
    return name ? (XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { header: 1, raw: true, defval: null }) as Row[]) : null;
  };
  const bancoName = wb.SheetNames.find((n) => /banco|cta cte/.test(norm(n))) ?? "Banco";
  const resumen = sheet(/resumen/);
  const efectivoRows = sheet(/efectivo/);
  const bancoRows = sheet(/banco|cta cte/);
  if (!resumen) throw new Error("No encontré la hoja 'Resumen Consolidado' en el archivo.");

  // Mes desde el título
  let mes: MesKey | null = null;
  for (const r of resumen.slice(0, 5)) {
    const t = norm(r[0]);
    const hit = Object.keys(MESES_ES).find((m) => t.includes(m));
    if (hit) { mes = MESES_ES[hit]; break; }
  }
  if (!mes && fileName) {
    const hit = Object.keys(MESES_ES).find((m) => norm(fileName).includes(m));
    if (hit) mes = MESES_ES[hit];
  }

  // La fila tiene que traer números (evita matchear títulos de sección como "SALDO FINAL")
  const findRow = (re: RegExp) => resumen.find((r) => re.test(norm(r[0])) && r.slice(1).some((v) => toNum(v) !== null));
  const nums = (r: Row | undefined) => (r ?? []).slice(1).map(toNum);
  const ini = nums(findRow(/^saldo anterior|^total saldo apertura/));
  const fin = nums(findRow(/^saldo final/));
  const fondos = nums(findRow(/^fondos recibidos/)).find((n) => n !== null) ?? 0;
  const totalEgr = nums(findRow(/^total egresos$/)).filter((n): n is number => n !== null).pop() ?? null;

  const cuentaEf = efectivoRows ? parseCuenta(efectivoRows) : [];
  const cuentaBa = bancoRows ? parseCuenta(bancoRows) : [];
  const matchCuenta = (origen: "efectivo" | "banco", monto: number) => {
    const m = (origen === "efectivo" ? cuentaEf : cuentaBa).find((c) => !c.usado && Math.abs(c.monto - monto) < 0.02);
    if (m) m.usado = true;
    return m;
  };

  // Detalle de egresos por grupo
  const movimientos: RendicionMovimiento[] = [];
  const start = resumen.findIndex((r) => norm(r[0]).startsWith("detalle de egresos"));
  if (start >= 0) {
    let grupo = "OTROS";
    for (const r of resumen.slice(start + 1)) {
      const c0 = String(r[0] ?? "").trim();
      const n0 = norm(c0);
      if (!c0 || n0 === "concepto" || n0.startsWith("subtotal")) continue;
      if (n0.startsWith("total egresos") || n0.startsWith("resumen")) break;
      const origenTxt = norm(r[1]);
      const monto = toNum(r[2]);
      if (monto === null && !origenTxt) { grupo = c0.toUpperCase(); continue; }
      if (monto === null || monto <= 0) continue;
      const origen: "efectivo" | "banco" = origenTxt.startsWith("efectivo") ? "efectivo" : "banco";
      const m = matchCuenta(origen, round2(monto));
      movimientos.push({
        fecha: m?.fecha ?? null,
        concepto: c0,
        monto: round2(monto),
        origen,
        grupo,
        tipo: clasificarTipo(c0),
        nota: m?.nota,
      });
    }
  }

  // Sin detalle en el resumen: armamos desde las hojas de cuenta
  if (movimientos.length === 0) {
    for (const [origen, lista] of [["efectivo", cuentaEf], ["banco", cuentaBa]] as const) {
      for (const c of lista) {
        movimientos.push({ fecha: c.fecha, concepto: c.concepto, monto: c.monto, origen, grupo: (c.categoria || "OTROS").toUpperCase(), tipo: clasificarTipo(c.concepto), nota: c.nota });
      }
    }
  }
  if (movimientos.length === 0) throw new Error("El archivo no tiene egresos para cargar.");

  return {
    mes,
    totalEgresosArchivo: totalEgr,
    rendicion: {
      saldoInicial: { efectivo: ini[0] ?? 0, banco: ini[1] ?? 0 },
      saldoFinal: { efectivo: fin[0] ?? 0, banco: fin[1] ?? 0 },
      fondosRecibidos: fondos,
      banco: bancoName.replace(/banco\s*/i, "").trim() || "Banco",
      movimientos,
      fuente: fileName,
      cargadoEl: new Date().toISOString(),
    },
  };
}
