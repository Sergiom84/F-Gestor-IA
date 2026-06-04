# Roadmap tecnico

Fecha: 2026-06-04
Estado: plan vivo sincronizado con July y remoto principal

Nota operativa:

- July es la memoria mas reciente del proyecto.
- Este roadmap ya refleja que varias fases se han iniciado como nucleos offline verificables y que el MVP documental ya esta conectado a Supabase remoto.
- Supabase remoto `F_Gestor-IA` esta vinculado y tiene migraciones aplicadas. Supabase local sigue pendiente por Docker Desktop.
- Remoto principal: https://github.com/Sergiom84/F-Gestor-IA.

Este roadmap evita construir todo de golpe. Cada fase debe terminar con una superficie usable y verificable.

## Fase 0 - Diseno de datos y seguridad

Objetivo:

- Convertir la arquitectura inicial en un modelo Supabase implementable.

Entregables:

- Modelo de datos final.
- Enums y relaciones.
- Matriz RLS por rol.
- Politicas Storage.
- Estructura de buckets y paths.
- Plan de tests de RLS.

Criterio de salida:

- Se puede escribir la primera migracion sin resolver dudas estructurales grandes.

## Fase 1 - Base SaaS

Objetivo:

- Tener una app usable con autenticacion, organizaciones y clientes.

Incluye:

- Next.js App Router.
- Supabase Auth SSR.
- Crear organizacion.
- Cambiar organizacion activa.
- Invitar miembros basicos.
- CRUD de clientes.
- CRUD de entidades fiscales.

No incluye:

- IA.
- Procesamiento documental.
- Dashboard fiscal real.

Criterio de salida:

- Un usuario puede registrarse, crear organizacion, crear cliente y entidad fiscal sin cruzar datos entre tenants.

## Fase 2 - Documentos y Storage privado

Objetivo:

- Subir, listar y visualizar PDFs de forma segura.

Incluye:

- Bucket privado.
- Registro `documents`.
- Registro `document_files`.
- Upload validado server-side.
- URL firmada para lectura.
- Hash de archivo.
- Duplicado basico por hash.

No incluye:

- OCR.
- Extraccion IA.

Criterio de salida:

- Un usuario autorizado puede subir y ver un PDF; otro tenant no puede verlo ni por URL ni por API.

## Fase 3 - Worker documental basico

Objetivo:

- Procesar PDFs con texto embebido sin bloquear la UI.

Estado:

- Worker TypeScript conectado a Supabase remoto.
- Despacha por `processing_jobs.job_type`.
- `extract_text` crea paginas/chunks, detecta duplicados exactos por hash y encadena `ai_extract`.
- Pendiente de validacion local cuando Docker Desktop este disponible.

Incluye:

- Supabase Queues.
- Worker externo TypeScript.
- `processing_jobs`.
- Extraccion de texto por pagina.
- Estados: `queued`, `extracting_text`, `text_extracted`, `failed`.
- Logs de errores.
- Encadenado PGMQ `extract_text` -> `ai_extract`.
- Dedupe exacto por `sha256_hash`.

No incluye:

- OCR.
- IA compleja.

Criterio de salida:

- Un PDF con texto queda procesado y consultable por paginas/chunks.

## Fase 4 - IA para facturas recibidas

Objetivo:

- Extraer datos de facturas recibidas con IA y validacion estructurada.

Estado:

- Conectada al worker MVP.
- Capa OpenAI, contrato Zod/JSON Schema, validacion fiscal basica y persistencia IA operativas contra Supabase remoto.
- Pendiente de prueba end-to-end con factura real y `OPENAI_API_KEY`.

Incluye:

- Capa comun de proveedor IA.
- OpenAI como proveedor principal.
- JSON Schema/Zod.
- Prompt versionado.
- `ai_requests`, `ai_responses`, `ai_cost_events`.
- `document_extractions`.
- Validacion fiscal basica.
- Control de presupuesto mensual por organizacion.
- Deteccion de duplicados fiscales contra `invoices`.
- Fallback preparado, aunque no necesariamente activo en produccion.

No incluye:

- Automatizar aprobacion.
- Modelos fiscales oficiales.

Criterio de salida:

- Una factura recibida genera propuesta estructurada con evidencias y campos dudosos.

## Fase 5 - Bandeja de revision

Objetivo:

- Convertir IA en flujo contable seguro con decision humana.

Estado:

- Conectada a Supabase remoto.
- Contrato de decision humana, aprobacion/rechazo/cambios, conversion a factura y evento de auditoria.
- Adaptador transaccional DB implementado; UI queda pendiente.

Incluye:

- `review_tasks`.
- UI de revision con PDF + propuesta + campos editables.
- Aprobar/rechazar.
- Crear factura/gasto desde extraccion aprobada.
- Audit log de aprobacion.
- CLI DB `review:invoice-db`.

Criterio de salida:

- Ningun dato fiscal entra como factura/gasto sin aprobacion humana.

## Fase 6 - Dashboard MVP

Objetivo:

- Dar visibilidad basica de estado documental y fiscal.

Estado:

- En curso como motor offline de snapshot: agregacion de documentos, revision, facturas aprobadas, IVA e IA desde datos JSON/exportados.
- UI y consultas directas a Supabase quedan para el final de integracion.

Incluye:

- Documentos pendientes.
- Documentos fallidos.
- Facturas/gastos aprobados.
- Totales por periodo.
- IVA soportado/repercutido basico.
- Coste IA estimado por organizacion.

No incluye:

- Declaraciones oficiales.
- Recomendaciones fiscales cerradas.
- Conexion directa a Supabase remoto hasta tener URL y claves.

Criterio de salida:

- Se puede generar un snapshot del estado documental/fiscal de una organizacion desde datos exportados o mock, con la misma forma que usara la futura UI.

## Fase 7 - OCR y PDFs dificiles

Objetivo:

- Ampliar cobertura documental.

Estado:

- Iniciada como nucleo offline de planificacion OCR: deteccion por pagina, presupuesto por pagina, limites de ejecucion, reintentos y merge de resultados parciales.
- Proveedor OCR UE, persistencia Supabase y ejecucion real de OCR quedan para integracion final.

Incluye:

- Deteccion de PDFs escaneados.
- OCR con proveedor UE.
- Reintentos por pagina.
- Guardado de resultados parciales.
- Cost control por pagina.

No incluye todavia:

- Llamadas reales a proveedor OCR.
- Persistencia de resultados OCR en Supabase.
- Renderizado de paginas PDF a imagen.

Criterio de salida:

- Un PDF puede inspeccionarse localmente y producir un plan OCR auditable con paginas seleccionadas, bloqueadas, coste estimado y siguiente estado documental.

## Fase 8 - Preparacion normativa

Objetivo:

- Preparar estructura para Verifactu, factura electronica B2B y trazabilidad.

Estado:

- Iniciada como ledger normativo offline: readiness, eventos encadenados por hash, export interno y separacion entre registro interno, VERI*FACTU y factura electronica B2B.
- No certifica cumplimiento ni envia registros oficiales.

Incluye:

- Campos de trazabilidad.
- Eventos inmutables de factura.
- Preparacion de identificadores y estados.
- Separacion entre registro interno y envio/comunicacion normativa.
- Preparacion para QR/leyenda VERI*FACTU sin activarla si no hay remision real.
- Estados de factura electronica B2B.

No incluye sin validacion legal/fiscal:

- Certificar cumplimiento completo.
- Envio real a sistemas oficiales.
- Generar payload oficial AEAT, Facturae, UBL, CII o Peppol.

Criterio de salida:

- Una factura emitida puede generar un evento interno encadenado, readiness normativo, avisos bloqueantes y export JSON no oficial, manteniendo claro que el envio oficial queda fuera.

## Fase 9 - Integridad del ledger normativo

Objetivo:

- Endurecer la trazabilidad normativa interna antes de persistirla en Supabase.

Estado:

- Iniciada como verificacion local: tests de hash chain, validacion de append y contrato de fila futura `regulatory_event_row_v1`.
- No crea migracion nueva ni afirma cumplimiento oficial.

Incluye:

- Validar el ledger completo al preparar el siguiente evento.
- Detectar alteracion de payload.
- Detectar ruptura de `previous_hash`.
- Evitar append con otra organizacion/factura.
- Evitar eventos con fecha anterior al ultimo evento.
- Preparar shape futuro para tabla append-only.

No incluye todavia:

- Tabla `regulatory_events` en Supabase.
- Validacion contra Docker/Supabase local.
- Payload oficial AEAT/VERI*FACTU/B2B.
- Firma, sello, certificados o canal de envio.

Criterio de salida:

- El ledger normativo tiene pruebas locales que demuestran deteccion de manipulacion y reglas minimas de append.

## Fase 10 - Persistencia del ledger normativo

Objetivo:

- Preparar la tabla Supabase append-only que persistira eventos normativos internos.

Estado:

- Aplicada en Supabase remoto.
- `public.regulatory_events` con RLS, triggers de no mutacion, validacion de append y shape alineado con `regulatory_event_row_v1`.
- Pendiente de validar en Supabase local cuando Docker este disponible.

Incluye:

- Enum `regulatory_event_type`.
- Tabla `regulatory_events`.
- Consistencia por `organization_id`, `fiscal_entity_id` e `invoice_id`.
- Un solo primer evento por factura.
- Un solo hijo por `previous_hash` en la misma factura.
- Triggers para bloquear update/delete.
- RLS de lectura por acceso a factura.
- Sin escritura desde clientes autenticados.

No incluye todavia:

- Aplicar migracion en Supabase local.
- Adapter server-side de insercion.
- Tests SQL de acceso cruzado.
- Payload oficial, firma, certificado o envio.

Criterio de salida:

- La migracion puede aplicarse en Supabase local y demostrar que usuarios de otra organizacion no leen eventos y que update/delete quedan bloqueados.

## Fase 11 - Adaptador server-side del ledger normativo

Objetivo:

- Conectar la logica regulatoria offline con la tabla `regulatory_events` sin exponer claves elevadas al navegador.

Estado:

- Iniciada como adaptador de worker: carga factura y eventos previos desde Postgres, prepara el siguiente evento, valida readiness/cadena y lo inserta en `regulatory_events`.
- Supabase remoto disponible; prueba end-to-end queda pendiente tras aprobar una factura real.
- Supabase local sigue sin Postgres activo en `127.0.0.1:54322`.

Incluye:

- `regulatory/repository.ts`.
- `persistRegulatoryEventForInvoice`.
- Bloqueo de persistencia si readiness esta `blocked`.
- Bloqueo de persistencia si la cadena no es valida.
- CLI `regulatory:persist-invoice`.
- Tests locales de mapping y bloqueo de persistencia.

No incluye todavia:

- Ejecucion contra Supabase local/remoto.
- Insercion desde UI.
- Uso de claves secret/service role en frontend.
- Payload oficial ni envio oficial.

Criterio de salida:

- Un worker o proceso server-side puede crear el siguiente evento regulatorio interno para una factura aprobada, sin que ningun cliente autenticado tenga permiso directo de escritura sobre el ledger.

## Fase 12 - Tests DB del ledger normativo

Objetivo:

- Preparar una suite pgTAP para verificar estructura, RLS y reglas append-only de `regulatory_events`.

Estado:

- Test SQL preparado en `supabase/tests/database/regulatory_events.test.sql`.
- Pendiente de ejecutar porque Supabase local no esta levantado.
- Advisors remotos security/performance pasan sin issues.

Incluye:

- Test de existencia de tabla.
- Test de RLS activo.
- Test de politica `regulatory_events_select_allowed`.
- Test de privilegios: `authenticated` solo lee, no inserta/actualiza/borra.
- Test de aislamiento entre dos organizaciones.
- Test de bloqueo update/delete por trigger.
- Test de bloqueo de `previous_hash` perteneciente a otra factura/organizacion.

No incluye todavia:

- Ejecucion real con `supabase test db`.
- Advisors Supabase.
- CI.

Criterio de salida:

- `npm run db:test` pasa contra Supabase local tras aplicar migraciones, demostrando que el ledger no permite acceso cruzado ni mutacion.

## Fase 13 - Validacion local Supabase

Objetivo:

- Agrupar la validacion local de Supabase en un runner repetible y no destructivo.

Estado:

- Iniciada con `npm run supabase:validate-local`: primero comprueba conectividad a Postgres local y despues ejecuta `migration list`, `db lint` y `test db` en modo local.
- Sigue pendiente de ejecucion completa porque Supabase local no esta levantado.
- Validacion remota manual realizada con `supabase migration list`, `db advisors` security/performance y consultas de humo.

Incluye:

