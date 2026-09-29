-- Función get_ops_transportadora: guías por mes, día de orden y transportadora
-- (último snapshot de cada mes). La usa /api/finanzas/ar/punto-equilibrio.
--
-- Misma regla de "movilizada" que el Dashboard operativo (computeMovMetrics en
-- OperationsDashboard.tsx) y que get_ops_daily:
--   fecha_procesamiento no vacía AND estatus NOT IN cancelación (AR vs PY difieren).
-- mes_orden/dia salen de fecha_orden (dd-mm-yyyy): el archivo de un mes puede traer
-- órdenes del último día del mes anterior; el dashboard las cuenta en el mes.
--
-- Recibe la lista de meses para usar el índice (country, mes, fecha_carga): buscar el
-- último snapshot de TODOS los meses sin filtrar hace seq scan de ~12M filas (~55 s).
-- Solo lectura (stable). Aplicada vía migración get_ops_transportadora_diario_mes_orden.

drop function if exists get_ops_transportadora(text, text[]);
create or replace function get_ops_transportadora(p_country text, p_meses text[])
returns table(
  mes text,
  mes_orden int,
  dia int,
  transportadora text,
  total bigint,
  movilizadas bigint,
  entregadas bigint,
  valor_movilizadas numeric
)
language sql
stable
as $$
  with params as (
    select case when p_country = 'ar'
      then array['CANCELADO','RECHAZADO']
      else array['CANCELADO','RECHAZADO','GUIA ANULADA','CANCELADO POR TRANSPORTADORA']
    end as cancel_states
  ),
  latest as (
    select m.mes, (
      select max(o.fecha_carga) from operations_data o
      where o.country = p_country and o.mes = m.mes
    ) as fc
    from unnest(p_meses) as m(mes)
  ),
  ops as (
    select
      o.mes,
      case when trim(o.fecha_orden) ~ '^[0-9]{2}-[0-9]{2}-' then substr(trim(o.fecha_orden), 4, 2)::int end as mes_orden,
      case when trim(o.fecha_orden) ~ '^[0-9]{2}-' then substr(trim(o.fecha_orden), 1, 2)::int end as dia,
      upper(coalesce(nullif(trim(o.transportadora), ''), 'SIN TRANSPORTADORA')) as transportadora,
      (nullif(trim(o.fecha_procesamiento), '') is not null
        and not (upper(trim(o.estatus)) = any(p.cancel_states))) as mov,
      upper(trim(o.estatus)) = 'ENTREGADO' as ent,
      coalesce(o.valor_orden, 0) as valor
    from latest l
    join operations_data o on o.country = p_country and o.mes = l.mes and o.fecha_carga = l.fc
    cross join params p
  )
  select mes, mes_orden, dia, transportadora,
    count(*)::bigint,
    count(*) filter (where mov)::bigint,
    count(*) filter (where ent)::bigint,
    coalesce(sum(valor) filter (where mov), 0)
  from ops
  group by mes, mes_orden, dia, transportadora;
$$;
