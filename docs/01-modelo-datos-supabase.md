# Modelo de datos Supabase

Fecha: 2026-06-03  
Estado: borrador de arquitectura, sin SQL de implementacion

Este documento define el primer modelo conceptual para GFiscal. Su objetivo es que el siguiente paso sea convertir estas decisiones en migraciones Supabase, politicas RLS y tests de seguridad.

## Fuentes oficiales revisadas

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Queues: https://supabase.com/docs/guides/queues
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

Puntos relevantes:

- Supabase recomienda RLS en cualquier tabla de un esquema expuesto como `public`.
- Con RLS activado, no hay acceso por API hasta definir politicas.
- Storage usa politicas sobre `storage.objects`; por defecto no permite uploads sin politicas.
- Supabase Queues es una cola duradera nativa de Postgres basada en `pgmq`.
- Edge Functions encajan para endpoints cortos, webhooks y orquestacion ligera; los trabajos pesados deben ir a workers.

## Principios de modelado

- Todas las entidades de negocio pertenecen a una organizacion.
- El usuario no es el tenant; la organizacion es el tenant.
- Una gestoria puede tener muchos clientes y entidades fiscales.
- Un cliente puede representar una empresa, autonomo o contacto operativo.
- Una entidad fiscal es el sujeto fiscal real sobre el que se suben documentos y se generan registros.
- Un documento logico puede tener uno o varios archivos.
- La IA propone extracciones; la revision humana decide.
- Las tablas de logs y auditoria deben ser append-only a nivel aplicacion.
- Los datos sensibles no deben depender de permisos del frontend.

## Convenciones

- Identificadores: UUID.
- Fechas de auditoria: `created_at`, `updated_at`, `deleted_at` cuando aplique.
- Soft delete: solo en entidades de negocio visibles por usuario.
- Estados: enums controlados en base de datos.
- Dinero: importes en decimal, moneda explicita, sin floats.
- IVA: campos separados para base, tipo, cuota y total.
- Metadatos flexibles: JSONB solo para datos auxiliares, nunca como sustituto de campos fiscales criticos.
- Storage path recomendado: `organizations/{organization_id}/fiscal-entities/{fiscal_entity_id}/documents/{document_id}/files/{document_file_id}-{safe_filename}`.

## Modulos y tablas conceptuales

### 1. Auth

Responsabilidad:

- Gestionar identidad mediante Supabase Auth.
- No duplicar passwords ni credenciales.

Tablas propias:

- `profiles`

Campos conceptuales:

- `user_id`: referencia a usuario Auth.
- `display_name`
- `locale`
- `timezone`
- `avatar_url`
- `onboarding_completed_at`

RLS:

- Cada usuario puede ver y editar su propio perfil.
- Administradores de organizacion podran ver datos basicos de miembros vinculados a su organizacion.

### 2. Organizations

Responsabilidad:

- Tenant principal.
- Separacion de datos y facturacion futura.

Tabla:

- `organizations`

Campos conceptuales:

- `id`
- `name`
- `slug`
- `billing_email`
- `country`
- `default_currency`
- `plan`
- `status`
- `ai_monthly_budget_cents`

Relaciones:

- Una organizacion tiene muchos miembros.
- Una organizacion tiene muchos clientes, entidades fiscales, documentos y logs.

RLS:

- Solo miembros activos pueden ver la organizacion.
- Solo `owner` y `admin` pueden modificar configuracion.

### 3. Members/Roles

Responsabilidad:

- Control de acceso multi-tenant.

Tabla:

- `organization_members`

Campos conceptuales:

- `organization_id`
- `user_id`
- `role`: `owner`, `admin`, `accountant`, `reviewer`, `client`
- `status`: `invited`, `active`, `suspended`, `removed`
- `invited_by`
- `joined_at`

Reglas:

- Un usuario puede pertenecer a varias organizaciones.
- El rol se decide por organizacion.
- No usar `user_metadata` para autorizacion.

RLS:

- Miembros activos pueden ver otros miembros de la misma organizacion.
- Solo `owner/admin` pueden invitar, suspender o cambiar roles.
- Un `owner` no debe poder eliminarse si es el ultimo owner.

### 4. Clients

Responsabilidad:

- Representar clientes gestionados por la organizacion.
- En una gestoria, un cliente puede tener varias entidades fiscales.

Tabla:

- `clients`

Campos conceptuales:

- `organization_id`
- `name`
- `type`: `individual`, `company`
- `contact_email`
- `contact_phone`
- `status`
- `notes`

Relaciones:

- Un cliente pertenece a una organizacion.
- Un cliente tiene una o varias entidades fiscales.

RLS:

