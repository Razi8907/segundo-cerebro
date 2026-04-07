"use client";

import { useState } from "react";

interface MesData {
  ing: number | null;
  mov: number | null;
  ent: number | null;
  dev: number | null;
  pct_entrega: number | null;
  pct_dev: number | null;
}

interface Proveedor {
  proveedor: string;
  sellers: number;
  enero: MesData;
  febrero: MesData;
  marzo: MesData;
  total: { ing: number; mov: number; ent: number; dev: number };
  growth_pct: number | null;
  dropi_id: number;
}

interface DailyData {
  dia_semana: string;
  fecha: number;
  ordenes: number;
  nota: string | null;
}

interface Resumen {
  enero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  febrero: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  marzo: { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number };
  total_proveedores: number;
  total_sellers: number;
  [key: string]: any;
}

interface MetaInfo {
  meta_movilizadas_abril: number;
  tasa_movilizacion: number;
  meta_ingresadas_abril: number;
  dias_abril: number;
  promedio_diario_necesario: number;
  marzo_total_ordenes: number;
  marzo_promedio_diario: number;
}

interface Producto {
  producto: string;
  [key: string]: any;
}

type ReportType = "resumen" | "proveedores" | "productos" | "seguimiento_abril" | "completo";
type Periodo = "total" | "q1" | "enero" | "febrero" | "marzo" | "abril";

