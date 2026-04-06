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
  Legend,
} from "recharts";

// ─── DATA FROM PLAN COMERCIAL ───

const ESTRATEGIAS = [
  {
    id: 1,
    icon: "🚀",
    title: "Escalar Proveedores en Crecimiento",
    meta: 10800,
    incremento: 3698,
    pct: 0.67,
    color: "#10B981",
    proveedores: [
      { nombre: "TIENDAOFERTAS", marzo: 2585, meta: 4000, incremento: 1415, como: "pascu.ecom →1,200, urielparedes →550, caiorodrigo →400, nuevos DS →850" },
      { nombre: "MERX Lab e Imp", marzo: 2007, meta: 2800, incremento: 793, como: "multiventas →1,000, mdelarosa →900, expandir a nuevos dropshippers" },
      { nombre: "MARIOGONZALEZ", marzo: 1356, meta: 2200, incremento: 844, como: "joao.oliveira →800, mercaplus →400, casanoblear →350, juan →150" },
      { nombre: "MerxLaboratorio", marzo: 804, meta: 1200, incremento: 396, como: "multiventas →900, atraer DS de MERX Lab, expandir" },
      { nombre: "RaulGonzalez", marzo: 350, meta: 600, incremento: 250, como: "multiventas activo, mdelarosa activo, sostener crecimiento" },
    ],
  },
  {
    id: 2,
    icon: "🛡️",
    title: "Frenar Caída de Top 2 Proveedores",
    meta: 3300,
    incremento: 1064,
    pct: 0.20,
    color: "#F59E0B",
    proveedores: [
      { nombre: "OscarCoronado", marzo: 942, meta: 1500, incremento: 558, como: "Recuperar guilherme/yurihenri, ofrecer nuevos productos trending" },
      { nombre: "MaicolPerez", marzo: 1294, meta: 1800, incremento: 506, como: "Frenar caída de guilherme, diversificar cartera DS" },
    ],
  },
  {
    id: 3,
    icon: "🔄",
    title: "Reactivar Proveedores Dormidos",
    meta: 920,
    incremento: 628,
    pct: 0.06,
    color: "#8B5CF6",
    proveedores: [
      { nombre: "DaniiDiaz", marzo: 3, meta: 150, incremento: 147, como: "Tuvo 243 en Ene. DS cicinho.barbara inactivo. Reactivar." },
      { nombre: "LizDiaz", marzo: 3, meta: 120, incremento: 117, como: "267 en Ene, mismo DS pool que DaniiDiaz" },
      { nombre: "FLUENSTORE", marzo: 58, meta: 200, incremento: 142, como: "421 en Ene, lackagente se fue. Buscar nuevos DS" },
      { nombre: "TN", marzo: 228, meta: 450, incremento: 222, como: "953 en Ene, abstra33 y guilherme se fueron. Reconectar" },
    ],
  },
  {
    id: 4,
    icon: "📊",
    title: "Proveedores Menores Estables",
    meta: 1130,
    incremento: 352,
    pct: 0.07,
    color: "#3B82F6",
    proveedores: [
      { nombre: "ARGENTINAADMA + AlejandroSeijas", marzo: 476, meta: 600, incremento: 124, como: "Estables, mantener con pequeño push" },
      { nombre: "Paul + Yoel + Morena + ROCKET + otros", marzo: 302, meta: 530, incremento: 228, como: "Pequeños proveedores con potencial, ROCKETROCKET creciendo" },
    ],
  },
];

const TIERS_DS = [
  { tier: "⭐ Tier 1 (>500 ord/mes)", marDS: 4, marOrd: 4073, abrDS: 5, abrOrd: 6400, color: "#F59E0B" },
  { tier: "🔥 Tier 2 (100-500 ord/mes)", marDS: 7, marOrd: 1502, abrDS: 12, abrOrd: 3240, color: "#F97316" },
  { tier: "📊 Tier 3 (20-99 ord/mes)", marDS: 25, marOrd: 2200, abrDS: 30, abrOrd: 2640, color: "#3B82F6" },
  { tier: "📎 Tier 4 (<20 ord/mes)", marDS: 40, marOrd: 2628, abrDS: 48, abrOrd: 960, color: "#6B7280" },
];

