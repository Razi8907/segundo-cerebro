"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  ComposedChart,
  Area,
  ReferenceLine,
  Legend,
} from "recharts";
import ChartDownloadBtn from "./ChartDownloadBtn";

// ═══════════════════════════════════════════════════
// DATA FROM PLAN COMERCIAL + CALENDARIO ABRIL 2026
// ═══════════════════════════════════════════════════

// --- PROVEEDORES ---
const PROV_CRECIMIENTO = [
  { nombre: "TIENDAOFERTAS", ene: 392, feb: 551, mar: 2585, meta: 3150, ds: "pascu.ecom (927), urielparedes (411), caiorodrigo (239)", estrategia: "Prioridad #1. Escalar pascu y uriel, captar nuevos DS" },
  { nombre: "MERX Lab e Imp", ene: 817, feb: 1688, mar: 2007, meta: 2200, ds: "multiventas (832), mdelarosa (748)", estrategia: "Ampliar catalogo para multiventas y mdelarosa" },
  { nombre: "MARIOGONZALEZ", ene: 1030, feb: 905, mar: 1356, meta: 1750, ds: "joao.oliveira (544), mercaplus.chile (237), casanoblear (227)", estrategia: "Explotar mercado Chile (mercaplus), sostener joao" },
  { nombre: "MerxLaboratorio", ene: 2, feb: 62, mar: 804, meta: 950, ds: "multiventas (714) — casi todo de 1 DS", estrategia: "Diversificar base DS, muy concentrado" },
  { nombre: "RaulGonzalez", ene: 221, feb: 694, mar: 350, meta: 450, ds: "multiventas, mdelarosa activos", estrategia: "Crecio en Feb, cayo en Mar. Investigar" },
];

const PROV_CAIDA = [
  { nombre: "OscarCoronado", ene: 2707, feb: 1880, mar: 942, meta: 1200, ds: "guilherme 638>78, yurihenri cayo, caiorodrigo migro a TIENDAOFERTAS", estrategia: "Reactivar guilherme, buscar nuevos DS, mejorar oferta vs TIENDAOFERTAS" },
  { nombre: "MaicolPerez", ene: 2535, feb: 1701, mar: 1294, meta: 1400, ds: "guilherme 1104>52, mayor caida de un solo DS en todo Q1", estrategia: "Entender por que guilherme salio, renovar catalogo" },
  { nombre: "TN", ene: 953, feb: 564, mar: 228, meta: 350, ds: "abstra33 219>22, guilherme 362>0", estrategia: "Captar DS nuevos, los historicos migraron" },
];

const PROV_DORMIDOS = [
  { nombre: "DaniiDiaz", pico: 243, mar: 3, meta: 100, accion: "Reactivar, tuvo buen volumen en Ene" },
  { nombre: "LizDiaz", pico: 267, mar: 3, meta: 100, accion: "Pool DS compartido con DaniiDiaz" },
  { nombre: "FLUENSTORE", pico: 421, mar: 58, meta: 150, accion: "lackagente se fue. Buscar reemplazo" },
  { nombre: "DropLabs / camilapinho", pico: 178, mar: 0, meta: 50, accion: "Evaluar si vale la pena reactivar" },
];

// --- DROPSHIPPERS ---
const TIER1 = [
  { nombre: "multiventasxargentina", ene: 16, feb: 401, mar: 1831, meta: 1950, pctMov: 67, pctEnt: 38, proveedores: "MERX Lab (832), MerxLab (714), TIENDAOFERTAS (285)", plan: "Canal directo, stock garantizado, mejorar tasa entrega (38% es baja)" },
  { nombre: "pascu.ecom", ene: 0, feb: 0, mar: 927, meta: 1200, pctMov: 37, pctEnt: 50, proveedores: "TIENDAOFERTAS (927) — exclusivo", plan: "Prioridad maxima retener, ofrecer 2do proveedor, subir tasa mov" },
  { nombre: "mdelarosa.bmm", ene: 62, feb: 484, mar: 771, meta: 800, pctMov: 69, pctEnt: 56, proveedores: "MERX Lab (748), MerxLab (23)", plan: "Expandir a mas proveedores, tiene tasa entrega razonable" },
  { nombre: "joao.oliveira", ene: 11, feb: 16, mar: 544, meta: 650, pctMov: 83, pctEnt: 25, proveedores: "MARIOGONZALEZ (544) — concentrado", plan: "MEJOR tasa mov (83%), pero baja entrega. Mejorar logistica" },
  { nombre: "urielparedes219", ene: 166, feb: 272, mar: 411, meta: 450, pctMov: 95, pctEnt: 0, proveedores: "TIENDAOFERTAS (411)", plan: "95% mov (!). Modelo a replicar. Analizar que productos vende" },
];

const TIER2 = [
  { nombre: "guilherme (recuperar)", mar: 272, meta: 400, via: "Recuperar parcial (era 2,326 en Ene). Objetivo conservador." },
  { nombre: "caiorodrigo55", mar: 239, meta: 300, via: "Migro de Oscar a TIENDAOFERTAS. Reconstruyendo." },
  { nombre: "mercaplus.chile.cl", mar: 237, meta: 300, via: "Nuevo. Mercado Chile = nueva geografia. Alto potencial." },
  { nombre: "casanoblear", mar: 227, meta: 250, via: "Nuevo en Mar. Buen %mov. Validar continuidad." },
  { nombre: "yurihenri (recuperar)", mar: 165, meta: 250, via: "Era 1,061 en Ene. Meta conservadora. Sigue activo." },
  { nombre: "damdmr399", mar: 138, meta: 150, via: "Estable y confiable. Empujar para superar 200." },
  { nombre: "briancativa", mar: 142, meta: 150, via: "AlejandroSeijas. Conectar con proveedores mas grandes." },
  { nombre: "juanideituzaingo", mar: 108, meta: 200, via: "1>22>108. Crecimiento explosivo. Alto potencial." },
  { nombre: "neriz459", mar: 4, meta: 100, via: "70 en Feb. Cayo en Mar. Reactivar." },
  { nombre: "gustavohenriq", mar: 73, meta: 100, via: "Nuevo en Mar. TIENDAOFERTAS. Escalar." },
  { nombre: "rickyhesleyft15", mar: 69, meta: 100, via: "Nuevo en Mar. TIENDAOFERTAS. Potencial alto." },
  { nombre: "shoppronto.co", mar: 62, meta: 100, via: "Nuevo en Mar. TIENDAOFERTAS. Crecimiento esperado." },
];

const DS_RESCATAR = [
  { nombre: "guilherme.t.santos.gt", ene: 2326, feb: 856, mar: 272, potencial: "Era #1 absoluto. 2,326 en Ene", accion: "CONTACTAR URGENTE. Entender que paso. Ofrecer condiciones" },
  { nombre: "yurihenri", ene: 1061, feb: 756, mar: 165, potencial: "1,061 en Ene. Sigue activo pero minimo", accion: "Entrevistar, oferta mejorada. Puede volver a 500+" },
  { nombre: "ecomcirclearg", ene: 389, feb: 441, mar: 0, potencial: "441 en Feb y desaparecio", accion: "Investigar salida. Si comercial, ofrecer" },
  { nombre: "lackagente", ene: 396, feb: 122, mar: 0, potencial: "Trabajaba con 3+ proveedores y se fue", accion: "Posible salida del negocio. Investigar" },
  { nombre: "abstra33", ene: 219, feb: 177, mar: 22, potencial: "TN depende de este DS", accion: "Recuperar para TN, o migrar a otro proveedor" },
];

