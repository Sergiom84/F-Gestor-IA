# Tests DB del ledger normativo

Fecha: 2026-06-03  
Estado: Fase 12 iniciada como suite pgTAP preparada, pendiente de ejecutar con Supabase local

## Objetivo

Preparar una prueba de base de datos que demuestre las propiedades criticas de `public.regulatory_events`:

- RLS activo;
- politica de lectura esperada;
- `authenticated` sin permisos directos de escritura;
- aislamiento cross-tenant;
- bloqueo de update/delete;
- bloqueo de append con `previous_hash` de otra factura u organizacion.

## Alcance implementado

- Nuevo test pgTAP:
  - `supabase/tests/database/regulatory_events.test.sql`.
- Nuevo script:
  - `npm run db:test`.

La prueba crea datos aislados dentro de una transaccion y termina con `rollback`.

## Comando

```powershell
npm run db:test
```

Equivale a:

```powershell
npx supabase test db
```

## Requisitos

Supabase local debe estar levantado:

```powershell
npx supabase start
npx supabase db reset --local --no-seed
npm run db:test
```

No se ha ejecutado todavia porque el entorno actual no tiene Postgres local escuchando en `127.0.0.1:54322`.

## Fuentes Supabase revisadas

- Supabase recomienda tests SQL con pgTAP para tablas, columnas, funciones y RLS.
- `supabase test db` ejecuta los tests pgTAP contra la base local y cada test queda envuelto en transaccion.
- Para simular usuarios autenticados en RLS, se usa `set local role authenticated` y claims JWT locales.

## Pendiente para cerrar Fase 12

- Levantar Supabase local.
- Aplicar migraciones.
- Ejecutar `npm run db:test`.
- Ajustar la suite si la estructura real de `auth.users` local exige campos adicionales.
- Ejecutar advisors `security` y `performance`.
