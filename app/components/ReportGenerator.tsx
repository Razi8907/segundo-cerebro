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

type ReportType = "resumen_ejecutivo" | "seguimiento_abril" | "proveedores" | "productos" | "completo";

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

function generateResumenEjecutivo(resumen: Resumen, metaInfo: MetaInfo, abrilData: DailyData[], country: string): string {
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";
  const q1Ing = resumen.enero.ingresadas + resumen.febrero.ingresadas + resumen.marzo.ingresadas;
  const q1Mov = resumen.enero.movilizadas + resumen.febrero.movilizadas + resumen.marzo.movilizadas;
  const q1Ent = resumen.enero.entregados + resumen.febrero.entregados + resumen.marzo.entregados;
  const q1Dev = resumen.enero.devoluciones + resumen.febrero.devoluciones + resumen.marzo.devoluciones;

  const abrilTotal = abrilData.reduce((s, d) => s + d.ordenes, 0);
  const diasCargados = abrilData.length;
  const promAbril = diasCargados > 0 ? Math.round(abrilTotal / diasCargados) : 0;
  const proyeccion = diasCargados > 0 ? Math.round(promAbril * 30) : 0;
  const pctMeta = diasCargados > 0 ? ((proyeccion / metaInfo.meta_ingresadas_abril) * 100).toFixed(1) : "0";

  let csv = `RESUMEN EJECUTIVO - Dropi ${countryLabel}\n`;
  csv += `Fecha de generacion,${formatDate()}\n\n`;

  csv += `RENDIMIENTO Q1 2026\n`;
  csv += `Mes,Ingresadas,Movilizadas,Entregados,Devoluciones,% Entrega,% Devolucion\n`;
  for (const [mes, data] of Object.entries({ Enero: resumen.enero, Febrero: resumen.febrero, Marzo: resumen.marzo })) {
    const pctEnt = data.movilizadas > 0 ? ((data.entregados / data.movilizadas) * 100).toFixed(1) : "0";
    const pctDev = data.movilizadas > 0 ? ((data.devoluciones / data.movilizadas) * 100).toFixed(1) : "0";
    csv += `${mes},${data.ingresadas},${data.movilizadas},${data.entregados},${data.devoluciones},${pctEnt}%,${pctDev}%\n`;
  }
  csv += `TOTAL Q1,${q1Ing},${q1Mov},${q1Ent},${q1Dev},${q1Mov > 0 ? ((q1Ent / q1Mov) * 100).toFixed(1) : 0}%,${q1Mov > 0 ? ((q1Dev / q1Mov) * 100).toFixed(1) : 0}%\n\n`;

  csv += `ESTRUCTURA OPERATIVA\n`;
  csv += `Proveedores activos,${resumen.total_proveedores}\n`;
  csv += `Sellers/Dropshippers,${resumen.total_sellers}\n\n`;

  csv += `META ABRIL 2026\n`;
  csv += `Meta movilizadas,${metaInfo.meta_movilizadas_abril}\n`;
  csv += `Meta ingresadas,${metaInfo.meta_ingresadas_abril}\n`;
  csv += `Promedio diario necesario,${metaInfo.promedio_diario_necesario}\n`;
  csv += `Dias cargados,${diasCargados}\n`;
  csv += `Ordenes acumuladas abril,${abrilTotal}\n`;
  csv += `Promedio diario actual,${promAbril}\n`;
  csv += `Proyeccion final,${proyeccion}\n`;
  csv += `% de meta,${pctMeta}%\n`;

  return csv;
}

function generateSeguimientoAbril(abrilData: DailyData[], metaInfo: MetaInfo, marzoData: DailyData[], country: string): string {
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";
  const META_DIARIA = metaInfo.promedio_diario_necesario;

  let csv = `SEGUIMIENTO DIARIO ABRIL 2026 - Dropi ${countryLabel}\n`;
  csv += `Fecha de generacion,${formatDate()}\n`;
  csv += `Meta mensual ingresadas,${metaInfo.meta_ingresadas_abril}\n`;
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
  csv += `Necesario/dia restante,${necesario}\n\n`;

  csv += `REFERENCIA MARZO 2026\n`;
  csv += `Total marzo,${metaInfo.marzo_total_ordenes}\n`;
  csv += `Promedio diario marzo,${metaInfo.marzo_promedio_diario}\n`;

  return csv;
}

