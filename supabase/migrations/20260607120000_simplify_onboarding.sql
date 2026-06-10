-- Simplify onboarding: the manager registers their workspace (organization) only.
-- Clients are added manually from the Contacts section afterward.
-- Drop the old overloaded function and replace with a minimal version.

drop function if exists public.create_onboarding_workspace(
  text, text, text, text,
  public.client_type,
  public.fiscal_entity_type
);

create or replace function public.create_onboarding_workspace(
  p_organization_name text
)
returns table (organization_id uuid)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  organization_name text := btrim(coalesce(p_organization_name, ''));
  base_slug text;
  candidate_slug text;
  suffix integer := 0;
  new_org_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(organization_name) < 2 then
    raise exception 'Organization name must have at least 2 characters';
  end if;

  select u.email into current_user_email
  from auth.users u
  where u.id = current_user_id;

  base_slug := lower(regexp_replace(organization_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := left(coalesce(nullif(base_slug, ''), 'organizacion'), 48);
  candidate_slug := base_slug;

  while exists (
    select 1 from public.organizations o where o.slug = candidate_slug
  ) loop
    suffix := suffix + 1;
    candidate_slug := left(base_slug, 48) || '-' || suffix::text;
  end loop;

  insert into public.organizations (
    name, slug, billing_email, country, default_currency, plan, status, created_by
  )
  values (
    organization_name, candidate_slug, current_user_email,
    'ES', 'EUR', 'free', 'active', current_user_id
  )
  returning id into new_org_id;

  insert into public.organization_members (
    organization_id, user_id, email, role, status, joined_at
  )
  values (
    new_org_id, current_user_id, current_user_email, 'owner', 'active', now()
  );

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      updated_at = now()
  where id = current_user_id;

  organization_id := new_org_id;
  return next;
end;
$$;

revoke all on function public.create_onboarding_workspace(text) from public;
grant execute on function public.create_onboarding_workspace(text) to authenticated;
