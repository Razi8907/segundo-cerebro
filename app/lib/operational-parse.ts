// app/lib/operational-parse.ts
// Lógica de parseo + agregación del Excel de Dropi, reutilizable desde
// server (Node) y cliente (browser). Es un MIRROR 1:1 de la lógica que vive
// hoy dentro de app/components/OperationalUpload.tsx para no divergir el
// shape de los datos guardados en la tabla operational_snapshots.
//
// Si más adelante se refactoriza OperationalUpload.tsx para importar de acá,
// borrar las funciones duplicadas del componente.

import * as XLSX from "xlsx";

export interface RawRow {
  estatus: string;
  fecha: string;
  proveedor: string;
  provId: number;
  dropshipper: string;
  dropshipperId: string;
  dropshipperEmail: string;
  dropshipperCelular: string;
  producto: string;
  productoId: string;
  cantidad: number;
  departamento: string;
  ciudad: string;
  transportadora: string;
  precioFlete: number;
}

export interface LogisticsData {
  tasa_entrega: number;
  tasa_devolucion: number;
  tasa_en_proceso: number;
  tasa_cancelado: number;
  total_entregado: number;
  total_devolucion: number;
  total_en_proceso: number;
  total_cancelado: number;
  by_transportadora: {
    nombre: string;
    total: number;
    entregado: number;
    devolucion: number;
    pctEntrega: number;
    fletePromedio: number;
  }[];
  by_departamento_flete: {
    departamento: string;
    total: number;
    fletePromedio: number;
    fleteMin: number;
    fleteMax: number;
    entregado: number;
    pctEntrega: number;
  }[];
  by_ciudad_flete: { ciudad: string; departamento: string; total: number; fletePromedio: number }[];
}

export interface AggData {
  total_orders: number;
  date_range: { from: string; to: string };
  by_status: Record<string, number>;
  by_date: { fecha: string; total: number; estados: Record<string, number> }[];
  by_proveedor: { nombre: string; id: number; total: number; estados: Record<string, number> }[];
  by_dropshipper: { nombre: string; total: number; estados: Record<string, number> }[];
  by_ds_daily: {
    ds: string;
    dsId: string;
    dsEmail: string;
    dsCelular: string;
    fecha: string;
    ordenes: number;
  }[];
  by_ds_producto: { ds: string; producto: string; ordenes: number }[];
  by_producto: {
    nombre: string;
    productoId: string;
    proveedor: string;
    cantidad: number;
    ordenes: number;
  }[];
  by_departamento: { nombre: string; total: number }[];
  logistics: LogisticsData;
}

/**
 * Parsea un buffer .xlsx/.xls/.csv a RawRow[].
 * Funciona tanto en Node (Buffer) como en el browser (ArrayBuffer).
 */
export function parseXlsxBuffer(buf: ArrayBuffer | Buffer): RawRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  if (rows.length === 0) return [];

  const header = rows[0] as string[];
  const idx = (name: string) => header.indexOf(name);
  const iE = idx("ESTATUS");
  const iF = idx("FECHA");
  const iPN = idx("PROVEEDOR NOMBRE");
  const iPID = idx("PROVEEDOR ID");
  const iDS = idx("DROPSHIPPER");
  const iDSID = idx("DROPSHIPPER ID");
  const iDSEmail = idx("EMAIL");
  const iDSCel = idx("CELULAR");
  const iPR = idx("PRODUCTO");
  const iPRID = idx("PRODUCTO ID");
  const iC = idx("CANTIDAD");
  const iD = idx("DEPARTAMENTO DESTINO");
  const iCI = idx("CIUDAD DESTINO");
  const iTR = idx("TRANSPORTADORA");
  const iFL = idx("PRECIO FLETE");

  const parsed: RawRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    parsed.push({
      estatus: String(r[iE] || "DESCONOCIDO"),
      fecha: String(r[iF] || ""),
      proveedor: String(r[iPN] || "Sin proveedor"),
      provId: Number(r[iPID]) || 0,
      dropshipper: String(r[iDS] || "Sin dropshipper"),
      dropshipperId: String(r[iDSID] || ""),
      dropshipperEmail: iDSEmail >= 0 ? String(r[iDSEmail] || "") : "",
      dropshipperCelular: iDSCel >= 0 ? String(r[iDSCel] || "") : "",
      producto: String(r[iPR] || "Sin producto"),
      productoId:
        iPRID >= 0 && r[iPRID]
          ? String(r[iPRID])
          : String(r[iPR] || "").match(/^\d+-?$/)
          ? String(r[iPR] || "").replace(/-$/, "")
          : "",
      cantidad: Number(r[iC]) || 1,
      departamento: String(r[iD] || "Sin departamento"),
      ciudad: String(r[iCI] || ""),
      transportadora: String(r[iTR] || "Sin transportadora"),
      precioFlete: Number(r[iFL]) || 0,
    });
  }
  return parsed;
}

/**
 * Agrega RawRow[] en el shape AggData que consume el dashboard.
 * Es copia fiel de la función del componente — mantener sincronizados.
 */
