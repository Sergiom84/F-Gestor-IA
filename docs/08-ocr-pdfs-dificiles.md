# OCR y PDFs dificiles

Fecha: 2026-06-03  
Estado: Fase 7 iniciada sin proveedor OCR real

## Objetivo

Ampliar cobertura documental para PDFs escaneados, paginas con texto embebido pobre o documentos mixtos.

En esta fase se implementa primero la decision: que paginas necesitan OCR, cuanto costaria procesarlas, que se bloquea por presupuesto o limite de ejecucion y como se gestionan reintentos/resultados parciales.

## Alcance implementado

- Contrato Zod de plan OCR.
- Deteccion por pagina:
  - texto vacio;
  - texto demasiado corto;
  - baja calidad de texto;
  - pagina sin imagen disponible.
- Politica configurable:
  - proveedor pendiente;
  - region esperada `eu`;
  - caracteres minimos;
  - calidad minima;
  - coste por pagina;
  - presupuesto;
  - maximo de paginas por ejecucion;
  - maximo de intentos;
  - backoff base.
- Plan auditable:
  - paginas seleccionadas para OCR;
  - paginas bloqueadas;
  - paginas saltadas por texto embebido suficiente;
  - coste estimado;
  - siguiente estado documental.
- Decision de reintentos.
- Merge de resultados parciales de OCR.
- CLI local sobre PDF.

## Archivos

- `src/workers/document-worker/ocr/ocr-schema.ts`: contratos de plan, pagina, resultado y retry.
- `src/workers/document-worker/ocr/ocr-planner.ts`: planificador OCR, reintentos y merge parcial.
- `src/workers/document-worker/ocr-plan-local.ts`: CLI local para inspeccionar PDF.

## Comando local

```powershell
npm run worker:ocr-plan-local -- C:\ruta\documento.pdf
```

Con presupuesto, coste por pagina y limite:

```powershell
npm run worker:ocr-plan-local -- C:\ruta\documento.pdf 100 2.5 25
```

Argumentos:

- `budget_cents`: presupuesto total en centimos. `0` significa sin bloqueo por presupuesto.
- `cost_per_page_cents`: coste estimado por pagina OCR.
- `max_pages_per_run`: limite de paginas OCR por ejecucion.

## Salida

El plan devuelve:

- `selectedPages`: paginas que deben ir a OCR;
- `blockedPages`: paginas que requieren accion pero no entran por presupuesto/limite u otra razon;
- `skippedPages`: paginas con texto embebido suficiente;
- `estimatedCostCents`;
- `requiresOcr`;
- `nextDocumentStatus`: `ocr_required` o `text_extracted`;
- detalle por pagina con razon.

## Politica por defecto

```text
provider_key=eu_ocr_provider_pending
provider_region=eu
min_text_chars=40
min_text_quality=0.7
cost_per_page_cents=0
budget_cents=0
max_pages_per_run=25
max_attempts=3
retry_base_seconds=60
```

## Por que no se llama todavia al proveedor OCR

La decision de proveedor debe revisarse cuando se conecte infraestructura real: region, DPA, coste, retencion, formatos soportados y limites. Mientras tanto, GFiscal ya puede detectar los PDFs problematicos y controlar coste/riesgo antes de ejecutar OCR.

## Integracion futura

Cuando Supabase/proveedor esten disponibles:

1. Renderizar paginas seleccionadas a imagen.
2. Enviar solo `selectedPages` al proveedor OCR UE.
3. Guardar cada pagina exitosa como `document_pages.extraction_method = 'ocr'`.
4. Crear chunks mezclando texto embebido y OCR.
5. Guardar fallos parciales por pagina.
6. Reintentar solo paginas fallidas.
7. Actualizar `processing_jobs` y `documents`.
8. Encadenar IA solo cuando el texto final sea suficiente.

## Pendiente para cerrar Fase 7

- Elegir proveedor OCR UE.
- Implementar renderizado PDF pagina a imagen.
- Crear worker real de OCR.
- Persistir resultados parciales en Postgres/Supabase.
- Integrar reintentos por pagina.
- Anadir tests del planificador.