const TIERS_MODELO = [
  { tier: "Tier 1 (>500)", marDS: 4, marOrdDS: 1018, marOrd: 4073, abrDS: 5, abrOrdDS: 1280, abrOrd: 6400, color: "#F59E0B" },
  { tier: "Tier 2 (100-500)", marDS: 7, marOrdDS: 215, marOrd: 1502, abrDS: 12, abrOrdDS: 270, abrOrd: 3240, color: "#F97316" },
  { tier: "Tier 3 (20-99)", marDS: 25, marOrdDS: 88, marOrd: 2200, abrDS: 30, abrOrdDS: 88, abrOrd: 2640, color: "#3B82F6" },
  { tier: "Tier 4 (<20)", marDS: 40, marOrdDS: 66, marOrd: 2628, abrDS: 48, abrOrdDS: 20, abrOrd: 960, color: "#6B7280" },
];

// --- CALENDARIO ---
const CALENDARIO_DIAS = [
  { sem: "Sem 0", dias: [
    { dia: "Mar", fecha: "1-Abr", metaIng: 388, metaMov: 291 },
    { dia: "Mie", fecha: "2-Abr", metaIng: 388, metaMov: 291 },
    { dia: "Jue", fecha: "3-Abr", metaIng: 388, metaMov: 291 },
    { dia: "Vie", fecha: "4-Abr", metaIng: 388, metaMov: 291 },
  ]},
  { sem: "Sem 1", dias: [
    { dia: "Lun", fecha: "7-Abr", metaIng: 411, metaMov: 308 },
    { dia: "Mar", fecha: "8-Abr", metaIng: 411, metaMov: 308 },
    { dia: "Mie", fecha: "9-Abr", metaIng: 411, metaMov: 308 },
    { dia: "Jue", fecha: "10-Abr", metaIng: 411, metaMov: 308 },
    { dia: "Vie", fecha: "11-Abr", metaIng: 411, metaMov: 308 },
  ]},
  { sem: "Sem 2", dias: [
    { dia: "Lun", fecha: "14-Abr", metaIng: 569, metaMov: 427 },
    { dia: "Mar", fecha: "15-Abr", metaIng: 569, metaMov: 427 },
    { dia: "Mie", fecha: "16-Abr", metaIng: 569, metaMov: 427 },
    { dia: "Jue", fecha: "17-Abr", metaIng: 569, metaMov: 427 },
    { dia: "Vie", fecha: "18-Abr", metaIng: 569, metaMov: 427 },
  ]},
  { sem: "Sem 3", dias: [
    { dia: "Lun", fecha: "21-Abr", metaIng: 727, metaMov: 545 },
    { dia: "Mar", fecha: "22-Abr", metaIng: 727, metaMov: 545 },
    { dia: "Mie", fecha: "23-Abr", metaIng: 727, metaMov: 545 },
    { dia: "Jue", fecha: "24-Abr", metaIng: 727, metaMov: 545 },
    { dia: "Vie", fecha: "25-Abr", metaIng: 727, metaMov: 545 },
  ]},
  { sem: "Sem 4", dias: [
    { dia: "Lun", fecha: "28-Abr", metaIng: 822, metaMov: 616 },
    { dia: "Mar", fecha: "29-Abr", metaIng: 822, metaMov: 616 },
    { dia: "Mie", fecha: "30-Abr", metaIng: 822, metaMov: 616 },
  ]},
];

const DS_TRAYECTORIA = [
  { sem: "Cierre Mar", t1: 4, t2: 7, t3: 25, t4: 40, total: 76, nuevos: 0 },
  { sem: "Sem 0", t1: 4, t2: 7, t3: 25, t4: 40, total: 76, nuevos: 0 },
  { sem: "Sem 1", t1: 4, t2: 8, t3: 26, t4: 42, total: 80, nuevos: 4 },
  { sem: "Sem 2", t1: 5, t2: 9, t3: 27, t4: 44, total: 85, nuevos: 5 },
  { sem: "Sem 3", t1: 5, t2: 11, t3: 28, t4: 46, total: 90, nuevos: 5 },
  { sem: "Sem 4", t1: 5, t2: 12, t3: 30, t4: 48, total: 95, nuevos: 5 },
];

const HEADCOUNT = [
  { fuente: "DS activos de Marzo que se mantienen", ds: 65, ordenes: 8900, accion: "Sostener base actual. No perder a nadie." },
  { fuente: "DS de Marzo que escalan (Tier 1+2 crecientes)", ds: 6, ordenes: 2760, accion: "Upside de los 17 DS Tier 1+2 ya existentes." },
  { fuente: "DS recuperados (guilherme, yurihenri, ecomcircle, abstra)", ds: 4, ordenes: 900, accion: "Contactar Sem 1. Ofrecer condiciones mejoradas." },
  { fuente: "DS nuevos captados en Abril", ds: 10, ordenes: 700, accion: "5 Sem 2, 5 Sem 3. Kit de onboarding listo." },
  { fuente: "DS de proveedores reactivados", ds: 10, ordenes: 500, accion: "Depende de reactivar proveedores dormidos." },
  { fuente: "Buffer de seguridad (nuevos organicos)", ds: 0, ordenes: 2240, accion: "Mar trajo pascu.ecom con 927. Puede pasar de nuevo." },
];

// --- STOCK ---
const STOCK = [
  { prioridad: "CRITICA", categoria: "Suplementos: Shilajit, Magnesio, Creatina, Aceite Oregano", udsQ1: 6271, stockAbr: 9500, proveedor: "MERX Lab, MerxLab", color: "#EF4444" },
  { prioridad: "CRITICA", categoria: "Mini Afeitadora Recargable (#1 producto)", udsQ1: 4889, stockAbr: 7500, proveedor: "TIENDAOFERTAS", color: "#EF4444" },
  { prioridad: "CRITICA", categoria: "Ropa/Modelado: Body, Corpinos, Corrector Postura", udsQ1: 3594, stockAbr: 5600, proveedor: "TIENDAOFERTAS, MARIOGONZALEZ", color: "#EF4444" },
  { prioridad: "CRITICA", categoria: "Electro Estimuladores (3en1, Gluteos, Abdominal)", udsQ1: 2676, stockAbr: 4200, proveedor: "TIENDAOFERTAS, MARIOGONZALEZ", color: "#EF4444" },
  { prioridad: "ALTA", categoria: "Hogar: Repelente Electronico, Aspiradora, Manguera", udsQ1: 2757, stockAbr: 4200, proveedor: "MERX Lab, ARGENTINAADMA", color: "#F59E0B" },
  { prioridad: "ALTA", categoria: "Gafas/Lentes: Kit Gafas X2, Lentes Bluetooth", udsQ1: 2182, stockAbr: 3400, proveedor: "MARIOGONZALEZ, TIENDAOFERTAS", color: "#F59E0B" },
  { prioridad: "ALTA", categoria: "Linternas Tacticas (Dazzel, XLamp, Solar)", udsQ1: 2104, stockAbr: 3200, proveedor: "TIENDAOFERTAS, OscarCoronado", color: "#F59E0B" },
  { prioridad: "MEDIA", categoria: "Drones/Electronica: Drone E88, Mini Camara Espia", udsQ1: 1060, stockAbr: 1600, proveedor: "OscarCoronado, MaicolPerez", color: "#3B82F6" },
];

