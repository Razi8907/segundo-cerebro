"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/* ───────── types ───────── */

interface InfoGeneralRow {
  comercial_responsable: string;
  fecha_registro: string;
  id_cliente: string;
  nombre_cliente: string;
  correo: string;
  pareto: string;
  cambio_cuentas: string;
  cuenta_proveedor: string;
  tipo_cuenta: string;
  tipo_usuario: string;
  ciudad: string;
  comunidad: string;
  telefono: string;
  modalidad_venta: string;
  plataforma_tienda: string;
  lugar_pauta: string;
  automatizaciones: string;
  presupuesto_diario: string;
  nivel_educativo: string;
  mentor: string;
  observacion: string;
}

interface ParetoRow {
  id_cliente: string;
  nombre_cliente: string;
  correo: string;
  comercial_responsable: string;
  tipo_cuenta: string;
  ciudad: string;
  plataforma: string;
  presupuesto_diario: string;
  ventas_mes: string;
  ordenes_totales: string;
  productos_activos: string;
  facturacion_mensual: string;
  tendencia: string;
  roas: string;
  // manual fields
  canal_contacto: string;
  fecha_ultimo_contacto: string;
  resultado_contacto: string;
  proximo_contacto: string;
  estado: string;
  accion_requerida: string;
  responsable: string;
  prioridad: string;
  fecha_limite: string;
  observaciones: string;
}

interface CampanaRow {
  columna_1: string;
  fecha_registro: string;
  id_cliente: string;
  nombre_cliente: string;
  correo: string;
  id_producto: string;
  nombre_producto: string;
  categoria: string;
  estado_producto: string;
  stock: string;
  producto_propio: string;
  precio: string;
  promedio_diario_ordenes: string;
  gestion_privatizacion: string;
  privatizado: string;
  duracion_stock_dias: string;
  prioridad: string;
  fecha_reporte_prioridad_alta: string;
  busqueda_proveedores: string;
  estado_campana: string;
  fecha_inicio_ventas: string;
  fecha_final_ventas: string;
  dias_actividad: string;
  unidades_enero: string;
  unidades_febrero: string;
  unidades_marzo: string;
  unidades_abril: string;
  unidades_mayo: string;
  unidades_junio: string;
  unidades_julio: string;
  unidades_agosto: string;
  unidades_septiembre: string;
  unidades_octubre: string;
  unidades_noviembre: string;
  unidades_diciembre: string;
  total_unidades: string;
  observaciones: string;
  // manual field
  gasto_ads: string;
}

interface SeguimientoData {
  info_general: InfoGeneralRow[];
  pareto: ParetoRow[];
  campanas: CampanaRow[];
}

type SubTab = "resumen" | "pareto" | "campanas" | "info_general";

const ROWS_PER_PAGE = 50;

/* ───────── helpers ───────── */

