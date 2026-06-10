create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  adjustment_type text not null default 'fixed_price'
    check (adjustment_type in ('fixed_price', 'percentage_discount', 'tiered')),
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists price_lists_org_code_unique
  on public.price_lists (organization_id, lower(code))
  where deleted_at is null;

create index if not exists price_lists_organization_active_idx
  on public.price_lists (organization_id, is_active)
  where deleted_at is null;

create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  product_service_id uuid references public.products_services(id) on delete set null,
  unit_price numeric(14, 4),
  discount_rate numeric(5, 2),
  created_at timestamptz not null default now()
);

create index if not exists price_list_items_list_idx
  on public.price_list_items (price_list_id);

alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;

create policy "org_member_price_lists" on public.price_lists
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

create policy "org_member_price_list_items" on public.price_list_items
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

create table if not exists public.discount_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists discount_groups_org_code_unique
  on public.discount_groups (organization_id, lower(code))
  where deleted_at is null;

create index if not exists discount_groups_organization_active_idx
  on public.discount_groups (organization_id, is_active)
  where deleted_at is null;

create table if not exists public.discount_group_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  discount_group_id uuid not null references public.discount_groups(id) on delete cascade,
  product_service_id uuid references public.products_services(id) on delete set null,
  discount_rate numeric(5, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists discount_group_items_group_idx
  on public.discount_group_items (discount_group_id);

alter table public.discount_groups enable row level security;
alter table public.discount_group_items enable row level security;

create policy "org_member_discount_groups" on public.discount_groups
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

create policy "org_member_discount_group_items" on public.discount_group_items
  for all to authenticated
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));
