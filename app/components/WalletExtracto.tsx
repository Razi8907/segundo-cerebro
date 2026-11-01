"use client";

// ═══════════════════════════════════════════════════════════════════
// Extracto de wallet por usuario (Cierre 2026).
// El informe de wallet de Dropi se baja por usuario: una fila por movimiento con
// FECHA (y hora), MONTO (lo que entra o sale), MONTO PREVIO (el saldo que le queda)
// y DESCRIPCION (concepto). El saldo actualizado = MONTO PREVIO del último movimiento,
// a la fecha y hora de ese movimiento en el informe.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface Movimiento { fecha: string; monto: number; previo: number | null; desc: string; tipo: string }
export interface ExtractoLeido {
  movimientos: Movimiento[]; saldo: number | null; informe_fecha: string | null; desde: string | null;
  ingresos: number; egresos: number; ds_id: string | null; ds_email: string | null; columnas: Record<string, string | null>;
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const fmtN = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("es-AR"));
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const fechaLinda = (s: string | null | undefined) => {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}` : s;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d,.-]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Fecha del informe → "YYYY-MM-DD HH:MM:SS" (acepta Date de Excel, dd-mm-aaaa, dd/mm/aaaa, aaaa-mm-dd, con o sin hora)
function fecha(v: unknown, hora?: unknown): string | null {
  let d: Date | null = null;
  if (v instanceof Date && !isNaN(v.getTime())) d = new Date(v.getTime());
  else if (typeof v === "number" && v > 20000 && v < 80000) d = new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4);
  else {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?)?/i);
    if (m) {
      let h = Number(m[4] || 0);
      if (m[7] && /p/i.test(m[7]) && h < 12) h += 12;
      if (m[7] && /a/i.test(m[7]) && h === 12) h = 0;
      d = new Date(Number(m[3].length === 2 ? "20" + m[3] : m[3]), Number(m[2]) - 1, Number(m[1]), h, Number(m[5] || 0), Number(m[6] || 0));
    } else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/))) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  if (hora !== undefined && hora !== null && hora !== "") {
    if (hora instanceof Date) d.setHours(hora.getHours(), hora.getMinutes(), hora.getSeconds());
    else if (typeof hora === "number" && hora < 1) { const t = Math.round(hora * 86400); d.setHours(Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60); }
    else { const m = String(hora).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i); if (m) { let h = Number(m[1]); if (m[4] && /p/i.test(m[4]) && h < 12) h += 12; if (m[4] && /a/i.test(m[4]) && h === 12) h = 0; d.setHours(h, Number(m[2]), Number(m[3] || 0)); } }
  }
  return iso(d);
}

export async function leerExtracto(f: File): Promise<ExtractoLeido> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });

  // Fila de encabezados: la que tiene "monto previo", o "monto" + "descripcion"
  let hi = rows.findIndex((r) => (r ?? []).some((c) => norm(c).includes("previo")));
  if (hi < 0) hi = rows.findIndex((r) => { const n = (r ?? []).map(norm); return n.some((c) => c.startsWith("monto")) && n.some((c) => c.includes("descrip")); });
  if (hi < 0) throw new Error("No encontré las columnas MONTO PREVIO / MONTO / DESCRIPCION en el archivo.");
  const hs = (rows[hi] ?? []).map(norm);
  const col = (pred: (h: string) => boolean) => { const i = hs.findIndex(pred); return i >= 0 ? i : null; };
  const iPrev = col((h) => h.includes("previo"));
  const iMonto = col((h) => h === "monto" || (h.startsWith("monto") && !h.includes("previo")) || h === "valor" || h === "importe");
  const iDesc = col((h) => h.includes("descrip") || h.includes("concepto") || h.includes("detalle"));
  const iFecha = col((h) => h.includes("fecha"));
  const iHora = col((h) => h === "hora" || h.startsWith("hora "));
  const iTipo = col((h) => h === "tipo" || h.includes("tipo de movimiento") || h.includes("tipo movimiento") || h === "movimiento");
  const iId = col((h) => h === "id usuario" || h === "usuario id" || h === "user id" || h === "id dropshipper" || h === "dropshipper id");
  const iEmail = col((h) => h.includes("email") || h.includes("correo"));
  if (iMonto === null || iFecha === null) throw new Error("El archivo no tiene columna de FECHA o de MONTO.");
  const nombreCol = (i: number | null) => (i === null ? null : String(rows[hi]?.[i] ?? ""));

  // Fecha y hora impresas arriba de la tabla (si el informe las trae)
  let informeCabecera: string | null = null;
  for (let r = 0; r < hi && !informeCabecera; r++) for (const c of rows[r] ?? []) { const f2 = fecha(c) ?? fecha(String(c ?? "").replace(/^[^\d]*/, "")); if (f2) { informeCabecera = f2; break; } }

  const movimientos: Movimiento[] = [];
  let dsId: string | null = null, dsEmail: string | null = null;
  for (let r = hi + 1; r < rows.length; r++) {
    const x = rows[r] ?? [];
    const fch = fecha(x[iFecha], iHora !== null ? x[iHora] : undefined);
    let monto = num(x[iMonto]);
    if (!fch || monto === null) continue;
    const tipo = iTipo !== null ? String(x[iTipo] ?? "").trim() : "";
    if (tipo) { const t = norm(tipo); if (/salida|egreso|debito|retiro|descuento|cargo/.test(t)) monto = -Math.abs(monto); else if (/entrada|ingreso|credito|abono|deposito/.test(t)) monto = Math.abs(monto); }
    movimientos.push({ fecha: fch, monto, previo: iPrev !== null ? num(x[iPrev]) : null, desc: iDesc !== null ? String(x[iDesc] ?? "").trim() : "", tipo });
    if (!dsId && iId !== null && x[iId]) dsId = String(x[iId]).trim();
    if (!dsEmail && iEmail !== null && x[iEmail]) dsEmail = String(x[iEmail]).trim().toLowerCase();
  }
  if (!movimientos.length) throw new Error("No encontré movimientos con fecha y monto.");

  // Último movimiento: fecha más nueva; si hay empate, según el orden del archivo
  const desc = movimientos[0].fecha >= movimientos[movimientos.length - 1].fecha;
  let ult = 0;
  movimientos.forEach((m, i) => { const u = movimientos[ult]; if (m.fecha > u.fecha || (m.fecha === u.fecha && !desc && i > ult)) ult = i; });
  const fechas = movimientos.map((m) => m.fecha).sort();
  return {
    movimientos,
    saldo: movimientos[ult].previo,
    informe_fecha: informeCabecera ?? movimientos[ult].fecha,
    desde: fechas[0],
    ingresos: movimientos.filter((m) => m.monto > 0).reduce((a, m) => a + m.monto, 0),
    egresos: movimientos.filter((m) => m.monto < 0).reduce((a, m) => a + m.monto, 0),
    ds_id: dsId, ds_email: dsEmail,
    columnas: { fecha: nombreCol(iFecha), hora: nombreCol(iHora), monto: nombreCol(iMonto), monto_previo: nombreCol(iPrev), descripcion: nombreCol(iDesc), tipo: nombreCol(iTipo) },
  };
}

// Concepto agrupable: la descripción sin números de orden/guía
const concepto = (d: string) => d.replace(/#?\b[\w-]*\d[\w-]*\b/g, "").replace(/[:\-–#()]+/g, " ").replace(/\s+/g, " ").trim().toUpperCase() || "SIN DESCRIPCIÓN";

// ─── Subir el extracto de un usuario ───
export function SubirExtracto({ ds, post, onListo, moneda }: {
  ds: { ds_id: string; ds_nombre: string; ds_email: string };
  post: (b: Record<string, unknown>) => Promise<unknown>; onListo: () => void; moneda: string;
}) {
  const [leido, setLeido] = useState<ExtractoLeido | null>(null);
  const [archivo, setArchivo] = useState("");
  const [msg, setMsg] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${moneda} ${fmtN(n)}`);
  const otroUsuario = leido && ((leido.ds_id && leido.ds_id !== ds.ds_id) || (leido.ds_email && ds.ds_email && leido.ds_email !== ds.ds_email.toLowerCase()));

  const leer = async (f: File) => {
    setMsg(""); setLeido(null); setArchivo(f.name);
    try { setLeido(await leerExtracto(f)); } catch (e) { setMsg(`✗ ${e instanceof Error ? e.message : "No se pudo leer el archivo"}`); }
  };
  const subir = async () => {
    if (!leido) return;
    setSubiendo(true); setMsg("");
    try {
      await post({ accion: "wallet-extracto", ds_id: ds.ds_id, ds_nombre: ds.ds_nombre, ds_email: ds.ds_email, archivo, informe_fecha: leido.informe_fecha, desde: leido.desde,
        saldo: leido.saldo, ingresos: leido.ingresos, egresos: leido.egresos, columnas: leido.columnas, movimientos: leido.movimientos });
      setMsg(`✓ Extracto cargado: saldo ${money(leido.saldo)} al ${fechaLinda(leido.informe_fecha)}`);
      setLeido(null);
      onListo();
    } catch (e) { setMsg(`✗ ${e instanceof Error ? e.message : "No se pudo guardar"}`); }
    finally { setSubiendo(false); }
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-700 p-3">
      <p className="text-[11px] t-muted mb-2">Subí el informe de wallet de <b className="t-secondary">{ds.ds_nombre}</b> (Excel o CSV de Dropi, uno por usuario).</p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { if (e.target.files?.[0]) leer(e.target.files[0]); e.target.value = ""; }} className="text-xs t-secondary" />
      {leido && (
        <div className="mt-3 space-y-1 text-xs">
          <p className="t-primary">{fmtN(leido.movimientos.length)} movimientos del {fechaLinda(leido.desde)} al {fechaLinda(leido.informe_fecha)}.</p>
          <p className="t-primary">Saldo (monto previo del último movimiento): <b>{money(leido.saldo)}</b></p>
          <p className="t-muted text-[11px]">Ingresos {money(leido.ingresos)} · egresos {money(leido.egresos)} · columnas: {Object.entries(leido.columnas).filter(([, v]) => v).map(([k, v]) => `${k} = "${v}"`).join(", ")}</p>
          {otroUsuario && <p className="text-[11px]" style={{ color: "#ef4444" }}>⚠️ El archivo parece ser de otro usuario ({leido.ds_id ?? leido.ds_email}). Revisá antes de cargarlo.</p>}
          <button onClick={subir} disabled={subiendo} className="mt-2 text-xs px-4 py-1.5 rounded-full bg-orange-500 text-white disabled:opacity-50">{subiendo ? "Guardando…" : "Cargar extracto"}</button>
        </div>
      )}
      {msg && <p className="text-[11px] mt-2" style={{ color: msg.startsWith("✓") ? "#10b981" : "#ef4444" }}>{msg}</p>}
    </div>
  );
}

