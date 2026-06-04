alter function app_private.set_updated_at()
  set search_path = public, pg_temp;

alter function app_private.storage_object_organization_id(text)
  set search_path = public, pg_temp;

alter function app_private.storage_object_fiscal_entity_id(text)
  set search_path = public, pg_temp;
