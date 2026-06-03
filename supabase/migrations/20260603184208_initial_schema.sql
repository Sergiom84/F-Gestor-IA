-- GFiscal initial schema
-- Local-first migration. No remote project is touched by this file until db push/apply.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgmq;

create schema if not exists app_private;

revoke all on schema app_private from public;

create type public.organization_role as enum ('owner', 'admin', 'accountant', 'reviewer', 'client');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'removed');
create type public.organization_status as enum ('active', 'suspended', 'deleted');
create type public.organization_plan as enum ('free', 'starter', 'pro', 'enterprise');
create type public.client_type as enum ('individual', 'company');
create type public.client_status as enum ('active', 'archived');
create type public.fiscal_entity_type as enum ('self_employed', 'company', 'other');
create type public.fiscal_entity_status as enum ('active', 'archived');
create type public.fiscal_entity_access_role as enum ('viewer', 'uploader');
create type public.document_type as enum ('unknown', 'invoice_received', 'invoice_issued', 'expense', 'tax_form', 'bank', 'contract', 'other');
create type public.document_source as enum ('manual_upload', 'email', 'api', 'future_integration');
create type public.document_status as enum (
  'uploaded',
  'queued',
  'extracting_text',
  'text_extracted',
  'ocr_required',
  'ocr_processing',
  'ai_processing',
  'ai_processed',
  'needs_review',
  'approved',
  'rejected',
  'failed'
);
create type public.document_file_status as enum ('uploaded', 'available', 'corrupt', 'deleted');
create type public.text_extraction_method as enum ('embedded_text', 'ocr', 'manual');
create type public.extraction_status as enum ('draft', 'valid', 'invalid', 'superseded');
create type public.review_task_status as enum ('open', 'in_review', 'approved', 'rejected', 'changes_requested');
create type public.invoice_direction as enum ('issued', 'received');
create type public.invoice_status as enum ('draft', 'booked', 'void', 'needs_fix');
create type public.tax_period_type as enum ('month', 'quarter', 'year');
create type public.tax_period_status as enum ('open', 'reviewing', 'closed');
create type public.ai_request_status as enum ('pending', 'success', 'schema_error', 'provider_error', 'timeout', 'fallback_used');
create type public.processing_job_type as enum ('extract_text', 'ocr', 'ai_extract', 'classify', 'deduplicate', 'validate');
create type public.processing_job_status as enum ('queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled');

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'es-ES',
  timezone text not null default 'Europe/Madrid',
  avatar_url text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  billing_email text,
  country text not null default 'ES',
  default_currency text not null default 'EUR',
  plan public.organization_plan not null default 'free',
  status public.organization_status not null default 'active',
  ai_monthly_budget_cents integer not null default 0 check (ai_monthly_budget_cents >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  role public.organization_role not null,
  status public.membership_status not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_user_or_email check (user_id is not null or email is not null)
);

create unique index organization_members_unique_user
  on public.organization_members (organization_id, user_id)
  where user_id is not null;

create unique index organization_members_unique_email
  on public.organization_members (organization_id, lower(email))
  where email is not null;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type public.client_type not null,
  contact_email text,
  contact_phone text,
  status public.client_status not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.fiscal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  legal_name text not null,
  trade_name text,
  tax_id text,
  tax_id_country text not null default 'ES',
  entity_type public.fiscal_entity_type not null,
  fiscal_address text,
  province text,
  postal_code text,
  country text not null default 'ES',
  status public.fiscal_entity_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.fiscal_entity_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role public.fiscal_entity_access_role not null default 'viewer',
  can_upload boolean not null default false,
  status public.membership_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_entity_id, user_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  document_type public.document_type not null default 'unknown',
  status public.document_status not null default 'uploaded',
  source public.document_source not null default 'manual_upload',
  title text,
  period_start date,
  period_end date,
  uploaded_by uuid references auth.users(id) on delete set null,
  current_extraction_id uuid,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.document_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  storage_bucket text not null default 'document-files',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256_hash text,
  page_count integer check (page_count is null or page_count >= 0),
  file_status public.document_file_status not null default 'uploaded',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (storage_bucket, storage_path)
);

