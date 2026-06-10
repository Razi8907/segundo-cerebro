"use client";

import { useState } from "react";
import Link from "next/link";
import { useDashboardData } from "../lib/useDashboardData";
import KPICards from "../components/KPICards";
import CRMCentroGestion from "../components/CRMCentroGestion";
import MinimoDiario from "../components/MinimoDiario";
import MinimoMensual from "../components/MinimoMensual";
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
import ReportGenerator from "../components/ReportGenerator";
import OperationalUpload from "../components/OperationalUpload";
import OpsBreakdown from "../components/OpsBreakdown";
import ProveedorManager from "../components/ProveedorManager";
import OperationsDashboard from "../components/OperationsDashboard";
import FinanzasDashboard from "../components/FinanzasDashboard";
import FinanzasDashboardPY_Q1 from "../components/FinanzasDashboardPY_Q1";
import SeguimientoComercial from "../components/SeguimientoComercial";
import KpisOkrDashboard from "../components/KpisOkrDashboard";
import ThemeToggle from "../components/ThemeToggle";
import { useUser } from "../lib/useUser";
import type { MesFilter } from "../types";

function getResumenByMes(mes: MesFilter, allData: any) {
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
      entregados: Math.round(allData.meta_info.meta_movilizadas_abril * 0.67),
      devoluciones: Math.round(allData.meta_info.meta_movilizadas_abril * 0.20),
    };
  }
  if (mes === "mayo") {
    return {
      ingresadas: allData.meta_info.meta_ingresadas_mayo,
      movilizadas: allData.meta_info.meta_movilizadas_mayo,
      entregados: Math.round(allData.meta_info.meta_movilizadas_mayo * 0.67),
      devoluciones: Math.round(allData.meta_info.meta_movilizadas_mayo * 0.20),
    };
  }
  if (mes === "junio") {
    const metaMov = allData.meta_info.meta_movilizadas_junio ?? allData.meta_info.meta_movilizadas_mayo ?? 0;
    const metaIng = allData.meta_info.meta_ingresadas_junio ?? allData.meta_info.meta_ingresadas_mayo ?? 0;
    return {
      ingresadas: metaIng,
      movilizadas: metaMov,
      entregados: Math.round(metaMov * 0.67),
      devoluciones: Math.round(metaMov * 0.20),
    };
  }
  return r[mes];
}

type Sector = "comercial" | "operaciones" | "finanzas" | "seguimiento" | "kpis_okr";
type ComercialSub = "general" | "minimo" | "minimo_mes" | "dropshippers" | "proveedores" | "crm";

