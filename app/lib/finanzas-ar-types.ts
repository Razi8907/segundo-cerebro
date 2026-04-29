// ═══════════════════════════════════════════════════════════════════
// Shape de la data financiera editable de Argentina.
// Compartida entre el editor, la API route y el dashboard.
// ═══════════════════════════════════════════════════════════════════

export type MesKey = "ene" | "feb" | "mar" | "abr" | "may" | "jun" | "jul" | "ago" | "sep" | "oct" | "nov" | "dic";

export interface MesData {
  label: string;
  movilizadas: number;
  fleteCod: number;
  comisionCod: number;
  fleteFf: number;
  egrFijos: number;
  egrVar: number;
  ffEntregadas: number;
  ffNoEntregadas: number;
  ffPrecioEnt: number;
  ffPrecioNoEnt: number;
}

export interface CajaHoy {
  bbva: number;
  efectivo: number;
  fixyConfirmado: number;
  fixyPendienteEst: number;
}

export interface DeudaInterco {
  colombia: number;
  paraguay: number;
}

export interface GastoBreakdown {
  concepto: string;
  monto: number;
}

export interface Liquidacion {
  periodo: string;
  ordenes: number | null;
  bruto: number | null;
  fixy: number | null;
  neto: number | null;
  estado: "cobrado" | "retenido" | "conciliar";
  deposito: string;
}

export interface FinanzasARData {
  meses: Partial<Record<MesKey, MesData>>;
  caja: CajaHoy;
  deuda: DeudaInterco;
  salarioRazielAr: number;
  gastosBreakdownYtd: GastoBreakdown[];
  liquidaciones: Liquidacion[];
}

// Defaults — usados si la tabla de Supabase está vacía
export const FINANZAS_AR_DEFAULT: FinanzasARData = {
  meses: {
    ene: { label: "Ene '26", movilizadas: 8501, fleteCod: 12289500, comisionCod: 2457900, fleteFf: 462000, egrFijos: 10202480, egrVar: 981610, ffEntregadas: 184, ffNoEntregadas: 194, ffPrecioEnt: 990, ffPrecioNoEnt: 495 },
    feb: { label: "Feb '26", movilizadas: 7875, fleteCod: 11094000, comisionCod: 2218800, fleteFf: 718500, egrFijos: 11840915, egrVar: 2770997, ffEntregadas: 208, ffNoEntregadas: 202, ffPrecioEnt: 990, ffPrecioNoEnt: 495 },
    mar: { label: "Mar '26", movilizadas: 9086, fleteCod: 11020500, comisionCod: 2204100, fleteFf: 2608500, egrFijos: 9940019, egrVar: 4162830, ffEntregadas: 268, ffNoEntregadas: 123, ffPrecioEnt: 1350, ffPrecioNoEnt: 675 },
    abr: { label: "Abr '26", movilizadas: 9232, fleteCod: 11758500, comisionCod: 2351700, fleteFf: 2089500, egrFijos: 10460549, egrVar: 8297909, ffEntregadas: 911, ffNoEntregadas: 900, ffPrecioEnt: 1350, ffPrecioNoEnt: 675 },
  },
  caja: {
    bbva: 74036442,
    efectivo: 33164298,
    fixyConfirmado: 468822348,
    fixyPendienteEst: 1178685000,
  },
  deuda: {
    colombia: 29800000,
    paraguay: 42000000,
  },
  salarioRazielAr: 2485000,
  gastosBreakdownYtd: [
    { concepto: "Sueldos (sin Raziel)", monto: 13200000 },
    { concepto: "Alquiler + cochera", monto: 10400000 },
    { concepto: "Honorarios contador + abogado", monto: 10500000 },
    { concepto: "Viáticos Raziel", monto: 15100000 },
    { concepto: "Viáticos Heads Comerciales", monto: 3100000 },
    { concepto: "Fulfillment GV Nexus", monto: 3500000 },
  ],
  liquidaciones: [
    { periodo: "Oct '25 — 2°", ordenes: 415, bruto: 20320954, fixy: 4287973, neto: 16032982, estado: "cobrado", deposito: "BBVA 02/12/25" },
    { periodo: "Nov '25 — 1°", ordenes: 1394, bruto: 76665279, fixy: 18650125, neto: 58003460, estado: "cobrado", deposito: "BBVA 10/12/25" },
    { periodo: "Nov '25 — 2°", ordenes: 2301, bruto: 120278809, fixy: 24833369, neto: 95445440, estado: "cobrado", deposito: "Efectivo Dic-Abr" },
    { periodo: "Dic '25 — 1°", ordenes: 6995, bruto: 199467358, fixy: 49741073, neto: 149726285, estado: "retenido", deposito: "Pendiente" },
    { periodo: "Dic '25 — 2°", ordenes: 7526, bruto: 179480118, fixy: 47221745, neto: 132258373, estado: "retenido", deposito: "Pendiente" },
    { periodo: "Ene '26 — 1°", ordenes: 3391, bruto: 95168984, fixy: 25291194, neto: 69877790, estado: "retenido", deposito: "Pendiente" },
    { periodo: "Ene '26 — 2°", ordenes: null, bruto: null, fixy: null, neto: 116959900, estado: "retenido", deposito: "Pendiente" },
    { periodo: "Feb '26", ordenes: 7875, bruto: null, fixy: null, neto: null, estado: "conciliar", deposito: "Pendiente conciliación" },
    { periodo: "Mar '26 — Fixy", ordenes: null, bruto: null, fixy: null, neto: null, estado: "conciliar", deposito: "Pendiente" },
    { periodo: "Mar '26 — Urbano", ordenes: null, bruto: null, fixy: null, neto: null, estado: "conciliar", deposito: "Inició mar'26" },
    { periodo: "Abr '26 — Fixy", ordenes: null, bruto: null, fixy: null, neto: null, estado: "conciliar", deposito: "Pendiente" },
    { periodo: "Abr '26 — Urbano", ordenes: null, bruto: null, fixy: null, neto: null, estado: "conciliar", deposito: "Pendiente" },
  ],
};

export const MES_LABELS: Record<MesKey, string> = {
  ene: "Ene '26", feb: "Feb '26", mar: "Mar '26", abr: "Abr '26",
  may: "May '26", jun: "Jun '26", jul: "Jul '26", ago: "Ago '26",
  sep: "Sep '26", oct: "Oct '26", nov: "Nov '26", dic: "Dic '26",
};
