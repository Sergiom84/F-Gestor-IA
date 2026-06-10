-- Configuracion del modulo de Ventas (numeracion, pagos, preferencias) por organizacion.
create table if not exists public.sales_config (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sales_config enable row level security;

drop policy if exists "org members read own sales config" on public.sales_config;
create policy "org members read own sales config"
  on public.sales_config for select
  using (
    organization_id in (
      select organization_members.organization_id
      from organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

drop policy if exists "org members upsert own sales config" on public.sales_config;
create policy "org members upsert own sales config"
  on public.sales_config for insert
  with check (
    organization_id in (
      select organization_members.organization_id
      from organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

drop policy if exists "org members update own sales config" on public.sales_config;
create policy "org members update own sales config"
  on public.sales_config for update
  using (
    organization_id in (
      select organization_members.organization_id
      from organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

drop trigger if exists sales_config_updated_at on public.sales_config;
create trigger sales_config_updated_at
  before update on public.sales_config
  for each row execute function touch_updated_at();
