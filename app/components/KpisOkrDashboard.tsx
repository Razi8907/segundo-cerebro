"use client";

import React, { useState, useEffect, useCallback } from "react";

/* ───────── types ───────── */

interface MonthData {
  objetivo: number;
  resultado: number;
  pct: number;
}

interface KRRow {
  name: string;
  months: MonthData[]; // 12 months
}

interface ObjectiveBlock {
  name: string;
  description: string;
  krs: KRRow[];
  resultado: { pct: number }[]; // 12 months
}

interface DashboardKPI {
  name: string;
  ytd_real: string;
  meta_ytd: string;
  pct_ytd: string;
  meta_anual: string;
  pct_anual: string;
  meses: string;
}

interface ScorecardRow {
  objetivo: string;
  ene: string; feb: string; mar: string; abr: string; may: string; jun: string;
  jul: string; ago: string; sep: string; oct: string; nov: string; dic: string;
}

interface PerformerRow {
  kr: string;
  ene: string; feb: string; mar: string;
  prom_q1: string;
  lectura: string;
}

interface AlertRow {
  kr: string;
  ene: string; feb: string; mar: string;
  prom_q1: string;
  accion: string;
}

interface KpisOkrData {
  dashboard_kpis: DashboardKPI[];
  scorecard: ScorecardRow[];
  top_performers: PerformerRow[];
  alerts: AlertRow[];
  objectives: ObjectiveBlock[];
}

type SubTab = "resumen" | "detalle";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_KEYS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".").replace("%", ""));
  return isNaN(n) ? 0 : n;
}

function pctColor(pct: number): string {
  if (pct >= 80) return "text-green-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-red-400";
}

function pctBg(pct: number): string {
  if (pct >= 80) return "bg-green-500/20 text-green-400";
  if (pct >= 50) return "bg-yellow-500/20 text-yellow-400";
  if (pct > 0) return "bg-red-500/20 text-red-400";
  return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
}

/* ───────── component ───────── */

