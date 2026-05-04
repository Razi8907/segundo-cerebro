-- Agrega columna `mes` a daily_tracking para diferenciar Abril/Mayo/etc.
-- Correr UNA VEZ en Supabase SQL Editor.

alter table public.daily_tracking
  add column if not exists mes text not null default 'abril';

-- La unique original es (country, fecha) — la reemplazamos por (country, mes, fecha)
alter table public.daily_tracking
  drop constraint if exists daily_tracking_country_fecha_key;

create unique index if not exists daily_tracking_country_mes_fecha_uq
  on public.daily_tracking (country, mes, fecha);
