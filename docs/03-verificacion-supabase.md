# Verificacion Supabase

Fecha: 2026-06-03  
Estado: pendiente de ejecucion local con Docker Desktop

## Objetivo

Validar que la migracion inicial crea correctamente:

- Extensiones necesarias.
- Tablas y claves foraneas.
- Enums.
- Funciones privadas de autorizacion.
- RLS en tablas de `public`.
- Politicas de Storage en `storage.objects`.
- Bucket privado `document-files`.
- Cola `document_processing`.

## Requisitos locales

- Node.js.
- npm.
- Docker Desktop en ejecucion.
- Supabase CLI via `npx supabase`.

## Comandos

```powershell
npx supabase --version
npx supabase db reset --local --no-seed
```

Si se quiere ejecutar tambien el seed vacio:

```powershell
npx supabase db reset --local
```

## Verificaciones manuales esperadas

Cuando Docker este disponible, comprobar:

- La migracion `20260603184208_initial_schema.sql` se aplica sin errores.
- Todas las tablas de `public` tienen RLS activo.
- Un usuario autenticado sin membresia no ve datos de ninguna organizacion.
- Un miembro activo solo ve filas de su `organization_id`.
- Un usuario de otra organizacion no puede leer documentos, facturas, logs ni objetos de Storage.
- El bucket `document-files` no es publico.
- Las URLs de documentos deben emitirse desde backend seguro como URLs firmadas.

## Bloqueo actual

El comando `npx supabase db reset --local --no-seed` no puede ejecutarse porque Docker Desktop no esta disponible en el entorno actual.

Tambien falla `npx supabase migration list --local` porque no hay Postgres local escuchando en `127.0.0.1:54322`. Esto es esperado hasta arrancar Supabase local con Docker.
