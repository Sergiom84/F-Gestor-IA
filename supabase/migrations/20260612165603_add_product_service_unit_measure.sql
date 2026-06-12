alter table public.products_services
  add column if not exists unit_measure text not null default 'hour';

alter table public.products_services
  drop constraint if exists products_services_unit_measure_check;

alter table public.products_services
  add constraint products_services_unit_measure_check
  check (unit_measure in ('day', 'hour', 'month', 'none', 'percentage'));
