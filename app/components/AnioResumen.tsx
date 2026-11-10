"use client";

// ═══════════════════════════════════════════════════════════════════
// AÑO 2026 — todo lo que va del año, operación + comercial (/api/data/anio).
// Se completa solo: cada mes nuevo con datos de Operaciones / Comercial aparece.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Pais = "ar" | "py";
interface Mes {
  mes: string; num: number; dias_mes: number; dias_con_datos: number; en_curso: boolean; fuente: "resumen" | "operaciones";
  ingresadas: number; movilizadas: number; entregadas: number; devueltas: number; en_proceso: number; canceladas: number | null;
  meta_mov: number | null; meta_ing: number | null; cierre_mov: number | null;
}
interface Dia { mes: string; dia: number; fecha: string; ingresadas: number; movilizadas: number; entregadas: number; devueltas: number; en_proceso: number }
interface Acc { mov: number; ent: number; dev: number; proc: number; guias: number }
interface Ciudad extends Acc { ciudad: string; departamento: string; por_transp: Record<string, Acc>; por_mes: Record<string, Acc> }
interface Depto extends Acc { departamento: string; por_transp: Record<string, Acc> }
interface Ent { nombre: string; total: number; entregado: number; devolucion: number; cancelado: number; despachado: number; por_mes: Record<string, number>; proveedor?: string; meses: number }
interface Data {
  mesActual: string; meses: Mes[]; diario: Dia[];
  transp: Record<string, Record<string, { guias: number; mov: number; ent: number; dev: number; proc: number; canc: number }>>;
  ciudades: Ciudad[]; departamentos: Depto[];
  comercial: {
    meses: { mes: string; ordenes: number; usuarios: number; proveedores: number; productos: number; estados: Record<string, number> }[];
    usuarios: Ent[]; usuariosTotal: number; proveedores: Ent[]; proveedoresTotal: number; productos: Ent[]; productosTotal: number;
  };
  avisos: string[];
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const CORTO = (m: string) => m.charAt(0).toUpperCase() + m.slice(1, 3);
const LARGO = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
const COLORES = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#eab308", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#9ca3af", "#f59e0b", "#14b8a6"];
const fmt = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("es-AR"));
const pctN = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const pct = (a: number, b: number) => { const v = pctN(a, b); return v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`; };
const pctV = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(1).replace(".", ",")}%`);
const tip = { contentStyle: { background: "#1a1a1a", border: "1px solid #f97316", fontSize: 12 }, itemStyle: { color: "#fff" }, labelStyle: { color: "#fff" } };
const trimestre = (m: string) => `Q${Math.floor(MESES.indexOf(m) / 3) + 1}`;

function Kpi({ label, value, sub, color = "#f97316" }: { label: string; value: string; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl p-3 border" style={{ background: "var(--bg-card)", borderColor: `${color}40`, borderTop: `3px solid ${color}` }}>
      <p className="text-[10px] t-muted uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold font-mono mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-1 t-muted">{sub}</p>}
    </div>
  );
}
function Th({ children, left, onClick, activo }: { children: React.ReactNode; left?: boolean; onClick?: () => void; activo?: boolean }) {
  return <th onClick={onClick} className={`py-2 px-2 text-[10px] uppercase tracking-wider whitespace-nowrap ${left ? "text-left" : "text-right"} ${onClick ? "cursor-pointer hover:text-orange-400" : ""} ${activo ? "text-orange-400" : "t-muted"}`}>{children}{activo ? " ▾" : ""}</th>;
}
function Td({ children, left, bold, color }: { children: React.ReactNode; left?: boolean; bold?: boolean; color?: string }) {
  return <td className={`py-1.5 px-2 text-xs whitespace-nowrap ${left ? "text-left" : "text-right font-mono"} ${bold ? "font-bold" : ""}`} style={{ color }}>{children}</td>;
}
function Card({ titulo, sub, children, acciones }: { titulo: string; sub?: string; children: React.ReactNode; acciones?: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold t-primary">{titulo}</h3>
          {sub && <p className="text-[11px] t-muted mt-0.5">{sub}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </div>
  );
}
function Chips<T extends string>({ opciones, valor, onChange }: { opciones: { k: T; l: string }[]; valor: T; onChange: (k: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => (
        <button key={o.k} onClick={() => onChange(o.k)} className={`text-[11px] px-3 py-1 rounded-full border transition-all ${valor === o.k ? "bg-orange-500 text-white border-orange-500" : "border-gray-700 t-secondary hover:border-orange-500/50"}`}>{o.l}</button>
      ))}
    </div>
  );
}
// Mini barras por mes (tendencia) para las tablas
function MiniBarras({ valores }: { valores: number[] }) {
  const max = Math.max(...valores, 1);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {valores.map((v, i) => <div key={i} className="w-[5px] rounded-sm" style={{ height: `${Math.max((v / max) * 100, v > 0 ? 8 : 2)}%`, background: v > 0 ? "#f97316" : "rgba(148,163,184,0.25)" }} />)}
    </div>
  );
}
const colorTasa = (v: number | null, bueno: number, malo: number, invertido = false) => {
  if (v === null) return undefined;
  const ok = invertido ? v <= bueno : v >= bueno;
  const mal = invertido ? v >= malo : v <= malo;
  return ok ? "#10b981" : mal ? "#ef4444" : "#eab308";
};