// ─── Extracto guardado de un usuario ───
interface ExtractoGuardado {
  ultimo: { carga_id: number; archivo: string; cargado_el: string; cargado_por: string; informe_fecha: string | null; desde: string | null; saldo: number | null; ingresos: number; egresos: number; movimientos: Movimiento[] } | null;
  historial: { carga_id: number; informe_fecha: string | null; saldo: number | null; cargado_el: string | null }[];
}

export function ExtractoWallet({ country, dsId, moneda, version }: { country: string; dsId: string; moneda: string; version: number }) {
  const [data, setData] = useState<ExtractoGuardado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [vista, setVista] = useState<"movimientos" | "conceptos">("movimientos");
  const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${moneda} ${fmtN(n)}`);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fetch(`/api/data/cierre/wallet?country=${country}&ds_id=${encodeURIComponent(dsId)}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (vivo) setData(j.ultimo !== undefined ? j : { ultimo: null, historial: [] }); })
      .catch(() => { if (vivo) setData({ ultimo: null, historial: [] }); }).finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [country, dsId, version]);

  const movs = useMemo(() => [...(data?.ultimo?.movimientos ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)), [data]);
  const filtrados = useMemo(() => { const q = norm(buscar); return q ? movs.filter((m) => norm(m.desc).includes(q) || norm(m.tipo).includes(q)) : movs; }, [movs, buscar]);
  const conceptos = useMemo(() => {
    const m = new Map<string, { n: number; ing: number; egr: number }>();
    for (const x of movs) { const k = concepto(x.desc); const a = m.get(k) ?? { n: 0, ing: 0, egr: 0 }; a.n++; if (x.monto > 0) a.ing += x.monto; else a.egr += x.monto; m.set(k, a); }
    return [...m.entries()].map(([k, v]) => ({ concepto: k, ...v })).sort((a, b) => Math.abs(b.ing + b.egr) - Math.abs(a.ing + a.egr));
  }, [movs]);
  // Saldo a lo largo del tiempo: último monto previo de cada día
  const serie = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const x of [...movs].reverse()) if (x.previo !== null) porDia.set(x.fecha.slice(0, 10), x.previo);
    return [...porDia.entries()].map(([dia, saldo]) => ({ dia: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`, saldo }));
  }, [movs]);

  if (cargando) return <p className="text-xs t-muted">Cargando extracto…</p>;
  const u = data?.ultimo;
  if (!u) return <p className="text-xs t-muted">Todavía no se cargó el extracto de wallet de este usuario.</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg p-3" style={{ background: "rgba(16,185,129,0.08)" }}><p className="text-[10px] t-muted uppercase">Saldo actualizado</p><p className="text-lg font-bold font-mono" style={{ color: "#10b981" }}>{money(u.saldo)}</p><p className="text-[10px] t-muted">al {fechaLinda(u.informe_fecha)} (según informe)</p></div>
        <div className="rounded-lg p-3" style={{ background: "rgba(59,130,246,0.08)" }}><p className="text-[10px] t-muted uppercase">Ingresos</p><p className="text-lg font-bold font-mono" style={{ color: "#3b82f6" }}>{money(u.ingresos)}</p><p className="text-[10px] t-muted">desde {fechaLinda(u.desde)}</p></div>
        <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)" }}><p className="text-[10px] t-muted uppercase">Egresos</p><p className="text-lg font-bold font-mono" style={{ color: "#ef4444" }}>{money(u.egresos)}</p><p className="text-[10px] t-muted">{fmtN(movs.filter((m) => m.monto < 0).length)} movimientos</p></div>
        <div className="rounded-lg p-3" style={{ background: "rgba(148,163,184,0.08)" }}><p className="text-[10px] t-muted uppercase">Informe</p><p className="text-xs font-bold t-primary mt-1 truncate" title={u.archivo}>{u.archivo}</p><p className="text-[10px] t-muted">subido {new Date(u.cargado_el).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} por {u.cargado_por}</p></div>
      </div>

      {data!.historial.length > 1 && (
        <div className="text-[11px] t-muted">Informes anteriores: {data!.historial.slice(1, 6).map((h) => `${money(h.saldo)} al ${fechaLinda(h.informe_fecha)}`).join(" · ")}</div>
      )}

      {serie.length > 1 && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis dataKey="dia" fontSize={10} stroke="#888" />
            <YAxis fontSize={10} stroke="#888" tickFormatter={(v) => fmtN(Number(v))} width={70} />
            <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #10b981", fontSize: 12 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#fff" }} formatter={(v) => money(Number(v))} />
            <Line dataKey="saldo" name="Saldo" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["movimientos", "conceptos"] as const).map((k) => (
          <button key={k} onClick={() => setVista(k)} className={`text-[11px] px-3 py-1 rounded-full border ${vista === k ? "bg-orange-500 text-white border-orange-500" : "border-gray-700 t-secondary"}`}>{k === "movimientos" ? `Movimientos (${fmtN(movs.length)})` : `Por concepto (${conceptos.length})`}</button>
        ))}
        {vista === "movimientos" && <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar en la descripción…" className="text-xs px-2 py-1 rounded-lg border border-gray-700 bg-transparent t-primary w-56" />}
      </div>

      {vista === "movimientos" ? (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full min-w-[700px]">
            <thead className="sticky top-0" style={{ background: "var(--bg-card)" }}><tr className="border-b border-gray-700">
              <th className="py-2 px-2 text-[10px] uppercase t-muted text-left">Fecha y hora</th><th className="py-2 px-2 text-[10px] uppercase t-muted text-left">Descripción</th>
              <th className="py-2 px-2 text-[10px] uppercase t-muted text-right">Monto</th><th className="py-2 px-2 text-[10px] uppercase t-muted text-right">Monto previo (saldo)</th>
            </tr></thead>
            <tbody>
              {filtrados.slice(0, 1000).map((m, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-1.5 px-2 text-xs font-mono whitespace-nowrap t-secondary">{fechaLinda(m.fecha)}</td>
                  <td className="py-1.5 px-2 text-xs t-primary">{m.desc || "—"}{m.tipo ? <span className="t-muted"> · {m.tipo}</span> : null}</td>
                  <td className="py-1.5 px-2 text-xs font-mono text-right font-bold" style={{ color: m.monto >= 0 ? "#10b981" : "#ef4444" }}>{m.monto >= 0 ? "+" : ""}{money(m.monto)}</td>
                  <td className="py-1.5 px-2 text-xs font-mono text-right t-primary">{money(m.previo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > 1000 && <p className="text-[11px] t-muted mt-2">Mostrando 1.000 de {fmtN(filtrados.length)}.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-700">
              <th className="py-2 px-2 text-[10px] uppercase t-muted text-left">Concepto</th><th className="py-2 px-2 text-[10px] uppercase t-muted text-right">Movimientos</th>
              <th className="py-2 px-2 text-[10px] uppercase t-muted text-right">Ingresos</th><th className="py-2 px-2 text-[10px] uppercase t-muted text-right">Egresos</th><th className="py-2 px-2 text-[10px] uppercase t-muted text-right">Neto</th>
            </tr></thead>
            <tbody>
              {conceptos.map((c) => (
                <tr key={c.concepto} className="border-b border-gray-800/50">
                  <td className="py-1.5 px-2 text-xs t-primary">{c.concepto}</td><td className="py-1.5 px-2 text-xs font-mono text-right">{fmtN(c.n)}</td>
                  <td className="py-1.5 px-2 text-xs font-mono text-right" style={{ color: "#10b981" }}>{money(c.ing)}</td><td className="py-1.5 px-2 text-xs font-mono text-right" style={{ color: "#ef4444" }}>{money(c.egr)}</td>
                  <td className="py-1.5 px-2 text-xs font-mono text-right font-bold">{money(c.ing + c.egr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