- Roles internos pueden leer clientes.
- `accountant/admin/owner` pueden crear y editar.
- Rol `client` solo debe ver clientes/entidades expresamente asignados.

### 5. Fiscal entities

Responsabilidad:

- Sujeto fiscal real: autonomo, sociedad, comunidad, etc.

Tabla:

- `fiscal_entities`

Campos conceptuales:

- `organization_id`
- `client_id`
- `legal_name`
- `trade_name`
- `tax_id`
- `tax_id_country`
- `entity_type`: `self_employed`, `company`, `other`
- `fiscal_address`
- `province`
- `postal_code`
- `country`
- `status`

Relaciones:

- Una entidad fiscal tiene documentos, facturas, gastos, impuestos y reportes.

RLS:

- Igual que `clients`, pero siempre filtrado por organizacion y permisos asignados.

### 6. Documents

Responsabilidad:

- Documento logico procesable.
- Estado global del pipeline documental.

Tabla:

- `documents`

Campos conceptuales:

- `organization_id`
- `fiscal_entity_id`
- `client_id`
- `document_type`: `unknown`, `invoice_received`, `invoice_issued`, `expense`, `tax_form`, `bank`, `contract`, `other`
- `status`
- `source`: `manual_upload`, `email`, `api`, `future_integration`
- `title`
- `period_start`
- `period_end`
- `uploaded_by`
- `current_extraction_id`
- `failure_reason`

Estados:

- `uploaded`: registro creado tras subida.
- `queued`: job documental creado.
- `extracting_text`: worker extrayendo texto.
- `text_extracted`: texto guardado.
- `ocr_required`: no hay texto suficiente y necesita OCR.
- `ocr_processing`: OCR en curso.
- `ai_processing`: IA en curso.
- `ai_processed`: salida IA recibida y validada tecnicamente.
- `needs_review`: pendiente de revision humana.
- `approved`: aprobado por humano.
- `rejected`: descartado por humano.
- `failed`: error no recuperable o reintentos agotados.

RLS:

- Miembros con acceso a la entidad fiscal pueden leer documentos.
- Upload permitido a roles habilitados.
- Borrado logico solo `admin/owner`.
- Aprobacion solo `reviewer/accountant/admin/owner`.

### 7. Document files

Responsabilidad:

- Archivos fisicos asociados a un documento.

Tabla:

- `document_files`

Campos conceptuales:

- `organization_id`
- `document_id`
- `storage_bucket`
- `storage_path`
- `original_filename`
- `mime_type`
- `size_bytes`
- `sha256_hash`
- `page_count`
- `file_status`: `uploaded`, `available`, `corrupt`, `deleted`
- `is_primary`

Reglas:

- Un documento puede tener multiples archivos.
- `sha256_hash` se usa para duplicados.
- El archivo original nunca se modifica.

RLS:

- Lectura condicionada por acceso al documento.
- Descarga mediante URL firmada generada en backend seguro.
- Nunca hacer publico el bucket.

### 8. Document text

Responsabilidad:

- Guardar texto extraido por pagina/chunk.

Tablas:

- `document_pages`
- `document_text_chunks`

Campos conceptuales:

- `organization_id`
- `document_id`
- `document_file_id`
- `page_number`
- `text`
- `text_quality`
- `extraction_method`: `embedded_text`, `ocr`, `manual`
- `metadata`

RLS:

- Lectura igual a documentos.
- Escritura solo backend/worker.

### 9. Extractions

Responsabilidad:

- Resultado estructurado propuesto por IA o reglas.

Tabla:

- `document_extractions`

Campos conceptuales:

- `organization_id`
- `document_id`
- `provider`
- `model`
- `prompt_version`
- `schema_version`
- `raw_response_id`
- `normalized_data`
- `confidence_overall`
- `status`: `draft`, `valid`, `invalid`, `superseded`
- `validation_errors`
- `needs_human_review`

Reglas:

- Puede haber varias extracciones por documento.
- Solo una puede ser la extraccion activa.
- Nunca convertir automaticamente sin revision humana en MVP.

RLS:

- Lectura por roles con acceso al documento.
- Escritura solo backend/worker.
- Edicion humana no modifica la respuesta cruda; crea revision/correccion.

### 10. Review tasks

Responsabilidad:

- Bandeja de validacion humana.

Tabla:

- `review_tasks`

Campos conceptuales:

- `organization_id`
- `document_id`
- `extraction_id`
- `assigned_to`
- `status`: `open`, `in_review`, `approved`, `rejected`, `changes_requested`
- `priority`
- `reason`
- `due_at`
- `reviewed_by`
- `reviewed_at`
- `review_notes`

RLS:

- Revisores pueden ver tareas de su organizacion.
- Usuarios cliente solo tareas/documentos asignados expresamente.
- Aprobacion queda auditada.

