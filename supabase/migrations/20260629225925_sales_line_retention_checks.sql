-- IRPF por linea: la app normaliza porcentajes, pero la base de datos tambien
-- debe impedir valores fuera de rango para imports/escrituras directas.

do $$
declare
  target record;
begin
  for target in
    select *
    from (
      values
        ('sales_invoice_lines', 'sales_invoice_lines_retention_rate_range'),
        ('sales_quote_lines', 'sales_quote_lines_retention_rate_range'),
        ('sales_order_lines', 'sales_order_lines_retention_rate_range'),
        ('sales_delivery_note_lines', 'sales_delivery_note_lines_retention_rate_range'),
        ('sales_recurring_invoice_lines', 'sales_recurring_invoice_lines_retention_rate_range')
    ) as line_tables(table_name, constraint_name)
  loop
    execute format(
      'update public.%I
       set retention_rate = least(100, greatest(0, coalesce(retention_rate, 0)))
       where retention_rate is null or retention_rate < 0 or retention_rate > 100',
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
         check (retention_rate >= 0 and retention_rate <= 100)
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
