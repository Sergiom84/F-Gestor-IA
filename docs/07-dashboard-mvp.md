# Dashboard MVP

Fecha: 2026-06-03  
Estado: Fase 6 iniciada sin dependencia de Supabase remoto

## Objetivo

Dar visibilidad basica del estado documental, fiscal y de coste IA de una organizacion.

El primer paso es un motor de snapshot local. La UI y las consultas directas a Supabase quedan para el final de integracion, cuando existan URL, claves y entorno operativo.

## Alcance implementado

- Contrato Zod de entrada para:
  - `documents`;
  - `review_tasks`;
  - `invoices`;
  - `ai_cost_events`.
- Agregacion de documentos:
  - total;
  - pendientes;
  - fallidos;
  - pendientes de revision;
  - aprobados;
  - rechazados;
  - OCR requerido;
  - desglose por estado.
- Agregacion de revision:
  - abiertas;
  - en revision;
  - cambios pedidos;
  - alta prioridad;
  - desglose por estado.
- Agregacion fiscal:
  - facturas aprobadas;
  - recibidas;
  - emitidas;
  - gastos;
  - ingresos;
  - IVA soportado;
  - IVA repercutido;
  - posicion neta de IVA.
- Agregacion de IA:
  - coste estimado;
  - tokens de entrada/salida;
  - coste por proveedor.
- Series mensuales simples.
- Alertas basicas.
- CLI local sin Supabase.

## Archivos

- `src/workers/document-worker/dashboard/dashboard-schema.ts`: contratos de entrada y salida.
- `src/workers/document-worker/dashboard/dashboard.ts`: motor de snapshot.
- `src/workers/document-worker/dashboard-local.ts`: CLI local.

## Comando local

```powershell
npm run dashboard:local -- C:\ruta\dashboard-data.json 2026-01-01 2026-12-31
```

Los parametros de fecha son opcionales:

```powershell
npm run dashboard:local -- C:\ruta\dashboard-data.json
```

## Formato de entrada

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "generated_at": "2026-06-03T21:00:00.000Z",
  "documents": [
    {
      "id": "doc-1",
      "organization_id": "00000000-0000-0000-0000-000000000001",
      "fiscal_entity_id": "entity-1",
      "document_type": "invoice_received",
      "status": "needs_review",
      "failure_reason": null,
      "created_at": "2026-06-01T10:00:00.000Z"
    }
  ],
  "review_tasks": [
    {
      "id": "task-1",
      "organization_id": "00000000-0000-0000-0000-000000000001",
      "document_id": "doc-1",
      "status": "open",
      "assigned_to": null,
      "priority": 10,
      "created_at": "2026-06-01T10:05:00.000Z"
    }
  ],
  "invoices": [
    {
      "id": "invoice-1",
      "organization_id": "00000000-0000-0000-0000-000000000001",
      "fiscal_entity_id": "entity-1",
      "direction": "received",
      "invoice_number": "F-1",
      "issue_date": "2026-06-01",
      "currency": "EUR",
      "subtotal_amount": 100,
      "tax_amount": 21,
      "total_amount": 121,
      "status": "draft",
      "human_approved_at": "2026-06-02T09:00:00.000Z"
    }
  ],
  "ai_cost_events": [
    {
      "id": "cost-1",
      "organization_id": "00000000-0000-0000-0000-000000000001",
      "provider_key": "openai",
      "model_key": "gpt-5.4-mini",
      "estimated_cost_cents": 2.4,
      "input_token_count": 1200,
      "output_token_count": 350,
      "created_at": "2026-06-01T10:10:00.000Z"
    }
  ]
}
```

## Salida

El snapshot devuelve:

- `documents`;
- `review`;
- `invoices`;
- `aiCost`;
- `periods`;
- `alerts`.

## Por que Supabase queda para el final

La metrica ya puede probarse con datos exportados o mocks. Cuando el entorno este listo, solo faltara crear un adaptador que consulte las mismas tablas y entregue el mismo formato de entrada al motor:

1. `documents`;
2. `review_tasks`;
3. `invoices`;
4. `ai_cost_events`.

## Pendiente para cerrar Fase 6

- Crear adaptador de lectura Supabase/Postgres.
- Crear UI de dashboard en Next.js cuando exista app.
- Definir filtros por organizacion, entidad fiscal, periodo y cliente.
- Validar metricas con datos reales.
- Decidir si se materializan `tax_summaries` o se calculan bajo demanda.
