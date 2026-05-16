"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";

/* ───────── constants ───────── */
// ─── PARAGUAY: estados (sin unificación, archivo Dropi original) ───
const STATUS_GROUPS_PY = {
  mov_dropshipper: ["PENDIENTE CONFIRMACION"],
  mov_proveedor: ["PENDIENTE", "GUIA_GENERADA", "PREPARADO PARA TRANSPORTADORA"],
  mov_aex: [
    "RETIRO REALIZADO", "EN OFICINAS DE AEX",
    "DISPONIBLE PARA RETIRO EN OFICINAS DE AEX", "EN RUTA PARA ENTREGA",
    "NO ENTREGADA", "NOVEDAD", "NOVEDAD SOLUCIONADA",
  ],
  mov_fixy: [
    "ENVIO RECOLECTADO", "BODEGA ORIGEN", "RUTEADO PARA SU ENTREGA",
    "EN REPARTO", "REPROGRAMADO POR EL CLIMA", "REPACTADO LISTO PARA DESPACHO",
    "REINGRESO A BODEGA", "PAQUETE DAÑADO O INCOMPLETO", "NOVEDAD",
    "NOVEDAD SOLUCIONADA", "FALLA MECANICA, AVERIA DE VEHICULO",
    "INCIDENTE DURANTE LA ENTREGA",
  ],
  cancelacion: ["CANCELADO", "RECHAZADO", "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA"],
  terminales: ["ENTREGADO", "DEVOLUCION"],
};

// ─── ARGENTINA: mapeo de 29 estados crudos → 21 unificados ───
const AR_STATE_MAP: Record<string, string> = {
  // Mantienen (Ambas)
  "PENDIENTE CONFIRMACION": "PENDIENTE CONFIRMACION",
  "PENDIENTE": "PENDIENTE",
  "GUIA_GENERADA": "GUIA_GENERADA",
  "NOVEDAD": "NOVEDAD",
  "NOVEDAD SOLUCIONADA": "NOVEDAD SOLUCIONADA",
  "EN PROCESO DE DEVOLUCION": "EN PROCESO DE DEVOLUCION",
  "DEVOLUCION": "DEVOLUCION",
  "ENTREGADO": "ENTREGADO",
  "CANCELADO": "CANCELADO",
  "RECHAZADO": "RECHAZADO",
  // Solo Urbano (mantienen)
  "PREPARADO PARA TRANSPORTADORA": "PREPARADO PARA TRANSPORTADORA",
  "RECOGIDO POR TRANSPORTADORA": "RECOGIDO POR TRANSPORTADORA",
  "EN BODEGA DESTINO": "EN BODEGA DESTINO",
  "RETIRO POR SUCURSAL": "RETIRO POR SUCURSAL",
  "MAL RUTEO": "MAL RUTEO",
  "ANULACIÓN DE MANIFIESTO": "ANULACIÓN DE MANIFIESTO",
  "ANULACION DE MANIFIESTO": "ANULACIÓN DE MANIFIESTO", // por si viene sin tilde
  "RENDICIÓN DE ACUSE": "RENDICIÓN DE ACUSE",
  "RENDICION DE ACUSE": "RENDICIÓN DE ACUSE",
  // Solo Fixy (mantiene)
  "GESTIONADO OPERATIVA": "GESTIONADO OPERATIVA",
  // Unifica
  "BODEGA ORIGEN": "EN BODEGA ORIGEN",
  "EN BODEGA ORIGEN": "EN BODEGA ORIGEN",
  "RUTEADO PARA SU ENTREGA": "LISTO PARA DESPACHO",
  "MANIFIESTO": "LISTO PARA DESPACHO",
  "EN REPARTO": "EN RUTA A ENTREGA",
  "SALIDA A RUTA": "EN RUTA A ENTREGA",
  "REPACTADO LISTO PARA DESPACHO": "REPACTADO",
  "PACTADO": "REPACTADO",
  "REINGRESO A BODEGA": "REINTENTO PROGRAMADO",
  "REDESPACHO": "REINTENTO PROGRAMADO",
  "GUIA_ANULADA": "RECHAZADO",
};

// ─── ARGENTINA: agrupamiento de estados unificados ───
const STATUS_GROUPS_AR = {
  mov_dropshipper: ["PENDIENTE CONFIRMACION"],
  mov_proveedor: ["PENDIENTE", "GUIA_GENERADA", "PREPARADO PARA TRANSPORTADORA"],
  // Todos los estados en poder de la transportadora (FIXY o URBANO)
  mov_transportadora: [
    "RECOGIDO POR TRANSPORTADORA", "EN BODEGA ORIGEN", "EN BODEGA DESTINO",
    "LISTO PARA DESPACHO", "EN RUTA A ENTREGA", "REPACTADO", "GESTIONADO OPERATIVA",
    "RETIRO POR SUCURSAL", "NOVEDAD", "NOVEDAD SOLUCIONADA", "MAL RUTEO",
    "ANULACIÓN DE MANIFIESTO", "REINTENTO PROGRAMADO", "RENDICIÓN DE ACUSE",
  ],
  problemas: ["NOVEDAD", "MAL RUTEO", "ANULACIÓN DE MANIFIESTO"],
  devolucion: ["EN PROCESO DE DEVOLUCION", "DEVOLUCION"],
  cancelacion: ["CANCELADO", "RECHAZADO"],
  terminales: ["ENTREGADO", "DEVOLUCION"],
};

// Helper: devuelve el group object según country
const getStatusGroups = (country: string) => country === "ar"
  ? {
      mov_dropshipper: STATUS_GROUPS_AR.mov_dropshipper,
      mov_proveedor: STATUS_GROUPS_AR.mov_proveedor,
      mov_aex: [] as string[], // no aplica
      mov_fixy: STATUS_GROUPS_AR.mov_transportadora, // se reusa el bucket
      cancelacion: STATUS_GROUPS_AR.cancelacion,
      terminales: STATUS_GROUPS_AR.terminales,
    }
  : STATUS_GROUPS_PY;

// Helper: para AR aplica el mapeo de unificación al estatus crudo
const unifyEstatus = (raw: string, country: string): string => {
  if (country !== "ar") return raw;
  const trimmed = (raw || "").trim();
  return AR_STATE_MAP[trimmed] || trimmed;
};

// Normaliza fechas a YYYY-MM-DD para poder filtrar/cruzar fuentes con formatos distintos
function toIsoDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (!m) return s;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// Mes numérico de cada MesOps. Hardcoded a 2026 (los meses cubiertos por el dashboard).
const MES_MONTH_NUM: Record<"abril" | "mayo", number> = { abril: 4, mayo: 5 };

