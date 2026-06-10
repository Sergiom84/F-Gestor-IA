create table if not exists public.sales_delivery_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  note_number text,
  note_date date,
  reference text,
  currency text not null default 'EUR',
  status public.commercial_document_status not null default 'open',
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
  constraint sales_delivery_notes_org_matches_fiscal_entity
    check (organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)),
  constraint sales_delivery_notes_retention_rate_range
    check (retention_rate >= 0 and retention_rate <= 100),
  constraint sales_delivery_notes_non_negative_suplido
    check (suplido_amount >= 0)
);

create table if not exists public.sales_delivery_note_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_delivery_note_id uuid not null references public.sales_delivery_notes(id) on delete cascade,
  line_index integer not null default 0,
  description text not null default '',
  quantity numeric(12, 4) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 21,
  discount_rate numeric(5, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sales_delivery_notes enable row level security;
alter table public.sales_delivery_note_lines enable row level security;

create policy "org_member_delivery_notes" on public.sales_delivery_notes
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

create policy "org_member_delivery_note_lines" on public.sales_delivery_note_lines
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

alter table public.document_series
  drop constraint if exists document_series_doc_type_check;

alter table public.document_series
  add constraint document_series_doc_type_check
  check (doc_type in ('sales_invoice', 'sales_quote', 'sales_order', 'sales_delivery_note'));

create or replace function public.next_document_number(
  target_organization_id uuid,
  target_doc_type text,
  target_prefix text default null
)
returns text
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  target_year integer := extract(year from (now() at time zone 'Europe/Madrid'))::integer;
  assigned_number bigint;
  clean_prefix text := upper(regexp_replace(coalesce(target_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if target_doc_type not in ('sales_invoice', 'sales_quote', 'sales_order', 'sales_delivery_note') then
    raise exception 'Tipo de documento no soportado: %', target_doc_type;
  end if;

  if not app_private.is_org_member(target_organization_id) then
    raise exception 'No autorizado para generar numeracion en esta organizacion';
  end if;

  if clean_prefix = '' then
    clean_prefix := case
      when target_doc_type = 'sales_quote' then 'PRES'
      when target_doc_type = 'sales_order' then 'PED'
      when target_doc_type = 'sales_delivery_note' then 'ALB'
      else 'FAC'
    end;
  end if;

  insert into public.document_series (organization_id, doc_type, series_prefix, fiscal_year, next_number)
  values (target_organization_id, target_doc_type, clean_prefix, target_year, 1)
  on conflict (organization_id, doc_type, series_prefix, fiscal_year) do nothing;

  update public.document_series
     set next_number = next_number + 1
   where organization_id = target_organization_id
     and doc_type = target_doc_type
     and series_prefix = clean_prefix
     and fiscal_year = target_year
  returning next_number - 1 into assigned_number;

  return clean_prefix || '-' || target_year::text || '-' || lpad(assigned_number::text, 4, '0');
end;
$$;

revoke all on function public.next_document_number(uuid, text, text) from public;
revoke all on function public.next_document_number(uuid, text, text) from anon;
grant execute on function public.next_document_number(uuid, text, text) to authenticated;