### 11. Invoices and expenses

Responsabilidad:

- Registros contables/fiscales generados tras revision.

Tablas:

- `invoices`
- `invoice_lines`
- `tax_breakdowns`

Campos conceptuales de factura:

- `organization_id`
- `fiscal_entity_id`
- `client_id`
- `source_document_id`
- `source_extraction_id`
- `direction`: `issued`, `received`
- `supplier_tax_id`
- `customer_tax_id`
- `invoice_number`
- `issue_date`
- `due_date`
- `currency`
- `subtotal_amount`
- `tax_amount`
- `total_amount`
- `status`: `draft`, `booked`, `void`, `needs_fix`
- `human_approved_by`
- `human_approved_at`

Reglas:

- MVP puede tratar gastos como facturas recibidas.
- La factura debe conservar enlace a documento y extraccion.

RLS:

- Lectura por acceso a entidad fiscal.
- Escritura inicial solo por conversion aprobada.
- Edicion fiscal sensible auditada.

### 12. Taxes and reports

Responsabilidad:

- Agregados fiscales basicos para dashboard.

Tablas:

- `tax_periods`
- `tax_summaries`

Campos conceptuales:

- `organization_id`
- `fiscal_entity_id`
- `period_type`: `month`, `quarter`, `year`
- `period_start`
- `period_end`
- `output_vat`
- `input_vat`
- `expense_total`
- `income_total`
- `status`: `open`, `reviewing`, `closed`

Reglas:

- En MVP puede ser calculado bajo demanda o materializado simple.
- No presentar como declaracion oficial.

### 13. AI providers

Responsabilidad:

- Configuracion no secreta de proveedores IA.

Tablas:

- `ai_providers`
- `ai_models`
- `ai_prompt_templates`

Campos conceptuales:

- `provider_key`: `openai`, `deepseek`, `future`
- `display_name`
- `enabled`
- `capabilities`
- `default_model`
- `cost_policy`
- `prompt_version`
- `schema_version`

Reglas:

- Las claves privadas viven en secretos del entorno, no en base de datos.
- La base de datos solo guarda alias y configuracion no sensible.

### 14. AI logs

Responsabilidad:

- Trazabilidad completa de llamadas IA y costes.

Tablas:

- `ai_requests`
- `ai_responses`
- `ai_cost_events`

Campos conceptuales:

- `organization_id`
- `document_id`
- `task_type`
- `provider`
- `model`
- `prompt_version`
- `schema_version`
- `input_token_count`
- `output_token_count`
- `estimated_cost_cents`
- `latency_ms`
- `status`: `success`, `schema_error`, `provider_error`, `timeout`, `fallback_used`
- `raw_response`
- `normalized_result_ref`
- `error_message`

RLS:

- Lectura resumida para admins.
- Respuesta cruda restringida a roles internos autorizados.
- Escritura solo backend/worker.

### 15. Audit logs

Responsabilidad:

- Auditoria de acciones sensibles.

Tabla:

- `audit_logs`

Campos conceptuales:

- `organization_id`
- `actor_user_id`
- `actor_role`
- `action`
- `resource_type`
- `resource_id`
- `before_snapshot`
- `after_snapshot`
- `ip_address`
- `user_agent`
- `created_at`

Acciones iniciales:

- `organization.created`
- `member.invited`
- `member.role_changed`
- `client.created`
- `document.uploaded`
- `document.deleted`
- `document.extraction_started`
- `document.review_approved`
- `document.review_rejected`
- `invoice.created_from_document`
- `ai.requested`
- `ai.failed`

RLS:

- Lectura solo `owner/admin`.
- Escritura solo backend seguro.
- Sin updates/deletes desde aplicacion.

### 16. Job tracking

Responsabilidad:

- Estado interno de procesamiento, independiente de Supabase Queues.

Tabla:

- `processing_jobs`

Campos conceptuales:

- `organization_id`
- `document_id`
- `job_type`: `extract_text`, `ocr`, `ai_extract`, `classify`, `deduplicate`, `validate`
- `status`: `queued`, `running`, `succeeded`, `failed`, `retrying`, `cancelled`
- `attempt_count`
- `max_attempts`
- `last_error`
- `started_at`
- `finished_at`
- `queue_message_id`

Reglas:

- Supabase Queues mueve mensajes.
- `processing_jobs` da trazabilidad de producto.

## Matriz RLS inicial

Roles:

- `owner`: control total de la organizacion.
- `admin`: gestion operativa salvo eliminar owner unico.
- `accountant`: gestiona clientes, documentos, facturas y revision.
- `reviewer`: revisa documentos asignados o de la organizacion.
- `client`: acceso limitado a sus entidades/documentos asignados.

