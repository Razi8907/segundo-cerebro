"use client";

import data from "../data/dashboard_data.json";
import KPICards from "./components/KPICards";
import TrendChart from "./components/TrendChart";
import ProveedoresTable from "./components/ProveedoresTable";
import SellersTable from "./components/SellersTable";
import ProjectionChart from "./components/ProjectionChart";
import DevolucionesChart from "./components/DevolucionesChart";
import EfficiencyChart from "./components/EfficiencyChart";

export default function Home() {
  const { resumen, proveedores, sellers_top } = data;

  const totalQ1Ingresadas =
    resumen.enero.ingresadas + resumen.febrero.ingresadas + resumen.marzo.ingresadas;
  const totalQ1Movilizadas =
    resumen.enero.movilizadas + resumen.febrero.movilizadas + resumen.marzo.movilizadas;
  const totalQ1Entregados =
    resumen.enero.entregados + resumen.febrero.entregados + resumen.marzo.entregados;
  const totalQ1Devoluciones =
    resumen.enero.devoluciones + resumen.febrero.devoluciones + resumen.marzo.devoluciones;

  return (
    <div className="min-h-screen" style={{ background: "#1a1a2e" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-orange-500/20" style={{ background: "rgba(26,26,46,0.9)" }}>
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl dropi-gradient flex items-center justify-center font-bold text-white text-lg">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Dropi Paraguay</h1>
              <p className="text-xs text-gray-400">Dashboard Operativo Q1 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Enero - Marzo 2026
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              {resumen.total_proveedores} Proveedores
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {resumen.total_sellers.toLocaleString()} Sellers
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <KPICards
          ingresadas={totalQ1Ingresadas}
          movilizadas={totalQ1Movilizadas}
          entregados={totalQ1Entregados}
          devoluciones={totalQ1Devoluciones}
        />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendChart resumen={resumen} />
          <DevolucionesChart resumen={resumen} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProjectionChart resumen={resumen} />
          <EfficiencyChart resumen={resumen} />
        </div>

        {/* Tables */}
        <ProveedoresTable proveedores={proveedores} />
        <SellersTable sellers={sellers_top} />

        {/* Footer */}
        <footer className="text-center text-gray-500 text-xs py-6 border-t border-gray-800">
          Dropi Paraguay - Segundo Cerebro Dashboard - Datos Q1 2026
        </footer>
      </main>
    </div>
  );
}