create unique index document_files_one_primary_per_document
  on public.document_files (document_id)
  where is_primary and deleted_at is null;

create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_file_id uuid not null references public.document_files(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  text text,
  text_quality numeric(5, 2) check (text_quality is null or (text_quality >= 0 and text_quality <= 1)),
  extraction_method public.text_extraction_method not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_file_id, page_number)
);

create table public.document_text_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_page_id uuid references public.document_pages(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  text text not null,
  token_count integer check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  capabilities jsonb not null default '{}'::jsonb,
  default_model text,
  cost_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  model_key text not null,
  display_name text not null,
  enabled boolean not null default true,
  capabilities jsonb not null default '{}'::jsonb,
  input_cost_per_million_tokens_cents numeric(12, 4),
  output_cost_per_million_tokens_cents numeric(12, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_key)
);

create table public.ai_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  prompt_version text not null,
  schema_version text not null,
  provider_key text,
  model_key text,
  system_prompt text not null,
  user_prompt_template text not null,
  response_schema jsonb not null,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_type, prompt_version, schema_version)
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  task_type text not null,
  provider_key text not null,
  model_key text not null,
  prompt_version text,
  schema_version text,
  input_token_count integer check (input_token_count is null or input_token_count >= 0),
  output_token_count integer check (output_token_count is null or output_token_count >= 0),
  estimated_cost_cents numeric(12, 4) check (estimated_cost_cents is null or estimated_cost_cents >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  status public.ai_request_status not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

create table public.ai_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ai_request_id uuid not null references public.ai_requests(id) on delete cascade,
  raw_response jsonb,
  normalized_result_ref uuid,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_cost_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ai_request_id uuid references public.ai_requests(id) on delete set null,
  provider_key text not null,
  model_key text not null,
  estimated_cost_cents numeric(12, 4) not null check (estimated_cost_cents >= 0),
  input_token_count integer not null default 0 check (input_token_count >= 0),
  output_token_count integer not null default 0 check (output_token_count >= 0),
  created_at timestamptz not null default now()
);

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  ai_request_id uuid references public.ai_requests(id) on delete set null,
  ai_response_id uuid references public.ai_responses(id) on delete set null,
  provider_key text,
  model_key text,
  prompt_version text,
  schema_version text,
  normalized_data jsonb not null default '{}'::jsonb,
  confidence_overall numeric(5, 2) check (confidence_overall is null or (confidence_overall >= 0 and confidence_overall <= 1)),
  status public.extraction_status not null default 'draft',
  validation_errors jsonb not null default '[]'::jsonb,
  needs_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
  add constraint documents_current_extraction_fk
  foreign key (current_extraction_id)
  references public.document_extractions(id)
  on delete set null;

create table public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid references public.document_extractions(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  status public.review_task_status not null default 'open',
  priority integer not null default 0,
  reason text,
  due_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  source_document_id uuid references public.documents(id) on delete set null,
  source_extraction_id uuid references public.document_extractions(id) on delete set null,
  direction public.invoice_direction not null,
  supplier_tax_id text,
  customer_tax_id text,
  invoice_number text,
  issue_date date,
  due_date date,
  currency text not null default 'EUR',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  status public.invoice_status not null default 'draft',
  human_approved_by uuid references auth.users(id) on delete set null,
  human_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_index integer not null default 0 check (line_index >= 0),
  description text,
  quantity numeric(14, 4) not null default 1,
  unit_price numeric(14, 4) not null default 0,
  tax_rate numeric(5, 2),
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, line_index)
);

create table public.tax_breakdowns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  tax_rate numeric(5, 2) not null,
  taxable_base numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (invoice_id, tax_rate)
);

create table public.tax_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete cascade,
  period_type public.tax_period_type not null,
  period_start date not null,
  period_end date not null,
  status public.tax_period_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_entity_id, period_type, period_start, period_end)
);