export default function AnioResumen({ country }: { country: Pais }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"vista" | "curvas" | "logistica" | "ciudades" | "comercial" | "tabla">("vista");
  const pais = country === "ar" ? "Argentina" : "Paraguay";

  useEffect(() => {
    let vivo = true;
    setData(null); setErr(null);
    (async () => {
      for (let i = 1; i <= 3; i++) {
        try {
          const r = await fetch(`/api/data/anio?country=${country}`, { cache: "no-store" });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
          if (vivo) setData(j);
          return;
        } catch (e) {
          if (i === 3 && vivo) setErr(e instanceof Error ? e.message : "Error al cargar");
          await new Promise((res) => setTimeout(res, 2000 * i));
        }
      }
    })();
    return () => { vivo = false; };
  }, [country]);

  if (err) return <div className="glass-card p-6 text-sm text-red-400">No se pudo cargar el resumen del año: {err}</div>;
  if (!data) return <div className="glass-card p-6 t-muted text-sm animate-pulse">Armando el año 2026 de {pais}… (operación + comercial, mes por mes)</div>;
  return <Contenido data={data} country={country} tab={tab} setTab={setTab} pais={pais} />;
}

function Contenido({ data, country, tab, setTab, pais }: { data: Data; country: Pais; tab: string; setTab: (t: "vista" | "curvas" | "logistica" | "ciudades" | "comercial" | "tabla") => void; pais: string }) {
  const meses = data.meses;
  const cerrados = meses.filter((m) => !m.en_curso);
  const enCurso = meses.find((m) => m.en_curso) ?? null;
  const sum = (arr: Mes[], k: keyof Mes) => arr.reduce((a, m) => a + Number(m[k] || 0), 0);
  const tot = { ing: sum(meses, "ingresadas"), mov: sum(meses, "movilizadas"), ent: sum(meses, "entregadas"), dev: sum(meses, "devueltas"), proc: sum(meses, "en_proceso") };
  const conMeta = cerrados.filter((m) => m.meta_mov);
  const movOficial = (m: Mes) => m.cierre_mov ?? m.movilizadas;
  const cumplimiento = conMeta.length ? pctN(conMeta.reduce((a, m) => a + movOficial(m), 0), conMeta.reduce((a, m) => a + (m.meta_mov ?? 0), 0)) : null;
  const mejor = [...cerrados].sort((a, b) => movOficial(b) - movOficial(a))[0];
  const diasTot = meses.reduce((a, m) => a + (m.en_curso ? m.dias_con_datos : m.dias_mes), 0);

  // Trimestres
  const trims = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
    const ms = meses.filter((m) => trimestre(m.mes) === q);
    return { q, meses: ms, ing: sum(ms, "ingresadas"), mov: ms.reduce((a, m) => a + movOficial(m), 0), ent: sum(ms, "entregadas"), dev: sum(ms, "devueltas"), meta: ms.reduce((a, m) => a + (m.meta_mov ?? 0), 0), movMeta: ms.filter((m) => m.meta_mov).reduce((a, m) => a + movOficial(m), 0), enCurso: ms.some((m) => m.en_curso) };
  }).filter((t) => t.meses.length);

  const serieMensual = meses.map((m) => ({
    mes: CORTO(m.mes) + (m.en_curso ? "*" : ""), Ingresadas: m.ingresadas, Movilizadas: movOficial(m), Meta: m.meta_mov ?? undefined,
    "Entrega %": pctN(m.entregadas, m.movilizadas), "Efectividad %": pctN(m.entregadas, m.entregadas + m.devueltas),
  }));

  // Lectura automática del año
  const lectura: string[] = [];
  if (trims.length >= 2) {
    const ultCerr = trims.filter((t) => !t.enCurso);
    if (ultCerr.length >= 2) {
      const [a, b] = ultCerr.slice(-2);
      const v = pctN(b.mov - a.mov, a.mov);
      lectura.push(`${b.q} cerró con ${fmt(b.mov)} movilizadas, ${v !== null && v >= 0 ? "+" : ""}${pctV(v)} contra ${a.q} (${fmt(a.mov)}).`);
    }
  }
  if (mejor) lectura.push(`Mejor mes del año: ${LARGO(mejor.mes)} con ${fmt(movOficial(mejor))} movilizadas${mejor.meta_mov ? ` (${pct(movOficial(mejor), mejor.meta_mov)} de la meta)` : ""}.`);
  if (cumplimiento !== null) lectura.push(`Cumplimiento acumulado de metas de movilizadas (meses cerrados con meta): ${pctV(cumplimiento)}.`);
  const efect = cerrados.filter((m) => m.fuente === "operaciones").map((m) => ({ m: m.mes, v: pctN(m.entregadas, m.entregadas + m.devueltas) }));
  if (efect.length >= 2) {
    const a = efect[0], b = efect[efect.length - 1];
    if (a.v !== null && b.v !== null) lectura.push(`Efectividad de entrega (entregadas ÷ entregadas + devueltas): ${pctV(a.v)} en ${LARGO(a.m)} → ${pctV(b.v)} en ${LARGO(b.m)} (${b.v >= a.v ? "mejora" : "baja"} de ${Math.abs(b.v - a.v).toFixed(1).replace(".", ",")} pts).`);
  }
  const transpAnio = Object.entries(data.transp).map(([t, pm]) => {
    const v = Object.values(pm).reduce((a, x) => ({ mov: a.mov + x.mov, ent: a.ent + x.ent, dev: a.dev + x.dev }), { mov: 0, ent: 0, dev: 0 });
    return { t, ...v, efect: pctN(v.ent, v.ent + v.dev) };
  }).filter((x) => x.mov > 200).sort((a, b) => (b.efect ?? 0) - (a.efect ?? 0));
  if (transpAnio.length >= 2) lectura.push(`Logística con mejor efectividad: ${transpAnio[0].t} (${pctV(transpAnio[0].efect)}); la más baja: ${transpAnio[transpAnio.length - 1].t} (${pctV(transpAnio[transpAnio.length - 1].efect)}).`);
  if (enCurso) lectura.push(`${LARGO(enCurso.mes)} en curso: ${fmt(enCurso.movilizadas)} movilizadas en ${enCurso.dias_con_datos} días${enCurso.meta_mov ? `; ritmo proyectado ${fmt((enCurso.movilizadas / Math.max(enCurso.dias_con_datos, 1)) * enCurso.dias_mes)} vs meta ${fmt(enCurso.meta_mov)}` : ""}.`);

  const TABS = [
    { k: "vista" as const, l: "📊 Vista del año" }, { k: "curvas" as const, l: "📈 Curvas" }, { k: "logistica" as const, l: "🚚 Logística" },
    { k: "ciudades" as const, l: "🏙️ Ciudades" }, { k: "comercial" as const, l: "💼 Comercial" }, { k: "tabla" as const, l: "📋 Tabla mensual" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5 border-2 border-orange-500/40" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.10), rgba(59,130,246,0.06))" }}>
        <h2 className="text-lg font-bold t-primary">📅 Año 2026 — {pais}</h2>
        <p className="text-xs t-muted mt-1">
          {LARGO(meses[0]?.mes ?? "enero")} a {LARGO(meses[meses.length - 1]?.mes ?? "")}{enCurso ? ` (${LARGO(enCurso.mes)} en curso, ${enCurso.dias_con_datos} días)` : ""}.
          Ene–Mar: totales mensuales; desde Abril: Operaciones (regla de movilizadas, por fecha de orden) + Seguimiento Diario + archivo Comercial. Se completa solo con cada carga.
        </p>
        {data.avisos.length > 0 && <p className="text-[11px] mt-1" style={{ color: "#eab308" }}>⚠️ {data.avisos.join(" · ")}</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`text-xs px-4 py-2 rounded-full border transition-all ${tab === t.k ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20" : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"}`}>{t.l}</button>
          ))}
        </div>
      </div>

      {tab === "vista" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            <Kpi label="Ingresadas" value={fmt(tot.ing)} sub={`${fmt(tot.ing / Math.max(diasTot, 1))} por día`} color="#3b82f6" />
            <Kpi label="Movilizadas" value={fmt(meses.reduce((a, m) => a + movOficial(m), 0))} sub={`${pct(tot.mov, tot.ing)} de las ingresadas`} />
            <Kpi label="Entregadas" value={fmt(tot.ent)} sub={`${pct(tot.ent, tot.mov)} de movilizadas`} color="#10b981" />
            <Kpi label="Devueltas" value={fmt(tot.dev)} sub={`${pct(tot.dev, tot.mov)} de movilizadas`} color="#ef4444" />
            <Kpi label="Efectividad" value={pct(tot.ent, tot.ent + tot.dev)} sub="entregadas ÷ (entregadas + devueltas)" color="#10b981" />
            <Kpi label="En proceso" value={fmt(tot.proc)} sub="todavía en tránsito" color="#eab308" />
            <Kpi label="Cumplimiento metas" value={pctV(cumplimiento)} sub={`${conMeta.length} meses cerrados con meta`} color={cumplimiento !== null && cumplimiento >= 100 ? "#10b981" : "#eab308"} />
            <Kpi label="Mejor mes" value={mejor ? LARGO(mejor.mes) : "—"} sub={mejor ? `${fmt(movOficial(mejor))} movilizadas` : undefined} color="#a855f7" />
          </div>

          <Card titulo="Ingresadas, movilizadas y meta por mes" sub="Barras: volumen. Líneas: meta de movilizadas y tasas (eje derecho). * mes en curso. Los meses recientes tienen guías todavía en proceso, por eso su tasa de entrega es más baja; la efectividad compara solo lo ya resuelto.">
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={serieMensual}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="mes" fontSize={11} stroke="#888" />
                <YAxis yAxisId="v" fontSize={10} stroke="#888" tickFormatter={(v) => fmt(Number(v))} width={60} />
                <YAxis yAxisId="p" orientation="right" fontSize={10} stroke="#888" domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} />
                <Tooltip {...tip} formatter={(v, name) => (String(name).includes("%") ? pctV(Number(v)) : fmt(Number(v)))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="v" dataKey="Ingresadas" fill="#3b82f6" opacity={0.55} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="v" dataKey="Movilizadas" fill="#f97316" radius={[3, 3, 0, 0]} />
                <Line yAxisId="v" dataKey="Meta" stroke="#eab308" strokeDasharray="6 4" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line yAxisId="p" dataKey="Entrega %" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="p" dataKey="Efectividad %" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {trims.map((t, i) => {
              const prev = trims[i - 1];
              const v = prev ? pctN(t.mov - prev.mov, prev.mov) : null;
              return (
                <div key={t.q} className="glass-card p-4" style={{ borderTop: `3px solid ${COLORES[i]}` }}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-bold t-primary">{t.q}{t.enCurso ? " (en curso)" : ""}</h3>
                    <span className="text-[11px] t-muted">{t.meses.map((m) => CORTO(m.mes)).join(" · ")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div><p className="t-muted text-[10px]">Movilizadas</p><p className="font-mono font-bold t-primary">{fmt(t.mov)}</p>{v !== null && !t.enCurso && <p className="text-[10px]" style={{ color: v >= 0 ? "#10b981" : "#ef4444" }}>{v >= 0 ? "▲" : "▼"} {pctV(Math.abs(v))} vs {prev!.q}</p>}</div>
                    <div><p className="t-muted text-[10px]">Ingresadas</p><p className="font-mono font-bold" style={{ color: "#3b82f6" }}>{fmt(t.ing)}</p></div>
                    <div><p className="t-muted text-[10px]">Efectividad</p><p className="font-mono font-bold" style={{ color: "#10b981" }}>{pct(t.ent, t.ent + t.dev)}</p></div>
                    <div><p className="t-muted text-[10px]">Meta</p><p className="font-mono font-bold" style={{ color: "#eab308" }}>{t.meta ? pct(t.movMeta, t.meta) : "—"}</p></div>
                  </div>
                </div>
              );
            })}
          </div>

          <Card titulo="🧭 Lectura del año">
            <ul className="space-y-1.5">{lectura.map((l, i) => <li key={i} className="text-xs t-primary">• {l}</li>)}</ul>
          </Card>
        </div>
      )}

      {tab === "curvas" && <Curvas data={data} />}
      {tab === "logistica" && <Logistica data={data} />}
      {tab === "ciudades" && <Ciudades data={data} country={country} />}
      {tab === "comercial" && <Comercial data={data} />}
      {tab === "tabla" && <TablaMensual meses={meses} movOficial={movOficial} />}
    </div>
  );
}

