# Preparacion normativa

Fecha: 2026-06-03  
Estado: Fase 8 iniciada como preparacion interna, sin certificacion ni envio oficial

## Objetivo

Preparar GFiscal para trazabilidad normativa futura sin afirmar cumplimiento completo.

Esta fase crea un ledger interno encadenado por hash y un readiness check para facturas emitidas, VERI*FACTU y factura electronica B2B.

## Fuentes oficiales revisadas

- BOE: Real Decreto 1007/2023, Reglamento de requisitos de sistemas informaticos de facturacion.
- Agencia Tributaria: cuestiones generales de Sistemas Informaticos de Facturacion y VERI*FACTU.
- BOE: Ley 56/2007, articulo 2 bis, factura electronica en el sector privado.
- BOE: Real Decreto 238/2026, desarrollo del sistema de facturacion electronica obligatoria entre empresarios y profesionales.

Ideas de diseno extraidas:

- Los sistemas deben preservar integridad, conservacion, accesibilidad, legibilidad, trazabilidad e inalterabilidad.
- Los registros de facturacion deben ser distinguibles de la factura completa.
- VERI*FACTU y la leyenda asociada solo deben activarse cuando realmente se remiten registros.
- En factura electronica B2B hay que preparar transmision/recepcion y estados de factura.
- La preparacion interna no equivale a formato oficial ni envio oficial.

## Alcance implementado

- Contratos Zod para:
  - modo normativo;
  - factura;
  - actor;
  - evento normativo;
  - entrada de readiness.
- Modos:
  - `internal_only`;
  - `verifactu_pending`;
  - `verifactu_reporting`;
  - `b2b_einvoice_pending`;
  - `b2b_einvoice_active`.
- Ledger interno:
  - eventos encadenados por `previous_hash`;
  - `hash` SHA-256 sobre JSON canonico;
  - validacion de cadena.
- Readiness check:
  - campos obligatorios;
  - factura emitida vs recibida;
  - QR placeholder;
  - leyenda VERI*FACTU permitida solo en modo reporting;
  - estado B2B preparado.
- Export interno `gfiscal_regulatory_json_v1`.
- CLI local.

## Archivos

- `src/workers/document-worker/regulatory/regulatory-schema.ts`: contratos normativos.
- `src/workers/document-worker/regulatory/regulatory-ledger.ts`: readiness, canonical JSON, hash chain y export interno.
- `src/workers/document-worker/regulatory-local.ts`: CLI local.

## Comando local

```powershell
npm run regulatory:local -- C:\ruta\regulatory-input.json
```

## Formato de entrada

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "fiscal_entity_id": "00000000-0000-0000-0000-000000000002",
  "regulatory_mode": "verifactu_pending",
  "invoice": {
    "id": "invoice-1",
    "organization_id": "00000000-0000-0000-0000-000000000001",
    "fiscal_entity_id": "00000000-0000-0000-0000-000000000002",
    "direction": "issued",
    "invoice_number": "2026-0001",
    "issue_date": "2026-06-03",
    "currency": "EUR",
    "supplier_tax_id": "B12345678",
    "customer_tax_id": "B87654321",
    "subtotal_amount": 100,
    "tax_amount": 21,
    "total_amount": 121,
    "status": "draft",
    "human_approved_at": "2026-06-03T21:15:00.000Z"
  },
  "actor": {
    "user_id": null,
    "role": "system",
    "system_id": "gfiscal"
  },
  "prior_events": [],
  "generated_at": "2026-06-03T21:15:00.000Z"
}
```

## Salida

La salida contiene:

- `readiness`;
- `nextEvent`;
- `ledgerValidation`;
- `exportRecord`.

`exportRecord.officialSubmissionReady` siempre es `false` en esta fase.

## Limites explicitos

No se implementa todavia:

- payload oficial AEAT;
- remision VERI*FACTU;
- codigo QR definitivo;
- factura electronica oficial Facturae/UBL/CII/Peppol;
- firma o sello cualificado;
- declaracion responsable;
- certificacion de cumplimiento.

## Pendiente para cerrar Fase 8

- Validacion fiscal/legal de campos exactos.
- Decidir modelo final de eventos persistidos.
- Crear tabla especifica si `audit_logs` no basta.
- Implementar export oficial cuando haya especificacion final elegida.
- Integrar certificados, firma/sello y canal de envio si procede.
- Ampliar a tests de integracion cuando exista tabla persistida.