create table public.tax_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_period_id uuid not null references public.tax_periods(id) on delete cascade,
  fiscal_entity_id uuid not null references public.fiscal_entities(id) on delete cascade,
  output_vat numeric(14, 2) not null default 0,
  input_vat numeric(14, 2) not null default 0,
  expense_total numeric(14, 2) not null default 0,
  income_total numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tax_period_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.organization_role,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_snapshot jsonb,
  after_snapshot jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  job_type public.processing_job_type not null,
  status public.processing_job_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  last_error text,
  queue_message_id bigint,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  add constraint clients_id_organization_unique unique (id, organization_id);

alter table public.fiscal_entities
  add constraint fiscal_entities_id_organization_unique unique (id, organization_id),
  add constraint fiscal_entities_id_client_organization_unique unique (id, client_id, organization_id),
  add constraint fiscal_entities_client_organization_fk
    foreign key (client_id, organization_id)
    references public.clients(id, organization_id);

alter table public.fiscal_entity_members
  add constraint fiscal_entity_members_entity_organization_fk
    foreign key (fiscal_entity_id, organization_id)
    references public.fiscal_entities(id, organization_id);

alter table public.documents
  add constraint documents_id_organization_unique unique (id, organization_id),
  add constraint documents_entity_client_organization_fk
    foreign key (fiscal_entity_id, client_id, organization_id)
    references public.fiscal_entities(id, client_id, organization_id);

alter table public.document_files
  add constraint document_files_id_document_organization_unique unique (id, document_id, organization_id),
  add constraint document_files_document_organization_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id);

alter table public.document_pages
  add constraint document_pages_id_document_organization_unique unique (id, document_id, organization_id),
  add constraint document_pages_document_organization_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id),
  add constraint document_pages_file_document_organization_fk
    foreign key (document_file_id, document_id, organization_id)
    references public.document_files(id, document_id, organization_id);

alter table public.document_text_chunks
  add constraint document_text_chunks_document_organization_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id),
  add constraint document_text_chunks_page_document_organization_fk
    foreign key (document_page_id, document_id, organization_id)
    references public.document_pages(id, document_id, organization_id);

alter table public.ai_requests
  add constraint ai_requests_id_organization_unique unique (id, organization_id),
  add constraint ai_requests_document_organization_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id);

alter table public.ai_responses
  add constraint ai_responses_id_organization_unique unique (id, organization_id),
  add constraint ai_responses_request_organization_fk
    foreign key (ai_request_id, organization_id)
    references public.ai_requests(id, organization_id);

alter table public.ai_cost_events
  add constraint ai_cost_events_request_organization_fk
    foreign key (ai_request_id, organization_id)
    references public.ai_requests(id, organization_id);

alter table public.document_extractions
  add constraint document_extractions_id_organization_unique unique (id, organization_id),
  add constraint document_extractions_document_organization_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id),
  add constraint document_extractions_request_organization_fk
    foreign key (ai_request_id, organization_id)
    references public.ai_requests(id, organization_id),
  add constraint document_extractions_response_organization_fk
    foreign key (ai_response_id, organization_id)
    references public.ai_responses(id, organization_id);

alter table public.review_tasks
  add constraint review_tasks_document_organization_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id),
  add constraint review_tasks_extraction_organization_fk
    foreign key (extraction_id, organization_id)
    references public.document_extractions(id, organization_id);

alter table public.invoices
  add constraint invoices_id_organization_unique unique (id, organization_id),
  add constraint invoices_entity_organization_fk
    foreign key (fiscal_entity_id, organization_id)
    references public.fiscal_entities(id, organization_id),
  add constraint invoices_client_organization_fk
    foreign key (client_id, organization_id)
    references public.clients(id, organization_id),
  add constraint invoices_source_document_organization_fk
    foreign key (source_document_id, organization_id)
    references public.documents(id, organization_id),
  add constraint invoices_source_extraction_organization_fk
    foreign key (source_extraction_id, organization_id)
    references public.document_extractions(id, organization_id);

