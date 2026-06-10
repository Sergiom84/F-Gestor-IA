alter table public.document_series
  drop constraint if exists document_series_doc_type_check;

alter table public.document_series
  add constraint document_series_doc_type_check
  check (doc_type in ('sales_invoice', 'sales_quote', 'sales_order'));

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
  if target_doc_type not in ('sales_invoice', 'sales_quote', 'sales_order') then
    raise exception 'Tipo de documento no soportado: %', target_doc_type;
  end if;

  if not app_private.is_org_member(target_organization_id) then
    raise exception 'No autorizado para generar numeracion en esta organizacion';
  end if;

  if clean_prefix = '' then
    clean_prefix := case
      when target_doc_type = 'sales_quote' then 'PRES'
      when target_doc_type = 'sales_order' then 'PED'
      else 'VENTA'
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
