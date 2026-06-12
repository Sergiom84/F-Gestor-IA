create type public.employee_status as enum ('active', 'archived');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  tax_id text,
  contact_email text,
  contact_phone text,
  role text,
  department text,
  status public.employee_status not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index employees_org_code_unique
  on public.employees (organization_id, lower(code))
  where code is not null and deleted_at is null;

create unique index employees_org_tax_id_unique
  on public.employees (organization_id, lower(tax_id))
  where tax_id is not null and deleted_at is null;

create index employees_organization_status_idx
  on public.employees (organization_id, status)
  where deleted_at is null;

alter table public.employees enable row level security;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function app_private.set_updated_at();

create policy employees_select_members
  on public.employees
  for select
  to authenticated
  using (app_private.is_org_member(organization_id));

create policy employees_manage_accountants
  on public.employees
  for all
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

grant select, insert, update, delete on public.employees to authenticated;
grant all privileges on public.employees to service_role;
