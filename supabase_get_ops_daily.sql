-- Función get_ops_daily: desglose DIARIO para el apartado "Acciones Urgentes" (AR/PY).
-- La usa /api/data/operations-daily → componente AccionesUrgentes.
--
-- FUENTES POR MÉTRICA (importante):
--   ingresadas  → daily_tracking (Seguimiento Diario, carga manual en General), por día.
--   movilizadas / entregadas / devueltas / canceladas → operations_data (última fecha_carga),
--     regla oficial de Operaciones:
--       movilizada = fecha_procesamiento != null AND estatus NOT IN cancelacion.
--     Bucketeado por fecha_orden. Estados de cancelacion/devolucion difieren AR vs PY.
--
-- Correr en Supabase SQL Editor (o ya aplicada vía migración
-- ops_daily_ingresadas_from_daily_tracking).

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
  ops as (
    select
      nullif(substr(trim(o.fecha_orden), 1, 2), '')::int as dia,
      (nullif(trim(o.fecha_procesamiento), '') is not null
        and lower(trim(o.fecha_procesamiento)) <> 'null') as hasproc,
      upper(trim(o.estatus)) as est
    from operations_data o, latest l
    where o.country = p_country and o.mes = p_mes and o.fecha_carga = l.fc
  ),
  ops_agg as (
    select
      ops.dia,
      count(*) filter (where ops.hasproc and not (ops.est = any(p.cancel_states)))::bigint as movilizadas,
      count(*) filter (where ops.est = 'ENTREGADO')::bigint as entregadas,
      count(*) filter (where ops.est = any(p.dev_states))::bigint as devueltas,
      count(*) filter (where ops.est = any(p.cancel_states))::bigint as canceladas
    from ops, params p
    where ops.dia between 1 and 31
    group by ops.dia
  ),
  ing as (
    select fecha::int as dia, sum(ordenes)::bigint as ingresadas
    from daily_tracking
    where country = p_country and mes = p_mes and fecha between 1 and 31
    group by fecha
  )
  select
    coalesce(i.dia, a.dia) as dia,
    coalesce(i.ingresadas, 0)::bigint as ingresadas,
    coalesce(a.movilizadas, 0)::bigint as movilizadas,
    coalesce(a.entregadas, 0)::bigint as entregadas,
    coalesce(a.devueltas, 0)::bigint as devueltas,
    coalesce(a.canceladas, 0)::bigint as canceladas
  from ing i
  full outer join ops_agg a on a.dia = i.dia
  order by 1;
$$;
