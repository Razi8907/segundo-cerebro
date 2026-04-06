"use client";

import { useState } from "react";
import Link from "next/link";
import data from "../../data/dashboard_data_argentina.json";
import KPICards from "../components/KPICards";
import TrendChart from "../components/TrendChart";
import ProveedoresTable from "../components/ProveedoresTable";
import SellersTable from "../components/SellersTable";
import ProjectionChart from "../components/ProjectionChart";
import DevolucionesChart from "../components/DevolucionesChart";
import EfficiencyChart from "../components/EfficiencyChart";
import ProveedoresRanking from "../components/ProveedoresRanking";
import StrategicSimulator from "../components/StrategicSimulator";
import ProductGoalPlanner from "../components/ProductGoalPlanner";
import DailyTracker from "../components/DailyTracker";
import ProductsAnalysis from "../components/ProductsAnalysis";
import DropshipperManager from "../components/DropshipperManager";
import type { MesFilter } from "../types";

const allData = data as typeof data & {
  seguimiento_diario: any[];
  productos: any[];
  productos_total: number;
  meta_info: any;
  dropshippers: any[];
  dropshippers_total: number;
  seguimiento_abril: any[];
};

function getResumenByMes(mes: MesFilter) {
  const r = allData.resumen;
  if (mes === "q1") {
    return {
      ingresadas: r.enero.ingresadas + r.febrero.ingresadas + r.marzo.ingresadas,
      movilizadas: r.enero.movilizadas + r.febrero.movilizadas + r.marzo.movilizadas,
      entregados: r.enero.entregados + r.febrero.entregados + r.marzo.entregados,
      devoluciones: r.enero.devoluciones + r.febrero.devoluciones + r.marzo.devoluciones,
    };
  }
  if (mes === "abril") {
    return {
      ingresadas: allData.meta_info.meta_ingresadas_abril,
      movilizadas: allData.meta_info.meta_movilizadas_abril,
      entregados: Math.round(allData.meta_info.meta_movilizadas_abril * 0.60),
      devoluciones: Math.round(allData.meta_info.meta_movilizadas_abril * 0.26),
    };
  }
  return r[mes];
}

export default function ArgentinaDashboard() {
  const [mesFilter, setMesFilter] = useState<MesFilter>("q1");
  const { resumen, proveedores, sellers_top, seguimiento_diario, productos, productos_total, meta_info, dropshippers, seguimiento_abril } = allData;
  const kpis = getResumenByMes(mesFilter);

  const mesLabels: Record<MesFilter, string> = {
    q1: "Q1 2026 (Ene-Mar)",
    enero: "Enero 2026",
    febrero: "Febrero 2026",
    marzo: "Marzo 2026",
    abril: "Abril 2026 (Meta)",
  };

  const isAbril = mesFilter === "abril";

  return (
    <div className="min-h-screen" style={{ background: "#1a1a2e" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b border-sky-500/20"
        style={{ background: "rgba(26,26,46,0.95)" }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0" title="Volver al inicio">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </Link>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg shrink-0" style={{ background: "linear-gradient(135deg, #74ACDF, #F6B40E)" }}>
              D
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ background: "linear-gradient(90deg, #74ACDF, #F6B40E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Dropi Argentina</h1>
              <p className="text-xs text-gray-400">Dashboard Operativo &middot; Segundo Cerebro</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["q1", "enero", "febrero", "marzo", "abril"] as MesFilter[]).map((m) => (
              <button
                key={m}
                onClick={() => setMesFilter(m)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  mesFilter === m
                    ? m === "abril"
                      ? "bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20"
                      : "text-white border-sky-500 shadow-lg shadow-sky-500/20"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-sky-500/40 hover:text-sky-300"
                }`}
                style={mesFilter === m && m !== "abril" ? { background: "#74ACDF" } : {}}
              >
                {m === "q1" ? "Q1 Completo" : m === "abril" ? "🎯 Abril (Meta)" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <span className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 ml-2">
              {resumen.total_proveedores} Proveedores
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {resumen.total_sellers.toLocaleString()} Sellers
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Period indicator */}
        <div className="text-center">
          <span className={`text-sm font-medium ${isAbril ? "text-green-400" : "text-sky-400"}`}>
            {mesLabels[mesFilter]}
            {isAbril && " — 12,000 movilizadas / 16,000 ingresadas"}
          </span>
        </div>

        {/* KPI Cards */}
        <KPICards
          ingresadas={kpis.ingresadas}
          movilizadas={kpis.movilizadas}
          entregados={kpis.entregados}
          devoluciones={kpis.devoluciones}
          periodo={mesLabels[mesFilter]}
        />

        {isAbril ? (
          <>
            <DailyTracker marzoData={seguimiento_diario} metaInfo={meta_info} abrilRealData={seguimiento_abril} mesFilter={mesFilter} resumen={resumen} />
            <DropshipperManager dropshippers={dropshippers} proveedores={proveedores} mesFilter={mesFilter} />
            <ProductsAnalysis productos={productos} proveedores={proveedores} productosTotal={productos_total} mesFilter={mesFilter} />
            <StrategicSimulator proveedores={proveedores} resumen={resumen} />
            <ProductGoalPlanner proveedores={proveedores} />
          </>
        ) : (
          <>
            <DailyTracker marzoData={seguimiento_diario} metaInfo={meta_info} abrilRealData={seguimiento_abril} mesFilter={mesFilter} resumen={resumen} />
            <DropshipperManager dropshippers={dropshippers} proveedores={proveedores} mesFilter={mesFilter} />
            <ProductsAnalysis productos={productos} proveedores={proveedores} productosTotal={productos_total} mesFilter={mesFilter} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendChart resumen={resumen} mesFilter={mesFilter} />
              <DevolucionesChart resumen={resumen} mesFilter={mesFilter} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectionChart resumen={resumen} />
              <EfficiencyChart resumen={resumen} mesFilter={mesFilter} />
            </div>
            <ProveedoresRanking proveedores={proveedores} mesFilter={mesFilter} />
            <ProveedoresTable proveedores={proveedores} mesFilter={mesFilter} />
            <SellersTable sellers={sellers_top} mesFilter={mesFilter} />
          </>
        )}

        <footer className="text-center text-gray-500 text-xs py-6 border-t border-gray-800">
          Dropi Argentina &middot; Segundo Cerebro Dashboard &middot; Datos Q1 2026
        </footer>
      </main>
    </div>
  );
}
