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
- Migracion inicial Supabase creada, con RLS, Storage privado y cola `document_processing`.
- Worker documental TypeScript creado para extraer texto embebido de PDFs.
- Fase 4 iniciada con contrato Zod/JSON Schema y extractor IA de facturas recibidas.
- Fase 5 iniciada con motor local de revision humana y aprobacion/rechazo sin depender aun de Supabase remoto.
- Fase 6 iniciada con motor local de dashboard MVP para snapshot documental/fiscal desde JSON.
- Fase 7 iniciada con planificador local de OCR para PDFs dificiles, coste por pagina y reintentos.
- Fase 8 iniciada con ledger normativo offline, hash chain y preparacion interna VERI*FACTU/B2B.
- Fase 9 iniciada con tests locales de integridad del ledger normativo y contrato de fila futura.
- Fase 10 iniciada con migracion preparada para `regulatory_events` append-only.
- Fase 11 iniciada con adaptador server-side para persistir eventos regulatorios por factura.
- Fase 12 iniciada con tests pgTAP para RLS y append-only de `regulatory_events`.
- Fase 13 iniciada con runner de validacion local Supabase para migraciones, lint y pgTAP.
- Fase 14 iniciada con CI rapido y workflow manual de validacion Supabase local.

Pendiente importante: la migracion y el worker contra Supabase local no se han podido validar porque Docker Desktop no esta operativo en el entorno actual.
La conexion real a Supabase remoto queda deliberadamente para el final, cuando esten disponibles URL y claves.

Estado de publicacion: las fases 10-14 estan publicadas en el remoto principal en la rama `main`.

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
- IA: capa desacoplada con proveedores intercambiables, validacion Zod/JSON Schema y logs completos.

## Fuera de alcance por ahora

- No hay codigo de aplicacion todavia.
- Hay una primera migracion Supabase local, pendiente de validar con Docker Desktop.
- No hay configuracion real de Supabase todavia.
- No hay proveedores de IA conectados todavia.

## Worker documental

La Fase 3 tiene un worker TypeScript inicial para PDFs con texto embebido:

```powershell
npm run typecheck
npm run worker:extract-local -- C:\ruta\factura.pdf
npm run worker:documents
npm run worker:extract-invoice -- <document_id>
npm run review:invoice-local -- C:\ruta\extraccion.json C:\ruta\revision.json
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

Para usar `worker:extract-invoice`, el documento debe tener chunks en `document_text_chunks`, `DATABASE_URL` debe apuntar a la base y `OPENAI_API_KEY` debe estar configurada.

`review:invoice-local` no usa Supabase: toma una extraccion IA en JSON y un comando de revision humana en JSON, y devuelve el resultado auditable.

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

La Fase 14 deja dos workflows GitHub Actions:

- `.github/workflows/ci.yml`: `npm ci` + `npm run ci:static` en push/PR.
- `.github/workflows/supabase-local.yml`: validacion Supabase local manual con CLI `2.104.0`.
