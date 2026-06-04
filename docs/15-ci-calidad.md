# CI y calidad minima

Fecha: 2026-06-04  
Estado: workflows preparados

## Objetivo

La Fase 14 deja una primera puerta de calidad automatizable sin depender de credenciales remotas.

Se separan dos niveles:

- CI rapido: TypeScript y tests unitarios.
- CI Supabase local: migraciones, lint y pgTAP sobre Postgres local de Supabase.

## Scripts npm

```powershell
npm run ci:static
npm run ci:supabase-local
npm run ci:full
```

`ci:static` ejecuta `typecheck` y tests unitarios.  
`ci:supabase-local` delega en `supabase:validate-local`.  
`ci:full` encadena ambos niveles.

## Workflows

### `.github/workflows/ci.yml`

Se ejecuta en:

- `push` a `main`.
- `pull_request`.
- `workflow_dispatch`.

Hace:

- `actions/checkout@v6`.
- `actions/setup-node@v6` con Node 22 y cache npm.
- `npm ci`.
- `npm run ci:static`.

### `.github/workflows/supabase-local.yml`

Se ejecuta manualmente con `workflow_dispatch`.

Hace:

- `actions/checkout@v6`.
- `actions/setup-node@v6` con Node 22 y cache npm.
- `supabase/setup-cli@v2` fijado a Supabase CLI `2.104.0`.
- `SUPABASE_CLI_COMMAND=supabase` para usar la CLI instalada por la action.
- `supabase db start`.
- `npm run ci:supabase-local`.
- `supabase stop --no-backup` al terminar.

Por ahora queda manual porque la suite pgTAP aun no se ha podido verificar contra Docker local. Cuando pase una vez, puede promocionarse a `pull_request` para cambios en `supabase/**` y codigo regulatorio.

## Seguridad

- No usa secretos.
- No conecta a Supabase remoto.
- No usa `service_role`.
- No ejecuta `db push`.
- La validacion DB corre contra Postgres local efimero.

## Criterio de salida

- `npm run ci:static` pasa localmente.
- El workflow rapido queda preparado para PR/push.
- El workflow Supabase local queda preparado para ejecucion manual.
- La promocion del job Supabase a PR queda pendiente hasta validar Docker/pgTAP al menos una vez.
