-- Correcciones de persistencia detectadas en la revision E2E:
--  * IRPF por linea: columna retention_rate en las tablas de lineas.
--  * Plantilla nombrada elegida en Ventas: columna sales_document_template_id en cabeceras.
--  * quotes_documents: permitir el tipo 'pdfQuote' (Presupuesto Plantilla).

-- 1) IRPF por linea (aditiva, default 0 -> filas existentes sin retencion).
alter table public.sales_invoice_lines add column if not exists retention_rate numeric not null default 0;
alter table public.sales_quote_lines add column if not exists retention_rate numeric not null default 0;
alter table public.sales_order_lines add column if not exists retention_rate numeric not null default 0;
alter table public.sales_delivery_note_lines add column if not exists retention_rate numeric not null default 0;
alter table public.sales_recurring_invoice_lines add column if not exists retention_rate numeric not null default 0;

-- 2) Plantilla de documento vinculada (nullable, se conserva el documento si se borra la plantilla).
alter table public.sales_invoices add column if not exists sales_document_template_id uuid references public.sales_document_templates(id) on delete set null;
alter table public.sales_quotes add column if not exists sales_document_template_id uuid references public.sales_document_templates(id) on delete set null;
alter table public.sales_orders add column if not exists sales_document_template_id uuid references public.sales_document_templates(id) on delete set null;
alter table public.sales_delivery_notes add column if not exists sales_document_template_id uuid references public.sales_document_templates(id) on delete set null;
alter table public.sales_recurring_invoices add column if not exists sales_document_template_id uuid references public.sales_document_templates(id) on delete set null;

-- 3) Permitir 'pdfQuote' en quotes_documents.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.quotes_documents'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%document_type%';

  if constraint_name is not null then
    execute format('alter table public.quotes_documents drop constraint %I', constraint_name);
  end if;

  alter table public.quotes_documents
    add constraint quotes_documents_document_type_check
    check (document_type = any (array['quote', 'pdfQuote', 'invoice', 'pdfInvoice']::text[]));
end $$;
