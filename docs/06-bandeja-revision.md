# Bandeja de revision

Fecha: 2026-06-03  
Estado: Fase 5 conectada a Supabase remoto

## Objetivo

Convertir una extraccion IA en una decision humana auditable.

La regla central se mantiene: ningun dato fiscal entra como factura o gasto sin aprobacion humana.

## Alcance implementado

- Contrato Zod para comandos de revision humana.
- Acciones:
  - `approve`;
  - `reject`;
  - `changes_requested`.
- Aplicacion de correcciones humanas sobre la extraccion IA.
- Validacion minima antes de aprobar:
  - revisor presente;
  - entidad fiscal presente;
  - cliente presente;
  - numero de factura presente;
  - fecha de emision presente;
  - moneda presente;
  - total presente;
  - coherencia base + IVA = total con tolerancia de 0,02.
- Conversion local a `invoiceDraft` para factura recibida.
- Generacion de `auditEvent` con before/after.
- CLI local que no requiere Supabase.
- Adaptador transaccional Supabase/Postgres.
- UI de revision conectada al motor comun de revision y persistencia.
- URL firmada del PDF original generada server-side desde Storage privado.
- CLI DB para aprobar/rechazar una `review_task` real.
- Persistencia de factura aprobada en `invoices`, `invoice_lines` y `tax_breakdowns`.
- Actualizacion de `review_tasks`, `documents` y `document_extractions`.
- Insercion de `audit_logs` en la misma transaccion.

## Archivos

- `src/workers/document-worker/review/review-schema.ts`: contrato de revision.
- `src/workers/document-worker/review/invoice-review.ts`: motor de aprobacion/rechazo/cambios.
- `src/workers/document-worker/review/repository.ts`: adaptador transaccional Supabase/Postgres.
- `src/workers/document-worker/review-invoice-local.ts`: CLI local para probar el flujo.
- `src/workers/document-worker/review-invoice-db.ts`: CLI contra Supabase/Postgres por `review_task_id`.

## Comando local

```powershell
npm run review:invoice-local -- C:\ruta\extraccion.json C:\ruta\revision.json
```

`extraccion.json` puede ser:

- el `normalized_data` de `document_extractions`;
- o una fila/objeto que contenga `normalized_data`.

`revision.json` usa este formato:

```json
{
  "action": "approve",
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "document_id": "00000000-0000-0000-0000-000000000002",
  "extraction_id": "00000000-0000-0000-0000-000000000003",
  "review_task_id": "00000000-0000-0000-0000-000000000004",
  "fiscal_entity_id": "00000000-0000-0000-0000-000000000005",
  "client_id": "00000000-0000-0000-0000-000000000006",
  "reviewed_by": "00000000-0000-0000-0000-000000000007",
  "review_notes": "Revisado contra PDF original.",
  "corrections": {
    "supplier_tax_id": null,
    "customer_tax_id": null,
    "invoice_number": null,
    "issue_date": null,
    "due_date": null,
    "currency": null,
    "subtotal_amount": null,
    "tax_amount": null,
    "total_amount": null
  },
  "line_items": [],
  "tax_breakdowns": []
}
```

Para rechazar:

```json
{
  "action": "reject",
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "document_id": "00000000-0000-0000-0000-000000000002",
  "extraction_id": null,
  "review_task_id": null,
  "fiscal_entity_id": null,
  "client_id": null,
  "reviewed_by": null,
  "review_notes": "No es una factura.",
  "corrections": {
    "supplier_tax_id": null,
    "customer_tax_id": null,
    "invoice_number": null,
    "issue_date": null,
    "due_date": null,
    "currency": null,
    "subtotal_amount": null,
    "tax_amount": null,
    "total_amount": null
  },
  "line_items": [],
  "tax_breakdowns": []
}
```

## Salida

El comando devuelve:

- estados de documento y tarea;
- validacion;
- `invoiceDraft` si se aprueba;
- `auditEvent` listo para persistir.

## Comando DB

```powershell
npm run review:invoice-db -- <review_task_id> C:\ruta\revision.json
```

El comando DB:

1. lee `review_tasks` + `document_extractions`;
2. fuerza `organization_id`, `document_id`, `extraction_id` y `review_task_id` desde la base;
3. aplica `applyInvoiceReview`;
4. actualiza `review_tasks`;
5. actualiza `documents`;
6. actualiza `document_extractions`;
7. inserta `invoices`, `invoice_lines` y `tax_breakdowns` si hay aprobacion valida;
8. inserta `audit_logs`;
9. ejecuta todo en una transaccion.

## Pendiente para cerrar Fase 5

- Probar aprobacion, rechazo y cambios con datos reales en Supabase remoto.
- Decidir si la factura aprobada nace como `draft` o `booked`.
- Ampliar tests de integracion del motor de revision con la Server Action de UI.
