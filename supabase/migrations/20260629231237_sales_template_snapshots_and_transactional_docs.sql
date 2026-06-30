-- Plantillas persistidas y escrituras transaccionales de documentos de venta.

alter table public.sales_invoices add column if not exists sales_document_template_snapshot jsonb;
alter table public.sales_quotes add column if not exists sales_document_template_snapshot jsonb;
alter table public.sales_orders add column if not exists sales_document_template_snapshot jsonb;
alter table public.sales_delivery_notes add column if not exists sales_document_template_snapshot jsonb;
alter table public.sales_recurring_invoices add column if not exists sales_document_template_snapshot jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_document_templates_id_organization_unique'
      and conrelid = 'public.sales_document_templates'::regclass
  ) then
    alter table public.sales_document_templates
      add constraint sales_document_templates_id_organization_unique
      unique (id, organization_id);
  end if;
end $$;

do $$
declare
  target record;
begin
  for target in
    select *
    from (
      values
        ('sales_invoices', 'sales_invoices_template_org_fk'),
        ('sales_quotes', 'sales_quotes_template_org_fk'),
        ('sales_orders', 'sales_orders_template_org_fk'),
        ('sales_delivery_notes', 'sales_delivery_notes_template_org_fk'),
        ('sales_recurring_invoices', 'sales_recurring_invoices_template_org_fk')
    ) as document_tables(table_name, constraint_name)
  loop
    execute format(
      'update public.%I d
       set sales_document_template_id = null
       where sales_document_template_id is not null
         and not exists (
           select 1
           from public.sales_document_templates t
           where t.id = d.sales_document_template_id
             and t.organization_id = d.organization_id
             and t.scope = ''sales''
         )',
      target.table_name
    );

    execute format(
      'update public.%I d
       set sales_document_template_snapshot = jsonb_build_object(
         ''id'', t.id,
         ''name'', t.name,
         ''format'', t.format,
         ''scope'', t.scope,
         ''config'', t.config,
         ''captured_at'', now()
       )
       from public.sales_document_templates t
       where d.sales_document_template_id = t.id
         and d.organization_id = t.organization_id
         and t.scope = ''sales''
         and d.sales_document_template_snapshot is null',
      target.table_name
    );

    if not exists (
      select 1
      from pg_constraint
      where conname = target.constraint_name
        and conrelid = to_regclass(format('public.%I', target.table_name))
    ) then
      execute format(
        'alter table public.%I
         add constraint %I
         foreign key (sales_document_template_id, organization_id)
         references public.sales_document_templates(id, organization_id)
         on delete set null (sales_document_template_id)
         not valid',
        target.table_name,
        target.constraint_name
      );
    end if;

    execute format(
      'alter table public.%I validate constraint %I',
      target.table_name,
      target.constraint_name
    );
  end loop;
end $$;

create or replace function app_private.set_sales_document_template_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  template_snapshot jsonb;
begin
  if new.sales_document_template_id is null then
    new.sales_document_template_snapshot := null;
    return new;
  end if;

  select jsonb_build_object(
    'id', id,
    'name', name,
    'format', format,
    'scope', scope,
    'config', config,
    'captured_at', now()
  )
  into template_snapshot
  from public.sales_document_templates
  where id = new.sales_document_template_id
    and organization_id = new.organization_id
    and scope = 'sales';

  if template_snapshot is null then
    raise exception 'Plantilla de ventas invalida para la organizacion';
  end if;

  if tg_op = 'INSERT' and new.sales_document_template_snapshot is not null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.sales_document_template_id is not distinct from old.sales_document_template_id
    and new.sales_document_template_snapshot is not null then
    return new;
  end if;

  new.sales_document_template_snapshot := template_snapshot;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sales_invoices',
    'sales_quotes',
    'sales_orders',
    'sales_delivery_notes',
    'sales_recurring_invoices'
  ]
  loop
    execute format('drop trigger if exists %I_template_snapshot on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_template_snapshot
       before insert or update of sales_document_template_id on public.%I
       for each row execute function app_private.set_sales_document_template_snapshot()',
      table_name,
      table_name
    );
  end loop;