// ─── Curvas ───
function Curvas({ data }: { data: Data }) {
  const [suavizar, setSuavizar] = useState<"dia" | "7d">("7d");
  const [metrica, setMetrica] = useState<"movilizadas" | "ingresadas" | "entregadas">("movilizadas");
  const diario = useMemo(() => {
    const d = data.diario.filter((x) => x.ingresadas > 0 || x.movilizadas > 0);
    return d.map((x, i) => {
      const ventana = d.slice(Math.max(0, i - 6), i + 1);
      const prom = (k: "ingresadas" | "movilizadas" | "entregadas") => ventana.reduce((a, y) => a + y[k], 0) / ventana.length;
      return {
        fecha: `${x.dia}/${MESES.indexOf(x.mes) + 1}`,
        Ingresadas: suavizar === "7d" ? Math.round(prom("ingresadas")) : x.ingresadas,
        Movilizadas: suavizar === "7d" ? Math.round(prom("movilizadas")) : x.movilizadas,
        Entregadas: suavizar === "7d" ? Math.round(prom("entregadas")) : x.entregadas,
      };
    });
  }, [data, suavizar]);
  // Acumulado por día del mes, una curva por mes
  const mesesOps = [...new Set(data.diario.map((d) => d.mes))];
  const acumulado = useMemo(() => Array.from({ length: 31 }, (_, i) => {
    const row: Record<string, number | string> = { dia: i + 1 };
    for (const m of mesesOps) {
      const dias = data.diario.filter((d) => d.mes === m && d.dia <= i + 1);
      const ultimo = data.diario.filter((d) => d.mes === m && (d.ingresadas > 0 || d.movilizadas > 0)).reduce((a, d) => Math.max(a, d.dia), 0);
      if (i + 1 <= ultimo) row[LARGO(m)] = dias.reduce((a, d) => a + d[metrica], 0);
    }
    return row;
  }), [data, metrica]); // eslint-disable-line react-hooks/exhaustive-deps
  const tasas = data.meses.filter((m) => m.fuente === "operaciones").map((m) => ({
    mes: CORTO(m.mes) + (m.en_curso ? "*" : ""), "Movilización %": pctN(m.movilizadas, m.ingresadas), "Entrega %": pctN(m.entregadas, m.movilizadas),
    "Devolución %": pctN(m.devueltas, m.movilizadas), "En proceso %": pctN(m.en_proceso, m.movilizadas),
  }));

  return (
    <div className="space-y-4">
      <Card titulo="Movimiento diario del año" sub="Por fecha de orden, desde Abril. El promedio de 7 días suaviza fines de semana y feriados."
        acciones={<Chips opciones={[{ k: "7d", l: "Promedio 7 días" }, { k: "dia", l: "Día a día" }]} valor={suavizar} onChange={setSuavizar} />}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={diario}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="fecha" fontSize={10} stroke="#888" interval={Math.max(Math.floor(diario.length / 18), 0)} />
            <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => fmt(Number(v))} width={55} />
            <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="Ingresadas" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line dataKey="Movilizadas" stroke="#f97316" strokeWidth={2} dot={false} />
            <Line dataKey="Entregadas" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card titulo="Cómo se fue armando cada mes" sub="Acumulado día por día: permite comparar el ritmo de cada mes en el mismo punto."
        acciones={<Chips opciones={[{ k: "movilizadas", l: "Movilizadas" }, { k: "ingresadas", l: "Ingresadas" }, { k: "entregadas", l: "Entregadas" }]} valor={metrica} onChange={setMetrica} />}>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={acumulado}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="dia" fontSize={10} stroke="#888" />
            <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => fmt(Number(v))} width={60} />
            <Tooltip {...tip} formatter={(v) => fmt(Number(v))} labelFormatter={(l) => `Día ${l}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {mesesOps.map((m, i) => <Line key={m} dataKey={LARGO(m)} stroke={COLORES[i % COLORES.length]} strokeWidth={i === mesesOps.length - 1 ? 3 : 1.5} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card titulo="Tasas por mes" sub="Movilización = movilizadas ÷ ingresadas. Entrega, devolución y en proceso sobre movilizadas (estado actual). * mes en curso.">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={tasas}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="mes" fontSize={11} stroke="#888" />
            <YAxis fontSize={10} stroke="#888" domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} />
            <Tooltip {...tip} formatter={(v) => pctV(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="Movilización %" stroke="#3b82f6" strokeWidth={2} />
            <Line dataKey="Entrega %" stroke="#10b981" strokeWidth={2} />
            <Line dataKey="Devolución %" stroke="#ef4444" strokeWidth={2} />
            <Line dataKey="En proceso %" stroke="#eab308" strokeWidth={2} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Logística ───
function Logistica({ data }: { data: Data }) {
  const transportadoras = Object.keys(data.transp).sort((a, b) => {
    const t = (k: string) => Object.values(data.transp[k]).reduce((x, v) => x + v.mov, 0);
    return t(b) - t(a);
  });
  const [sel, setSel] = useState<string[]>(transportadoras.slice(0, 5));
  const [tasa, setTasa] = useState<"efect" | "entrega" | "dev">("efect");
  const mesesOps = data.meses.filter((m) => m.fuente === "operaciones");
  const valor = (x: { mov: number; ent: number; dev: number } | undefined) => {
    if (!x) return null;
    return tasa === "efect" ? pctN(x.ent, x.ent + x.dev) : tasa === "entrega" ? pctN(x.ent, x.mov) : pctN(x.dev, x.mov);
  };
  const serie = mesesOps.map((m) => {
    const row: Record<string, number | string | null> = { mes: CORTO(m.mes) + (m.en_curso ? "*" : "") };
    for (const t of sel) row[t] = data.transp[t]?.[m.mes]?.mov ? valor(data.transp[t][m.mes]) : null;
    return row;
  });
  const volumen = mesesOps.map((m) => {
    const row: Record<string, number | string> = { mes: CORTO(m.mes) + (m.en_curso ? "*" : "") };
    for (const t of transportadoras) row[t] = data.transp[t]?.[m.mes]?.mov ?? 0;
    return row;
  });
  const totMov = transportadoras.reduce((a, t) => a + Object.values(data.transp[t]).reduce((x, v) => x + v.mov, 0), 0);
  const filas = transportadoras.map((t) => {
    const v = Object.values(data.transp[t]).reduce((a, x) => ({ mov: a.mov + x.mov, ent: a.ent + x.ent, dev: a.dev + x.dev, proc: a.proc + x.proc, canc: a.canc + x.canc }), { mov: 0, ent: 0, dev: 0, proc: 0, canc: 0 });
    return { t, ...v };
  });

  return (
    <div className="space-y-4">
      <Card titulo="Tasa por logística, mes a mes" sub="Elegí las transportadoras y la tasa. Efectividad = entregadas ÷ (entregadas + devueltas): compara meses cerrados y en curso de forma justa."
        acciones={<Chips opciones={[{ k: "efect", l: "Efectividad" }, { k: "entrega", l: "Entrega s/ movilizadas" }, { k: "dev", l: "Devolución" }]} valor={tasa} onChange={setTasa} />}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {transportadoras.map((t, i) => {
            const on = sel.includes(t);
            return <button key={t} onClick={() => setSel(on ? sel.filter((x) => x !== t) : [...sel, t])} className="text-[11px] px-3 py-1 rounded-full border" style={{ borderColor: COLORES[i % COLORES.length], background: on ? `${COLORES[i % COLORES.length]}30` : "transparent", color: on ? "#fff" : "#9ca3af" }}>{t}</button>;
          })}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="mes" fontSize={11} stroke="#888" />
            <YAxis fontSize={10} stroke="#888" domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} />
            <Tooltip {...tip} formatter={(v) => pctV(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {sel.map((t) => <Line key={t} dataKey={t} stroke={COLORES[transportadoras.indexOf(t) % COLORES.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card titulo="Movilizadas por logística" sub="Participación de cada transportadora en el volumen de cada mes.">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={volumen}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="mes" fontSize={11} stroke="#888" />
            <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => fmt(Number(v))} width={55} />
            <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {transportadoras.map((t, i) => <Bar key={t} dataKey={t} stackId="a" fill={COLORES[i % COLORES.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card titulo="Logísticas en el año">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-gray-700"><Th left>Transportadora</Th><Th>Movilizadas</Th><Th>Participación</Th><Th>Entregadas</Th><Th>Entrega</Th><Th>Devolución</Th><Th>Efectividad</Th><Th>En proceso</Th>{mesesOps.map((m) => <Th key={m.mes}>{CORTO(m.mes)}</Th>)}</tr></thead>
            <tbody>
              {filas.map((f) => {
                const ef = pctN(f.ent, f.ent + f.dev);
                return (
                  <tr key={f.t} className="border-b border-gray-800/50">
                    <Td left bold>{f.t}</Td><Td bold>{fmt(f.mov)}</Td><Td>{pct(f.mov, totMov)}</Td><Td>{fmt(f.ent)}</Td>
                    <Td color="#10b981">{pct(f.ent, f.mov)}</Td><Td color="#ef4444">{pct(f.dev, f.mov)}</Td><Td bold color={colorTasa(ef, 75, 60)}>{pctV(ef)}</Td><Td>{fmt(f.proc)}</Td>
                    {mesesOps.map((m) => { const x = data.transp[f.t]?.[m.mes]; const v = x ? pctN(x.ent, x.ent + x.dev) : null; return <Td key={m.mes} color={colorTasa(v, 75, 60)}>{x?.mov ? pctV(v) : "—"}</Td>; })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] t-muted mt-2">Columnas por mes: efectividad de cada logística.</p>
      </Card>
    </div>
  );
}

// ─── Ciudades ───
function Ciudades({ data, country }: { data: Data; country: Pais }) {
  const transportadoras = Object.keys(data.transp);
  const [tr, setTr] = useState<string>("todas");
  const [orden, setOrden] = useState<"mov" | "efect" | "dev">("mov");
  const [buscar, setBuscar] = useState("");
  const [minMov, setMinMov] = useState(country === "py" ? 100 : 50);
  const val = (c: Ciudad | Depto) => (tr === "todas" ? c : c.por_transp[tr] ?? { mov: 0, ent: 0, dev: 0, proc: 0, guias: 0 });
  const filas = data.ciudades
    .map((c) => { const v = val(c); return { c, v, efect: pctN(v.ent, v.ent + v.dev), devp: pctN(v.dev, v.mov) }; })
    .filter((x) => x.v.mov >= minMov && (!buscar || x.c.ciudad.toLowerCase().includes(buscar.toLowerCase()) || x.c.departamento.toLowerCase().includes(buscar.toLowerCase())))
    .sort((a, b) => orden === "mov" ? b.v.mov - a.v.mov : orden === "efect" ? (b.efect ?? 0) - (a.efect ?? 0) : (b.devp ?? 0) - (a.devp ?? 0));
  const totMov = data.ciudades.reduce((a, c) => a + val(c).mov, 0);
  const top = filas.slice(0, 15).map((x) => ({ ciudad: x.c.ciudad.length > 16 ? x.c.ciudad.slice(0, 15) + "…" : x.c.ciudad, Efectividad: x.efect, "Devolución %": x.devp }));
  const mesesOps = data.meses.filter((m) => m.fuente === "operaciones");

  return (
    <div className="space-y-4">
      <Card titulo="Ciudades: volumen y efectividad" sub="Desde Abril. Filtrá por logística para ver cómo entrega cada una en cada ciudad."
        acciones={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select value={tr} onChange={(e) => setTr(e.target.value)} className="px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary">
              <option value="todas">Todas las logísticas</option>
              {transportadoras.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar ciudad o depto…" className="px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary w-44" />
            <label className="t-muted flex items-center gap-1">mín. <input type="number" value={minMov} onChange={(e) => setMinMov(Number(e.target.value) || 0)} className="w-16 px-1 py-0.5 rounded border border-gray-700 bg-transparent t-primary" /> movilizadas</label>
          </div>
        }>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="ciudad" fontSize={9} stroke="#888" interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis fontSize={10} stroke="#888" domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} />
            <Tooltip {...tip} formatter={(v) => pctV(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Efectividad" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Devolución %" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="overflow-x-auto mt-3 max-h-[520px] overflow-y-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="sticky top-0" style={{ background: "var(--bg-card)" }}><tr className="border-b border-gray-700">
              <Th left>#</Th><Th left>Ciudad</Th><Th left>Departamento</Th>
              <Th onClick={() => setOrden("mov")} activo={orden === "mov"}>Movilizadas</Th><Th>% del total</Th><Th>Entregadas</Th><Th>Entrega</Th>
              <Th onClick={() => setOrden("dev")} activo={orden === "dev"}>Devolución</Th><Th onClick={() => setOrden("efect")} activo={orden === "efect"}>Efectividad</Th><Th>En proceso</Th>
              {tr === "todas" && transportadoras.map((t) => <Th key={t}>{t}</Th>)}<Th>Tendencia</Th>
            </tr></thead>
            <tbody>
              {filas.slice(0, 150).map((x, i) => (
                <tr key={`${x.c.ciudad}|${x.c.departamento}`} className="border-b border-gray-800/50">
                  <Td left>{i + 1}</Td><Td left bold>{x.c.ciudad}</Td><Td left>{x.c.departamento}</Td>
                  <Td bold>{fmt(x.v.mov)}</Td><Td>{pct(x.v.mov, totMov)}</Td><Td>{fmt(x.v.ent)}</Td><Td color="#10b981">{pct(x.v.ent, x.v.mov)}</Td>
                  <Td color={colorTasa(x.devp, 15, 30, true)}>{pctV(x.devp)}</Td><Td bold color={colorTasa(x.efect, 75, 60)}>{pctV(x.efect)}</Td><Td>{fmt(x.v.proc)}</Td>
                  {tr === "todas" && transportadoras.map((t) => { const p = x.c.por_transp[t]; const e = p ? pctN(p.ent, p.ent + p.dev) : null; return <Td key={t} color={colorTasa(e, 75, 60)}>{p?.mov ? `${pctV(e)} · ${fmt(p.mov)}` : "—"}</Td>; })}
                  <td className="py-1.5 px-2"><MiniBarras valores={mesesOps.map((m) => (tr === "todas" ? x.c.por_mes[m.mes]?.mov : undefined) ?? (tr === "todas" ? 0 : 0))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] t-muted mt-2">{fmt(filas.length)} ciudades con al menos {minMov} movilizadas. Columnas por logística: efectividad · movilizadas. Tendencia: movilizadas por mes (Abril →).</p>
      </Card>

      <Card titulo="Departamentos / provincias">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead><tr className="border-b border-gray-700"><Th left>Departamento</Th><Th>Movilizadas</Th><Th>% del total</Th><Th>Entrega</Th><Th>Devolución</Th><Th>Efectividad</Th>{transportadoras.map((t) => <Th key={t}>{t}</Th>)}</tr></thead>
            <tbody>
              {data.departamentos.map((d) => {
                const v = val(d); const ef = pctN(v.ent, v.ent + v.dev);
                if (!v.mov) return null;
                return (
                  <tr key={d.departamento} className="border-b border-gray-800/50">
                    <Td left bold>{d.departamento}</Td><Td bold>{fmt(v.mov)}</Td><Td>{pct(v.mov, totMov)}</Td><Td color="#10b981">{pct(v.ent, v.mov)}</Td>
                    <Td color="#ef4444">{pct(v.dev, v.mov)}</Td><Td bold color={colorTasa(ef, 75, 60)}>{pctV(ef)}</Td>
                    {transportadoras.map((t) => { const p = d.por_transp[t]; const e = p ? pctN(p.ent, p.ent + p.dev) : null; return <Td key={t} color={colorTasa(e, 75, 60)}>{p?.mov ? pctV(e) : "—"}</Td>; })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Comercial ───
function Comercial({ data }: { data: Data }) {
  const [vista, setVista] = useState<"usuarios" | "proveedores" | "productos">("usuarios");
  const [buscar, setBuscar] = useState("");
  const c = data.comercial;
  const mesesCom = c.meses.map((m) => m.mes);
  const serie = c.meses.map((m) => ({ mes: CORTO(m.mes) + (m.mes === data.mesActual ? "*" : ""), Órdenes: m.ordenes, Usuarios: m.usuarios, Proveedores: m.proveedores, Productos: m.productos }));
  const lista = (vista === "usuarios" ? c.usuarios : vista === "proveedores" ? c.proveedores : c.productos)
    .filter((e) => !buscar || e.nombre.toLowerCase().includes(buscar.toLowerCase()) || (e.proveedor ?? "").toLowerCase().includes(buscar.toLowerCase()));
  const totalAnio = c.meses.reduce((a, m) => a + m.ordenes, 0);
  const totalLista = vista === "usuarios" ? c.usuariosTotal : vista === "proveedores" ? c.proveedoresTotal : c.productosTotal;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Órdenes (archivo comercial)" value={fmt(totalAnio)} sub={`desde ${LARGO(mesesCom[0] ?? "abril")}`} color="#3b82f6" />
        <Kpi label="Usuarios con órdenes" value={fmt(c.usuariosTotal)} sub="en el año" />
        <Kpi label="Proveedores" value={fmt(c.proveedoresTotal)} sub="en el año" color="#a855f7" />
        <Kpi label="Productos" value={fmt(c.productosTotal)} sub="en el año" color="#10b981" />
      </div>

      <Card titulo="Órdenes y base activa por mes" sub="Órdenes del archivo comercial (todas, incluidas canceladas) y cuántos usuarios, proveedores y productos tuvieron movimiento. * mes en curso.">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="mes" fontSize={11} stroke="#888" />
            <YAxis yAxisId="o" fontSize={10} stroke="#888" tickFormatter={(v) => fmt(Number(v))} width={55} />
            <YAxis yAxisId="b" orientation="right" fontSize={10} stroke="#888" width={45} />
            <Tooltip {...tip} formatter={(v) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="o" dataKey="Órdenes" fill="#3b82f6" opacity={0.6} radius={[3, 3, 0, 0]} />
            <Line yAxisId="b" dataKey="Usuarios" stroke="#f97316" strokeWidth={2} />
            <Line yAxisId="b" dataKey="Proveedores" stroke="#a855f7" strokeWidth={2} />
            <Line yAxisId="b" dataKey="Productos" stroke="#10b981" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card titulo={vista === "usuarios" ? "Usuarios (dropshippers) del año" : vista === "proveedores" ? "Proveedores del año" : "Productos del año"}
        sub={`Top ${lista.length < totalLista ? lista.length : totalLista} de ${fmt(totalLista)}. Entrega = entregadas ÷ despachadas (sin canceladas ni pendientes), según el archivo comercial de cada mes.`}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Chips opciones={[{ k: "usuarios", l: "Usuarios" }, { k: "proveedores", l: "Proveedores" }, { k: "productos", l: "Productos" }]} valor={vista} onChange={setVista} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" className="text-xs px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary w-40" />
          </div>
        }>
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0" style={{ background: "var(--bg-card)" }}><tr className="border-b border-gray-700">
              <Th left>#</Th><Th left>{vista === "usuarios" ? "Usuario" : vista === "proveedores" ? "Proveedor" : "Producto"}</Th>
              {vista === "productos" && <Th left>Proveedor</Th>}
              <Th>Órdenes año</Th><Th>% del total</Th><Th>Meses activo</Th>
              {vista !== "productos" && <><Th>Entrega</Th><Th>Devolución</Th><Th>Cancelación</Th></>}
              {mesesCom.map((m) => <Th key={m}>{CORTO(m)}</Th>)}<Th>Tendencia</Th>
            </tr></thead>
            <tbody>
              {lista.map((e, i) => {
                const ent = pctN(e.entregado, e.despachado), dev = pctN(e.devolucion, e.despachado);
                return (
                  <tr key={e.nombre} className="border-b border-gray-800/50">
                    <Td left>{i + 1}</Td>
                    <td className="py-1.5 px-2 text-xs t-primary font-medium max-w-[260px] truncate" title={e.nombre}>{e.nombre}</td>
                    {vista === "productos" && <td className="py-1.5 px-2 text-[11px] t-secondary max-w-[180px] truncate" title={e.proveedor}>{e.proveedor ?? "—"}</td>}
                    <Td bold>{fmt(e.total)}</Td><Td>{pct(e.total, totalAnio)}</Td><Td>{e.meses}/{mesesCom.length}</Td>
                    {vista !== "productos" && <><Td color={colorTasa(ent, 60, 45)}>{pctV(ent)}</Td><Td color={colorTasa(dev, 15, 30, true)}>{pctV(dev)}</Td><Td>{pct(e.cancelado, e.total)}</Td></>}
                    {mesesCom.map((m) => <Td key={m}>{e.por_mes[m] ? fmt(e.por_mes[m]) : "—"}</Td>)}
                    <td className="py-1.5 px-2"><MiniBarras valores={mesesCom.map((m) => e.por_mes[m] ?? 0)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tabla mensual ───
function TablaMensual({ meses, movOficial }: { meses: Mes[]; movOficial: (m: Mes) => number }) {
  const filas: (Mes | { total: string; ms: Mes[] })[] = [];
  let q = "";
  let grupo: Mes[] = [];
  for (const m of meses) {
    const qm = trimestre(m.mes);
    if (q && qm !== q) { filas.push({ total: q, ms: grupo }); grupo = []; }
    q = qm; grupo.push(m); filas.push(m);
  }
  if (grupo.length) filas.push({ total: q, ms: grupo });
  filas.push({ total: "Año", ms: meses });

  const linea = (key: string, nombre: string, ms: Mes[], esTotal: boolean, m?: Mes) => {
    const s = (k: keyof Mes) => ms.reduce((a, x) => a + Number(x[k] || 0), 0);
    const ing = s("ingresadas"), mov = ms.reduce((a, x) => a + movOficial(x), 0), movOps = s("movilizadas"), ent = s("entregadas"), dev = s("devueltas"), proc = s("en_proceso");
    const meta = ms.reduce((a, x) => a + (x.meta_mov ?? 0), 0);
    const movConMeta = ms.filter((x) => x.meta_mov).reduce((a, x) => a + movOficial(x), 0); // cumplimiento solo de meses con meta
    const canc = ms.every((x) => x.canceladas === null) ? null : s("canceladas");
    const dias = ms.reduce((a, x) => a + (x.en_curso ? x.dias_con_datos : x.dias_mes), 0);
    return (
      <tr key={key} className={`border-b ${esTotal ? "border-gray-600 bg-orange-500/5" : "border-gray-800/50"}`}>
        <Td left bold={esTotal}>{nombre}{m?.en_curso ? ` (${m.dias_con_datos} d)` : ""}</Td>
        <Td bold={esTotal}>{fmt(ing)}</Td><Td>{fmt(ing / Math.max(dias, 1))}</Td>
        <Td bold color="#f97316">{fmt(mov)}</Td><Td>{meta ? fmt(meta) : "—"}</Td>
        <Td bold color={meta ? (movConMeta >= meta ? "#10b981" : "#ef4444") : undefined}>{meta ? pct(movConMeta, meta) : "—"}</Td>
        <Td>{pct(movOps, ing)}</Td><Td>{fmt(ent)}</Td><Td color="#10b981">{pct(ent, movOps)}</Td><Td>{fmt(dev)}</Td><Td color="#ef4444">{pct(dev, movOps)}</Td>
        <Td bold color={colorTasa(pctN(ent, ent + dev), 75, 60)}>{pct(ent, ent + dev)}</Td><Td>{fmt(proc)}</Td><Td>{canc === null ? "—" : fmt(canc)}</Td>
        <Td left>{m ? (m.fuente === "resumen" ? "Totales" : "Operaciones") : ""}</Td>
      </tr>
    );
  };

  return (
    <Card titulo="Todos los indicadores, mes a mes" sub="Movilizadas: cierre oficial cuando está cargado; si no, Operaciones. Tasas sobre movilizadas de Operaciones. Efectividad = entregadas ÷ (entregadas + devueltas).">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead><tr className="border-b border-gray-700">
            <Th left>Mes</Th><Th>Ingresadas</Th><Th>Prom./día</Th><Th>Movilizadas</Th><Th>Meta</Th><Th>Cumpl.</Th><Th>Movilización</Th>
            <Th>Entregadas</Th><Th>Entrega</Th><Th>Devueltas</Th><Th>Devolución</Th><Th>Efectividad</Th><Th>En proceso</Th><Th>Canceladas</Th><Th left>Fuente</Th>
          </tr></thead>
          <tbody>
            {filas.map((f) => ("total" in f ? linea(`t-${f.total}`, f.total === "Año" ? "Total del año" : `Total ${f.total}`, f.ms, true) : linea(f.mes, LARGO(f.mes), [f], false, f)))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