// Convierte una fecha ISO a la misma fecha pero en el mes objetivo (mismo día).
// Si el día no existe (31 de un mes con 30), lo recorta al último día válido.
function shiftDateToMes(iso: string, targetMes: "abril" | "mayo"): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-\d{2}-(\d{2})$/);
  if (!m) return iso;
  const year = m[1];
  const targetMonth = MES_MONTH_NUM[targetMes];
  const day = parseInt(m[2], 10);
  const lastDay = new Date(parseInt(year, 10), targetMonth, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${year}-${String(targetMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

// Métricas de movilización. `rows` son las guías de operations_data (ya movilizadas).
// `ingresadasOverride` viene de Comercial (operational_snapshots) — total real de
// órdenes recibidas. Si no se pasa, se asume que rows representa ingresadas.
function computeMovMetrics(rows: { estatus: string }[], country: string, ingresadasOverride?: number) {
  const SG = getStatusGroups(country);
  const rowsCount = rows.length;
  let pendDS = 0, pendProv = 0, enProceso = 0, entregadas = 0, devueltas = 0, canceladas = 0;
  for (const r of rows) {
    const s = r.estatus;
    if (SG.mov_dropshipper.includes(s)) pendDS++;
    else if (SG.mov_proveedor.includes(s)) pendProv++;
    else if (SG.mov_aex.includes(s) || SG.mov_fixy.includes(s)) enProceso++;
    else if (s === "ENTREGADO") entregadas++;
    else if (s === "DEVOLUCION" || s === "EN PROCESO DE DEVOLUCION") devueltas++;
    else if (SG.cancelacion.includes(s)) canceladas++;
  }
  // El file de Operaciones contiene "ya movilizadas". Si llegan filas en PENDIENTE
  // CONFIRMACION, las excluimos del movilizado.
  const movilizadas = rowsCount - pendDS;
  const movilizadasProv = rowsCount - pendDS - pendProv;
  const ingresadas = ingresadasOverride !== undefined ? ingresadasOverride : rowsCount;
  // % Movilizadas se mide vs INGRESADAS (todo lo que llegó del Comercial).
  // El resto (entrega, devolución, en proceso, canceladas) se mide vs MOVILIZADAS
  // (las que efectivamente entraron a la operación logística).
  const pctIng = (n: number) => (ingresadas > 0 ? (n / ingresadas) * 100 : 0);
  const pctMov = (n: number) => (movilizadas > 0 ? (n / movilizadas) * 100 : 0);
  const noMovilizadas = Math.max(ingresadas - movilizadas, 0);
  return {
    ingresadas,
    movilizadas, pctMovilizadas: pctIng(movilizadas),
    movilizadasProv, pctMovilizadasProv: pctIng(movilizadasProv),
    noMovilizadas,
    pendDS, pendProv,
    enProceso, pctEnProceso: pctMov(enProceso),
    entregadas, pctEntrega: pctMov(entregadas),
    devueltas, pctDevuelta: pctMov(devueltas),
    canceladas, pctCancelada: pctMov(canceladas),
  };
}
type MovMetrics = ReturnType<typeof computeMovMetrics>;

// Total de ingresadas: viene del Seguimiento Diario (daily_tracking).
// `days` = array de { fecha: <day-of-month int>, ordenes: int, dia_semana: string }.
// Cuando dateMode=range, filtra por el DÍA DEL MES (1..31) extraído del rango.
function ingresadasInRange(days: { fecha: number; ordenes: number }[], dateMode: "all" | "range", dateFrom: string, dateTo: string): number {
  if (!Array.isArray(days) || days.length === 0) return 0;
  if (dateMode === "all" || (!dateFrom && !dateTo)) {
    return days.reduce((s, d) => s + (Number(d.ordenes) || 0), 0);
  }
  const fromDay = dateFrom ? parseInt(dateFrom.slice(8, 10), 10) : 1;
  const toDay = dateTo ? parseInt(dateTo.slice(8, 10), 10) : 31;
  let sum = 0;
  for (const d of days) {
    const day = Number(d.fecha) || 0;
    if (day < fromDay || day > toDay) continue;
    sum += Number(d.ordenes) || 0;
  }
  return sum;
}

// Mapa DS-nombre → ingresadas (filtradas por rango usando by_ds_daily si hay range)
function ingresadasByEntity(
  opData: any,
  kind: "ds" | "prov",
  dateMode: "all" | "range",
  dateFrom: string,
  dateTo: string,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!opData) return map;
  if (kind === "ds" && dateMode === "range" && (dateFrom || dateTo)) {
    const daily = Array.isArray(opData.by_ds_daily) ? opData.by_ds_daily : [];
    for (const r of daily) {
      const iso = toIsoDate(String(r.fecha || ""));
      if (dateFrom && iso < dateFrom) continue;
      if (dateTo && iso > dateTo) continue;
      const k = String(r.ds || "");
      map.set(k, (map.get(k) || 0) + (Number(r.ordenes) || 0));
    }
    return map;
  }
  const arr = kind === "ds"
    ? (Array.isArray(opData.by_dropshipper) ? opData.by_dropshipper : [])
    : (Array.isArray(opData.by_proveedor) ? opData.by_proveedor : []);
  for (const r of arr) {
    map.set(String(r.nombre || ""), Number(r.total) || 0);
  }
  return map;
}

// Tabs por país
const TABS_PY = [
  { key: "resumen", label: "📊 Resumen" },
  { key: "aex", label: "✈️ AEX" },
  { key: "fixy", label: "🚚 FIXY" },
  { key: "fixy_nd", label: "🚚 FIXY Next Day" },
  { key: "no_entregadas", label: "🚨 No Entregadas" },
  { key: "novedades", label: "⚠️ Novedades" },
  { key: "mov_prov", label: "📦 Mov. Proveedor" },
  { key: "mov_ds", label: "👤 Mov. Dropshipper" },
  { key: "canceladas", label: "❌ Canceladas" },
  { key: "paradas", label: "⏰ Paradas +72hs" },
] as const;

const TABS_AR = [
  { key: "resumen", label: "📊 Resumen" },
  { key: "fixy", label: "🚚 FIXY" },
  { key: "urbano", label: "🚛 URBANO" },
  { key: "no_entregadas", label: "🚨 Devoluciones" },
  { key: "novedades", label: "⚠️ Novedades" },
  { key: "mov_prov", label: "📦 Mov. Proveedor" },
  { key: "mov_ds", label: "👤 Mov. Dropshipper" },
  { key: "canceladas", label: "❌ Canceladas" },
  { key: "paradas", label: "⏰ Paradas +72hs" },
] as const;

type TabKey = "resumen" | "aex" | "fixy" | "fixy_nd" | "urbano" | "no_entregadas" | "novedades" | "mov_prov" | "mov_ds" | "canceladas" | "paradas";

const getTabs = (country: string) => (country === "ar" ? TABS_AR : TABS_PY) as readonly { key: TabKey; label: string }[];

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "#d97706", "PENDIENTE CONFIRMACION": "#b45309", GUIA_GENERADA: "#2563eb",
  "PREPARADO PARA TRANSPORTADORA": "#4f46e5", "RETIRO REALIZADO": "#7c3aed",
  "EN OFICINAS DE AEX": "#8b5cf6", "DISPONIBLE PARA RETIRO EN OFICINAS DE AEX": "#6d28d9",
  "EN RUTA PARA ENTREGA": "#0d9488", "NO ENTREGADA": "#dc2626", NOVEDAD: "#ea580c",
  "NOVEDAD SOLUCIONADA": "#f97316", CANCELADO: "#991b1b", RECHAZADO: "#b91c1c",
  "GUIA ANULADA": "#7f1d1d", "CANCELADO POR TRANSPORTADORA": "#ef4444",
  ENTREGADO: "#16a34a", DEVOLUCION: "#dc2626", "ENVIO RECOLECTADO": "#0891b2",
  "BODEGA ORIGEN": "#4f46e5", "RUTEADO PARA SU ENTREGA": "#10b981",
  "EN REPARTO": "#059669", "REPROGRAMADO POR EL CLIMA": "#d97706",
  "REPACTADO LISTO PARA DESPACHO": "#06b6d4", "REINGRESO A BODEGA": "#a21caf",
  "PAQUETE DAÑADO O INCOMPLETO": "#be123c", "FALLA MECANICA, AVERIA DE VEHICULO": "#9f1239",
  "INCIDENTE DURANTE LA ENTREGA": "#881337",
};

const BAR_COLORS = ["#ea580c", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#0d9488", "#d97706", "#4f46e5", "#0891b2"];
const TICK_STYLE = { fill: "#94a3b8", fontSize: 10 };

/* ───────── types ───────── */
interface GuideRow {
  guia: string;
  fecha: string;
  dropshipper: string;
  dropshipper_id: string;
  dropshipper_email: string;
  dropshipper_celular: string;
  nombre_tienda: string;
  proveedor_nombre: string;
  transportadora: string;
  estatus: string;
  fecha_procesamiento: string;
  fecha_ultimo_movimiento: string;
  hora_ultimo_movimiento: string;
  ciudad_destino: string;
  departamento_destino: string;
  nombre_cliente: string;
  telefono: string;
  novedad: string;
  concepto_ultimo_movimiento: string;
  comercial_asignado: string;
  total_orden: number;
  ganancia_entregado: number;
  productos: string;
  fecha_carga: string;
  country: string;
}

/* ───────── helpers ───────── */
function hoursFromProcessing(fechaProcesamiento: string): number {
  if (!fechaProcesamiento) return 0;
  try {
    const parts = fechaProcesamiento.includes("/")
      ? fechaProcesamiento.split("/").reverse().join("-")
      : fechaProcesamiento.slice(0, 10);
    const d = new Date(parts);
    if (isNaN(d.getTime())) return 0;
    return Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60));
  } catch {
    return 0;
  }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function excelDateToStr(v: any): string {
  if (!v) return "";
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400000);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  return String(v);
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function countBy<T>(arr: T[], key: (item: T) => string): { name: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/* ───────── COLUMN MAP ───────── */
const COL_MAP: { field: keyof GuideRow; idx: number }[] = [
  { field: "guia", idx: 2 },
  { field: "fecha", idx: 6 },
  { field: "dropshipper", idx: 8 },
  { field: "dropshipper_id", idx: 7 },
  { field: "dropshipper_email", idx: 12 },
  { field: "dropshipper_celular", idx: 11 },
  { field: "nombre_tienda", idx: 14 },
  { field: "proveedor_nombre", idx: 17 },
  { field: "transportadora", idx: 36 },
  { field: "estatus", idx: 29 },
  { field: "fecha_procesamiento", idx: 73 },
  { field: "fecha_ultimo_movimiento", idx: 63 },
  { field: "hora_ultimo_movimiento", idx: 62 },
  { field: "ciudad_destino", idx: 33 },
  { field: "departamento_destino", idx: 32 },
  { field: "nombre_cliente", idx: 24 },
  { field: "telefono", idx: 25 },
  { field: "novedad", idx: 51 },
  { field: "concepto_ultimo_movimiento", idx: 65 },
  { field: "comercial_asignado", idx: 82 },
  { field: "total_orden", idx: 39 },
  { field: "ganancia_entregado", idx: 47 },
  { field: "productos", idx: 80 },
];

/* ───────── parse Excel ───────── */
function parseExcel(file: File, country: string): Promise<GuideRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheetName = wb.SheetNames.find((n) => n.includes("CARGA DIARIA")) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Find the header row (the one that starts with "FECHA DE REPORTE")
        let headerIdx = -1;
        for (let i = 0; i < Math.min(10, allRows.length); i++) {
          const firstCell = String(allRows[i]?.[0] || "");
          if (firstCell === "FECHA DE REPORTE") {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) throw new Error("No se encontró la fila de encabezado (FECHA DE REPORTE)");

        // Build column map dynamically from the header row
        const headerRow = allRows[headerIdx].map((c: any) => String(c || "").trim());
        const colIdx = (name: string) => headerRow.indexOf(name);

        const dynamicMap: { field: string; idx: number }[] = [
          { field: "guia", idx: colIdx("NÚMERO GUIA") },
          { field: "fecha", idx: colIdx("FECHA") },
          { field: "dropshipper", idx: colIdx("DROPSHIPPER") },
          { field: "dropshipper_id", idx: colIdx("DROPSHIPPER ID") },
          { field: "dropshipper_email", idx: colIdx("EMAIL") },
          { field: "dropshipper_celular", idx: colIdx("CELULAR") },
          { field: "nombre_tienda", idx: colIdx("NOMBRE TIENDA") },
          { field: "proveedor_nombre", idx: colIdx("PROVEEDOR NOMBRE") },
          { field: "transportadora", idx: colIdx("TRANSPORTADORA") },
          { field: "estatus", idx: colIdx("ESTATUS") },
          { field: "fecha_procesamiento", idx: colIdx("FECHA EN PROCESAMIENDO") },
          { field: "fecha_ultimo_movimiento", idx: colIdx("FECHA DE ÚLTIMO MOVIMIENTO") },
          { field: "hora_ultimo_movimiento", idx: colIdx("HORA DE ÚLTIMO MOVIMIENTO") },
          { field: "ciudad_destino", idx: colIdx("CIUDAD DESTINO") },
          { field: "departamento_destino", idx: colIdx("DEPARTAMENTO DESTINO") },
          { field: "nombre_cliente", idx: colIdx("NOMBRE CLIENTE") },
          { field: "telefono", idx: colIdx("TELÉFONO") },
          { field: "novedad", idx: colIdx("NOVEDAD") },
          { field: "concepto_ultimo_movimiento", idx: colIdx("CONCEPTO ÚLTIMO MOVIMIENTO") },
          { field: "comercial_asignado", idx: colIdx("COMERCIAL ASIGNADO") },
          { field: "total_orden", idx: colIdx("TOTAL DE LA ORDEN") },
          { field: "ganancia_entregado", idx: colIdx("GANANCIA SI ES ENTREGADO") },
          { field: "productos", idx: colIdx("PRODUCTOS") },
        ].filter((c) => c.idx >= 0);

        const dataRows = allRows.slice(headerIdx + 1);
        const fc = todayStr();
        const parsed: GuideRow[] = [];

        for (const r of dataRows) {
          if (!r || r.length < 3) continue;
          const row: any = { fecha_carga: fc, country };
          for (const col of dynamicMap) {
            const val = r[col.idx];
            if (col.field === "total_orden" || col.field === "ganancia_entregado") {
              row[col.field] = Number(val) || 0;
            } else if (col.field === "fecha" || col.field === "fecha_procesamiento" || col.field === "fecha_ultimo_movimiento") {
              row[col.field] = excelDateToStr(val);
            } else {
              row[col.field] = val != null ? String(val).trim() : "";
            }
          }
          if (row.guia) parsed.push(row as GuideRow);
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ───────── CSV download helper ───────── */
function downloadCSV(filename: string, rows: any[], columns: { key: string; label: string }[]) {
  const BOM = "\uFEFF";
  const header = columns.map((c) => c.label).join(",");
  const lines = rows.map((r) =>
    columns.map((c) => {
      const val = r[c.key];
      if (val == null) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  const csv = BOM + header + "\n" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EXPORT_COLUMNS = [
  { key: "guia", label: "Guia" },
  { key: "fecha", label: "Fecha" },
  { key: "dropshipper", label: "Dropshipper" },
  { key: "nombre_tienda", label: "Tienda" },
  { key: "proveedor_nombre", label: "Proveedor" },
  { key: "transportadora", label: "Transportadora" },
  { key: "estatus", label: "Estado" },
  { key: "fecha_procesamiento", label: "Fecha Procesamiento" },
  { key: "fecha_ultimo_movimiento", label: "Ultimo Movimiento" },
  { key: "ciudad_destino", label: "Ciudad" },
  { key: "departamento_destino", label: "Departamento" },
  { key: "nombre_cliente", label: "Cliente" },
  { key: "telefono", label: "Telefono" },
  { key: "novedad", label: "Novedad" },
  { key: "concepto_ultimo_movimiento", label: "Concepto Ultimo Mov" },
  { key: "comercial_asignado", label: "Comercial" },
  { key: "total_orden", label: "Total Orden" },
  { key: "productos", label: "Productos" },
];

const PARADAS_EXPORT_COLUMNS = [
  ...EXPORT_COLUMNS,
  { key: "horasTransporte", label: "Horas Transporte" },
  { key: "diasSinCambio", label: "Dias en Transporte" },
];

function DownloadBtn({ onClick, label = "Descargar CSV" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-orange-500/20 text-orange-500 hover:bg-orange-500/10 transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </button>
  );
}

/* ───────── sub-components ───────── */
function KpiCard({ label, value, sub, color = "orange" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={`rounded-xl p-3 border border-${color}-500/20`} style={{ background: "var(--bg-card)" }}>
      <p className="text-[10px] t-muted uppercase">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color === "orange" ? "#ea580c" : color === "red" ? "#dc2626" : color === "green" ? "#16a34a" : color === "blue" ? "#2563eb" : color === "yellow" ? "#d97706" : "#ea580c" }}>{value}</p>
      {sub && <p className="text-[10px] t-muted">{sub}</p>}
    </div>
  );
}

function AlertCard({ label, value, level }: { label: string; value: number; level: "warn" | "crit" }) {
  const bg = level === "crit" ? "rgba(220,38,38,0.15)" : "rgba(217,119,6,0.15)";
  const border = level === "crit" ? "border-red-500/40" : "border-yellow-500/40";
  const textColor = level === "crit" ? "#dc2626" : "#d97706";
  return (
    <div className={`rounded-xl p-3 border ${border}`} style={{ background: bg }}>
      <p className="text-[10px] t-muted uppercase">{label}</p>
      <p className="text-2xl font-bold" style={{ color: textColor }}>{value}</p>
    </div>
  );
}

function DataTable({ rows, columns, highlightHours }: {
  rows: GuideRow[];
  columns: { key: string; label: string; render?: (r: GuideRow) => React.ReactNode }[];
  highlightHours?: boolean;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const totalPages = Math.ceil(rows.length / pageSize);
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  function rowBg(_r?: any): string | undefined {
    return undefined;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
        <table className="w-full text-[11px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="py-2 px-2 text-left t-muted font-medium whitespace-nowrap sticky top-0 z-10" style={{ background: "rgba(22,33,62,0.98)" }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={`${r.guia}-${i}`} className="border-t border-white/5 hover:bg-white/5" style={{ background: rowBg(r) }}>
                {columns.map((c) => (
                  <td key={c.key} className="py-1.5 px-2 t-primary whitespace-nowrap">
                    {c.render ? c.render(r) : (r as any)[c.key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length} className="py-8 text-center t-muted">Sin datos</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-2 justify-center">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-1 text-xs rounded border border-cyan-500/20 t-secondary disabled:opacity-30">Anterior</button>
          <span className="text-xs t-muted">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 text-xs rounded border border-cyan-500/20 t-secondary disabled:opacity-30">Siguiente</button>
        </div>
      )}
    </div>
  );
}

/* ───────── MAIN COMPONENT ───────── */
type MesOps = "abril" | "mayo";
const MES_LABEL: Record<MesOps, string> = { abril: "Abril 2026", mayo: "Mayo 2026" };

export default function OperationsDashboard({ country }: { country: "py" | "ar" }) {
  const [rows, setRows] = useState<GuideRow[]>([]);
  const [prevRows, setPrevRows] = useState<GuideRow[]>([]);
  // operational_snapshots: data agregada del área Comercial (by_dropshipper, by_proveedor para per-entity)
  const [opCurr, setOpCurr] = useState<any>(null);
  const [opPrev, setOpPrev] = useState<any>(null);
  // daily_tracking: seguimiento diario manual (acumulado mes) → fuente de "ingresadas total"
  const [dailyCurr, setDailyCurr] = useState<{ fecha: number; ordenes: number; dia_semana: string }[]>([]);
  const [dailyPrev, setDailyPrev] = useState<{ fecha: number; ordenes: number; dia_semana: string }[]>([]);
  const [serverUploadHistory, setServerUploadHistory] = useState<{ name: string; count: number }[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Filtro de rango de fechas para Resumen / Mov DS / Mov Prov (sobre fecha_orden)
  const [dateMode, setDateMode] = useState<"all" | "range">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showComparison, setShowComparison] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [error, setError] = useState("");
  const [fComercial, setFComercial] = useState("");
  const [fTransportadora, setFTransportadora] = useState("");
  const [fDropshipper, setFDropshipper] = useState("");
  const [fProveedor, setFProveedor] = useState("");
  // Mes activo (default según fecha actual: si estamos en mayo o después → mayo)
  const [mes, setMes] = useState<MesOps>(() => {
    const now = new Date();
    return now.getFullYear() === 2026 && now.getMonth() >= 4 ? "mayo" : "abril";
  });

  const mapRow = useCallback((r: any): GuideRow => ({
    guia: r.guia || "",
    fecha: r.fecha_reporte || r.fecha_orden || "",
    dropshipper: r.dropshipper || "",
    dropshipper_id: r.dropshipper_id || "",
    dropshipper_email: r.dropshipper_email || "",
    dropshipper_celular: r.dropshipper_celular || "",
    nombre_tienda: r.tienda || "",
    proveedor_nombre: r.proveedor || "",
    transportadora: r.transportadora || "",
    estatus: unifyEstatus(r.estatus || "", country),
    fecha_procesamiento: r.fecha_procesamiento || "",
    fecha_ultimo_movimiento: r.fecha_ultimo_movimiento || "",
    hora_ultimo_movimiento: r.hora_ultimo_movimiento || "",
    ciudad_destino: r.ciudad_destino || "",
    departamento_destino: r.departamento_destino || "",
    nombre_cliente: r.cliente || "",
    telefono: r.telefono || "",
    novedad: r.novedad || "",
    concepto_ultimo_movimiento: r.concepto_ultimo_mov || "",
    comercial_asignado: r.comercial || "",
    total_orden: Number(r.valor_orden) || 0,
    ganancia_entregado: Number(r.ganancia_si_entregado) || 0,
    productos: r.producto || "",
    fecha_carga: r.fecha_carga || "",
    country: r.country || country,
  }), [country]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setRows([]);
    setPrevRows([]);
    setOpCurr(null);
    setOpPrev(null);
    setDailyCurr([]);
    setDailyPrev([]);
    setServerUploadHistory([]);
    const prevMes: MesOps = mes === "mayo" ? "abril" : "mayo";
    try {
      const [resCur, resPrev, resOpCur, resOpPrev, resDailyCur, resDailyPrev] = await Promise.all([
        fetch(`/api/data/operations?country=${country}&mes=${mes}`),
        fetch(`/api/data/operations?country=${country}&mes=${prevMes}`),
        fetch(`/api/data/operational?country=${country}&mes=${mes}`),
        fetch(`/api/data/operational?country=${country}&mes=${prevMes}`),
        fetch(`/api/data/daily-tracking?country=${country}&mes=${mes}`),
        fetch(`/api/data/daily-tracking?country=${country}&mes=${prevMes}`),
      ]);
      if (resOpCur.ok) { const d = await resOpCur.json(); setOpCurr(d?.data || null); }
      if (resOpPrev.ok) { const d = await resOpPrev.json(); setOpPrev(d?.data || null); }
      if (resDailyCur.ok) { const d = await resDailyCur.json(); setDailyCurr(Array.isArray(d?.days) ? d.days : []); }
      if (resDailyPrev.ok) { const d = await resDailyPrev.json(); setDailyPrev(Array.isArray(d?.days) ? d.days : []); }
      if (resPrev.ok) {
        const dataPrev = await resPrev.json();
        const rawPrev = Array.isArray(dataPrev) ? dataPrev : dataPrev.rows || [];
        setPrevRows(rawPrev.map(mapRow));
      }
      if (resCur.ok) {
        const data = await resCur.json();
        const rawRows = Array.isArray(data) ? data : data.rows || [];
        const hist = Array.isArray(data?.uploadHistory) ? data.uploadHistory : [];
        setServerUploadHistory(
          hist.map((h: any) => ({ name: String(h.fecha_carga || ""), count: Number(h.cnt) || 0 }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name)),
        );
        setRows(rawRows.map(mapRow));
      }
    } catch (e) {
      console.error("Error fetching operations:", e);
    } finally {
      setLoading(false);
    }
  }, [country, mes, mapRow]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const parsed = await parseExcel(file, country);
      if (parsed.length === 0) {
        setError("No se encontraron filas con datos en la hoja CARGA DIARIA.");
        setUploading(false);
        return;
      }
      // Map to API format
      const apiRows = parsed.map((r) => ({
        guia: r.guia,
        fecha_reporte: r.fecha,
        fecha_orden: r.fecha,
        dropshipper: r.dropshipper,
        dropshipper_id: r.dropshipper_id,
        dropshipper_email: r.dropshipper_email,
        dropshipper_celular: r.dropshipper_celular,
        tienda: r.nombre_tienda,
        proveedor: r.proveedor_nombre,
        proveedor_id: 0,
        transportadora: r.transportadora,
        // Mantener el estatus CRUDO en el upload (para preservar el archivo original).
        // La unificación se aplica al renderizar (fetchData).
        estatus: r.estatus,
        fecha_procesamiento: r.fecha_procesamiento,
        fecha_ultimo_movimiento: r.fecha_ultimo_movimiento,
        hora_ultimo_movimiento: r.hora_ultimo_movimiento,
        ciudad_destino: r.ciudad_destino,
        departamento_destino: r.departamento_destino,
        cliente: r.nombre_cliente,
        telefono: r.telefono,
        novedad: r.novedad,
        concepto_ultimo_mov: r.concepto_ultimo_movimiento,
        comercial: r.comercial_asignado,
        valor_orden: r.total_orden,
        ganancia_si_entregado: r.ganancia_entregado,
        producto: r.productos,
      }));

      // Batches de 1000 con concurrencia 3 (acelera ~3x sin saturar Vercel).
      const BATCH_SIZE = 1000;
      const CONCURRENCY = 3;
      const fc = todayStr();
      const batches: typeof apiRows[] = [];
      for (let i = 0; i < apiRows.length; i += BATCH_SIZE) {
        batches.push(apiRows.slice(i, i + BATCH_SIZE));
      }
      setUploadProgress(0);
      let done = 0;
      const uploadBatch = async (batch: typeof apiRows, idx: number) => {
        const res = await fetch("/api/data/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country, mes, fecha_carga: fc, rows: batch }),
        });
        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Error en lote ${idx + 1} (HTTP ${res.status})`);
          }
          if (res.status === 401 || res.status === 403 || res.redirected) {
            throw new Error("Sesión expirada. Volvé a iniciar sesión.");
          }
          throw new Error(`Error HTTP ${res.status} en lote ${idx + 1}`);
        }
        done += 1;
        setUploadProgress(Math.round((done / batches.length) * 100));
      };
      // Worker pool simple
      let cursor = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
        while (cursor < batches.length) {
          const idx = cursor++;
          await uploadBatch(batches[idx], idx);
        }
      });
      await Promise.all(workers);
      // Set parsed data immediately + refresh from API
      setRows((prev) => {
        const existingGuias = new Set(parsed.map((r) => `${r.guia}-${r.fecha_carga}`));
        const kept = prev.filter((r) => !existingGuias.has(`${r.guia}-${r.fecha_carga}`));
        return [...kept, ...parsed];
      });
      await fetchData();
    } catch (err: any) {
      console.error("Upload failed:", err);
      setError(err.message || "Error al procesar archivo");
      alert("Error: " + (err.message || "Error desconocido") + "\n\nAbrí la consola del navegador (F12) para más detalles.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [country, mes, fetchData]);

  /* ───── global filters ───── */
  const filterOptions = useMemo(() => {
    const comerciales = new Set<string>();
    const transportadoras = new Set<string>();
    const dropshippers = new Set<string>();
    const proveedores = new Set<string>();
    for (const r of rows) {
      if (r.comercial_asignado) comerciales.add(r.comercial_asignado);
      if (r.transportadora) transportadoras.add(r.transportadora);
      if (r.dropshipper) dropshippers.add(r.dropshipper);
      if (r.proveedor_nombre) proveedores.add(r.proveedor_nombre);
    }
    return {
      comerciales: Array.from(comerciales).sort(),
      transportadoras: Array.from(transportadoras).sort(),
      dropshippers: Array.from(dropshippers).sort(),
      proveedores: Array.from(proveedores).sort(),
    };
  }, [rows]);

  // Dedupe por guia: cada guía aparece varias veces (1 fila por upload diario).
  // Nos quedamos solo con la versión más reciente (fecha_carga máxima).
  const dedupedRows = useMemo(() => {
    const guiaMap = new Map<string, typeof rows[0]>();
    for (const r of rows) {
      const existing = guiaMap.get(r.guia);
      if (!existing || r.fecha_carga > existing.fecha_carga) {
        guiaMap.set(r.guia, r);
      }
    }
    return Array.from(guiaMap.values());
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = dedupedRows;
    if (fComercial) result = result.filter((r) => r.comercial_asignado === fComercial);
    if (fTransportadora) result = result.filter((r) => r.transportadora === fTransportadora);
    if (fDropshipper) result = result.filter((r) => r.dropshipper === fDropshipper);
    if (fProveedor) result = result.filter((r) => r.proveedor_nombre === fProveedor);
    return result;
  }, [dedupedRows, fComercial, fTransportadora, fDropshipper, fProveedor]);

  // Mismo dedup + filtros aplicados al mes anterior (para comparación)
  const prevDedupedRows = useMemo(() => {
    const guiaMap = new Map<string, typeof prevRows[0]>();
    for (const r of prevRows) {
      const existing = guiaMap.get(r.guia);
      if (!existing || r.fecha_carga > existing.fecha_carga) guiaMap.set(r.guia, r);
    }
    return Array.from(guiaMap.values());
  }, [prevRows]);

  const prevFilteredRows = useMemo(() => {
    let result = prevDedupedRows;
    if (fComercial) result = result.filter((r) => r.comercial_asignado === fComercial);
    if (fTransportadora) result = result.filter((r) => r.transportadora === fTransportadora);
    if (fDropshipper) result = result.filter((r) => r.dropshipper === fDropshipper);
    if (fProveedor) result = result.filter((r) => r.proveedor_nombre === fProveedor);
    return result;
  }, [prevDedupedRows, fComercial, fTransportadora, fDropshipper, fProveedor]);

  const prevMes: MesOps = mes === "mayo" ? "abril" : "mayo";

  // Rango "espejo" para mes anterior: mismos días pero en el mes anterior
  // (ej. dateFrom=2026-05-01 → prevDateFrom=2026-04-01).
  const prevDateFrom = useMemo(() => shiftDateToMes(dateFrom, prevMes), [dateFrom, prevMes]);
  const prevDateTo = useMemo(() => shiftDateToMes(dateTo, prevMes), [dateTo, prevMes]);

  // Filtra por fecha de orden (en operations_data viene como DD/MM/YYYY,
  // los inputs HTML date entregan YYYY-MM-DD → normalizamos a ISO ambos).
  const applyDateRange = useCallback((arr: GuideRow[], from: string, to: string) => {
    if (dateMode !== "range") return arr;
    if (!from && !to) return arr;
    return arr.filter((r) => {
      const iso = toIsoDate(r.fecha);
      if (!iso) return false;
      if (from && iso < from) return false;
      if (to && iso > to) return false;
      return true;
    });
  }, [dateMode]);

  const rangedRows = useMemo(() => applyDateRange(filteredRows, dateFrom, dateTo), [filteredRows, applyDateRange, dateFrom, dateTo]);
  const prevRangedRows = useMemo(() => applyDateRange(prevFilteredRows, prevDateFrom, prevDateTo), [prevFilteredRows, applyDateRange, prevDateFrom, prevDateTo]);

  const hasAnyFilter = fComercial || fTransportadora || fDropshipper || fProveedor;
  const clearFilters = () => { setFComercial(""); setFTransportadora(""); setFDropshipper(""); setFProveedor(""); };

  /* ───── derived data ───── */
  // El historial llega agregado desde el servidor (no descargamos las cientos
  // de miles de filas históricas). `rows` solo contiene la última fecha_carga.
  const uploadHistory = serverUploadHistory;
  const fechasCarga = useMemo(() => uploadHistory.map((h) => h.name), [uploadHistory]);
  const latestFechaCarga = fechasCarga[fechasCarga.length - 1] || "";
  const totalFilasHistoricas = useMemo(
    () => uploadHistory.reduce((sum, h) => sum + h.count, 0),
    [uploadHistory],
  );

  // Total de ingresadas viene del SEGUIMIENTO DIARIO (daily_tracking).
  // El per-entity (DS/Proveedor) sigue viniendo del snapshot Comercial porque
  // daily_tracking no tiene desglose por DS/Proveedor.
  const currIngresadas = useMemo(
    () => ingresadasInRange(dailyCurr, dateMode, dateFrom, dateTo),
    [dailyCurr, dateMode, dateFrom, dateTo],
  );
  const prevIngresadas = useMemo(
    () => ingresadasInRange(dailyPrev, dateMode, prevDateFrom, prevDateTo),
    [dailyPrev, dateMode, prevDateFrom, prevDateTo],
  );
  const ingByDsCurr = useMemo(
    () => ingresadasByEntity(opCurr, "ds", dateMode, dateFrom, dateTo),
    [opCurr, dateMode, dateFrom, dateTo],
  );
  const ingByDsPrev = useMemo(
    () => ingresadasByEntity(opPrev, "ds", dateMode, prevDateFrom, prevDateTo),
    [opPrev, dateMode, prevDateFrom, prevDateTo],
  );
  const ingByProvCurr = useMemo(
    () => ingresadasByEntity(opCurr, "prov", dateMode, dateFrom, dateTo),
    [opCurr, dateMode, dateFrom, dateTo],
  );
  const ingByProvPrev = useMemo(
    () => ingresadasByEntity(opPrev, "prov", dateMode, prevDateFrom, prevDateTo),
    [opPrev, dateMode, prevDateFrom, prevDateTo],
  );

  // Métricas de movilización del mes activo y del mes anterior
  const movMetrics = useMemo(
    () => computeMovMetrics(rangedRows, country, currIngresadas || undefined),
    [rangedRows, country, currIngresadas],
  );
  const prevMovMetrics = useMemo(
    () => computeMovMetrics(prevRangedRows, country, prevIngresadas || undefined),
    [prevRangedRows, country, prevIngresadas],
  );

  // Status counts
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRows) map[r.estatus] = (map[r.estatus] || 0) + 1;
    return map;
  }, [filteredRows]);

  // Transport-specific filters
  const SG = useMemo(() => getStatusGroups(country), [country]);
  const aexRows = useMemo(() => filteredRows.filter((r) => r.transportadora === "AEX" && SG.mov_aex.includes(r.estatus)), [filteredRows, SG]);
  const fixyRows = useMemo(() => filteredRows.filter((r) => r.transportadora === "FIXY" && SG.mov_fixy.includes(r.estatus)), [filteredRows, SG]);
  const fixyNdRows = useMemo(() => filteredRows.filter((r) => r.transportadora === "FIXY-NEXTDAY" && SG.mov_fixy.includes(r.estatus)), [filteredRows, SG]);
  const urbanoRows = useMemo(() => filteredRows.filter((r) => r.transportadora === "URBANO" && SG.mov_fixy.includes(r.estatus)), [filteredRows, SG]);
  const noEntregadas = useMemo(() => filteredRows.filter((r) => r.estatus === "NO ENTREGADA"), [filteredRows]);
  const novedades = useMemo(() => filteredRows.filter((r) => r.estatus === "NOVEDAD"), [filteredRows]);
  const movProv = useMemo(() => filteredRows.filter((r) => SG.mov_proveedor.includes(r.estatus)), [filteredRows, SG]);
  const movDs = useMemo(() => filteredRows.filter((r) => SG.mov_dropshipper.includes(r.estatus)), [filteredRows, SG]);
  const canceladas = useMemo(() => filteredRows.filter((r) => SG.cancelacion.includes(r.estatus)), [filteredRows, SG]);

  // Paradas +72hs: guides in transport states where FECHA EN PROCESAMIENTO > 72hs ago
  const paradasRows = useMemo(() => {
    // Use latest upload, deduplicate by guia (keep latest fecha_carga)
    const guiaMap = new Map<string, typeof filteredRows[0]>();
    for (const r of filteredRows) {
      const existing = guiaMap.get(r.guia);
      if (!existing || r.fecha_carga > existing.fecha_carga) {
        guiaMap.set(r.guia, r);
      }
    }
    const latest = Array.from(guiaMap.values());
    const inTransit = latest.filter(
      (r) => SG.mov_aex.includes(r.estatus) || SG.mov_fixy.includes(r.estatus)
    );
    return inTransit
      .filter((r) => hoursFromProcessing(r.fecha_procesamiento) > 72)
      .map((r) => {
        const horas = hoursFromProcessing(r.fecha_procesamiento);
        const diasDesdeProc = Math.floor(horas / 24);
        return { ...r, diasSinCambio: diasDesdeProc, horasTransporte: horas };
      })
      .sort((a, b) => b.horasTransporte - a.horasTransporte);
  }, [filteredRows]);

  // Alert counts
  const alertCounts = useMemo(() => {
    const aexAll = filteredRows.filter((r) => r.transportadora === "AEX" && SG.mov_aex.includes(r.estatus));
    const fixyAll = filteredRows.filter((r) =>
      (r.transportadora === "FIXY" || r.transportadora === "FIXY-NEXTDAY") && SG.mov_fixy.includes(r.estatus)
    );
    const urbanoAll = filteredRows.filter((r) => r.transportadora === "URBANO" && SG.mov_fixy.includes(r.estatus));
    const h = (arr: GuideRow[], min: number, max?: number) =>
      arr.filter((r) => {
        const hrs = hoursFromProcessing(r.fecha_procesamiento);
        return hrs > min && (max ? hrs <= max : true);
      }).length;
    return {
      aex72: h(aexAll, 72, 120),
      aex120: h(aexAll, 120),
      fixy72: h(fixyAll, 72, 120),
      fixy120: h(fixyAll, 120),
      urbano72: h(urbanoAll, 72, 120),
      urbano120: h(urbanoAll, 120),
    };
  }, [filteredRows, SG]);

  // ─── Métricas operacionales (según DOCUMENTO_MAESTRO_Sistema_Dashboards_Argentina)
  // Mide performance de transportadoras: tasa entrega, devoluciones, tiempos, etc.
  const opMetrics = useMemo(() => {
    // Parsea fecha en formato DD/MM/YYYY o YYYY-MM-DD con hora opcional
    const parseFecha = (s: string): number | null => {
      if (!s) return null;
      const str = s.trim();
      // DD/MM/YYYY HH:MM
      const m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(str);
      if (m1) {
        const [, d, mo, y, h = "0", min = "0"] = m1;
        return new Date(+y, +mo - 1, +d, +h, +min).getTime();
      }
      // YYYY-MM-DD HH:MM
      const m2 = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(str);
      if (m2) {
        const [, y, mo, d, h = "0", min = "0"] = m2;
        return new Date(+y, +mo - 1, +d, +h, +min).getTime();
      }
      return null;
    };

    const compute = (rows: GuideRow[]) => {
      // "Recibidos": ya pasaron por la transportadora (no pendiente DS/proveedor, no cancelado)
      const recibidos = rows.filter((r) =>
        !SG.mov_dropshipper.includes(r.estatus) &&
        !SG.mov_proveedor.includes(r.estatus) &&
        !SG.cancelacion.includes(r.estatus)
      );
      const entregadas = rows.filter((r) => r.estatus === "ENTREGADO");
      const devoluciones = rows.filter((r) =>
        r.estatus === "DEVOLUCION" || r.estatus === "EN PROCESO DE DEVOLUCION"
      );
      const novedades = rows.filter((r) => r.estatus === "NOVEDAD");
      const enTransito = rows.filter((r) => SG.mov_fixy.includes(r.estatus));

      // Tiempo de entrega = fecha_ultimo_movimiento − fecha_procesamiento (en horas)
      const tiempos = entregadas
        .map((r) => {
          const proc = parseFecha(r.fecha_procesamiento);
          const ult = parseFecha(r.fecha_ultimo_movimiento);
          if (!proc || !ult) return null;
          const h = (ult - proc) / (1000 * 60 * 60);
          return h > 0 && h < 24 * 60 ? h : null; // cap a 60 días
        })
        .filter((t): t is number => t !== null);

      const tiempoProm = tiempos.length > 0 ? tiempos.reduce((s, t) => s + t, 0) / tiempos.length : 0;
      const entregadasEn72 = tiempos.filter((t) => t <= 72).length;
      const pctEn72 = tiempos.length > 0 ? (entregadasEn72 / tiempos.length) * 100 : 0;

      // Críticos +72hs: en tránsito con +72hs desde procesamiento sin moverse
      const criticos72 = enTransito.filter((r) => hoursFromProcessing(r.fecha_procesamiento) > 72).length;
      const criticos120 = enTransito.filter((r) => hoursFromProcessing(r.fecha_procesamiento) > 120).length;

      return {
        recibidos: recibidos.length,
        entregadas: entregadas.length,
        devoluciones: devoluciones.length,
        novedades: novedades.length,
        enTransito: enTransito.length,
        tasaEntrega: recibidos.length > 0 ? (entregadas.length / recibidos.length) * 100 : 0,
        tasaDevolucion: recibidos.length > 0 ? (devoluciones.length / recibidos.length) * 100 : 0,
        tasaNovedades: recibidos.length > 0 ? (novedades.length / recibidos.length) * 100 : 0,
        tiempoProm,
        pctEn72,
        criticos72,
        criticos120,
        tiemposCount: tiempos.length,
      };
    };

    const total = compute(filteredRows);
    const trans1Rows = filteredRows.filter((r) => r.transportadora === (country === "ar" ? "FIXY" : "AEX"));
    const trans2Rows = filteredRows.filter((r) => country === "ar"
      ? r.transportadora === "URBANO"
      : (r.transportadora === "FIXY" || r.transportadora === "FIXY-NEXTDAY"));
    const trans1 = compute(trans1Rows);
    const trans2 = compute(trans2Rows);
    return { total, trans1, trans2 };
  }, [filteredRows, SG, country]);

  // KPI summary counts
  const kpis = useMemo(() => {
    const entregadas = filteredRows.filter((r) => r.estatus === "ENTREGADO").length;
    const devolucion = filteredRows.filter((r) => r.estatus === "DEVOLUCION").length;
    return {
      total: filteredRows.length,
      aexTransito: aexRows.length,
      fixyTransito: fixyRows.length,
      fixyNdTransito: fixyNdRows.length,
      noEntregadas: noEntregadas.length,
      novedades: novedades.length,
      devolucion,
      canceladas: canceladas.length,
      entregadas,
    };
  }, [filteredRows, aexRows, fixyRows, fixyNdRows, noEntregadas, novedades, canceladas]);

  /* ───── table column defs ───── */
  const transportColumns = [
    { key: "guia", label: "Guia" },
    { key: "fecha", label: "Fecha" },
    { key: "dropshipper", label: "Dropshipper" },
    { key: "dropshipper_id", label: "DS ID" },
    { key: "estatus", label: "Estado" },
    { key: "concepto_ultimo_movimiento", label: "Ultimo Movimiento" },
    { key: "ciudad_destino", label: "Ciudad" },
    { key: "departamento_destino", label: "Departamento" },
    { key: "novedad", label: "Novedad" },
    { key: "horas", label: "Horas Transporte", render: (r: GuideRow) => {
      const h = hoursFromProcessing(r.fecha_procesamiento);
      return <span style={{ color: semaforoColor(h), fontWeight: h >= 72 ? 700 : 400 }}>{h}h</span>;
    }},
  ];

  const fullColumns = [
    { key: "guia", label: "Guia" },
    { key: "fecha", label: "Fecha" },
    { key: "dropshipper", label: "Dropshipper" },
    { key: "dropshipper_id", label: "DS ID" },
    { key: "dropshipper_email", label: "DS Email" },
    { key: "proveedor_nombre", label: "Proveedor" },
    { key: "transportadora", label: "Transportadora" },
    { key: "estatus", label: "Estado" },
    { key: "ciudad_destino", label: "Ciudad" },
    { key: "departamento_destino", label: "Departamento" },
    { key: "nombre_cliente", label: "Cliente" },
    { key: "telefono", label: "Telefono" },
    { key: "novedad", label: "Novedad" },
    { key: "concepto_ultimo_movimiento", label: "Ultimo Mov." },
    { key: "total_orden", label: "Total Orden", render: (r: GuideRow) => r.total_orden ? `$${r.total_orden.toLocaleString()}` : "—" },
  ];

  // Semaforo colors for paradas
  function semaforoColor(horas: number): string {
    if (horas >= 240) return "#7f1d1d"; // rojo oscuro — 10+ días INDEMNIZACIÓN
    if (horas >= 168) return "#dc2626"; // rojo — 7+ días
    if (horas >= 120) return "#f97316"; // naranja — 5+ días
    if (horas >= 72) return "#facc15";  // amarillo — 3+ días
    return "#22c55e"; // verde — ok
  }
  function semaforoBg(_horas: number): string {
    return "transparent";
  }

  /* ───── status distribution chart data ───── */
  const statusChartData = useMemo(() =>
    Object.entries(byStatus)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    [byStatus]
  );

  /* ───── render helpers ───── */
  function renderStatusBreakdown(data: GuideRow[], label: string) {
    const breakdown = countBy(data, (r) => r.estatus);
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <KpiCard label={`Total ${label}`} value={data.length} color="orange" />
        {breakdown.map((b) => (
          <div key={b.name} className="rounded-xl p-2 border border-cyan-500/10" style={{ background: "var(--bg-card)" }}>
            <p className="text-[9px] t-muted uppercase truncate" title={b.name}>{b.name}</p>
            <p className="text-lg font-bold" style={{ color: STATUS_COLORS[b.name] || "#ea580c" }}>{b.count}</p>
          </div>
        ))}
      </div>
    );
  }

  /* ───── ParadasTab sub-component ───── */
  function ParadasTab({ rows: pRows }: { rows: any[] }) {
    const [fTransp, setFTransp] = useState("all");
    const [fCiudad, setFCiudad] = useState("all");
    const [fDias, setFDias] = useState("all");

    const transportadoras = useMemo(() => Array.from(new Set(pRows.map((r: any) => r.transportadora))).sort(), [pRows]);
    const ciudades = useMemo(() => Array.from(new Set(pRows.map((r: any) => r.ciudad_destino).filter(Boolean))).sort(), [pRows]);

    const filtered = useMemo(() => {
      let f = pRows;
      if (fTransp !== "all") f = f.filter((r: any) => r.transportadora === fTransp);
      if (fCiudad !== "all") f = f.filter((r: any) => r.ciudad_destino === fCiudad);
      if (fDias === "3-5") f = f.filter((r: any) => r.diasSinCambio >= 3 && r.diasSinCambio < 5);
      else if (fDias === "5-7") f = f.filter((r: any) => r.diasSinCambio >= 5 && r.diasSinCambio < 7);
      else if (fDias === "7-10") f = f.filter((r: any) => r.diasSinCambio >= 7 && r.diasSinCambio < 10);
      else if (fDias === "10+") f = f.filter((r: any) => r.diasSinCambio >= 10);
      else if (fDias === "7+") f = f.filter((r: any) => r.diasSinCambio >= 7);
      return f;
    }, [pRows, fTransp, fCiudad, fDias]);

    const indemnizacionRows = useMemo(() => pRows.filter((r: any) => r.diasSinCambio >= 10), [pRows]);

    return (
      <div className="space-y-4">
        {/* ALERTA INDEMNIZACIÓN */}
        {indemnizacionRows.length > 0 && (
          <div className="p-4 rounded-xl border-2 border-red-600 animate-pulse" style={{ background: "rgba(220,38,38,0.08)" }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚨</span>
              <div>
                <h3 className="text-base font-bold text-red-600">ALERTA INDEMNIZACIÓN — {indemnizacionRows.length} guía{indemnizacionRows.length > 1 ? "s" : ""}</h3>
                <p className="text-xs t-secondary">{indemnizacionRows.length} guía{indemnizacionRows.length > 1 ? "s llevan" : " lleva"} 10+ días en poder de la transportadora. Iniciar reclamo de indemnización.</p>
              </div>
              <button onClick={() => setFDias("10+")} className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 shrink-0">
                Ver guías
              </button>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <KpiCard label="Total Paradas +72hs" value={pRows.length} color="red" />
          <KpiCard label="🚨 Indemnización 10+" value={indemnizacionRows.length} color="red" sub="10+ días" />
          {countBy(pRows, (r: any) => r.transportadora).map((b: any) => (
            <KpiCard key={b.name} label={b.name} value={b.count} color="orange" sub="por transportadora" />
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-orange-500/20" style={{ background: "var(--bg-card-hover)" }}>
          <select value={fTransp} onChange={(e) => setFTransp(e.target.value)} className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/20 t-primary" style={{ background: "var(--bg-input)" }}>
            <option value="all">Todas las transportadoras</option>
            {transportadoras.map((t: string) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fCiudad} onChange={(e) => setFCiudad(e.target.value)} className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/20 t-primary" style={{ background: "var(--bg-input)" }}>
            <option value="all">Todas las ciudades</option>
            {ciudades.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fDias} onChange={(e) => setFDias(e.target.value)} className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/20 t-primary" style={{ background: "var(--bg-input)" }}>
            <option value="all">Todos los días</option>
            <option value="3-5">3-5 días (amarillo)</option>
            <option value="5-7">5-7 días (naranja)</option>
            <option value="7-10">7-10 días (rojo)</option>
            <option value="10+">🚨 10+ días (INDEMNIZACIÓN)</option>
            <option value="7+">7+ días (todos)</option>
          </select>
          {(fTransp !== "all" || fCiudad !== "all" || fDias !== "all") && (
            <button onClick={() => { setFTransp("all"); setFCiudad("all"); setFDias("all"); }} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10">Limpiar</button>
          )}
          <span className="text-xs t-secondary self-center">{filtered.length} guías</span>
          <DownloadBtn onClick={() => downloadCSV("Paradas_72hs", filtered, PARADAS_EXPORT_COLUMNS)} label={`Descargar (${filtered.length})`} />
        </div>

        {/* Semaforo legend */}
        <div className="flex flex-wrap gap-4 text-[10px] t-secondary">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#facc15" }} /> 3-5 días</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#f97316" }} /> 5-7 días</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#dc2626" }} /> 7-10 días</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ background: "#7f1d1d" }} /> 🚨 10+ días — INDEMNIZACIÓN</span>
        </div>

        {/* Table */}
        <div className="table-container overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
              <tr className="border-b border-orange-500/20">
                <th className="text-center py-2 px-2 text-gray-400">Alerta</th>
                <th className="text-left py-2 px-2 text-gray-400">Guía</th>
                <th className="text-left py-2 px-2 text-gray-400">Transportadora</th>
                <th className="text-left py-2 px-2 text-gray-400">Estado</th>
                <th className="text-left py-2 px-2 text-gray-400">Fecha Proc.</th>
                <th className="text-right py-2 px-2 text-gray-400">Horas</th>
                <th className="text-right py-2 px-2 text-gray-400">Días</th>
                <th className="text-left py-2 px-2 text-gray-400">Dropshipper</th>
                <th className="text-left py-2 px-2 text-gray-400">Ciudad</th>
                <th className="text-left py-2 px-2 text-gray-400">Departamento</th>
                <th className="text-left py-2 px-2 text-gray-400">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any, i: number) => {
                const h = r.horasTransporte || 0;
                const d = r.diasSinCambio || 0;
                const color = semaforoColor(h);
                return (
                  <tr key={`${r.guia}-${i}`} className="border-b border-gray-800/40">
                    <td className="py-2 px-2 text-center">
                      {d >= 10 ? <span className="text-sm" title="INDEMNIZACIÓN">🚨</span> : d >= 7 ? <span className="text-sm" title="Crítico">🔴</span> : d >= 5 ? <span className="text-sm" title="Alerta">🟠</span> : <span className="text-sm" title="Atención">🟡</span>}
                    </td>
                    <td className="py-2 px-2 t-primary font-medium">{r.guia}</td>
                    <td className="py-2 px-2 t-secondary">{r.transportadora}</td>
                    <td className="py-2 px-2"><span style={{ color: STATUS_COLORS[r.estatus] || "#6b7280" }}>{r.estatus}</span></td>
                    <td className="py-2 px-2 t-secondary">{r.fecha_procesamiento}</td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color }}>{h}h</td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color }}>{d} días</td>
                    <td className="py-2 px-2 t-secondary truncate max-w-[150px]">{r.dropshipper}</td>
                    <td className="py-2 px-2 t-secondary">{r.ciudad_destino}</td>
                    <td className="py-2 px-2 t-secondary">{r.departamento_destino}</td>
                    <td className="py-2 px-2 t-secondary">{r.telefono}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ───── NO DATA STATE ───── */
  if (loading) {
    return (
      <div className="glass-card p-6 border-cyan-500/30">
        <p className="t-secondary text-sm animate-pulse">Cargando datos operacionales...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card p-6 border-cyan-500/30">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-bold t-primary mb-1">📋 Dashboard Operacional — {country === "py" ? "Paraguay" : "Argentina"}</h2>
            <p className="text-xs t-secondary">Mes activo: <strong className="t-primary">{MES_LABEL[mes]}</strong> · Subi el archivo Excel de Dropi (hoja CARGA DIARIA) para comenzar</p>
          </div>
          <MesSwitcher mes={mes} setMes={setMes} />
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg dropi-gradient text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity">
          {uploading ? `Procesando... ${uploadProgress}%` : `📥 Subir archivo Excel (${MES_LABEL[mes]})`}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  /* ───── MAIN RENDER ───── */
  return (
    <div className="glass-card p-6 border-cyan-500/30 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold t-primary mb-1">📋 Dashboard Operacional — {country === "py" ? "Paraguay" : "Argentina"} · {MES_LABEL[mes]}</h2>
          <p className="text-xs t-secondary">
            {dedupedRows.length.toLocaleString()} guias en último día ({totalFilasHistoricas.toLocaleString()} filas históricas) | Ultima carga: {latestFechaCarga} | {fechasCarga.length} día(s) acumulados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MesSwitcher mes={mes} setMes={setMes} />
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg dropi-gradient text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity">
            {uploading ? `Procesando... ${uploadProgress}%` : `📥 Actualizar ${MES_LABEL[mes]}`}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Global filters */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg" style={{ background: "var(--bg-page)" }}>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] t-muted uppercase tracking-wider">Usuario</label>
          <select value={fComercial} onChange={(e) => setFComercial(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary focus:border-orange-500 outline-none min-w-[140px]">
            <option value="">Todos</option>
            {filterOptions.comerciales.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] t-muted uppercase tracking-wider">Logistica</label>
          <select value={fTransportadora} onChange={(e) => setFTransportadora(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary focus:border-orange-500 outline-none min-w-[140px]">
            <option value="">Todas</option>
            {filterOptions.transportadoras.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] t-muted uppercase tracking-wider">Dropshipper</label>
          <select value={fDropshipper} onChange={(e) => setFDropshipper(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary focus:border-orange-500 outline-none min-w-[140px]">
            <option value="">Todos</option>
            {filterOptions.dropshippers.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] t-muted uppercase tracking-wider">Proveedor</label>
          <select value={fProveedor} onChange={(e) => setFProveedor(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary focus:border-orange-500 outline-none min-w-[140px]">
            <option value="">Todos</option>
            {filterOptions.proveedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {hasAnyFilter && (
          <button onClick={clearFilters} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
            Limpiar filtros
          </button>
        )}
        {hasAnyFilter && (
          <span className="text-[11px] t-muted ml-auto">
            Mostrando {filteredRows.length.toLocaleString()} de {rows.length.toLocaleString()} guias
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-0 border-b border-cyan-500/20 -mx-6 px-6 overflow-x-auto">
        {getTabs(country).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? "border-orange-500 text-orange-400"
                : "border-transparent t-muted hover:t-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN TAB ── */}
      {tab === "resumen" && (
        <div className="space-y-4">
          <DateRangeBar
            dateMode={dateMode} setDateMode={setDateMode}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            showComparison={showComparison} setShowComparison={setShowComparison}
            prevMesLabel={MES_LABEL[prevMes]}
            prevDateFrom={prevDateFrom} prevDateTo={prevDateTo}
          />
          {dailyCurr.length === 0 && (
            <div className="rounded-lg p-3 border border-amber-500/30 text-xs text-amber-300" style={{ background: "rgba(245,158,11,0.08)" }}>
              ⚠️ No hay Seguimiento Diario cargado para {MES_LABEL[mes]}. El % de Movilización usa la planilla de Operaciones como base hasta que cargues los días en Seguimiento Diario.
            </div>
          )}
          {!opCurr && (
            <div className="rounded-lg p-3 border border-amber-500/30 text-[11px] text-amber-300" style={{ background: "rgba(245,158,11,0.05)" }}>
              ⓘ Subí el snapshot Comercial (Dashboard Comercial) para que los rankings por Dropshipper y Proveedor muestren las ingresadas reales por entidad.
            </div>
          )}
          <MovSummarySection
            metrics={movMetrics}
            prevMetrics={prevMovMetrics}
            mesLabel={MES_LABEL[mes]}
            prevMesLabel={MES_LABEL[prevMes]}
            showComparison={showComparison}
          />
          <LogisticsBreakdown
            rows={rangedRows}
            prevRows={prevRangedRows}
            country={country}
            showComparison={showComparison}
            prevMesLabel={MES_LABEL[prevMes]}
          />
          <DownloadBtn onClick={() => downloadCSV("Resumen_Completo", filteredRows, EXPORT_COLUMNS)} label={`Descargar todo (${filteredRows.length} guías)`} />
          {/* KPI cards — distintas por país */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <KpiCard label="Guías únicas" value={kpis.total.toLocaleString()} color="orange" />
            {country === "ar" ? (
              <>
                <KpiCard label="FIXY en transito" value={kpis.fixyTransito} color="blue" />
                <KpiCard label="URBANO en transito" value={urbanoRows.length} color="blue" />
              </>
            ) : (
              <>
                <KpiCard label="AEX en transito" value={kpis.aexTransito} color="blue" />
                <KpiCard label="FIXY en transito" value={kpis.fixyTransito} color="blue" />
                <KpiCard label="FIXY-ND en transito" value={kpis.fixyNdTransito} color="blue" />
              </>
            )}
            <KpiCard label="No entregadas" value={kpis.noEntregadas} color="red" />
            <KpiCard label="Novedades" value={kpis.novedades} color="orange" />
            <KpiCard label="Devolucion" value={kpis.devolucion} color="red" />
            <KpiCard label="Canceladas" value={kpis.canceladas} color="red" />
            <KpiCard label="Entregadas" value={kpis.entregadas} color="green" />
          </div>

          {/* Alert cards — distintas por país */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {country === "ar" ? (
              <>
                <AlertCard label="FIXY +72hs" value={alertCounts.fixy72} level="warn" />
                <AlertCard label="FIXY +120hs (critico)" value={alertCounts.fixy120} level="crit" />
                <AlertCard label="URBANO +72hs" value={alertCounts.urbano72} level="warn" />
                <AlertCard label="URBANO +120hs (critico)" value={alertCounts.urbano120} level="crit" />
              </>
            ) : (
              <>
                <AlertCard label="AEX +72hs" value={alertCounts.aex72} level="warn" />
                <AlertCard label="AEX +120hs (critico)" value={alertCounts.aex120} level="crit" />
                <AlertCard label="FIXY +72hs" value={alertCounts.fixy72} level="warn" />
                <AlertCard label="FIXY +120hs (critico)" value={alertCounts.fixy120} level="crit" />
              </>
            )}
          </div>

          {/* Métricas Operacionales (DOCUMENTO_MAESTRO) */}
          <OpMetricsSection
            country={country}
            metrics={opMetrics}
          />

          {/* Status distribution */}
          <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-sm font-bold t-primary mb-3">Distribucion por Estado</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([s, c]) => {
                const pct = ((c / rows.length) * 100).toFixed(1);
                return (
                  <div key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-200" style={{ background: "var(--bg-card)" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s] || "#6b7280" }} />
                    <div>
                      <p className="text-[10px] t-primary font-medium truncate" title={s}>{s}</p>
                      <div className="flex gap-1 items-baseline">
                        <p className="text-xs font-bold" style={{ color: STATUS_COLORS[s] || "#6b7280" }}>{c}</p>
                        <p className="text-[9px] t-muted">{pct}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {statusChartData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} layout="vertical" margin={{ left: 120, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={TICK_STYLE} />
                    <YAxis type="category" dataKey="name" tick={TICK_STYLE} width={110} />
                    <Tooltip contentStyle={{ background: "rgba(22,33,62,0.95)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] || BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Upload history */}
          <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-sm font-bold t-primary mb-3">Historial de cargas diarias</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {uploadHistory.map((h) => (
                <div key={h.name} className="rounded-lg p-2 border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
                  <p className="text-[10px] t-muted">{h.name}</p>
                  <p className="text-sm font-bold" style={{ color: "#ea580c" }}>{h.count} filas</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── AEX TAB ── */}
      {tab === "aex" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            {renderStatusBreakdown(aexRows, "AEX")}
          </div>
          <DownloadBtn onClick={() => downloadCSV("AEX", aexRows, EXPORT_COLUMNS)} label={`Descargar AEX (${aexRows.length})`} />
          <DataTable rows={aexRows} columns={transportColumns} highlightHours />
        </div>
      )}

      {/* ── FIXY TAB ── */}
      {tab === "fixy" && (
        <div className="space-y-4">
          {renderStatusBreakdown(fixyRows, "FIXY")}
          <DownloadBtn onClick={() => downloadCSV("FIXY", fixyRows, EXPORT_COLUMNS)} label={`Descargar FIXY (${fixyRows.length})`} />
          <DataTable rows={fixyRows} columns={transportColumns} highlightHours />
        </div>
      )}

      {/* ── FIXY NEXT DAY TAB ── */}
      {tab === "fixy_nd" && (
        <div className="space-y-4">
          {renderStatusBreakdown(fixyNdRows, "FIXY-NEXTDAY")}
          <DownloadBtn onClick={() => downloadCSV("FIXY_NextDay", fixyNdRows, EXPORT_COLUMNS)} label={`Descargar FIXY-ND (${fixyNdRows.length})`} />
          <DataTable rows={fixyNdRows} columns={transportColumns} highlightHours />
        </div>
      )}

      {/* ── URBANO TAB (Argentina) ── */}
      {tab === "urbano" && (
        <div className="space-y-4">
          {renderStatusBreakdown(urbanoRows, "URBANO")}
          <DownloadBtn onClick={() => downloadCSV("URBANO", urbanoRows, EXPORT_COLUMNS)} label={`Descargar URBANO (${urbanoRows.length})`} />
          <DataTable rows={urbanoRows} columns={transportColumns} highlightHours />
        </div>
      )}

      {/* ── NO ENTREGADAS TAB ── */}
      {tab === "no_entregadas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <KpiCard label="Total No Entregadas" value={noEntregadas.length} color="red" />
            {countBy(noEntregadas, (r) => r.departamento_destino).slice(0, 3).map((b) => (
              <KpiCard key={b.name} label={b.name || "Sin depto"} value={b.count} color="orange" sub="por departamento" />
            ))}
            {countBy(noEntregadas, (r) => r.dropshipper).slice(0, 3).map((b) => (
              <KpiCard key={b.name} label={b.name || "Sin DS"} value={b.count} color="blue" sub="por dropshipper" />
            ))}
          </div>
          <DownloadBtn onClick={() => downloadCSV("No_Entregadas", noEntregadas, EXPORT_COLUMNS)} label={`Descargar No Entregadas (${noEntregadas.length})`} />
          <DataTable rows={noEntregadas} columns={fullColumns} />
        </div>
      )}

      {/* ── NOVEDADES TAB ── */}
      {tab === "novedades" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <KpiCard label="Total Novedades" value={novedades.length} color="orange" />
            {countBy(novedades, (r) => r.transportadora).map((b) => (
              <KpiCard key={b.name} label={b.name || "Sin transp."} value={b.count} color="blue" sub="por transportadora" />
            ))}
          </div>
          <DownloadBtn onClick={() => downloadCSV("Novedades", novedades, EXPORT_COLUMNS)} label={`Descargar Novedades (${novedades.length})`} />
          <DataTable rows={novedades} columns={fullColumns} />
        </div>
      )}

      {/* ── MOV PROVEEDOR TAB ── */}
      {tab === "mov_prov" && (
        <div className="space-y-4">
          <DateRangeBar
            dateMode={dateMode} setDateMode={setDateMode}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            showComparison={showComparison} setShowComparison={setShowComparison}
            prevMesLabel={MES_LABEL[prevMes]}
            prevDateFrom={prevDateFrom} prevDateTo={prevDateTo}
          />
          <MovEntityRanking
            rows={rangedRows}
            prevRows={prevRangedRows}
            country={country}
            entityKey="proveedor_nombre"
            level="prov"
            title={`📦 Movilización por Proveedor — ${MES_LABEL[mes]}`}
            showComparison={showComparison}
            prevMesLabel={MES_LABEL[prevMes]}
            ingCurr={ingByProvCurr}
            ingPrev={ingByProvPrev}
          />
          {/* Detalle: guías que el Proveedor todavía no despachó */}
          <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-sm font-bold t-primary mb-3">📋 Guías pendientes de despachar por Proveedor ({movProv.length})</h3>
            <DownloadBtn onClick={() => downloadCSV("Mov_Proveedor", movProv, EXPORT_COLUMNS)} label={`Descargar pendientes (${movProv.length})`} />
            {Object.entries(groupBy(movProv, (r) => r.proveedor_nombre)).sort((a, b) => b[1].length - a[1].length).map(([prov, provRows]) => (
              <div key={prov}>
                <h4 className="text-xs font-bold t-primary mb-2 mt-3">{prov} ({provRows.length})</h4>
                <DataTable rows={provRows} columns={[
                  { key: "guia", label: "Guia" },
                  { key: "fecha", label: "Fecha" },
                  { key: "estatus", label: "Estado" },
                  { key: "dropshipper", label: "Dropshipper" },
                  { key: "transportadora", label: "Transportadora" },
                  { key: "productos", label: "Productos" },
                ]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MOV DROPSHIPPER TAB ── */}
      {tab === "mov_ds" && (
        <div className="space-y-4">
          <DateRangeBar
            dateMode={dateMode} setDateMode={setDateMode}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            showComparison={showComparison} setShowComparison={setShowComparison}
            prevMesLabel={MES_LABEL[prevMes]}
            prevDateFrom={prevDateFrom} prevDateTo={prevDateTo}
          />
          <MovEntityRanking
            rows={rangedRows}
            prevRows={prevRangedRows}
            country={country}
            entityKey="dropshipper"
            level="ds"
            title={`👤 Movilización por Dropshipper — ${MES_LABEL[mes]}`}
            showComparison={showComparison}
            prevMesLabel={MES_LABEL[prevMes]}
            ingCurr={ingByDsCurr}
            ingPrev={ingByDsPrev}
          />
          {/* Detalle: guías que el DS todavía no confirmó */}
          <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
            <h3 className="text-sm font-bold t-primary mb-3">📋 Guías pendientes de confirmar por DS ({movDs.length})</h3>
            <DownloadBtn onClick={() => downloadCSV("Mov_Dropshipper", movDs, EXPORT_COLUMNS)} label={`Descargar pendientes (${movDs.length})`} />
            {Object.entries(groupBy(movDs, (r) => r.dropshipper)).sort((a, b) => b[1].length - a[1].length).map(([ds, dsRows]) => (
              <div key={ds}>
                <h4 className="text-xs font-bold t-primary mb-2 mt-3">{ds} ({dsRows.length})</h4>
                <DataTable rows={dsRows} columns={[
                  { key: "guia", label: "Guia" },
                  { key: "fecha", label: "Fecha" },
                  { key: "estatus", label: "Estado" },
                  { key: "proveedor_nombre", label: "Proveedor" },
                  { key: "nombre_tienda", label: "Tienda" },
                  { key: "productos", label: "Productos" },
                ]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CANCELADAS TAB ── */}
      {tab === "canceladas" && (
        <div className="space-y-4">
          {renderStatusBreakdown(canceladas, "Canceladas")}
          <DownloadBtn onClick={() => downloadCSV("Canceladas", canceladas, EXPORT_COLUMNS)} label={`Descargar Canceladas (${canceladas.length})`} />
          <DataTable rows={canceladas} columns={fullColumns} />
        </div>
      )}

      {/* ── PARADAS +72hs TAB ── */}
      {tab === "paradas" && <ParadasTab rows={paradasRows} />}
    </div>
  );
}

/* ───────── MES SWITCHER ───────── */
function MesSwitcher({ mes, setMes }: { mes: MesOps; setMes: (m: MesOps) => void }) {
  const opts: { key: MesOps; label: string }[] = [
    { key: "abril", label: "Abril 2026" },
    { key: "mayo", label: "Mayo 2026" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-cyan-500/30 overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => setMes(o.key)}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            mes === o.key
              ? "bg-orange-500 text-white"
              : "bg-transparent t-secondary hover:bg-orange-500/10"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── OP METRICS SECTION ───────── */
type MetricBlock = {
  recibidos: number;
  entregadas: number;
  devoluciones: number;
  novedades: number;
  enTransito: number;
  tasaEntrega: number;
  tasaDevolucion: number;
  tasaNovedades: number;
  tiempoProm: number;
  pctEn72: number;
  criticos72: number;
  criticos120: number;
  tiemposCount: number;
};

function OpMetricsSection({ country, metrics }: { country: "py" | "ar"; metrics: { total: MetricBlock; trans1: MetricBlock; trans2: MetricBlock } }) {
  const trans1Label = country === "ar" ? "FIXY" : "AEX";
  const trans2Label = country === "ar" ? "URBANO" : "FIXY / FIXY-ND";

  // Semáforo basado en umbrales del documento maestro
  const colorFor = (metric: "entrega" | "devol" | "tiempo" | "en72" | "novedades" | "criticos", value: number): string => {
    switch (metric) {
      case "entrega":
        if (value >= 95) return "#10B981"; if (value >= 85) return "#F59E0B"; return "#EF4444";
      case "devol":
        if (value < 5) return "#10B981"; if (value < 10) return "#F59E0B"; return "#EF4444";
      case "tiempo":
        if (value < 48) return "#10B981"; if (value < 72) return "#F59E0B"; return "#EF4444";
      case "en72":
        if (value >= 90) return "#10B981"; if (value >= 70) return "#F59E0B"; return "#EF4444";
      case "novedades":
        if (value < 10) return "#10B981"; if (value < 15) return "#F59E0B"; return "#EF4444";
      case "criticos":
        if (value === 0) return "#10B981"; if (value <= 10) return "#F59E0B"; return "#EF4444";
    }
  };

  const metricRow = (label: string, key: keyof MetricBlock, type: "entrega" | "devol" | "tiempo" | "en72" | "novedades" | "criticos", suffix: string, meta: string) => {
    const valTotal = metrics.total[key] as number;
    const val1 = metrics.trans1[key] as number;
    const val2 = metrics.trans2[key] as number;
    const fmt = (v: number) => {
      if (type === "tiempo") return v > 0 ? `${v.toFixed(1)}h` : "—";
      if (type === "criticos") return v.toLocaleString("es-AR");
      return `${v.toFixed(1)}${suffix}`;
    };
    return (
      <tr className="border-b border-gray-800/50">
        <td className="py-2 px-3 t-primary text-xs font-medium">{label}</td>
        <td className="py-2 px-3 text-right font-mono text-xs t-muted">{meta}</td>
        <td className="py-2 px-3 text-right font-mono text-xs font-bold" style={{ color: colorFor(type, valTotal) }}>{fmt(valTotal)}</td>
        <td className="py-2 px-3 text-right font-mono text-xs font-bold" style={{ color: colorFor(type, val1) }}>{fmt(val1)}</td>
        <td className="py-2 px-3 text-right font-mono text-xs font-bold" style={{ color: colorFor(type, val2) }}>{fmt(val2)}</td>
      </tr>
    );
  };

  return (
    <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
      <h3 className="text-sm font-bold t-primary mb-1">📈 Métricas Operacionales — Performance de transportadoras</h3>
      <p className="text-[11px] t-muted mb-3">
        Mide desde el momento en que la transportadora recibe el paquete hasta el resultado final.
        Excluye PENDIENTE / GUIA_GENERADA / CANCELADO (nunca llegan a transportadora).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-3 text-left text-[11px] t-muted">Métrica</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Meta</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">TOTAL</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">{trans1Label}</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">{trans2Label}</th>
            </tr>
          </thead>
          <tbody>
            {metricRow("% Tasa de Entrega", "tasaEntrega", "entrega", "%", "> 95% 🔴")}
            {metricRow("% Tasa de Devolución", "tasaDevolucion", "devol", "%", "< 5% 🔴")}
            {metricRow("Tiempo Promedio Entrega", "tiempoProm", "tiempo", "h", "< 48h 🟠")}
            {metricRow("% Entregas en 72hs", "pctEn72", "en72", "%", "> 90% 🟠")}
            {metricRow("Críticos +72hs (en tránsito)", "criticos72", "criticos", "", "= 0 🔴")}
            {metricRow("% Tasa de Novedades", "tasaNovedades", "novedades", "%", "< 10% 🟡")}
            <tr className="border-b border-gray-800/50" style={{ background: "rgba(15,23,42,0.4)" }}>
              <td className="py-2 px-3 t-primary text-xs font-medium">Paquetes en Tránsito</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-muted">monitoreo</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">{metrics.total.enTransito.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">{metrics.trans1.enTransito.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">{metrics.trans2.enTransito.toLocaleString("es-AR")}</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="py-2 px-3 t-primary text-xs font-medium">Recibidos por transportadora</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-muted">base</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">{metrics.total.recibidos.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">{metrics.trans1.recibidos.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">{metrics.trans2.recibidos.toLocaleString("es-AR")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-[10px] t-muted">
        <span><span style={{ color: "#10B981" }}>●</span> Meta cumplida</span>
        <span><span style={{ color: "#F59E0B" }}>●</span> En riesgo</span>
        <span><span style={{ color: "#EF4444" }}>●</span> Crítico</span>
        <span className="ml-auto">Criticidad: 🔴 Alta · 🟠 Media · 🟡 Baja</span>
      </div>
      {metrics.total.tiemposCount === 0 && (
        <p className="text-[11px] mt-2 text-amber-400">
          ⓘ "Tiempo Promedio" y "% Entregas en 72hs" requieren fecha_procesamiento y fecha_ultimo_movimiento válidas. Verificá que el Excel tenga esas columnas con fechas parseables.
        </p>
      )}
    </div>
  );
}

/* ───────── DATE RANGE BAR ───────── */
function DateRangeBar({
  dateMode, setDateMode, dateFrom, setDateFrom, dateTo, setDateTo,
  showComparison, setShowComparison, prevMesLabel, prevDateFrom, prevDateTo,
}: {
  dateMode: "all" | "range";
  setDateMode: (m: "all" | "range") => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  showComparison: boolean;
  setShowComparison: (b: boolean) => void;
  prevMesLabel: string;
  prevDateFrom: string;
  prevDateTo: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg" style={{ background: "var(--bg-page)" }}>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] t-muted uppercase tracking-wider">Rango fecha orden</label>
        <select value={dateMode} onChange={(e) => setDateMode(e.target.value as "all" | "range")} className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary focus:border-orange-500 outline-none">
          <option value="all">Todo el mes</option>
          <option value="range">Rango de fechas</option>
        </select>
      </div>
      {dateMode === "range" && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] t-muted uppercase tracking-wider">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary focus:border-orange-500 outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] t-muted uppercase tracking-wider">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 bg-transparent t-primary focus:border-orange-500 outline-none" />
          </div>
        </>
      )}
      <label className="flex items-center gap-2 text-xs t-primary cursor-pointer">
        <input type="checkbox" checked={showComparison} onChange={(e) => setShowComparison(e.target.checked)} className="accent-orange-500" />
        Comparar con {prevMesLabel}
      </label>
      {showComparison && dateMode === "range" && (prevDateFrom || prevDateTo) && (
        <span className="text-[10px] t-muted ml-2 self-end pb-1">
          Espejo: <strong className="t-secondary">{prevDateFrom || "—"} → {prevDateTo || "—"}</strong>
        </span>
      )}
    </div>
  );
}

/* ───────── MOV SUMMARY (Resumen tab) ───────── */
function MovSummarySection({
  metrics, prevMetrics, mesLabel, prevMesLabel, showComparison,
}: {
  metrics: MovMetrics;
  prevMetrics: MovMetrics;
  mesLabel: string;
  prevMesLabel: string;
  showComparison: boolean;
}) {
  const pieData = [
    { name: "Entregadas", value: metrics.entregadas, color: "#10b981" },
    { name: "Devueltas", value: metrics.devueltas, color: "#dc2626" },
    { name: "En Proceso", value: metrics.enProceso, color: "#0891b2" },
    { name: "Pend. Proveedor", value: metrics.pendProv, color: "#f59e0b" },
    { name: "Pend. DS", value: metrics.pendDS, color: "#b45309" },
    { name: "Canceladas", value: metrics.canceladas, color: "#6b7280" },
    { name: "No movilizadas (Comercial)", value: metrics.noMovilizadas, color: "#374151" },
  ].filter((d) => d.value > 0);

  const delta = (curr: number, prev: number, isPct = false) => {
    const d = curr - prev;
    if (Math.abs(d) < 0.05 && isPct) return { txt: "=", color: "#6b7280" };
    const sign = d > 0 ? "+" : "";
    return {
      txt: isPct ? `${sign}${d.toFixed(1)} pp` : `${sign}${d.toLocaleString("es-AR")}`,
      color: d > 0 ? "#10b981" : d < 0 ? "#dc2626" : "#6b7280",
    };
  };

  return (
    <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
      <h3 className="text-sm font-bold t-primary mb-3">🎯 Resumen Operacional — {mesLabel}</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart */}
        <div className="h-64">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "rgba(22,33,62,0.95)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, n) => {
                    const num = Number(v) || 0;
                    return [`${num.toLocaleString("es-AR")} (${metrics.ingresadas > 0 ? ((num / metrics.ingresadas) * 100).toFixed(1) : 0}%)`, n as string];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full t-muted text-xs">Sin datos para mostrar</div>
          )}
        </div>
        {/* KPI list */}
        <div className="space-y-2">
          <MovKpiRow
            label="📦 Ingresadas (órdenes totales)"
            curr={metrics.ingresadas}
            prev={prevMetrics.ingresadas}
            showComp={showComparison}
            prevMesLabel={prevMesLabel}
            delta={delta(metrics.ingresadas, prevMetrics.ingresadas)}
          />
          <MovKpiRow
            label="🚛 Movilizadas / Ingresadas"
            curr={metrics.movilizadas}
            prev={prevMetrics.movilizadas}
            pct={metrics.pctMovilizadas}
            prevPct={prevMetrics.pctMovilizadas}
            showComp={showComparison}
            prevMesLabel={prevMesLabel}
            delta={delta(metrics.pctMovilizadas, prevMetrics.pctMovilizadas, true)}
            color="#06b6d4"
          />
          <MovKpiRow
            label="✅ Tasa Entrega (/ movilizadas)"
            curr={metrics.entregadas}
            prev={prevMetrics.entregadas}
            pct={metrics.pctEntrega}
            prevPct={prevMetrics.pctEntrega}
            showComp={showComparison}
            prevMesLabel={prevMesLabel}
            delta={delta(metrics.pctEntrega, prevMetrics.pctEntrega, true)}
            color="#10b981"
          />
          <MovKpiRow
            label="↩️ Devueltas (/ movilizadas)"
            curr={metrics.devueltas}
            prev={prevMetrics.devueltas}
            pct={metrics.pctDevuelta}
            prevPct={prevMetrics.pctDevuelta}
            showComp={showComparison}
            prevMesLabel={prevMesLabel}
            delta={delta(metrics.pctDevuelta, prevMetrics.pctDevuelta, true)}
            color="#dc2626"
            invertDelta
          />
          <MovKpiRow
            label="🔄 En Proceso (/ movilizadas)"
            curr={metrics.enProceso}
            prev={prevMetrics.enProceso}
            pct={metrics.pctEnProceso}
            prevPct={prevMetrics.pctEnProceso}
            showComp={showComparison}
            prevMesLabel={prevMesLabel}
            delta={delta(metrics.pctEnProceso, prevMetrics.pctEnProceso, true)}
            color="#0891b2"
          />
        </div>
      </div>
    </div>
  );
}

function MovKpiRow({
  label, curr, prev, pct, prevPct, showComp, prevMesLabel, delta, color = "#ea580c", invertDelta = false,
}: {
  label: string;
  curr: number;
  prev: number;
  pct?: number;
  prevPct?: number;
  showComp: boolean;
  prevMesLabel: string;
  delta: { txt: string; color: string };
  color?: string;
  invertDelta?: boolean;
}) {
  const finalDeltaColor = invertDelta
    ? (delta.color === "#10b981" ? "#dc2626" : delta.color === "#dc2626" ? "#10b981" : delta.color)
    : delta.color;
  return (
    <div className="rounded-lg p-3 border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
      <p className="text-[10px] t-muted uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-3 flex-wrap">
        {pct !== undefined && (
          <span className="text-2xl font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
        )}
        <span className="text-sm font-semibold t-primary">{curr.toLocaleString("es-AR")}</span>
        {showComp && (
          <span className="text-[10px] t-muted">
            vs {prevMesLabel}: {pct !== undefined ? `${(prevPct ?? 0).toFixed(1)}%` : prev.toLocaleString("es-AR")}
            <span className="ml-1 font-bold" style={{ color: finalDeltaColor }}>{delta.txt}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────── MOV ENTITY RANKING (Mov DS / Mov Prov tabs) ───────── */
function MovEntityRanking({
  rows, prevRows, country, entityKey, level, title, showComparison, prevMesLabel,
  ingCurr, ingPrev,
}: {
  rows: GuideRow[];
  prevRows: GuideRow[];
  country: "py" | "ar";
  entityKey: "dropshipper" | "proveedor_nombre";
  level: "ds" | "prov";
  title: string;
  showComparison: boolean;
  prevMesLabel: string;
  ingCurr: Map<string, number>;
  ingPrev: Map<string, number>;
}) {
  const stats = useMemo(() => {
    const map = new Map<string, GuideRow[]>();
    for (const r of rows) {
      const k = (r[entityKey] || "(sin nombre)").toString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    const prevMap = new Map<string, GuideRow[]>();
    for (const r of prevRows) {
      const k = (r[entityKey] || "(sin nombre)").toString();
      if (!prevMap.has(k)) prevMap.set(k, []);
      prevMap.get(k)!.push(r);
    }
    // Union de nombres: aparece en movilizadas (operations) y/o en ingresadas (comercial)
    const allNames = new Set<string>([
      ...map.keys(),
      ...prevMap.keys(),
      ...ingCurr.keys(),
      ...ingPrev.keys(),
    ]);
    const arr = Array.from(allNames).map((name) => {
      const ingCur = ingCurr.get(name) || 0;
      const ingPre = ingPrev.get(name) || 0;
      const group = map.get(name) || [];
      const prevGroup = prevMap.get(name) || [];
      const m = computeMovMetrics(group, country, ingCur || undefined);
      const pm = computeMovMetrics(prevGroup, country, ingPre || undefined);
      const mov = level === "ds" ? m.movilizadas : m.movilizadasProv;
      const pctMov = level === "ds" ? m.pctMovilizadas : m.pctMovilizadasProv;
      const prevMov = level === "ds" ? pm.movilizadas : pm.movilizadasProv;
      const prevPctMov = level === "ds" ? pm.pctMovilizadas : pm.pctMovilizadasProv;
      return {
        name,
        ingresadas: m.ingresadas,
        movilizadas: mov,
        pctMov,
        prevIngresadas: pm.ingresadas,
        prevMovilizadas: prevMov,
        prevPctMov,
      };
    });
    arr.sort((a, b) => b.ingresadas - a.ingresadas);
    return arr;
  }, [rows, prevRows, entityKey, country, level, ingCurr, ingPrev]);

  const totals = useMemo(() => {
    const ing = stats.reduce((s, x) => s + x.ingresadas, 0);
    const mov = stats.reduce((s, x) => s + x.movilizadas, 0);
    const prevIng = stats.reduce((s, x) => s + x.prevIngresadas, 0);
    const prevMov = stats.reduce((s, x) => s + x.prevMovilizadas, 0);
    return {
      ing, mov,
      pct: ing > 0 ? (mov / ing) * 100 : 0,
      prevIng, prevMov,
      prevPct: prevIng > 0 ? (prevMov / prevIng) * 100 : 0,
    };
  }, [stats]);

  const deltaCell = (curr: number, prev: number, isPct = false) => {
    const d = curr - prev;
    if (!showComparison) return null;
    const sign = d > 0 ? "+" : "";
    const color = d > 0 ? "#10b981" : d < 0 ? "#dc2626" : "#6b7280";
    return (
      <span className="text-[10px] font-bold ml-1" style={{ color }}>
        {isPct ? `${sign}${d.toFixed(1)}pp` : `${sign}${d.toLocaleString("es-AR")}`}
      </span>
    );
  };

  return (
    <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
      <h3 className="text-sm font-bold t-primary mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-3 text-left text-[11px] t-muted">{level === "ds" ? "Dropshipper" : "Proveedor"}</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Ingresadas</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Movilizadas</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">% Mov.</th>
              {showComparison && (
                <th className="py-2 px-3 text-right text-[11px] t-muted">{prevMesLabel}</th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700 font-bold" style={{ background: "rgba(15,23,42,0.5)" }}>
              <td className="py-2 px-3 t-primary text-xs">TOTAL</td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">
                {totals.ing.toLocaleString("es-AR")}
                {deltaCell(totals.ing, totals.prevIng)}
              </td>
              <td className="py-2 px-3 text-right font-mono text-xs t-primary">
                {totals.mov.toLocaleString("es-AR")}
                {deltaCell(totals.mov, totals.prevMov)}
              </td>
              <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: "#06b6d4" }}>
                {totals.pct.toFixed(1)}%
                {deltaCell(totals.pct, totals.prevPct, true)}
              </td>
              {showComparison && (
                <td className="py-2 px-3 text-right font-mono text-[11px] t-muted">
                  {totals.prevIng.toLocaleString("es-AR")} · {totals.prevPct.toFixed(1)}%
                </td>
              )}
            </tr>
            {stats.map((r) => (
              <tr key={r.name} className="border-b border-gray-800/50">
                <td className="py-2 px-3 t-primary text-xs">{r.name}</td>
                <td className="py-2 px-3 text-right font-mono text-xs t-primary">
                  {r.ingresadas.toLocaleString("es-AR")}
                  {deltaCell(r.ingresadas, r.prevIngresadas)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs t-primary">
                  {r.movilizadas.toLocaleString("es-AR")}
                  {deltaCell(r.movilizadas, r.prevMovilizadas)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs font-bold" style={{
                  color: r.pctMov >= 80 ? "#10b981" : r.pctMov >= 60 ? "#f59e0b" : "#dc2626",
                }}>
                  {r.pctMov.toFixed(1)}%
                  {deltaCell(r.pctMov, r.prevPctMov, true)}
                </td>
                {showComparison && (
                  <td className="py-2 px-3 text-right font-mono text-[11px] t-muted">
                    {r.prevIngresadas.toLocaleString("es-AR")} · {r.prevPctMov.toFixed(1)}%
                  </td>
                )}
              </tr>
            ))}
            {stats.length === 0 && (
              <tr><td colSpan={showComparison ? 5 : 4} className="py-6 text-center text-xs t-muted">Sin datos en el rango.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────── LOGISTICS BREAKDOWN ───────── */
function LogisticsBreakdown({
  rows, prevRows, country, showComparison, prevMesLabel,
}: {
  rows: GuideRow[];
  prevRows: GuideRow[];
  country: "py" | "ar";
  showComparison: boolean;
  prevMesLabel: string;
}) {
  // Lista de transportadoras presentes en current o prev
  const transportadoras = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.transportadora) set.add(r.transportadora);
    for (const r of prevRows) if (r.transportadora) set.add(r.transportadora);
    return Array.from(set).sort();
  }, [rows, prevRows]);

  if (transportadoras.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl p-4 border border-cyan-500/20" style={{ background: "var(--bg-card)" }}>
      <h3 className="text-sm font-bold t-primary mb-1">🚚 Por Logística</h3>
      <p className="text-[11px] t-muted mb-3">Tasa de entrega/devolución/proceso por transportadora — todas las % se miden sobre las guías que esa logística recibió.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {transportadoras.map((t) => (
          <LogisticsCard
            key={t}
            transp={t}
            rows={rows.filter((r) => r.transportadora === t)}
            prevRows={prevRows.filter((r) => r.transportadora === t)}
            country={country}
            showComparison={showComparison}
            prevMesLabel={prevMesLabel}
          />
        ))}
      </div>
    </div>
  );
}

function LogisticsCard({
  transp, rows, prevRows, country, showComparison, prevMesLabel,
}: {
  transp: string;
  rows: GuideRow[];
  prevRows: GuideRow[];
  country: "py" | "ar";
  showComparison: boolean;
  prevMesLabel: string;
}) {
  const m = computeMovMetrics(rows, country);
  const pm = computeMovMetrics(prevRows, country);
  const pieData = [
    { name: "Entregadas", value: m.entregadas, color: "#10b981" },
    { name: "Devueltas", value: m.devueltas, color: "#dc2626" },
    { name: "En Proceso", value: m.enProceso, color: "#0891b2" },
    { name: "Canceladas", value: m.canceladas, color: "#6b7280" },
  ].filter((d) => d.value > 0);

  const totalGuias = m.movilizadas;
  const fmtDelta = (curr: number, prev: number, invert = false) => {
    const d = curr - prev;
    const sign = d > 0 ? "+" : "";
    let color = d > 0 ? "#10b981" : d < 0 ? "#dc2626" : "#6b7280";
    if (invert) color = d > 0 ? "#dc2626" : d < 0 ? "#10b981" : "#6b7280";
    return <span className="text-[10px] font-bold ml-1" style={{ color }}>{sign}{d.toFixed(1)}pp</span>;
  };

  return (
    <div className="rounded-lg p-3 border border-cyan-500/10" style={{ background: "var(--bg-input)" }}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold t-primary">{transp}</h4>
        <span className="text-[10px] t-muted">{totalGuias.toLocaleString("es-AR")} guías</span>
      </div>
      <div className="h-36 mb-2">
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={56} innerRadius={28} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "rgba(22,33,62,0.95)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, fontSize: 11 }}
                formatter={(v, n) => {
                  const num = Number(v) || 0;
                  return [`${num.toLocaleString("es-AR")} (${totalGuias > 0 ? ((num / totalGuias) * 100).toFixed(1) : 0}%)`, n as string];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full t-muted text-[11px]">Sin datos</div>
        )}
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="t-muted">✅ Entrega</span>
          <span className="font-bold" style={{ color: "#10b981" }}>
            {m.pctEntrega.toFixed(1)}% <span className="t-muted font-normal">({m.entregadas.toLocaleString("es-AR")})</span>
            {showComparison && fmtDelta(m.pctEntrega, pm.pctEntrega)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="t-muted">↩️ Devolución</span>
          <span className="font-bold" style={{ color: "#dc2626" }}>
            {m.pctDevuelta.toFixed(1)}% <span className="t-muted font-normal">({m.devueltas.toLocaleString("es-AR")})</span>
            {showComparison && fmtDelta(m.pctDevuelta, pm.pctDevuelta, true)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="t-muted">🔄 En proceso</span>
          <span className="font-bold" style={{ color: "#0891b2" }}>
            {m.pctEnProceso.toFixed(1)}% <span className="t-muted font-normal">({m.enProceso.toLocaleString("es-AR")})</span>
            {showComparison && fmtDelta(m.pctEnProceso, pm.pctEnProceso)}
          </span>
        </div>
        {showComparison && (
          <div className="text-[10px] t-muted mt-1 pt-1 border-t border-gray-700/40">
            vs {prevMesLabel}: {pm.movilizadas.toLocaleString("es-AR")} guías
          </div>
        )}
      </div>
    </div>
  );
}
