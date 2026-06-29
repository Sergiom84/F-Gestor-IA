-- Plantillas de documentos de venta con nombre, creadas desde la personalizacion
-- de Presupuestos y seleccionables al crear una factura en Ventas.

create table if not exists public.sales_document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  format text not null default 'pdf' check (format in ('pdf', 'template')),
  scope text not null default 'sales' check (scope in ('sales', 'quotes')),
  config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_document_templates_org_idx
  on public.sales_document_templates (organization_id);

alter table public.sales_document_templates enable row level security;

drop policy if exists "org members read sales templates" on public.sales_document_templates;
create policy "org members read sales templates"
  on public.sales_document_templates for select
  using (
    organization_id in (
      select organization_members.organization_id
      from organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

drop policy if exists "org members insert sales templates" on public.sales_document_templates;
create policy "org members insert sales templates"
  on public.sales_document_templates for insert
  with check (
    organization_id in (
      select organization_members.organization_id
      from organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

drop policy if exists "org members update sales templates" on public.sales_document_templates;
create policy "org members update sales templates"
  on public.sales_document_templates for update
  using (
    organization_id in (
      select organization_members.organization_id
      from organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

drop policy if exists "org members delete sales templates" on public.sales_document_templates;
create policy "org members delete sales templates"
  on public.sales_document_templates for delete
  using (
    organization_id in (
      select organization_members.organization_id
      from organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

drop trigger if exists sales_document_templates_updated_at on public.sales_document_templates;
create trigger sales_document_templates_updated_at
  before update on public.sales_document_templates
  for each row execute function touch_updated_at();
