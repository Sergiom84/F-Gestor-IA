# Worker documental basico

Fecha: 2026-06-03  
Estado: conectado a Supabase remoto como flujo MVP documental

## Objetivo

Procesar PDFs con texto embebido sin bloquear la interfaz.

El worker:

- Lee mensajes desde la cola `document_processing`.
- Lee `processing_jobs.job_type` y despacha por tipo.
- Procesa `extract_text` para todos los PDFs disponibles del documento.
- Marca el job como `running`.
- Descarga el PDF desde Supabase Storage privado con credenciales server-side.
- Extrae texto por pagina con `pdfjs-dist`.
- Guarda `document_pages`.
- Genera `document_text_chunks`.
- Actualiza `documents.status` a `text_extracted`, `ocr_required` o `needs_review`.
- Detecta duplicado exacto por `sha256_hash` y abre `review_task` sin gastar IA.
- Si hay texto y no hay duplicado exacto, crea `processing_job` tipo `ai_extract` y lo encola en `pgmq`.
- Marca `processing_jobs.status` como `succeeded`, `retrying` o `failed`.
- Reencola con backoff exponencial si el job aun tiene intentos disponibles.
- Reclama jobs solo desde `queued/retrying` para evitar carreras entre workers.
- Emite logs JSON estructurados con `job_id`, `document_id` y `organization_id`.

## Fuentes oficiales revisadas

- Supabase Queues Quickstart: https://supabase.com/docs/guides/queues/quickstart
- Supabase Queues API: https://supabase.com/docs/guides/queues/api
- Supabase PGMQ Extension: https://supabase.com/docs/guides/queues/pgmq/
- Supabase Storage private downloads/signed URLs: https://supabase.com/docs/guides/storage/serving/downloads

Decisiones tomadas:

- El worker usa Postgres directo para `pgmq`; no expone la cola al navegador.
- El worker usa service role solo en entorno servidor para descargar de Storage.
- La app crea el primer `processing_job` tipo `extract_text` y envia su mensaje a `pgmq` desde una server action.
- Los jobs posteriores del MVP documental los encadena el worker.

## Archivos

- `src/workers/document-worker/index.ts`: bucle principal.
- `src/workers/document-worker/config.ts`: configuracion por entorno.
- `src/workers/document-worker/queue.ts`: lectura, archivado y reencolado en `pgmq`.
- `src/workers/document-worker/storage.ts`: descarga desde Storage privado.
- `src/workers/document-worker/pdf.ts`: extraccion de texto embebido y chunks.
- `src/workers/document-worker/repository.ts`: escrituras de estado/texto en Postgres.
- `src/workers/document-worker/processor.ts`: despachador por `job_type`, backoff exponencial y procesamiento multiarchivo.
- `src/workers/document-worker/logger.ts`: logs JSON estructurados.
- `src/workers/document-worker/extract-local-pdf.ts`: prueba local sin Supabase.

## Variables de entorno

Ver `.env.example`.

Minimas:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DOCUMENT_WORKER_QUEUE_NAME=document_processing
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` nunca debe llegar al navegador.
- `DATABASE_URL` debe ser una conexion Postgres segura para el worker.
- En local, `DATABASE_URL` apunta a `127.0.0.1:54322` cuando Supabase local esta levantado.

## Payload de cola

Formato esperado:

```json
{
  "job_id": "uuid",
  "document_id": "uuid",
  "organization_id": "uuid",
  "requested_by": "uuid opcional",
  "reason": "manual_upload"
}
```

El worker valida este payload con Zod antes de procesar.

El tipo real de trabajo no viaja en el payload: se lee desde `processing_jobs.job_type` usando `job_id`.

## Estados que modifica

`processing_jobs`:

- `queued` -> `running`
- `running` -> `succeeded`
- `running` -> `retrying`
- `running` -> `failed`

`documents`:

- `queued` -> `extracting_text`
- `extracting_text` -> `text_extracted`
- `extracting_text` -> `ocr_required`
- `extracting_text` -> `needs_review` si hay duplicado exacto por hash
- `text_extracted` -> `ai_processing` -> `needs_review`
- `extracting_text` -> `failed`

`document_files`:

- Actualiza `page_count`.
- Completa `sha256_hash` si estaba vacio.
- Marca `file_status = available`.

## Comandos

Instalar dependencias:

```powershell
npm install
```

Typecheck:

```powershell
npm run typecheck
```

Probar extraccion con un PDF local:

```powershell
npm run worker:extract-local -- C:\ruta\factura.pdf
```

Arrancar worker:

```powershell
npm run worker:documents
```

## Estado Supabase

Las migraciones estan aplicadas en Supabase remoto. Supabase local sigue pendiente hasta que Docker Desktop este disponible y la migracion inicial pueda aplicarse con:

```powershell
npx supabase db reset --local --no-seed
```

## Pendiente para cerrar Fase 3

- Validar migracion Supabase con Docker.
- Repetir el flujo local completo con documento y Storage cuando Docker este disponible.
- Ejecutar worker contra DB local.
- Confirmar que se crean paginas/chunks y que RLS no permite acceso cruzado desde clientes.
- Anadir test automatizado de flujo documental cuando haya entorno local operativo.
