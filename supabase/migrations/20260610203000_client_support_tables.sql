create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  tax_id text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null default 'Direccion',
  address_line text not null,
  city text,
  province text,
  postal_code text,
  country text not null default 'ES',
  is_default_delivery boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.client_payment_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,
  payment_method text not null default 'transferencia',
  customer_days integer not null default 1,
  percentage numeric(5, 2) not null default 100,
  delay_days integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists client_contacts_client_idx on public.client_contacts (client_id) where deleted_at is null;
create index if not exists client_addresses_client_idx on public.client_addresses (client_id) where deleted_at is null;
create index if not exists client_payment_terms_client_idx on public.client_payment_terms (client_id) where deleted_at is null;

alter table public.client_contacts enable row level security;
alter table public.client_addresses enable row level security;
alter table public.client_payment_terms enable row level security;

drop trigger if exists client_contacts_set_updated_at on public.client_contacts;
drop trigger if exists client_addresses_set_updated_at on public.client_addresses;
drop trigger if exists client_payment_terms_set_updated_at on public.client_payment_terms;

create trigger client_contacts_set_updated_at
  before update on public.client_contacts
  for each row execute function app_private.set_updated_at();

create trigger client_addresses_set_updated_at
  before update on public.client_addresses
  for each row execute function app_private.set_updated_at();

create trigger client_payment_terms_set_updated_at
  before update on public.client_payment_terms
  for each row execute function app_private.set_updated_at();

create policy client_contacts_select_allowed
  on public.client_contacts
  for select
  to authenticated
  using (app_private.can_access_client(client_id));

create policy client_contacts_manage_accountants
  on public.client_contacts
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy client_addresses_select_allowed
  on public.client_addresses
  for select
  to authenticated
  using (app_private.can_access_client(client_id));

create policy client_addresses_manage_accountants
  on public.client_addresses
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy client_payment_terms_select_allowed
  on public.client_payment_terms
  for select
  to authenticated
  using (app_private.can_access_client(client_id));

create policy client_payment_terms_manage_accountants
  on public.client_payment_terms
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));