end $$;

create or replace function public.create_sales_document(
  p_kind text,
  p_organization_id uuid,
  p_fiscal_entity_id uuid,
  p_client_id uuid,
  p_document_date date,
  p_number_prefix text default null,
  p_reference text default null,
  p_currency text default 'EUR',
  p_status text default null,
  p_subtotal_amount numeric default 0,
  p_tax_amount numeric default 0,
  p_retention_rate numeric default 0,
  p_retention_amount numeric default 0,
  p_suplido_amount numeric default 0,
  p_pdf_template text default 'standard',
  p_sales_document_template_id uuid default null,
  p_total_amount numeric default 0,
  p_notes text default null,
  p_frequency text default null,
  p_created_by uuid default null,
  p_lines jsonb default '[]'::jsonb
)
returns table (
  document_id uuid,
  document_number text,
  document_date text,
  client_name text,
  total_amount numeric,
  status text
)
language plpgsql
set search_path = public, app_private, pg_temp
as $$
declare
  doc_type text;
  line_count integer;
  new_document_id uuid;
  new_number text;
  new_status public.commercial_document_status;
begin
  if p_kind not in ('quote', 'order', 'invoice', 'delivery-note', 'recurring-invoice') then
    raise exception 'Tipo de documento no soportado: %', p_kind;
  end if;

  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception 'Las lineas del documento deben enviarse como array JSON';
  end if;

  line_count := jsonb_array_length(coalesce(p_lines, '[]'::jsonb));
  if line_count = 0 then
    raise exception 'El documento debe contener al menos una linea';
  end if;

  if p_sales_document_template_id is not null and not exists (
    select 1
    from public.sales_document_templates
    where id = p_sales_document_template_id
      and organization_id = p_organization_id
      and scope = 'sales'
  ) then
    raise exception 'Plantilla de ventas invalida para la organizacion';
  end if;

  doc_type := case p_kind
    when 'quote' then 'sales_quote'
    when 'order' then 'sales_order'
    when 'invoice' then 'sales_invoice'
    when 'delivery-note' then 'sales_delivery_note'
    when 'recurring-invoice' then 'sales_recurring_invoice'
  end;
  new_number := public.next_document_number(p_organization_id, doc_type, p_number_prefix);

  if p_kind = 'quote' then
    new_status := coalesce(nullif(p_status, '')::public.commercial_document_status, 'open'::public.commercial_document_status);
    insert into public.sales_quotes (
      organization_id, fiscal_entity_id, client_id, quote_number, quote_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, total_amount, notes, created_by
    )
    values (
      p_organization_id, p_fiscal_entity_id, p_client_id, new_number, p_document_date, p_reference,
      coalesce(nullif(p_currency, ''), 'EUR'), new_status, coalesce(p_subtotal_amount, 0), coalesce(p_tax_amount, 0),
      coalesce(p_retention_rate, 0), coalesce(p_retention_amount, 0), coalesce(p_suplido_amount, 0),
      coalesce(nullif(p_pdf_template, ''), 'standard'), p_sales_document_template_id, coalesce(p_total_amount, 0),
      nullif(p_notes, ''), p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_quote_lines (
      organization_id, sales_quote_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select
      p_organization_id,
      new_document_id,
      case when nullif(line ->> 'product_service_id', '') is null then null else (line ->> 'product_service_id')::uuid end,
      coalesce(nullif(line ->> 'line_index', '')::integer, (ordinality - 1)::integer),
      nullif(line ->> 'description', ''),
      coalesce(nullif(line ->> 'quantity', '')::numeric, 1),
      coalesce(nullif(line ->> 'unit_price', '')::numeric, 0),
      nullif(line ->> 'tax_rate', '')::numeric,
      coalesce(nullif(line ->> 'retention_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'discount_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'line_total', '')::numeric, 0)
    from jsonb_array_elements(p_lines) with ordinality as item(line, ordinality);
  elsif p_kind = 'order' then
    new_status := coalesce(nullif(p_status, '')::public.commercial_document_status, 'open'::public.commercial_document_status);
    insert into public.sales_orders (
      organization_id, fiscal_entity_id, client_id, order_number, order_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, total_amount, notes, created_by
    )
    values (
      p_organization_id, p_fiscal_entity_id, p_client_id, new_number, p_document_date, p_reference,
      coalesce(nullif(p_currency, ''), 'EUR'), new_status, coalesce(p_subtotal_amount, 0), coalesce(p_tax_amount, 0),
      coalesce(p_retention_rate, 0), coalesce(p_retention_amount, 0), coalesce(p_suplido_amount, 0),
      coalesce(nullif(p_pdf_template, ''), 'standard'), p_sales_document_template_id, coalesce(p_total_amount, 0),
      nullif(p_notes, ''), p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_order_lines (
      organization_id, sales_order_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select
      p_organization_id,
      new_document_id,
      case when nullif(line ->> 'product_service_id', '') is null then null else (line ->> 'product_service_id')::uuid end,
      coalesce(nullif(line ->> 'line_index', '')::integer, (ordinality - 1)::integer),
      nullif(line ->> 'description', ''),
      coalesce(nullif(line ->> 'quantity', '')::numeric, 1),
      coalesce(nullif(line ->> 'unit_price', '')::numeric, 0),
      nullif(line ->> 'tax_rate', '')::numeric,
      coalesce(nullif(line ->> 'retention_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'discount_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'line_total', '')::numeric, 0)
    from jsonb_array_elements(p_lines) with ordinality as item(line, ordinality);
  elsif p_kind = 'invoice' then
    new_status := coalesce(nullif(p_status, '')::public.commercial_document_status, 'draft'::public.commercial_document_status);
    insert into public.sales_invoices (
      organization_id, fiscal_entity_id, client_id, invoice_number, reference, issue_date,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, total_amount, notes, created_by
    )
    values (
      p_organization_id, p_fiscal_entity_id, p_client_id, new_number, p_reference, p_document_date,
      coalesce(nullif(p_currency, ''), 'EUR'), new_status, coalesce(p_subtotal_amount, 0), coalesce(p_tax_amount, 0),
      coalesce(p_retention_rate, 0), coalesce(p_retention_amount, 0), coalesce(p_suplido_amount, 0),
      coalesce(nullif(p_pdf_template, ''), 'standard'), p_sales_document_template_id, coalesce(p_total_amount, 0),
      nullif(p_notes, ''), p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_invoice_lines (
      organization_id, sales_invoice_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select
      p_organization_id,
      new_document_id,
      case when nullif(line ->> 'product_service_id', '') is null then null else (line ->> 'product_service_id')::uuid end,
      coalesce(nullif(line ->> 'line_index', '')::integer, (ordinality - 1)::integer),
      nullif(line ->> 'description', ''),
      coalesce(nullif(line ->> 'quantity', '')::numeric, 1),
      coalesce(nullif(line ->> 'unit_price', '')::numeric, 0),
      nullif(line ->> 'tax_rate', '')::numeric,
      coalesce(nullif(line ->> 'retention_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'discount_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'line_total', '')::numeric, 0)
    from jsonb_array_elements(p_lines) with ordinality as item(line, ordinality);
  elsif p_kind = 'delivery-note' then
    new_status := coalesce(nullif(p_status, '')::public.commercial_document_status, 'open'::public.commercial_document_status);
    insert into public.sales_delivery_notes (
      organization_id, fiscal_entity_id, client_id, note_number, note_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, total_amount, notes, created_by
    )
    values (
      p_organization_id, p_fiscal_entity_id, p_client_id, new_number, p_document_date, p_reference,
      coalesce(nullif(p_currency, ''), 'EUR'), new_status, coalesce(p_subtotal_amount, 0), coalesce(p_tax_amount, 0),
      coalesce(p_retention_rate, 0), coalesce(p_retention_amount, 0), coalesce(p_suplido_amount, 0),
      coalesce(nullif(p_pdf_template, ''), 'standard'), p_sales_document_template_id, coalesce(p_total_amount, 0),
      nullif(p_notes, ''), p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_delivery_note_lines (
      organization_id, sales_delivery_note_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select
      p_organization_id,
      new_document_id,
      coalesce(nullif(line ->> 'line_index', '')::integer, (ordinality - 1)::integer),
      coalesce(nullif(line ->> 'description', ''), ''),
      coalesce(nullif(line ->> 'quantity', '')::numeric, 1),
      coalesce(nullif(line ->> 'unit_price', '')::numeric, 0),
      coalesce(nullif(line ->> 'tax_rate', '')::numeric, 21),
      coalesce(nullif(line ->> 'retention_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'discount_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'line_total', '')::numeric, 0)
    from jsonb_array_elements(p_lines) with ordinality as item(line, ordinality);
  else
    new_status := coalesce(nullif(p_status, '')::public.commercial_document_status, 'open'::public.commercial_document_status);
    insert into public.sales_recurring_invoices (
      organization_id, fiscal_entity_id, client_id, template_number, frequency, next_issue_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, total_amount, notes, created_by
    )
    values (
      p_organization_id, p_fiscal_entity_id, p_client_id, new_number,
      case when p_frequency in ('weekly', 'monthly', 'quarterly', 'annual') then p_frequency else 'monthly' end,
      p_document_date, p_reference,
      coalesce(nullif(p_currency, ''), 'EUR'), new_status, coalesce(p_subtotal_amount, 0), coalesce(p_tax_amount, 0),
      coalesce(p_retention_rate, 0), coalesce(p_retention_amount, 0), coalesce(p_suplido_amount, 0),
      coalesce(nullif(p_pdf_template, ''), 'standard'), p_sales_document_template_id, coalesce(p_total_amount, 0),
      nullif(p_notes, ''), p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_recurring_invoice_lines (
      organization_id, sales_recurring_invoice_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select
      p_organization_id,
      new_document_id,
      coalesce(nullif(line ->> 'line_index', '')::integer, (ordinality - 1)::integer),
      coalesce(nullif(line ->> 'description', ''), ''),
      coalesce(nullif(line ->> 'quantity', '')::numeric, 1),
      coalesce(nullif(line ->> 'unit_price', '')::numeric, 0),
      coalesce(nullif(line ->> 'tax_rate', '')::numeric, 21),
      coalesce(nullif(line ->> 'retention_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'discount_rate', '')::numeric, 0),
      coalesce(nullif(line ->> 'line_total', '')::numeric, 0)
    from jsonb_array_elements(p_lines) with ordinality as item(line, ordinality);
  end if;

  return query
  select
    new_document_id,
    new_number,
    coalesce(p_document_date::text, ''),
    coalesce(c.name, '—'),
    coalesce(p_total_amount, 0),
    new_status::text
  from public.clients c
  where c.id = p_client_id;
end;
$$;

create or replace function public.duplicate_sales_document(
  p_kind text,
  p_document_id uuid,
  p_created_by uuid default null
)
returns table (
  document_id uuid,
  document_number text,
  document_date text,
  client_name text,
  total_amount numeric,
  status text
)
language plpgsql
set search_path = public, app_private, pg_temp
as $$
declare
  original record;
  line_count integer;
  new_document_id uuid;
  new_number text;
  new_status public.commercial_document_status;
begin
  if p_kind not in ('quote', 'order', 'invoice', 'delivery-note', 'recurring-invoice') then
    raise exception 'Tipo de documento no soportado: %', p_kind;
  end if;

  if p_kind = 'quote' then
    select q.*, c.name as client_name
    into original
    from public.sales_quotes q
    left join public.clients c on c.id = q.client_id
    where q.id = p_document_id
      and q.deleted_at is null;

    if original.id is null then
      raise exception 'Presupuesto no encontrado';
    end if;

    select count(*) into line_count from public.sales_quote_lines where sales_quote_id = p_document_id;
    if line_count = 0 then raise exception 'El presupuesto original no tiene lineas para duplicar'; end if;

    new_number := public.next_document_number(original.organization_id, 'sales_quote', null);
    new_status := 'draft'::public.commercial_document_status;

    insert into public.sales_quotes (
      organization_id, fiscal_entity_id, client_id, quote_number, quote_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, sales_document_template_snapshot,
      total_amount, notes, created_by
    )
    values (
      original.organization_id, original.fiscal_entity_id, original.client_id, new_number, original.quote_date, original.reference,
      original.currency, new_status, original.subtotal_amount, original.tax_amount, original.retention_rate, original.retention_amount,
      original.suplido_amount, original.pdf_template, original.sales_document_template_id, original.sales_document_template_snapshot,
      original.total_amount, original.notes, p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_quote_lines (
      organization_id, sales_quote_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select organization_id, new_document_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    from public.sales_quote_lines
    where sales_quote_id = p_document_id
    order by line_index;

    return query select new_document_id, new_number, coalesce(original.quote_date::text, ''), coalesce(original.client_name, '—'), original.total_amount, new_status::text;
  elsif p_kind = 'order' then
    select o.*, c.name as client_name
    into original
    from public.sales_orders o
    left join public.clients c on c.id = o.client_id
    where o.id = p_document_id
      and o.deleted_at is null;

    if original.id is null then
      raise exception 'Pedido no encontrado';
    end if;

    select count(*) into line_count from public.sales_order_lines where sales_order_id = p_document_id;
    if line_count = 0 then raise exception 'El pedido original no tiene lineas para duplicar'; end if;

    new_number := public.next_document_number(original.organization_id, 'sales_order', null);
    new_status := 'draft'::public.commercial_document_status;

    insert into public.sales_orders (
      organization_id, fiscal_entity_id, client_id, order_number, order_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, sales_document_template_snapshot,
      total_amount, notes, created_by
    )
    values (
      original.organization_id, original.fiscal_entity_id, original.client_id, new_number, original.order_date, original.reference,
      original.currency, new_status, original.subtotal_amount, original.tax_amount, original.retention_rate, original.retention_amount,
      original.suplido_amount, original.pdf_template, original.sales_document_template_id, original.sales_document_template_snapshot,
      original.total_amount, original.notes, p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_order_lines (
      organization_id, sales_order_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select organization_id, new_document_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    from public.sales_order_lines
    where sales_order_id = p_document_id
    order by line_index;

    return query select new_document_id, new_number, coalesce(original.order_date::text, ''), coalesce(original.client_name, '—'), original.total_amount, new_status::text;
  elsif p_kind = 'invoice' then
    select i.*, c.name as client_name
    into original
    from public.sales_invoices i
    left join public.clients c on c.id = i.client_id
    where i.id = p_document_id
      and i.deleted_at is null;

    if original.id is null then
      raise exception 'Factura no encontrada';
    end if;

    select count(*) into line_count from public.sales_invoice_lines where sales_invoice_id = p_document_id;
    if line_count = 0 then raise exception 'La factura original no tiene lineas para duplicar'; end if;

    new_number := public.next_document_number(original.organization_id, 'sales_invoice', null);
    new_status := 'draft'::public.commercial_document_status;

    insert into public.sales_invoices (
      organization_id, fiscal_entity_id, client_id, invoice_number, reference, issue_date, due_date,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, sales_document_template_snapshot,
      total_amount, notes, created_by
    )
    values (
      original.organization_id, original.fiscal_entity_id, original.client_id, new_number, original.reference, original.issue_date, original.due_date,
      original.currency, new_status, original.subtotal_amount, original.tax_amount, original.retention_rate, original.retention_amount,
      original.suplido_amount, original.pdf_template, original.sales_document_template_id, original.sales_document_template_snapshot,
      original.total_amount, original.notes, p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_invoice_lines (
      organization_id, sales_invoice_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select organization_id, new_document_id, product_service_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    from public.sales_invoice_lines
    where sales_invoice_id = p_document_id
    order by line_index;

    return query select new_document_id, new_number, coalesce(original.issue_date::text, ''), coalesce(original.client_name, '—'), original.total_amount, new_status::text;
  elsif p_kind = 'delivery-note' then
    select d.*, c.name as client_name
    into original
    from public.sales_delivery_notes d
    left join public.clients c on c.id = d.client_id
    where d.id = p_document_id
      and d.deleted_at is null;

    if original.id is null then
      raise exception 'Albaran no encontrado';
    end if;

    select count(*) into line_count from public.sales_delivery_note_lines where sales_delivery_note_id = p_document_id;
    if line_count = 0 then raise exception 'El albaran original no tiene lineas para duplicar'; end if;

    new_number := public.next_document_number(original.organization_id, 'sales_delivery_note', null);
    new_status := 'open'::public.commercial_document_status;

    insert into public.sales_delivery_notes (
      organization_id, fiscal_entity_id, client_id, note_number, note_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, sales_document_template_snapshot,
      total_amount, notes, created_by
    )
    values (
      original.organization_id, original.fiscal_entity_id, original.client_id, new_number, original.note_date, original.reference,
      original.currency, new_status, original.subtotal_amount, original.tax_amount, original.retention_rate, original.retention_amount,
      original.suplido_amount, original.pdf_template, original.sales_document_template_id, original.sales_document_template_snapshot,
      original.total_amount, original.notes, p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_delivery_note_lines (
      organization_id, sales_delivery_note_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select organization_id, new_document_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    from public.sales_delivery_note_lines
    where sales_delivery_note_id = p_document_id
    order by line_index;

    return query select new_document_id, new_number, coalesce(original.note_date::text, ''), coalesce(original.client_name, '—'), original.total_amount, new_status::text;
  else
    select r.*, c.name as client_name
    into original
    from public.sales_recurring_invoices r
    left join public.clients c on c.id = r.client_id
    where r.id = p_document_id
      and r.deleted_at is null;

    if original.id is null then
      raise exception 'Plantilla recurrente no encontrada';
    end if;

    select count(*) into line_count from public.sales_recurring_invoice_lines where sales_recurring_invoice_id = p_document_id;
    if line_count = 0 then raise exception 'La plantilla recurrente original no tiene lineas para duplicar'; end if;

    new_number := public.next_document_number(original.organization_id, 'sales_recurring_invoice', null);
    new_status := 'open'::public.commercial_document_status;

    insert into public.sales_recurring_invoices (
      organization_id, fiscal_entity_id, client_id, template_number, frequency, next_issue_date, reference,
      currency, status, subtotal_amount, tax_amount, retention_rate, retention_amount,
      suplido_amount, pdf_template, sales_document_template_id, sales_document_template_snapshot,
      total_amount, notes, created_by
    )
    values (
      original.organization_id, original.fiscal_entity_id, original.client_id, new_number, original.frequency, original.next_issue_date, original.reference,
      original.currency, new_status, original.subtotal_amount, original.tax_amount, original.retention_rate, original.retention_amount,
      original.suplido_amount, original.pdf_template, original.sales_document_template_id, original.sales_document_template_snapshot,
      original.total_amount, original.notes, p_created_by
    )
    returning id into new_document_id;

    insert into public.sales_recurring_invoice_lines (
      organization_id, sales_recurring_invoice_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    )
    select organization_id, new_document_id, line_index, description, quantity,
      unit_price, tax_rate, retention_rate, discount_rate, line_total
    from public.sales_recurring_invoice_lines
    where sales_recurring_invoice_id = p_document_id
    order by line_index;

    return query select new_document_id, new_number, coalesce(original.next_issue_date::text, ''), coalesce(original.client_name, '—'), original.total_amount, new_status::text;
  end if;
end;
$$;

revoke all on function public.create_sales_document(text, uuid, uuid, uuid, date, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, uuid, numeric, text, text, uuid, jsonb) from public;
revoke all on function public.create_sales_document(text, uuid, uuid, uuid, date, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, uuid, numeric, text, text, uuid, jsonb) from anon;
grant execute on function public.create_sales_document(text, uuid, uuid, uuid, date, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, uuid, numeric, text, text, uuid, jsonb) to authenticated;

revoke all on function public.duplicate_sales_document(text, uuid, uuid) from public;
revoke all on function public.duplicate_sales_document(text, uuid, uuid) from anon;
grant execute on function public.duplicate_sales_document(text, uuid, uuid) to authenticated;
