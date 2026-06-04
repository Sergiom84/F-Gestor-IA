# GFiscal

GFiscal es un SaaS fiscal/contable para Espana orientado a autonomos, pymes y gestorias.

Repositorio remoto principal: https://github.com/Sergiom84/F-Gestor-IA

El producto se disenara alrededor de cuatro principios:

- Multi-tenant desde el primer dia, con `organization_id` como frontera principal.
- Supabase como nucleo de Auth, PostgreSQL, Storage privado, RLS y colas.
- Procesamiento documental asincrono para PDFs, OCR futuro e IA.
- Revision humana obligatoria antes de convertir extracciones de IA en registros fiscales.

## Estado actual

La base tecnica inicial esta documentada y parcialmente implementada:

- Modelo de datos Supabase documentado.
- Migraciones Supabase aplicadas al remoto `F_Gestor-IA`, con RLS, Storage privado, cola `document_processing` y ledger normativo.
- Worker documental TypeScript creado para extraer texto embebido de PDFs, procesar multiples archivos por documento y encadenar `ai_extract`.
- Fase 4 conectada al worker con contrato Zod/JSON Schema, extractor IA de facturas recibidas, control de presupuesto y deteccion de duplicados.
- Fase 5 conectada a Supabase con adaptador transaccional de revision humana y aprobacion/rechazo.
- Fase 6 iniciada con motor local de dashboard MVP para snapshot documental/fiscal desde JSON.
- Fase 7 iniciada con planificador local de OCR para PDFs dificiles, coste por pagina y reintentos.
- Fase 8 iniciada con ledger normativo offline, hash chain y preparacion interna VERI*FACTU/B2B.
- Fase 9 iniciada con tests locales de integridad del ledger normativo y contrato de fila futura.
- Fase 10 iniciada con migracion preparada para `regulatory_events` append-only.
- Fase 11 iniciada con adaptador server-side para persistir eventos regulatorios por factura.
- Fase 12 iniciada con tests pgTAP para RLS y append-only de `regulatory_events`.
- Fase 13 iniciada con runner de validacion local Supabase para migraciones, lint y pgTAP.
- Fase 14 iniciada con CI rapido y workflow manual de validacion Supabase local.
- Smoke MVP remoto validado con aprobacion DB y cobertura unitaria de dispatcher, dedupe documental, presupuesto IA y revision humana.
- Superficie Next.js minima conectada: Supabase Auth SSR, proxy de sesion, login, organizacion activa, subida multi-PDF, bandeja, detalle de factura y revision humana aprobar/rechazar.

Pendiente importante: Supabase local sigue pendiente porque Docker Desktop no esta operativo en el entorno actual.
La conexion real a Supabase remoto ya esta vinculada y las migraciones estan aplicadas.

Estado de publicacion: las fases 10-16 quedan publicadas en el remoto principal en la rama `main` tras este cierre de MVP documental.

## Prioridad alta inmediata

1. Preparar un fixture de factura real ademas del PDF sintetico del smoke.
2. Completar Fase 1/2 de producto: crear organizacion, cliente y entidad fiscal desde UI.
3. Validar Supabase local cuando Docker Desktop este operativo y promocionar esa puerta a PR.
4. Anadir visor PDF/URL firmada y proveedor OCR real.

## Documentacion inicial

- [Modelo de datos Supabase](docs/01-modelo-datos-supabase.md)
- [Roadmap tecnico](docs/02-roadmap-tecnico.md)
- [Verificacion Supabase](docs/03-verificacion-supabase.md)
- [Worker documental basico](docs/04-worker-documental.md)
- [IA para facturas recibidas](docs/05-ia-facturas-recibidas.md)
- [Bandeja de revision](docs/06-bandeja-revision.md)
- [Dashboard MVP](docs/07-dashboard-mvp.md)
- [OCR y PDFs dificiles](docs/08-ocr-pdfs-dificiles.md)
- [Preparacion normativa](docs/09-preparacion-normativa.md)
- [Integridad del ledger normativo](docs/10-integridad-ledger-normativo.md)
- [Persistencia del ledger normativo](docs/11-persistencia-ledger-normativo.md)
- [Adaptador del ledger normativo](docs/12-adaptador-ledger-normativo.md)
- [Tests DB del ledger normativo](docs/13-tests-db-ledger-normativo.md)
- [Validacion local Supabase](docs/14-validacion-local-supabase.md)
- [CI y calidad minima](docs/15-ci-calidad.md)

## Decisiones base

