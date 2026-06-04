import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { reviewInvoiceTask } from "../../actions";
import { BrandLockup } from "../../../brand-lockup";

export const dynamic = "force-dynamic";

type ReviewDetailPageProps = {
  params: Promise<{
    taskId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    result?: string;
  }>;
};

type ReviewTaskRow = {
  id: string;
  organization_id: string;
  document_id: string;
  extraction_id: string | null;
  status: string;
  reason: string | null;
  priority: number;
  created_at: string;
};

type DocumentRow = {
  id: string;
  title: string | null;
  status: string;
  fiscal_entity_id: string;
  client_id: string;
  failure_reason: string | null;
  created_at: string;
};

type ExtractionRow = {
  id: string;
  normalized_data: Record<string, unknown>;
  status: string;
  validation_errors: unknown;
  confidence_overall: number | string | null;
};

export default async function ReviewDetailPage({ params, searchParams }: ReviewDetailPageProps) {
  const { taskId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: task, error: taskError } = await supabase
    .from("review_tasks")
    .select("id, organization_id, document_id, extraction_id, status, reason, priority, created_at")
    .eq("id", taskId)
    .maybeSingle()
    .returns<ReviewTaskRow>();

  if (taskError || !task) {
    redirect("/dashboard?error=review_not_found");
  }

  const { data: documentRow, error: documentError } = await supabase
    .from("documents")
    .select("id, title, status, fiscal_entity_id, client_id, failure_reason, created_at")
    .eq("id", task.document_id)
    .single()
    .returns<DocumentRow>();

  if (documentError || !documentRow) {
    redirect("/dashboard?error=document_not_found");
  }

  const extraction = task.extraction_id
    ? await readExtraction(task.extraction_id)
    : null;
  const normalizedData = extraction?.normalized_data ?? {};
  const canSubmitReview = Boolean(extraction) && (task.status === "open" || task.status === "in_review");

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="page-title">
          <BrandLockup />
          <h1>Detalle de factura</h1>
          <p className="supporting-text">
            {documentRow.title ?? "Documento sin titulo"} · {formatLabel(task.reason ?? "revision")}
          </p>
        </div>
        <Link className="button secondary" href={`/dashboard?org=${task.organization_id}`}>
          Volver
        </Link>
      </header>

      {query?.result ? (
        <div className="notice success">Revision guardada: {formatLabel(query.result)}.</div>
      ) : null}

      {query?.error ? (
        <div className="notice danger">{decodeURIComponent(query.error)}</div>
      ) : null}

      <section className="detail-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Extraccion IA</h2>
            <span className="row-meta">{extraction ? formatLabel(extraction.status) : "Sin extraccion"}</span>
          </div>
          {extraction ? (
            <dl className="detail-list">
              <div>
                <dt>Proveedor</dt>
                <dd>{fieldText(normalizedData, ["supplier", "name"]) || "Sin dato"}</dd>
              </div>
              <div>
                <dt>CIF proveedor</dt>
                <dd>{fieldText(normalizedData, ["supplier", "tax_id"]) || "Sin dato"}</dd>
              </div>
              <div>
                <dt>Factura</dt>
                <dd>{fieldText(normalizedData, ["invoice", "invoice_number"]) || "Sin dato"}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{fieldText(normalizedData, ["invoice", "issue_date"]) || "Sin dato"}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{fieldNumber(normalizedData, ["amounts", "total_amount"]) ?? "Sin dato"}</dd>
              </div>
              <div>
                <dt>Confianza</dt>
                <dd>{extraction.confidence_overall ?? "Sin dato"}</dd>
              </div>
            </dl>
          ) : (
            <div className="empty-state">Esta tarea no tiene extraccion IA asociada.</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Estado documental</h2>
            <span className="status-pill default">{formatLabel(documentRow.status)}</span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Tarea</dt>
              <dd>{formatLabel(task.status)}</dd>
            </div>
            <div>
              <dt>Prioridad</dt>
              <dd>{task.priority}</dd>
            </div>
            <div>
              <dt>Creado</dt>
              <dd>{formatDate(task.created_at)}</dd>
            </div>
            {documentRow.failure_reason ? (
              <div>
                <dt>Error</dt>
                <dd>{documentRow.failure_reason}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Revision humana</h2>
          <span className="row-meta">{canSubmitReview ? "Editable" : "Cerrada"}</span>
        </div>
        <form className="review-form" action={reviewInvoiceTask}>
          <input type="hidden" name="review_task_id" value={task.id} />

          <div className="form-grid">
            <label className="field">
              <span>CIF proveedor</span>
              <input className="input" name="supplier_tax_id" defaultValue={fieldText(normalizedData, ["supplier", "tax_id"])} />
            </label>
            <label className="field">
              <span>CIF cliente</span>
              <input className="input" name="customer_tax_id" defaultValue={fieldText(normalizedData, ["customer", "tax_id"])} />
            </label>
            <label className="field">
              <span>Numero factura</span>
              <input className="input" name="invoice_number" defaultValue={fieldText(normalizedData, ["invoice", "invoice_number"])} />
            </label>
            <label className="field">
              <span>Fecha emision</span>
              <input className="input" name="issue_date" type="date" defaultValue={fieldText(normalizedData, ["invoice", "issue_date"])} />
            </label>
            <label className="field">
              <span>Vencimiento</span>
              <input className="input" name="due_date" type="date" defaultValue={fieldText(normalizedData, ["invoice", "due_date"])} />
            </label>
            <label className="field">
              <span>Moneda</span>
              <input className="input" name="currency" defaultValue={fieldText(normalizedData, ["invoice", "currency"]) || "EUR"} />
            </label>
            <label className="field">
              <span>Base</span>
              <input className="input" name="subtotal_amount" inputMode="decimal" defaultValue={fieldNumber(normalizedData, ["amounts", "subtotal_amount"])} />
            </label>
            <label className="field">
              <span>IVA</span>
              <input className="input" name="tax_amount" inputMode="decimal" defaultValue={fieldNumber(normalizedData, ["amounts", "tax_amount"])} />
            </label>
            <label className="field">
              <span>Total</span>
              <input className="input" name="total_amount" inputMode="decimal" defaultValue={fieldNumber(normalizedData, ["amounts", "total_amount"])} />
            </label>
            <label className="field">
              <span>Tipo IVA</span>
              <input className="input" name="tax_rate_percent" inputMode="decimal" defaultValue={fieldNumber(normalizedData, ["tax_breakdowns", "0", "tax_rate_percent"]) ?? 21} />
            </label>
            <label className="field wide">
              <span>Linea</span>
              <input className="input" name="line_description" defaultValue={fieldText(normalizedData, ["line_items", "0", "description"]) || "Factura recibida"} />
            </label>
            <label className="field wide">
              <span>Notas</span>
              <input className="input" name="review_notes" defaultValue="" />
            </label>
          </div>

          <div className="review-actions">
            <button className="button" type="submit" name="action" value="approve" disabled={!canSubmitReview}>
              Aprobar
            </button>
            <button className="button secondary" type="submit" name="action" value="changes_requested" disabled={!canSubmitReview}>
              Pedir cambios
            </button>
            <button className="button danger" type="submit" name="action" value="reject" disabled={!canSubmitReview}>
              Rechazar
            </button>
          </div>
        </form>
      </section>
    </main>
  );

  async function readExtraction(extractionId: string): Promise<ExtractionRow | null> {
    const { data, error } = await supabase
      .from("document_extractions")
      .select("id, normalized_data, status, validation_errors, confidence_overall")
      .eq("id", extractionId)
      .maybeSingle()
      .returns<ExtractionRow>();

    if (error) {
      throw new Error(`No se pudo cargar la extraccion: ${error.message}`);
    }

    return data ?? null;
  }
}

function fieldText(record: Record<string, unknown>, path: string[]): string {
  const value = readPath(record, path);
  return typeof value === "string" ? value : "";
}

function fieldNumber(record: Record<string, unknown>, path: string[]): number | string {
  const value = readPath(record, path);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return typeof value === "string" ? value : "";
}

function readPath(record: unknown, path: string[]): unknown {
  let cursor = record;

  for (const key of path) {
    if (Array.isArray(cursor)) {
      const index = Number(key);
      cursor = Number.isInteger(index) ? cursor[index] : undefined;
      continue;
    }

    if (!cursor || typeof cursor !== "object") {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[key];
  }

  return cursor;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