function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: any): number {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/* ───────── component ───────── */

export default function SeguimientoComercial({ country }: { country: "py" | "ar" }) {
  const [subTab, setSubTab] = useState<SubTab>("resumen");
  const [data, setData] = useState<SeguimientoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Filters
  const [filterComercial, setFilterComercial] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterPrioridad, setFilterPrioridad] = useState("");

  // Pagination
  const [pagePareto, setPagePareto] = useState(0);
  const [pageCampanas, setPageCampanas] = useState(0);
  const [pageInfo, setPageInfo] = useState(0);

  // Dashboard data (dropshippers with full metrics) + operational data
  const [dashData, setDashData] = useState<any>(null);
  const [opsData, setOpsData] = useState<any>(null);

  /* ───── load data ───── */
  const loadData = useCallback(async () => {
    try {
      const [segRes, dashRes, opsRes] = await Promise.all([
        fetch(`/api/data/seguimiento-comercial?country=${country}`, { credentials: "include" }),
        fetch(`/api/data/${country}`, { credentials: "include" }),
        fetch(`/api/data/operational?country=${country}`, { credentials: "include" }).catch(() => null),
      ]);
      const segJson = await segRes.json();
      if (segJson.data) setData(segJson.data);
      const dashJson = await dashRes.json();
      setDashData(dashJson);
      if (opsRes) {
        const opsJson = await opsRes.json();
        if (opsJson.data) setOpsData(opsJson.data);
      }
    } catch (err) {
      console.error("Error loading seguimiento data:", err);
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { loadData(); }, [loadData]);

  // AUTO-GENERATE Pareto from Análisis Operacional (top 80% dropshippers)
  // Source: by_dropshipper + by_ds_daily + by_ds_producto from /api/data/operational
  const enrichedPareto = useMemo((): ParetoRow[] => {
    if (!opsData?.by_dropshipper?.length) return data?.pareto || [];

    // Saved manual edits (from DB) keyed by DS name (lowercase)
    const savedManual = new Map<string, Partial<ParetoRow>>();
    if (data?.pareto) {
      for (const p of data.pareto) {
        const key = (p.nombre_cliente || p.correo || "").toLowerCase().trim();
        if (key) savedManual.set(key, p);
      }
    }

    // 1. Calculate Pareto: top DS that make 80% of orders
    const sorted = [...opsData.by_dropshipper].sort((a: any, b: any) => b.total - a.total);
    const totalOrdenes = sorted.reduce((s: number, d: any) => s + d.total, 0);
    let acum = 0;
    const paretoDS: any[] = [];
    for (const ds of sorted) {
      if (paretoDS.length > 0 && acum >= totalOrdenes * 0.8) break;
      acum += ds.total;
      paretoDS.push(ds);
    }
    if (paretoDS.length === 0 && sorted.length > 0) paretoDS.push(sorted[0]);

    // 2. Build lookup from by_ds_daily (has email, celular, dsId)
    const dsInfoMap = new Map<string, { dsId: string; dsEmail: string; dsCelular: string; dailyOrders: number[] }>();
    if (opsData.by_ds_daily) {
      for (const d of opsData.by_ds_daily) {
        const key = d.ds?.toLowerCase().trim();
        if (!dsInfoMap.has(key)) dsInfoMap.set(key, { dsId: d.dsId || "", dsEmail: d.dsEmail || "", dsCelular: d.dsCelular || "", dailyOrders: [] });
        const info = dsInfoMap.get(key)!;
        if (!info.dsId && d.dsId) info.dsId = d.dsId;
        if (!info.dsEmail && d.dsEmail) info.dsEmail = d.dsEmail;
        if (!info.dsCelular && d.dsCelular) info.dsCelular = d.dsCelular;
        info.dailyOrders.push(d.ordenes);
      }
    }

    // 3. Products per DS
    const dsProductCount = new Map<string, number>();
    if (opsData.by_ds_producto) {
      for (const dp of opsData.by_ds_producto) {
        const key = dp.ds?.toLowerCase().trim();
        dsProductCount.set(key, (dsProductCount.get(key) || 0) + 1);
      }
    }

    // 4. Generate Pareto rows
    return paretoDS.map((ds: any): ParetoRow => {
      const nameKey = (ds.nombre || "").toLowerCase().trim();
      const dsInfo = dsInfoMap.get(nameKey);
      const saved = savedManual.get(nameKey) || savedManual.get(dsInfo?.dsEmail?.toLowerCase().trim() || "");

      const totalOrds = ds.total || 0;
      const entregados = ds.estados?.["ENTREGADO"] || 0;
      const cancelados = ds.estados?.["CANCELADO"] || 0;
      const devoluciones = (ds.estados?.["DEVOLUCION"] || 0) + (ds.estados?.["EN PROCESO DE DEVOLUCION"] || 0);
      const sinCancelados = totalOrds - cancelados;
      const pctEntrega = sinCancelados > 0 ? (entregados / sinCancelados * 100) : 0;
      const productos = dsProductCount.get(nameKey) || 0;

      let tendencia = "";
      if (pctEntrega >= 60) tendencia = "📈 Positiva";
      else if (pctEntrega >= 40) tendencia = "➡️ Estable";
      else if (totalOrds > 0) tendencia = "📉 Negativa";

      return {
        id_cliente: saved?.id_cliente || dsInfo?.dsId || "",
        nombre_cliente: ds.nombre || "",
        correo: saved?.correo || dsInfo?.dsEmail || "",
        comercial_responsable: saved?.comercial_responsable || "",
        tipo_cuenta: saved?.tipo_cuenta || "",
        ciudad: saved?.ciudad || "",
        plataforma: saved?.plataforma || "",
        presupuesto_diario: saved?.presupuesto_diario || "",
        // Auto-filled from Análisis Operacional
        ventas_mes: String(entregados),
        ordenes_totales: String(totalOrds),
        productos_activos: String(productos),
        facturacion_mensual: `${pctEntrega.toFixed(1)}% entrega`,
        tendencia,
        // Manual fields — restored from saved data
        roas: saved?.roas || "",
        canal_contacto: saved?.canal_contacto || "",
        fecha_ultimo_contacto: saved?.fecha_ultimo_contacto || "",
        resultado_contacto: saved?.resultado_contacto || "",
        proximo_contacto: saved?.proximo_contacto || "",
        estado: saved?.estado || "",
        accion_requerida: saved?.accion_requerida || "",
        responsable: saved?.responsable || "",
        prioridad: saved?.prioridad || "",
        fecha_limite: saved?.fecha_limite || "",
        observaciones: saved?.observaciones || "",
      };
    });
  }, [opsData, data?.pareto]);

  /* ───── show banner ───── */
  const showBanner = useCallback((type: "success" | "error", msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), 4000);
  }, []);

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

        // Parse Info General (row 1 = headers, row 2+ = data)
        const wsIG = wb.Sheets["Información General"];
        const infoGeneral: InfoGeneralRow[] = [];
        if (wsIG) {
          const rows = XLSX.utils.sheet_to_json(wsIG, { header: 1 }) as any[][];
          const header = (rows[0] || []) as string[];
          const idx = (name: string) => header.findIndex((h) => safeStr(h).toLowerCase().includes(name.toLowerCase()));
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.length) continue;
            infoGeneral.push({
              comercial_responsable: safeStr(r[idx("Comercial Responsable")]),
              fecha_registro: safeStr(r[idx("Fecha de Registro")]),
              id_cliente: safeStr(r[idx("ID Cliente")]),
              nombre_cliente: safeStr(r[idx("Nombre de cliente")]),
              correo: safeStr(r[idx("Correo")]),
              pareto: safeStr(r[idx("Pareto")]),
              cambio_cuentas: safeStr(r[idx("Cambio de cuentas")]),
              cuenta_proveedor: safeStr(r[idx("Cuenta de proveedor")]),
              tipo_cuenta: safeStr(r[idx("Tipo de cuenta")]),
              tipo_usuario: safeStr(r[idx("Tipo de usuario")]),
              ciudad: safeStr(r[idx("Ciudad")]),
              comunidad: safeStr(r[idx("Comunidad")]),
              telefono: safeStr(r[idx("Teléfono") >= 0 ? idx("Teléfono") : idx("Telefono")]),
              modalidad_venta: safeStr(r[idx("Modalidad de venta")]),
              plataforma_tienda: safeStr(r[idx("Plataforma de tienda")]),
              lugar_pauta: safeStr(r[idx("Lugar de pauta")]),
              automatizaciones: safeStr(r[idx("Automatizaciones")]),
              presupuesto_diario: safeStr(r[idx("Presupuesto")]),
              nivel_educativo: safeStr(r[idx("Nivel")]),
              mentor: safeStr(r[idx("Mentor")]),
              observacion: safeStr(r[idx("Observación") >= 0 ? idx("Observación") : idx("Observacion")]),
            });
          }
        }

        // Parse Seguimiento Pareto (row 6 = headers, row 7+ = data)
        const wsP = wb.Sheets["Seguimiento Pareto"];
        const pareto: ParetoRow[] = [];
        if (wsP) {
          const rows = XLSX.utils.sheet_to_json(wsP, { header: 1 }) as any[][];
          const header = (rows[5] || []) as string[];
          const idx = (name: string) => header.findIndex((h) => safeStr(h).toLowerCase().includes(name.toLowerCase()));
          for (let i = 6; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.length) continue;
            pareto.push({
              id_cliente: safeStr(r[idx("ID Cliente")]),
              nombre_cliente: safeStr(r[idx("Nombre")]),
              correo: safeStr(r[idx("Correo")]),
              comercial_responsable: safeStr(r[idx("Comercial")]),
              tipo_cuenta: safeStr(r[idx("Tipo de Cuenta")]),
              ciudad: safeStr(r[idx("Ciudad")]),
              plataforma: safeStr(r[idx("Plataforma")]),
              presupuesto_diario: safeStr(r[idx("Presupuesto")]),
              ventas_mes: safeStr(r[idx("Ventas Mes")]),
              ordenes_totales: safeStr(r[idx("Órdenes Totales") >= 0 ? idx("Órdenes Totales") : idx("Ordenes Totales")]),
              productos_activos: safeStr(r[idx("Productos Activos")]),
              facturacion_mensual: safeStr(r[idx("Facturación") >= 0 ? idx("Facturación") : idx("Facturacion")]),
              tendencia: safeStr(r[idx("Tendencia")]),
              roas: safeStr(r[idx("ROAS")]),
              canal_contacto: safeStr(r[idx("Canal Contacto")]),
              fecha_ultimo_contacto: safeStr(r[idx("Fecha Último Contacto") >= 0 ? idx("Fecha Último Contacto") : idx("Ultimo Contacto")]),
              resultado_contacto: safeStr(r[idx("Resultado")]),
              proximo_contacto: safeStr(r[idx("Próximo") >= 0 ? idx("Próximo") : idx("Proximo")]),
              estado: safeStr(r[idx("Estado")]),
              accion_requerida: safeStr(r[idx("Acción Requerida") >= 0 ? idx("Acción Requerida") : idx("Accion Requerida")]),
              responsable: safeStr(r[idx("Responsable")]),
              prioridad: safeStr(r[idx("Prioridad")]),
              fecha_limite: safeStr(r[idx("Fecha Límite") >= 0 ? idx("Fecha Límite") : idx("Fecha Limite")]),
              observaciones: safeStr(r[idx("Observaciones")]),
            });
          }
        }

        // Parse Cuidado de Campañas (row 1 = headers, row 2+ = data)
        const wsC = wb.Sheets["Cuidado de Campañas"] || wb.Sheets["Cuidado de Campanas"];
        const campanas: CampanaRow[] = [];
        if (wsC) {
          const rows = XLSX.utils.sheet_to_json(wsC, { header: 1 }) as any[][];
          const header = (rows[0] || []) as string[];
          const idx = (name: string) => header.findIndex((h) => safeStr(h).toLowerCase().includes(name.toLowerCase()));
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r.length) continue;
            campanas.push({
              columna_1: safeStr(r[idx("Columna 1") >= 0 ? idx("Columna 1") : idx("columna")]),
              fecha_registro: safeStr(r[idx("Fecha de Registro")]),
              id_cliente: safeStr(r[idx("ID de cliente")]),
              nombre_cliente: safeStr(r[idx("Nombre de cliente")]),
              correo: safeStr(r[idx("Correo")]),
              id_producto: safeStr(r[idx("ID de Producto")]),
              nombre_producto: safeStr(r[idx("Nombre del Producto")]),
              categoria: safeStr(r[idx("Categoria")]),
              estado_producto: safeStr(r[idx("Estado de Producto")]),
              stock: safeStr(r[idx("Stock")]),
              producto_propio: safeStr(r[idx("Producto propio")]),
              precio: safeStr(r[idx("Precio")]),
              promedio_diario_ordenes: safeStr(r[idx("Promedio diario")]),
              gestion_privatizacion: safeStr(r[idx("Gestión de privatización") >= 0 ? idx("Gestión de privatización") : idx("Gestion de privatizacion")]),
              privatizado: safeStr(r[idx("Privatizado")]),
              duracion_stock_dias: safeStr(r[idx("Duración con stock") >= 0 ? idx("Duración con stock") : idx("Duracion con stock")]),
              prioridad: safeStr(r[idx("Prioridad")]),
              fecha_reporte_prioridad_alta: safeStr(r[idx("Fecha de reporte")]),
              busqueda_proveedores: safeStr(r[idx("Busqueda")]),
              estado_campana: safeStr(r[idx("Estado de la Campaña") >= 0 ? idx("Estado de la Campaña") : idx("Estado de la Campana")]),
              fecha_inicio_ventas: safeStr(r[idx("Fecha Inicio")]),
              fecha_final_ventas: safeStr(r[idx("Fecha Final")]),
              dias_actividad: safeStr(r[idx("Dias de Actividad")]),
              unidades_enero: safeStr(r[idx("Enero")]),
              unidades_febrero: safeStr(r[idx("Febrero")]),
              unidades_marzo: safeStr(r[idx("Marzo")]),
              unidades_abril: safeStr(r[idx("Abril")]),
              unidades_mayo: safeStr(r[idx("Mayo")]),
              unidades_junio: safeStr(r[idx("Junio")]),
              unidades_julio: safeStr(r[idx("Julio")]),
              unidades_agosto: safeStr(r[idx("Agosto")]),
              unidades_septiembre: safeStr(r[idx("Septiembre")]),
              unidades_octubre: safeStr(r[idx("Octubre")]),
              unidades_noviembre: safeStr(r[idx("Noviembre")]),
              unidades_diciembre: safeStr(r[idx("Diciembre")]),
              total_unidades: safeStr(r[idx("Total Unidades")]),
              observaciones: safeStr(r[idx("Observaciones")]),
              gasto_ads: "",
            });
          }
        }

        // Merge with existing manual data if any
        const newData: SeguimientoData = { info_general: infoGeneral, pareto, campanas };

        if (data) {
          // Preserve manual edits for pareto rows by matching id_cliente
          const oldParetoMap = new Map(data.pareto.map((p) => [p.id_cliente, p]));
          newData.pareto = newData.pareto.map((p) => {
            const old = oldParetoMap.get(p.id_cliente);
            if (old) {
              return {
                ...p,
                canal_contacto: p.canal_contacto || old.canal_contacto,
                fecha_ultimo_contacto: p.fecha_ultimo_contacto || old.fecha_ultimo_contacto,
                resultado_contacto: p.resultado_contacto || old.resultado_contacto,
                proximo_contacto: p.proximo_contacto || old.proximo_contacto,
                estado: p.estado || old.estado,
                accion_requerida: p.accion_requerida || old.accion_requerida,
                responsable: p.responsable || old.responsable,
                prioridad: p.prioridad || old.prioridad,
                fecha_limite: p.fecha_limite || old.fecha_limite,
                observaciones: p.observaciones || old.observaciones,
              };
            }
            return p;
          });
          // Preserve gasto_ads for campanas by matching id_producto + id_cliente
          const oldCampMap = new Map(data.campanas.map((c) => [`${c.id_cliente}_${c.id_producto}`, c]));
          newData.campanas = newData.campanas.map((c) => {
            const old = oldCampMap.get(`${c.id_cliente}_${c.id_producto}`);
            if (old) return { ...c, gasto_ads: old.gasto_ads };
            return c;
          });
        }

        // Save to API
        const res = await fetch("/api/data/seguimiento-comercial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ country, data: newData }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        setData(newData);
        showBanner("success", `Archivo cargado: ${infoGeneral.length} usuarios, ${pareto.length} pareto, ${campanas.length} campañas`);
      } catch (err: any) {
        console.error("Upload error:", err);
        showBanner("error", `Error al cargar: ${err?.message || err}`);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    };
    reader.onerror = () => { setUploading(false); showBanner("error", "Error leyendo archivo"); };
    reader.readAsArrayBuffer(file);
  }, [country, data, showBanner]);

  /* ───── inline edit ───── */
  const saveField = useCallback(async (sheet: string, rowIndex: number, field: string, value: string) => {
    if (!data) return;
    // Optimistic update
    const updated = { ...data };
    const arr = [...(updated as any)[sheet]];
    arr[rowIndex] = { ...arr[rowIndex], [field]: value };
    (updated as any)[sheet] = arr;
    setData(updated);

    try {
      const res = await fetch("/api/data/seguimiento-comercial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ country, sheet, rowIndex, field, value }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
    } catch (err: any) {
      showBanner("error", `Error guardando: ${err?.message || err}`);
    }
  }, [country, data, showBanner]);

  /* ───── KPI calculations ───── */
  const kpis = useMemo(() => {
    const pareto = enrichedPareto;
    const totalUsuarios = (data?.info_general || []).length;
    const paretoCount = pareto.length;
    const activos = pareto.filter((p) => safeStr(p.estado).toLowerCase().includes("activo")).length;
    const enRiesgo = pareto.filter((p) => safeStr(p.estado).toLowerCase().includes("riesgo")).length;
    const pendientes = pareto.filter((p) => safeStr(p.estado).toLowerCase().includes("pendiente")).length;

    const today = new Date();
    const sinContacto7 = pareto.filter((p) => {
      if (!p.fecha_ultimo_contacto) return true;
      try {
        const d = new Date(p.fecha_ultimo_contacto);
        return (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) > 7;
      } catch { return true; }
    }).length;

    const campanasActivas = (data?.campanas || []).filter((c) =>
      safeStr(c.estado_campana).toLowerCase().includes("activ")
    ).length;

    const roasValues = pareto.map((p) => safeNum(p.roas)).filter((r) => r > 0);
    const roasPromedio = roasValues.length > 0
      ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length
      : 0;

    // Auto-filled metrics summary
    const totalOrdenes = pareto.reduce((s, p) => s + safeNum(p.ordenes_totales), 0);
    const totalVentas = pareto.reduce((s, p) => s + safeNum(p.ventas_mes), 0);

    return { totalUsuarios, paretoCount, activos, enRiesgo, pendientes, sinContacto7, campanasActivas, roasPromedio, totalOrdenes, totalVentas };
  }, [data, enrichedPareto]);

  /* ───── filtered pareto ───── */
  const filteredPareto = useMemo(() => {
    if (!enrichedPareto.length) return [];
    let rows = enrichedPareto;
    if (filterComercial) rows = rows.filter((p) => p.comercial_responsable.toLowerCase().includes(filterComercial.toLowerCase()));
    if (filterEstado) rows = rows.filter((p) => p.estado.toLowerCase().includes(filterEstado.toLowerCase()));
    if (filterPrioridad) rows = rows.filter((p) => p.prioridad.toLowerCase().includes(filterPrioridad.toLowerCase()));
    return rows;
  }, [enrichedPareto, filterComercial, filterEstado, filterPrioridad]);

  /* ───── unique values for filters ───── */
  const uniqueComerciales = useMemo(() => {
    return Array.from(new Set(enrichedPareto.map((p) => p.comercial_responsable).filter(Boolean))).sort();
  }, [enrichedPareto]);

  const uniqueEstados = useMemo(() => {
    return Array.from(new Set(enrichedPareto.map((p) => p.estado).filter(Boolean))).sort();
  }, [enrichedPareto]);

  const uniquePrioridades = useMemo(() => {
    return Array.from(new Set(enrichedPareto.map((p) => p.prioridad).filter(Boolean))).sort();
  }, [enrichedPareto]);

  /* ───── editable cell ───── */
  const EditableCell = ({ value, sheet, rowIndex, field, type = "text" }: {
    value: string; sheet: string; rowIndex: number; field: string; type?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value);

    useEffect(() => { setVal(value); }, [value]);

    if (!editing) {
      return (
        <span
          className="cursor-pointer hover:bg-orange-500/10 px-1 py-0.5 rounded min-w-[60px] inline-block"
          onClick={() => setEditing(true)}
          title="Click para editar"
        >
          {value || <span className="t-muted text-[10px]">--</span>}
        </span>
      );
    }

    return (
      <input
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { setEditing(false); if (val !== value) saveField(sheet, rowIndex, field, val); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (val !== value) saveField(sheet, rowIndex, field, val); } }}
        autoFocus
        className="text-xs px-1 py-0.5 rounded border border-orange-500/40 outline-none t-primary w-full"
        style={{ background: "var(--bg-input)", minWidth: "80px" }}
      />
    );
  };

  /* ───── pagination helper ───── */
  const Pagination = ({ page, setPage, total }: { page: number; setPage: (p: number) => void; total: number }) => {
    const totalPages = Math.ceil(total / ROWS_PER_PAGE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-700 t-secondary hover:border-orange-500/40 disabled:opacity-30">
          Anterior
        </button>
        <span className="text-xs t-muted">{page + 1} / {totalPages}</span>
        <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-700 t-secondary hover:border-orange-500/40 disabled:opacity-30">
          Siguiente
        </button>
      </div>
    );
  };

  /* ───────── render ───────── */

  if (loading) {
    return (
      <div className="glass-card p-8 text-center border border-orange-500/20">
        <div className="animate-pulse t-muted">Cargando seguimiento comercial...</div>
      </div>
    );
  }

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "pareto", label: "Seguimiento Pareto" },
    { key: "campanas", label: "Campañas" },
    { key: "info_general", label: "Info General" },
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
            <h2 className="text-lg font-bold t-primary">Seguimiento Comercial</h2>
            <p className="text-xs t-muted">Gestión de cartera, seguimiento pareto y cuidado de campañas</p>
          </div>
          <label className={`text-xs px-4 py-2 rounded-full border cursor-pointer transition-all ${
            uploading
              ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
              : "bg-transparent t-secondary border-gray-700 hover:border-orange-500/40 hover:text-orange-300"
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
                  : "border-transparent t-muted hover:text-orange-400 hover:border-orange-500/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── RESUMEN ─── */}
      {subTab === "resumen" && kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Total Usuarios", value: kpis.totalUsuarios.toLocaleString(), icon: "👥", borderColor: "border-orange-500/30", textColor: "text-orange-400", subtitle: "Cartera completa" },
            { title: "Usuarios Pareto", value: kpis.paretoCount.toLocaleString(), icon: "⭐", borderColor: "border-yellow-500/30", textColor: "text-yellow-400", subtitle: `${((kpis.paretoCount / Math.max(kpis.totalUsuarios, 1)) * 100).toFixed(1)}% del total` },
            { title: "Activos", value: kpis.activos.toLocaleString(), icon: "✅", borderColor: "border-green-500/30", textColor: "text-green-400", subtitle: "Con estado activo" },
            { title: "En Riesgo", value: kpis.enRiesgo.toLocaleString(), icon: "⚠️", borderColor: "border-red-500/30", textColor: "text-red-400", subtitle: "Requieren atención" },
            { title: "Pendientes", value: kpis.pendientes.toLocaleString(), icon: "🕐", borderColor: "border-blue-500/30", textColor: "text-blue-400", subtitle: "Sin resolución" },
            { title: "Sin Contacto +7d", value: kpis.sinContacto7.toLocaleString(), icon: "📵", borderColor: "border-purple-500/30", textColor: "text-purple-400", subtitle: "Último contacto hace +7 días" },
            { title: "Campañas Activas", value: kpis.campanasActivas.toLocaleString(), icon: "📢", borderColor: "border-cyan-500/30", textColor: "text-cyan-400", subtitle: "En ejecución" },
            { title: "ROAS Promedio", value: kpis.roasPromedio.toFixed(2), icon: "📈", borderColor: "border-emerald-500/30", textColor: "text-emerald-400", subtitle: "Retorno sobre ads" },
          ].map((card) => (
            <div
              key={card.title}
              className={`relative overflow-hidden rounded-2xl border ${card.borderColor} p-5 transition-all hover:scale-[1.02]`}
              style={{ background: "var(--bg-card)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{card.title}</p>
                  <p className={`text-3xl font-bold mt-2 ${card.textColor}`}>{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
                </div>
                <span className="text-2xl">{card.icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── SEGUIMIENTO PARETO ─── */}
      {data && subTab === "pareto" && (
        <div className="glass-card p-4 border border-orange-500/20 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select value={filterComercial} onChange={(e) => { setFilterComercial(e.target.value); setPagePareto(0); }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 t-secondary hover:border-orange-500/40"
              style={{ background: "var(--bg-input)" }}>
              <option value="">Todos los comerciales</option>
              {uniqueComerciales.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterEstado} onChange={(e) => { setFilterEstado(e.target.value); setPagePareto(0); }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 t-secondary hover:border-orange-500/40"
              style={{ background: "var(--bg-input)" }}>
              <option value="">Todos los estados</option>
              {uniqueEstados.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filterPrioridad} onChange={(e) => { setFilterPrioridad(e.target.value); setPagePareto(0); }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 t-secondary hover:border-orange-500/40"
              style={{ background: "var(--bg-input)" }}>
              <option value="">Todas las prioridades</option>
              {uniquePrioridades.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="text-xs t-muted self-center ml-2">{filteredPareto.length} registros</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400">ID</th>
                  <th className="text-left py-2 px-2 text-gray-400">Cliente</th>
                  <th className="text-left py-2 px-2 text-gray-400">Comercial</th>
                  <th className="text-right py-2 px-2 text-gray-400">Ventas</th>
                  <th className="text-right py-2 px-2 text-gray-400">Órdenes</th>
                  <th className="text-right py-2 px-2 text-gray-400">Facturación</th>
                  <th className="text-right py-2 px-2 text-gray-400">ROAS</th>
                  <th className="text-left py-2 px-2 text-gray-400">Canal</th>
                  <th className="text-left py-2 px-2 text-gray-400">Últ. Contacto</th>
                  <th className="text-left py-2 px-2 text-gray-400">Resultado</th>
                  <th className="text-left py-2 px-2 text-gray-400">Próx. Contacto</th>
                  <th className="text-left py-2 px-2 text-gray-400">Estado</th>
                  <th className="text-left py-2 px-2 text-gray-400">Acción</th>
                  <th className="text-left py-2 px-2 text-gray-400">Resp.</th>
                  <th className="text-left py-2 px-2 text-gray-400">Prioridad</th>
                  <th className="text-left py-2 px-2 text-gray-400">Fecha Lím.</th>
                  <th className="text-left py-2 px-2 text-gray-400">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {filteredPareto.slice(pagePareto * ROWS_PER_PAGE, (pagePareto + 1) * ROWS_PER_PAGE).map((p, i) => {
                  const realIdx = enrichedPareto.indexOf(p);
                  return (
                    <tr key={`${p.id_cliente}-${i}`} className="border-b border-gray-800 hover:bg-orange-500/5">
                      <td className="py-2 px-2 t-muted">{p.id_cliente}</td>
                      <td className="py-2 px-2 t-primary font-medium max-w-[120px] truncate" title={p.nombre_cliente}>{p.nombre_cliente}</td>
                      <td className="py-2 px-2 t-secondary max-w-[100px] truncate">{p.comercial_responsable}</td>
                      <td className="py-2 px-2 text-right t-secondary">{p.ventas_mes}</td>
                      <td className="py-2 px-2 text-right t-secondary">{p.ordenes_totales}</td>
                      <td className="py-2 px-2 text-right t-secondary">{p.facturacion_mensual}</td>
                      <td className="py-2 px-2 text-right t-secondary">{p.roas}</td>
                      <td className="py-2 px-2"><EditableCell value={p.canal_contacto} sheet="pareto" rowIndex={realIdx} field="canal_contacto" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.fecha_ultimo_contacto} sheet="pareto" rowIndex={realIdx} field="fecha_ultimo_contacto" type="date" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.resultado_contacto} sheet="pareto" rowIndex={realIdx} field="resultado_contacto" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.proximo_contacto} sheet="pareto" rowIndex={realIdx} field="proximo_contacto" type="date" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.estado} sheet="pareto" rowIndex={realIdx} field="estado" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.accion_requerida} sheet="pareto" rowIndex={realIdx} field="accion_requerida" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.responsable} sheet="pareto" rowIndex={realIdx} field="responsable" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.prioridad} sheet="pareto" rowIndex={realIdx} field="prioridad" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.fecha_limite} sheet="pareto" rowIndex={realIdx} field="fecha_limite" type="date" /></td>
                      <td className="py-2 px-2"><EditableCell value={p.observaciones} sheet="pareto" rowIndex={realIdx} field="observaciones" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={pagePareto} setPage={setPagePareto} total={filteredPareto.length} />
        </div>
      )}

      {/* ─── CAMPAÑAS ─── */}
      {subTab === "campanas" && (
        <div className="glass-card p-4 border border-orange-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold t-primary">Cuidado de Campañas</h3>
              <span className="text-xs t-muted">{(data?.campanas || []).length} campañas</span>
            </div>
            <button
              onClick={() => {
                const empty: CampanaRow = {
                  columna_1: "", fecha_registro: new Date().toISOString().split("T")[0], id_cliente: "", nombre_cliente: "", correo: "",
                  id_producto: "", nombre_producto: "", categoria: "", estado_producto: "", stock: "", producto_propio: "",
                  precio: "", promedio_diario_ordenes: "", gestion_privatizacion: "", privatizado: "", duracion_stock_dias: "",
                  prioridad: "", fecha_reporte_prioridad_alta: "", busqueda_proveedores: "", estado_campana: "Activa",
                  fecha_inicio_ventas: "", fecha_final_ventas: "", dias_actividad: "",
                  unidades_enero: "", unidades_febrero: "", unidades_marzo: "", unidades_abril: "",
                  unidades_mayo: "", unidades_junio: "", unidades_julio: "", unidades_agosto: "",
                  unidades_septiembre: "", unidades_octubre: "", unidades_noviembre: "", unidades_diciembre: "",
                  total_unidades: "", observaciones: "", gasto_ads: "",
                };
                const newData = { ...(data || { info_general: [], pareto: [], campanas: [] }) };
                newData.campanas = [empty, ...newData.campanas];
                setData(newData);
                // Save
                fetch(`/api/data/seguimiento-comercial`, {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ country, data: newData }),
                }).catch(() => {});
                showBanner("success", "Fila agregada. Editá los campos haciendo click en cada celda.");
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white font-medium hover:bg-green-500"
            >
              + Agregar campaña
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400">Cliente</th>
                  <th className="text-left py-2 px-2 text-gray-400">Producto</th>
                  <th className="text-left py-2 px-2 text-gray-400">Categoría</th>
                  <th className="text-left py-2 px-2 text-gray-400">Estado</th>
                  <th className="text-right py-2 px-2 text-gray-400">Stock</th>
                  <th className="text-right py-2 px-2 text-gray-400">Precio</th>
                  <th className="text-right py-2 px-2 text-gray-400">Prom. Ord/día</th>
                  <th className="text-left py-2 px-2 text-gray-400">Prioridad</th>
                  <th className="text-left py-2 px-2 text-gray-400">Est. Campaña</th>
                  <th className="text-right py-2 px-2 text-gray-400">Días Act.</th>
                  <th className="text-right py-2 px-2 text-gray-400">Total Uds.</th>
                  <th className="text-right py-2 px-2 text-gray-400">Gasto Ads</th>
                  <th className="text-right py-2 px-2 text-gray-400">ROAS</th>
                  <th className="text-left py-2 px-2 text-gray-400">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {(data?.campanas || []).slice(pageCampanas * ROWS_PER_PAGE, (pageCampanas + 1) * ROWS_PER_PAGE).map((c, i) => {
                  const realIdx = pageCampanas * ROWS_PER_PAGE + i;
                  const facturacion = safeNum(c.precio) * safeNum(c.total_unidades);
                  const gastoAds = safeNum(c.gasto_ads);
                  const roas = gastoAds > 0 ? (facturacion / gastoAds).toFixed(2) : "--";
                  return (
                    <tr key={`${c.id_producto}-${i}`} className="border-b border-gray-800 hover:bg-orange-500/5">
                      <td className="py-2 px-2"><EditableCell value={c.nombre_cliente} sheet="campanas" rowIndex={realIdx} field="nombre_cliente" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.nombre_producto} sheet="campanas" rowIndex={realIdx} field="nombre_producto" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.categoria} sheet="campanas" rowIndex={realIdx} field="categoria" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.estado_producto} sheet="campanas" rowIndex={realIdx} field="estado_producto" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.stock} sheet="campanas" rowIndex={realIdx} field="stock" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.precio} sheet="campanas" rowIndex={realIdx} field="precio" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.promedio_diario_ordenes} sheet="campanas" rowIndex={realIdx} field="promedio_diario_ordenes" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.prioridad} sheet="campanas" rowIndex={realIdx} field="prioridad" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.estado_campana} sheet="campanas" rowIndex={realIdx} field="estado_campana" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.dias_actividad} sheet="campanas" rowIndex={realIdx} field="dias_actividad" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.total_unidades} sheet="campanas" rowIndex={realIdx} field="total_unidades" /></td>
                      <td className="py-2 px-2"><EditableCell value={c.gasto_ads} sheet="campanas" rowIndex={realIdx} field="gasto_ads" type="number" /></td>
                      <td className="py-2 px-2 text-right font-medium" style={{ color: roas !== "--" && parseFloat(roas) >= 2 ? "#16a34a" : roas !== "--" ? "#ea580c" : undefined }}>
                        {roas}
                      </td>
                      <td className="py-2 px-2"><EditableCell value={c.observaciones} sheet="campanas" rowIndex={realIdx} field="observaciones" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={pageCampanas} setPage={setPageCampanas} total={(data?.campanas || []).length} />
        </div>
      )}

      {/* ─── INFO GENERAL ─── */}
      {subTab === "info_general" && (
        <div className="glass-card p-4 border border-orange-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold t-primary">Información General</h3>
              <span className="text-xs t-muted">{(data?.info_general || []).length} usuarios</span>
            </div>
            <button
              onClick={() => {
                const empty: InfoGeneralRow = {
                  comercial_responsable: "", fecha_registro: new Date().toISOString().split("T")[0],
                  id_cliente: "", nombre_cliente: "", correo: "", pareto: "", cambio_cuentas: "",
                  cuenta_proveedor: "", tipo_cuenta: "", tipo_usuario: "Dropshipper", ciudad: "",
                  comunidad: "", telefono: "", modalidad_venta: "", plataforma_tienda: "",
                  lugar_pauta: "", automatizaciones: "", presupuesto_diario: "",
                  nivel_educativo: "", mentor: "", observacion: "",
                };
                const newData = { ...(data || { info_general: [], pareto: [], campanas: [] }) };
                newData.info_general = [empty, ...newData.info_general];
                setData(newData);
                fetch(`/api/data/seguimiento-comercial`, {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ country, data: newData }),
                }).catch(() => {});
                showBanner("success", "Usuario agregado. Editá los campos haciendo click en cada celda.");
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white font-medium hover:bg-green-500"
            >
              + Agregar usuario
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "rgba(22,33,62,0.98)" }}>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400">ID</th>
                  <th className="text-left py-2 px-2 text-gray-400">Cliente</th>
                  <th className="text-left py-2 px-2 text-gray-400">Correo</th>
                  <th className="text-left py-2 px-2 text-gray-400">Comercial</th>
                  <th className="text-left py-2 px-2 text-gray-400">Pareto</th>
                  <th className="text-left py-2 px-2 text-gray-400">Tipo Cuenta</th>
                  <th className="text-left py-2 px-2 text-gray-400">Tipo Usuario</th>
                  <th className="text-left py-2 px-2 text-gray-400">Ciudad</th>
                  <th className="text-left py-2 px-2 text-gray-400">Modalidad</th>
                  <th className="text-left py-2 px-2 text-gray-400">Plataforma</th>
                  <th className="text-left py-2 px-2 text-gray-400">Presupuesto</th>
                  <th className="text-left py-2 px-2 text-gray-400">Mentor</th>
                  <th className="text-left py-2 px-2 text-gray-400">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {(data?.info_general || []).slice(pageInfo * ROWS_PER_PAGE, (pageInfo + 1) * ROWS_PER_PAGE).map((u, i) => {
                  const realIdx = pageInfo * ROWS_PER_PAGE + i;
                  return (
                  <tr key={`${u.id_cliente}-${i}`} className="border-b border-gray-800 hover:bg-orange-500/5">
                    <td className="py-2 px-2"><EditableCell value={u.id_cliente} sheet="info_general" rowIndex={realIdx} field="id_cliente" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.nombre_cliente} sheet="info_general" rowIndex={realIdx} field="nombre_cliente" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.correo} sheet="info_general" rowIndex={realIdx} field="correo" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.comercial_responsable} sheet="info_general" rowIndex={realIdx} field="comercial_responsable" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.pareto} sheet="info_general" rowIndex={realIdx} field="pareto" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.tipo_cuenta} sheet="info_general" rowIndex={realIdx} field="tipo_cuenta" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.tipo_usuario} sheet="info_general" rowIndex={realIdx} field="tipo_usuario" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.ciudad} sheet="info_general" rowIndex={realIdx} field="ciudad" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.modalidad_venta} sheet="info_general" rowIndex={realIdx} field="modalidad_venta" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.plataforma_tienda} sheet="info_general" rowIndex={realIdx} field="plataforma_tienda" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.presupuesto_diario} sheet="info_general" rowIndex={realIdx} field="presupuesto_diario" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.mentor} sheet="info_general" rowIndex={realIdx} field="mentor" /></td>
                    <td className="py-2 px-2"><EditableCell value={u.observacion} sheet="info_general" rowIndex={realIdx} field="observacion" /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={pageInfo} setPage={setPageInfo} total={(data?.info_general || []).length} />
        </div>
      )}
    </div>
  );
}