alter table public.invoice_lines
  add constraint invoice_lines_invoice_organization_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id);

alter table public.tax_breakdowns
  add constraint tax_breakdowns_invoice_organization_fk
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id);

alter table public.tax_periods
  add constraint tax_periods_id_organization_unique unique (id, organization_id),
  add constraint tax_periods_entity_organization_fk
    foreign key (fiscal_entity_id, organization_id)
    references public.fiscal_entities(id, organization_id);

alter table public.tax_summaries
  add constraint tax_summaries_period_organization_fk
    foreign key (tax_period_id, organization_id)
    references public.tax_periods(id, organization_id),
  add constraint tax_summaries_entity_organization_fk
    foreign key (fiscal_entity_id, organization_id)
    references public.fiscal_entities(id, organization_id);

alter table public.processing_jobs
  add constraint processing_jobs_document_organization_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id);

create index profiles_display_name_idx on public.profiles (display_name);
create index organization_members_user_idx on public.organization_members (user_id, status);
create index organization_members_org_role_idx on public.organization_members (organization_id, role, status);
create index clients_org_status_idx on public.clients (organization_id, status) where deleted_at is null;
create index fiscal_entities_org_client_idx on public.fiscal_entities (organization_id, client_id) where deleted_at is null;
create index fiscal_entities_tax_id_idx on public.fiscal_entities (organization_id, tax_id) where tax_id is not null;
create index fiscal_entity_members_user_idx on public.fiscal_entity_members (user_id, status);
create index documents_org_entity_status_idx on public.documents (organization_id, fiscal_entity_id, status) where deleted_at is null;
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create index document_files_document_idx on public.document_files (document_id);
create index document_files_hash_idx on public.document_files (organization_id, sha256_hash) where sha256_hash is not null;
create index document_pages_document_idx on public.document_pages (document_id, page_number);
create index document_text_chunks_document_idx on public.document_text_chunks (document_id, chunk_index);
create index document_extractions_document_idx on public.document_extractions (document_id, status);
create index review_tasks_org_status_idx on public.review_tasks (organization_id, status, assigned_to);
create index invoices_org_entity_date_idx on public.invoices (organization_id, fiscal_entity_id, issue_date) where deleted_at is null;
create index invoices_duplicate_lookup_idx on public.invoices (organization_id, supplier_tax_id, invoice_number, issue_date, total_amount) where deleted_at is null;
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id, line_index);
create index tax_breakdowns_invoice_idx on public.tax_breakdowns (invoice_id);
create index tax_periods_entity_period_idx on public.tax_periods (fiscal_entity_id, period_start, period_end);
create index ai_requests_org_document_idx on public.ai_requests (organization_id, document_id, created_at);
create index ai_cost_events_org_created_idx on public.ai_cost_events (organization_id, created_at);
create index audit_logs_org_resource_idx on public.audit_logs (organization_id, resource_type, resource_id, created_at);
create index processing_jobs_org_document_idx on public.processing_jobs (organization_id, document_id, status);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'organizations',
    'organization_members',
    'clients',
    'fiscal_entities',
    'fiscal_entity_members',
    'documents',
    'document_files',
    'ai_providers',
    'ai_models',
    'ai_prompt_templates',
    'document_extractions',
    'review_tasks',
    'invoices',
    'invoice_lines',
    'tax_periods',
    'tax_summaries',
    'processing_jobs'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

create or replace function app_private.has_any_active_membership()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.status = 'active'
  );
$$;

create or replace function app_private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  );
$$;

create or replace function app_private.has_org_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and om.role = any (allowed_roles)
  );
$$;

create or replace function app_private.shares_active_org_with_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = target_user_id
      and theirs.status = 'active'
  );
$$;

