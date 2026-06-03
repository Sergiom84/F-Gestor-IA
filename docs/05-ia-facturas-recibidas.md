# IA para facturas recibidas

Fecha: 2026-06-03  
Estado: Fase 4 iniciada

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

## Archivos

- `src/workers/document-worker/ai/invoice-schema.ts`: schema, prompt y validacion fiscal.
- `src/workers/document-worker/ai/openai-provider.ts`: llamada OpenAI Responses API con `json_schema`.
- `src/workers/document-worker/ai/repository.ts`: lectura de chunks y escritura de logs/extracciones.
- `src/workers/document-worker/ai/processor.ts`: orquestacion de Fase 4 para un documento.
- `src/workers/document-worker/extract-document-invoice.ts`: CLI operativo por `document_id`.

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

1. Lee el documento y concatena `document_text_chunks` por orden.
2. Marca el documento como `ai_processing`.
3. Llama a OpenAI con Structured Outputs.
4. Valida la salida con Zod.
5. Ejecuta validaciones fiscales basicas.
6. Inserta request, response y extraccion.
7. Actualiza `documents.current_extraction_id`.
8. Pasa el documento a `needs_review`.
9. Crea una tarea abierta en `review_tasks`.

## Pendiente para cerrar Fase 4

- Validar el comando contra Supabase local/remoto con una factura real.
- Conectar la creacion de `processing_jobs` tipo `ai_extract`.
- Decidir si la Fase 3 debe encadenar IA automaticamente o dejarlo como job separado.
- Anadir tests de schema y validacion fiscal.
- Afinar campos exactos de factura recibida MVP.
- Definir politica de coste por modelo y presupuesto por organizacion.
- Preparar fallback de proveedor, aunque quede inactivo.
