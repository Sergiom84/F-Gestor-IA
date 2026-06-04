# Persistencia del ledger normativo

Fecha: 2026-06-03  
Estado: Fase 10 iniciada como migracion preparada, pendiente de aplicar contra Supabase local/remoto

## Objetivo

Convertir el contrato `regulatory_event_row_v1` de la Fase 9 en una tabla Supabase append-only para eventos normativos internos.

Esta fase sigue sin implementar envio oficial, payload oficial, firma, sello, certificado ni cumplimiento legal cerrado.

## Alcance implementado

- Nueva migracion Supabase:
  - `supabase/migrations/20260603212724_add_regulatory_events.sql`.
- Enum `public.regulatory_event_type` alineado con los eventos del ledger TypeScript.
- Tabla `public.regulatory_events`.
- Restricciones:
  - `organization_id` obligatorio;
  - `fiscal_entity_id` obligatorio para persistir;
  - `invoice_id` obligatorio;
  - consistencia `(invoice_id, organization_id)`;
  - consistencia `(fiscal_entity_id, organization_id)`;
  - hash SHA-256 hexadecimal de 64 caracteres;
  - `previous_hash` valido o nulo;
  - `official_submission_ready = false`;
  - constantes de version/formato.
- Cadena append-only:
  - solo un primer evento por factura;
  - un `previous_hash` no puede tener dos hijos para la misma factura;
  - `previous_hash` debe existir;
  - el evento anterior debe pertenecer a la misma organizacion y factura;
  - `occurred_at` no puede retroceder;
  - updates y deletes bloqueados por trigger.
- RLS:
  - activado en `public.regulatory_events`;
  - `authenticated` solo puede leer si tiene acceso a la factura;
  - no hay politicas de insert/update/delete para usuarios autenticados;
  - escritura prevista solo con `service_role` desde backend/worker seguro.
- Contrato TS:
  - `regulatoryEventRowSchema` exige `fiscal_entity_id` para persistencia.

## Motivo de diseno

`audit_logs` conserva historial operativo general, pero el ledger normativo necesita reglas propias de encadenado, versiones, no mutacion y consulta por factura/entidad fiscal. Por eso se separa en tabla especifica.

## Verificacion actual

Verificado localmente sin aplicar la migracion:

```powershell
npm run typecheck
npm test
```

No se ha ejecutado `npx supabase db reset` porque requiere Docker Desktop o runtime compatible.

## Fuentes Supabase revisadas

- Supabase RLS: RLS debe estar activado en tablas del schema expuesto `public`.
- Supabase CLI/migraciones: los cambios de schema se versionan en `supabase/migrations` y se aplican localmente con `supabase db reset` o `supabase migration up`.

## Pendiente para cerrar Fase 10

- Aplicar migraciones contra Supabase local.
- Ejecutar advisors de seguridad y rendimiento.
- Crear test SQL de acceso cruzado entre dos organizaciones.
- Crear adaptador server-side que inserte `regulatory_events` desde `buildRegulatoryEventRow`.
- Validar que el backend usa `service_role` solo en entorno seguro.
