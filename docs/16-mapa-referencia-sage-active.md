# Mapa de referencia Sage Active

Fecha: 2026-06-04

Fuente local:

`C:\Users\sergi\Documents\Software\SADGE_Asor-IA`

## Lectura correcta del material

La carpeta no contiene documentacion de producto en formato manual. Es una captura local de una sesion de Sage Active con bundles frontend, CSS, traducciones, fuentes y algunas respuestas BFF/API.

Por tanto, el uso correcto para GFiscal es:

- Extraer jerarquia funcional, nombres de modulos, acciones, listas y patrones visuales.
- Usar la captura como referencia de estructura ERP sobria.
- Evitar copiar codigo minificado, payloads privados o comportamiento interno de terceros.
- Mantener los importes y filas capturadas como semilla visual hasta crear modelo real.

El catalogo operativo queda en:

- `src/lib/product/sage-active-reference.ts`

## Fuentes utiles

- `mainui.es.active.sage.com/sage-active-2026052.js`: bundle principal de UI con rutas, claves de menu y vocabulario funcional.
- `assets.sbc.sage.com/sbc.common.translations.ui/2.324.1/umd/index.js`: traducciones compartidas y textos de acciones/listas.
- `mainui.es.active.sage.com/static/css/main.d250d7005f7908417071.css`: senales de layout, tarjetas, tablas, bordes y colores.
- `bff.es.active.sage.com/api/contractedfeatures/byorganization.html`: senales de modulos disponibles.
- `bff.es.active.sage.com/api/technicalfeatureflags/ui.html`: flags utiles para backlog, no para runtime.

## Modulos aplicables a GFiscal

### Cuadros de mando

Corresponde a `home`, `dashboard`, `accounting_dashboard`, `sales_dashboard`, indicadores de perdidas y ganancias, rendimiento, importes pendientes, quick links y novedades.

Aplicacion actual:

- Ya existe shell con pestanas `Contabilidad`, `Ventas y compras` y `Novedades`.
- Ya se conectan datos reales de documentos, revision, clientes y entidades fiscales.
- Los importes comerciales siguen siendo semilla.

Siguiente modelo:

- `dashboard_widget_state`
- `commercial_maturity_snapshot`
- `sales_purchase_kpi_snapshot`

### Ventas

Corresponde a facturas de venta, presupuestos, pedidos, albaranes, recibos, cobros pendientes y recordatorios.

Entidades necesarias:

- `sales_invoices`
- `sales_invoice_lines`
- `sales_quotes`
- `sales_orders`
- `sales_delivery_notes`
- `sales_receipts`
- `commercial_maturities`
- `payment_reminders`

Pantallas esperadas:

- Facturas de venta vencidas.
- Presupuestos pendientes.
- Cobros pendientes.
- Creacion de factura, presupuesto y recordatorio.

### Compras

Corresponde a facturas recibidas, proveedores, categorias de compra, subida documental y automatizacion.

Aplicacion actual:

- GFiscal ya tiene documentos, archivos, extracciones IA y revision humana.
- Falta separar el modelo contable/comercial de compra tras la aprobacion.

Entidades necesarias:

- `purchase_invoices`
- `purchase_invoice_lines`
- `suppliers`
- `purchase_categories`
- `supplier_payment_maturities`

### Contactos

Corresponde a clientes, proveedores, terceros, saldos y libro mayor de tercero.

Aplicacion actual:

- Existe cliente minimo de onboarding.

Entidades necesarias:

- `customers_extended`
- `suppliers`
- `third_parties`
- `contact_people`
- `addresses`
- `third_party_balances`

### Productos y servicios

Corresponde a catalogo, tipos de producto, servicios, precios y descuentos.

Entidades necesarias:

- `products_services`
- `product_prices`
- `discount_rules`
- `product_tax_defaults`

### Bancos

Corresponde a bancos, movimientos, conciliacion, medios de pago y reglas bancarias.

Entidades necesarias:

- `bank_accounts`
- `bank_transactions`
- `bank_reconciliations`
- `bank_rules`
- `payment_methods`

### Contabilidad

