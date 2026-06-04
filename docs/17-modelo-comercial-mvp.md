# Modelo comercial MVP

Fecha: 2026-06-04

Migracion:

- `supabase/migrations/20260604174547_commercial_foundation.sql`

## Objetivo

Crear la primera base real para sustituir los datos semilla del dashboard `Ventas y compras`.

El modelo separa la capa documental ya existente de la operativa comercial:

- La bandeja documental procesa PDFs, IA y revision humana.
- El modelo comercial registra facturas, presupuestos, proveedores, productos/servicios y vencimientos.
- Las tablas comerciales pueden referenciar `invoices`, `documents` y `document_extractions` cuando el dato nace de una aprobacion documental.

## Tablas

### `suppliers`

Proveedores por organizacion.

Uso previsto:

- Modulo `Compras`.
- Alta rapida de proveedores.
- Asociacion con facturas de compra.

### `products_services`

Catalogo vendible y reusable en lineas de venta/compra.

Uso previsto:

- Modulo `Productos y servicios`.
- Facturas y presupuestos.
- Precios unitarios e IVA por defecto.

### `sales_invoices`

Facturas de venta emitidas por una entidad fiscal.

Uso previsto:

- Tabla principal de `Ventas`.
- KPIs de facturacion, cobros y vencimientos.
- Referencia opcional a `invoices` cuando el documento tambien esta representado en el ledger fiscal general.

### `sales_invoice_lines`

Lineas de factura de venta.

Uso previsto:

- Detalle de factura.
- Agregados por producto/servicio.
- Base futura de informes comerciales.

### `sales_quotes`

Presupuestos de venta.

Uso previsto:

- Lista de presupuestos pendientes.
- Conversion a factura de venta.

### `purchase_invoices`

Facturas de compra de proveedor.

Uso previsto:

- Modulo `Compras`.
- Conversion desde documento recibido aprobado.
- Pagos pendientes y vencimientos de proveedor.

### `purchase_invoice_lines`

Lineas de factura de compra.

Uso previsto:

- Detalle de compra.
- Clasificacion futura por categoria o producto/servicio.

### `commercial_maturities`

Vencimientos comerciales.

Uso previsto:

- `Pendiente de cobro` para facturas de venta.
- `Pendiente de pago` para facturas de compra.
- Barras de vencimiento, antiguedad de saldos y recordatorios.

## Seguridad

Todas las tablas nuevas:

- Estan en `public`.
- Tienen RLS activado.
- Respetan `organization_id`.
- Usan `fiscal_entity_id` cuando el dato pertenece a una entidad fiscal concreta.
- Permiten lectura a usuarios con acceso a la organizacion o entidad fiscal.
- Restringen gestion a roles `owner`, `admin` y `accountant`.

Se anaden helpers privados:

- `app_private.can_access_sales_invoice(uuid)`
- `app_private.can_access_purchase_invoice(uuid)`

## Siguiente conexion UI

Prioridad para eliminar semilla:

1. Leer `commercial_maturities` para `Pendiente de cobro` y `Pendiente de pago`.
2. Leer `sales_invoices` para `Facturas de venta vencidas`.
3. Leer `sales_quotes` para `Presupuestos pendientes`.
4. Leer `purchase_invoices` para tarjetas de compras.
5. Usar `suppliers` y `products_services` en los modulos laterales.

## Limites

Este modelo no implementa todavia:

- Numeradores configurables.
- Estados normativos oficiales.
- Conciliacion bancaria.
- Formularios CRUD.
- Conversor automatico desde revision IA a factura comercial.

El objetivo es preparar la estructura real para que la UI deje de depender de datos demo por fases.
