# Integridad del ledger normativo

Fecha: 2026-06-03  
Estado: Fase 9 iniciada como verificacion local, sin migracion nueva ni envio oficial

## Objetivo

Endurecer la preparacion normativa creada en Fase 8 con pruebas de integridad y una forma estable para persistir eventos en el futuro.

La fase sigue siendo interna: no certifica cumplimiento, no genera payload oficial AEAT/VERI*FACTU/Facturae/UBL/CII/Peppol y no envia registros.

## Alcance implementado

- Validacion del ledger completo, incluyendo el siguiente evento que se va a anexar.
- Validacion de append:
  - cadena de hashes;
  - `previous_hash`;
  - misma `organization_id`;
  - misma `invoice_id`;
  - orden temporal no regresivo.
- Contrato `regulatory_event_row_v1` para mapear un evento a una futura fila persistible.
- Pruebas locales con Node test:
  - primer evento verificable;
  - segundo evento enlazado al hash anterior;
  - alteracion de payload detectada por hash;
  - append cruzado entre organizacion/factura rechazado;
  - evento fuera de orden temporal rechazado.

## Comandos

```powershell
npm run test:regulatory
npm test
```

## Forma futura de persistencia

La fila futura queda preparada con campos explicitos:

- `organization_id`;
- `fiscal_entity_id`;
- `invoice_id`;
- `event_type`;
- `occurred_at`;
- actor desnormalizado: `actor_user_id`, `actor_role`, `actor_system_id`;
- `payload`;
- `previous_hash`;
- `hash`;
- `ledger_version`;
- `row_version`;
- `export_format`;
- `official_submission_ready`;
- `created_at`.

Cuando Supabase local/remoto este operativo, esta forma puede convertirse en tabla append-only, probablemente separada de `audit_logs`, con RLS anclado a `organization_id` y escritura solo desde backend/worker seguro.

## Limites explicitos

- No se crea todavia migracion SQL de `regulatory_events`.
- No se valida contra Postgres/Supabase local porque Docker Desktop sigue siendo requisito pendiente.
- No se implementa firma, sello, certificado, canal oficial ni formato oficial.
- No se sustituye la validacion fiscal/legal.

## Criterio de salida

GFiscal puede demostrar localmente que el ledger normativo detecta manipulacion de payload, ruptura de cadena y eventos anexados en orden temporal incorrecto.
