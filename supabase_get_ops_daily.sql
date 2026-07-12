-- Función get_ops_daily: desglose DIARIO (por fecha_orden) de operations_data
-- aplicando la regla oficial de Operaciones para movilizadas:
--   movilizada = fecha_procesamiento != null AND estatus NOT IN cancelacion.
-- Usa la última fecha_carga del mes (misma fuente que el dashboard de Operaciones).
-- La usa /api/data/operations-daily → componente AccionesUrgentes.
-- Correr en Supabase SQL Editor (o ya aplicada vía migración create_get_ops_daily).

create or replace function get_ops_daily(p_country text, p_mes text)
returns table(
  dia int,
  ingresadas bigint,
  movilizadas bigint,
  entregadas bigint,
  devueltas bigint,
  canceladas bigint
)
language sql
stable
as $$
  with params as (
    select
      case when p_country = 'ar'
        then array['CANCELADO','RECHAZADO']
        else array['CANCELADO','RECHAZADO','GUIA ANULADA','CANCELADO POR TRANSPORTADORA']
      end as cancel_states,
      case when p_country = 'ar'
        then array['DEVOLUCION','EN PROCESO DE DEVOLUCION']
        else array['DEVOLUCION','EN PROCESO DE DEVOLUCION','DEVOLUCION EN PROCESO']
      end as dev_states
  ),
  latest as (
    select max(fecha_carga) fc
    from operations_data
    where country = p_country and mes = p_mes
  ),
  d as (
    select
      nullif(substr(trim(o.fecha_orden), 1, 2), '')::int as dia,
      (nullif(trim(o.fecha_procesamiento), '') is not null
        and lower(trim(o.fecha_procesamiento)) <> 'null') as hasproc,
      upper(trim(o.estatus)) as est
    from operations_data o, latest l
    where o.country = p_country and o.mes = p_mes and o.fecha_carga = l.fc
  )
  select
    d.dia,
    count(*)::bigint,
    count(*) filter (where d.hasproc and not (d.est = any(p.cancel_states)))::bigint,
    count(*) filter (where d.est = 'ENTREGADO')::bigint,
    count(*) filter (where d.est = any(p.dev_states))::bigint,
    count(*) filter (where d.est = any(p.cancel_states))::bigint
  from d, params p
  where d.dia between 1 and 31
  group by d.dia
  order by d.dia;
$$;