export default function ParaguayDashboard() {
  const [mesFilter, setMesFilter] = useState<MesFilter>("q1");
  const [sector, setSector] = useState<Sector>("comercial");
  const { canComercial, canOperaciones, canFinanzas } = useUser();
  const { data: allData, updatedAt } = useDashboardData("py");
  const { resumen, proveedores, sellers_top, seguimiento_diario, productos, productos_total, meta_info, dropshippers, seguimiento_abril, seguimiento_mayo } = allData;
  const kpis = getResumenByMes(mesFilter, allData);

  const mesLabels: Record<MesFilter, string> = {
    q1: "Q1 2026 (Ene-Mar)",
    enero: "Enero 2026",
    febrero: "Febrero 2026",
    marzo: "Marzo 2026",
    abril: "Abril 2026",
    mayo: "Mayo 2026",
    junio: "Junio 2026 (Meta)",
  };

  const isAbril = mesFilter === "abril";
  const isMayo = mesFilter === "mayo";
  const isJunio = mesFilter === "junio";
  const isPlanning = isAbril || isMayo || isJunio;
  const [comercialSub, setComercialSub] = useState<ComercialSub>("general");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b border-orange-500/20"
        style={{ background: "var(--bg-header)" }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0" title="Volver al inicio">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </Link>
            <div className="w-10 h-10 rounded-xl dropi-gradient flex items-center justify-center font-bold text-white text-lg shrink-0">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Dropi Paraguay</h1>
              <p className="text-xs t-secondary">Dashboard Operativo &middot; Segundo Cerebro</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["q1", "enero", "febrero", "marzo", "abril", "mayo", "junio"] as MesFilter[]).map((m) => (
              <button
                key={m}
                onClick={() => setMesFilter(m)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  mesFilter === m
                    ? m === "junio"
                      ? "bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/20"
                      : "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                    : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
                }`}
              >
                {m === "q1" ? "Q1 Completo" : m === "junio" ? "🎯 Junio (Meta)" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
            <span className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 ml-2">
              {resumen.total_proveedores} Proveedores
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {resumen.total_sellers.toLocaleString()} Sellers
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Sector tabs */}
      <div className="border-b" style={{ borderColor: "var(--bg-card-border)", background: "var(--bg-card)" }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex gap-0">
          {([
            { key: "comercial" as Sector, label: "📊 Comercial", allowed: canComercial },
            { key: "operaciones" as Sector, label: "🏭 Operaciones", allowed: canOperaciones },
            { key: "finanzas" as Sector, label: "💰 Finanzas", allowed: canFinanzas },
            { key: "seguimiento" as Sector, label: "📋 Seg. Comercial", allowed: canComercial },
            { key: "kpis_okr" as Sector, label: "🎯 KPIs & OKRs", allowed: canComercial },
          ]).filter((s) => s.allowed).map((s) => (
            <button
              key={s.key}
              onClick={() => setSector(s.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
                sector === s.key
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent t-muted hover:text-orange-400 hover:border-orange-500/30"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-8">
        {sector === "comercial" && <>
        {/* Period indicator */}
        <div className="text-center">
          <span className={`text-sm font-medium ${isJunio || isMayo ? "text-green-400" : "text-orange-400"}`}>
            {mesLabels[mesFilter]}
            {isAbril && ` — ${meta_info.meta_movilizadas_abril.toLocaleString()} movilizadas / ${meta_info.meta_ingresadas_abril.toLocaleString()} ingresadas`}
            {isMayo && ` — ${meta_info.meta_movilizadas_mayo.toLocaleString()} movilizadas / ${meta_info.meta_ingresadas_mayo.toLocaleString()} ingresadas`}
            {isJunio && (meta_info as any).meta_movilizadas_junio != null && ` — ${(meta_info as any).meta_movilizadas_junio.toLocaleString()} movilizadas / ${(meta_info as any).meta_ingresadas_junio?.toLocaleString?.() || "—"} ingresadas`}
          </span>
        </div>

        {isAbril && (
          <div className="rounded-xl p-5 text-center border" style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(249,115,22,0.15))",
            borderColor: "rgba(16,185,129,0.4)",
          }}>
            <p className="text-base sm:text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              🎉 Felicidades, llegamos al objetivo equipo!
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              A romperla también en Mayo 🚀
            </p>
          </div>
        )}

        {/* KPI Cards */}
        <KPICards
          ingresadas={kpis.ingresadas}
          movilizadas={kpis.movilizadas}
          entregados={kpis.entregados}
          devoluciones={kpis.devoluciones}
          periodo={mesLabels[mesFilter]}
        />

        {/* Show planning content when Abril o Mayo está seleccionado */}
        {isPlanning ? (
          <>
            {/* Sub-nav: General / Dropshippers / Proveedores */}
            <div className="flex flex-wrap gap-2">
              {([
                { key: "general" as ComercialSub, label: "📊 General" },
                { key: "minimo" as ComercialSub, label: "📐 Mínimo Diario" },
                { key: "minimo_mes" as ComercialSub, label: "📆 Mínimo Mensual" },
                { key: "dropshippers" as ComercialSub, label: "👥 Dropshippers" },
                { key: "proveedores" as ComercialSub, label: "📦 Proveedores" },
                { key: "crm" as ComercialSub, label: "🎯 CRM" },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setComercialSub(s.key)}
                  className={`text-xs px-4 py-2 rounded-full border transition-all ${
                    comercialSub === s.key
                      ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                      : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {comercialSub === "general" && (
              <>
                <DailyTracker
                  marzoData={isJunio ? (seguimiento_mayo || []) : isMayo ? (seguimiento_abril || []) : seguimiento_diario}
                  metaInfo={meta_info}
                  abrilRealData={isJunio ? [] : isMayo ? (seguimiento_mayo || []) : seguimiento_abril}
                  mesFilter={mesFilter}
                  resumen={resumen}
                  country="py"
                />
                <OperationalUpload country="py" mes={isJunio ? "junio" : isMayo ? "mayo" : "abril"} />
                <StrategicSimulator proveedores={proveedores} resumen={resumen} metaInfo={meta_info} mesFilter={mesFilter} country="py" />
                <ProductGoalPlanner proveedores={proveedores} mesFilter={mesFilter} country="py" />
              </>
            )}

            {comercialSub === "dropshippers" && (
              <>
                <OpsBreakdown country="py" mes={isJunio ? "junio" : isMayo ? "mayo" : "abril"} category="dropshipper" />
                <DropshipperManager dropshippers={dropshippers} proveedores={proveedores} mesFilter={mesFilter} metaInfo={meta_info} country="py" />
              </>
            )}

            {comercialSub === "proveedores" && (
              <>
                <OpsBreakdown country="py" mes={isJunio ? "junio" : isMayo ? "mayo" : "abril"} category="proveedor" />
                <ProveedorManager mesFilter={mesFilter} metaInfo={meta_info} country="py" />
                {/* Q1-based components only relevant in Abril (Mayo no los usa) */}
                {isAbril && (
                  <>
                    <ProveedoresRanking proveedores={proveedores} mesFilter={mesFilter} />
                    <ProveedoresTable proveedores={proveedores} mesFilter={mesFilter} />
                    <ProductsAnalysis productos={productos} proveedores={proveedores} productosTotal={productos_total} mesFilter={mesFilter} metaInfo={meta_info} />
                  </>
                )}
              </>
            )}

            {comercialSub === "minimo" && (
              <MinimoDiario country="py" mes={isJunio ? "junio" : isMayo ? "mayo" : "abril"} />
            )}

            {comercialSub === "minimo_mes" && (
              <MinimoMensual country="py" mes={isJunio ? "junio" : isMayo ? "mayo" : "abril"} />
            )}

            {comercialSub === "crm" && (
              <CRMCentroGestion country="py" />
            )}
          </>
        ) : (
          <>
            <DailyTracker
              marzoData={seguimiento_diario}
              metaInfo={meta_info}
              abrilRealData={seguimiento_abril}
              mesFilter={mesFilter}
              resumen={resumen}
              country="py"
            />
            <DropshipperManager dropshippers={dropshippers} proveedores={proveedores} mesFilter={mesFilter} metaInfo={meta_info} />
            <ProductsAnalysis productos={productos} proveedores={proveedores} productosTotal={productos_total} mesFilter={mesFilter} metaInfo={meta_info} />

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

        <ReportGenerator
          resumen={resumen}
          metaInfo={meta_info}
          proveedores={proveedores}
          productos={productos}
          seguimientoDiario={seguimiento_diario}
          seguimientoAbril={seguimiento_abril}
          country="py"
        />
        </>}

        {sector === "operaciones" && (
          <OperationsDashboard country="py" />
        )}

        {sector === "finanzas" && (
          <div className="space-y-8">
            <FinanzasDashboardPY_Q1 />
            <FinanzasDashboard country="py" />
          </div>
        )}

        {sector === "seguimiento" && (
          <SeguimientoComercial country="py" />
        )}

        {sector === "kpis_okr" && (
          <KpisOkrDashboard country="py" />
        )}

        <footer className="text-center text-gray-500 text-xs py-6 border-t border-gray-800">
          Dropi Paraguay &middot; Segundo Cerebro Dashboard &middot; Datos Q1 2026
          {updatedAt && <span className="block mt-1 text-[10px]">Última actualización: {new Date(updatedAt).toLocaleString("es-PY")}</span>}
        </footer>
      </main>
    </div>
  );
}
