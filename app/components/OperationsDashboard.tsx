"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

/* ───────── constants ───────── */
const STATUS_GROUPS = {
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

const TABS = [
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

type TabKey = (typeof TABS)[number]["key"];

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

  function rowBg(r: GuideRow): string | undefined {
    if (!highlightHours) return undefined;
    const h = hoursFromProcessing(r.fecha_procesamiento);
    if (h > 168) return "rgba(127,29,29,0.25)";
    if (h > 120) return "rgba(220,38,38,0.18)";
    if (h > 72) return "rgba(217,119,6,0.15)";
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
export default function OperationsDashboard({ country }: { country: "py" | "ar" }) {
  const [rows, setRows] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data/operations?country=${country}`);
      if (res.ok) {
        const data = await res.json();
        const rawRows = Array.isArray(data) ? data : data.rows || [];
        // Map DB fields → component fields
        const mapped: GuideRow[] = rawRows.map((r: any) => ({
          guia: r.guia || "",
          fecha: r.fecha_reporte || r.fecha_orden || "",
          dropshipper: r.dropshipper || "",
          nombre_tienda: r.tienda || "",
          proveedor_nombre: r.proveedor || "",
          transportadora: r.transportadora || "",
          estatus: r.estatus || "",
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
        }));
        setRows(mapped);
      }
    } catch (e) {
      console.error("Error fetching operations:", e);
    } finally {
      setLoading(false);
    }
  }, [country]);

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
        tienda: r.nombre_tienda,
        proveedor: r.proveedor_nombre,
        proveedor_id: 0,
        transportadora: r.transportadora,
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

      // Upload in batches of 300 to avoid payload/timeout limits
      const BATCH_SIZE = 300;
      const fc = todayStr();
      for (let i = 0; i < apiRows.length; i += BATCH_SIZE) {
        const batch = apiRows.slice(i, i + BATCH_SIZE);
        const res = await fetch("/api/data/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country, fecha_carga: fc, rows: batch }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error en lote ${Math.floor(i / BATCH_SIZE) + 1}`);
        }
      }
      // Set parsed data immediately + refresh from API
      setRows((prev) => {
        const existingGuias = new Set(parsed.map((r) => `${r.guia}-${r.fecha_carga}`));
        const kept = prev.filter((r) => !existingGuias.has(`${r.guia}-${r.fecha_carga}`));
        return [...kept, ...parsed];
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Error al procesar archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [country, fetchData]);

  /* ───── derived data ───── */
  const fechasCarga = useMemo(() => {
    const set = new Set(rows.map((r) => r.fecha_carga));
    return Array.from(set).sort();
  }, [rows]);

  const latestFechaCarga = fechasCarga[fechasCarga.length - 1] || "";

  const uploadHistory = useMemo(() => {
    return countBy(rows, (r) => r.fecha_carga).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Status counts
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) map[r.estatus] = (map[r.estatus] || 0) + 1;
    return map;
  }, [rows]);

  // Transport-specific filters
  const aexRows = useMemo(() => rows.filter((r) => r.transportadora === "AEX" && STATUS_GROUPS.mov_aex.includes(r.estatus)), [rows]);
  const fixyRows = useMemo(() => rows.filter((r) => r.transportadora === "FIXY" && STATUS_GROUPS.mov_fixy.includes(r.estatus)), [rows]);
  const fixyNdRows = useMemo(() => rows.filter((r) => r.transportadora === "FIXY-NEXTDAY" && STATUS_GROUPS.mov_fixy.includes(r.estatus)), [rows]);
  const noEntregadas = useMemo(() => rows.filter((r) => r.estatus === "NO ENTREGADA"), [rows]);
  const novedades = useMemo(() => rows.filter((r) => r.estatus === "NOVEDAD"), [rows]);
  const movProv = useMemo(() => rows.filter((r) => STATUS_GROUPS.mov_proveedor.includes(r.estatus)), [rows]);
  const movDs = useMemo(() => rows.filter((r) => STATUS_GROUPS.mov_dropshipper.includes(r.estatus)), [rows]);
  const canceladas = useMemo(() => rows.filter((r) => STATUS_GROUPS.cancelacion.includes(r.estatus)), [rows]);

  // Paradas +72hs: latest fecha_carga, in transit, > 72hs
  const paradasRows = useMemo(() => {
    if (!latestFechaCarga) return [];
    const latestRows = rows.filter((r) => r.fecha_carga === latestFechaCarga);
    const inTransit = latestRows.filter(
      (r) => STATUS_GROUPS.mov_aex.includes(r.estatus) || STATUS_GROUPS.mov_fixy.includes(r.estatus)
    );
    return inTransit
      .filter((r) => hoursFromProcessing(r.fecha_procesamiento) > 72)
      .map((r) => {
        // Count how many different fecha_carga dates this guide appeared with same status
        const sameGuide = rows.filter((x) => x.guia === r.guia && x.estatus === r.estatus);
        const uniqueDates = new Set(sameGuide.map((x) => x.fecha_carga));
        return { ...r, diasSinCambio: uniqueDates.size, horasTransporte: hoursFromProcessing(r.fecha_procesamiento) };
      })
      .sort((a, b) => b.horasTransporte - a.horasTransporte);
  }, [rows, latestFechaCarga]);

  // Alert counts
  const alertCounts = useMemo(() => {
    const aexAll = rows.filter((r) => r.transportadora === "AEX" && STATUS_GROUPS.mov_aex.includes(r.estatus));
    const fixyAll = rows.filter((r) =>
      (r.transportadora === "FIXY" || r.transportadora === "FIXY-NEXTDAY") && STATUS_GROUPS.mov_fixy.includes(r.estatus)
    );
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
    };
  }, [rows]);

  // KPI summary counts
  const kpis = useMemo(() => {
    const entregadas = rows.filter((r) => r.estatus === "ENTREGADO").length;
    const devolucion = rows.filter((r) => r.estatus === "DEVOLUCION").length;
    return {
      total: rows.length,
      aexTransito: aexRows.length,
      fixyTransito: fixyRows.length,
      fixyNdTransito: fixyNdRows.length,
      noEntregadas: noEntregadas.length,
      novedades: novedades.length,
      devolucion,
      canceladas: canceladas.length,
      entregadas,
    };
  }, [rows, aexRows, fixyRows, fixyNdRows, noEntregadas, novedades, canceladas]);

  /* ───── table column defs ───── */
  const transportColumns = [
    { key: "guia", label: "Guia" },
    { key: "fecha", label: "Fecha" },
    { key: "dropshipper", label: "Dropshipper" },
    { key: "estatus", label: "Estado" },
    { key: "concepto_ultimo_movimiento", label: "Ultimo Movimiento" },
    { key: "ciudad_destino", label: "Ciudad" },
    { key: "departamento_destino", label: "Departamento" },
    { key: "novedad", label: "Novedad" },
    { key: "horas", label: "Horas Transporte", render: (r: GuideRow) => {
      const h = hoursFromProcessing(r.fecha_procesamiento);
      const color = h > 120 ? "#dc2626" : h > 72 ? "#d97706" : undefined;
      return <span style={{ color, fontWeight: color ? 700 : 400 }}>{h}h</span>;
    }},
  ];

  const fullColumns = [
    { key: "guia", label: "Guia" },
    { key: "fecha", label: "Fecha" },
    { key: "dropshipper", label: "Dropshipper" },
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

  const paradasColumns = [
    { key: "guia", label: "Guia" },
    { key: "transportadora", label: "Transportadora" },
    { key: "estatus", label: "Estado" },
    { key: "fecha_procesamiento", label: "Fecha Procesamiento" },
    { key: "horas", label: "Horas Transporte", render: (r: any) => {
      const h = r.horasTransporte || hoursFromProcessing(r.fecha_procesamiento);
      const color = h > 168 ? "#7f1d1d" : h > 120 ? "#dc2626" : h > 72 ? "#d97706" : undefined;
      return <span style={{ color, fontWeight: 700 }}>{h}h</span>;
    }},
    { key: "diasSinCambio", label: "Dias sin cambio", render: (r: any) => <span className="font-bold" style={{ color: "#ea580c" }}>{r.diasSinCambio || "—"}</span> },
    { key: "dropshipper", label: "Dropshipper" },
    { key: "ciudad_destino", label: "Ciudad" },
    { key: "telefono", label: "Telefono" },
  ];

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
        <h2 className="text-xl font-bold t-primary mb-1">📋 Dashboard Operacional — {country === "py" ? "Paraguay" : "Argentina"}</h2>
        <p className="text-xs t-secondary mb-4">Subi el archivo Excel de Dropi (hoja CARGA DIARIA) para comenzar</p>
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg dropi-gradient text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity">
          {uploading ? "Procesando..." : "📥 Subir archivo Excel"}
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
          <h2 className="text-xl font-bold t-primary mb-1">📋 Dashboard Operacional — {country === "py" ? "Paraguay" : "Argentina"}</h2>
          <p className="text-xs t-secondary">
            {rows.length.toLocaleString()} guias cargadas | Ultima carga: {latestFechaCarga} | {fechasCarga.length} dia(s) acumulados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg dropi-gradient text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity">
            {uploading ? "Procesando..." : "📥 Actualizar archivo"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-0 border-b border-cyan-500/20 -mx-6 px-6 overflow-x-auto">
        {TABS.map((t) => (
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
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <KpiCard label="Total guias" value={kpis.total.toLocaleString()} color="orange" />
            <KpiCard label="AEX en transito" value={kpis.aexTransito} color="blue" />
            <KpiCard label="FIXY en transito" value={kpis.fixyTransito} color="blue" />
            <KpiCard label="FIXY-ND en transito" value={kpis.fixyNdTransito} color="blue" />
            <KpiCard label="No entregadas" value={kpis.noEntregadas} color="red" />
            <KpiCard label="Novedades" value={kpis.novedades} color="orange" />
            <KpiCard label="Devolucion" value={kpis.devolucion} color="red" />
            <KpiCard label="Canceladas" value={kpis.canceladas} color="red" />
            <KpiCard label="Entregadas" value={kpis.entregadas} color="green" />
          </div>

          {/* Alert cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AlertCard label="AEX +72hs" value={alertCounts.aex72} level="warn" />
            <AlertCard label="AEX +120hs (critico)" value={alertCounts.aex120} level="crit" />
            <AlertCard label="FIXY +72hs" value={alertCounts.fixy72} level="warn" />
            <AlertCard label="FIXY +120hs (critico)" value={alertCounts.fixy120} level="crit" />
          </div>

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
          {renderStatusBreakdown(aexRows, "AEX")}
          <DataTable rows={aexRows} columns={transportColumns} highlightHours />
        </div>
      )}

      {/* ── FIXY TAB ── */}
      {tab === "fixy" && (
        <div className="space-y-4">
          {renderStatusBreakdown(fixyRows, "FIXY")}
          <DataTable rows={fixyRows} columns={transportColumns} highlightHours />
        </div>
      )}

      {/* ── FIXY NEXT DAY TAB ── */}
      {tab === "fixy_nd" && (
        <div className="space-y-4">
          {renderStatusBreakdown(fixyNdRows, "FIXY-NEXTDAY")}
          <DataTable rows={fixyNdRows} columns={transportColumns} highlightHours />
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
          <DataTable rows={novedades} columns={fullColumns} />
        </div>
      )}

      {/* ── MOV PROVEEDOR TAB ── */}
      {tab === "mov_prov" && (
        <div className="space-y-4">
          {renderStatusBreakdown(movProv, "Mov. Proveedor")}
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
      )}

      {/* ── MOV DROPSHIPPER TAB ── */}
      {tab === "mov_ds" && (
        <div className="space-y-4">
          {renderStatusBreakdown(movDs, "Mov. Dropshipper")}
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
      )}

      {/* ── CANCELADAS TAB ── */}
      {tab === "canceladas" && (
        <div className="space-y-4">
          {renderStatusBreakdown(canceladas, "Canceladas")}
          <DataTable rows={canceladas} columns={fullColumns} />
        </div>
      )}

      {/* ── PARADAS +72hs TAB ── */}
      {tab === "paradas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <KpiCard label="Total Paradas +72hs" value={paradasRows.length} color="red" />
            {countBy(paradasRows, (r) => r.transportadora).map((b) => (
              <KpiCard key={b.name} label={b.name} value={b.count} color="orange" sub="por transportadora" />
            ))}
          </div>

          {/* Color legend */}
          <div className="flex flex-wrap gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "rgba(217,119,6,0.35)" }} /> 72-120hs</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "rgba(220,38,38,0.35)" }} /> 120-168hs</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "rgba(127,29,29,0.45)" }} /> +168hs (7 dias)</span>
          </div>

          <DataTable rows={paradasRows as any} columns={paradasColumns} highlightHours />
        </div>
      )}
    </div>
  );
}