Corresponde a asientos, mayor, balance de sumas y saldos, balance, perdidas y ganancias, diarios, cuentas, marcaje y cierres.

Entidades necesarias:

- `accounting_entries`
- `accounting_entry_lines`
- `ledger_accounts`
- `journals`
- `matching_marks`
- `accounting_periods`
- `closing_runs`

### Declaraciones

Corresponde a impuestos, IVA, obligaciones legales, modelos, antifraude, e-invoice, e-reporting y VeriFactu.

Aplicacion actual:

- GFiscal ya tiene `regulatory_events` append-only y ledger normativo interno.

Entidades necesarias:

- `tax_declarations`
- `vat_returns`
- `legal_obligations`
- `e_invoice_submissions`
- `verifactu_records`

### Informes

Corresponde a informes financieros y contables: balance, perdidas y ganancias, sumas y saldos, disenador y exportaciones.

Entidades necesarias:

- `report_definitions`
- `report_runs`
- `report_exports`
- `report_favorites`

### Configuracion

Corresponde a organizacion, numeradores, condiciones y medios de pago, configuracion de ventas e informacion de autoridad fiscal.

Entidades necesarias:

- `organization_settings`
- `numbering_sequences`
- `payment_terms`
- `email_templates`
- `tax_authority_profiles`

### Documentos

Corresponde a gestion documental, subida de compras, automatizacion y deteccion asistida.

Aplicacion actual:

- Es la parte mas real de GFiscal: `documents`, `document_files`, `document_pages`, `document_text_chunks`, `processing_jobs`, `document_extractions` y `review_tasks`.

Siguiente mejora:

- Filtros de bandeja.
- Eventos de error documental.
- Reglas de asignacion.

### Copilot Insights

Corresponde a insights, tarjetas de ayuda, recomendaciones y analisis asistido.

Aplicacion actual:

- GFiscal ya registra `ai_requests`, `ai_responses` y `ai_cost_events`.
- Falta una capa de recomendaciones visible y auditable.

Entidades necesarias:

- `insight_cards`
- `recommendations`
- `ai_feedback`
- `ai_guardrails`

## Senales visuales

La captura apunta a una app sobria, no una landing:

- Fondo general gris claro `#eef2f4`.
- Tarjetas blancas con borde fino `#ccd6db`.
- Sidebar oscuro, compacto y modular.
- Verde Sage para acciones y estados principales.
- Rojo para vencido.
- Naranja para barras de vencimiento.
- Cabeceras de tabla gris azulado.
- Tipografia Sage UI/Sage Text cuando este disponible; fallback sans-serif.

Estas senales ya estan incorporadas parcialmente en `/dashboard`.

## Flags y senales de backlog

La captura menciona, entre otras:

- `Core`
- `Accounting`
- `Sales`
- `Copilot`
- `ui_paymentsIn`
- `ui_simplifiedInvoices_51920`
- `ui_simplified_purchase_invoice_by_email`
- `ui_onlinePaymentShowInfo_54101`
- `ui_eInvoicingAccounting_51346`
- `ui_salesWithholdings`
- `ui_showCopilotFinanceAgent=false`

Uso recomendado:

- Sirven como inspiracion de alcance y priorizacion.
- No deben usarse como configuracion runtime de GFiscal.

## Secuencia de implementacion recomendada

1. Completado: extraer `app/dashboard/page.tsx` en componentes pequenos por shell, dashboard, ventas y workspace modular.
2. Completado: crear migracion comercial minima para facturas de venta, lineas, vencimientos, presupuestos, proveedores y productos/servicios.
3. Conectar `Ventas y compras` a agregados reales.
4. Separar compra documental aprobada de compra contable/comercial.
5. Anadir configuracion de numeradores y condiciones de pago.
6. Crear tablas de bancos y conciliacion simple.
7. Llevar informes a definiciones y ejecuciones consultables.
8. Convertir Copilot Insights en recomendaciones auditadas sobre datos reales.

## Limites

Esta extraccion no significa que todo Sage Active este implementado. Significa que el material aplicable ya esta convertido en referencia de producto para completar GFiscal por fases, con entidades, pantallas y prioridades claras.