export default function KpisOkrDashboard({ country }: { country: "py" | "ar" }) {
  const [subTab, setSubTab] = useState<SubTab>("resumen");
  const [data, setData] = useState<KpisOkrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [expandedObj, setExpandedObj] = useState<Record<number, boolean>>({});
  const [filterMes, setFilterMes] = useState("");
  const [filterObjetivo, setFilterObjetivo] = useState("");
  const [dashData, setDashData] = useState<any>(null);

  /* ───── show banner ───── */
  const showBanner = useCallback((type: "success" | "error", msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }, []);

  /* ───── load data ───── */
  const loadData = useCallback(async () => {
    try {
      const [okrRes, dashRes] = await Promise.all([
        fetch(`/api/data/kpis-okr?country=${country}`, { credentials: "include" }),
        fetch(`/api/data/${country}`, { credentials: "include" }),
      ]);
      const okrJson = await okrRes.json();
      if (okrJson.data) setData(okrJson.data);
      const dJson = await dashRes.json();
      setDashData(dJson);
    } catch (err) {
      console.error("Error loading KPIs OKR data:", err);
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ───── auto KPIs from dashboard data ───── */
  const autoKpis = React.useMemo(() => {
    if (!dashData) return null;
    const r = dashData.resumen || {};
    const ene = r.enero || {}, feb = r.febrero || {}, mar = r.marzo || {};
    const totalIng = (ene.ingresadas||0)+(feb.ingresadas||0)+(mar.ingresadas||0);
    const totalMov = (ene.movilizadas||0)+(feb.movilizadas||0)+(mar.movilizadas||0);
    const totalEnt = (ene.entregados||0)+(feb.entregados||0)+(mar.entregados||0);
    const totalDev = (ene.devoluciones||0)+(feb.devoluciones||0)+(mar.devoluciones||0);
    return {
      ordenes_ytd: totalIng,
      movilizadas_ytd: totalMov,
      entregados_ytd: totalEnt,
      devoluciones_ytd: totalDev,
      proveedores: r.total_proveedores || dashData.proveedores?.length || 0,
      sellers: r.total_sellers || 0,
      dropshippers: dashData.dropshippers?.length || 0,
      pct_entrega: totalMov > 0 ? ((totalEnt / totalMov) * 100).toFixed(1) : "0",
      pct_dev: totalMov > 0 ? ((totalDev / totalMov) * 100).toFixed(1) : "0",
      meses: { ene, feb, mar },
    };
  }, [dashData]);

  /* ───── filtered month indices ───── */
  const filteredMonthIndices = React.useMemo(() => {
    if (!filterMes) return [0,1,2,3,4,5,6,7,8,9,10,11];
    const idx = MONTH_KEYS.indexOf(filterMes as any);
    return idx >= 0 ? [idx] : [0,1,2,3,4,5,6,7,8,9,10,11];
  }, [filterMes]);

  /* ───── filtered objectives ───── */
  const filteredObjectives = React.useMemo(() => {
    if (!data?.objectives) return [];
    if (!filterObjetivo) return data.objectives;
    return data.objectives.filter((_, i) => String(i) === filterObjetivo);
  }, [data?.objectives, filterObjetivo]);

  /* ───── save full data ───── */
  const saveData = useCallback(async (newData: KpisOkrData) => {
    setData(newData);
    try {
      const res = await fetch("/api/data/kpis-okr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ country, data: newData }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
    } catch (err: any) {
      showBanner("error", `Error guardando: ${err?.message || err}`);
    }
  }, [country, showBanner]);

  /* ───── update single field via PUT ───── */
  const updateField = useCallback(async (path: (string | number)[], value: any) => {
    if (!data) return;
    // Update local state
    const newData = JSON.parse(JSON.stringify(data));
    let target = newData as any;
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]];
    }
    target[path[path.length - 1]] = value;
    setData(newData);

    try {
      const res = await fetch("/api/data/kpis-okr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ country, path, value }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
    } catch (err: any) {
      showBanner("error", `Error guardando: ${err?.message || err}`);
    }
  }, [country, data, showBanner]);

  /* ───── Excel upload ───── */
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(ev.target?.result, { type: "array" });

        // ── Parse "Comercial ARG" (or first sheet with "Comercial") ──
        const comercialSheetName = wb.SheetNames.find(n => n.toLowerCase().includes("comercial")) || wb.SheetNames[0];
        const wsComercial = wb.Sheets[comercialSheetName];
        const objectives: ObjectiveBlock[] = [];

        if (wsComercial) {
          const rows = XLSX.utils.sheet_to_json(wsComercial, { header: 1 }) as any[][];

          let currentObj: ObjectiveBlock | null = null;

          for (let i = 3; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row.length) continue;

            const firstCell = safeStr(row[0]);
            if (!firstCell) continue;

            const upperFirst = firstCell.toUpperCase();

            // Check if it's a section header
            if (upperFirst.startsWith("DASHBOARD EJECUTIVO") || upperFirst.startsWith("OBJETIVO")) {
              if (currentObj) {
                objectives.push(currentObj);
              }
              if (upperFirst.startsWith("OBJETIVO")) {
                currentObj = {
                  name: firstCell,
                  description: "",
                  krs: [],
                  resultado: Array.from({ length: 12 }, () => ({ pct: 0 })),
                };
              } else {
                currentObj = null;
              }
              continue;
            }

            if (upperFirst.startsWith("RESULTADO OBJETIVO") && currentObj) {
              // Parse resultado pcts for each month
              for (let m = 0; m < 12; m++) {
                const pctCol = 1 + m * 9 + 8;
                const pctVal = safeNum(row[pctCol]) * (safeNum(row[pctCol]) <= 1 ? 100 : 1);
                currentObj.resultado[m] = { pct: Math.round(pctVal * 10) / 10 };
              }
              objectives.push(currentObj);
              currentObj = null;
              continue;
            }

            if (currentObj) {
              // It's a KR or KPI row
              const kr: KRRow = {
                name: firstCell,
                months: [],
              };
              for (let m = 0; m < 12; m++) {
                const startCol = 1 + m * 9;
                const objCol = startCol + 6;
                const resCol = startCol + 7;
                const pctCol = startCol + 8;
                const objetivo = safeNum(row[objCol]);
                const resultado = safeNum(row[resCol]);
                let pct = safeNum(row[pctCol]);
                // If pct is between 0 and 1, treat as decimal percentage
                if (pct > 0 && pct <= 1) pct = pct * 100;
                kr.months.push({
                  objetivo,
                  resultado,
                  pct: Math.round(pct * 10) / 10,
                });
              }
              currentObj.krs.push(kr);
            }
          }
          // Push last objective if still open
          if (currentObj) {
            objectives.push(currentObj);
          }
        }

        // ── Parse "Resumen Ejecutivo ARG" (or sheet with "Resumen") ──
        const resumenSheetName = wb.SheetNames.find(n => n.toLowerCase().includes("resumen")) || wb.SheetNames[1];
        const wsResumen = resumenSheetName ? wb.Sheets[resumenSheetName] : null;

        const dashboard_kpis: DashboardKPI[] = [];
        const scorecard: ScorecardRow[] = [];
        const top_performers: PerformerRow[] = [];
        const alerts: AlertRow[] = [];

        if (wsResumen) {
          const rows = XLSX.utils.sheet_to_json(wsResumen, { header: 1 }) as any[][];

          // Dashboard KPIs: rows 5+ (index 4+) until empty or until scorecard header
          for (let i = 4; i < Math.min(rows.length, 20); i++) {
            const row = rows[i];
            if (!row || !row.length) continue;
            const name = safeStr(row[0]);
            if (!name || name.toUpperCase().includes("SCORECARD") || name.toUpperCase().includes("OBJETIVO")) break;
            dashboard_kpis.push({
              name,
              ytd_real: safeStr(row[1]),
              meta_ytd: safeStr(row[2]),
              pct_ytd: safeStr(row[3]),
              meta_anual: safeStr(row[4]),
              pct_anual: safeStr(row[5]),
              meses: safeStr(row[6]),
            });
          }

          // Scorecard: rows 11+ (index 10+) until empty
          for (let i = 11; i < Math.min(rows.length, 30); i++) {
            const row = rows[i];
            if (!row || !row.length) continue;
            const obj = safeStr(row[0]);
            if (!obj) continue;
            if (obj.toUpperCase().includes("TOP 3") || obj.toUpperCase().includes("MEJOR")) break;
            scorecard.push({
              objetivo: obj,
              ene: safeStr(row[1]), feb: safeStr(row[2]), mar: safeStr(row[3]),
              abr: safeStr(row[4]), may: safeStr(row[5]), jun: safeStr(row[6]),
              jul: safeStr(row[7]), ago: safeStr(row[8]), sep: safeStr(row[9]),
              oct: safeStr(row[10]), nov: safeStr(row[11]), dic: safeStr(row[12]),
            });
          }

          // Top 3 performers: rows 22+ (index 21+)
          for (let i = 22; i < Math.min(rows.length, 28); i++) {
            const row = rows[i];
            if (!row || !row.length) continue;
            const kr = safeStr(row[0]);
            if (!kr) continue;
            if (kr.toUpperCase().includes("ALERTA") || kr.toUpperCase().includes("CRITICAL")) break;
            top_performers.push({
              kr,
              ene: safeStr(row[1]), feb: safeStr(row[2]), mar: safeStr(row[3]),
              prom_q1: safeStr(row[4]),
              lectura: safeStr(row[5]),
            });
          }

          // Alerts: rows 28+ (index 27+)
          for (let i = 28; i < Math.min(rows.length, 35); i++) {
            const row = rows[i];
            if (!row || !row.length) continue;
            const kr = safeStr(row[0]);
            if (!kr) continue;
            alerts.push({
              kr,
              ene: safeStr(row[1]), feb: safeStr(row[2]), mar: safeStr(row[3]),
              prom_q1: safeStr(row[4]),
              accion: safeStr(row[5]),
            });
          }
        }

        const parsedData: KpisOkrData = {
          dashboard_kpis,
          scorecard,
          top_performers,
          alerts,
          objectives,
        };

        await saveData(parsedData);
        showBanner("success", `Excel procesado: ${objectives.length} objetivos, ${dashboard_kpis.length} KPIs`);
      } catch (err: any) {
        console.error("Upload error:", err);
        showBanner("error", `Error procesando Excel: ${err?.message || err}`);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }, [saveData, showBanner]);

  /* ───── editable cell (for OKRs Detalle) ───── */
  const EditableCell = ({ value, onSave, type = "number" }: {
    value: number | string; onSave: (v: number) => void; type?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(String(value));

    useEffect(() => { setVal(String(value)); }, [value]);

    if (!editing) {
      return (
        <span
          className="cursor-pointer hover:bg-orange-500/10 px-1 py-0.5 rounded min-w-[50px] inline-block text-center"
          onClick={() => setEditing(true)}
          title="Click para editar"
        >
          {value || <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>--</span>}
        </span>
      );
    }

    return (
      <input
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const numVal = parseFloat(val) || 0;
          if (numVal !== value) onSave(numVal);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            const numVal = parseFloat(val) || 0;
            if (numVal !== value) onSave(numVal);
          }
        }}
        autoFocus
        className="text-xs px-1 py-0.5 rounded border border-orange-500/40 outline-none w-full text-center"
        style={{ color: "var(--text-primary)", background: "var(--bg-input)", minWidth: "50px", maxWidth: "80px" }}
      />
    );
  };

  /* ───── toggle objective expand ───── */
  const toggleObj = (idx: number) => {
    setExpandedObj(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  /* ───────── render ───────── */

  if (loading) {
    return (
      <div className="glass-card p-8 text-center border border-orange-500/20">
        <div className="animate-pulse" style={{ color: "var(--text-muted)" }}>Cargando KPIs & OKRs...</div>
      </div>
    );
  }

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "resumen", label: "Resumen Ejecutivo" },
    { key: "detalle", label: "OKRs Detalle" },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      {banner && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          banner.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {banner.msg}
        </div>
      )}

      {/* Upload + Sub-tabs header */}
      <div className="glass-card p-4 border border-orange-500/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>KPIs & OKRs</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Planeacion 2026 - Objetivos y Resultados Clave</p>
          </div>
          <label className={`text-xs px-4 py-2 rounded-full border cursor-pointer transition-all ${
            uploading
              ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
              : "bg-transparent border-gray-700 hover:border-orange-500/40 hover:text-orange-300" + " " + "text-gray-700 dark:text-gray-300"
          }`}>
            {uploading ? "Procesando..." : "Subir Excel (.xlsx)"}
            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-1 border-b" style={{ borderColor: "var(--bg-card-border)" }}>
          {subTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-all ${
                subTab === t.key
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent hover:text-orange-400 text-gray-600 dark:text-gray-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── FILTERS ─── */}
      <div className="glass-card p-3 border border-orange-500/20">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Mes</label>
            <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-orange-500/20 focus:outline-none min-w-[120px]" style={{ color: "var(--text-primary)", background: "var(--bg-input)" }}>
              <option value="">Todos los meses</option>
              {MONTH_LABELS.map((l, i) => <option key={i} value={MONTH_KEYS[i]}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Objetivo</label>
            <select value={filterObjetivo} onChange={(e) => setFilterObjetivo(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-orange-500/20 focus:outline-none min-w-[200px]" style={{ color: "var(--text-primary)", background: "var(--bg-input)" }}>
              <option value="">Todos los objetivos</option>
              {(data?.objectives || []).map((o, i) => <option key={i} value={String(i)}>{o.name.substring(0, 50)}</option>)}
            </select>
          </div>
          {(filterMes || filterObjetivo) && (
            <button onClick={() => { setFilterMes(""); setFilterObjetivo(""); }} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">Limpiar</button>
          )}
        </div>
      </div>

      {/* ─── AUTO KPIs from Dashboard ─── */}
      {autoKpis && (
        <div className="glass-card p-4 border border-blue-500/20">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Datos Operacionales (automático del Dashboard)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl border border-blue-500/15" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Órdenes Q1</p>
              <p className="text-lg font-bold text-blue-400">{autoKpis.ordenes_ytd.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl border border-green-500/15" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Entregados Q1</p>
              <p className="text-lg font-bold text-green-400">{autoKpis.entregados_ytd.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{autoKpis.pct_entrega}% entrega</p>
            </div>
            <div className="p-3 rounded-xl border border-red-500/15" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Devoluciones Q1</p>
              <p className="text-lg font-bold text-red-400">{autoKpis.devoluciones_ytd.toLocaleString()}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{autoKpis.pct_dev}% devolucion</p>
            </div>
            <div className="p-3 rounded-xl border border-orange-500/15" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Proveedores</p>
              <p className="text-lg font-bold text-orange-400">{autoKpis.proveedores}</p>
            </div>
            <div className="p-3 rounded-xl border border-purple-500/15" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Sellers</p>
              <p className="text-lg font-bold text-purple-400">{autoKpis.sellers.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl border border-cyan-500/15" style={{ background: "var(--bg-card)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Dropshippers</p>
              <p className="text-lg font-bold text-cyan-400">{autoKpis.dropshippers.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {!data ? (
        <div className="glass-card p-8 text-center border border-orange-500/20">
          <span className="text-4xl mb-4 block">🎯</span>
          <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Sin datos de KPIs & OKRs</h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Subi el Excel de Planeacion 2026 / OKRs para cargar los datos.</p>
        </div>
      ) : (
        <>
          {/* ─── RESUMEN EJECUTIVO ─── */}
          {subTab === "resumen" && (
            <div className="space-y-6">
              {/* Dashboard Principal KPIs */}
              {data.dashboard_kpis.length > 0 && (
                <div className="glass-card p-4 border border-orange-500/20">
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Dashboard Principal KPIs</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                          <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>KPI</th>
                          <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>YTD Real</th>
                          <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Meta YTD</th>
                          <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>% Cumpl.</th>
                          <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Meta Anual</th>
                          <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>% Avance</th>
                          <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Meses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.dashboard_kpis.map((kpi, i) => {
                          const pctYtd = safeNum(kpi.pct_ytd);
                          const pctAnual = safeNum(kpi.pct_anual);
                          return (
                            <tr key={i} className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                              <td className="py-2 px-2 font-medium" style={{ color: "var(--text-primary)" }}>{kpi.name}</td>
                              <td className="py-2 px-2 text-right" style={{ color: "var(--text-secondary)" }}>{kpi.ytd_real}</td>
                              <td className="py-2 px-2 text-right" style={{ color: "var(--text-secondary)" }}>{kpi.meta_ytd}</td>
                              <td className={`py-2 px-2 text-right font-medium ${pctColor(pctYtd)}`}>
                                {kpi.pct_ytd}{kpi.pct_ytd && !kpi.pct_ytd.includes("%") ? "%" : ""}
                              </td>
                              <td className="py-2 px-2 text-right" style={{ color: "var(--text-secondary)" }}>{kpi.meta_anual}</td>
                              <td className={`py-2 px-2 text-right font-medium ${pctColor(pctAnual)}`}>
                                {kpi.pct_anual}{kpi.pct_anual && !kpi.pct_anual.includes("%") ? "%" : ""}
                              </td>
                              <td className="py-2 px-2 text-right" style={{ color: "var(--text-muted)" }}>{kpi.meses}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Scorecard by Objective */}
              {data.scorecard.length > 0 && (
                <div className="glass-card p-4 border border-orange-500/20">
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Scorecard por Objetivo (Mensual)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                          <th className="text-left py-2 px-2 font-medium min-w-[200px]" style={{ color: "var(--text-muted)" }}>Objetivo</th>
                          {filteredMonthIndices.map(mi => (
                            <th key={mi} className="text-center py-2 px-1 font-medium w-[50px]" style={{ color: "var(--text-muted)" }}>{MONTH_LABELS[mi]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.scorecard.map((row, i) => (
                          <tr key={i} className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                            <td className="py-2 px-2 font-medium text-[11px]" style={{ color: "var(--text-primary)" }}>{row.objetivo}</td>
                            {filteredMonthIndices.map(mi => {
                              const mk = MONTH_KEYS[mi];
                              const val = safeNum(row[mk]);
                              const displayVal = val > 0 && val <= 1 ? Math.round(val * 100) : Math.round(val);
                              return (
                                <td key={mk} className="py-1 px-1 text-center">
                                  {displayVal > 0 ? (
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${pctBg(displayVal)}`}>
                                      {displayVal}%
                                    </span>
                                  ) : (
                                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top 3 Best + Top 3 Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 3 Best Performers */}
                {data.top_performers.length > 0 && (
                  <div className="glass-card p-4 border border-green-500/20">
                    <h3 className="text-sm font-bold text-green-400 mb-3">Top 3 Mejores Resultados</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                            <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>KR</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Ene</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Feb</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Mar</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Prom Q1</th>
                            <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Lectura</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.top_performers.map((p, i) => (
                            <tr key={i} className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                              <td className="py-2 px-2 text-[11px]" style={{ color: "var(--text-primary)" }}>{p.kr}</td>
                              <td className="py-2 px-1 text-center text-green-400">{p.ene}</td>
                              <td className="py-2 px-1 text-center text-green-400">{p.feb}</td>
                              <td className="py-2 px-1 text-center text-green-400">{p.mar}</td>
                              <td className="py-2 px-1 text-center font-medium text-green-400">{p.prom_q1}</td>
                              <td className="py-2 px-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>{p.lectura}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Top 3 Critical Alerts */}
                {data.alerts.length > 0 && (
                  <div className="glass-card p-4 border border-red-500/20">
                    <h3 className="text-sm font-bold text-red-400 mb-3">Top 3 Alertas Criticas</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                            <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>KR</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Ene</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Feb</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Mar</th>
                            <th className="text-center py-2 px-1 font-medium" style={{ color: "var(--text-muted)" }}>Prom Q1</th>
                            <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.alerts.map((a, i) => (
                            <tr key={i} className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                              <td className="py-2 px-2 text-[11px]" style={{ color: "var(--text-primary)" }}>{a.kr}</td>
                              <td className="py-2 px-1 text-center text-red-400">{a.ene}</td>
                              <td className="py-2 px-1 text-center text-red-400">{a.feb}</td>
                              <td className="py-2 px-1 text-center text-red-400">{a.mar}</td>
                              <td className="py-2 px-1 text-center font-medium text-red-400">{a.prom_q1}</td>
                              <td className="py-2 px-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>{a.accion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── OKRs DETALLE ─── */}
          {subTab === "detalle" && (
            <div className="space-y-4">
              {data.objectives.length === 0 && (
                <div className="glass-card p-6 text-center border border-orange-500/20">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No hay objetivos cargados. Subi el Excel para cargar los OKRs.</p>
                </div>
              )}

              {filteredObjectives.map((obj, _fi) => {
                const objIdx = data.objectives.indexOf(obj);
                const isExpanded = expandedObj[objIdx] ?? false;
                // Calculate average resultado
                const avgPct = obj.resultado.filter(r => r.pct > 0);
                const avgVal = avgPct.length > 0 ? avgPct.reduce((s, r) => s + r.pct, 0) / avgPct.length : 0;

                return (
                  <div key={objIdx} className="glass-card border border-orange-500/20 overflow-hidden">
                    {/* Objective Header (collapsible) */}
                    <button
                      onClick={() => toggleObj(objIdx)}
                      className="w-full flex items-center justify-between p-4 hover:bg-orange-500/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-lg">{isExpanded ? "▾" : "▸"}</span>
                        <div>
                          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{obj.name}</h3>
                          {obj.description && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{obj.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${pctBg(avgVal)}`}>
                          {avgVal > 0 ? `${Math.round(avgVal)}%` : "Sin datos"}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{obj.krs.length} KRs</span>
                      </div>
                    </button>
                    {/* Monthly mini-scorecard on objective row */}
                    <div className="px-4 pb-2 flex flex-wrap gap-1 border-t" style={{ borderColor: "var(--bg-card-border)" }}>
                      {filteredMonthIndices.map(mi => {
                        const r = obj.resultado[mi];
                        const pct = r?.pct || 0;
                        return (
                          <div key={mi} className="flex flex-col items-center min-w-[38px]">
                            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{MONTH_LABELS[mi]}</span>
                            {pct > 0 ? (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pctBg(pct)}`}>{Math.round(pct)}%</span>
                            ) : (
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>-</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t px-4 pb-4" style={{ borderColor: "var(--bg-card-border)" }}>
                        <div className="overflow-x-auto mt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                                <th className="text-left py-2 px-2 font-bold min-w-[200px] sticky left-0" style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>KR</th>
                                {filteredMonthIndices.map(mi => (
                                  <th key={mi} colSpan={3} className="text-center py-2 px-1 font-bold border-l" style={{ borderColor: "var(--bg-card-border)", color: "var(--text-primary)" }}>
                                    {MONTH_LABELS[mi]}
                                  </th>
                                ))}
                              </tr>
                              <tr className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                                <th className="sticky left-0" style={{ background: "var(--bg-card)" }}></th>
                                {filteredMonthIndices.map(mi => (
                                  <React.Fragment key={mi}>
                                    <th className="text-center py-1 px-1 text-[10px] font-medium border-l" style={{ borderColor: "var(--bg-card-border)", color: "var(--text-primary)" }}>Obj</th>
                                    <th className="text-center py-1 px-1 text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>Res</th>
                                    <th className="text-center py-1 px-1 text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>%</th>
                                  </React.Fragment>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {obj.krs.map((kr, krIdx) => (
                                <tr key={krIdx} className="border-b" style={{ borderColor: "var(--bg-card-border)" }}>
                                  <td className="py-2 px-2 text-[11px] font-medium sticky left-0" style={{ color: "var(--text-primary)", background: "var(--bg-card)" }}>
                                    {kr.name}
                                  </td>
                                  {filteredMonthIndices.map(mIdx => {
                                    const md = kr.months[mIdx] || { objetivo: 0, resultado: 0, pct: 0 };
                                    const computedPct = md.objetivo > 0 ? Math.round((md.resultado / md.objetivo) * 100 * 10) / 10 : 0;
                                    return (
                                      <React.Fragment key={mIdx}>
                                        <td className="py-1 px-1 text-center border-l" style={{ borderColor: "var(--bg-card-border)" }}>
                                          <EditableCell
                                            value={md.objetivo}
                                            onSave={(v) => updateField(["objectives", objIdx, "krs", krIdx, "months", mIdx, "objetivo"], v)}
                                          />
                                        </td>
                                        <td className="py-1 px-1 text-center">
                                          <EditableCell
                                            value={md.resultado}
                                            onSave={(v) => {
                                              // Also auto-compute pct
                                              const newPct = md.objetivo > 0 ? Math.round((v / md.objetivo) * 100 * 10) / 10 : 0;
                                              const newData = JSON.parse(JSON.stringify(data));
                                              newData.objectives[objIdx].krs[krIdx].months[mIdx].resultado = v;
                                              newData.objectives[objIdx].krs[krIdx].months[mIdx].pct = newPct;
                                              saveData(newData);
                                            }}
                                          />
                                        </td>
                                        <td className={`py-1 px-1 text-center text-[10px] font-medium ${pctColor(computedPct)}`}>
                                          {computedPct > 0 ? `${computedPct}%` : <span style={{ color: "var(--text-muted)" }}>-</span>}
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              ))}
                              {/* RESULTADO OBJETIVO row */}
                              <tr className="border-t-2" style={{ borderColor: "var(--border-orange, rgba(249,115,22,0.3))" }}>
                                <td className="py-2 px-2 text-[11px] font-bold sticky left-0" style={{ color: "var(--text-primary)", background: "var(--bg-card)" }}>
                                  RESULTADO OBJETIVO
                                </td>
                                {filteredMonthIndices.map(mIdx => {
                                  const r = obj.resultado[mIdx] || { pct: 0 };
                                  return (
                                  <td key={mIdx} colSpan={3} className="py-1 px-1 text-center border-l" style={{ borderColor: "var(--bg-card-border)" }}>
                                    {r.pct > 0 ? (
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${pctBg(r.pct)}`}>
                                        {r.pct}%
                                      </span>
                                    ) : (
                                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>-</span>
                                    )}
                                  </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