create or replace function app_private.fiscal_entity_organization_id(target_fiscal_entity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select fe.organization_id
  from public.fiscal_entities fe
  where fe.id = target_fiscal_entity_id
    and fe.deleted_at is null;
$$;

create or replace function app_private.can_access_fiscal_entity(target_fiscal_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_organization_id uuid;
begin
  select fe.organization_id
  into target_organization_id
  from public.fiscal_entities fe
  where fe.id = target_fiscal_entity_id
    and fe.deleted_at is null;

  if target_organization_id is null then
    return false;
  end if;

  if app_private.has_org_role(
    target_organization_id,
    array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.fiscal_entity_members fem
    join public.organization_members om
      on om.organization_id = fem.organization_id
     and om.user_id = fem.user_id
    where fem.fiscal_entity_id = target_fiscal_entity_id
      and fem.user_id = (select auth.uid())
      and fem.status = 'active'
      and om.status = 'active'
      and om.role = 'client'
  );
end;
$$;

create or replace function app_private.can_upload_to_fiscal_entity(target_fiscal_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_organization_id uuid;
begin
  target_organization_id := app_private.fiscal_entity_organization_id(target_fiscal_entity_id);

  if target_organization_id is null then
    return false;
  end if;

  if app_private.has_org_role(
    target_organization_id,
    array['owner', 'admin', 'accountant']::public.organization_role[]
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.fiscal_entity_members fem
    join public.organization_members om
      on om.organization_id = fem.organization_id
     and om.user_id = fem.user_id
    where fem.fiscal_entity_id = target_fiscal_entity_id
      and fem.user_id = (select auth.uid())
      and fem.status = 'active'
      and fem.can_upload
      and om.status = 'active'
      and om.role = 'client'
  );
end;
$$;

create or replace function app_private.can_access_client(target_client_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_organization_id uuid;
begin
  select c.organization_id
  into target_organization_id
  from public.clients c
  where c.id = target_client_id
    and c.deleted_at is null;

  if target_organization_id is null then
    return false;
  end if;

  if app_private.has_org_role(
    target_organization_id,
    array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.fiscal_entities fe
    where fe.client_id = target_client_id
      and app_private.can_access_fiscal_entity(fe.id)
  );
end;
$$;

create or replace function app_private.can_access_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.documents d
    where d.id = target_document_id
      and d.deleted_at is null
      and app_private.can_access_fiscal_entity(d.fiscal_entity_id)
  );
$$;

create or replace function app_private.can_review_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.documents d
    where d.id = target_document_id
      and d.deleted_at is null
      and app_private.has_org_role(
        d.organization_id,
        array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]
      )
  );
$$;

create or replace function app_private.invoice_fiscal_entity_id(target_invoice_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select i.fiscal_entity_id
  from public.invoices i
  where i.id = target_invoice_id
    and i.deleted_at is null;
$$;

create or replace function app_private.can_access_invoice(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select app_private.can_access_fiscal_entity(app_private.invoice_fiscal_entity_id(target_invoice_id));
$$;

create or replace function app_private.can_manage_invoice(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.invoices i
    where i.id = target_invoice_id
      and i.deleted_at is null
      and app_private.has_org_role(
        i.organization_id,
        array['owner', 'admin', 'accountant']::public.organization_role[]
      )
  );
$$;

create or replace function app_private.storage_object_organization_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  organization_text text;
begin
  if split_part(object_name, '/', 1) <> 'organizations' then
    return null;
  end if;

  organization_text := split_part(object_name, '/', 2);

  if organization_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return organization_text::uuid;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

create or replace function app_private.storage_object_fiscal_entity_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  fiscal_entity_text text;
begin
  if split_part(object_name, '/', 1) <> 'organizations'
     or split_part(object_name, '/', 3) <> 'fiscal-entities' then
    return null;
  end if;

  fiscal_entity_text := split_part(object_name, '/', 4);

  if fiscal_entity_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return fiscal_entity_text::uuid;
  end if;

  return null;
exception when others then
  return null;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'organizations',
    'organization_members',
    'clients',
    'fiscal_entities',
    'fiscal_entity_members',
    'documents',
    'document_files',
    'document_pages',
    'document_text_chunks',
    'ai_providers',
    'ai_models',
    'ai_prompt_templates',
    'ai_requests',
    'ai_responses',
    'ai_cost_events',
    'document_extractions',
    'review_tasks',
    'invoices',
    'invoice_lines',
    'tax_breakdowns',
    'tax_periods',
    'tax_summaries',
    'audit_logs',
    'processing_jobs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy profiles_select_same_org
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or app_private.shares_active_org_with_user(id));

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy organizations_select_members
  on public.organizations
  for select
  to authenticated
  using (app_private.is_org_member(id));

create policy organizations_insert_authenticated
  on public.organizations
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

create policy organizations_update_admins
  on public.organizations
  for update
  to authenticated
  using (app_private.has_org_role(id, array['owner', 'admin']::public.organization_role[]))
  with check (app_private.has_org_role(id, array['owner', 'admin']::public.organization_role[]));

create policy organization_members_select_members
  on public.organization_members
  for select
  to authenticated
  using (app_private.is_org_member(organization_id));

create policy organization_members_insert_admins
  on public.organization_members
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy organization_members_update_admins
  on public.organization_members
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy organization_members_delete_admins
  on public.organization_members
  for delete
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy clients_select_allowed
  on public.clients
  for select
  to authenticated
  using (app_private.can_access_client(id));

create policy clients_insert_accountants
  on public.clients
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy clients_update_accountants
  on public.clients
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy fiscal_entities_select_allowed
  on public.fiscal_entities
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(id));

create policy fiscal_entities_insert_accountants
  on public.fiscal_entities
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy fiscal_entities_update_accountants
  on public.fiscal_entities
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy fiscal_entity_members_select_allowed
  on public.fiscal_entity_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[])
  );

