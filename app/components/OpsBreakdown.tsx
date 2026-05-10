"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

// ─── Estados que NO cuentan como movilizadas ───
const NO_MOV = new Set([
  "PENDIENTE", "PENDIENTE CONFIRMACION", "GUIA_GENERADA",
  "PREPARADO PARA TRANSPORTADORA", "CANCELADO", "RECHAZADO",
  "GUIA ANULADA", "CANCELADO POR TRANSPORTADORA",
]);

const normalizeName = (s: string) => (s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/\s*\(\d+\)\s*$/, "")
  .replace(/[^a-z0-9]/g, "");

interface OpsRow {
  nombre: string;
  total: number;
  estados: Record<string, number>;
  id?: any;
}

interface Aggregated {
  nombre: string;
  cleanNombre: string;
  total: number;
  mov: number;
  ent: number;
  dev: number;
  noEnt: number;
  cancelado: number;
  novedad: number;
  enTransito: number;
  pendienteDS: number;
  pctMov: number;
  pctEnt: number;
  pctDev: number;
}

function aggregate(rows: OpsRow[]): Aggregated[] {
  return rows.map((r) => {
    const e = r.estados || {};
    let noMov = 0;
    for (const k in e) if (NO_MOV.has(k)) noMov += e[k] || 0;
    const total = r.total || 0;
    const mov = total - noMov;
    const ent = e["ENTREGADO"] || 0;
    const dev = (e["DEVOLUCION"] || 0) + (e["EN PROCESO DE DEVOLUCION"] || 0);
    const noEnt = e["NO ENTREGADA"] || 0;
    const cancelado = (e["CANCELADO"] || 0) + (e["RECHAZADO"] || 0) + (e["GUIA ANULADA"] || 0) + (e["CANCELADO POR TRANSPORTADORA"] || 0);
    const novedad = (e["NOVEDAD"] || 0) + (e["NOVEDAD SOLUCIONADA"] || 0);
    const pendienteDS = e["PENDIENTE CONFIRMACION"] || 0;
    const enTransito = mov - ent - dev - noEnt - novedad;
    const pctMov = total > 0 ? mov / total : 0;
    const pctEnt = mov > 0 ? ent / mov : 0;
    const pctDev = mov > 0 ? dev / mov : 0;
    return {
      nombre: r.nombre,
      cleanNombre: r.nombre.replace(/\s*\(\d+\)\s*$/, "").trim(),
      total, mov, ent, dev, noEnt, cancelado, novedad, enTransito, pendienteDS,
      pctMov, pctEnt, pctDev,
    };
  }).sort((a, b) => b.mov - a.mov);
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════════════════
type Mes = "abril" | "mayo";
type Category = "dropshipper" | "proveedor";

const MES_LABEL: Record<Mes, string> = { abril: "Abril 2026", mayo: "Mayo 2026" };

export default function OpsBreakdown({
  country,
  mes,
  category,
}: {
  country: "ar" | "py";
  mes: Mes;
  category: Category;
}) {
  const [data, setData] = useState<Aggregated[]>([]);
  const [prev, setPrev] = useState<Aggregated[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de rango de días — aplica al chart diario y reemplaza la tabla
  // de detalle con vista comparativa por rango cuando está activo.
  type RangeMode = "all" | "single" | "range";
  const [rangeMode, setRangeMode] = useState<RangeMode>("all");
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(7);

  const prevMes: Mes | null = mes === "mayo" ? "abril" : null;
  const dataKey = category === "dropshipper" ? "by_dropshipper" : "by_proveedor";
  const catLabel = category === "dropshipper" ? "Dropshippers" : "Proveedores";
  const catSing = category === "dropshipper" ? "Dropshipper" : "Proveedor";
  const emoji = category === "dropshipper" ? "👥" : "📦";

  // Daily breakdown (by_ds_daily si dropshipper, by_date si proveedor)
  type DSDaily = { ds: string; fecha: string; ordenes: number };
  type DateRow = { fecha: string; total: number };
  type DSProducto = { ds: string; producto: string; ordenes: number };
  const [dailyCur, setDailyCur] = useState<{ dsDaily: DSDaily[]; byDate: DateRow[]; dsProducto: DSProducto[] }>({ dsDaily: [], byDate: [], dsProducto: [] });
  const [dailyPrev, setDailyPrev] = useState<{ dsDaily: DSDaily[]; byDate: DateRow[]; dsProducto: DSProducto[] }>({ dsDaily: [], byDate: [], dsProducto: [] });
  const [filterDS, setFilterDS] = useState<string>("__all__");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const reqs: Promise<any>[] = [
      fetch(`/api/data/operational?country=${country}&mes=${mes}`).then((r) => r.json()).catch(() => null),
    ];
    if (prevMes) {
      reqs.push(fetch(`/api/data/operational?country=${country}&mes=${prevMes}`).then((r) => r.json()).catch(() => null));
    }
    Promise.all(reqs).then(([cur, pr]) => {
      if (cancelled) return;
      const curRows = cur?.data?.[dataKey] || [];
      const prevRows = pr?.data?.[dataKey] || [];
      setData(aggregate(curRows));
      setPrev(aggregate(prevRows));
      setDailyCur({
        dsDaily: cur?.data?.by_ds_daily || [],
        byDate: cur?.data?.by_date || [],
        dsProducto: cur?.data?.by_ds_producto || [],
      });
      setDailyPrev({
        dsDaily: pr?.data?.by_ds_daily || [],
        byDate: pr?.data?.by_date || [],
        dsProducto: pr?.data?.by_ds_producto || [],
      });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [country, mes, dataKey, prevMes]);

  // Lista única de DS para el filtro (combina ambos meses)
  const dsList = useMemo(() => {
    if (category !== "dropshipper") return [] as string[];
    const set = new Set<string>();
    dailyCur.dsDaily.forEach((d) => d.ds && set.add(d.ds));
    dailyPrev.dsDaily.forEach((d) => d.ds && set.add(d.ds));
    return Array.from(set).sort();
  }, [category, dailyCur, dailyPrev]);

  // Helper: extrae el día del mes de un string fecha (DD-MM-YYYY o YYYY-MM-DD)
  const dayOf = (f: string) => {
    const m1 = /^(\d{2})-\d{2}-\d{4}$/.exec(f);
    if (m1) return parseInt(m1[1], 10);
    const m2 = /^\d{4}-\d{2}-(\d{2})$/.exec(f);
    if (m2) return parseInt(m2[1], 10);
    return 0;
  };

  // Rango efectivo según el modo de filtro
  const effectiveRange = useMemo(() => {
    if (rangeMode === "all") return { from: 1, to: 31 };
    if (rangeMode === "single") return { from: rangeFrom, to: rangeFrom };
    return { from: Math.min(rangeFrom, rangeTo), to: Math.max(rangeFrom, rangeTo) };
  }, [rangeMode, rangeFrom, rangeTo]);

  const isRangeFiltered = rangeMode !== "all";

  // Construye serie diaria por día del mes (1-31) sumando todos los DS o filtrado
  const dailySeries = useMemo(() => {
    const aggDaily = (rows: DSDaily[] | DateRow[], useDsDaily: boolean): Map<number, number> => {
      const map = new Map<number, number>();
      for (const r of rows as any[]) {
        if (useDsDaily) {
          if (filterDS !== "__all__" && r.ds !== filterDS) continue;
        }
        const d = dayOf(r.fecha);
        if (!d) continue;
        const v = useDsDaily ? (r.ordenes || 0) : (r.total || 0);
        map.set(d, (map.get(d) || 0) + v);
      }
      return map;
    };
    const useDs = category === "dropshipper" && (dailyCur.dsDaily.length > 0 || dailyPrev.dsDaily.length > 0);
    const curMap = useDs ? aggDaily(dailyCur.dsDaily, true) : aggDaily(dailyCur.byDate, false);
    const prevMap = useDs ? aggDaily(dailyPrev.dsDaily, true) : aggDaily(dailyPrev.byDate, false);
    const out: { dia: number; [k: string]: number }[] = [];
    for (let i = effectiveRange.from; i <= effectiveRange.to; i++) {
      out.push({
        dia: i,
        [MES_LABEL[mes].split(" ")[0]]: curMap.get(i) || 0,
        ...(prevMes ? { [MES_LABEL[prevMes].split(" ")[0]]: prevMap.get(i) || 0 } : {}),
      });
    }
    return out;
  }, [dailyCur, dailyPrev, filterDS, category, mes, prevMes, effectiveRange]);

  // Tabla por DS dentro del rango filtrado (solo cuando rangeMode !== "all")
  // Usa by_ds_daily para sumar ordenes en el rango por cada DS.
  const rangeByDS = useMemo(() => {
    if (!isRangeFiltered || category !== "dropshipper") return [] as Array<{
      ds: string; cleanDs: string; abrIng: number; mayIng: number; growth: number | null;
      promAbr: number; promMay: number; diasActivosAbr: number; diasActivosMay: number;
    }>;
    const sumInRange = (rows: DSDaily[]) => {
      const map = new Map<string, { ing: number; days: Set<number> }>();
      for (const r of rows) {
        const d = dayOf(r.fecha);
        if (!d) continue;
        if (d < effectiveRange.from || d > effectiveRange.to) continue;
        if (!r.ds) continue;
        const cur = map.get(r.ds) || { ing: 0, days: new Set<number>() };
        cur.ing += r.ordenes || 0;
        cur.days.add(d);
        map.set(r.ds, cur);
      }
      return map;
    };
    const aMap = sumInRange(dailyPrev.dsDaily);
    const mMap = sumInRange(dailyCur.dsDaily);
    const allKeys = new Set<string>([...aMap.keys(), ...mMap.keys()]);
    const out: any[] = [];
    allKeys.forEach((ds) => {
      const a = aMap.get(ds);
      const m = mMap.get(ds);
      const abrIng = a?.ing || 0;
      const mayIng = m?.ing || 0;
      const growth = abrIng > 0 ? ((mayIng - abrIng) / abrIng) * 100 : (mayIng > 0 ? null : 0);
      const diasAbr = a?.days.size || 0;
      const diasMay = m?.days.size || 0;
      out.push({
        ds,
        cleanDs: ds.replace(/\s*\(\d+\)\s*$/, "").trim(),
        abrIng, mayIng,
        growth,
        promAbr: diasAbr > 0 ? abrIng / diasAbr : 0,
        promMay: diasMay > 0 ? mayIng / diasMay : 0,
        diasActivosAbr: diasAbr,
        diasActivosMay: diasMay,
      });
    });
    return out
      .filter((r) => r.abrIng > 0 || r.mayIng > 0)
      .sort((a, b) => b.mayIng - a.mayIng);
  }, [dailyCur, dailyPrev, effectiveRange, isRangeFiltered, category]);

  // Top productos en el rango (estimación proporcional cuando hay filtro):
  // Para cada DS, computamos su share del mes (días del rango / días del mes).
  // Aplicamos ese factor a sus productos para estimar volumen en el rango.
  // Sin filtro: muestra el total real del mes desde by_ds_producto.
  const topProductos = useMemo(() => {
    const computeMonth = (daily: { dsDaily: DSDaily[]; dsProducto: DSProducto[] }) => {
      // Total por DS en el rango
      const dsRangeTotal = new Map<string, number>();
      const dsMonthTotal = new Map<string, number>();
      for (const d of daily.dsDaily) {
        const day = dayOf(d.fecha);
        if (!day || !d.ds) continue;
        dsMonthTotal.set(d.ds, (dsMonthTotal.get(d.ds) || 0) + (d.ordenes || 0));
        if (day < effectiveRange.from || day > effectiveRange.to) continue;
        dsRangeTotal.set(d.ds, (dsRangeTotal.get(d.ds) || 0) + (d.ordenes || 0));
      }
      const productMap = new Map<string, number>();
      for (const p of daily.dsProducto) {
        if (!p.producto || !p.ds) continue;
        const monthTotal = dsMonthTotal.get(p.ds) || 0;
        const rangeTotal = dsRangeTotal.get(p.ds) || 0;
        if (monthTotal <= 0) continue;
        const factor = isRangeFiltered ? rangeTotal / monthTotal : 1;
        const estimated = (p.ordenes || 0) * factor;
        if (estimated > 0) {
          productMap.set(p.producto, (productMap.get(p.producto) || 0) + estimated);
        }
      }
      return productMap;
    };
    const curMap = computeMonth(dailyCur);
    const prevMap = computeMonth(dailyPrev);
    const all = new Set([...curMap.keys(), ...prevMap.keys()]);
    const rows: { producto: string; cur: number; prev: number; growth: number | null }[] = [];
    all.forEach((producto) => {
      const cur = Math.round(curMap.get(producto) || 0);
      const prev = Math.round(prevMap.get(producto) || 0);
      const growth = prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? null : 0);
      rows.push({ producto, cur, prev, growth });
    });
    return rows.sort((a, b) => b.cur - a.cur).slice(0, 15);
  }, [dailyCur, dailyPrev, effectiveRange, isRangeFiltered]);

  // Totales acumulados de la serie (para mostrar en header del chart)
  const dailyTotals = useMemo(() => {
    const curKey = MES_LABEL[mes].split(" ")[0];
    const prevKey = prevMes ? MES_LABEL[prevMes].split(" ")[0] : "";
    let cur = 0, pr = 0;
    for (const d of dailySeries) {
      cur += (d as any)[curKey] || 0;
      if (prevKey) pr += (d as any)[prevKey] || 0;
    }
    return { cur, prev: pr };
  }, [dailySeries, mes, prevMes]);

  const prevByKey = useMemo(() => {
    const m = new Map<string, Aggregated>();
    for (const r of prev) m.set(normalizeName(r.nombre), r);
    return m;
  }, [prev]);

  const enriched = useMemo(() => {
    return data.map((d) => {
      const prevEntry = prevByKey.get(normalizeName(d.nombre));
      const prevMov = prevEntry?.mov ?? 0;
      const prevTotal = prevEntry?.total ?? 0;
      const growthMov = prevMov > 0 ? ((d.mov - prevMov) / prevMov) * 100 : (d.mov > 0 && !prevEntry ? null : 0);
      return { ...d, prevMov, prevTotal, growthMov };
    });
  }, [data, prevByKey]);

  const totals = useMemo(() => ({
    total: data.reduce((s, r) => s + r.total, 0),
    mov: data.reduce((s, r) => s + r.mov, 0),
    ent: data.reduce((s, r) => s + r.ent, 0),
    dev: data.reduce((s, r) => s + r.dev, 0),
    noEnt: data.reduce((s, r) => s + r.noEnt, 0),
    cancelado: data.reduce((s, r) => s + r.cancelado, 0),
    novedad: data.reduce((s, r) => s + r.novedad, 0),
    pendienteDS: data.reduce((s, r) => s + r.pendienteDS, 0),
  }), [data]);

  const prevTotals = useMemo(() => ({
    mov: prev.reduce((s, r) => s + r.mov, 0),
    total: prev.reduce((s, r) => s + r.total, 0),
  }), [prev]);

  const growthTotalMov = prevTotals.mov > 0 ? ((totals.mov - prevTotals.mov) / prevTotals.mov) * 100 : null;

  // Pareto: top que acumula 80% del volumen
  const paretoTop = useMemo(() => {
    let acum = 0;
    const limit = totals.mov * 0.8;
    const out: typeof enriched = [];
    for (const r of enriched) {
      out.push(r);
      acum += r.mov;
      if (acum >= limit) break;
    }
    return out;
  }, [enriched, totals.mov]);

  const top20 = enriched.slice(0, 20);
  const top20Chart = top20.map((d) => ({
    name: d.cleanNombre.length > 18 ? d.cleanNombre.slice(0, 18) + "…" : d.cleanNombre,
    [MES_LABEL[mes].split(" ")[0]]: d.mov,
    ...(prevMes ? { [MES_LABEL[prevMes].split(" ")[0]]: d.prevMov } : {}),
  }));

  const breakdownData = [
    { name: "Entregadas", value: totals.ent, color: "#10B981" },
    { name: "En tránsito", value: Math.max(totals.mov - totals.ent - totals.dev - totals.noEnt - totals.novedad, 0), color: "#3B82F6" },
    { name: "No entregadas", value: totals.noEnt, color: "#F59E0B" },
    { name: "Devoluciones", value: totals.dev, color: "#EF4444" },
    { name: "Novedades", value: totals.novedad, color: "#A855F7" },
  ].filter((x) => x.value > 0);

  if (loading) {
    return <div className="glass-card p-5 text-xs t-muted">Cargando data operacional de {MES_LABEL[mes]}…</div>;
  }
  if (data.length === 0) {
    return (
      <div className="glass-card p-5 border border-amber-500/30 bg-amber-500/5">
        <p className="text-sm font-semibold t-primary mb-1">📋 No hay data operacional de {MES_LABEL[mes]} todavía</p>
        <p className="text-xs t-muted">Subí el Excel diario desde el sub-tab "📊 General" → "Análisis Operacional" para ver la data por {catLabel.toLowerCase()}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-lg font-bold t-primary flex items-center gap-2">
            {emoji} {catLabel} — Data Operacional {MES_LABEL[mes]}
          </h2>
          <span className="text-[11px] t-muted">{data.length} {catLabel.toLowerCase()} activos · {totals.mov.toLocaleString("es-AR")} guías movilizadas</span>
        </div>
        <p className="text-xs t-muted">Datos reales del archivo de Dropi cargado en el mes activo. {prevMes ? `Comparación vs ${MES_LABEL[prevMes]}.` : ""}</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Ingresadas" value={totals.total} sub={prevMes ? `vs ${prevTotals.total.toLocaleString("es-AR")} en ${MES_LABEL[prevMes].split(" ")[0]}` : "Total mes"} color="#A855F7" />
        <Kpi label="Movilizadas" value={totals.mov} sub={`${totals.total > 0 ? ((totals.mov / totals.total) * 100).toFixed(1) : 0}% de ingresadas${prevMes && growthTotalMov !== null ? ` · ${(growthTotalMov >= 0 ? "+" : "") + growthTotalMov.toFixed(1) + "%"} vs ${MES_LABEL[prevMes].split(" ")[0]}` : ""}`} color="#10B981" />
        <Kpi label="Entregadas" value={totals.ent} sub={`${totals.mov > 0 ? ((totals.ent / totals.mov) * 100).toFixed(1) : 0}% de movilizadas`} color="#3B82F6" />
        <Kpi label="Devoluciones" value={totals.dev} sub={`${totals.mov > 0 ? ((totals.dev / totals.mov) * 100).toFixed(1) : 0}% de movilizadas`} color="#EF4444" />
        <Kpi label="No entregadas" value={totals.noEnt} sub={`${totals.mov > 0 ? ((totals.noEnt / totals.mov) * 100).toFixed(1) : 0}% de movilizadas`} color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 20 con comparación */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold t-primary mb-3">Top 20 {catLabel} por volumen movilizado</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top20Chart} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis type="number" stroke="#888" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#888" fontSize={10} width={130} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString("es-AR")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {prevMes && <Bar dataKey={MES_LABEL[prevMes].split(" ")[0]} fill="#6B7280" radius={[0, 4, 4, 0]} barSize={10} />}
              <Bar dataKey={MES_LABEL[mes].split(" ")[0]} fill="#F97316" radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución de estados */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold t-primary mb-3">Distribución de estados — {MES_LABEL[mes]}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={breakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2} label={(e) => `${e.name}: ${e.value.toLocaleString("es-AR")}`}>
                {breakdownData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString("es-AR")} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
            <div className="t-muted">Pendientes confirmación: <strong className="t-primary">{totals.pendienteDS.toLocaleString("es-AR")}</strong></div>
            <div className="t-muted">Canceladas/rechazadas: <strong className="t-primary">{totals.cancelado.toLocaleString("es-AR")}</strong></div>
          </div>
        </div>
      </div>

      {/* Comparativo diario Abril vs Mayo */}
      {prevMes && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold t-primary">📅 Comparativo diario — {MES_LABEL[prevMes].split(" ")[0]} vs {MES_LABEL[mes].split(" ")[0]}</h3>
              <p className="text-[11px] t-muted mt-0.5">
                {filterDS === "__all__" ? `Total ingresadas/día (${data.length} ${catLabel.toLowerCase()})` : `Filtrado: ${filterDS.replace(/\s*\(\d+\)\s*$/, "").trim()}`}
                {isRangeFiltered && (
                  <> · <strong className="text-orange-300">{rangeMode === "single" ? `Día ${effectiveRange.from}` : `Días ${effectiveRange.from}–${effectiveRange.to}`}</strong></>
                )}
                {" · "}
                {MES_LABEL[prevMes].split(" ")[0]}: <strong className="t-primary">{dailyTotals.prev.toLocaleString("es-AR")}</strong>
                {" · "}
                {MES_LABEL[mes].split(" ")[0]}: <strong className="t-primary">{dailyTotals.cur.toLocaleString("es-AR")}</strong>
                {dailyTotals.prev > 0 && (
                  <span className="ml-2" style={{ color: dailyTotals.cur >= dailyTotals.prev ? "#10B981" : "#EF4444" }}>
                    ({dailyTotals.cur >= dailyTotals.prev ? "+" : ""}{(((dailyTotals.cur - dailyTotals.prev) / dailyTotals.prev) * 100).toFixed(1)}%)
                  </span>
                )}
              </p>
            </div>
            {category === "dropshipper" && dsList.length > 0 && (
              <select
                value={filterDS}
                onChange={(e) => setFilterDS(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg bg-[#16213e] border border-orange-500/20 text-white focus:outline-none focus:border-orange-500/50 max-w-[260px]"
              >
                <option value="__all__">Todos los dropshippers</option>
                {dsList.map((ds) => (
                  <option key={ds} value={ds}>{ds.length > 40 ? ds.slice(0, 40) + "…" : ds}</option>
                ))}
              </select>
            )}
          </div>

          {/* Filtro de fechas */}
          <div className="flex items-center flex-wrap gap-2 mb-3 p-3 rounded-lg" style={{ background: "rgba(15,23,42,0.5)" }}>
            <span className="text-[11px] t-muted uppercase tracking-wider">Filtro:</span>
            {(["all", "single", "range"] as RangeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setRangeMode(m)}
                className={`text-[11px] px-3 py-1 rounded-full transition-all ${
                  rangeMode === m
                    ? "bg-orange-500 text-white"
                    : "bg-transparent t-secondary border border-gray-700 hover:border-orange-500/40"
                }`}
              >
                {m === "all" ? "Todos los días" : m === "single" ? "Día único" : "Rango"}
              </button>
            ))}
            {rangeMode === "single" && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] t-muted">Día:</span>
                <select
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(parseInt(e.target.value))}
                  className="text-xs px-2 py-1 rounded bg-[#16213e] border border-orange-500/20 text-white focus:outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span className="text-[11px] t-muted">→ compara {MES_LABEL[prevMes].split(" ")[0]} {rangeFrom} con {MES_LABEL[mes].split(" ")[0]} {rangeFrom}</span>
              </div>
            )}
            {rangeMode === "range" && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] t-muted">Desde:</span>
                <select
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(parseInt(e.target.value))}
                  className="text-xs px-2 py-1 rounded bg-[#16213e] border border-orange-500/20 text-white focus:outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span className="text-[11px] t-muted">Hasta:</span>
                <select
                  value={rangeTo}
                  onChange={(e) => setRangeTo(parseInt(e.target.value))}
                  className="text-xs px-2 py-1 rounded bg-[#16213e] border border-orange-500/20 text-white focus:outline-none"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span className="text-[11px] t-muted">→ compara {MES_LABEL[prevMes].split(" ")[0]} {Math.min(rangeFrom, rangeTo)}–{Math.max(rangeFrom, rangeTo)} con {MES_LABEL[mes].split(" ")[0]} {Math.min(rangeFrom, rangeTo)}–{Math.max(rangeFrom, rangeTo)}</span>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            {rangeMode === "single" ? (
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="dia" stroke="#888" fontSize={10} tickFormatter={(v) => `Día ${v}`} />
                <YAxis stroke="#888" fontSize={10} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString("es-AR")} labelFormatter={(d) => `Día ${d}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey={MES_LABEL[prevMes].split(" ")[0]} fill="#6B7280" />
                <Bar dataKey={MES_LABEL[mes].split(" ")[0]} fill="#F97316" />
              </BarChart>
            ) : (
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="dia" stroke="#888" fontSize={10} tickFormatter={(v) => `${v}`} label={{ value: "Día del mes", fill: "#888", fontSize: 11, position: "insideBottom", offset: -5 }} />
                <YAxis stroke="#888" fontSize={10} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString("es-AR")} labelFormatter={(d) => `Día ${d}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey={MES_LABEL[prevMes].split(" ")[0]} stroke="#6B7280" strokeWidth={2} dot={{ fill: "#6B7280", r: 3 }} />
                <Line type="monotone" dataKey={MES_LABEL[mes].split(" ")[0]} stroke="#F97316" strokeWidth={2} dot={{ fill: "#F97316", r: 3 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
          <p className="text-[11px] t-muted mt-2">
            {isRangeFiltered ? `Comparando ${rangeMode === "single" ? `el día ${effectiveRange.from}` : `los días ${effectiveRange.from}–${effectiveRange.to}`} de ambos meses.` : "Comparación día por día."} {category === "dropshipper" && "Filtrá un dropshipper para ver su evolución diaria individual."}
          </p>
        </div>
      )}

      {/* Top productos movidos (Abril vs Mayo, con filtro de rango aplicado) */}
      {prevMes && topProductos.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
            <h3 className="text-sm font-semibold t-primary">🏷️ Top Productos Movidos — {MES_LABEL[prevMes].split(" ")[0]} vs {MES_LABEL[mes].split(" ")[0]}</h3>
            <span className="text-[11px] t-muted">
              {isRangeFiltered ? (
                <>Rango: <strong className="text-orange-300">{rangeMode === "single" ? `Día ${effectiveRange.from}` : `Días ${effectiveRange.from}–${effectiveRange.to}`}</strong> · estimado proporcional</>
              ) : (
                "Volumen total del mes"
              )}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={topProductos.map((p) => ({
              name: p.producto.length > 30 ? p.producto.slice(0, 30) + "…" : p.producto,
              [MES_LABEL[prevMes].split(" ")[0]]: p.prev,
              [MES_LABEL[mes].split(" ")[0]]: p.cur,
            }))} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis type="number" stroke="#888" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#888" fontSize={10} width={200} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", fontSize: 11 }} formatter={(v) => Number(v).toLocaleString("es-AR")} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={MES_LABEL[prevMes].split(" ")[0]} fill="#6B7280" radius={[0, 4, 4, 0]} barSize={10} />
              <Bar dataKey={MES_LABEL[mes].split(" ")[0]} fill="#F97316" radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-3 text-left text-[11px] t-muted">Producto</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[prevMes].split(" ")[0]}</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[mes].split(" ")[0]}</th>
                  <th className="py-2 px-3 text-right text-[11px] t-muted">Crec. %</th>
                </tr>
              </thead>
              <tbody>
                {topProductos.map((p, i) => (
                  <tr key={p.producto} className="border-b border-gray-800/50 hover:bg-orange-500/5">
                    <td className="py-2 px-3 t-primary text-xs"><span className="t-muted mr-2">{i + 1}.</span>{p.producto}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs t-muted">{p.prev > 0 ? p.prev.toLocaleString("es-AR") : "—"}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs font-bold text-orange-400">{p.cur > 0 ? p.cur.toLocaleString("es-AR") : "—"}</td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: p.growth === null ? "#10B981" : (p.growth ?? 0) >= 0 ? "#10B981" : "#EF4444" }}>
                      {p.growth === null ? "🆕" : (p.growth >= 0 ? "+" : "") + p.growth.toFixed(0) + "%"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isRangeFiltered && (
            <p className="text-[11px] t-muted mt-3">
              ⓘ Los volúmenes por rango son estimados proporcionalmente: por cada dropshipper, su share del rango (días del rango / días totales) se aplica a su mix de productos del mes.
            </p>
          )}
        </div>
      )}

      {/* Tabla comparativa por rango (solo cuando hay filtro de fechas activo) */}
      {prevMes && isRangeFiltered && category === "dropshipper" && rangeByDS.length > 0 && (
        <div className="glass-card overflow-x-auto">
          <h3 className="text-sm font-semibold t-primary mb-3 px-5 pt-5">
            Comparativo por dropshipper — {rangeMode === "single" ? `Día ${effectiveRange.from}` : `Días ${effectiveRange.from}–${effectiveRange.to}`} ({MES_LABEL[prevMes].split(" ")[0]} vs {MES_LABEL[mes].split(" ")[0]})
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-left text-[11px] t-muted">Dropshipper</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[prevMes].split(" ")[0]} ing</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Días activos {MES_LABEL[prevMes].split(" ")[0]}</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Prom/día {MES_LABEL[prevMes].split(" ")[0]}</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[mes].split(" ")[0]} ing</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Días activos {MES_LABEL[mes].split(" ")[0]}</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Prom/día {MES_LABEL[mes].split(" ")[0]}</th>
                <th className="py-2 px-3 text-right text-[11px] t-muted">Crec. %</th>
              </tr>
            </thead>
            <tbody>
              {rangeByDS.map((r, i) => (
                <tr key={r.ds} className="border-b border-gray-800/50 hover:bg-orange-500/5">
                  <td className="py-2 px-3 t-primary text-xs">
                    <span className="t-muted mr-2">{i + 1}.</span>{r.cleanDs}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-xs t-muted">{r.abrIng > 0 ? r.abrIng.toLocaleString("es-AR") : "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs t-muted">{r.diasActivosAbr || "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs t-muted">{r.promAbr > 0 ? Math.round(r.promAbr).toLocaleString("es-AR") : "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs font-bold text-orange-400">{r.mayIng > 0 ? r.mayIng.toLocaleString("es-AR") : "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.diasActivosMay || "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.promMay > 0 ? Math.round(r.promMay).toLocaleString("es-AR") : "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: r.growth === null ? "#10B981" : (r.growth ?? 0) >= 0 ? "#10B981" : "#EF4444" }}>
                    {r.growth === null ? "🆕" : (r.growth >= 0 ? "+" : "") + r.growth.toFixed(0) + "%"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(() => {
                const tAbr = rangeByDS.reduce((s, r) => s + r.abrIng, 0);
                const tMay = rangeByDS.reduce((s, r) => s + r.mayIng, 0);
                const grTot = tAbr > 0 ? ((tMay - tAbr) / tAbr) * 100 : null;
                return (
                  <tr style={{ background: "rgba(249,115,22,0.08)", fontWeight: 700 }}>
                    <td className="py-2 px-3 t-primary text-xs">TOTAL ({rangeByDS.length})</td>
                    <td className="py-2 px-3 text-right font-mono text-xs">{tAbr.toLocaleString("es-AR")}</td>
                    <td colSpan={2}></td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-orange-400">{tMay.toLocaleString("es-AR")}</td>
                    <td colSpan={2}></td>
                    <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: (grTot ?? 0) >= 0 ? "#10B981" : "#EF4444" }}>
                      {grTot === null ? "—" : (grTot >= 0 ? "+" : "") + grTot.toFixed(1) + "%"}
                    </td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
          <p className="text-[11px] t-muted px-5 pb-4 mt-2">
            Esta tabla compara solo el rango filtrado. La tabla "Detalle por dropshipper" más abajo sigue mostrando totales del mes completo.
          </p>
        </div>
      )}

      {/* Pareto card */}
      <div className="glass-card p-5 border-l-2 border-orange-500/40">
        <h3 className="text-sm font-semibold t-primary mb-2">📌 Pareto del mes — {paretoTop.length} {catLabel.toLowerCase()} concentran 80% del volumen movilizado</h3>
        <div className="flex flex-wrap gap-2">
          {paretoTop.map((d, i) => (
            <span key={d.nombre} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] border border-orange-500/30 bg-orange-500/10 text-orange-300">
              <span className="font-bold">{i + 1}.</span> {d.cleanNombre} <span className="t-muted">{d.mov.toLocaleString("es-AR")}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Tabla detallada con comparación */}
      <div className="glass-card overflow-x-auto">
        <h3 className="text-sm font-semibold t-primary mb-3 px-5 pt-5">Detalle por {catSing.toLowerCase()} — {MES_LABEL[mes]}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="py-2 px-3 text-left text-[11px] t-muted">{catSing}</th>
              {prevMes && <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[prevMes].split(" ")[0]} ing.</th>}
              {prevMes && <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[prevMes].split(" ")[0]} mov.</th>}
              <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[mes].split(" ")[0]} ing.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">{MES_LABEL[mes].split(" ")[0]} mov.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Crec. mov</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Entregadas</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">% Ent.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">Devoluciones</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">% Dev.</th>
              <th className="py-2 px-3 text-right text-[11px] t-muted">No entr.</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((d, i) => (
              <tr key={d.nombre} className="border-b border-gray-800/50 hover:bg-orange-500/5">
                <td className="py-2 px-3 t-primary text-xs">
                  <span className="t-muted mr-2">{i + 1}.</span>{d.cleanNombre}
                </td>
                {prevMes && <td className="py-2 px-3 text-right font-mono text-xs t-muted">{d.prevTotal > 0 ? d.prevTotal.toLocaleString("es-AR") : "—"}</td>}
                {prevMes && <td className="py-2 px-3 text-right font-mono text-xs t-muted">{d.prevMov > 0 ? d.prevMov.toLocaleString("es-AR") : "—"}</td>}
                <td className="py-2 px-3 text-right font-mono text-xs t-secondary">{d.total.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs font-bold text-orange-400">{d.mov.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: d.growthMov === null ? "#10B981" : (d.growthMov ?? 0) >= 0 ? "#10B981" : "#EF4444" }}>
                  {d.growthMov === null ? "🆕" : (d.growthMov >= 0 ? "+" : "") + d.growthMov.toFixed(0) + "%"}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs">{d.ent.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: d.pctEnt >= 0.6 ? "#10B981" : d.pctEnt >= 0.4 ? "#F59E0B" : "#EF4444" }}>
                  {(d.pctEnt * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs">{d.dev.toLocaleString("es-AR")}</td>
                <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: d.pctDev > 0.3 ? "#EF4444" : d.pctDev > 0.2 ? "#F59E0B" : "#9CA3AF" }}>
                  {(d.pctDev * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs t-muted">{d.noEnt.toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "rgba(249,115,22,0.08)", fontWeight: 700 }}>
              <td className="py-2 px-3 t-primary text-xs">TOTAL ({data.length})</td>
              {prevMes && <td className="py-2 px-3 text-right font-mono text-xs">{prevTotals.total.toLocaleString("es-AR")}</td>}
              {prevMes && <td className="py-2 px-3 text-right font-mono text-xs">{prevTotals.mov.toLocaleString("es-AR")}</td>}
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.total.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs text-orange-400">{totals.mov.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: (growthTotalMov ?? 0) >= 0 ? "#10B981" : "#EF4444" }}>
                {growthTotalMov === null ? "—" : (growthTotalMov >= 0 ? "+" : "") + growthTotalMov.toFixed(1) + "%"}
              </td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.ent.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.mov > 0 ? ((totals.ent / totals.mov) * 100).toFixed(0) : 0}%</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.dev.toLocaleString("es-AR")}</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.mov > 0 ? ((totals.dev / totals.mov) * 100).toFixed(0) : 0}%</td>
              <td className="py-2 px-3 text-right font-mono text-xs">{totals.noEnt.toLocaleString("es-AR")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[11px] t-muted">{label}</p>
      <p className="font-mono text-xl font-semibold" style={{ color }}>{value.toLocaleString("es-AR")}</p>
      <p className="text-[10px] t-muted mt-1">{sub}</p>
    </div>
  );
}
