-- Commercial foundation for ERP-style sales and purchases.
-- This keeps the UI seed data replaceable by tenant-scoped real tables.

create type public.commercial_document_status as enum (
  'draft',
  'open',
  'booked',
  'sent',
  'accepted',
  'rejected',
  'overdue',
  'paid',
  'cancelled'
);

create type public.commercial_maturity_direction as enum ('receivable', 'payable');
create type public.commercial_maturity_status as enum ('open', 'overdue', 'partial', 'settled', 'cancelled');
create type public.product_service_kind as enum ('product', 'service');
create type public.supplier_status as enum ('active', 'archived');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  contact_email text,
  contact_phone text,
  status public.supplier_status not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index suppliers_org_tax_id_unique
  on public.suppliers (organization_id, lower(tax_id))
  where tax_id is not null and deleted_at is null;

create index suppliers_organization_status_idx
  on public.suppliers (organization_id, status)
  where deleted_at is null;

create table public.products_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  kind public.product_service_kind not null,
  description text,
  unit_price numeric(14, 4) not null default 0,
  tax_rate numeric(5, 2),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index products_services_org_code_unique
  on public.products_services (organization_id, lower(code))
  where code is not null and deleted_at is null;

create index products_services_organization_kind_idx
  on public.products_services (organization_id, kind)
  where deleted_at is null;

create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  source_invoice_id uuid references public.invoices(id) on delete set null,
  invoice_number text,
  issue_date date,
  due_date date,
  currency text not null default 'EUR',
  status public.commercial_document_status not null default 'draft',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sales_invoices_org_matches_fiscal_entity
    check (organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id))
);

create unique index sales_invoices_number_unique
  on public.sales_invoices (organization_id, fiscal_entity_id, invoice_number)
  where invoice_number is not null and deleted_at is null;

create index sales_invoices_org_status_due_idx
  on public.sales_invoices (organization_id, status, due_date)
  where deleted_at is null;

create table public.sales_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_invoice_id uuid not null references public.sales_invoices(id) on delete cascade,
  product_service_id uuid references public.products_services(id) on delete set null,
  line_index integer not null default 0 check (line_index >= 0),
  description text,
  quantity numeric(14, 4) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  tax_rate numeric(5, 2),
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sales_invoice_id, line_index)
);

create index sales_invoice_lines_invoice_idx
  on public.sales_invoice_lines (sales_invoice_id);

create table public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  quote_number text,
  quote_date date,
  valid_until date,
  currency text not null default 'EUR',
  status public.commercial_document_status not null default 'draft',
  total_amount numeric(14, 2) not null default 0,
  converted_sales_invoice_id uuid references public.sales_invoices(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sales_quotes_org_matches_fiscal_entity
    check (organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id))
);

create unique index sales_quotes_number_unique
  on public.sales_quotes (organization_id, fiscal_entity_id, quote_number)
  where quote_number is not null and deleted_at is null;

create index sales_quotes_org_status_idx
  on public.sales_quotes (organization_id, status)
  where deleted_at is null;

create table public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  source_invoice_id uuid references public.invoices(id) on delete set null,
  source_document_id uuid references public.documents(id) on delete set null,
  invoice_number text,
  issue_date date,
  due_date date,
  currency text not null default 'EUR',
  status public.commercial_document_status not null default 'draft',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint purchase_invoices_org_matches_fiscal_entity
    check (organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id))
);

create index purchase_invoices_org_status_due_idx
  on public.purchase_invoices (organization_id, status, due_date)
  where deleted_at is null;

create index purchase_invoices_supplier_idx
  on public.purchase_invoices (supplier_id)
  where deleted_at is null;

create table public.purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  product_service_id uuid references public.products_services(id) on delete set null,
  line_index integer not null default 0 check (line_index >= 0),
  description text,
  quantity numeric(14, 4) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  tax_rate numeric(5, 2),
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_invoice_id, line_index)
);

create index purchase_invoice_lines_invoice_idx
  on public.purchase_invoice_lines (purchase_invoice_id);