Permisos resumidos:

| Recurso | owner | admin | accountant | reviewer | client |
|---|---:|---:|---:|---:|---:|
| Organization | leer/editar | leer/editar | leer | leer | leer limitado |
| Members | gestionar | gestionar | leer | leer limitado | no |
| Clients | gestionar | gestionar | gestionar | leer | leer asignado |
| Fiscal entities | gestionar | gestionar | gestionar | leer | leer asignado |
| Documents | gestionar | gestionar | gestionar | revisar | subir/ver asignado |
| Document files | URL firmada | URL firmada | URL firmada | URL firmada | URL firmada asignada |
| Extractions | leer | leer | leer | leer | no por defecto |
| Review tasks | gestionar | gestionar | gestionar | gestionar asignadas | no |
| Invoices | gestionar | gestionar | gestionar | leer | leer asignado |
| AI logs | leer | leer | leer resumen | no | no |
| Audit logs | leer | leer | no | no | no |
| Settings | gestionar | gestionar | leer | no | no |

Regla base de cualquier tabla de negocio:

```text
El usuario autenticado puede acceder a la fila solo si existe una membresia activa
en la misma organization_id y el rol tiene permiso para la accion.
```

Regla base para Storage:

```text
El path del objeto debe incluir organization_id y document_id.
El usuario solo puede operar sobre objetos cuya organization_id pertenezca a una membresia activa.
Las descargas de PDFs se hacen por URL firmada emitida por backend seguro.
```

## Indices conceptuales

Necesarios desde el primer SQL:

- Todas las tablas con `organization_id`.
- Membresia por `user_id` + `organization_id`.
- Documentos por `organization_id`, `fiscal_entity_id`, `status`.
- Archivos por `sha256_hash`.
- Review tasks por `organization_id`, `status`, `assigned_to`.
- AI logs por `organization_id`, `document_id`, `created_at`.
- Audit logs por `organization_id`, `resource_type`, `resource_id`, `created_at`.
- Invoices por `organization_id`, `fiscal_entity_id`, `issue_date`, `invoice_number`.

## Flujos principales

### Alta de organizacion

1. Usuario se registra.
2. Se crea perfil.
3. Se crea organizacion.
4. Se crea membresia `owner`.
5. Se emite audit log.

### Subida de documento

1. Usuario elige entidad fiscal.
2. Backend valida membresia y permisos.
3. Backend crea `document`.
4. Backend prepara subida a Storage privado.
5. Se crea `document_file`.
6. Se calcula hash.
7. Se crea `processing_job`.
8. Se envia mensaje a la cola.
9. Documento pasa a `queued`.

### Procesamiento documental

1. Worker toma mensaje.
2. Marca job `running`.
3. Descarga archivo con credenciales seguras.
4. Extrae texto embebido.
5. Guarda paginas/chunks.
6. Si el texto es insuficiente, marca `ocr_required`.
7. Si hay texto, llama a IA.
8. Valida JSON.
9. Guarda `document_extraction`.
10. Crea `review_task`.
11. Documento pasa a `needs_review`.

### Revision humana

1. Revisor abre tarea.
2. Compara PDF, texto y propuesta IA.
3. Corrige campos.
4. Aprueba o rechaza.
5. Si aprueba, se crea factura/gasto.
6. Se registra auditoria.

## Validaciones fiscales iniciales

MVP 1:

- NIF/CIF presente.
- Fecha de factura presente.
- Numero de factura presente si existe.
- Total = base + IVA dentro de tolerancia.
- Moneda presente.
- Tipo de IVA permitido para Espana.
- Duplicado potencial por proveedor, numero, fecha, total y hash.
- Confianza minima por campos criticos.

No MVP 1:

- Presentacion de modelos oficiales.
- Verifactu operativo.
- Factura electronica B2B operativa.
- Validacion fiscal cerrada con garantia legal.

## Decisiones pendientes antes de SQL

- Confirmar si `client` puede subir documentos directamente en MVP.
- Confirmar campos exactos de factura recibida inicial.
- Confirmar limites de archivo: MB maximos y paginas maximas.
- Confirmar region Supabase.
- Confirmar si se crea schema privado para funciones auxiliares.
- Confirmar si las vistas de dashboard seran `security_invoker` o calculos server-side.
- Confirmar politica de retencion y borrado documental.
- Confirmar si AI logs crudos deben cifrarse adicionalmente.

## Resultado de este paso

Cuando este documento se convierta en implementacion, el siguiente artefacto debe ser:

- Migracion inicial Supabase.
- Politicas RLS por tabla.
- Politicas Storage.
- Tests de acceso cruzado entre organizaciones.
- Seeds minimos para entorno local.
