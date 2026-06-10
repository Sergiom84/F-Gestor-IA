create or replace function public.ensure_sales_client(
  p_organization_id uuid,
  p_name text,
  p_email text default null,
  p_phone text default null,
  p_irpf_rate numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := nullif(trim(p_name), '');
  existing_client_id uuid;
  inserted_client_id uuid;
  next_code text;
begin
  if current_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if normalized_name is null then
    raise exception 'client name required';
  end if;

  if not app_private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'accountant']::public.organization_role[]
  ) then
    raise exception 'insufficient organization permissions';
  end if;

  select id
  into existing_client_id
  from public.clients
  where organization_id = p_organization_id
    and lower(name) = lower(normalized_name)
    and deleted_at is null
  order by created_at asc
  limit 1;

  if existing_client_id is not null then
    return existing_client_id;
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
    contact_email,
    contact_phone,
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
    'company',
    nullif(trim(p_email), ''),
    nullif(trim(p_phone), ''),
    'ES',
    coalesce(p_irpf_rate, 0) > 0,
    coalesce(p_irpf_rate, 0),
    'active',
    current_user_id
  )
  returning id into inserted_client_id;

  return inserted_client_id;
end;
$$;

grant execute on function public.ensure_sales_client(uuid, text, text, text, numeric) to authenticated;
