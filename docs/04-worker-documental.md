# Worker documental basico

Fecha: 2026-06-03  
Estado: implementado como esqueleto TypeScript, pendiente de prueba con Supabase local/remoto

## Objetivo

Procesar PDFs con texto embebido sin bloquear la interfaz.

El worker:

- Lee mensajes desde la cola `document_processing`.
- Marca el job como `running`.
- Descarga el PDF desde Supabase Storage privado con credenciales server-side.
- Extrae texto por pagina con `pdfjs-dist`.
- Guarda `document_pages`.
- Genera `document_text_chunks`.
- Actualiza `documents.status` a `text_extracted` u `ocr_required`.
- Marca `processing_jobs.status` como `succeeded`, `retrying` o `failed`.
- Reencola con backoff si el job aun tiene intentos disponibles.

## Fuentes oficiales revisadas

- Supabase Queues Quickstart: https://supabase.com/docs/guides/queues/quickstart
- Supabase Queues API: https://supabase.com/docs/guides/queues/api
- Supabase PGMQ Extension: https://supabase.com/docs/guides/queues/pgmq/
- Supabase Storage private downloads/signed URLs: https://supabase.com/docs/guides/storage/serving/downloads

Decisiones tomadas:

- El worker usa Postgres directo para `pgmq`; no expone la cola al navegador.
- El worker usa service role solo en entorno servidor para descargar de Storage.
- La app futura debe crear `processing_jobs` y enviar mensajes a `pgmq`.

## Archivos

- `src/workers/document-worker/index.ts`: bucle principal.
- `src/workers/document-worker/config.ts`: configuracion por entorno.
- `src/workers/document-worker/queue.ts`: lectura, archivado y reencolado en `pgmq`.
- `src/workers/document-worker/storage.ts`: descarga desde Storage privado.
- `src/workers/document-worker/pdf.ts`: extraccion de texto embebido y chunks.
- `src/workers/document-worker/repository.ts`: escrituras de estado/texto en Postgres.
- `src/workers/document-worker/processor.ts`: orquestacion por mensaje.
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

## Bloqueo actual

No se puede probar contra Supabase local hasta que Docker Desktop este disponible y la migracion inicial se aplique con:

```powershell
npx supabase db reset --local --no-seed
```

## Pendiente para cerrar Fase 3

- Validar migracion Supabase con Docker.
- Insertar un documento y archivo real en Storage privado.
- Crear `processing_job`.
- Enviar mensaje a `pgmq`.
- Ejecutar worker contra DB local.
- Confirmar que se crean paginas/chunks y que RLS no permite acceso cruzado desde clientes.
- Anadir test automatizado de flujo documental cuando haya entorno local operativo.