- Frontend y BFF: Next.js App Router + TypeScript.
- Base de datos: Supabase PostgreSQL.
- Auth: Supabase Auth.
- Storage: Supabase Storage privado.
- Seguridad: RLS obligatorio en tablas expuestas y Storage.
- Workers: proceso externo TypeScript para PDFs, OCR e IA.
- IA: capa desacoplada con proveedores intercambiables, validacion Zod/JSON Schema y logs completos, incluidos fallos antes de respuesta valida.

## Fuera de alcance por ahora

- La UI aun no crea organizaciones, clientes ni entidades fiscales.
- Supabase local queda pendiente de validar con Docker Desktop.
- El proveedor IA se invoca desde worker/CLI cuando `OPENAI_API_KEY` esta configurada.

## Worker documental

La Fase 3 tiene un worker TypeScript inicial para PDFs con texto embebido:

```powershell
npm run typecheck
npm run dev
npm run build
npm run worker:extract-local -- C:\ruta\factura.pdf
npm run worker:documents
npm run worker:extract-invoice -- <document_id>
npm run review:invoice-local -- C:\ruta\extraccion.json C:\ruta\revision.json
npm run review:invoice-db -- <review_task_id> C:\ruta\revision.json
npm run smoke:mvp-remote -- --skip-ai --cleanup
npm run dashboard:local -- C:\ruta\dashboard-data.json 2026-01-01 2026-12-31
npm run worker:ocr-plan-local -- C:\ruta\documento.pdf 100 2.5 25
npm run regulatory:local -- C:\ruta\regulatory-input.json
npm run regulatory:persist-invoice -- <invoice_id> verifactu_pending
npm run test:regulatory
npm run db:test
npm run supabase:validate-local
npm run ci:static
npm run ci:full
```

Para usar `worker:documents` hace falta configurar `.env` segun `.env.example` y tener Supabase/Postgres accesible.

Para usar `worker:documents`, la app o una prueba debe crear un `processing_job` tipo `extract_text` y enviar un mensaje a `pgmq`. Al terminar texto, el worker crea y encola el job `ai_extract` si hay texto suficiente y no detecta duplicado exacto por hash. El worker reclama jobs solo desde `queued/retrying`, reintenta con backoff exponencial y emite logs JSON con `job_id`, `document_id` y `organization_id`.

Para usar `worker:extract-invoice`, el documento debe tener chunks en `document_text_chunks`, `DATABASE_URL` debe apuntar a la base y `OPENAI_API_KEY` debe estar configurada.

`review:invoice-local` no usa Supabase: toma una extraccion IA en JSON y un comando de revision humana en JSON, y devuelve el resultado auditable.

`review:invoice-db` usa Supabase/Postgres: lee `review_tasks` + `document_extractions`, aplica la revision, inserta `invoices`, `invoice_lines` y `tax_breakdowns` cuando se aprueba, actualiza estados y guarda `audit_logs` en una transaccion.

`smoke:mvp-remote` usa Supabase remoto: crea fixture, sube PDF a Storage, crea `processing_job`, manda PGMQ, procesa `extract_text`, ejecuta `ai_extract`, aprueba la `review_task`, crea `invoice` y limpia datos si se usa `--cleanup`. Con `--skip-ai` valida solo la parte documental y cancela el job IA.

`dashboard:local` no usa Supabase: toma datos exportados o mock en JSON y devuelve un snapshot documental/fiscal para una organizacion.

`worker:ocr-plan-local` no usa proveedor OCR: inspecciona texto embebido del PDF y decide que paginas necesitan OCR, coste estimado y bloqueos por presupuesto.

`regulatory:local` no envia registros oficiales: prepara un ledger interno con hash chain, readiness normativo y export JSON interno.

`test:regulatory` comprueba que el ledger detecta manipulacion de payload, enlaza eventos por hash y rechaza append temporalmente incoherente.

## Supabase local

La estructura Supabase se ha inicializado con `npx supabase init`.

Migracion inicial:

- `supabase/migrations/20260603184208_initial_schema.sql`

Validacion local esperada:

```powershell
npx supabase db reset --local --no-seed
npm run supabase:validate-local
```

Estos comandos requieren Docker Desktop en ejecucion.

## CI

La Fase 14 deja workflows GitHub Actions para CI rapido, Supabase local y smoke remoto manual:

- `.github/workflows/ci.yml`: `npm ci` + `npm run ci:static` en push/PR (`typecheck`, tests unitarios y `next build`).
- `.github/workflows/supabase-local.yml`: validacion Supabase local manual con CLI `2.104.0`.
- `.github/workflows/smoke-mvp-remote.yml`: smoke MVP remoto manual contra Supabase cloud; requiere `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` y, si `run_ai=true`, `OPENAI_API_KEY`. Ejecuta con `--cleanup` por defecto.
