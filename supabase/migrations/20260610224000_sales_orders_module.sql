create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  order_number text,
  order_date date,
  reference text,
  currency text not null default 'EUR',
  status public.commercial_document_status not null default 'draft',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  retention_rate numeric(5, 2) not null default 0,
  retention_amount numeric(14, 2) not null default 0,
  suplido_amount numeric(14, 2) not null default 0,
  pdf_template text not null default 'standard',
  total_amount numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sales_orders_org_matches_fiscal_entity
    check (organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)),
  constraint sales_orders_retention_rate_range
    check (retention_rate >= 0 and retention_rate <= 100),
  constraint sales_orders_non_negative_suplido
    check (suplido_amount >= 0)
);

create unique index if not exists sales_orders_number_unique
  on public.sales_orders (organization_id, fiscal_entity_id, order_number)
  where order_number is not null and deleted_at is null;

create index if not exists sales_orders_org_status_idx
  on public.sales_orders (organization_id, status)
  where deleted_at is null;

create table if not exists public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_service_id uuid references public.products_services(id) on delete set null,
  line_index integer not null default 0 check (line_index >= 0),
  description text,
  quantity numeric(14, 4) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  tax_rate numeric(5, 2),
  discount_rate numeric(5, 2) not null default 0 check (discount_rate >= 0 and discount_rate <= 100),
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sales_order_id, line_index)
);

create index if not exists sales_order_lines_order_idx
  on public.sales_order_lines (sales_order_id);

alter table public.sales_orders enable row level security;
alter table public.sales_order_lines enable row level security;

drop trigger if exists sales_orders_set_updated_at on public.sales_orders;
create trigger sales_orders_set_updated_at
  before update on public.sales_orders
  for each row execute function app_private.set_updated_at();

drop trigger if exists sales_order_lines_set_updated_at on public.sales_order_lines;
create trigger sales_order_lines_set_updated_at
  before update on public.sales_order_lines
  for each row execute function app_private.set_updated_at();

create or replace function app_private.can_access_sales_order(target_sales_order_id uuid)
returns boolean
language sql
stable
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.sales_orders so
    where so.id = target_sales_order_id
      and so.deleted_at is null
      and app_private.is_org_member(so.organization_id)
  );
$$;

drop policy if exists sales_orders_select_allowed on public.sales_orders;
create policy sales_orders_select_allowed
  on public.sales_orders
  for select to authenticated
  using (deleted_at is null and app_private.is_org_member(organization_id));

drop policy if exists sales_orders_manage_accountants on public.sales_orders;
create policy sales_orders_manage_accountants
  on public.sales_orders
  for all to authenticated
  using (
    deleted_at is null
    and organization_id in (
      select organization_members.organization_id
      from public.organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
        and organization_members.role = any (array['owner'::organization_role, 'admin'::organization_role, 'accountant'::organization_role])
    )
  )
  with check (
    organization_id in (
      select organization_members.organization_id
      from public.organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
        and organization_members.role = any (array['owner'::organization_role, 'admin'::organization_role, 'accountant'::organization_role])
    )
  );

drop policy if exists sales_order_lines_select_allowed on public.sales_order_lines;
create policy sales_order_lines_select_allowed
  on public.sales_order_lines
  for select to authenticated
  using (app_private.can_access_sales_order(sales_order_id));

drop policy if exists sales_order_lines_manage_accountants on public.sales_order_lines;
create policy sales_order_lines_manage_accountants
  on public.sales_order_lines
  for all to authenticated
  using (
    exists (
      select 1
      from public.sales_orders so
      where so.id = sales_order_id
        and so.deleted_at is null
        and so.organization_id in (
          select organization_members.organization_id
          from public.organization_members
          where organization_members.user_id = auth.uid()
            and organization_members.status = 'active'::membership_status
            and organization_members.role = any (array['owner'::organization_role, 'admin'::organization_role, 'accountant'::organization_role])
        )
    )
  )
  with check (
    exists (
      select 1
      from public.sales_orders so
      where so.id = sales_order_id
        and so.deleted_at is null
        and so.organization_id in (
          select organization_members.organization_id
          from public.organization_members
          where organization_members.user_id = auth.uid()
            and organization_members.status = 'active'::membership_status
            and organization_members.role = any (array['owner'::organization_role, 'admin'::organization_role, 'accountant'::organization_role])
        )
    )
  );

grant execute on function app_private.can_access_sales_order(uuid) to authenticated, service_role;
grant select, insert, update, delete on public.sales_orders to authenticated;
grant select, insert, update, delete on public.sales_order_lines to authenticated;
grant all privileges on public.sales_orders to service_role;
grant all privileges on public.sales_order_lines to service_role;
