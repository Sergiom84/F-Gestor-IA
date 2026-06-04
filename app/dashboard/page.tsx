import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "../login/actions";
import { uploadDocument } from "./actions";
import { createClient } from "@/src/lib/supabase/server";
import { BrandLockup } from "../brand-lockup";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<{
    org?: string;
    uploaded?: string;
    error?: string;
  }>;
};

type OrganizationMember = {
  organization_id: string;
  role: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  ai_monthly_budget_cents: number;
};

type DocumentRow = {
  id: string;
  title: string | null;
  document_type: string;
  status: string;
  source: string;
  created_at: string;
  failure_reason: string | null;
};

type ReviewTaskRow = {
  id: string;
  status: string;
  reason: string;
  priority: number;
  document_id: string;
  created_at: string;
};

type FiscalEntityRow = {
  id: string;
  legal_name: string;
  tax_id: string | null;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<OrganizationMember[]>();

  assertNoError(membershipsError, "No se pudieron cargar las organizaciones");

  const organizationIds = memberships?.map((membership) => membership.organization_id) ?? [];
  const organizations = organizationIds.length > 0
    ? await readOrganizations(organizationIds)
    : [];
  const activeOrganization = organizations.find((organization) => organization.id === params?.org)
    ?? organizations[0]
    ?? null;
  const activeMembership = activeOrganization
    ? memberships?.find((membership) => membership.organization_id === activeOrganization.id)
    : null;

  if (!activeOrganization) {
    return (
      <main className="dashboard">
        <header className="topbar">
          <div className="page-title">
            <BrandLockup />
            <h1>Sin organizacion activa</h1>
            <p className="supporting-text">No hay membresia activa para este usuario.</p>
          </div>
          <form action={signOut}>
            <button className="button secondary" type="submit">
              Salir
            </button>
          </form>
        </header>
      </main>
    );
  }

  const [
    documents,
    reviewTasks,
    documentCount,
    needsReviewCount,
    ocrRequiredCount,
    clientCount,
    fiscalEntityCount,
    fiscalEntities
  ] = await Promise.all([
    readDocuments(activeOrganization.id),
    readReviewTasks(activeOrganization.id),
    readDocumentCount(activeOrganization.id),
    readNeedsReviewCount(activeOrganization.id),
    readOcrRequiredCount(activeOrganization.id),
    readClientCount(activeOrganization.id),
    readFiscalEntityCount(activeOrganization.id),
    readFiscalEntities(activeOrganization.id)
  ]);

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="page-title">
          <BrandLockup />
          <h1>Bandeja documental</h1>
          <p className="supporting-text">
            {activeOrganization.name} · {activeMembership?.role ?? "miembro"}
          </p>
        </div>
        <div className="topbar-actions">
          <span className="user-email">{user.email}</span>
          <form action={signOut}>
            <button className="button secondary" type="submit">
              Salir
            </button>
          </form>
        </div>
      </header>

      <section className="org-strip" aria-label="Organizacion activa">
        <form className="field" action="/dashboard">
          <span>Organizacion</span>
          <div className="inline-control">
            <select className="select" name="org" defaultValue={activeOrganization.id}>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <button className="button secondary" type="submit">
              Cambiar
            </button>
          </div>
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumen">
        <MetricCard label="Documentos" value={documentCount} />
        <MetricCard label="Por revisar" value={needsReviewCount} />
        <MetricCard label="OCR pendiente" value={ocrRequiredCount} />
        <MetricCard label="Clientes" value={clientCount} />
        <MetricCard label="Entidades fiscales" value={fiscalEntityCount} />
      </section>

      {params?.uploaded ? (
        <div className="notice success">Documento subido y encolado para procesamiento.</div>
      ) : null}

      {params?.error ? (
        <div className="notice danger">{formatDashboardError(params.error)}</div>
      ) : null}

      <section className="panel upload-panel" aria-labelledby="upload-title">
        <div className="panel-header">
          <h2 id="upload-title">Subir factura</h2>
          <span className="row-meta">PDF · Storage privado · cola documental</span>
        </div>
        <form className="upload-form" action={uploadDocument}>
          <input type="hidden" name="organization_id" value={activeOrganization.id} />
          <label className="field">
            <span>Entidad fiscal</span>
            <select className="select" name="fiscal_entity_id" required disabled={fiscalEntities.length === 0}>
              {fiscalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.legal_name}{entity.tax_id ? ` · ${entity.tax_id}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Archivos PDF</span>
            <input className="input file-input" name="files" type="file" accept="application/pdf" multiple required />
          </label>
          <button className="button" type="submit" disabled={fiscalEntities.length === 0}>
            Encolar
          </button>
        </form>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Documentos recientes</h2>
            <span className="row-meta">{documents.length} visibles</span>
          </div>
          {documents.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Origen</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <div className="row-title">{document.title ?? "Documento sin titulo"}</div>
                        {document.failure_reason ? (
                          <div className="row-meta">{document.failure_reason}</div>
                        ) : null}
                      </td>
                      <td>{formatLabel(document.document_type)}</td>
                      <td>
                        <StatusPill status={document.status} />
                      </td>
                      <td>{formatLabel(document.source)}</td>
                      <td>{formatDate(document.created_at)}</td>
                      <td>
                        {document.status === "ocr_required" ? (
                          <span className="row-meta strong">Requiere OCR</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No hay documentos visibles en esta organizacion.</div>
          )}
        </div>

        <aside className="panel">
          <div className="panel-header">
            <h2>Revision humana</h2>
            <span className="row-meta">{reviewTasks.length} abiertas</span>
          </div>
          {reviewTasks.length > 0 ? (
            <div className="side-list">
              {reviewTasks.map((task) => (
                <div className="side-row" key={task.id}>
                  <Link className="row-title link-row" href={`/dashboard/review/${task.id}`}>
                    {formatLabel(task.reason)}
                  </Link>
                  <div className="row-meta">Prioridad {task.priority} · {formatDate(task.created_at)}</div>
                  <StatusPill status={task.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No hay revisiones abiertas.</div>
          )}
        </aside>
      </section>
    </main>
  );

  async function readOrganizations(ids: string[]): Promise<Organization[]> {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, plan, status, ai_monthly_budget_cents")
      .in("id", ids)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<Organization[]>();

    assertNoError(error, "No se pudieron cargar las organizaciones");
    return data ?? [];
  }

  async function readDocuments(organizationId: string): Promise<DocumentRow[]> {
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, document_type, status, source, created_at, failure_reason")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<DocumentRow[]>();

    assertNoError(error, "No se pudieron cargar los documentos");
    return data ?? [];
  }

  async function readReviewTasks(organizationId: string): Promise<ReviewTaskRow[]> {
    const { data, error } = await supabase
      .from("review_tasks")
      .select("id, status, reason, priority, document_id, created_at")
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_review"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ReviewTaskRow[]>();

    assertNoError(error, "No se pudieron cargar las revisiones");
    return data ?? [];
  }

  async function readDocumentCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar documentos");
    return count ?? 0;
  }

  async function readNeedsReviewCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "needs_review")
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar revision");
    return count ?? 0;
  }

  async function readOcrRequiredCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "ocr_required")
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar OCR pendiente");
    return count ?? 0;
  }

  async function readClientCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar clientes");
    return count ?? 0;
  }

  async function readFiscalEntityCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("fiscal_entities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar entidades fiscales");
    return count ?? 0;
  }

  async function readFiscalEntities(organizationId: string): Promise<FiscalEntityRow[]> {
    const { data, error } = await supabase
      .from("fiscal_entities")
      .select("id, legal_name, tax_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("legal_name", { ascending: true })
      .returns<FiscalEntityRow[]>();

    assertNoError(error, "No se pudieron cargar las entidades fiscales");
    return data ?? [];
  }
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const knownStatuses = new Set([
    "uploaded",
    "queued",
    "extracting_text",
    "text_extracted",
    "ocr_required",
    "ocr_processing",
    "ai_processing",
    "needs_review",
    "open",
    "in_review",
    "failed",
    "rejected",
    "approved",
    "succeeded"
  ]);
  const className = knownStatuses.has(status)
    ? `status-pill ${status}`
    : "status-pill default";

  return <span className={className}>{formatLabel(status)}</span>;
}

function formatDashboardError(error: string): string {
  const messages: Record<string, string> = {
    missing_file: "Selecciona un PDF antes de subir.",
    unsupported_file: "Solo se admiten PDFs en esta primera superficie.",
    upload_scope: "La entidad fiscal no pertenece a la organizacion activa o no tienes permiso.",
    document_create: "No se pudo crear el documento.",
    storage_upload: "No se pudo subir el PDF a Storage.",
    file_register: "El archivo se subio, pero no pudo registrarse en la base.",
    review_not_found: "No se encontro la tarea de revision."
  };

  return messages[error] ?? "La operacion no se pudo completar.";
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

function assertNoError(error: { message: string } | null, message: string): void {
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }
}
