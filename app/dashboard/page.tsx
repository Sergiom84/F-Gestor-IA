import { redirect } from "next/navigation";
import { signOut } from "../login/actions";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<{
    org?: string;
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
            <p className="brand-line">GFiscal</p>
            <h1>Sin organizacion activa</h1>
            <p className="supporting-text">Tu usuario no tiene una membresia activa en este proyecto.</p>
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
    clientCount,
    fiscalEntityCount
  ] = await Promise.all([
    readDocuments(activeOrganization.id),
    readReviewTasks(activeOrganization.id),
    readDocumentCount(activeOrganization.id),
    readNeedsReviewCount(activeOrganization.id),
    readClientCount(activeOrganization.id),
    readFiscalEntityCount(activeOrganization.id)
  ]);

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="page-title">
          <p className="brand-line">GFiscal</p>
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
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumen">
        <MetricCard label="Documentos" value={documentCount} />
        <MetricCard label="Revision" value={needsReviewCount} />
        <MetricCard label="Clientes" value={clientCount} />
        <MetricCard label="Entidades fiscales" value={fiscalEntityCount} />
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Ultimos documentos</h2>
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
                  <div className="row-title">{formatLabel(task.reason)}</div>
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
  const knownStatuses = new Set(["needs_review", "open", "in_review", "failed", "rejected", "approved", "succeeded"]);
  const className = knownStatuses.has(status)
    ? `status-pill ${status}`
    : "status-pill default";

  return <span className={className}>{formatLabel(status)}</span>;
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
