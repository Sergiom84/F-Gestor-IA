create or replace function public.ensure_default_fiscal_entity(p_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  existing_entity_id uuid;
  inserted_client_id uuid;
  inserted_entity_id uuid;
  organization_record record;
begin
  if current_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if not app_private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'accountant']::public.organization_role[]
  ) then
    raise exception 'insufficient organization permissions';
  end if;

  select id
  into existing_entity_id
  from public.fiscal_entities
  where organization_id = p_organization_id
    and deleted_at is null
  order by created_at asc
  limit 1;

  if existing_entity_id is not null then
    return existing_entity_id;
  end if;

  select name, billing_email, country
  into organization_record
  from public.organizations
  where id = p_organization_id;

  if organization_record.name is null then
    raise exception 'organization not found';
  end if;

  insert into public.clients (
    organization_id,
    name,
    type,
    contact_email,
    status,
    notes,
    created_by
  )
  values (
    p_organization_id,
    coalesce(nullif(trim(organization_record.name), ''), 'Entidad fiscal'),
    'company',
    organization_record.billing_email,
    'active',
    'Cliente interno creado automaticamente para emitir presupuestos y facturas.',
    current_user_id
  )
  returning id into inserted_client_id;

  insert into public.fiscal_entities (
    organization_id,
    client_id,
    legal_name,
    tax_id_country,
    entity_type,
    country,
    status,
    created_by
  )
  values (
    p_organization_id,
    inserted_client_id,
    coalesce(nullif(trim(organization_record.name), ''), 'Entidad fiscal'),
    'ES',
    'company',
    coalesce(organization_record.country, 'ES'),
    'active',
    current_user_id
  )
  returning id into inserted_entity_id;

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
    p_organization_id,
    inserted_entity_id,
    current_user_id,
    'uploader',
    true,
    'active',
    current_user_id
  )
  on conflict (fiscal_entity_id, user_id) do nothing;

  return inserted_entity_id;
end;
$$;

grant execute on function public.ensure_default_fiscal_entity(uuid) to authenticated;
