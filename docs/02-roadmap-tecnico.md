# Roadmap tecnico

Fecha: 2026-06-04
Estado: plan vivo sincronizado con el repositorio principal

Nota operativa:

- Este roadmap ya refleja que varias fases se han iniciado como nucleos offline verificables y que el MVP documental ya esta conectado a Supabase remoto.
- Supabase remoto `F_Gestor-IA` esta vinculado con project ref `yhnqdntfxeojhfgdvkva` y tiene migraciones aplicadas, incluidas onboarding minimo y hardening de Storage. Supabase local sigue pendiente por Docker Desktop.
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

Estado:

- Iniciada en producto con registro email/password y onboarding minimo.
- La RPC `create_onboarding_workspace` crea en transaccion organizacion, membership owner, cliente, entidad fiscal y acceso uploader para el usuario autenticado.
- `/dashboard` redirige a `/onboarding` cuando el usuario no tiene organizacion activa.
- Migracion `20260604113000_onboarding_minimal` aplicada en Supabase remoto el 2026-06-04.
- Pendiente CRUD posterior de clientes/entidades fiscales, invitaciones, roles y settings.

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

Estado:

- Upload multi-PDF conectado a Storage privado y PGMQ.
- Formulario de subida usa Server Action con input file; React/Next declaran automaticamente `multipart/form-data`, sin `encType` manual para evitar error de React 19.
- RLS de Storage endurecido: el `organization_id` del path debe coincidir con la organizacion real de la entidad fiscal.
- Migracion `20260604114000_harden_storage_path_rls` aplicada en Supabase remoto el 2026-06-04.
- Detalle de revision con URL firmada server-side para visualizar o abrir el PDF privado.

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
- `extract_text` procesa todos los PDFs disponibles del documento, crea paginas/chunks, detecta duplicados exactos por hash y encadena `ai_extract`.
- Reclamacion idempotente de jobs: solo `queued/retrying` pasan a `running`; mensajes duplicados no incrementan intentos ni pisan un worker activo.
- Backoff exponencial para reintentos.
- Logs JSON estructurados por `job_id`, `document_id` y `organization_id`.
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
- Registro de fallos IA en `ai_requests` para errores de proveedor, timeout o esquema antes de respuesta valida.

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
- Adaptador transaccional DB implementado.
- UI Next.js de detalle de factura con campos editables y acciones aprobar, pedir cambios o rechazar.

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

- Motor offline de snapshot disponible para datos JSON/exportados.
- Primera UI Next.js conectada a Supabase en Fase 16: dashboard autenticado, subida multi-PDF, bandeja documental, detalle de factura y acciones de revision.
- Pendiente evolucionar la UI de dashboard fiscal hacia consultas agregadas reales por periodo.

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
- Analitica fiscal avanzada por periodo desde UI.

Criterio de salida:

- Se puede generar un snapshot documental/fiscal de una organizacion y ver el estado documental basico desde UI autenticada.

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
- Cobertura unitaria de dispatcher por `job_type`, dedupe documental por hash, presupuesto IA y `applyInvoiceReview`.
- Workflow manual `.github/workflows/smoke-mvp-remote.yml` preparado para ejecutar el smoke remoto con cleanup por defecto.

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
- `npm run ci:static` cubre ya dispatcher, dedupe documental, presupuesto IA, aprobacion humana, ledger normativo y validacion local Supabase.
- El smoke remoto completo queda disponible como workflow manual GitHub Actions con secretos explicitos y modo `run_ai`.

Siguiente prioridad alta:

- Preparar fixture de factura real para repetir el smoke completo sin depender solo del PDF sintetico.
- Repetir smoke/revision con una factura real visible desde URL firmada, ahora que onboarding minimo y hardening Storage ya estan aplicados en remoto.
- Validar Supabase local cuando Docker Desktop este operativo y promocionar esa puerta a PR.
- Anadir proveedor OCR real cuando el flujo PDF + revision este cerrado.

## Fase 16 - Superficie Next.js minima

Objetivo:

- Abrir una primera superficie de producto real sobre Supabase Auth/RLS.

Estado:

- Completada como primera superficie operativa.
- Next.js App Router instalado con React.
- `@supabase/ssr` integrado con `getAll`/`setAll`.
- `proxy.ts` refresca sesion con `supabase.auth.getUser()`.
- `/login` usa server actions de login y registro con email/password.
- `/onboarding` crea el alta inicial cuando no hay organizacion activa.
- `/dashboard` requiere usuario autenticado, resuelve organizacion activa, muestra bandeja documental/revisiones, permite subir uno o varios PDFs a Storage y encola `extract_text`.
- `/dashboard/review/[taskId]` muestra detalle de factura, genera URL firmada del PDF original y permite aprobar, pedir cambios o rechazar.
- Configuracion Supabase endurecida: `SUPABASE_URL` tiene prioridad sobre `NEXT_PUBLIC_SUPABASE_URL` en servidor y `SUPABASE_PROJECT_REF` bloquea hosts de otro proyecto antes de llamar a Auth.
- Import interno de revision ajustado para Next/Turbopack, evitando resolucion fallida de sufijos `.js` en modulos TypeScript usados por Server Actions.
- `ocr_required` queda visible como metrica y estado destacado.
- `ci:static` incluye `next build`.
- `postcss` queda forzado por override a `8.5.10`; `npm audit --omit=dev` queda limpio.

Incluye:

- Auth Supabase SSR.
- Login, registro y logout.
- Onboarding minimo de organizacion, cliente y entidad fiscal.
- Selector de organizacion activa por query.
- Metricas de documentos, revision, OCR pendiente, clientes y entidades fiscales.
- Lista de documentos y tareas de revision bajo RLS.
- Upload multi-PDF con validacion app-side del `storage_path` contra `organization_id`, `fiscal_entity_id`, `document_id` y `document_file_id`.
- URL firmada server-side para revisar el PDF original desde Storage privado.
- Creacion server-side de `processing_job` y mensaje PGMQ.
- Detalle de factura con aprobacion/rechazo y auditoria.

No incluye todavia:

- CRUD posterior de clientes/entidades fiscales.
- Invitaciones, gestion de miembros, roles y settings.
- Visor PDF avanzado con paginacion, zoom y auditoria de descarga.
- OCR real con proveedor externo.

Criterio de salida:

- Un usuario nuevo puede registrarse, crear su alta inicial, entrar y ver su bandeja documental sin usar `service_role` en frontend.

Resultado:

- `npm run typecheck`, `npm run test:unit`, `npm run ci:static` y `npm run build` pasan localmente.
- Guardarrail de Supabase cubierto por `src/lib/supabase/config.test.ts`: un `NEXT_PUBLIC_SUPABASE_URL` heredado no pisa `SUPABASE_URL`, y un project ref distinto falla con error explicito.

## Fase 17 - Estructura UI modular tipo ERP

Objetivo:

- Dar a GFiscal una forma de aplicacion contable/ERP, usando como referencia local la captura de Sage Active almacenada en `C:\Users\sergi\Documents\Software\SADGE_Asor-IA`.

Estado:

- Iniciada como estructura de producto navegable.
- `/dashboard` deja de ser una unica web app plana y pasa a un shell con sidebar modular.
- La navegacion principal expone `Cuadros de mando`, `Ventas`, `Compras`, `Contactos`, `Productos y servicios`, `Bancos`, `Contabilidad`, `Declaraciones` e `Informes`.
- `Cuadros de mando` incluye pestañas server-side por query: `Contabilidad`, `Ventas y compras` y `Novedades`.
- `Ventas y compras` replica la jerarquia de Sage Active: importes pendientes, pendiente de cobro/pago, tarjetas de facturas, clientes activos, accesos rapidos, facturas vencidas y presupuestos pendientes.
- Los demas modulos tienen superficie base con hero, KPIs, acciones rapidas y tabla vacia profesional.
- Los textos y quick actions proceden del material local de Sage Active cuando hay correspondencia clara.
- Los datos reales se usan solo donde GFiscal ya tiene modelo: documentos, clientes, entidades fiscales, OCR y revision. Los importes/filas comerciales son semilla visual.

Incluye:

- Shell visual tipo ERP.
- Sidebar modular.
- Query params `module` y `tab`.
- Catalogo de modulos en codigo.
- Superficies base para construir CRUDs y tablas reales.
- Dependencia `lucide-react` para iconografia consistente.

No incluye todavia:

- Modelo real de ventas, compras, presupuestos, vencimientos, proveedores, productos, bancos o declaraciones.
- CRUDs completos por modulo.
- Conciliacion bancaria real.
- Informes financieros agregados desde PostgreSQL.
- Sustitucion de datos semilla por datos reales.

Criterio de salida:

- Cada modulo principal tiene una primera superficie navegable y preparada para conectarse a datos reales sin rehacer la estructura visual.

Siguiente prioridad alta:

- Definir y migrar tablas comerciales minimas: facturas de venta, facturas de compra, vencimientos, presupuestos, clientes/proveedores ampliados y productos/servicios.
- Reemplazar datos semilla de `Ventas y compras` por consultas agregadas.
- Conectar acciones rapidas a rutas/forms reales por modulo.

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