- Preflight de `DATABASE_URL`.
- Plan explicito no destructivo.
- Lint de schemas `public`, `auth` y `storage`.
- Ejecucion pgTAP local con `supabase test db --local`.
- Mensaje de recuperacion cuando falta Docker/Postgres local.

No incluye todavia:

- Levantar Docker Desktop desde el runner.
- Ejecutar `db reset` automaticamente.
- CI.

Criterio de salida:

- `npm run supabase:validate-local` pasa contra Supabase local despues de aplicar migraciones, sin errores de lint y con pgTAP en verde.

## Fase 14 - CI y calidad minima

Objetivo:

- Preparar una puerta de calidad automatizable para codigo TypeScript y validacion Supabase local.

Estado:

- Iniciada con workflows GitHub Actions y scripts npm de CI.
- CI rapido activo para push/PR.
- Validacion Supabase local preparada como workflow manual hasta que Docker/pgTAP se valide una vez.

Incluye:

- `.github/workflows/ci.yml`.
- `.github/workflows/supabase-local.yml`.
- `npm run ci:static`.
- `npm run ci:supabase-local`.
- `npm run ci:full`.
- Supabase CLI fijado a `2.104.0` en CI DB.

No incluye todavia:

- Job Supabase obligatorio en cada PR.
- Deploy.
- Environments staging/production.
- Secretos remotos.
- Validacion contra Supabase cloud.

Criterio de salida:

- `ci:static` pasa localmente y en GitHub Actions.
- El workflow manual Supabase puede levantar Postgres local, aplicar migraciones y ejecutar lint/pgTAP.
- Una vez validado, el job Supabase se puede activar para PRs que cambien schema, tests DB o codigo regulatorio.

## Fase 15 - Smoke test MVP remoto

Objetivo:

- Demostrar el flujo real de punta a punta con Supabase remoto.

Estado:

- Completada con fixture sintetico.
- Migraciones remotas aplicadas.
- Script `npm run smoke:mvp-remote` creado.
- Smoke remoto con `--cleanup` validado: Storage, PGMQ, `extract_text`, paginas/chunks, `ai_extract`, `review_task`, aprobacion DB, `invoice` y limpieza de fixtures.
- Variante `--skip-ai --cleanup` validada para entornos sin `OPENAI_API_KEY`.
- Cobertura unitaria inicial de `applyInvoiceReview`: aprobacion con correcciones humanas y bloqueo por campos fiscales obligatorios.

Incluye:

- Script de smoke remoto que crea organizacion, cliente, entidad fiscal, documento, archivo, `processing_job` y mensaje PGMQ.
- Upload de PDF fixture a Storage privado.
- Ejecucion controlada del mismo procesador que usa `worker:documents`.
- Comprobacion de `document_pages`, `document_text_chunks`, `processing_jobs`, `document_extractions` y `review_tasks`.
- Aprobacion con `review:invoice-db` cuando haya extraccion real.
- Cleanup de Storage, organizacion y usuario smoke temporal.

No incluye todavia:

- UI.
- OCR real.
- Automatizacion fiscal oficial.

Criterio de salida:

- Una factura PDF atraviesa `extract_text` -> `ai_extract` -> `review_task` -> aprobacion DB y crea una fila en `invoices` con auditoria.

Resultado:

- Cumplido el 2026-06-04 contra Supabase remoto con PDF sintetico y cleanup. Queda pendiente repetir con factura real.
- `npm run ci:static` cubre ya el test unitario de aprobacion humana, ademas de ledger normativo y validacion local Supabase.

Siguiente prioridad alta:

- Ampliar tests del flujo nuevo: dispatcher por `job_type`, dedupe por hash y presupuesto IA.
- Preparar fixture de factura real para repetir el smoke completo sin depender solo del PDF sintetico.

## Backlog consciente

- Conciliacion bancaria.
- Email inbound para documentos.
- Integracion con ERPs.
- Multi-pais.
- Modelos fiscales oficiales.
- Firma electronica.
- Portal avanzado para cliente final.
- Workflows por gestoria.

## Regla de producto

GFiscal debe crecer desde una bandeja documental fiable, no desde automatizacion fiscal total. La confianza del producto depende de:

- Seguridad multi-tenant.
- Trazabilidad.
- Revision humana.
- Costes IA controlados.
- Estados claros.
- Errores recuperables.