create table public.commercial_maturities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  direction public.commercial_maturity_direction not null,
  status public.commercial_maturity_status not null default 'open',
  due_date date not null,
  original_amount numeric(14, 2) not null default 0,
  outstanding_amount numeric(14, 2) not null default 0,
  currency text not null default 'EUR',
  sales_invoice_id uuid references public.sales_invoices(id) on delete cascade,
  purchase_invoice_id uuid references public.purchase_invoices(id) on delete cascade,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint commercial_maturities_single_source check (
    (sales_invoice_id is not null and purchase_invoice_id is null and direction = 'receivable')
    or
    (sales_invoice_id is null and purchase_invoice_id is not null and direction = 'payable')
  ),
  constraint commercial_maturities_org_matches_fiscal_entity
    check (organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id))
);

create index commercial_maturities_org_status_due_idx
  on public.commercial_maturities (organization_id, status, due_date)
  where deleted_at is null;

create index commercial_maturities_sales_invoice_idx
  on public.commercial_maturities (sales_invoice_id)
  where sales_invoice_id is not null;

create index commercial_maturities_purchase_invoice_idx
  on public.commercial_maturities (purchase_invoice_id)
  where purchase_invoice_id is not null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'suppliers',
    'products_services',
    'sales_invoices',
    'sales_invoice_lines',
    'sales_quotes',
    'purchase_invoices',
    'purchase_invoice_lines',
    'commercial_maturities'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'suppliers',
    'products_services',
    'sales_invoices',
    'sales_invoice_lines',
    'sales_quotes',
    'purchase_invoices',
    'purchase_invoice_lines',
    'commercial_maturities'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace function app_private.can_access_sales_invoice(target_sales_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.sales_invoices si
    where si.id = target_sales_invoice_id
      and si.deleted_at is null
      and app_private.can_access_fiscal_entity(si.fiscal_entity_id)
  );
$$;

create or replace function app_private.can_access_purchase_invoice(target_purchase_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_invoices pi
    where pi.id = target_purchase_invoice_id
      and pi.deleted_at is null
      and app_private.can_access_fiscal_entity(pi.fiscal_entity_id)
  );
$$;

create policy suppliers_select_members
  on public.suppliers
  for select
  to authenticated
  using (app_private.is_org_member(organization_id));

create policy suppliers_manage_accountants
  on public.suppliers
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy products_services_select_members
  on public.products_services
  for select
  to authenticated
  using (app_private.is_org_member(organization_id));

create policy products_services_manage_accountants
  on public.products_services
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy sales_invoices_select_allowed
  on public.sales_invoices
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(fiscal_entity_id));

create policy sales_invoices_manage_accountants
  on public.sales_invoices
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (
    app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    and organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)
  );

create policy sales_invoice_lines_select_allowed
  on public.sales_invoice_lines
  for select
  to authenticated
  using (app_private.can_access_sales_invoice(sales_invoice_id));

create policy sales_invoice_lines_manage_accountants
  on public.sales_invoice_lines
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.sales_invoices si
      where si.id = sales_invoice_id
        and app_private.has_org_role(si.organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.sales_invoices si
      where si.id = sales_invoice_id
        and si.organization_id = organization_id
        and app_private.has_org_role(si.organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    )
  );

create policy sales_quotes_select_allowed
  on public.sales_quotes
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(fiscal_entity_id));

create policy sales_quotes_manage_accountants
  on public.sales_quotes
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (
    app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    and organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)
  );

create policy purchase_invoices_select_allowed
  on public.purchase_invoices
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(fiscal_entity_id));

create policy purchase_invoices_manage_accountants
  on public.purchase_invoices
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (
    app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    and organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)
  );

create policy purchase_invoice_lines_select_allowed
  on public.purchase_invoice_lines
  for select
  to authenticated
  using (app_private.can_access_purchase_invoice(purchase_invoice_id));

create policy purchase_invoice_lines_manage_accountants
  on public.purchase_invoice_lines
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.purchase_invoices pi
      where pi.id = purchase_invoice_id
        and app_private.has_org_role(pi.organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.purchase_invoices pi
      where pi.id = purchase_invoice_id
        and pi.organization_id = organization_id
        and app_private.has_org_role(pi.organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    )
  );

create policy commercial_maturities_select_allowed
  on public.commercial_maturities
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(fiscal_entity_id));

create policy commercial_maturities_manage_accountants
  on public.commercial_maturities
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (
    app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
    and organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)
  );

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on function app_private.can_access_sales_invoice(uuid) to authenticated, service_role;
grant execute on function app_private.can_access_purchase_invoice(uuid) to authenticated, service_role;
