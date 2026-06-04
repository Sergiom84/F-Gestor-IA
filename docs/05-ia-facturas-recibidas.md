# IA para facturas recibidas

Fecha: 2026-06-03  
Estado: Fase 4 conectada al worker MVP

## Objetivo

Extraer una propuesta estructurada de factura recibida a partir del texto ya generado por el worker documental.

La salida de IA no crea facturas ni gastos directamente. Siempre queda como `document_extractions` y abre una `review_task` para revision humana.

## Alcance implementado

- Contrato Zod para facturas recibidas.
- JSON Schema estricto para Structured Outputs.
- Prompt versionado `invoice_received_v1`.
- Proveedor OpenAI via Responses API.
- Validacion fiscal basica:
  - documento parece factura recibida;
  - fecha presente;
  - total presente;
  - total coherente con base + IVA - retenciones;
  - aviso por moneda no EUR;
  - aviso por tipos de IVA no esperados en Espana;
  - aviso por baja confianza.
- Persistencia en:
  - `ai_requests`;
  - `ai_responses`;
  - `document_extractions`;
  - `review_tasks`;
  - `ai_cost_events` solo si se configuran precios por token.
- Ejecucion desde CLI o desde `processing_jobs.job_type = 'ai_extract'`.
- Control de presupuesto mensual por organizacion cuando `ai_monthly_budget_cents > 0`.
- Deteccion de duplicados fiscales contra `invoices` por proveedor, numero, fecha e importe.

## Archivos

- `src/workers/document-worker/ai/invoice-schema.ts`: schema, prompt y validacion fiscal.
- `src/workers/document-worker/ai/openai-provider.ts`: llamada OpenAI Responses API con `json_schema`.
- `src/workers/document-worker/ai/repository.ts`: lectura de chunks y escritura de logs/extracciones.
- `src/workers/document-worker/ai/processor.ts`: orquestacion de Fase 4 para un documento.
- `src/workers/document-worker/extract-document-invoice.ts`: CLI operativo por `document_id`.
- `src/workers/document-worker/processor.ts`: encadena `ai_extract` desde la cola documental.

## Variables de entorno

Ver `.env.example`.

Minimas:

```text
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
```

Opcionales:

```text
OPENAI_BASE_URL=https://api.openai.com
OPENAI_TIMEOUT_MS=60000
OPENAI_INPUT_COST_PER_MILLION_TOKENS_CENTS=
OPENAI_OUTPUT_COST_PER_MILLION_TOKENS_CENTS=
```

Los precios no se codifican en el repo para evitar que queden obsoletos. Si se configuran, el worker calcula e inserta `ai_cost_events`.

## Comando

```powershell
npm run worker:extract-invoice -- <document_id>
```

Requisitos:

- Supabase/Postgres accesible con `DATABASE_URL`.
- El documento existe en `documents`.
- El documento ya tiene texto en `document_text_chunks`.
- `OPENAI_API_KEY` esta configurada.

## Flujo

1. El worker recibe un mensaje de cola con `job_id`.
2. Lee `processing_jobs.job_type`.
3. Para `ai_extract`, concatena `document_text_chunks` por orden.
4. Marca el documento como `ai_processing`.
5. Comprueba presupuesto mensual si esta configurado.
6. Llama a OpenAI con Structured Outputs.
7. Valida la salida con Zod.
8. Ejecuta validaciones fiscales basicas.
9. Busca duplicados fiscales contra facturas existentes.
10. Inserta request, response y extraccion.
11. Actualiza `documents.current_extraction_id`.
12. Pasa el documento a `needs_review`.
13. Crea una tarea abierta en `review_tasks`.

## Pendiente para cerrar Fase 4

- Validar el flujo completo contra Supabase remoto con una factura real.
- Anadir tests de schema y validacion fiscal.
- Afinar campos exactos de factura recibida MVP.
- Definir precios por modelo en entorno para que `ai_cost_events` tenga coste real.
- Preparar fallback de proveedor, aunque quede inactivo.