function generateProveedoresReport(proveedores: Proveedor[], country: string): string {
  const countryLabel = country === "py" ? "Paraguay" : "Argentina";

  let csv = `REPORTE DE PROVEEDORES - Dropi ${countryLabel}\n`;
  csv += `Fecha de generacion,${formatDate()}\n`;
  csv += `Total proveedores,${proveedores.length}\n\n`;

  csv += `Proveedor,Dropi ID,Sellers,Ing Ene,Mov Ene,Ent Ene,Dev Ene,Ing Feb,Mov Feb,Ent Feb,Dev Feb,Ing Mar,Mov Mar,Ent Mar,Dev Mar,Total Ing,Total Mov,Total Ent,Total Dev,% Entrega Mar,% Dev Mar,Crecimiento %\n`;

  for (const p of proveedores) {
    csv += `${p.proveedor},${p.dropi_id},${p.sellers},`;
    csv += `${p.enero.ing ?? 0},${p.enero.mov ?? 0},${p.enero.ent ?? 0},${p.enero.dev ?? 0},`;
    csv += `${p.febrero.ing ?? 0},${p.febrero.mov ?? 0},${p.febrero.ent ?? 0},${p.febrero.dev ?? 0},`;
    csv += `${p.marzo.ing ?? 0},${p.marzo.mov ?? 0},${p.marzo.ent ?? 0},${p.marzo.dev ?? 0},`;
    csv += `${p.total.ing},${p.total.mov},${p.total.ent},${p.total.dev},`;
    csv += `${((p.marzo.pct_entrega ?? 0) * 100).toFixed(1)}%,${((p.marzo.pct_dev ?? 0) * 100).toFixed(1)}%,${p.growth_pct ?? 0}%\n`;
  }

  return csv;
}

function generateProductosReport(productos: Producto[], country: string): string {
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
  const [generating, setGenerating] = useState<ReportType | null>(null);
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
    setGenerating(type);
    const abrilData = getAbrilData();
    const date = formatDate();
    let csv = "";
    let filename = "";

    switch (type) {
      case "resumen_ejecutivo":
        csv = generateResumenEjecutivo(resumen, metaInfo, abrilData, country);
        filename = `Resumen_Ejecutivo_${countryLabel}_${date}.csv`;
        break;
      case "seguimiento_abril":
        csv = generateSeguimientoAbril(abrilData, metaInfo, seguimientoDiario, country);
        filename = `Seguimiento_Abril_${countryLabel}_${date}.csv`;
        break;
      case "proveedores":
        csv = generateProveedoresReport(proveedores, country);
        filename = `Proveedores_${countryLabel}_${date}.csv`;
        break;
      case "productos":
        csv = generateProductosReport(productos, country);
        filename = `Productos_${countryLabel}_${date}.csv`;
        break;
      case "completo": {
        csv = generateResumenEjecutivo(resumen, metaInfo, abrilData, country);
        csv += "\n\n" + "=".repeat(60) + "\n\n";
        csv += generateSeguimientoAbril(abrilData, metaInfo, seguimientoDiario, country);
        csv += "\n\n" + "=".repeat(60) + "\n\n";
        csv += generateProveedoresReport(proveedores, country);
        csv += "\n\n" + "=".repeat(60) + "\n\n";
        csv += generateProductosReport(productos, country);
        filename = `Reporte_Completo_${countryLabel}_${date}.csv`;
        break;
      }
    }

    downloadCSV(filename, csv);
    setTimeout(() => setGenerating(null), 1000);
  }

  const reports: { type: ReportType; label: string; desc: string; icon: string; color: string }[] = [
    { type: "resumen_ejecutivo", label: "Resumen Ejecutivo", desc: "KPIs Q1 + metas abril + estructura operativa", icon: "📊", color: "blue" },
    { type: "seguimiento_abril", label: "Seguimiento Abril", desc: "Dia a dia de abril con semaforo y proyeccion", icon: "🎯", color: "green" },
    { type: "proveedores", label: "Proveedores", desc: "Todos los proveedores con metricas mensuales Q1", icon: "🏭", color: "orange" },
    { type: "productos", label: "Productos", desc: "Top productos mas vendidos Q1", icon: "📦", color: "purple" },
    { type: "completo", label: "Reporte Completo", desc: "Todos los reportes en un solo archivo", icon: "📋", color: "red" },
  ];

  const colorStyles: Record<string, { border: string; bg: string; text: string; hover: string }> = {
    blue: { border: "border-blue-500/30", bg: "rgba(59,130,246,0.05)", text: "text-blue-400", hover: "hover:border-blue-500/60" },
    green: { border: "border-green-500/30", bg: "rgba(16,185,129,0.05)", text: "text-green-400", hover: "hover:border-green-500/60" },
    orange: { border: "border-orange-500/30", bg: "rgba(249,115,22,0.05)", text: "text-orange-400", hover: "hover:border-orange-500/60" },
    purple: { border: "border-purple-500/30", bg: "rgba(139,92,246,0.05)", text: "text-purple-400", hover: "hover:border-purple-500/60" },
    red: { border: "border-red-500/30", bg: "rgba(239,68,68,0.05)", text: "text-red-400", hover: "hover:border-red-500/60" },
  };

  return (
    <div className="glass-card p-6 border-cyan-500/30">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
        📥 Reportes &mdash; Dropi {countryLabel}
      </h2>
      <p className="text-xs text-gray-400 mb-6">
        Genera y descarga reportes en CSV &middot; Incluye datos de abril cargados manualmente
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => {
          const s = colorStyles[r.color];
          const isGenerating = generating === r.type;
          return (
            <button
              key={r.type}
              onClick={() => handleDownload(r.type)}
              disabled={isGenerating}
              className={`text-left p-4 rounded-xl border ${s.border} ${s.hover} transition-all cursor-pointer group`}
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
