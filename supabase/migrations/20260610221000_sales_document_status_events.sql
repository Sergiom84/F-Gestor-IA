create table if not exists public.sales_document_status_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_kind text not null check (document_kind in ('quote', 'invoice')),
  document_id uuid not null,
  status text not null check (status in ('draft', 'open', 'booked', 'sent', 'accepted', 'rejected', 'overdue', 'paid', 'cancelled')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sales_document_status_events_document_idx
  on public.sales_document_status_events (document_kind, document_id, created_at desc);

create index if not exists sales_document_status_events_org_idx
  on public.sales_document_status_events (organization_id, status)
  where deleted_at is null;

alter table public.sales_document_status_events enable row level security;

drop trigger if exists sales_document_status_events_set_updated_at on public.sales_document_status_events;
create trigger sales_document_status_events_set_updated_at
  before update on public.sales_document_status_events
  for each row
  execute function app_private.set_updated_at();

create policy sales_document_status_events_select_allowed
  on public.sales_document_status_events
  for select
  using (
    deleted_at is null
    and organization_id in (
      select organization_members.organization_id
      from public.organization_members
      where organization_members.user_id = auth.uid()
        and organization_members.status = 'active'::membership_status
    )
  );

create policy sales_document_status_events_manage_accountants
  on public.sales_document_status_events
  for all
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

grant select, insert, update, delete on public.sales_document_status_events to authenticated;
grant all privileges on public.sales_document_status_events to service_role;
