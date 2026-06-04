# Validacion local Supabase

Fecha: 2026-06-03  
Estado: runner preparado, pendiente de Supabase local operativo

## Objetivo

La Fase 13 convierte el bloqueo actual de Docker/Supabase local en un paso repetible: un solo comando comprueba que Postgres local responde y, si responde, ejecuta la validacion minima de migraciones, lint y pgTAP.

No aplica cambios destructivos automaticamente. `db reset` queda como paso explicito antes de validar, porque re-crea la base local.

## Comando

```powershell
npm run supabase:validate-local
```

El runner usa `DATABASE_URL` si existe y, si no, asume el valor local de Supabase:

```text
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Por defecto ejecuta la CLI via `npx supabase`. En CI se puede fijar una CLI ya instalada con:

```text
SUPABASE_CLI_COMMAND=supabase
```

## Plan ejecutado

Si Postgres local responde, se ejecuta:

```powershell
npx supabase migration list --local
npx supabase db lint --local --schema public,auth,storage --level warning --fail-on error
npx supabase test db --local
```

La fase usa `--fail-on error` para que los warnings del linter queden visibles sin bloquear por defecto. Los errores de schema si bloquean.

## Cuando Docker este disponible

Secuencia esperada:

```powershell
npx supabase start
npx supabase db reset --local --no-seed
npm run supabase:validate-local
```

`db reset` debe ejecutarse de forma consciente porque reconstruye la base local desde las migraciones.

## Criterio de salida

La fase queda cerrada cuando:

- Postgres local esta accesible en el puerto configurado.
- Las migraciones se listan correctamente.
- `db lint` no devuelve errores.
- `supabase test db --local` pasa la suite pgTAP, incluida la prueba de `regulatory_events`.

## Alcance de seguridad

- El runner no usa `service_role`.
- El runner no toca el navegador ni variables publicas.
- El runner no hace `db reset`, `db push` ni cambios remotos.
- El runner valida RLS y append-only a traves de la suite pgTAP preparada en Fase 12.
