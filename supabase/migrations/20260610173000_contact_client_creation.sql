create or replace function public.create_contact_client(
  p_organization_id uuid,
  p_name text,
  p_type public.client_type default 'company',
  p_tax_id text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_fiscal_address text default null,
  p_city text default null,
  p_province text default null,
  p_postal_code text default null,
  p_country text default 'ES',
  p_apply_irpf_by_default boolean default false,
  p_default_irpf_rate numeric default 0
)
returns table (
  id uuid,
  code text,
  name text,
  type public.client_type,
  tax_id text,
  contact_email text,
  contact_phone text,
  fiscal_address text,
  city text,
  province text,
  postal_code text,
  country text,
  apply_irpf_by_default boolean,
  default_irpf_rate numeric
)
language plpgsql
security definer
set search_path = public, auth, app_private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := nullif(trim(p_name), '');
  normalized_country text := upper(left(coalesce(nullif(trim(p_country), ''), 'ES'), 2));
  next_code text;
  inserted_row public.clients%rowtype;
begin
  if current_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if normalized_name is null then
    raise exception 'client name required';
  end if;

  if not app_private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]
  ) then
    raise exception 'insufficient organization permissions';
  end if;

  next_code := 'CLI-' || lpad((
    select (count(*) + 1)::text
    from public.clients
    where organization_id = p_organization_id
  ), 4, '0');

  insert into public.clients (
    organization_id,
    code,
    name,
    type,
    tax_id,
    contact_email,
    contact_phone,
    fiscal_address,
    city,
    province,
    postal_code,
    country,
    apply_irpf_by_default,
    default_irpf_rate,
    status,
    created_by
  )
  values (
    p_organization_id,
    next_code,
    normalized_name,
    coalesce(p_type, 'company'),
    nullif(trim(p_tax_id), ''),
    nullif(trim(p_contact_email), ''),
    nullif(trim(p_contact_phone), ''),
    nullif(trim(p_fiscal_address), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_province), ''),
    nullif(trim(p_postal_code), ''),
    normalized_country,
    coalesce(p_apply_irpf_by_default, false),
    case
      when coalesce(p_apply_irpf_by_default, false) then greatest(coalesce(p_default_irpf_rate, 0), 0)
      else 0
    end,
    'active',
    current_user_id
  )
  returning * into inserted_row;

  return query
  select
    inserted_row.id,
    inserted_row.code,
    inserted_row.name,
    inserted_row.type,
    inserted_row.tax_id,
    inserted_row.contact_email,
    inserted_row.contact_phone,
    inserted_row.fiscal_address,
    inserted_row.city,
    inserted_row.province,
    inserted_row.postal_code,
    inserted_row.country,
    inserted_row.apply_irpf_by_default,
    inserted_row.default_irpf_rate;
end;
$$;

grant execute on function public.create_contact_client(
  uuid,
  text,
  public.client_type,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  numeric
) to authenticated;

drop policy if exists clients_insert_accountants on public.clients;
create policy clients_insert_accountants
  on public.clients
  for insert
  to authenticated
  with check (
    app_private.has_org_role(
      organization_id,
      array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]
    )
  );

drop policy if exists clients_update_accountants on public.clients;
create policy clients_update_accountants
  on public.clients
  for update
  to authenticated
  using (
    app_private.has_org_role(
      organization_id,
      array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]
    )
  )
  with check (
    app_private.has_org_role(
      organization_id,
      array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]
    )
  );
