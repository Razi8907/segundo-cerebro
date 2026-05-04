-- Agrega columna `mes` a operational_snapshots para que cada mes
-- tenga su propio snapshot independiente.
-- Correr UNA VEZ en Supabase SQL Editor.

alter table public.operational_snapshots
  add column if not exists mes text not null default 'abril';

-- La unique original era (country); la reemplazamos por (country, mes)
alter table public.operational_snapshots
  drop constraint if exists operational_snapshots_country_key;

create unique index if not exists operational_snapshots_country_mes_uq
  on public.operational_snapshots (country, mes);
