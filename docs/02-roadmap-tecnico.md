# Roadmap tecnico

Fecha: 2026-06-03  
Estado: plan vivo sincronizado con July

Nota operativa:

- July es la memoria mas reciente del proyecto.
- Este roadmap ya refleja que varias fases se han iniciado como nucleos offline verificables.
- La conexion real a Supabase remoto, URL, claves y validacion end-to-end quedan deliberadamente para el final, cuando el entorno este disponible.

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

- Esqueleto TypeScript creado.
- Pendiente de validacion contra Supabase local cuando Docker Desktop este disponible.

Incluye:

- Supabase Queues.
- Worker externo TypeScript.
- `processing_jobs`.
- Extraccion de texto por pagina.
- Estados: `queued`, `extracting_text`, `text_extracted`, `failed`.
- Logs de errores.

No incluye:

- OCR.
- IA compleja.

Criterio de salida:

- Un PDF con texto queda procesado y consultable por paginas/chunks.

## Fase 4 - IA para facturas recibidas

Objetivo:

- Extraer datos de facturas recibidas con IA y validacion estructurada.

Estado:

- Iniciada con capa OpenAI, contrato Zod/JSON Schema, validacion fiscal basica y persistencia preparada para tablas IA existentes.
- Pendiente de prueba end-to-end con documentos reales cuando Supabase local/remoto este operativo.

Incluye:

- Capa comun de proveedor IA.
- OpenAI como proveedor principal.
- JSON Schema/Zod.
- Prompt versionado.
- `ai_requests`, `ai_responses`, `ai_cost_events`.
- `document_extractions`.
- Validacion fiscal basica.
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

- Iniciada como nucleo offline: contrato de decision humana, aprobacion/rechazo/cambios, conversion a factura preliminar y evento de auditoria.
- La persistencia real en Supabase y la UI quedan para una fase final de integracion, cuando esten disponibles URL y claves.

Incluye:

- `review_tasks`.
- UI de revision con PDF + propuesta + campos editables.
- Aprobar/rechazar.
- Crear factura/gasto desde extraccion aprobada.
- Audit log de aprobacion.

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