// --- PLAN SEMANA 1 ---
const SEMANA1 = [
  { dia: "LUN 6", actividades: [
    { tarea: "Onboarding equipo: Presentar plan, explicar Q1, asignar proveedores/DS por comercial", responsable: "Lider comercial", entregable: "Asignacion de cuentas definida" },
    { tarea: "Revisar stock disponible vs stock sugerido. Marcar faltantes criticos", responsable: "Operaciones + Comercial", entregable: "Lista de faltantes con ETA" },
  ]},
  { dia: "MAR 7", actividades: [
    { tarea: "Contactar a multiventasxargentina y pascu.ecom (Tier 1). Ofrecer condiciones VIP", responsable: "Comercial asignado", entregable: "Feedback de DS registrado" },
    { tarea: "Llamar a guilherme y yurihenri. Entender por que bajaron. Ofrecer incentivos", responsable: "Comercial asignado", entregable: "Diagnostico de cada DS" },
  ]},
  { dia: "MIE 8", actividades: [
    { tarea: "Contactar a joao.oliveira, mdelarosa, urielparedes (Tier 1-2). Plan de escala", responsable: "Comercial asignado", entregable: "Plan personalizado por DS" },
    { tarea: "Revisar catalogo de Oscar y Maicol. Comparar vs TIENDAOFERTAS. Identificar brechas", responsable: "Comercial + Producto", entregable: "Analisis comparativo" },
  ]},
  { dia: "JUE 9", actividades: [
    { tarea: "Contactar proveedores dormidos (DaniiDiaz, LizDiaz, FLUENSTORE). Evaluar reactivacion", responsable: "Comercial asignado", entregable: "Lista de si/no reactivar" },
    { tarea: "Investigar mercaplus.chile.cl y casanoblear. Evaluar potencial de crecimiento", responsable: "Comercial asignado", entregable: "Perfil de cada DS nuevo" },
  ]},
  { dia: "VIE 10", actividades: [
    { tarea: "Reunion de cierre semana: resultados de contactos, ajustar metas, prioridades semana 2", responsable: "Todo el equipo", entregable: "Dashboard actualizado" },
    { tarea: "Armar paquete de onboarding para captar nuevos DS la semana siguiente", responsable: "Comercial + Marketing", entregable: "Kit de captacion listo" },
  ]},
];

const KPIS_SEMANALES = [
  { kpi: "Ordenes Ingresadas totales", metaSem: "3,167", metaMes: "12,667", freq: "Diaria" },
  { kpi: "Ordenes Movilizadas", metaSem: "2,375", metaMes: "9,500", freq: "Diaria" },
  { kpi: "% Movilizacion", metaSem: "75%", metaMes: "75%", freq: "Semanal" },
  { kpi: "DS activos con >100 ordenes", metaSem: "5+", metaMes: "20+", freq: "Semanal" },
  { kpi: "DS Tier 1 contactados", metaSem: "4/4", metaMes: "4/4 con plan activo", freq: "Sem 1" },
  { kpi: "DS caidos contactados", metaSem: "3/5", metaMes: "5/5 con diagnostico", freq: "Sem 1-2" },
  { kpi: "Nuevos DS captados", metaSem: "1-2", metaMes: "5-10", freq: "Mensual" },
  { kpi: "Stock critico cubierto", metaSem: "50%", metaMes: "100%", freq: "Sem 1-2" },
];

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

type Tab = "plan" | "proveedores" | "dropshippers" | "calendario" | "stock" | "resumen";