const TOP_DS = [
  { nombre: "multiventasxargentina", ene: 16, feb: 401, mar: 1831, meta: 2500, proveedores: "MERX Lab (832), MerxLab (714), TIENDAOFERTAS (285)", plan: "Canal directo, stock garantizado, mejorar tasa entrega" },
  { nombre: "pascu.ecom", ene: 0, feb: 0, mar: 927, meta: 1500, proveedores: "TIENDAOFERTAS (exclusivo)", plan: "Retener, alto potencial, ofrecer 2do proveedor" },
  { nombre: "mdelarosa.bmm", ene: 62, feb: 484, mar: 771, meta: 1000, proveedores: "MERX Lab (748), MerxLab (23)", plan: "Expandir a más proveedores, más SKUs" },
  { nombre: "joao.oliveira", ene: 11, feb: 16, mar: 544, meta: 800, proveedores: "MARIOGONZALEZ (544)", plan: "83% mov (!), asegurar stock, expandir" },
  { nombre: "urielparedes219", ene: 166, feb: 272, mar: 411, meta: 600, proveedores: "TIENDAOFERTAS (411)", plan: "95% mov, crecimiento orgánico sostenido" },
];

const CALENDARIO = [
  { sem: "Sem 0", dias: [
    { dia: "Mar", fecha: "1-Abr", metaIng: 495, metaMov: 371 },
    { dia: "Mié", fecha: "2-Abr", metaIng: 495, metaMov: 371 },
    { dia: "Jue", fecha: "3-Abr", metaIng: 495, metaMov: 371 },
    { dia: "Vie", fecha: "4-Abr", metaIng: 497, metaMov: 373 },
  ]},
  { sem: "Sem 1", dias: [
    { dia: "Lun", fecha: "7-Abr", metaIng: 524, metaMov: 393 },
    { dia: "Mar", fecha: "8-Abr", metaIng: 524, metaMov: 393 },
    { dia: "Mié", fecha: "9-Abr", metaIng: 524, metaMov: 393 },
    { dia: "Jue", fecha: "10-Abr", metaIng: 524, metaMov: 393 },
    { dia: "Vie", fecha: "11-Abr", metaIng: 524, metaMov: 393 },
  ]},
  { sem: "Sem 2", dias: [
    { dia: "Lun", fecha: "14-Abr", metaIng: 725, metaMov: 544 },
    { dia: "Mar", fecha: "15-Abr", metaIng: 725, metaMov: 544 },
    { dia: "Mié", fecha: "16-Abr", metaIng: 725, metaMov: 544 },
    { dia: "Jue", fecha: "17-Abr", metaIng: 725, metaMov: 544 },
    { dia: "Vie", fecha: "18-Abr", metaIng: 725, metaMov: 544 },
  ]},
  { sem: "Sem 3", dias: [
    { dia: "Lun", fecha: "21-Abr", metaIng: 927, metaMov: 695 },
    { dia: "Mar", fecha: "22-Abr", metaIng: 927, metaMov: 695 },
    { dia: "Mié", fecha: "23-Abr", metaIng: 927, metaMov: 695 },
    { dia: "Jue", fecha: "24-Abr", metaIng: 927, metaMov: 695 },
    { dia: "Vie", fecha: "25-Abr", metaIng: 927, metaMov: 695 },
  ]},
  { sem: "Sem 4", dias: [
    { dia: "Lun", fecha: "28-Abr", metaIng: 1048, metaMov: 786 },
    { dia: "Mar", fecha: "29-Abr", metaIng: 1048, metaMov: 786 },
    { dia: "Mié", fecha: "30-Abr", metaIng: 1048, metaMov: 786 },
  ]},
];

const HEADCOUNT = [
  { fuente: "DS activos de Marzo que se mantienen", ds: 65, ordenes: 8900, accion: "Sostener base actual. No perder a nadie." },
  { fuente: "DS de Marzo que escalan (Tier 1+2)", ds: 6, ordenes: 2760, accion: "Upside de los 17 DS Tier 1+2 ya existentes." },
  { fuente: "DS recuperados (guilherme, yurihenri...)", ds: 4, ordenes: 900, accion: "Contactar Sem 1. Ofrecer condiciones mejoradas." },
  { fuente: "DS nuevos captados en Abril", ds: 10, ordenes: 700, accion: "5 Sem 2, 5 Sem 3. Kit de onboarding listo." },
  { fuente: "DS de proveedores reactivados", ds: 10, ordenes: 500, accion: "Depende de reactivar proveedores dormidos." },
];

type Tab = "estrategias" | "dropshippers" | "calendario" | "resumen";

