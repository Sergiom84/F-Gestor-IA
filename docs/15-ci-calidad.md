# CI y calidad minima

Fecha: 2026-06-04  
Estado: workflows preparados

## Objetivo

La Fase 14 deja una primera puerta de calidad automatizable sin depender de credenciales remotas.

Se separan dos niveles:

- CI rapido: TypeScript y tests unitarios.
- CI Supabase local: migraciones, lint y pgTAP sobre Postgres local de Supabase.
- Smoke MVP remoto: ejecucion manual contra Supabase cloud con fixture efimero y cleanup.

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

### `.github/workflows/smoke-mvp-remote.yml`

Se ejecuta manualmente con `workflow_dispatch`.

Inputs:

- `run_ai`: `true` por defecto. Ejecuta `ai_extract` y aprobacion DB; requiere `OPENAI_API_KEY`.
- `cleanup`: `true` por defecto. Borra fixture de base de datos y Storage al terminar.

Secretos requeridos:

- `SUPABASE_URL`.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `DATABASE_URL`.
- `OPENAI_API_KEY` solo cuando `run_ai=true`.

Variables opcionales:

- `OPENAI_MODEL`, por defecto `gpt-5.4-mini`.
- `OPENAI_BASE_URL`, por defecto `https://api.openai.com`.
- `OPENAI_TIMEOUT_MS`, por defecto `60000`.

Hace:

- `actions/checkout@v6`.
- `actions/setup-node@v6` con Node 22 y cache npm.
- `npm ci`.
- Preflight de secretos sin imprimir valores.
- `npm run smoke:mvp-remote -- --cleanup` por defecto.
- Anade `--skip-ai` si `run_ai=false`.

Queda manual porque toca Supabase remoto y usa `service_role` en un proceso controlado de CI.

## Seguridad

- `ci.yml` no usa secretos.
- `supabase-local.yml` no conecta a Supabase remoto, no usa `service_role`, no ejecuta `db push` y corre contra Postgres local efimero.
- `smoke-mvp-remote.yml` usa secretos solo en GitHub Actions, no imprime valores y ejecuta cleanup por defecto.

## Criterio de salida

- `npm run ci:static` pasa localmente.
- El workflow rapido queda preparado para PR/push.
- El workflow Supabase local queda preparado para ejecucion manual.
- El workflow smoke remoto queda preparado para ejecucion manual con cleanup.
- La promocion del job Supabase a PR queda pendiente hasta validar Docker/pgTAP al menos una vez.
