-- Quotes module: documents and per-organization config
-- quotes_documents stores every Quote object (quote / invoice / pdfInvoice)
-- quotes_config stores the company-level AppConfig (name, logo, colors, etc.)

create table if not exists quotes_documents (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  document_type text not null check (document_type in ('quote', 'invoice', 'pdfInvoice')),
  quote_number  text,
  client_name   text,
  date          text,
  due_date      text,
  total_amount  numeric(14, 2) default 0,
  payload       jsonb not null,           -- full Quote object
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists quotes_documents_org_idx  on quotes_documents (organization_id);
create index if not exists quotes_documents_type_idx on quotes_documents (organization_id, document_type);

alter table quotes_documents enable row level security;

create policy "org members read own quotes"
  on quotes_documents for select
  using (
    organization_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "org members insert own quotes"
  on quotes_documents for insert
  with check (
    organization_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "org members update own quotes"
  on quotes_documents for update
  using (
    organization_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "org members delete own quotes"
  on quotes_documents for delete
  using (
    organization_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

-- Trigger: keep updated_at fresh
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotes_documents_updated_at
  before update on quotes_documents
  for each row execute function touch_updated_at();

-- quotes_config: one row per organization (upsert pattern)
create table if not exists quotes_config (
  organization_id uuid primary key references organizations(id) on delete cascade,
  payload         jsonb not null default '{}',
  updated_at      timestamptz not null default now()
);

alter table quotes_config enable row level security;

create policy "org members read own config"
  on quotes_config for select
  using (
    organization_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "org members upsert own config"
  on quotes_config for insert
  with check (
    organization_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "org members update own config"
  on quotes_config for update
  using (
    organization_id in (
      select organization_id
      from organization_members
      where user_id = auth.uid()
        and status = 'active'
    )
  );

create trigger quotes_config_updated_at
  before update on quotes_config
  for each row execute function touch_updated_at();