export default function ArgentinaPlanAbril() {
  const [tab, setTab] = useState<Tab>("estrategias");
  const [expandedEst, setExpandedEst] = useState<number | null>(1);

  const totalMeta = ESTRATEGIAS.reduce((s, e) => s + e.meta, 0);
  const totalIncremento = ESTRATEGIAS.reduce((s, e) => s + e.incremento, 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: "estrategias", label: "Estrategias" },
    { key: "dropshippers", label: "Dropshippers" },
    { key: "calendario", label: "Calendario" },
    { key: "resumen", label: "Road to 16K" },
  ];

  return (
    <div className="glass-card p-6 border-sky-500/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📋 Plan Comercial Abril 2026
          </h2>
          <p className="text-xs text-gray-400">
            Meta: 16,000 ingresadas / 12,000 movilizadas &middot; Gap vs Marzo: +5,597 ordenes (+54%)
          </p>
        </div>
        <div className="flex gap-1">
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

      {/* ─── ESTRATEGIAS TAB ─── */}
      {tab === "estrategias" && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {ESTRATEGIAS.map((e) => (
              <div
                key={e.id}
                className="rounded-xl p-3 border cursor-pointer transition-all hover:scale-[1.02]"
                style={{ borderColor: e.color + "40", background: e.color + "08" }}
                onClick={() => setExpandedEst(expandedEst === e.id ? null : e.id)}
              >
                <p className="text-[10px] text-gray-400 uppercase">{e.icon} Est. {e.id}</p>
                <p className="text-lg font-bold" style={{ color: e.color }}>{e.meta.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">+{e.incremento.toLocaleString()} vs Mar</p>
              </div>
            ))}
          </div>

          {/* Expanded strategy */}
          {ESTRATEGIAS.map((e) => expandedEst === e.id && (
            <div key={e.id} className="rounded-xl border p-4" style={{ borderColor: e.color + "30", background: e.color + "05" }}>
              <h3 className="text-sm font-bold text-white mb-3">
                {e.icon} Estrategia {e.id}: {e.title}
                <span className="text-xs font-normal ml-2" style={{ color: e.color }}>
                  Meta: {e.meta.toLocaleString()} | +{e.incremento.toLocaleString()} ordenes
                </span>
              </h3>
              <div className="space-y-2">
                {e.proveedores.map((p) => (
                  <div key={p.nombre} className="flex items-start gap-3 p-3 rounded-lg border border-gray-800/50" style={{ background: "rgba(15,52,96,0.15)" }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{p.nombre}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                          Mar: {p.marzo.toLocaleString()}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: e.color + "20", color: e.color }}>
                          Meta: {p.meta.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-green-400">+{p.incremento.toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{p.como}</p>
                    </div>
                    {/* Mini progress */}
                    <div className="w-16 text-right shrink-0">
                      <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min((p.marzo / p.meta) * 100, 100)}%`, background: e.color }} />
                      </div>
                      <p className="text-[9px] text-gray-500 mt-0.5">{((p.marzo / p.meta) * 100).toFixed(0)}% base</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Strategy chart */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Marzo vs Meta Abril por Estrategia</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ESTRATEGIAS.map((e) => ({
                name: `Est. ${e.id}`,
                Marzo: e.proveedores.reduce((s, p) => s + p.marzo, 0),
                "Meta Abril": e.meta,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 12 }}
                  formatter={(value) => Number(value).toLocaleString()}
                />
                <Bar dataKey="Marzo" fill="#6B7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Meta Abril" radius={[4, 4, 0, 0]}>
                  {ESTRATEGIAS.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── DROPSHIPPERS TAB ─── */}
      {tab === "dropshippers" && (
        <div className="space-y-6">
          {/* Tier model */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Modelo de Tiers: De 76 a 95 DS activos (+25%)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {TIERS_DS.map((t) => (
                <div key={t.tier} className="rounded-xl p-4 border" style={{ borderColor: t.color + "30", background: t.color + "08" }}>
                  <p className="text-xs font-medium text-white mb-2">{t.tier}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-gray-500">Marzo</p>
                      <p className="text-gray-300">{t.marDS} DS</p>
                      <p style={{ color: t.color }} className="font-bold">{t.marOrd.toLocaleString()} ord</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Meta Abril</p>
                      <p className="text-white font-medium">{t.abrDS} DS</p>
                      <p style={{ color: t.color }} className="font-bold">{t.abrOrd.toLocaleString()} ord</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier chart */}
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={TIERS_DS.map((t) => ({
              name: t.tier.split("(")[0].trim(),
              "Marzo Ord": t.marOrd,
              "Meta Abril Ord": t.abrOrd,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 12 }}
                formatter={(value) => Number(value).toLocaleString()}
              />
              <Bar dataKey="Marzo Ord" fill="#6B7280" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Meta Abril Ord" fill="#74ACDF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Top DS detail */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">👑 Top 5 Mega-Dropshippers - Atencion VIP</h3>
            <div className="space-y-2">
              {TOP_DS.map((d, i) => (
                <div key={d.nombre} className="p-3 rounded-xl border border-gray-800/50 hover:border-sky-500/20 transition-all" style={{ background: "rgba(15,52,96,0.15)" }}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${i < 3 ? "text-white" : "bg-gray-800 text-gray-400"}`}
                      style={i < 3 ? { background: "linear-gradient(135deg, #74ACDF, #F6B40E)" } : {}}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{d.nombre}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(116,172,223,0.2)", color: "#74ACDF" }}>
                          Meta: {d.meta.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px]">
                        <span className="text-gray-500">Ene: {d.ene.toLocaleString()}</span>
                        <span className="text-gray-400">Feb: {d.feb.toLocaleString()}</span>
                        <span className="text-sky-400 font-medium">Mar: {d.mar.toLocaleString()}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Proveedores: {d.proveedores}</p>
                      <p className="text-[10px] text-green-400 mt-0.5">{d.plan}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">Crec. necesario</p>
                      <p className="text-sm font-bold text-sky-400">+{((d.meta / d.mar - 1) * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Headcount source */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">De donde salen los 95 DS activos</h3>
            <div className="table-container overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-sky-500/20">
                    <th className="text-left py-2 px-2 text-gray-400">Fuente</th>
                    <th className="text-right py-2 px-2 text-gray-400">DS</th>
                    <th className="text-right py-2 px-2 text-gray-400">Ordenes</th>
                    <th className="text-left py-2 px-2 text-gray-400">Accion clave</th>
                  </tr>
                </thead>
                <tbody>
                  {HEADCOUNT.map((h) => (
                    <tr key={h.fuente} className="border-b border-gray-800/50">
                      <td className="py-2 px-2 text-white">{h.fuente}</td>
                      <td className="py-2 px-2 text-right text-sky-400 font-medium">{h.ds}</td>
                      <td className="py-2 px-2 text-right text-orange-400">{h.ordenes.toLocaleString()}</td>
                      <td className="py-2 px-2 text-gray-400">{h.accion}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-sky-500/30 font-bold">
                    <td className="py-2 px-2 text-white">TOTAL</td>
                    <td className="py-2 px-2 text-right text-sky-400">95</td>
                    <td className="py-2 px-2 text-right text-orange-400">13,760</td>
                    <td className="py-2 px-2 text-gray-400">+ buffer organico → 16,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── CALENDARIO TAB ─── */}
      {tab === "calendario" && (
        <div className="space-y-6">
          <div className="text-xs text-gray-400 mb-2">
            Meta escalonada por semana: arranca conservador (Sem 0-1) y acelera con nuevos DS y proveedores reactivados.
          </div>

          {/* Calendar chart */}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={CALENDARIO.flatMap((s) => s.dias.map((d) => ({
              name: d.fecha.replace("-Abr", ""),
              "Meta Ing": d.metaIng,
              "Meta Mov": d.metaMov,
            })))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 12 }}
                formatter={(value) => Number(value).toLocaleString()}
              />
              <Bar dataKey="Meta Ing" fill="#74ACDF" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="Meta Mov" fill="#F6B40E" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>

          {/* Week-by-week table */}
          {CALENDARIO.map((sem) => {
            const semTotal = sem.dias.reduce((s, d) => s + d.metaIng, 0);
            const acumPrev = CALENDARIO.slice(0, CALENDARIO.indexOf(sem)).reduce((s, ss) => s + ss.dias.reduce((s2, d) => s2 + d.metaIng, 0), 0);
            return (
              <div key={sem.sem} className="rounded-xl border border-gray-800/50 overflow-hidden" style={{ background: "rgba(15,52,96,0.1)" }}>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50" style={{ background: "rgba(116,172,223,0.08)" }}>
                  <span className="text-sm font-medium text-white">{sem.sem}</span>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-sky-400">{semTotal.toLocaleString()} ing/sem</span>
                    <span className="text-gray-400">~{Math.round(semTotal / sem.dias.length).toLocaleString()}/dia</span>
                    <span className="text-yellow-400">Acum: {(acumPrev + semTotal).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-0">
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

          <div className="text-center text-xs text-gray-500 mt-2">
            Sem 0-1: Base conservadora (~500/dia) | Sem 2: +DS nuevos (~725/dia) | Sem 3-4: Plena operacion (~927-1,048/dia)
          </div>
        </div>
      )}

      {/* ─── RESUMEN TAB ─── */}
      {tab === "resumen" && (
        <div className="space-y-6">
          {/* Big number */}
          <div className="text-center py-6">
            <p className="text-xs text-gray-400 uppercase mb-2">Proyeccion Total Abril</p>
            <p className="text-5xl font-black" style={{ background: "linear-gradient(90deg, #74ACDF, #F6B40E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {totalMeta.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              ordenes ingresadas | +{totalIncremento.toLocaleString()} vs Marzo (+{((totalIncremento / 10403) * 100).toFixed(0)}%)
            </p>
          </div>

          {/* Strategy pie + bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Composicion por Estrategia</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={ESTRATEGIAS.map((e) => ({ name: `Est.${e.id}: ${e.title.split(" ").slice(0, 2).join(" ")}`, value: e.meta }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {ESTRATEGIAS.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#16213e", border: "1px solid rgba(116,172,223,0.3)", borderRadius: "12px", fontSize: 12 }}
                    formatter={(value) => Number(value).toLocaleString()}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Road to 16,000</h3>
              <div className="space-y-3">
                {ESTRATEGIAS.map((e) => {
                  const marzoTotal = e.proveedores.reduce((s, p) => s + p.marzo, 0);
                  return (
                    <div key={e.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-300">{e.icon} {e.title}</span>
                        <span style={{ color: e.color }} className="font-bold">{e.meta.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden relative">
                        <div className="h-full rounded-full opacity-40" style={{ width: `${(marzoTotal / totalMeta) * 100}%`, background: e.color }} />
                        <div className="h-full rounded-full absolute top-0 left-0" style={{ width: `${(e.meta / totalMeta) * 100}%`, background: e.color, opacity: 0.8 }} />
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                        <span>Marzo: {marzoTotal.toLocaleString()}</span>
                        <span>+{e.incremento.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Key risks */}
          <div className="rounded-xl p-4 border border-yellow-500/20" style={{ background: "rgba(245,158,11,0.05)" }}>
            <h3 className="text-sm font-bold text-yellow-400 mb-3">Por que es posible</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {[
                "TIENDAOFERTAS, MERX Lab, MARIOGONZALEZ ya estan en trayectoria exponencial",
                "pascu.ecom aparecio con 927 ordenes en su primer mes — puede repetirse",
                "DS que dejaron proveedores en caida NO se fueron, migraron a mejores",
                "Proveedores dormidos (DaniiDiaz, LizDiaz, FLUENSTORE, TN) son reactivables",
                "Mix de productos con categorias de demanda creciente (suplementos, belleza)",
                "Marzo tuvo 76 DS activos → solo necesitamos 95 (+25%), no un salto imposible",
              ].map((r, i) => (
                <div key={i} className="flex gap-2 p-2 rounded-lg" style={{ background: "rgba(245,158,11,0.05)" }}>
                  <span className="text-yellow-400 shrink-0">{i + 1}.</span>
                  <span className="text-gray-300">{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic */}
          <div className="rounded-xl p-4 border border-red-500/20" style={{ background: "rgba(239,68,68,0.05)" }}>
            <h3 className="text-sm font-bold text-red-400 mb-2">Diagnostico: El Gap (+5,597 ordenes, +54%)</h3>
            <div className="text-xs text-gray-300 space-y-1">
              <p>Los 2 mayores proveedores historicos (OscarCoronado -65%, MaicolPerez -49%) perdieron <span className="text-red-400 font-bold">3,731 ordenes/mes</span> entre Ene y Mar.</p>
              <p>Los proveedores crecientes ganaron <span className="text-green-400 font-bold">+4,511 ordenes/mes</span>, pero el neto es apenas +780.</p>
              <p>Para el salto de +5,597, se necesita <span className="text-sky-400 font-bold">acelerar crecientes + frenar caida + reactivar dormidos</span> simultaneamente.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
