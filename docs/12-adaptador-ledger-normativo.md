# Adaptador del ledger normativo

Fecha: 2026-06-03  
Estado: Fase 11 iniciada como adaptador server-side, pendiente de prueba end-to-end con Supabase local/remoto

## Objetivo

Conectar el ledger normativo offline con la tabla `public.regulatory_events` preparada en Fase 10.

La escritura debe ocurrir solo desde backend, worker o Edge Function segura. No se expone ningun secreto ni escritura directa al navegador.

## Alcance implementado

- Nuevo repositorio:
  - `src/workers/document-worker/regulatory/repository.ts`.
- Funciones principales:
  - `getRegulatoryReadinessInputForInvoice`;
  - `buildRegulatoryReadinessInputFromRows`;
  - `assertRegulatoryPreparationPersistable`;
  - `insertRegulatoryEventRow`;
  - `persistRegulatoryEventForInvoice`.
- CLI:
  - `npm run regulatory:persist-invoice -- <invoice_id> [regulatory_mode]`.
- Reglas del adaptador:
  - carga la factura desde `public.invoices`;
  - carga eventos previos desde `public.regulatory_events`;
  - reconstruye `RegulatoryReadinessInput`;
  - prepara el siguiente evento con hash chain;
  - bloquea persistencia si `ledgerValidation.valid` es falso;
  - bloquea persistencia si `readiness.status` es `blocked`;
  - exige `fiscal_entity_id` antes de insertar;
  - inserta solo `official_submission_ready = false`.

## Seguridad

Supabase documenta que las claves secret/service role y clientes admin deben usarse solo en backend seguro, Edge Functions, workers o procesos controlados, nunca en navegador. Este adaptador usa `DATABASE_URL` desde entorno server-side y no introduce variables `NEXT_PUBLIC_*`.

La tabla mantiene RLS para lectura, pero la escritura prevista se hace con credenciales server-side. El frontend no debe llamar directamente a `insert` sobre `regulatory_events`.

## Comandos

```powershell
npm run regulatory:persist-invoice -- <invoice_id> verifactu_pending
npm run typecheck
npm test
```

## Limites

- No se ha probado contra Supabase local porque no hay Postgres escuchando en `127.0.0.1:54322`.
- No se generan payloads oficiales AEAT/VERI*FACTU/B2B.
- No se implementan firma, sello, certificados ni canal oficial.
- No se crea UI.

## Pendiente para cerrar Fase 11

- Levantar Supabase local y aplicar migraciones.
- Insertar una factura emitida aprobada de prueba.
- Ejecutar `npm run regulatory:persist-invoice`.
- Verificar que se crea `regulatory_events`.
- Verificar que un usuario cross-tenant no puede leer el evento.
- Verificar que clientes autenticados no pueden insertar, actualizar ni borrar eventos.
