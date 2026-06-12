drop policy if exists employees_manage_accountants on public.employees;

create policy employees_insert_accountants
  on public.employees
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy employees_update_accountants
  on public.employees
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy employees_delete_accountants
  on public.employees
  for delete
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));