create policy fiscal_entity_members_insert_accountants
  on public.fiscal_entity_members
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy fiscal_entity_members_update_accountants
  on public.fiscal_entity_members
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy fiscal_entity_members_delete_accountants
  on public.fiscal_entity_members
  for delete
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy documents_select_allowed
  on public.documents
  for select
  to authenticated
  using (app_private.can_access_document(id));

create policy documents_insert_uploaders
  on public.documents
  for insert
  to authenticated
  with check (
    app_private.can_upload_to_fiscal_entity(fiscal_entity_id)
    and organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)
  );

create policy documents_update_reviewers
  on public.documents
  for update
  to authenticated
  using (app_private.can_review_document(id))
  with check (
    app_private.can_review_document(id)
    and organization_id = app_private.fiscal_entity_organization_id(fiscal_entity_id)
  );

create policy document_files_select_allowed
  on public.document_files
  for select
  to authenticated
  using (app_private.can_access_document(document_id));

create policy document_files_insert_uploaders
  on public.document_files
  for insert
  to authenticated
  with check (
    app_private.can_upload_to_fiscal_entity(
      (select d.fiscal_entity_id from public.documents d where d.id = document_id)
    )
    and organization_id = (
      select d.organization_id from public.documents d where d.id = document_id
    )
  );

create policy document_files_update_accountants
  on public.document_files
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy document_pages_select_allowed
  on public.document_pages
  for select
  to authenticated
  using (app_private.can_access_document(document_id));

create policy document_text_chunks_select_allowed
  on public.document_text_chunks
  for select
  to authenticated
  using (app_private.can_access_document(document_id));

create policy ai_providers_select_members
  on public.ai_providers
  for select
  to authenticated
  using (app_private.has_any_active_membership());

create policy ai_models_select_members
  on public.ai_models
  for select
  to authenticated
  using (app_private.has_any_active_membership());

create policy ai_prompt_templates_select_members
  on public.ai_prompt_templates
  for select
  to authenticated
  using (app_private.has_any_active_membership());

create policy ai_requests_select_admins
  on public.ai_requests
  for select
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy ai_responses_select_admins
  on public.ai_responses
  for select
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy ai_cost_events_select_admins
  on public.ai_cost_events
  for select
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy document_extractions_select_allowed
  on public.document_extractions
  for select
  to authenticated
  using (app_private.can_access_document(document_id));

