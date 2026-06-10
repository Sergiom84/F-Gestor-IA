alter table public.clients
  add column if not exists code text,
  add column if not exists tax_id text,
  add column if not exists fiscal_address text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists country text not null default 'ES',
  add column if not exists apply_irpf_by_default boolean not null default false,
  add column if not exists default_irpf_rate numeric(5, 2) not null default 0;

create unique index if not exists clients_org_code_unique
  on public.clients (organization_id, lower(code))
  where code is not null and deleted_at is null;

alter table public.clients
  add constraint clients_default_irpf_rate_range
  check (default_irpf_rate >= 0 and default_irpf_rate <= 100);

alter table public.sales_invoices
  add column if not exists reference text,
  add column if not exists retention_rate numeric(5, 2) not null default 0,
  add column if not exists retention_amount numeric(14, 2) not null default 0,
  add column if not exists suplido_amount numeric(14, 2) not null default 0,
  add column if not exists pdf_template text not null default 'standard';

alter table public.sales_invoices
  add constraint sales_invoices_retention_rate_range
  check (retention_rate >= 0 and retention_rate <= 100),
  add constraint sales_invoices_non_negative_suplido
  check (suplido_amount >= 0);

alter table public.sales_invoice_lines
  add column if not exists discount_rate numeric(5, 2) not null default 0;

alter table public.sales_invoice_lines
  add constraint sales_invoice_lines_discount_rate_range
  check (discount_rate >= 0 and discount_rate <= 100);
