create or replace function public.create_onboarding_workspace(
  p_organization_name text,
  p_client_name text,
  p_fiscal_entity_legal_name text,
  p_fiscal_entity_tax_id text default null,
  p_client_type public.client_type default 'company',
  p_fiscal_entity_type public.fiscal_entity_type default 'company'
)
returns table (
  organization_id uuid,
  client_id uuid,
  fiscal_entity_id uuid
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  organization_name text := btrim(coalesce(p_organization_name, ''));
  client_name text := btrim(coalesce(p_client_name, ''));
  fiscal_entity_legal_name text := btrim(coalesce(p_fiscal_entity_legal_name, ''));
  fiscal_entity_tax_id text := nullif(btrim(coalesce(p_fiscal_entity_tax_id, '')), '');
  base_slug text;
  candidate_slug text;
  suffix integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(organization_name) < 2 then
    raise exception 'Organization name must have at least 2 characters';
  end if;

  if length(client_name) < 2 then
    raise exception 'Client name must have at least 2 characters';
  end if;

  if length(fiscal_entity_legal_name) < 2 then
    raise exception 'Fiscal entity legal name must have at least 2 characters';
  end if;

  select u.email
  into current_user_email
  from auth.users u
  where u.id = current_user_id;

  base_slug := lower(regexp_replace(organization_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := left(coalesce(nullif(base_slug, ''), 'organizacion'), 48);
  candidate_slug := base_slug;

  while exists (
    select 1
    from public.organizations o
    where o.slug = candidate_slug
  ) loop
    suffix := suffix + 1;
    candidate_slug := left(base_slug, 48) || '-' || suffix::text;
  end loop;

  insert into public.organizations (
    name,
    slug,
    billing_email,
    country,
    default_currency,
    plan,
    status,
    created_by
  )
  values (
    organization_name,
    candidate_slug,
    current_user_email,
    'ES',
    'EUR',
    'free',
    'active',
    current_user_id
  )
  returning id into organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    email,
    role,
    status,
    joined_at
  )
  values (
    organization_id,
    current_user_id,
    current_user_email,
    'owner',
    'active',
    now()
  );

  insert into public.clients (
    organization_id,
    name,
    type,
    status,
    created_by
  )
  values (
    organization_id,
    client_name,
    p_client_type,
    'active',
    current_user_id
  )
  returning id into client_id;

  insert into public.fiscal_entities (
    organization_id,
    client_id,
    legal_name,
    tax_id,
    tax_id_country,
    entity_type,
    country,
    status,
    created_by
  )
  values (
    organization_id,
    client_id,
    fiscal_entity_legal_name,
    fiscal_entity_tax_id,
    'ES',
    p_fiscal_entity_type,
    'ES',
    'active',
    current_user_id
  )
  returning id into fiscal_entity_id;

  insert into public.fiscal_entity_members (
    organization_id,
    fiscal_entity_id,
    user_id,
    access_role,
    can_upload,
    status,
    created_by
  )
  values (
    organization_id,
    fiscal_entity_id,
    current_user_id,
    'uploader',
    true,
    'active',
    current_user_id
  );

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      updated_at = now()
  where id = current_user_id;

  return next;
end;
$$;

revoke all on function public.create_onboarding_workspace(
  text,
  text,
  text,
  text,
  public.client_type,
  public.fiscal_entity_type
) from public;

grant execute on function public.create_onboarding_workspace(
  text,
  text,
  text,
  text,
  public.client_type,
  public.fiscal_entity_type
) to authenticated;
