-- GFiscal regulatory ledger persistence
-- Phase 10: append-only internal events, not official submission payloads.

create type public.regulatory_event_type as enum (
  'invoice.draft_prepared',
  'invoice.issued',
  'invoice.corrected',
  'invoice.cancelled',
  'verifactu.record_prepared',
  'verifactu.record_exported',
  'verifactu.record_submitted',
  'b2b_einvoice.prepared',
  'b2b_einvoice.sent',
  'b2b_einvoice.status_received',
  'regulatory.export_generated'
);

create table public.regulatory_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  event_type public.regulatory_event_type not null,
  occurred_at timestamptz not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.organization_role,
  actor_system_id text not null default 'gfiscal',
  payload jsonb not null default '{}'::jsonb,
  previous_hash text,
  hash text not null,
  ledger_version text not null default 'regulatory_ledger_v1',
  row_version text not null default 'regulatory_event_row_v1',
  export_format text not null default 'gfiscal_regulatory_json_v1',
  official_submission_ready boolean not null default false,
  created_at timestamptz not null default now(),
  constraint regulatory_events_hash_format check (hash ~ '^[0-9a-f]{64}$'),
  constraint regulatory_events_previous_hash_format check (
    previous_hash is null or previous_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint regulatory_events_no_self_hash check (
    previous_hash is null or previous_hash <> hash
  ),
  constraint regulatory_events_ledger_version_check check (ledger_version = 'regulatory_ledger_v1'),
  constraint regulatory_events_row_version_check check (row_version = 'regulatory_event_row_v1'),
  constraint regulatory_events_export_format_check check (export_format = 'gfiscal_regulatory_json_v1'),
  constraint regulatory_events_not_official_submission check (official_submission_ready = false),
  constraint regulatory_events_hash_unique unique (hash),
  constraint regulatory_events_invoice_hash_unique unique (invoice_id, hash),
  constraint regulatory_events_invoice_organization_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id),
  constraint regulatory_events_entity_organization_fk
    foreign key (fiscal_entity_id, organization_id)
    references public.fiscal_entities(id, organization_id),
  constraint regulatory_events_previous_hash_fk
    foreign key (previous_hash)
    references public.regulatory_events(hash)
);

create unique index regulatory_events_first_event_unique
  on public.regulatory_events (invoice_id)
  where previous_hash is null;

create unique index regulatory_events_previous_hash_unique
  on public.regulatory_events (invoice_id, previous_hash)
  where previous_hash is not null;

create index regulatory_events_org_invoice_occurred_idx
  on public.regulatory_events (organization_id, invoice_id, occurred_at);

create index regulatory_events_org_entity_occurred_idx
  on public.regulatory_events (organization_id, fiscal_entity_id, occurred_at);

create index regulatory_events_org_type_occurred_idx
  on public.regulatory_events (organization_id, event_type, occurred_at);

create or replace function app_private.validate_regulatory_event_append()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  invoice_record record;
  previous_event record;
begin
  select i.organization_id, i.fiscal_entity_id
  into invoice_record
  from public.invoices i
  where i.id = new.invoice_id
    and i.deleted_at is null;

  if invoice_record.organization_id is null then
    raise exception 'regulatory event invoice is missing or deleted';
  end if;

  if new.organization_id <> invoice_record.organization_id then
    raise exception 'regulatory event organization_id does not match invoice';
  end if;

  if new.fiscal_entity_id <> invoice_record.fiscal_entity_id then
    raise exception 'regulatory event fiscal_entity_id does not match invoice';
  end if;

  if new.previous_hash is not null then
    select re.organization_id, re.invoice_id, re.occurred_at
    into previous_event
    from public.regulatory_events re
    where re.hash = new.previous_hash;

    if previous_event.organization_id is null then
      raise exception 'regulatory previous_hash does not exist';
    end if;

    if previous_event.organization_id <> new.organization_id then
      raise exception 'regulatory previous_hash belongs to another organization';
    end if;

    if previous_event.invoice_id <> new.invoice_id then
      raise exception 'regulatory previous_hash belongs to another invoice';
    end if;

    if new.occurred_at < previous_event.occurred_at then
      raise exception 'regulatory event occurred_at is before previous event';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app_private.prevent_regulatory_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'regulatory_events is append-only';
end;
$$;

create trigger validate_regulatory_event_append
  before insert on public.regulatory_events
  for each row execute function app_private.validate_regulatory_event_append();

create trigger prevent_regulatory_event_update
  before update on public.regulatory_events
  for each row execute function app_private.prevent_regulatory_event_mutation();

create trigger prevent_regulatory_event_delete
  before delete on public.regulatory_events
  for each row execute function app_private.prevent_regulatory_event_mutation();

alter table public.regulatory_events enable row level security;

revoke all on public.regulatory_events from anon, authenticated;
grant select on public.regulatory_events to authenticated;
grant select, insert on public.regulatory_events to service_role;

create policy regulatory_events_select_allowed
  on public.regulatory_events
  for select
  to authenticated
  using (app_private.can_access_invoice(invoice_id));
