create or replace function app_private.storage_object_fiscal_entity_matches_organization(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  path_organization_id uuid;
  path_fiscal_entity_id uuid;
  real_organization_id uuid;
begin
  path_organization_id := app_private.storage_object_organization_id(object_name);
  path_fiscal_entity_id := app_private.storage_object_fiscal_entity_id(object_name);

  if path_organization_id is null or path_fiscal_entity_id is null then
    return false;
  end if;

  real_organization_id := app_private.fiscal_entity_organization_id(path_fiscal_entity_id);

  return real_organization_id = path_organization_id;
end;
$$;

drop policy if exists storage_document_files_select_allowed on storage.objects;
drop policy if exists storage_document_files_insert_uploaders on storage.objects;
drop policy if exists storage_document_files_update_accountants on storage.objects;
drop policy if exists storage_document_files_delete_admins on storage.objects;

create policy storage_document_files_select_allowed
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.storage_object_fiscal_entity_matches_organization(name)
    and app_private.can_access_fiscal_entity(app_private.storage_object_fiscal_entity_id(name))
  );

create policy storage_document_files_insert_uploaders
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'document-files'
    and app_private.storage_object_fiscal_entity_matches_organization(name)
    and app_private.can_upload_to_fiscal_entity(app_private.storage_object_fiscal_entity_id(name))
  );

create policy storage_document_files_update_accountants
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.storage_object_fiscal_entity_matches_organization(name)
    and app_private.has_org_role(
      app_private.storage_object_organization_id(name),
      array['owner', 'admin', 'accountant']::public.organization_role[]
    )
  )
  with check (
    bucket_id = 'document-files'
    and app_private.storage_object_fiscal_entity_matches_organization(name)
    and app_private.has_org_role(
      app_private.storage_object_organization_id(name),
      array['owner', 'admin', 'accountant']::public.organization_role[]
    )
  );

create policy storage_document_files_delete_admins
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.storage_object_fiscal_entity_matches_organization(name)
    and app_private.has_org_role(
      app_private.storage_object_organization_id(name),
      array['owner', 'admin']::public.organization_role[]
    )
  );
