-- Función RPC para obtener historial de cargas agregado (count por fecha_carga)
-- sin tener que bajar las cientos de miles de filas al cliente.
-- Correr UNA VEZ en Supabase SQL Editor.

create or replace function ops_upload_history(p_country text, p_mes text)
returns table(fecha_carga text, cnt bigint)
language sql stable
as $$
  select fecha_carga, count(*)::bigint as cnt
  from operations_data
  where country = p_country and mes = p_mes
  group by fecha_carga
  order by fecha_carga desc;
$$;
