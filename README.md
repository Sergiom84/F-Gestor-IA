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
- Migraciones Supabase aplicadas al remoto `F_Gestor-IA` (`yhnqdntfxeojhfgdvkva`), con RLS, Storage privado, cola `document_processing`, onboarding minimo, hardening de Storage y ledger normativo.
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
- Superficie Next.js minima conectada: Supabase Auth SSR, proxy de sesion, login/registro, onboarding minimo con organizacion, cliente y entidad fiscal, subida multi-PDF, bandeja, detalle de factura con URL firmada del PDF y revision humana aprobar/rechazar.
- Onboarding minimo preparado con RPC transaccional `create_onboarding_workspace`: crea organizacion, membership owner, cliente, entidad fiscal y acceso uploader inicial sin `service_role` en frontend.
- Storage RLS endurecido para que la organizacion indicada en el path coincida con la organizacion real de la entidad fiscal.
- Configuracion Supabase endurecida: `SUPABASE_URL` tiene prioridad en servidor sobre `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_PROJECT_REF` detecta procesos con project ref antiguo antes de llamar a Auth.
- Rediseño de dashboard iniciado con referencia local Sage Active (`C:\Users\sergi\Documents\Software\SADGE_Asor-IA`): shell tipo ERP, sidebar modular, pestañas de cuadro de mando y workspaces especificos para Ventas, Compras, Contactos y Productos y servicios.
- Ventas replica presupuestos/pedidos/albaranes/facturas con formulario de presupuesto; Compras replica facturas recibidas con upload y tabs de revision/pago; Contactos replica clientes/proveedores/empleados con ficha de cliente; Productos y servicios replica producto/servicio, tarifas y grupos de descuentos.
- Material local Sage Active extraido a referencia operativa: catalogo TypeScript en `src/lib/product/sage-active-reference.ts` y mapa funcional en `docs/16-mapa-referencia-sage-active.md`.
- Dashboard modularizado en componentes `_components` y `_lib`; Fase 17 avanza con migracion comercial MVP para proveedores, productos/servicios, facturas de venta/compra, presupuestos y vencimientos.

Pendiente importante: Supabase local sigue pendiente porque Docker Desktop no esta operativo en el entorno actual.
La conexion real a Supabase remoto ya esta vinculada y las migraciones de onboarding/hardening Storage ya estan aplicadas en remoto. Falta validar el stack local cuando Docker Desktop este operativo.

Estado de publicacion: las fases 10-16 quedan publicadas en el remoto principal en la rama `main` tras este cierre de MVP documental.

## Prioridad alta inmediata

1. Preparar un fixture de factura real ademas del PDF sintetico del smoke.
2. Validar la revision humana con PDF real visible desde URL firmada.
3. Validar Supabase local cuando Docker Desktop este operativo y promocionar esa puerta a PR.
4. Anadir proveedor OCR real cuando el flujo PDF + revision este cerrado.
5. Sustituir datos semilla del dashboard comercial por tablas reales de facturas de venta, compra, vencimientos, presupuestos, clientes, proveedores y bancos.
6. Conectar `Ventas y compras` a la migracion comercial MVP y retirar los importes/filas semilla.

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
- [Mapa de referencia Sage Active](docs/16-mapa-referencia-sage-active.md)
- [Modelo comercial MVP](docs/17-modelo-comercial-mvp.md)

## Decisiones base

- Frontend y BFF: Next.js App Router + TypeScript.
- Base de datos: Supabase PostgreSQL.
- Auth: Supabase Auth.
- Storage: Supabase Storage privado.
- Seguridad: RLS obligatorio en tablas expuestas y Storage.
- Workers: proceso externo TypeScript para PDFs, OCR e IA.
- IA: capa extensible con proveedor OpenAI actual, validacion Zod/JSON Schema y logs completos, incluidos fallos antes de respuesta valida.
- UI de producto: crecer desde una estructura ERP sobria inspirada en Sage Active, usando sus textos y jerarquia local como referencia, pero conectando cada widget a datos reales de GFiscal antes de considerarlo funcional.

## Estructura de producto

La superficie principal `/dashboard` ya funciona como shell modular:

- `?module=dashboard`: cuadros de mando con pestañas `Contabilidad`, `Ventas y compras` y `Novedades`.
- `?module=sales`: ventas, facturas, presupuestos, cobros y recordatorios.
- `?module=purchases`: compras, proveedores, facturas de compra y gastos.
- `?module=contacts`: clientes, proveedores y terceros.
- `?module=products`: productos, servicios, tarifas y descuentos.
- `?module=banks`: cuentas, extractos, movimientos y conciliacion.
- `?module=accounting`: asientos, libro mayor, marcaje y cierre.
- `?module=tax`: declaraciones, IVA, obligaciones legales y VeriFactu.
- `?module=reports`: informes financieros y fiscales.

Los importes, filas y formularios comerciales que proceden de capturas son datos semilla y superficies de producto. Sirven para dar forma al flujo; no deben interpretarse como datos reales hasta conectar el modelo comercial.

La referencia extraida de Sage Active queda centralizada en `src/lib/product/sage-active-reference.ts`. Incluye modulos, entidades esperadas, acciones rapidas, listas, formularios, settings, senales visuales y backlog de tablas; debe usarse como mapa de producto, no como copia de codigo o payloads de terceros.

La primera base comercial real queda preparada en `supabase/migrations/20260604174547_commercial_foundation.sql`, con RLS en tablas de proveedores, productos/servicios, facturas, presupuestos y vencimientos.

## Fuera de alcance por ahora

- CRUD posterior de organizaciones, clientes, entidades fiscales, invitaciones y roles.
- Visor PDF avanzado, paginacion/zoom y descarga controlada con auditoria.
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

## Configuracion Supabase remoto

El proyecto remoto operativo es `F_Gestor-IA` con project ref `yhnqdntfxeojhfgdvkva`.

En desarrollo remoto, `.env` debe contener:

```powershell
SUPABASE_URL=https://yhnqdntfxeojhfgdvkva.supabase.co
SUPABASE_PROJECT_REF=yhnqdntfxeojhfgdvkva
SUPABASE_ANON_KEY=...
```

`SUPABASE_PROJECT_REF` no es secreto: sirve para que la app detecte si un proceso hereda una `SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_URL` de otro proyecto. Si el host no coincide con el ref esperado, `getSupabasePublicConfig()` falla con un mensaje explicito antes de intentar login/registro.

En Server Components y Server Actions, `SUPABASE_URL` tiene prioridad sobre `NEXT_PUBLIC_SUPABASE_URL` para evitar que un entorno publico antiguo pise la URL real del servidor.

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
