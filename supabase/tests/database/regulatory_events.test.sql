begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table(
  'public',
  'regulatory_events',
  'regulatory_events table exists'
);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'regulatory_events'
  ),
  'regulatory_events has RLS enabled'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'regulatory_events'
      and policyname = 'regulatory_events_select_allowed'
      and cmd = 'SELECT'
  ),
  1,
  'regulatory_events has a single SELECT RLS policy'
);

select ok(
  has_table_privilege('authenticated', 'public.regulatory_events', 'SELECT'),
  'authenticated can select regulatory_events through RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.regulatory_events', 'INSERT'),
  'authenticated cannot insert regulatory_events'
);

select ok(
  not has_table_privilege('authenticated', 'public.regulatory_events', 'UPDATE'),
  'authenticated cannot update regulatory_events'
);

select ok(
  not has_table_privilege('authenticated', 'public.regulatory_events', 'DELETE'),
  'authenticated cannot delete regulatory_events'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000101', 'owner-a@gfiscal.test'),
  ('00000000-0000-0000-0000-000000000102', 'owner-b@gfiscal.test');

insert into public.organizations (id, name, slug, created_by)
values
  ('00000000-0000-0000-0000-000000000201', 'Org A', 'org-a-regulatory-test', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000202', 'Org B', 'org-b-regulatory-test', '00000000-0000-0000-0000-000000000102');

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'owner', 'active', now()),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 'owner', 'active', now());

insert into public.clients (id, organization_id, name, type, created_by)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'Client A', 'company', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000202', 'Client B', 'company', '00000000-0000-0000-0000-000000000102');

insert into public.fiscal_entities (
  id,
  organization_id,
  client_id,
  legal_name,
  tax_id,
  entity_type,
  created_by
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000301',
    'Fiscal Entity A',
    'B00000001',
    'company',
    '00000000-0000-0000-0000-000000000101'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000302',
    'Fiscal Entity B',
    'B00000002',
    'company',
    '00000000-0000-0000-0000-000000000102'
  );

insert into public.invoices (
  id,
  organization_id,
  fiscal_entity_id,
  client_id,
  direction,
  supplier_tax_id,
  customer_tax_id,
  invoice_number,
  issue_date,
  currency,
  subtotal_amount,
  tax_amount,
  total_amount,
  status,
  human_approved_by,
  human_approved_at
)
values
  (
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    'issued',
    'B00000001',
    'B99999991',
    'A-2026-0001',
    '2026-06-03',
    'EUR',
    100,
    21,
    121,
    'draft',
    '00000000-0000-0000-0000-000000000101',
    '2026-06-03T10:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000302',
    'issued',
    'B00000002',
    'B99999992',
    'B-2026-0001',
    '2026-06-03',
    'EUR',
    200,
    42,
    242,
    'draft',
    '00000000-0000-0000-0000-000000000102',
    '2026-06-03T10:00:00Z'
  );

insert into public.regulatory_events (
  id,
  organization_id,
  fiscal_entity_id,
  invoice_id,
  event_type,
  occurred_at,
  actor_user_id,
  actor_role,
  actor_system_id,
  payload,
  previous_hash,
  hash
)
values
  (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000501',
    'verifactu.record_prepared',
    '2026-06-03T10:05:00Z',
    '00000000-0000-0000-0000-000000000101',
    'owner',
    'gfiscal-test',
    '{"invoice_id":"00000000-0000-0000-0000-000000000501"}'::jsonb,
    null,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ),
  (
    '00000000-0000-0000-0000-000000000602',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000502',
    'verifactu.record_prepared',
    '2026-06-03T10:05:00Z',
    '00000000-0000-0000-0000-000000000102',
    'owner',
    'gfiscal-test',
    '{"invoice_id":"00000000-0000-0000-0000-000000000502"}'::jsonb,
    null,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  );

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';

select is(
  (select count(*)::integer from public.regulatory_events),
  1,
  'owner A only sees own regulatory event'
);

reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';

select is(
  (select count(*)::integer from public.regulatory_events),
  1,
  'owner B only sees own regulatory event'
);

reset role;

create temp table gfiscal_regulatory_test_results (
  name text primary key,
  passed boolean not null
) on commit drop;

do $$
begin
  update public.regulatory_events
  set payload = payload || '{"tampered":true}'::jsonb
  where id = '00000000-0000-0000-0000-000000000601';

  insert into gfiscal_regulatory_test_results (name, passed)
  values ('update_blocked', false);
exception when others then
  insert into gfiscal_regulatory_test_results (name, passed)
  values ('update_blocked', sqlerrm like '%append-only%');
end;
$$;

select ok(
  (select passed from gfiscal_regulatory_test_results where name = 'update_blocked'),
  'regulatory_events update is blocked by trigger'
);

do $$
begin
  delete from public.regulatory_events
  where id = '00000000-0000-0000-0000-000000000601';

  insert into gfiscal_regulatory_test_results (name, passed)
  values ('delete_blocked', false);
exception when others then
  insert into gfiscal_regulatory_test_results (name, passed)
  values ('delete_blocked', sqlerrm like '%append-only%');
end;
$$;

select ok(
  (select passed from gfiscal_regulatory_test_results where name = 'delete_blocked'),
  'regulatory_events delete is blocked by trigger'
);

do $$
begin
  insert into public.regulatory_events (
    id,
    organization_id,
    fiscal_entity_id,
    invoice_id,
    event_type,
    occurred_at,
    actor_user_id,
    actor_role,
    actor_system_id,
    payload,
    previous_hash,
    hash
  )
  values (
    '00000000-0000-0000-0000-000000000603',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000501',
    'verifactu.record_exported',
    '2026-06-03T10:10:00Z',
    '00000000-0000-0000-0000-000000000101',
    'owner',
    'gfiscal-test',
    '{"invoice_id":"00000000-0000-0000-0000-000000000501"}'::jsonb,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
  );

  insert into gfiscal_regulatory_test_results (name, passed)
  values ('cross_invoice_previous_hash_blocked', false);
exception when others then
  insert into gfiscal_regulatory_test_results (name, passed)
  values ('cross_invoice_previous_hash_blocked', sqlerrm like '%another organization%' or sqlerrm like '%another invoice%');
end;
$$;

select ok(
  (select passed from gfiscal_regulatory_test_results where name = 'cross_invoice_previous_hash_blocked'),
  'previous_hash from another invoice or tenant is blocked'
);

select * from finish();

rollback;
