-- ═══════════════════════════════════════════════════════════════════
-- Tabla para guardar la data financiera editable de Argentina
-- Una sola fila (singleton) con un JSON blob que contiene toda la data
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.ar_finanzas_data (
  id text primary key default 'singleton',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  constraint ar_finanzas_data_singleton check (id = 'singleton')
);

-- Habilitar RLS
alter table public.ar_finanzas_data enable row level security;

-- Las API routes usan la SERVICE_ROLE_KEY (bypass RLS), así que las
-- policies acá son por defensa adicional para conexiones directas.
-- Lectura: cualquier usuario autenticado.
create policy "ar_finanzas_data: read auth"
  on public.ar_finanzas_data
  for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- Escritura: solo admins o usuarios con access_finanzas=true.
-- (En la práctica las escrituras pasan por la API que valida el JWT
-- y verifica role/access_finanzas antes de hacer el upsert.)
create policy "ar_finanzas_data: write service"
  on public.ar_finanzas_data
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Trigger para mantener updated_at fresco
create or replace function public.ar_finanzas_data_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ar_finanzas_data_touch_trg on public.ar_finanzas_data;
create trigger ar_finanzas_data_touch_trg
  before update on public.ar_finanzas_data
  for each row
  execute function public.ar_finanzas_data_touch();
