"use client";

import { useState } from "react";
import data from "../data/dashboard_data.json";
import KPICards from "./components/KPICards";
import TrendChart from "./components/TrendChart";
import ProveedoresTable from "./components/ProveedoresTable";
import SellersTable from "./components/SellersTable";
import ProjectionChart from "./components/ProjectionChart";
import DevolucionesChart from "./components/DevolucionesChart";
import EfficiencyChart from "./components/EfficiencyChart";
import ProveedoresRanking from "./components/ProveedoresRanking";
import StrategicSimulator from "./components/StrategicSimulator";
import ProductGoalPlanner from "./components/ProductGoalPlanner";
import DailyTracker from "./components/DailyTracker";
import ProductsAnalysis from "./components/ProductsAnalysis";
import DropshipperManager from "./components/DropshipperManager";

export type MesFilter = "q1" | "enero" | "febrero" | "marzo" | "abril";

const allData = data as typeof data & {
  seguimiento_diario: any[];
  productos: any[];
  productos_total: number;
  meta_info: any;
  dropshippers: any[];
  dropshippers_total: number;
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
    // April targets / projections
    return {
      ingresadas: allData.meta_info.meta_ingresadas_abril,
      movilizadas: allData.meta_info.meta_movilizadas_abril,
      entregados: Math.round(allData.meta_info.meta_movilizadas_abril * 0.67), // based on Q1 avg
      devoluciones: Math.round(allData.meta_info.meta_movilizadas_abril * 0.20),
    };
  }
  return r[mes];
}

export default function Home() {
  const [mesFilter, setMesFilter] = useState<MesFilter>("q1");
  const { resumen, proveedores, sellers_top, seguimiento_diario, productos, productos_total, meta_info, dropshippers } = allData;
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
        className="sticky top-0 z-50 backdrop-blur-md border-b border-orange-500/20"
        style={{ background: "rgba(26,26,46,0.95)" }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl dropi-gradient flex items-center justify-center font-bold text-white text-lg shrink-0">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Dropi Paraguay</h1>
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
                      : "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
                }`}
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
          <span className={`text-sm font-medium ${isAbril ? "text-green-400" : "text-orange-400"}`}>
            {mesLabels[mesFilter]}
            {isAbril && " — 40,000 movilizadas / 51,283 ingresadas"}
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

        {/* Show Abril-specific content when Abril is selected */}
        {isAbril ? (
          <>
            {/* Daily Tracker */}
            <DailyTracker marzoData={seguimiento_diario} metaInfo={meta_info} />

            {/* Dropshipper Manager */}
            <DropshipperManager dropshippers={dropshippers} proveedores={proveedores} />

            {/* Products Analysis */}
            <ProductsAnalysis productos={productos} proveedores={proveedores} productosTotal={productos_total} />

            {/* Strategic Simulator */}
            <StrategicSimulator proveedores={proveedores} resumen={resumen} />

            {/* Product Goal Planner */}
            <ProductGoalPlanner proveedores={proveedores} />
          </>
        ) : (
          <>
            {/* Strategic Simulator - Goal 40K */}
            <StrategicSimulator proveedores={proveedores} resumen={resumen} />

            {/* Daily Tracker */}
            <DailyTracker marzoData={seguimiento_diario} metaInfo={meta_info} />

            {/* Dropshipper Manager */}
            <DropshipperManager dropshippers={dropshippers} proveedores={proveedores} />

            {/* Products Analysis */}
            <ProductsAnalysis productos={productos} proveedores={proveedores} productosTotal={productos_total} />

            {/* Product Goal Planner */}
            <ProductGoalPlanner proveedores={proveedores} />

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrendChart resumen={resumen} mesFilter={mesFilter} />
              <DevolucionesChart resumen={resumen} mesFilter={mesFilter} />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectionChart resumen={resumen} />
              <EfficiencyChart resumen={resumen} mesFilter={mesFilter} />
            </div>

            {/* Proveedores Ranking (as products) */}
            <ProveedoresRanking proveedores={proveedores} mesFilter={mesFilter} />

            {/* Tables */}
            <ProveedoresTable proveedores={proveedores} mesFilter={mesFilter} />
            <SellersTable sellers={sellers_top} mesFilter={mesFilter} />
          </>
        )}

        {/* Footer */}
        <footer className="text-center text-gray-500 text-xs py-6 border-t border-gray-800">
          Dropi Paraguay &middot; Segundo Cerebro Dashboard &middot; Datos Q1 2026
        </footer>
      </main>
    </div>
  );
}