export function aggregateRows(rows: RawRow[]): AggData {
  const by_status: Record<string, number> = {};
  const by_date_map: Record<string, { total: number; estados: Record<string, number> }> = {};
  const by_prov_map: Record<
    string,
    { id: number; total: number; estados: Record<string, number> }
  > = {};
  const by_ds_map: Record<string, { total: number; estados: Record<string, number> }> = {};
  const by_prod_map: Record<
    string,
    { productoId: string; proveedor: string; cantidad: number; ordenes: number }
  > = {};
  const by_dept_map: Record<string, number> = {};
  const ds_daily_map: Record<
    string,
    {
      ds: string;
      dsId: string;
      dsEmail: string;
      dsCelular: string;
      fecha: string;
      ordenes: number;
    }
  > = {};
  const ds_prod_map: Record<string, { ds: string; producto: string; ordenes: number }> = {};

  for (const r of rows) {
    by_status[r.estatus] = (by_status[r.estatus] || 0) + 1;
    if (!by_date_map[r.fecha]) by_date_map[r.fecha] = { total: 0, estados: {} };
    by_date_map[r.fecha].total++;
    by_date_map[r.fecha].estados[r.estatus] = (by_date_map[r.fecha].estados[r.estatus] || 0) + 1;
    if (!by_prov_map[r.proveedor])
      by_prov_map[r.proveedor] = { id: r.provId, total: 0, estados: {} };
    by_prov_map[r.proveedor].total++;
    by_prov_map[r.proveedor].estados[r.estatus] =
      (by_prov_map[r.proveedor].estados[r.estatus] || 0) + 1;
    if (!by_ds_map[r.dropshipper]) by_ds_map[r.dropshipper] = { total: 0, estados: {} };
    by_ds_map[r.dropshipper].total++;
    by_ds_map[r.dropshipper].estados[r.estatus] =
      (by_ds_map[r.dropshipper].estados[r.estatus] || 0) + 1;
    if (!by_prod_map[r.producto])
      by_prod_map[r.producto] = {
        productoId: r.productoId || "",
        proveedor: r.proveedor || "",
        cantidad: 0,
        ordenes: 0,
      };
    if (r.productoId && !by_prod_map[r.producto].productoId)
      by_prod_map[r.producto].productoId = r.productoId;
    if (r.proveedor && !by_prod_map[r.producto].proveedor)
      by_prod_map[r.producto].proveedor = r.proveedor;
    by_prod_map[r.producto].cantidad += r.cantidad;
    by_prod_map[r.producto].ordenes++;
    by_dept_map[r.departamento] = (by_dept_map[r.departamento] || 0) + 1;

    const dsDayKey = `${r.dropshipper}||${r.fecha}`;
    if (!ds_daily_map[dsDayKey])
      ds_daily_map[dsDayKey] = {
        ds: r.dropshipper,
        dsId: r.dropshipperId || "",
        dsEmail: r.dropshipperEmail || "",
        dsCelular: r.dropshipperCelular || "",
        fecha: r.fecha,
        ordenes: 0,
      };
    ds_daily_map[dsDayKey].ordenes++;

    const dsProdKey = `${r.dropshipper}||${r.producto}`;
    if (!ds_prod_map[dsProdKey])
      ds_prod_map[dsProdKey] = { ds: r.dropshipper, producto: r.producto, ordenes: 0 };
    ds_prod_map[dsProdKey].ordenes++;
  }

  const fechas = Object.keys(by_date_map).sort();

  const ENTREGA_STATES = ["ENTREGADO"];
  const DEV_STATES = [
    "DEVOLUCION",
    "EN PROCESO DE DEVOLUCION",
    "RECHAZADO",
    "REINGRESO A BODEGA",
  ];
  const PROCESO_STATES = [
    "GUIA_GENERADA",
    "EN BODEGA ORIGEN",
    "RECOGIDO POR TRANSPORTADORA",
    "MANIFIESTO",
    "EN BODEGA DESTINO",
    "EN REPARTO",
    "SALIDA A RUTA",
    "RUTEADO PARA SU ENTREGA",
    "NOVEDAD",
    "NOVEDAD SOLUCIONADA",
    "GESTIONADO OPERATIVA",
    "PACTADO",
    "REPACTADO LISTO PARA DESPACHO",
    "MAL RUTEO",
  ];

  const total_entregado = ENTREGA_STATES.reduce((s, st) => s + (by_status[st] || 0), 0);
  const total_devolucion = DEV_STATES.reduce((s, st) => s + (by_status[st] || 0), 0);
  const total_cancelado = by_status["CANCELADO"] || 0;
  const total_en_proceso = PROCESO_STATES.reduce((s, st) => s + (by_status[st] || 0), 0);
  const nSinCancelados = rows.length - total_cancelado || 1;

  const trans_map: Record<
    string,
    { total: number; totalSinCanc: number; entregado: number; devolucion: number; fletes: number[] }
  > = {};
  const dept_flete_map: Record<
    string,
    { total: number; totalSinCanc: number; entregado: number; fletes: number[] }
  > = {};
  const city_flete_map: Record<string, { dept: string; total: number; fletes: number[] }> = {};

  for (const r of rows) {
    if (!trans_map[r.transportadora])
      trans_map[r.transportadora] = {
        total: 0,
        totalSinCanc: 0,
        entregado: 0,
        devolucion: 0,
        fletes: [],
      };
    trans_map[r.transportadora].total++;
    if (r.estatus !== "CANCELADO") trans_map[r.transportadora].totalSinCanc++;
    if (ENTREGA_STATES.includes(r.estatus)) trans_map[r.transportadora].entregado++;
    if (DEV_STATES.includes(r.estatus)) trans_map[r.transportadora].devolucion++;
    if (r.precioFlete > 0) trans_map[r.transportadora].fletes.push(r.precioFlete);

    if (!dept_flete_map[r.departamento])
      dept_flete_map[r.departamento] = {
        total: 0,
        totalSinCanc: 0,
        entregado: 0,
        fletes: [],
      };
    dept_flete_map[r.departamento].total++;
    if (r.estatus !== "CANCELADO") dept_flete_map[r.departamento].totalSinCanc++;
    if (ENTREGA_STATES.includes(r.estatus)) dept_flete_map[r.departamento].entregado++;
    if (r.precioFlete > 0) dept_flete_map[r.departamento].fletes.push(r.precioFlete);

    const cityKey = `${r.ciudad}|${r.departamento}`;
    if (!city_flete_map[cityKey])
      city_flete_map[cityKey] = { dept: r.departamento, total: 0, fletes: [] };
    city_flete_map[cityKey].total++;
    if (r.precioFlete > 0) city_flete_map[cityKey].fletes.push(r.precioFlete);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const logistics: LogisticsData = {
    tasa_entrega: (total_entregado / nSinCancelados) * 100,
    tasa_devolucion: (total_devolucion / nSinCancelados) * 100,
    tasa_en_proceso: (total_en_proceso / nSinCancelados) * 100,
    tasa_cancelado: (total_cancelado / (rows.length || 1)) * 100,
    total_entregado,
    total_devolucion,
    total_en_proceso,
    total_cancelado,
    by_transportadora: Object.entries(trans_map)
      .map(([nombre, v]) => ({
        nombre,
        total: v.total,
        entregado: v.entregado,
        devolucion: v.devolucion,
        pctEntrega: v.totalSinCanc > 0 ? (v.entregado / v.totalSinCanc) * 100 : 0,
        fletePromedio: Math.round(avg(v.fletes)),
      }))
      .sort((a, b) => b.total - a.total),
    by_departamento_flete: Object.entries(dept_flete_map)
      .map(([departamento, v]) => ({
        departamento,
        total: v.total,
        entregado: v.entregado,
        fletePromedio: Math.round(avg(v.fletes)),
        fleteMin: v.fletes.length > 0 ? Math.round(Math.min(...v.fletes)) : 0,
        fleteMax: v.fletes.length > 0 ? Math.round(Math.max(...v.fletes)) : 0,
        pctEntrega: v.totalSinCanc > 0 ? (v.entregado / v.totalSinCanc) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total),
    by_ciudad_flete: Object.entries(city_flete_map)
      .map(([key, v]) => ({
        ciudad: key.split("|")[0],
        departamento: v.dept,
        total: v.total,
        fletePromedio: Math.round(avg(v.fletes)),
      }))
      .filter((c) => c.ciudad && c.total >= 3)
      .sort((a, b) => b.total - a.total),
  };

  return {
    total_orders: rows.length,
    date_range: { from: fechas[0] || "", to: fechas[fechas.length - 1] || "" },
    by_status,
    by_date: fechas.map((f) => ({ fecha: f, ...by_date_map[f] })),
    by_proveedor: Object.entries(by_prov_map)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total),
    by_dropshipper: Object.entries(by_ds_map)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.total - a.total),
    by_ds_daily: Object.values(ds_daily_map).sort(
      (a, b) => a.fecha.localeCompare(b.fecha) || b.ordenes - a.ordenes
    ),
    by_ds_producto: Object.values(ds_prod_map).sort((a, b) => b.ordenes - a.ordenes),
    by_producto: Object.entries(by_prod_map)
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.ordenes - a.ordenes),
    by_departamento: Object.entries(by_dept_map)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total),
    logistics,
  };
}

/** Versión compacta de las filas que se envía junto con `data` (para mantener filtros del dashboard) */
export function buildCompactRows(rows: RawRow[]) {
  return rows.map((r) => ({
    e: r.estatus,
    f: r.fecha,
    p: r.proveedor,
    pi: r.provId,
    d: r.dropshipper,
    di: r.dropshipperId,
    de: r.dropshipperEmail,
    dc: r.dropshipperCelular,
    pr: r.producto,
    pri: r.productoId,
    c: r.cantidad,
    dp: r.departamento,
    ci: r.ciudad,
    t: r.transportadora,
    fl: r.precioFlete,
  }));
}
