-- NIF-IVA intracomunitario del cliente (p.ej. ESB12345678).
-- Aditiva y nullable: no afecta a clientes existentes ni a la RPC de alta;
-- create_contact_client la deja null y la accion la rellena con un update posterior.

alter table public.clients
  add column if not exists vat_number text;
