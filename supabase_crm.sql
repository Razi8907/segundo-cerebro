-- CRM de Seguimiento Comercial — tabla crm_interacciones
-- Correr UNA VEZ en Supabase SQL Editor.

create table if not exists public.crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  country text not null check (country in ('ar','py')),
  entity_type text not null check (entity_type in ('dropshipper','proveedor','marca')),
  entity_name text not null,
  entity_dropi_id text,
  canal text not null check (canal in ('Llamada','WhatsApp','Email','Reunión','Visita','Otro')),
  resumen text not null default '',
  oportunidades text not null default '',
  compromisos text not null default '',
  observaciones text not null default '',
  fecha_proximo date,
  state text not null default 'Pendiente' check (state in ('Pendiente','En proceso','Cerrado','Alerta')),
  state_context text not null default '',
  es_alerta boolean not null default false,
  score smallint check (score between 1 and 5),
  nivel_volumen text check (nivel_volumen in ('Alto','Medio','Bajo','Potencial')),
  comercial_asignado text,
  created_by uuid references public.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_interacciones_country_idx on public.crm_interacciones (country);
create index if not exists crm_interacciones_entity_idx on public.crm_interacciones (country, entity_type, entity_name);
create index if not exists crm_interacciones_state_idx on public.crm_interacciones (country, state);
create index if not exists crm_interacciones_proximo_idx on public.crm_interacciones (country, fecha_proximo);
create index if not exists crm_interacciones_created_by_idx on public.crm_interacciones (created_by);
create index if not exists crm_interacciones_created_at_idx on public.crm_interacciones (created_at desc);

-- Trigger para mantener updated_at
create or replace function public.crm_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_interacciones_set_updated_at on public.crm_interacciones;
create trigger crm_interacciones_set_updated_at
  before update on public.crm_interacciones
  for each row execute function public.crm_set_updated_at();