function downloadCSV(filename: string, content: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PERIODO_LABELS: Record<Periodo, string> = {
  total: "Total (Q1 + Abril)",
  q1: "Q1 2026 (Ene-Mar)",
  enero: "Enero 2026",
  febrero: "Febrero 2026",
  marzo: "Marzo 2026",
  abril: "Abril 2026",
};

function getResumenPeriodo(resumen: Resumen, metaInfo: MetaInfo, abrilData: DailyData[], periodo: Periodo) {
  const meses: Record<string, { ingresadas: number; movilizadas: number; entregados: number; devoluciones: number }> = {
    enero: resumen.enero,
    febrero: resumen.febrero,
    marzo: resumen.marzo,
  };

  const abrilTotal = abrilData.reduce((s, d) => s + d.ordenes, 0);
  const diasCargados = abrilData.length;
  const promAbril = diasCargados > 0 ? Math.round(abrilTotal / diasCargados) : 0;
  const proyAbril = diasCargados > 0 ? Math.round(promAbril * 30) : 0;
  const abrilRow = {
    ingresadas: abrilTotal,
    movilizadas: Math.round(abrilTotal * metaInfo.tasa_movilizacion),
    entregados: 0,
    devoluciones: 0,
    proyeccion: proyAbril,
    diasCargados,
  };

  if (periodo === "enero" || periodo === "febrero" || periodo === "marzo") {
    return { rows: { [periodo]: meses[periodo] }, abrilRow: null };
  }
  if (periodo === "abril") {
    return { rows: {}, abrilRow };
  }
  if (periodo === "q1") {
    return { rows: meses, abrilRow: null };
  }
  // total
  return { rows: meses, abrilRow };
}

function generateResumenCSV(resumen: Resumen, metaInfo: MetaInfo, abrilData: DailyData[], country: string, periodo: Periodo): string {
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";
  const { rows, abrilRow } = getResumenPeriodo(resumen, metaInfo, abrilData, periodo);

  let csv = `RESUMEN - Dropi ${countryLabel} - ${PERIODO_LABELS[periodo]}\n`;
  csv += `Fecha de generacion,${formatDate()}\n\n`;

  const mesEntries = Object.entries(rows);
  if (mesEntries.length > 0) {
    csv += `Mes,Ingresadas,Movilizadas,Entregados,Devoluciones,% Entrega,% Devolucion\n`;
    let totIng = 0, totMov = 0, totEnt = 0, totDev = 0;
    for (const [mes, data] of mesEntries) {
      const pctEnt = data.movilizadas > 0 ? ((data.entregados / data.movilizadas) * 100).toFixed(1) : "0";
      const pctDev = data.movilizadas > 0 ? ((data.devoluciones / data.movilizadas) * 100).toFixed(1) : "0";
      csv += `${mes.charAt(0).toUpperCase() + mes.slice(1)},${data.ingresadas},${data.movilizadas},${data.entregados},${data.devoluciones},${pctEnt}%,${pctDev}%\n`;
      totIng += data.ingresadas; totMov += data.movilizadas; totEnt += data.entregados; totDev += data.devoluciones;
    }
    if (mesEntries.length > 1) {
      csv += `TOTAL Q1,${totIng},${totMov},${totEnt},${totDev},${totMov > 0 ? ((totEnt / totMov) * 100).toFixed(1) : 0}%,${totMov > 0 ? ((totDev / totMov) * 100).toFixed(1) : 0}%\n`;
    }
    csv += "\n";
  }

  if (abrilRow) {
    csv += `ABRIL 2026\n`;
    csv += `Ordenes ingresadas cargadas,${abrilRow.ingresadas}\n`;
    csv += `Movilizadas estimadas,${abrilRow.movilizadas}\n`;
    csv += `Dias cargados,${abrilRow.diasCargados}\n`;
    csv += `Proyeccion final (30 dias),${abrilRow.proyeccion}\n`;
    csv += `Meta ingresadas,${metaInfo.meta_ingresadas_abril}\n`;
    csv += `Meta movilizadas,${metaInfo.meta_movilizadas_abril}\n`;
    csv += `% de meta,${abrilRow.diasCargados > 0 ? ((abrilRow.proyeccion / metaInfo.meta_ingresadas_abril) * 100).toFixed(1) : 0}%\n\n`;
  }

  if (periodo === "total" && abrilRow) {
    const q1Ing = resumen.enero.ingresadas + resumen.febrero.ingresadas + resumen.marzo.ingresadas;
    csv += `GRAN TOTAL (Q1 + Abril parcial)\n`;
    csv += `Total ingresadas,${q1Ing + abrilRow.ingresadas}\n`;
    csv += `Total movilizadas,${resumen.enero.movilizadas + resumen.febrero.movilizadas + resumen.marzo.movilizadas + abrilRow.movilizadas}\n\n`;
  }

  csv += `ESTRUCTURA OPERATIVA\n`;
  csv += `Proveedores activos,${resumen.total_proveedores}\n`;
  csv += `Sellers/Dropshippers,${resumen.total_sellers}\n`;

  return csv;
}

function generateSeguimientoAbrilCSV(abrilData: DailyData[], metaInfo: MetaInfo, country: string): string {
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";
  const META_DIARIA = metaInfo.promedio_diario_necesario;

  let csv = `SEGUIMIENTO DIARIO ABRIL 2026 - Dropi ${countryLabel}\n`;
  csv += `Fecha de generacion,${formatDate()}\n`;
  csv += `Meta mensual ingresadas,${metaInfo.meta_ingresadas_abril}\n`;
  csv += `Meta mensual movilizadas,${metaInfo.meta_movilizadas_abril}\n`;
  csv += `Meta diaria,${META_DIARIA}\n\n`;

  csv += `Dia,Fecha,Dia Semana,Ordenes,Meta Diaria,Diferencia,Estado,Acumulado\n`;

  let acum = 0;
  const sorted = [...abrilData].sort((a, b) => a.fecha - b.fecha);
  for (const d of sorted) {
    acum += d.ordenes;
    const diff = d.ordenes - META_DIARIA;
    const estado = d.ordenes >= META_DIARIA ? "CUMPLE" : d.ordenes >= META_DIARIA * 0.8 ? "ACEPTABLE" : "BAJO";
    csv += `${d.fecha},2026-04-${String(d.fecha).padStart(2, "0")},${d.dia_semana},${d.ordenes},${META_DIARIA},${diff > 0 ? "+" : ""}${diff},${estado},${acum}\n`;
  }

  const diasCargados = sorted.length;
  const promAbril = diasCargados > 0 ? Math.round(acum / diasCargados) : 0;
  const proyeccion = diasCargados > 0 ? Math.round(promAbril * 30) : 0;
  const diasRestantes = 30 - diasCargados;
  const necesario = diasRestantes > 0 ? Math.round((metaInfo.meta_ingresadas_abril - acum) / diasRestantes) : 0;

  csv += `\nRESUMEN\n`;
  csv += `Total acumulado,${acum}\n`;
  csv += `Dias cargados,${diasCargados}\n`;
  csv += `Promedio diario,${promAbril}\n`;
  csv += `Proyeccion final (30 dias),${proyeccion}\n`;
  csv += `% de meta,${diasCargados > 0 ? ((proyeccion / metaInfo.meta_ingresadas_abril) * 100).toFixed(1) : 0}%\n`;
  csv += `Dias restantes,${diasRestantes}\n`;
  csv += `Necesario/dia restante,${necesario}\n`;

  return csv;
}

function generateProveedoresCSV(proveedores: Proveedor[], country: string, periodo: Periodo): string {
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";

  let csv = `REPORTE DE PROVEEDORES - Dropi ${countryLabel} - ${PERIODO_LABELS[periodo]}\n`;
  csv += `Fecha de generacion,${formatDate()}\n`;
  csv += `Total proveedores,${proveedores.length}\n\n`;

  if (periodo === "enero" || periodo === "febrero" || periodo === "marzo") {
    const mes = periodo;
    const mesLabel = mes.charAt(0).toUpperCase() + mes.slice(1);
    csv += `Proveedor,Dropi ID,Sellers,Ingresadas ${mesLabel},Movilizadas ${mesLabel},Entregados ${mesLabel},Devoluciones ${mesLabel},% Entrega,% Devolucion\n`;
    for (const p of proveedores) {
      const d = p[mes] as MesData;
      const ing = d.ing ?? 0;
      const mov = d.mov ?? 0;
      const ent = d.ent ?? 0;
      const dev = d.dev ?? 0;
      if (ing === 0 && mov === 0) continue;
      const pctEnt = ((d.pct_entrega ?? 0) * 100).toFixed(1);
      const pctDev = ((d.pct_dev ?? 0) * 100).toFixed(1);
      csv += `${p.proveedor},${p.dropi_id},${p.sellers},${ing},${mov},${ent},${dev},${pctEnt}%,${pctDev}%\n`;
    }
  } else {
    // Q1, Total, Abril → show all months
    csv += `Proveedor,Dropi ID,Sellers,Ing Ene,Mov Ene,Ent Ene,Dev Ene,Ing Feb,Mov Feb,Ent Feb,Dev Feb,Ing Mar,Mov Mar,Ent Mar,Dev Mar,Total Ing,Total Mov,Total Ent,Total Dev,% Entrega Mar,% Dev Mar,Crecimiento %\n`;
    for (const p of proveedores) {
      csv += `${p.proveedor},${p.dropi_id},${p.sellers},`;
      csv += `${p.enero.ing ?? 0},${p.enero.mov ?? 0},${p.enero.ent ?? 0},${p.enero.dev ?? 0},`;
      csv += `${p.febrero.ing ?? 0},${p.febrero.mov ?? 0},${p.febrero.ent ?? 0},${p.febrero.dev ?? 0},`;
      csv += `${p.marzo.ing ?? 0},${p.marzo.mov ?? 0},${p.marzo.ent ?? 0},${p.marzo.dev ?? 0},`;
      csv += `${p.total.ing},${p.total.mov},${p.total.ent},${p.total.dev},`;
      csv += `${((p.marzo.pct_entrega ?? 0) * 100).toFixed(1)}%,${((p.marzo.pct_dev ?? 0) * 100).toFixed(1)}%,${p.growth_pct ?? 0}%\n`;
    }
  }

  return csv;
}

function generateProductosCSV(productos: Producto[], country: string): string {
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";

  let csv = `REPORTE DE PRODUCTOS - Dropi ${countryLabel}\n`;
  csv += `Fecha de generacion,${formatDate()}\n`;
  csv += `Total productos,${productos.length}\n\n`;

  if (productos.length === 0) return csv;

  const keys = Object.keys(productos[0]);
  csv += keys.join(",") + "\n";

  for (const p of productos) {
    csv += keys.map((k) => {
      const val = p[k];
      if (typeof val === "string" && val.includes(",")) return `"${val}"`;
      return val ?? "";
    }).join(",") + "\n";
  }

  return csv;
}

export default function ReportGenerator({
  resumen,
  metaInfo,
  proveedores,
  productos,
  seguimientoDiario,
  seguimientoAbril,
  country,
}: {
  resumen: Resumen;
  metaInfo: MetaInfo;
  proveedores: Proveedor[];
  productos: Producto[];
  seguimientoDiario: DailyData[];
  seguimientoAbril: DailyData[];
  country: "py" | "ar";
}) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("total");
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";
  const STORAGE_KEY = `segundo-cerebro-abril-${country}`;

  function getAbrilData(): DailyData[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return seguimientoAbril;
  }

  function handleDownload(type: ReportType) {
    setGenerating(`${type}-${periodo}`);
    const abrilData = getAbrilData();
    const date = formatDate();
    const periodoSuffix = periodo === "total" ? "Total" : periodo === "q1" ? "Q1" : periodo.charAt(0).toUpperCase() + periodo.slice(1);
    let csv = "";
    let filename = "";

    switch (type) {
      case "resumen":
        csv = generateResumenCSV(resumen, metaInfo, abrilData, country, periodo);
        filename = `Resumen_${periodoSuffix}_${countryLabel}_${date}.csv`;
        break;
      case "seguimiento_abril":
        csv = generateSeguimientoAbrilCSV(abrilData, metaInfo, country);
        filename = `Seguimiento_Abril_${countryLabel}_${date}.csv`;
        break;
      case "proveedores":
        csv = generateProveedoresCSV(proveedores, country, periodo);
        filename = `Proveedores_${periodoSuffix}_${countryLabel}_${date}.csv`;
        break;
      case "productos":
        csv = generateProductosCSV(productos, country);
        filename = `Productos_${countryLabel}_${date}.csv`;
        break;
      case "completo": {
        csv = generateResumenCSV(resumen, metaInfo, abrilData, country, periodo);
        csv += "\n\n" + "=".repeat(60) + "\n\n";
        if (periodo === "abril" || periodo === "total") {
          csv += generateSeguimientoAbrilCSV(abrilData, metaInfo, country);
          csv += "\n\n" + "=".repeat(60) + "\n\n";
        }
        csv += generateProveedoresCSV(proveedores, country, periodo);
        csv += "\n\n" + "=".repeat(60) + "\n\n";
        csv += generateProductosCSV(productos, country);
        filename = `Reporte_Completo_${periodoSuffix}_${countryLabel}_${date}.csv`;
        break;
      }
    }

    downloadCSV(filename, csv);
    setTimeout(() => setGenerating(null), 1000);
  }

  const reports: { type: ReportType; label: string; desc: string; icon: string; color: string }[] = [
    { type: "resumen", label: "Resumen Ejecutivo", desc: "KPIs del periodo seleccionado", icon: "📊", color: "blue" },
    { type: "seguimiento_abril", label: "Seguimiento Abril", desc: "Dia a dia de abril con semaforo y proyeccion", icon: "🎯", color: "green" },
    { type: "proveedores", label: "Proveedores", desc: "Proveedores con metricas del periodo", icon: "🏭", color: "orange" },
    { type: "productos", label: "Productos", desc: "Top productos mas vendidos Q1", icon: "📦", color: "purple" },
    { type: "completo", label: "Reporte Completo", desc: "Todos los reportes del periodo en un archivo", icon: "📋", color: "red" },
  ];

  const colorStyles: Record<string, { border: string; bg: string; text: string; hover: string }> = {
    blue: { border: "border-blue-500/30", bg: "rgba(59,130,246,0.05)", text: "text-blue-400", hover: "hover:border-blue-500/60" },
    green: { border: "border-green-500/30", bg: "rgba(16,185,129,0.05)", text: "text-green-400", hover: "hover:border-green-500/60" },
    orange: { border: "border-orange-500/30", bg: "rgba(249,115,22,0.05)", text: "text-orange-400", hover: "hover:border-orange-500/60" },
    purple: { border: "border-purple-500/30", bg: "rgba(139,92,246,0.05)", text: "text-purple-400", hover: "hover:border-purple-500/60" },
    red: { border: "border-red-500/30", bg: "rgba(239,68,68,0.05)", text: "text-red-400", hover: "hover:border-red-500/60" },
  };

  const periodos: { key: Periodo; label: string }[] = [
    { key: "total", label: "Total" },
    { key: "q1", label: "Q1" },
    { key: "enero", label: "Enero" },
    { key: "febrero", label: "Febrero" },
    { key: "marzo", label: "Marzo" },
    { key: "abril", label: "Abril" },
  ];

  return (
    <div className="glass-card p-6 border-cyan-500/30">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
        📥 Reportes &mdash; Dropi {countryLabel}
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Genera y descarga reportes en CSV &middot; Selecciona el periodo y el tipo de reporte
      </p>

      {/* Period selector */}
      <div className="mb-5">
        <p className="text-[10px] text-gray-400 uppercase mb-2">Periodo del reporte</p>
        <div className="flex gap-2 flex-wrap">
          {periodos.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`text-xs px-4 py-2 rounded-lg border transition-all ${
                periodo === p.key
                  ? "bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-500/20"
                  : "bg-transparent text-gray-400 border-gray-700 hover:border-cyan-500/40 hover:text-cyan-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">
          Descargando: <span className="text-cyan-400 font-medium">{PERIODO_LABELS[periodo]}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => {
          const s = colorStyles[r.color];
          const isGenerating = generating === `${r.type}-${periodo}`;
          const isAbrilOnly = r.type === "seguimiento_abril";
          const disabled = isAbrilOnly && periodo !== "abril" && periodo !== "total";
          return (
            <button
              key={r.type}
              onClick={() => !disabled && handleDownload(r.type)}
              disabled={isGenerating || disabled}
              className={`text-left p-4 rounded-xl border ${s.border} ${s.hover} transition-all group ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
              style={{ background: s.bg }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${s.text} group-hover:brightness-125`}>
                    {isGenerating ? "Descargando..." : r.label}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{r.desc}</p>
                </div>
                <svg
                  className={`w-4 h-4 mt-0.5 shrink-0 ${s.text} opacity-50 group-hover:opacity-100 transition-opacity`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
