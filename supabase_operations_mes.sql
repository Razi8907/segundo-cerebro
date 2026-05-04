-- Agrega columna `mes` a operations_data para separar la carga diaria
-- por mes (abril/mayo/etc).
-- Correr UNA VEZ en Supabase SQL Editor.

alter table public.operations_data
  add column if not exists mes text not null default 'abril';

-- Reemplazar la unique de (country, guia, fecha_carga) por
-- (country, mes, guia, fecha_carga) para que la misma guía pueda
-- existir simultáneamente en abril y mayo sin pisarse.
alter table public.operations_data
  drop constraint if exists operations_data_country_guia_fecha_carga_key;

create unique index if not exists operations_data_country_mes_guia_fecha_uq
  on public.operations_data (country, mes, guia, fecha_carga);

-- Index secundario para filtros por mes
create index if not exists operations_data_country_mes_idx
  on public.operations_data (country, mes);
