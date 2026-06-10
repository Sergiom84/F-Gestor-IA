alter table public.sales_quotes
  add column if not exists reference text,
  add column if not exists subtotal_amount numeric(14, 2) not null default 0,
  add column if not exists tax_amount numeric(14, 2) not null default 0,
  add column if not exists retention_rate numeric(5, 2) not null default 0,
  add column if not exists retention_amount numeric(14, 2) not null default 0,
  add column if not exists suplido_amount numeric(14, 2) not null default 0,
  add column if not exists pdf_template text not null default 'standard';

alter table public.sales_quotes
  add constraint sales_quotes_retention_rate_range
  check (retention_rate >= 0 and retention_rate <= 100);

alter table public.sales_quotes
  add constraint sales_quotes_non_negative_suplido
  check (suplido_amount >= 0);

create table if not exists public.sales_quote_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_quote_id uuid not null references public.sales_quotes(id) on delete cascade,
  product_service_id uuid references public.products_services(id) on delete set null,
  line_index integer not null default 0 check (line_index >= 0),
  description text,
  quantity numeric(14, 4) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  tax_rate numeric(5, 2),
  discount_rate numeric(5, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sales_quote_id, line_index)
);

create index if not exists sales_quote_lines_quote_idx
  on public.sales_quote_lines (sales_quote_id);

alter table public.sales_quote_lines enable row level security;

drop trigger if exists sales_quote_lines_set_updated_at on public.sales_quote_lines;
create trigger sales_quote_lines_set_updated_at
  before update on public.sales_quote_lines
  for each row execute function app_private.set_updated_at();

create or replace function app_private.can_access_sales_quote(target_sales_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.sales_quotes sq
    where sq.id = target_sales_quote_id
      and sq.deleted_at is null
      and app_private.can_access_fiscal_entity(sq.fiscal_entity_id)
  );
$$;

create policy sales_quote_lines_select_allowed
  on public.sales_quote_lines
  for select
  to authenticated
  using (app_private.can_access_sales_quote(sales_quote_id));

create policy sales_quote_lines_manage_accountants
  on public.sales_quote_lines
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.sales_quotes sq
      where sq.id = sales_quote_id
        and app_private.has_org_role(sq.organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.sales_quotes sq
      where sq.id = sales_quote_id
        and sq.organization_id = organization_id
        and app_private.has_org_role(sq.organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    )
  );

grant execute on function app_private.can_access_sales_quote(uuid) to authenticated, service_role;
grant select, insert, update, delete on public.sales_quote_lines to authenticated;
grant all privileges on public.sales_quote_lines to service_role;
