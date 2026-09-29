-- Función get_ops_transportadora: guías por mes y transportadora (último snapshot de cada mes).
-- La usa /api/finanzas/ar/punto-equilibrio → mix Fixy/Urbano y ticket promedio real del mes.
-- Misma regla de "movilizada" que get_ops_daily:
--   fecha_procesamiento != null AND estatus NOT IN cancelación (AR vs PY difieren).
-- Recibe la lista de meses para usar el índice (country, mes, fecha_carga): buscar el
-- último snapshot de TODOS los meses sin filtrar hace seq scan de ~12M filas (~55 s).
-- Solo lectura (stable). Aplicada vía migración get_ops_transportadora_por_meses.

drop function if exists get_ops_transportadora(text);
create or replace function get_ops_transportadora(p_country text, p_meses text[])
returns table(
  mes text,
  transportadora text,
  total bigint,
  movilizadas bigint,
  entregadas bigint,
  ticket numeric
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
  )
  select
    o.mes,
    upper(coalesce(nullif(trim(o.transportadora), ''), 'SIN TRANSPORTADORA')) as transportadora,
    count(*)::bigint as total,
    count(*) filter (
      where nullif(trim(o.fecha_procesamiento), '') is not null
        and lower(trim(o.fecha_procesamiento)) <> 'null'
        and not (upper(trim(o.estatus)) = any(p.cancel_states))
    )::bigint as movilizadas,
    count(*) filter (where upper(trim(o.estatus)) = 'ENTREGADO')::bigint as entregadas,
    round(avg(o.valor_orden)) as ticket
  from latest l
  join operations_data o on o.country = p_country and o.mes = l.mes and o.fecha_carga = l.fc
  cross join params p
  group by o.mes, 2;
$$;