export default function ArgentinaPlanAbril() {
  const [tab, setTab] = useState<Tab>("plan");
  const [expandedEst, setExpandedEst] = useState<number | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "plan", label: "Plan Estrategico" },
    { key: "proveedores", label: "Proveedores" },
    { key: "dropshippers", label: "Dropshippers" },
    { key: "calendario", label: "Calendario" },
    { key: "stock", label: "Stock & KPIs" },
    { key: "resumen", label: "Road to 9.5K" },
  ];

  return (
    <ChartDownloadBtn filename="Plan_Abril_Argentina">
    <div className="glass-card p-6 border-sky-500/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📋 Plan Comercial Abril 2026 — Argentina
          </h2>
          <p className="text-xs text-gray-400">
            Meta: <span className="text-sky-400 font-bold">12,667</span> ingresadas / <span className="text-yellow-400 font-bold">9,500</span> movilizadas &middot; Gap vs Marzo: +2,251 (+22%) &middot; Inicio: Lunes 6 de Abril
          </p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-[11px] px-3 py-1.5 rounded-lg transition-all ${
                tab === key
                  ? "text-white shadow-lg" : "bg-transparent text-gray-400 border border-gray-700 hover:border-sky-500/40"
              }`}
              style={tab === key ? { background: "#74ACDF" } : {}}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ PLAN ESTRATEGICO (texto) ═══ */}
      {tab === "plan" && (
        <div className="space-y-6">
          {/* Resumen ejecutivo */}
          <div className="rounded-xl p-5 border border-sky-500/20" style={{ background: "rgba(116,172,223,0.05)" }}>
            <h3 className="text-base font-bold text-white mb-3">1. Resumen Ejecutivo</h3>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              <div className="rounded-lg p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Donde estamos</p>
                <p>En Q1 (Enero-Marzo) procesamos <span className="text-sky-400 font-bold">30,512</span> ordenes ingresadas con <span className="text-yellow-400 font-bold">22,936</span> movilizadas (75% tasa de movilizacion). Operamos con 26 proveedores y cientos de dropshippers. El volumen mensual promedio fue ~10,170 ordenes ingresadas.</p>
                <p className="mt-2">El negocio esta en un <span className="text-orange-400 font-medium">punto de inflexion</span>: los proveedores historicos estan cayendo, pero nuevos actores crecen rapido.</p>
              </div>
              <div className="rounded-lg p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.03)" }}>
                <p className="text-xs text-red-400 uppercase font-bold mb-1">El desafio</p>
                <p>Meta Abril: <span className="text-white font-bold">12,667 ordenes ingresadas</span> (+22% vs Marzo) para lograr 9,500 movilizadas. Esto significa generar <span className="text-red-400 font-bold">2,251 ordenes adicionales</span> por mes.</p>
              </div>
              <div className="rounded-lg p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.03)" }}>
                <p className="text-xs text-green-400 uppercase font-bold mb-1">Por que es posible</p>
                <ol className="list-decimal list-inside space-y-1 text-[13px]">
                  <li>Los proveedores crecientes (<span className="text-white">TIENDAOFERTAS, MERX Lab, MARIOGONZALEZ</span>) ya estan en trayectoria exponencial</li>
                  <li>Nuevos dropshippers de alto volumen aparecieron en Marzo (<span className="text-white">pascu.ecom: 927 ordenes</span> en su primer mes)</li>
                  <li>Los dropshippers que dejaron proveedores en caida <span className="text-green-400">NO dejaron el ecosistema</span> — migraron a proveedores mejores</li>
                  <li>Hay proveedores dormidos (DaniiDiaz, LizDiaz, FLUENSTORE, TN) con historial de 400-950 ordenes/mes reactivables</li>
                  <li>El mix de productos tiene categorias con demanda creciente (suplementos, belleza) que traccionan bien</li>
                </ol>
              </div>
            </div>
          </div>

          {/* 5 Estrategias escritas */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">2. Las 5 Estrategias para llegar a 12,667</h3>

            {/* E1 */}
            <div className="rounded-xl border border-green-500/20 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer" style={{ background: "rgba(16,185,129,0.08)" }} onClick={() => setExpandedEst(expandedEst === 1 ? null : 1)}>
                <div>
                  <span className="text-green-400 font-bold text-sm">E1. Escalar Proveedores en Crecimiento</span>
                  <span className="text-xs text-gray-400 ml-2">+3,700 ordenes</span>
                </div>
                <span className="text-lg font-black text-green-400">Meta: 10,800</span>
              </div>
              {expandedEst === 1 && (
                <div className="px-4 py-3 text-[13px] text-gray-300 space-y-2 border-t border-green-500/10">
                  <p><span className="text-white font-medium">Objetivo:</span> Llevar a TIENDAOFERTAS, MERX Lab, MARIOGONZALEZ, MerxLab y RaulGonzalez al maximo de su trayectoria.</p>
                  <p className="text-xs text-green-400 font-bold uppercase mt-2">Acciones:</p>
                  <ul className="space-y-1.5 ml-4">
                    <li className="flex gap-2"><span className="text-green-400 shrink-0">&rsaquo;</span> Asignar 1 comercial dedicado a <span className="text-white">TIENDAOFERTAS + MerxLab</span> (los de mayor crecimiento)</li>
                    <li className="flex gap-2"><span className="text-green-400 shrink-0">&rsaquo;</span> Asignar 1 comercial a <span className="text-white">MERX Lab + MARIOGONZALEZ</span> (volumen alto, multiples DS crecientes)</li>
                    <li className="flex gap-2"><span className="text-green-400 shrink-0">&rsaquo;</span> Garantizar stock de los productos que mas venden estos proveedores</li>
                    <li className="flex gap-2"><span className="text-green-400 shrink-0">&rsaquo;</span> Trabajar con <span className="text-white">pascu.ecom</span> para escalar de 927 a 1,200+ (ofrecer catalogo ampliado, soporte logistico)</li>
                    <li className="flex gap-2"><span className="text-green-400 shrink-0">&rsaquo;</span> Empujar a <span className="text-white">multiventasxargentina</span> a diversificar en mas proveedores (ya trabaja con 5, puede ir a 7)</li>
                    <li className="flex gap-2"><span className="text-green-400 shrink-0">&rsaquo;</span> Conectar a <span className="text-white">joao.oliveira</span> con TIENDAOFERTAS y MERX Lab (solo esta en MARIO, tiene 83% mov)</li>
                    <li className="flex gap-2"><span className="text-green-400 shrink-0">&rsaquo;</span> Explotar el mercado Chile con <span className="text-white">mercaplus.chile.cl</span> — posible puerta de entrada a nueva geografia</li>
                  </ul>
                </div>
              )}
            </div>

            {/* E2 */}
            <div className="rounded-xl border border-yellow-500/20 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer" style={{ background: "rgba(245,158,11,0.08)" }} onClick={() => setExpandedEst(expandedEst === 2 ? null : 2)}>
                <div>
                  <span className="text-yellow-400 font-bold text-sm">E2. Frenar la Caida de Oscar y Maicol</span>
                  <span className="text-xs text-gray-400 ml-2">+1,060 ordenes</span>
                </div>
                <span className="text-lg font-black text-yellow-400">Meta: 3,300</span>
              </div>
              {expandedEst === 2 && (
                <div className="px-4 py-3 text-[13px] text-gray-300 space-y-2 border-t border-yellow-500/10">
                  <p><span className="text-white font-medium">Objetivo:</span> No se trata de volver a Enero — se trata de estabilizar y redirigir.</p>
                  <p className="text-xs text-yellow-400 font-bold uppercase mt-2">Acciones:</p>
                  <ul className="space-y-1.5 ml-4">
                    <li className="flex gap-2"><span className="text-yellow-400 shrink-0">&rsaquo;</span> <span className="text-red-400 font-bold">URGENTE:</span> Contactar a guilherme.t.santos.gt (era #1 con 2,326 ordenes en Ene, colapso a 272)</li>
                    <li className="flex gap-2"><span className="text-yellow-400 shrink-0">&rsaquo;</span> Investigar por que guilherme se fue de TN (362&gt;0), MARIO (356&gt;0), y bajo en todos. Es personal o comercial?</li>
                    <li className="flex gap-2"><span className="text-yellow-400 shrink-0">&rsaquo;</span> Contactar a <span className="text-white">yurihenri</span> (1,061 en Ene &gt; 165 en Mar). Sigue activo pero minimo. Ofrecer mejores condiciones</li>
                    <li className="flex gap-2"><span className="text-yellow-400 shrink-0">&rsaquo;</span> Renovar catalogo de Oscar y Maicol con productos trending (suplementos, afeitadoras que venden en TIENDAOFERTAS)</li>
                    <li className="flex gap-2"><span className="text-yellow-400 shrink-0">&rsaquo;</span> Evaluar si Oscar/Maicol ofrecen peores condiciones que TIENDAOFERTAS (caiorodrigo55 migro completamente)</li>
                    <li className="flex gap-2"><span className="text-yellow-400 shrink-0">&rsaquo;</span> Si las condiciones no son competitivas, ayudarlos a ajustar para retener DS</li>
                  </ul>
                </div>
              )}
            </div>

            {/* E3 */}
            <div className="rounded-xl border border-purple-500/20 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer" style={{ background: "rgba(139,92,246,0.08)" }} onClick={() => setExpandedEst(expandedEst === 3 ? null : 3)}>
                <div>
                  <span className="text-purple-400 font-bold text-sm">E3. Rescatar DS de Alto Volumen Inactivos</span>
                  <span className="text-xs text-gray-400 ml-2">+500 ordenes</span>
                </div>
                <span className="text-lg font-black text-purple-400">Meta: 500</span>
              </div>
              {expandedEst === 3 && (
                <div className="px-4 py-3 text-[13px] text-gray-300 space-y-2 border-t border-purple-500/10">
                  <p><span className="text-white font-medium">Objetivo:</span> Recuperar al menos 3 de los 5 dropshippers grandes que pararon en Q1.</p>
                  <p className="text-xs text-purple-400 font-bold uppercase mt-2">Acciones:</p>
                  <ul className="space-y-1.5 ml-4">
                    <li className="flex gap-2"><span className="text-purple-400 shrink-0">&rsaquo;</span> <span className="text-white">Prioridad 1: guilherme</span> — si vuelve a la mitad de su Enero, son +1,000 ordenes</li>
                    <li className="flex gap-2"><span className="text-purple-400 shrink-0">&rsaquo;</span> <span className="text-white">Prioridad 2: yurihenri</span> — sigue activo (165/mes), con incentivos puede volver a 500+</li>
                    <li className="flex gap-2"><span className="text-purple-400 shrink-0">&rsaquo;</span> <span className="text-white">Prioridad 3: ecomcirclearg</span> — 441 en Feb y desaparecio. Investigar motivo, reconectar con MARIO</li>
                    <li className="flex gap-2"><span className="text-purple-400 shrink-0">&rsaquo;</span> lackagente se fue de 3 proveedores simultaneamente — posible salida del negocio, menor prioridad</li>
                    <li className="flex gap-2"><span className="text-purple-400 shrink-0">&rsaquo;</span> Ofrecer onboarding express: catalogo nuevo + mejores condiciones</li>
                  </ul>
                </div>
              )}
            </div>

            {/* E4 */}
            <div className="rounded-xl border border-orange-500/20 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer" style={{ background: "rgba(249,115,22,0.08)" }} onClick={() => setExpandedEst(expandedEst === 4 ? null : 4)}>
                <div>
                  <span className="text-orange-400 font-bold text-sm">E4. Reactivar Proveedores Dormidos</span>
                  <span className="text-xs text-gray-400 ml-2">+630 ordenes</span>
                </div>
                <span className="text-lg font-black text-orange-400">Meta: 550</span>
              </div>
              {expandedEst === 4 && (
                <div className="px-4 py-3 text-[13px] text-gray-300 space-y-2 border-t border-orange-500/10">
                  <p><span className="text-white font-medium">Objetivo:</span> Volver a activar DaniiDiaz, LizDiaz, FLUENSTORE y TN a niveles minimos.</p>
                  <p className="text-xs text-orange-400 font-bold uppercase mt-2">Acciones:</p>
                  <ul className="space-y-1.5 ml-4">
                    <li className="flex gap-2"><span className="text-orange-400 shrink-0">&rsaquo;</span> <span className="text-white">DaniiDiaz + LizDiaz</span> comparten dropshippers — si se reactiva uno, el otro puede seguir</li>
                    <li className="flex gap-2"><span className="text-orange-400 shrink-0">&rsaquo;</span> <span className="text-white">FLUENSTORE</span> necesita reemplazar a lackagente. Buscar DS nuevos para este proveedor</li>
                    <li className="flex gap-2"><span className="text-orange-400 shrink-0">&rsaquo;</span> <span className="text-white">TN</span> depende de recuperar a abstra33 (219&gt;22). Si no vuelve, buscar 2-3 DS medianos</li>
                    <li className="flex gap-2"><span className="text-orange-400 shrink-0">&rsaquo;</span> No invertir mucho tiempo aca — prioridad es escalar los crecientes, esto es bonus</li>
                  </ul>
                </div>
              )}
            </div>

            {/* E5 */}
            <div className="rounded-xl border border-sky-500/20 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer" style={{ background: "rgba(116,172,223,0.08)" }} onClick={() => setExpandedEst(expandedEst === 5 ? null : 5)}>
                <div>
                  <span className="text-sky-400 font-bold text-sm">E5. Captar Nuevos Dropshippers</span>
                  <span className="text-xs text-gray-400 ml-2">+350 ordenes</span>
                </div>
                <span className="text-lg font-black text-sky-400">Meta: 1,000</span>
              </div>
              {expandedEst === 5 && (
                <div className="px-4 py-3 text-[13px] text-gray-300 space-y-2 border-t border-sky-500/10">
                  <p><span className="text-white font-medium">Objetivo:</span> Traer 5-10 dropshippers nuevos que generen 100+ ordenes/mes cada uno.</p>
                  <p className="text-xs text-sky-400 font-bold uppercase mt-2">Acciones:</p>
                  <ul className="space-y-1.5 ml-4">
                    <li className="flex gap-2"><span className="text-sky-400 shrink-0">&rsaquo;</span> Marzo ya mostro que funciona: <span className="text-white">pascu.ecom (927), casanoblear (227), mercaplus.chile (237)</span> — todos nuevos</li>
                    <li className="flex gap-2"><span className="text-sky-400 shrink-0">&rsaquo;</span> Usar la red de TIENDAOFERTAS y MARIOGONZALEZ como imanes (son los que mejor atraen DS nuevos)</li>
                    <li className="flex gap-2"><span className="text-sky-400 shrink-0">&rsaquo;</span> Crear paquete de onboarding: catalogo curado de top 20 productos + soporte logistico las primeras 2 semanas</li>
                    <li className="flex gap-2"><span className="text-sky-400 shrink-0">&rsaquo;</span> Buscar DS que trabajan con competidores fuera del ecosistema, no solo migrar internamente</li>
                    <li className="flex gap-2"><span className="text-sky-400 shrink-0">&rsaquo;</span> Meta: que en Abril entren minimo <span className="text-white">5 DS nuevos con &gt;50 ordenes en su primer mes</span></li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Consolidado */}
          <div className="rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(116,172,223,0.1)" }}>
                  <th className="text-left py-2 px-3 text-gray-400">Estrategia</th>
                  <th className="text-right py-2 px-3 text-gray-400">Meta</th>
                  <th className="text-right py-2 px-3 text-gray-400">% Total</th>
                  <th className="text-center py-2 px-3 text-gray-400">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "E1. Escalar crecientes", meta: 8450, pct: 67, pri: "MAXIMA", color: "#10B981" },
                  { name: "E2. Frenar caida top 2", meta: 2600, pct: 20, pri: "ALTA", color: "#F59E0B" },
                  { name: "E3. Rescatar DS inactivos", meta: 400, pct: 3, pri: "MEDIA", color: "#8B5CF6" },
                  { name: "E4. Reactivar dormidos", meta: 450, pct: 4, pri: "BAJA", color: "#F97316" },
                  { name: "E5. Captar nuevos DS", meta: 800, pct: 6, pri: "ALTA", color: "#74ACDF" },
                ].map((e) => (
                  <tr key={e.name} className="border-t border-gray-800/50">
                    <td className="py-2 px-3 text-white font-medium">{e.name}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: e.color }}>{e.meta.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-400">{e.pct}%</td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: e.color + "20", color: e.color }}>{e.pri}</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-sky-500/30 font-bold">
                  <td className="py-2 px-3 text-white">TOTAL PROYECTADO</td>
                  <td className="py-2 px-3 text-right text-sky-400 text-sm">12,700</td>
                  <td className="py-2 px-3 text-right text-gray-400">100%</td>
                  <td className="py-2 px-3 text-center text-[10px] text-green-400">+0.3% margen</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mensaje final */}
          <div className="rounded-xl p-4 border border-sky-500/20" style={{ background: "rgba(116,172,223,0.05)" }}>
            <p className="text-sm text-gray-300 leading-relaxed">
              El objetivo de 12,667 ordenes es alcanzable. La buena noticia: el ecosistema <span className="text-green-400 font-medium">no esta perdiendo dropshippers, los esta redistribuyendo</span>. Los vendedores mas fuertes estan migrando a proveedores con mejor oferta. Nuestra tarea es <span className="text-white font-medium">acelerar esa tendencia, rescatar a los que se cayeron, y asegurar que el stock y las condiciones esten a la altura del crecimiento</span>.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Los primeros 10 dias son criticos: si contactamos a los DS clave y aseguramos stock, el momentum de Marzo se convierte en la base de Abril. Si no actuamos rapido, el impulso se pierde.
            </p>
          </div>
        </div>
      )}

      {/* ═══ PROVEEDORES ═══ */}
      {tab === "proveedores" && (
        <div className="space-y-6">
          {/* Panorama Q1 */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Ene Ing", val: "10,720", color: "#9ca3af" },
              { label: "Feb Ing", val: "9,389", color: "#9ca3af" },
              { label: "Mar Ing", val: "10,403", color: "#9ca3af" },
              { label: "Q1 Total", val: "30,512", color: "#74ACDF" },
              { label: "META ABR", val: "12,667", color: "#F6B40E" },
              { label: "Gap vs Mar", val: "+5,597", color: "#EF4444" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl p-3 border border-gray-800 text-center" style={{ background: "rgba(15,52,96,0.15)" }}>
                <p className="text-[10px] text-gray-500 uppercase">{k.label}</p>
                <p className="text-lg font-bold" style={{ color: k.color }}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* Chart: proveedores Q1 evolution */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Evolucion Q1 — Top Proveedores</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[...PROV_CRECIMIENTO, ...PROV_CAIDA].map((p) => ({
                name: p.nombre.length > 14 ? p.nombre.slice(0, 14) + "..." : p.nombre,
                Enero: p.ene,
                Febrero: p.feb,
                Marzo: p.mar,
                "Meta Abr": p.meta,
              }))} layout="vertical" margin={{ left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 9 }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="Enero" fill="#6B7280" barSize={5} />
                <Bar dataKey="Febrero" fill="#9ca3af" barSize={5} />
                <Bar dataKey="Marzo" fill="#74ACDF" barSize={5} />
                <Bar dataKey="Meta Abr" fill="#F6B40E" barSize={5} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* En Crecimiento */}
          <div>
            <h3 className="text-sm font-bold text-green-400 mb-3">Proveedores en Crecimiento (motor del objetivo) — Meta: 10,800</h3>
            <div className="space-y-2">
              {PROV_CRECIMIENTO.map((p) => (
                <div key={p.nombre} className="p-3 rounded-xl border border-green-500/10" style={{ background: "rgba(16,185,129,0.03)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium text-white">{p.nombre}</span>
                    <div className="flex gap-2 text-[10px]">
                      <span className="text-gray-500">Ene: {p.ene.toLocaleString()}</span>
                      <span className="text-gray-400">Feb: {p.feb.toLocaleString()}</span>
                      <span className="text-sky-400">Mar: {p.mar.toLocaleString()}</span>
                      <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">Meta: {p.meta.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">DS: {p.ds}</p>
                  <p className="text-[11px] text-green-400 mt-0.5">{p.estrategia}</p>
                  <div className="w-full h-1.5 rounded-full bg-gray-800 mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min((p.mar / p.meta) * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* En Caida */}
          <div>
            <h3 className="text-sm font-bold text-yellow-400 mb-3">Proveedores en Caida (oportunidad de recuperacion) — Meta: 3,750</h3>
            <div className="space-y-2">
              {PROV_CAIDA.map((p) => {
                const caida = ((p.mar - p.ene) / p.ene * 100).toFixed(0);
                return (
                  <div key={p.nombre} className="p-3 rounded-xl border border-yellow-500/10" style={{ background: "rgba(245,158,11,0.03)" }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{p.nombre}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{caida}% Ene&rarr;Mar</span>
                      </div>
                      <div className="flex gap-2 text-[10px]">
                        <span className="text-gray-500">Ene: {p.ene.toLocaleString()}</span>
                        <span className="text-gray-400">Feb: {p.feb.toLocaleString()}</span>
                        <span className="text-red-400">Mar: {p.mar.toLocaleString()}</span>
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">Meta: {p.meta.toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Que paso: {p.ds}</p>
                    <p className="text-[11px] text-yellow-400 mt-0.5">{p.estrategia}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dormidos */}
          <div>
            <h3 className="text-sm font-bold text-orange-400 mb-3">Proveedores Dormidos / En Riesgo — Meta: 550</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PROV_DORMIDOS.map((p) => (
                <div key={p.nombre} className="p-3 rounded-xl border border-orange-500/10" style={{ background: "rgba(249,115,22,0.03)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{p.nombre}</span>
                    <span className="text-[10px] text-orange-400 font-bold">Meta: {p.meta}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] mt-1">
                    <span className="text-gray-500">Pico Q1: {p.pico}</span>
                    <span className="text-red-400">Mar: {p.mar}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{p.accion}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Menores estables note */}
          <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.1)" }}>
            <p className="text-xs text-gray-300"><span className="text-sky-400 font-bold">Proveedores Menores Estables</span> — ARGENTINAADMA, AlejandroSeijas, PaulVandenbroele, YoelMenayed, MorenaSantucci, ROCKETROCKET, ACMELAB y otros. Marzo combinado: 778 ordenes. <span className="text-yellow-400">Meta Abril: 1,130 ordenes (+45%)</span>. ROCKETROCKET esta creciendo (9&gt;34), PaulVandenbroele (46&gt;75).</p>
          </div>
        </div>
      )}

      {/* ═══ DROPSHIPPERS ═══ */}
      {tab === "dropshippers" && (
        <div className="space-y-6">
          {/* Insight */}
          <div className="rounded-xl p-3 border border-sky-500/20 text-xs text-gray-300" style={{ background: "rgba(116,172,223,0.05)" }}>
            <span className="text-sky-400 font-bold">Hallazgo clave:</span> Los dropshippers NO son exclusivos de un proveedor. Los mejores trabajan con 3-5 proveedores simultaneamente, y migran hacia donde encuentran mejor oferta, stock y condiciones. Esto es una oportunidad.
          </div>

          {/* Tier model */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Modelo de Tiers: De 76 a 95 DS activos (+25%)</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TIERS_MODELO.map((t) => (
                <div key={t.tier} className="rounded-xl p-4 border" style={{ borderColor: t.color + "30", background: t.color + "08" }}>
                  <p className="text-xs font-bold text-white mb-2">{t.tier}</p>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <p className="text-gray-500">Marzo</p>
                      <p className="text-gray-300">{t.marDS} DS &times; {t.marOrdDS}/DS</p>
                      <p className="font-bold" style={{ color: t.color }}>{t.marOrd.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Meta Abril</p>
                      <p className="text-white font-medium">{t.abrDS} DS &times; {t.abrOrdDS}/DS</p>
                      <p className="font-bold" style={{ color: t.color }}>{t.abrOrd.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220} className="mt-4">
              <BarChart data={TIERS_MODELO.map((t) => ({ name: t.tier, "Marzo": t.marOrd, "Meta Abril": t.abrOrd }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 12 }} formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="Marzo" fill="#6B7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Meta Abril" fill="#74ACDF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tier 1 Detail */}
          <div>
            <h3 className="text-sm font-bold text-yellow-400 mb-3">Tier 1 — Mega Dropshippers (&gt;500 ord/mes) — Atencion VIP</h3>
            <div className="space-y-2">
              {TIER1.map((d, i) => (
                <div key={d.nombre} className="p-3 rounded-xl border border-yellow-500/10" style={{ background: "rgba(245,158,11,0.03)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 text-white" style={{ background: "linear-gradient(135deg, #74ACDF, #F6B40E)" }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{d.nombre}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">Meta: {d.meta.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-500">%Mov: {d.pctMov}%</span>
                        {d.pctEnt > 0 && <span className="text-[10px] text-gray-500">%Ent: {d.pctEnt}%</span>}
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px]">
                        <span className="text-gray-500">Ene: {d.ene}</span>
                        <span className="text-gray-400">Feb: {d.feb.toLocaleString()}</span>
                        <span className="text-sky-400 font-bold">Mar: {d.mar.toLocaleString()}</span>
                        <span className="text-green-400">+{((d.meta / d.mar - 1) * 100).toFixed(0)}% necesario</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Proveedores: {d.proveedores}</p>
                      <p className="text-[10px] text-yellow-400 mt-0.5">{d.plan}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier 2 Detail */}
          <div>
            <h3 className="text-sm font-bold text-orange-400 mb-3">Tier 2 — 12 Dropshippers en Aceleracion (100-500 ord/mes)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {TIER2.map((d) => (
                <div key={d.nombre} className="p-2.5 rounded-xl border border-orange-500/10 flex items-center gap-3" style={{ background: "rgba(249,115,22,0.03)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{d.nombre}</span>
                      <span className="text-[10px] text-orange-400 font-bold">Meta: {d.meta}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{d.via}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">Mar: {d.mar}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DS a Rescatar */}
          <div>
            <h3 className="text-sm font-bold text-red-400 mb-3">DS Grandes en Caida — Rescatar</h3>
            <div className="space-y-2">
              {DS_RESCATAR.map((d) => (
                <div key={d.nombre} className="p-3 rounded-xl border border-red-500/10" style={{ background: "rgba(239,68,68,0.03)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium text-white">{d.nombre}</span>
                    <div className="flex gap-2 text-[10px]">
                      <span className="text-gray-500">Ene: {d.ene.toLocaleString()}</span>
                      <span className="text-gray-400">Feb: {d.feb.toLocaleString()}</span>
                      <span className="text-red-400">Mar: {d.mar}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{d.potencial}</p>
                  <p className="text-[10px] text-purple-400 mt-0.5">{d.accion}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Headcount */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">De donde salen los 95 DS activos</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-sky-500/20">
                  <th className="text-left py-2 px-2 text-gray-400">Fuente</th>
                  <th className="text-right py-2 px-2 text-gray-400">DS</th>
                  <th className="text-right py-2 px-2 text-gray-400">Ordenes</th>
                  <th className="text-left py-2 px-2 text-gray-400">Accion</th>
                </tr></thead>
                <tbody>
                  {HEADCOUNT.map((h) => (
                    <tr key={h.fuente} className="border-b border-gray-800/50">
                      <td className="py-1.5 px-2 text-white">{h.fuente}</td>
                      <td className="py-1.5 px-2 text-right text-sky-400 font-medium">{h.ds}</td>
                      <td className="py-1.5 px-2 text-right text-orange-400">{h.ordenes.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-gray-400">{h.accion}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-sky-500/30 font-bold">
                    <td className="py-2 px-2 text-white">TOTAL</td>
                    <td className="py-2 px-2 text-right text-sky-400">95</td>
                    <td className="py-2 px-2 text-right text-orange-400">12,667</td>
                    <td className="py-2 px-2 text-gray-400">76 existentes + 19 nuevos/reactivados</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CALENDARIO ═══ */}
      {tab === "calendario" && (
        <div className="space-y-6">
          <p className="text-xs text-gray-400">Meta escalonada: arranca conservador (Sem 0-1: ~500/dia) y acelera con nuevos DS y proveedores reactivados (Sem 3-4: ~1,000/dia).</p>

          {/* Daily meta chart */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Meta Diaria — Ordenes Ingresadas + Movilizadas</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={CALENDARIO_DIAS.flatMap((s) => s.dias.map((d, i) => {
                const prevSems = CALENDARIO_DIAS.slice(0, CALENDARIO_DIAS.indexOf(s));
                const prevDays = prevSems.reduce((sum, ss) => sum + ss.dias.length, 0);
                const acum = CALENDARIO_DIAS.flatMap(ss => ss.dias).slice(0, prevDays + i + 1).reduce((sum, dd) => sum + dd.metaIng, 0);
                return { name: d.fecha.replace("-Abr", ""), "Meta Ing": d.metaIng, "Meta Mov": d.metaMov, "Acum Ing": acum };
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString()} />
                <Bar yAxisId="left" dataKey="Meta Ing" fill="#74ACDF" radius={[3, 3, 0, 0]} barSize={12} name="Meta Ing/dia" />
                <Bar yAxisId="left" dataKey="Meta Mov" fill="#F6B40E" radius={[3, 3, 0, 0]} barSize={12} name="Meta Mov/dia" />
                <Line yAxisId="right" type="monotone" dataKey="Acum Ing" stroke="#10B981" strokeWidth={2} dot={false} name="Acum Ingresadas" />
                <ReferenceLine yAxisId="right" y={12667} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Meta: 12,667", fill: "#EF4444", fontSize: 10, position: "right" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly calendar cards */}
          {CALENDARIO_DIAS.map((sem) => {
            const semTotal = sem.dias.reduce((s, d) => s + d.metaIng, 0);
            const allDias = CALENDARIO_DIAS.flatMap(s => s.dias);
            const semStart = allDias.indexOf(sem.dias[0]);
            const acum = allDias.slice(0, semStart + sem.dias.length).reduce((s, d) => s + d.metaIng, 0);
            return (
              <div key={sem.sem} className="rounded-xl border border-gray-800/50 overflow-hidden" style={{ background: "rgba(15,52,96,0.1)" }}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50" style={{ background: "rgba(116,172,223,0.08)" }}>
                  <span className="text-sm font-bold text-white">{sem.sem}</span>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-sky-400 font-bold">{semTotal.toLocaleString()} ing/sem</span>
                    <span className="text-gray-400">~{Math.round(semTotal / sem.dias.length).toLocaleString()}/dia</span>
                    <span className="text-green-400">Acum: {acum.toLocaleString()}</span>
                    <span className="text-gray-500">{((acum / 12667) * 100).toFixed(0)}% meta</span>
                  </div>
                </div>
                <div className={`grid gap-0`} style={{ gridTemplateColumns: `repeat(${sem.dias.length}, 1fr)` }}>
                  {sem.dias.map((d) => (
                    <div key={d.fecha} className="p-3 border-r border-gray-800/30 last:border-r-0 text-center">
                      <p className="text-[10px] text-gray-500">{d.dia} {d.fecha}</p>
                      <p className="text-sm font-bold text-sky-400">{d.metaIng.toLocaleString()}</p>
                      <p className="text-[10px] text-yellow-400">{d.metaMov.toLocaleString()} mov</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* DS trajectory by week */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Trayectoria DS Semanal — Captacion y Crecimiento</h3>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={DS_TRAYECTORIA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="sem" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 11 }} />
                <Area type="monotone" dataKey="t4" stackId="1" fill="#6B7280" stroke="#6B7280" fillOpacity={0.3} name="Tier 4" />
                <Area type="monotone" dataKey="t3" stackId="1" fill="#3B82F6" stroke="#3B82F6" fillOpacity={0.3} name="Tier 3" />
                <Area type="monotone" dataKey="t2" stackId="1" fill="#F97316" stroke="#F97316" fillOpacity={0.3} name="Tier 2" />
                <Area type="monotone" dataKey="t1" stackId="1" fill="#F59E0B" stroke="#F59E0B" fillOpacity={0.3} name="Tier 1" />
                <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2} name="Total DS" />
                <Legend />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-gray-700">
                  <th className="py-1 px-2 text-left text-gray-400"></th>
                  {DS_TRAYECTORIA.map(d => <th key={d.sem} className="py-1 px-2 text-center text-gray-400">{d.sem}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    { label: "Tier 1", key: "t1" as const, color: "#F59E0B" },
                    { label: "Tier 2", key: "t2" as const, color: "#F97316" },
                    { label: "Tier 3", key: "t3" as const, color: "#3B82F6" },
                    { label: "Tier 4", key: "t4" as const, color: "#6B7280" },
                    { label: "TOTAL", key: "total" as const, color: "#10B981" },
                    { label: "Nuevos/sem", key: "nuevos" as const, color: "#8B5CF6" },
                  ].map(r => (
                    <tr key={r.label} className="border-b border-gray-800/30">
                      <td className="py-1 px-2 font-medium" style={{ color: r.color }}>{r.label}</td>
                      {DS_TRAYECTORIA.map(d => (
                        <td key={d.sem} className="py-1 px-2 text-center text-gray-300">{d[r.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Semana 1 action plan */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Plan Semana 1 (6-10 Abril) — Arranque del Equipo Comercial</h3>
            <div className="space-y-2">
              {SEMANA1.map((dia) => (
                <div key={dia.dia} className="rounded-xl border border-gray-800/50 overflow-hidden">
                  <div className="px-3 py-2 text-xs font-bold text-sky-400" style={{ background: "rgba(116,172,223,0.08)" }}>{dia.dia}</div>
                  {dia.actividades.map((a, i) => (
                    <div key={i} className="px-3 py-2 border-t border-gray-800/30 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                      <p className="flex-1 text-xs text-gray-300">{a.tarea}</p>
                      <div className="flex gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">{a.responsable}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">{a.entregable}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ STOCK & KPIs ═══ */}
      {tab === "stock" && (
        <div className="space-y-6">
          {/* Stock priorities */}
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Stock Prioritario — Productos a Asegurar</h3>
            <p className="text-[10px] text-gray-400 mb-3">Los proveedores crecientes venden categorias especificas. Si no hay stock, no hay ordenes.</p>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={STOCK.map((s) => ({ name: s.categoria.length > 25 ? s.categoria.slice(0, 25) + "..." : s.categoria, "Q1 Uds": s.udsQ1, "Stock Abr": s.stockAbr }))} layout="vertical" margin={{ left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 9 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#9ca3af", fontSize: 9 }} width={150} />
                <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="Q1 Uds" fill="#6B7280" barSize={8} radius={[0, 3, 3, 0]} />
                <Bar dataKey="Stock Abr" fill="#74ACDF" barSize={8} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="space-y-2 mt-4">
              {STOCK.map((s) => (
                <div key={s.categoria} className="p-3 rounded-xl border flex items-start gap-3" style={{ borderColor: s.color + "20", background: s.color + "05" }}>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0" style={{ background: s.color + "20", color: s.color }}>{s.prioridad}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white">{s.categoria}</p>
                    <div className="flex gap-3 text-[10px] mt-1">
                      <span className="text-gray-400">Q1: {s.udsQ1.toLocaleString()} uds</span>
                      <span style={{ color: s.color }} className="font-bold">Stock Abr: {s.stockAbr.toLocaleString()}</span>
                      <span className="text-gray-500">{s.proveedor}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-right text-xs text-gray-400 mt-2">
                Total: Q1 <span className="text-gray-300 font-bold">25,533</span> uds &rarr; Stock Abril <span className="text-sky-400 font-bold">39,200</span> uds (+54%)
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">KPIs Semanales — Como Medimos el Progreso</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-sky-500/20">
                  <th className="text-left py-2 px-3 text-gray-400">KPI</th>
                  <th className="text-center py-2 px-3 text-gray-400">Meta Semanal</th>
                  <th className="text-center py-2 px-3 text-gray-400">Meta Mensual</th>
                  <th className="text-center py-2 px-3 text-gray-400">Frecuencia</th>
                </tr></thead>
                <tbody>
                  {KPIS_SEMANALES.map((k) => (
                    <tr key={k.kpi} className="border-b border-gray-800/50">
                      <td className="py-2 px-3 text-white">{k.kpi}</td>
                      <td className="py-2 px-3 text-center text-sky-400 font-medium">{k.metaSem}</td>
                      <td className="py-2 px-3 text-center text-yellow-400 font-medium">{k.metaMes}</td>
                      <td className="py-2 px-3 text-center text-gray-400">{k.freq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ROAD TO 9.5K ═══ */}
      {tab === "resumen" && (
        <div className="space-y-6">
          {/* Big number */}
          <div className="text-center py-6">
            <p className="text-xs text-gray-400 uppercase mb-2">Proyeccion Total Abril</p>
            <p className="text-6xl font-black" style={{ background: "linear-gradient(90deg, #74ACDF, #F6B40E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>12,700</p>
            <p className="text-sm text-gray-400 mt-1">ordenes ingresadas | +2,284 vs Marzo (+22%) | 0.3% margen de seguridad</p>
          </div>

          {/* Strategy composition */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Composicion por Estrategia</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "E1: Escalar crecientes", value: 10800 },
                      { name: "E2: Frenar caida", value: 3300 },
                      { name: "E3: Rescatar DS", value: 500 },
                      { name: "E4: Reactivar dormidos", value: 550 },
                      { name: "E5: Nuevos DS", value: 1000 },
                    ]}
                    cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name?.toString().split(":")[0]} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {["#10B981", "#F59E0B", "#8B5CF6", "#F97316", "#74ACDF"].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 12 }} formatter={(v) => Number(v).toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Progreso Base (Marzo) vs Meta</h3>
              <div className="space-y-4">
                {[
                  { name: "E1: Escalar crecientes", base: 7102, meta: 8450, color: "#10B981" },
                  { name: "E2: Frenar caida", base: 2464, meta: 2600, color: "#F59E0B" },
                  { name: "E3: Rescatar DS", base: 0, meta: 400, color: "#8B5CF6" },
                  { name: "E4: Reactivar dormidos", base: 292, meta: 450, color: "#F97316" },
                  { name: "E5: Nuevos DS", base: 0, meta: 800, color: "#74ACDF" },
                ].map((e) => (
                  <div key={e.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-300">{e.name}</span>
                      <span className="font-bold" style={{ color: e.color }}>{e.meta.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-4 rounded-full bg-gray-800 overflow-hidden relative">
                      <div className="h-full rounded-full absolute top-0 left-0 opacity-40" style={{ width: `${(e.base / 10800) * 100}%`, background: e.color }} />
                      <div className="h-full rounded-full absolute top-0 left-0" style={{ width: `${(e.meta / 8450) * 100}%`, background: e.color, opacity: 0.7 }} />
                      <span className="absolute right-2 top-0 h-full flex items-center text-[9px] text-white font-bold">{e.meta.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                      <span>Base Marzo: {e.base.toLocaleString()}</span>
                      <span>+{(e.meta - e.base).toLocaleString()} necesarios</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Diagnostic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
              <h3 className="text-sm font-bold text-red-400 mb-2">Diagnostico del Gap</h3>
              <div className="text-xs text-gray-300 space-y-2">
                <p>Los 2 mayores proveedores historicos (Oscar -65%, Maicol -49%) perdieron <span className="text-red-400 font-bold">3,731 ordenes/mes</span> entre Ene y Mar.</p>
                <p>Los proveedores crecientes ganaron <span className="text-green-400 font-bold">+4,511 ordenes/mes</span>, pero el neto es apenas +780.</p>
                <p>Para el salto de +5,597: <span className="text-white font-medium">acelerar crecientes + frenar caida + reactivar dormidos</span> simultaneamente.</p>
              </div>
            </div>

            <div className="rounded-xl p-4 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
              <h3 className="text-sm font-bold text-green-400 mb-2">Por que es alcanzable</h3>
              <ul className="text-xs text-gray-300 space-y-1.5">
                <li className="flex gap-1.5"><span className="text-green-400 shrink-0">1.</span> 3 proveedores ya crecen exponencialmente</li>
                <li className="flex gap-1.5"><span className="text-green-400 shrink-0">2.</span> pascu.ecom hizo 927 en su primer mes — puede repetirse</li>
                <li className="flex gap-1.5"><span className="text-green-400 shrink-0">3.</span> DS migran, no se van del ecosistema</li>
                <li className="flex gap-1.5"><span className="text-green-400 shrink-0">4.</span> 76 DS activos &rarr; 95 es solo +25%</li>
                <li className="flex gap-1.5"><span className="text-green-400 shrink-0">5.</span> Categorias de demanda creciente: suplementos, belleza</li>
                <li className="flex gap-1.5"><span className="text-green-400 shrink-0">6.</span> mercaplus.chile abre nueva geografia</li>
              </ul>
            </div>
          </div>

          {/* Final */}
          <div className="rounded-xl p-4 border border-sky-500/20 text-center" style={{ background: "rgba(116,172,223,0.05)" }}>
            <p className="text-sm text-gray-300">
              Los primeros <span className="text-white font-bold">10 dias son criticos</span>: contactar DS clave y asegurar stock. El momentum de Marzo se convierte en la base de Abril. <span className="text-sky-400 font-medium">Si no actuamos rapido, el impulso se pierde.</span>
            </p>
          </div>
        </div>
      )}
    </div>
    </ChartDownloadBtn>
  );
}
