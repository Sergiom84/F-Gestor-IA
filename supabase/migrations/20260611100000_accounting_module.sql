-- Enums
create type public.accounting_entry_status as enum ('draft', 'posted');
create type public.accounting_fixed_asset_status as enum ('active', 'sold', 'written_off');
create type public.accounting_fixed_asset_transaction_type as enum ('acquisition', 'depreciation', 'improvement', 'sale', 'write_off');
create type public.accounting_closing_period_kind as enum ('monthly', 'annual');
create type public.accounting_closing_period_status as enum ('open', 'closed', 'locked');

-- Diarios contables
create table if not exists public.accounting_journals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  last_entry_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists accounting_journals_org_code_unique
  on public.accounting_journals (organization_id, upper(code))
  where deleted_at is null;

alter table public.accounting_journals enable row level security;

create policy "org_member_accounting_journals" on public.accounting_journals
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

-- Asientos contables
create table if not exists public.accounting_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  journal_id uuid not null references public.accounting_journals(id) on delete restrict,
  entry_number integer not null,
  entry_date date not null,
  document_date date,
  document_number text,
  description text,
  status public.accounting_entry_status not null default 'draft',
  currency text not null default 'EUR',
  total_debit numeric(14, 2) not null default 0,
  total_credit numeric(14, 2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists accounting_entries_journal_number_unique
  on public.accounting_entries (journal_id, entry_number)
  where deleted_at is null;

create index if not exists accounting_entries_org_date_idx
  on public.accounting_entries (organization_id, entry_date)
  where deleted_at is null;

alter table public.accounting_entries enable row level security;

create policy "org_member_accounting_entries" on public.accounting_entries
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

-- Apuntes (lineas de asiento)
create table if not exists public.accounting_entry_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_id uuid not null references public.accounting_entries(id) on delete cascade,
  line_index integer not null default 0,
  account_code text not null,
  account_description text,
  third_party_name text,
  description text,
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  matching_mark text,
  created_at timestamptz not null default now()
);

create index if not exists accounting_entry_lines_entry_idx
  on public.accounting_entry_lines (entry_id);

create index if not exists accounting_entry_lines_matching_idx
  on public.accounting_entry_lines (organization_id, account_code, matching_mark)
  where matching_mark is not null;

alter table public.accounting_entry_lines enable row level security;

create policy "org_member_accounting_entry_lines" on public.accounting_entry_lines
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

-- Inmovilizado
create table if not exists public.accounting_fixed_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  description text not null,
  acquisition_date date,
  account_code text,
  acquisition_value numeric(14, 2) not null default 0,
  accumulated_depreciation numeric(14, 2) not null default 0,
  status public.accounting_fixed_asset_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists accounting_fixed_assets_org_code_unique
  on public.accounting_fixed_assets (organization_id, upper(code))
  where deleted_at is null;

alter table public.accounting_fixed_assets enable row level security;

create policy "org_member_accounting_fixed_assets" on public.accounting_fixed_assets
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

-- Transacciones de inmovilizado
create table if not exists public.accounting_fixed_asset_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fixed_asset_id uuid not null references public.accounting_fixed_assets(id) on delete cascade,
  transaction_date date not null,
  transaction_type public.accounting_fixed_asset_transaction_type not null,
  account_code text,
  amount numeric(14, 2) not null default 0,
  description text,
  status public.accounting_entry_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists accounting_fixed_asset_transactions_asset_idx
  on public.accounting_fixed_asset_transactions (fixed_asset_id);

alter table public.accounting_fixed_asset_transactions enable row level security;

create policy "org_member_accounting_fixed_asset_transactions" on public.accounting_fixed_asset_transactions
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

-- Periodos de cierre
create table if not exists public.accounting_closing_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period text not null,
  kind public.accounting_closing_period_kind not null,
  status public.accounting_closing_period_status not null default 'open',
  closing_date date,
  checks_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accounting_closing_periods_org_period_kind_unique
  on public.accounting_closing_periods (organization_id, period, kind);

alter table public.accounting_closing_periods enable row level security;

create policy "org_member_accounting_closing_periods" on public.accounting_closing_periods
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

-- Funcion para generar numero de asiento por diario (atomic)
create or replace function public.next_entry_number(
  target_journal_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  result_number integer;
  journal_org_id uuid;
begin
  select organization_id into journal_org_id
    from public.accounting_journals
   where id = target_journal_id;

  if not found then
    raise exception 'Diario no encontrado: %', target_journal_id;
  end if;

  if not app_private.is_org_member(journal_org_id) then
    raise exception 'No autorizado';
  end if;

  update public.accounting_journals
     set last_entry_number = last_entry_number + 1
   where id = target_journal_id
  returning last_entry_number into result_number;

  return result_number;
end;
$$;

revoke all on function public.next_entry_number(uuid) from public;
revoke all on function public.next_entry_number(uuid) from anon;
grant execute on function public.next_entry_number(uuid) to authenticated;

-- Seed diarios por defecto al crear la primera org (helper function)
-- Los diarios se crean desde la UI o con la funcion seed_default_journals
create or replace function public.seed_default_journals(
  target_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if not app_private.is_org_member(target_organization_id) then
    raise exception 'No autorizado';
  end if;

  insert into public.accounting_journals (organization_id, code, name)
  values
    (target_organization_id, 'GEN', 'Operaciones generales'),
    (target_organization_id, 'VEN', 'Facturas emitidas'),
    (target_organization_id, 'COM', 'Facturas recibidas'),
    (target_organization_id, 'BAN', 'Banco'),
    (target_organization_id, 'CAJ', 'Caja')
  on conflict (organization_id, upper(code)) do nothing;
end;
$$;

revoke all on function public.seed_default_journals(uuid) from public;
revoke all on function public.seed_default_journals(uuid) from anon;
grant execute on function public.seed_default_journals(uuid) to authenticated;