create policy review_tasks_select_reviewers
  on public.review_tasks
  for select
  to authenticated
  using (
    assigned_to = (select auth.uid())
    or app_private.can_review_document(document_id)
  );

create policy review_tasks_update_reviewers
  on public.review_tasks
  for update
  to authenticated
  using (
    assigned_to = (select auth.uid())
    or app_private.can_review_document(document_id)
  )
  with check (
    assigned_to = (select auth.uid())
    or app_private.can_review_document(document_id)
  );

create policy invoices_select_allowed
  on public.invoices
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(fiscal_entity_id));

create policy invoices_insert_accountants
  on public.invoices
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy invoices_update_accountants
  on public.invoices
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy invoice_lines_select_allowed
  on public.invoice_lines
  for select
  to authenticated
  using (app_private.can_access_invoice(invoice_id));

create policy invoice_lines_insert_accountants
  on public.invoice_lines
  for insert
  to authenticated
  with check (
    app_private.can_manage_invoice(invoice_id)
    and organization_id = (
      select i.organization_id from public.invoices i where i.id = invoice_id
    )
  );

create policy invoice_lines_update_accountants
  on public.invoice_lines
  for update
  to authenticated
  using (app_private.can_manage_invoice(invoice_id))
  with check (
    app_private.can_manage_invoice(invoice_id)
    and organization_id = (
      select i.organization_id from public.invoices i where i.id = invoice_id
    )
  );

create policy tax_breakdowns_select_allowed
  on public.tax_breakdowns
  for select
  to authenticated
  using (app_private.can_access_invoice(invoice_id));

create policy tax_breakdowns_insert_accountants
  on public.tax_breakdowns
  for insert
  to authenticated
  with check (
    app_private.can_manage_invoice(invoice_id)
    and organization_id = (
      select i.organization_id from public.invoices i where i.id = invoice_id
    )
  );

create policy tax_breakdowns_update_accountants
  on public.tax_breakdowns
  for update
  to authenticated
  using (app_private.can_manage_invoice(invoice_id))
  with check (
    app_private.can_manage_invoice(invoice_id)
    and organization_id = (
      select i.organization_id from public.invoices i where i.id = invoice_id
    )
  );

create policy tax_periods_select_allowed
  on public.tax_periods
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(fiscal_entity_id));

create policy tax_periods_insert_accountants
  on public.tax_periods
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy tax_periods_update_accountants
  on public.tax_periods
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy tax_summaries_select_allowed
  on public.tax_summaries
  for select
  to authenticated
  using (app_private.can_access_fiscal_entity(fiscal_entity_id));

create policy tax_summaries_insert_accountants
  on public.tax_summaries
  for insert
  to authenticated
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy tax_summaries_update_accountants
  on public.tax_summaries
  for update
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]))
  with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant']::public.organization_role[]));

create policy audit_logs_select_admins
  on public.audit_logs
  for select
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy processing_jobs_select_internal
  on public.processing_jobs
  for select
  to authenticated
  using (app_private.has_org_role(organization_id, array['owner', 'admin', 'accountant', 'reviewer']::public.organization_role[]));

insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
values (
  'document-files',
  'document-files',
  false,
  52428800,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set
  "public" = excluded."public",
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

create policy storage_document_files_select_allowed
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.can_access_fiscal_entity(app_private.storage_object_fiscal_entity_id(name))
  );

create policy storage_document_files_insert_uploaders
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'document-files'
    and app_private.can_upload_to_fiscal_entity(app_private.storage_object_fiscal_entity_id(name))
  );

create policy storage_document_files_update_accountants
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.has_org_role(
      app_private.storage_object_organization_id(name),
      array['owner', 'admin', 'accountant']::public.organization_role[]
    )
  )
  with check (
    bucket_id = 'document-files'
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
    and app_private.has_org_role(
      app_private.storage_object_organization_id(name),
      array['owner', 'admin']::public.organization_role[]
    )
  );

select pgmq.create('document_processing');

grant usage on schema public to authenticated, service_role;
grant usage on schema app_private to authenticated, service_role;

grant execute on all functions in schema app_private to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
