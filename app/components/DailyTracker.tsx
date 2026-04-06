"use client";

import { useState, useMemo } from "react";
import type { MesFilter } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ComposedChart,
  Line,
} from "recharts";

interface DailyData {
  dia_semana: string;
  fecha: number;
  ordenes: number;
  nota: string | null;
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

const DIAS_SEMANA_ABRIL = [
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO","LUNES",
  "MARTES","MIÉRCOLES",
];

export default function DailyTracker({
  marzoData,
  metaInfo,
  abrilRealData,
  mesFilter,
}: {
  marzoData: DailyData[];
  metaInfo: MetaInfo;
  abrilRealData?: DailyData[];
  mesFilter: MesFilter;
}) {
  const META_DIARIA = metaInfo.promedio_diario_necesario;
  const META_TOTAL = metaInfo.meta_ingresadas_abril;
  const isAbril = mesFilter === "abril";

  // Abril tracking state
  const [abrilData, setAbrilData] = useState<{ fecha: number; ordenes: number; dia_semana: string }[]>(
    () => (abrilRealData || []).map((d) => ({ fecha: d.fecha, ordenes: d.ordenes, dia_semana: d.dia_semana }))
  );
  const [inputDay, setInputDay] = useState("");
  const [inputOrdenes, setInputOrdenes] = useState("");

  const addDay = () => {
    const day = parseInt(inputDay);
    const ordenes = parseInt(inputOrdenes);
    if (isNaN(day) || isNaN(ordenes) || day < 1 || day > 30) return;

    setAbrilData((prev) => {
      const filtered = prev.filter((d) => d.fecha !== day);
      return [...filtered, { fecha: day, ordenes, dia_semana: DIAS_SEMANA_ABRIL[day - 1] }].sort(
        (a, b) => a.fecha - b.fecha
      );
    });
    setInputDay(String(day + 1));
    setInputOrdenes("");
  };

  const analysis = useMemo(() => {
    // Marzo analysis
    const marzoByDow: Record<string, number[]> = {};
    marzoData.forEach((d) => {
      if (!marzoByDow[d.dia_semana]) marzoByDow[d.dia_semana] = [];
      marzoByDow[d.dia_semana].push(d.ordenes);
    });
    const dowAvg: Record<string, number> = {};
    Object.entries(marzoByDow).forEach(([dow, vals]) => {
      dowAvg[dow] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });

    // Abril progress
    const abrilTotal = abrilData.reduce((s, d) => s + d.ordenes, 0);
    const diasCargados = abrilData.length;
    const diasRestantes = 30 - diasCargados;
    const promedioAbril = diasCargados > 0 ? abrilTotal / diasCargados : 0;
    const proyeccionFinal = diasCargados > 0 ? Math.round(promedioAbril * 30) : 0;
    const pctMeta = diasCargados > 0 ? (proyeccionFinal / META_TOTAL) * 100 : 0;
    const necesarioPorDiaRestante = diasRestantes > 0 ? Math.round((META_TOTAL - abrilTotal) / diasRestantes) : 0;

    const coloredAbril = abrilData.map((d) => {
      let color: "verde" | "amarillo" | "rojo";
      if (d.ordenes >= META_DIARIA) color = "verde";
      else if (d.ordenes >= META_DIARIA * 0.8) color = "amarillo";
      else color = "rojo";
      return { ...d, color };
    });

    // Day-of-week pattern for projection
    const abrilProjected: { fecha: number; ordenes: number | null; proyectado: number; dia_semana: string }[] = [];
    for (let i = 1; i <= 30; i++) {
      const existing = abrilData.find((d) => d.fecha === i);
      const dow = DIAS_SEMANA_ABRIL[i - 1];
      const projected = dowAvg[dow] || metaInfo.marzo_promedio_diario;
      abrilProjected.push({
        fecha: i,
        ordenes: existing ? existing.ordenes : null,
        proyectado: existing ? existing.ordenes : Math.round(projected * (META_TOTAL / metaInfo.marzo_total_ordenes)),
        dia_semana: dow,
      });
    }

    return {
      dowAvg,
      abrilTotal,
      diasCargados,
      diasRestantes,
      promedioAbril,
      proyeccionFinal,
      pctMeta,
      necesarioPorDiaRestante,
      coloredAbril,
      abrilProjected,
    };
  }, [marzoData, abrilData, META_DIARIA, META_TOTAL, metaInfo]);

  const colorMap = { verde: "#10B981", amarillo: "#F59E0B", rojo: "#EF4444" };

  const marzoChartData = marzoData.map((d) => ({
    name: `${d.fecha}`,
    Órdenes: d.ordenes,
    dia: d.dia_semana,
  }));

  // ─── Q1 / Ene / Feb / Mar view: solo histórico, sin metas ───
  if (!isAbril) {
    return (
      <div className="glass-card p-6 border-orange-500/30">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
          📅 Seguimiento Diario &mdash; Histórico Q1
        </h2>
        <p className="text-xs text-gray-400 mb-6">
          Órdenes ingresadas día a día &middot; Meses cerrados
        </p>

        {/* KPIs histórico */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Marzo Total</p>
            <p className="text-lg font-bold text-gray-300">{metaInfo.marzo_total_ordenes.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">31 días</p>
          </div>
          <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Promedio Diario</p>
            <p className="text-lg font-bold text-orange-400">{metaInfo.marzo_promedio_diario.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">órdenes/día</p>
          </div>
          <div className="rounded-xl p-3 border border-gray-700" style={{ background: "rgba(15,52,96,0.2)" }}>
            <p className="text-[10px] text-gray-400 uppercase">Mejor Día</p>
            <p className="text-lg font-bold text-green-400">
              {Math.max(...marzoData.map((d) => d.ordenes)).toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500">máximo registrado</p>
          </div>
        </div>

        {/* Marzo Chart */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Marzo 2026 &mdash; Día a día
            <span className="text-[10px] text-gray-500 ml-2">
              Total: {metaInfo.marzo_total_ordenes.toLocaleString()} &middot; Prom: {metaInfo.marzo_promedio_diario.toLocaleString()}/día
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={marzoChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
                itemStyle={{ color: "#F97316" }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(value) => `${Number(value).toLocaleString()} órdenes`}
              />
              <ReferenceLine y={metaInfo.marzo_promedio_diario} stroke="#6B7280" strokeDasharray="4 4" label={{ value: `Prom: ${metaInfo.marzo_promedio_diario.toLocaleString()}`, fill: "#6B7280", fontSize: 10, position: "right" }} />
              <Bar dataKey="Órdenes" radius={[4, 4, 0, 0]} fill="#F97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day-of-week pattern */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Patrón por Día de Semana (Marzo)</h3>
          <div className="grid grid-cols-7 gap-2">
            {["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"].map((dow) => {
              const avg = analysis.dowAvg[dow] || 0;
              return (
                <div key={dow} className="text-center p-2 rounded-xl border border-gray-800" style={{ background: "rgba(15,52,96,0.15)" }}>
                  <p className="text-[10px] text-gray-400">{dow.slice(0, 3)}</p>
                  <p className="text-lg font-bold text-orange-400">{avg.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">prom/día</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── ABRIL view: meta, semáforo, carga diaria, proyección ───
  return (
    <div className="glass-card p-6 border-green-500/30">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
        🎯 Seguimiento Diario &mdash; Meta Abril: {META_TOTAL.toLocaleString()} ingresadas
      </h2>
      <p className="text-xs text-gray-400 mb-6">
        Carga diaria de Abril &middot; Meta diaria: {META_DIARIA.toLocaleString()} órdenes &middot; Objetivo: 40,000 movilizadas
      </p>

      {/* KPIs row - solo Abril */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl p-3 border border-orange-500/20" style={{ background: "rgba(249,115,22,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Meta Diaria</p>
          <p className="text-lg font-bold text-orange-400">{META_DIARIA.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500">Para 40K mov.</p>
        </div>
        <div className="rounded-xl p-3 border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Abril Acum.</p>
          <p className="text-lg font-bold text-blue-400">{analysis.abrilTotal > 0 ? analysis.abrilTotal.toLocaleString() : "—"}</p>
          <p className="text-[10px] text-gray-500">{analysis.diasCargados} días cargados</p>
        </div>
        <div className="rounded-xl p-3 border border-green-500/20" style={{ background: "rgba(16,185,129,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Proy. Final Abril</p>
          <p className={`text-lg font-bold ${analysis.pctMeta >= 90 ? "text-green-400" : analysis.pctMeta >= 70 ? "text-yellow-400" : "text-red-400"}`}>
            {analysis.proyeccionFinal > 0 ? analysis.proyeccionFinal.toLocaleString() : "—"}
          </p>
          <p className="text-[10px] text-gray-500">{analysis.pctMeta > 0 ? `${analysis.pctMeta.toFixed(1)}% de meta` : "Sin datos"}</p>
        </div>
        <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Necesario/día rest.</p>
          <p className="text-lg font-bold text-red-400">
            {analysis.necesarioPorDiaRestante > 0 ? analysis.necesarioPorDiaRestante.toLocaleString() : META_DIARIA.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500">{analysis.diasRestantes} días restantes</p>
        </div>
        <div className="rounded-xl p-3 border border-purple-500/20" style={{ background: "rgba(139,92,246,0.05)" }}>
          <p className="text-[10px] text-gray-400 uppercase">Gap vs Marzo</p>
          <p className="text-lg font-bold text-purple-400">
            +{(META_DIARIA - metaInfo.marzo_promedio_diario).toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500">/día vs prom. Marzo</p>
        </div>
      </div>

      {/* Input form for Abril */}
      <div className="mb-6 p-4 rounded-xl border border-green-500/20" style={{ background: "rgba(16,185,129,0.03)" }}>
        <h3 className="text-sm font-medium text-green-400 mb-3">Cargar datos de Abril</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Día (1-30)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={inputDay}
              onChange={(e) => setInputDay(e.target.value)}
              placeholder="Día"
              className="w-20 text-sm px-3 py-2 rounded-lg bg-[#16213e] border border-green-500/30 text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Órdenes ingresadas</label>
            <input
              type="number"
              value={inputOrdenes}
              onChange={(e) => setInputOrdenes(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDay()}
              placeholder="Ej: 1500"
              className="w-32 text-sm px-3 py-2 rounded-lg bg-[#16213e] border border-green-500/30 text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <button
            onClick={addDay}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
          >
            Agregar
          </button>
          {abrilData.length > 0 && (
            <button
              onClick={() => setAbrilData([])}
              className="px-3 py-2 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Abril loaded days with semaphore */}
        {abrilData.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {analysis.coloredAbril.map((d) => (
              <div
                key={d.fecha}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border"
                style={{
                  borderColor: colorMap[d.color] + "40",
                  background: colorMap[d.color] + "10",
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: colorMap[d.color] }} />
                <span className="text-gray-300">Día {d.fecha}:</span>
                <span className="font-bold" style={{ color: colorMap[d.color] }}>
                  {d.ordenes.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abril projection chart with semaphore colors */}
      {abrilData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Abril 2026 &mdash; Real vs Meta Necesaria
            <span className="text-[10px] text-gray-500 ml-2">
              🟢 &ge;{META_DIARIA.toLocaleString()} &middot; 🟡 &ge;{Math.round(META_DIARIA * 0.8).toLocaleString()} &middot; 🔴 &lt;{Math.round(META_DIARIA * 0.8).toLocaleString()}
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={analysis.abrilProjected.map((d) => ({
              ...d,
              real: d.ordenes,
              necesario: d.ordenes != null ? null : analysis.necesarioPorDiaRestante,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="fecha" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "12px", color: "#e5e7eb", fontSize: 12 }}
                itemStyle={{ color: "#F97316" }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(value, name) => {
                  if (value == null) return ["—", name];
                  const label = name === "necesario" ? "Necesario/día" : name === "real" ? "Real" : String(name);
                  return [Number(value).toLocaleString(), label];
                }}
                labelFormatter={(label) => {
                  const d = analysis.abrilProjected.find((p) => p.fecha === label);
                  return d ? `Día ${label} (${d.dia_semana})` : `Día ${label}`;
                }}
              />
              <ReferenceLine y={META_DIARIA} stroke="#F97316" strokeDasharray="4 4" label={{ value: `Meta: ${META_DIARIA.toLocaleString()}`, fill: "#F97316", fontSize: 10, position: "right" }} />
              {analysis.necesarioPorDiaRestante > 0 && analysis.necesarioPorDiaRestante !== META_DIARIA && (
                <ReferenceLine y={analysis.necesarioPorDiaRestante} stroke="#8B5CF6" strokeDasharray="4 4" label={{ value: `Necesario: ${analysis.necesarioPorDiaRestante.toLocaleString()}`, fill: "#8B5CF6", fontSize: 10, position: "left" }} />
              )}
              <Bar dataKey="real" name="real" radius={[4, 4, 0, 0]} barSize={16}>
                {analysis.abrilProjected.map((d, i) => {
                  const color = d.ordenes != null
                    ? d.ordenes >= META_DIARIA ? "#10B981" : d.ordenes >= META_DIARIA * 0.8 ? "#F59E0B" : "#EF4444"
                    : "transparent";
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
              <Bar dataKey="necesario" name="necesario" radius={[4, 4, 0, 0]} barSize={16} opacity={0.35}>
                {analysis.abrilProjected.map((d, i) => (
                  <Cell key={i} fill={d.ordenes != null ? "transparent" : "#8B5CF6"} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="proyectado" stroke="#6B7280" strokeWidth={1} strokeDasharray="6 3" dot={false} name="Proyección base" />
            </ComposedChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex gap-4 mt-2 justify-center flex-wrap">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded" style={{ background: "#10B981" }} />
              <span className="text-gray-400">Cumple meta ({">="}{META_DIARIA.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded" style={{ background: "#F59E0B" }} />
              <span className="text-gray-400">Aceptable ({">="}{Math.round(META_DIARIA * 0.8).toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded" style={{ background: "#EF4444" }} />
              <span className="text-gray-400">Bajo meta ({"<"}{Math.round(META_DIARIA * 0.8).toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-3 h-3 rounded" style={{ background: "#8B5CF6", opacity: 0.35 }} />
              <span className="text-gray-400">Necesario/día restante ({analysis.necesarioPorDiaRestante.toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-8 border-t border-dashed border-gray-500" />
              <span className="text-gray-400">Proyección base (Marzo)</span>
            </div>
          </div>
        </div>
      )}

      {/* Marzo reference chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Referencia Marzo 2026
          <span className="text-[10px] text-gray-500 ml-2">
            Total: {metaInfo.marzo_total_ordenes.toLocaleString()} &middot; Prom: {metaInfo.marzo_promedio_diario.toLocaleString()}/día
          </span>
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={marzoChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "12px", color: "#F97316" }}
              itemStyle={{ color: "#F97316" }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(value) => `${Number(value).toLocaleString()} órdenes`}
            />
            <ReferenceLine y={metaInfo.marzo_promedio_diario} stroke="#6B7280" strokeDasharray="4 4" label={{ value: `Prom: ${metaInfo.marzo_promedio_diario.toLocaleString()}`, fill: "#6B7280", fontSize: 10, position: "right" }} />
            <Bar dataKey="Órdenes" radius={[4, 4, 0, 0]} fill="#F97316" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Day-of-week pattern */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Patrón por Día de Semana (Marzo)</h3>
        <div className="grid grid-cols-7 gap-2">
          {["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"].map((dow) => {
            const avg = analysis.dowAvg[dow] || 0;
            return (
              <div key={dow} className="text-center p-2 rounded-xl border border-gray-800" style={{ background: "rgba(15,52,96,0.15)" }}>
                <p className="text-[10px] text-gray-400">{dow.slice(0, 3)}</p>
                <p className="text-lg font-bold text-orange-400">{avg.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">prom/día</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
