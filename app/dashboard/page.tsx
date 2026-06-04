import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  LogOut,
  Sparkles
} from "lucide-react";
import { signOut } from "../login/actions";
import { createClient } from "@/src/lib/supabase/server";
import { AccountingDashboard } from "./_components/accounting-dashboard";
import { ContactsWorkspace } from "./_components/contacts-workspace";
import { ModuleWorkspace } from "./_components/module-workspace";
import { NewsDashboard } from "./_components/news-dashboard";
import { ProductsWorkspace } from "./_components/products-workspace";
import { PurchasesWorkspace } from "./_components/purchases-workspace";
import { SalesDashboard } from "./_components/sales-dashboard";
import { SalesWorkspace } from "./_components/sales-workspace";
import { navigationItems } from "./_lib/module-catalog";
import {
  formatCurrency,
  formatDashboardError,
  getDisplayName,
  resolveAppModule,
  resolveDashboardTab
} from "./_lib/formatters";
import type {
  AppModule,
  DashboardTab,
  DocumentRow,
  FiscalEntityRow,
  Organization,
  OrganizationMember,
  ReviewTaskRow
} from "./_lib/types";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<{
    org?: string;
    module?: string;
    tab?: string;
    uploaded?: string;
    onboarded?: string;
    error?: string;
  }>;
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
    redirect("/onboarding");
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

  const cleanDocumentCount = Math.max(documentCount - needsReviewCount - ocrRequiredCount, 0);
  const automationRate = documentCount > 0 ? Math.round((cleanDocumentCount / documentCount) * 100) : 0;
  const reviewRate = documentCount > 0 ? Math.round((needsReviewCount / documentCount) * 100) : 0;
  const uploadCoverage = fiscalEntityCount > 0 ? 100 : 0;
  const displayName = getDisplayName(user.email);
  const aiBudget = formatCurrency(activeOrganization.ai_monthly_budget_cents / 100);
  const activeModule = resolveAppModule(params?.module);
  const activeTab = resolveDashboardTab(params?.tab);
  const isOperationalModule = activeModule === "sales"
    || activeModule === "purchases"
    || activeModule === "contacts"
    || activeModule === "products";
  const moduleHref = (module: AppModule) => `/dashboard?org=${activeOrganization.id}&module=${module}`;
  const tabHref = (tab: DashboardTab) => `/dashboard?org=${activeOrganization.id}&module=dashboard&tab=${tab}`;

  return (
    <main className="fiscal-shell">
      <aside className="fiscal-sidebar" aria-label="Navegacion principal">
        <div className="sidebar-brand" aria-label="GFiscal">
          <span className="sidebar-brand-mark">GF</span>
          <span>GFiscal</span>
        </div>
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.module;

            return (
              <Link className={`sidebar-link${isActive ? " active" : ""}`} href={moduleHref(item.module)} key={item.label}>
                <Icon aria-hidden="true" size={23} strokeWidth={2.7} />
                <span>{item.label}</span>
                {!isActive ? <ChevronRight aria-hidden="true" className="sidebar-chevron" size={15} /> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className={`fiscal-workbench${isOperationalModule ? " sales-workbench" : ""}`}>
        {isOperationalModule ? null : (
          <header className="fiscal-header">
            <div className="fiscal-title-block">
              <div className="fiscal-title-row">
                <h1>Hola, {displayName}</h1>
                <span className="insights-pill">
                  <Sparkles aria-hidden="true" size={18} fill="currentColor" />
                  Copilot Insights
                </span>
              </div>
              <p>
                En esta pagina se muestra informacion clave sobre tu negocio. GFiscal actualiza tus KPI documentales en tiempo real.
              </p>
            </div>
            <div className="fiscal-header-actions">
              <form className="org-switcher" action="/dashboard">
                <label htmlFor="org">Organizacion</label>
                <input type="hidden" name="module" value={activeModule} />
                {activeModule === "dashboard" ? <input type="hidden" name="tab" value={activeTab} /> : null}
                <select id="org" name="org" defaultValue={activeOrganization.id}>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <button className="button compact secondary" type="submit">
                  Cambiar
                </button>
              </form>
              <form action={signOut}>
                <button className="icon-action" aria-label="Salir" type="submit" title={user.email ?? "Salir"}>
                  <LogOut aria-hidden="true" size={19} />
                </button>
              </form>
            </div>
          </header>
        )}

        {activeModule === "dashboard" ? (
          <div className="fiscal-tabs" role="tablist" aria-label="Secciones del cuadro de mando">
            <Link className={`tab${activeTab === "accounting" ? " active" : ""}`} href={tabHref("accounting")} role="tab">
              Contabilidad
            </Link>
            <Link className={`tab${activeTab === "sales" ? " active" : ""}`} href={tabHref("sales")} role="tab">
              Ventas y compras
            </Link>
            <Link className={`tab${activeTab === "news" ? " active" : ""}`} href={tabHref("news")} role="tab">
              Novedades
            </Link>
          </div>
        ) : null}

        {params?.uploaded ? (
          <div className="notice success">Documento subido y encolado para procesamiento.</div>
        ) : null}

        {params?.onboarded ? (
          <div className="notice success">Alta inicial completada. Ya puedes subir tu primer PDF.</div>
        ) : null}

        {params?.error ? (
          <div className="notice danger">{formatDashboardError(params.error)}</div>
        ) : null}

        {activeModule === "sales" ? (
          <SalesWorkspace organizationName={activeOrganization.name} />
        ) : activeModule === "purchases" ? (
          <PurchasesWorkspace organizationName={activeOrganization.name} />
        ) : activeModule === "contacts" ? (
          <ContactsWorkspace organizationName={activeOrganization.name} />
        ) : activeModule === "products" ? (
          <ProductsWorkspace organizationName={activeOrganization.name} />
        ) : activeModule !== "dashboard" ? (
          <ModuleWorkspace
            module={activeModule}
            clientCount={clientCount}
            documentCount={documentCount}
            fiscalEntityCount={fiscalEntityCount}
            needsReviewCount={needsReviewCount}
            ocrRequiredCount={ocrRequiredCount}
          />
        ) : activeTab === "accounting" ? (
          <AccountingDashboard
            activeOrganization={activeOrganization}
            activeMembership={activeMembership}
            documents={documents}
            reviewTasks={reviewTasks}
            fiscalEntities={fiscalEntities}
            documentCount={documentCount}
            needsReviewCount={needsReviewCount}
            ocrRequiredCount={ocrRequiredCount}
            clientCount={clientCount}
            fiscalEntityCount={fiscalEntityCount}
            cleanDocumentCount={cleanDocumentCount}
            automationRate={automationRate}
            reviewRate={reviewRate}
            uploadCoverage={uploadCoverage}
            aiBudget={aiBudget}
          />
        ) : activeTab === "sales" ? (
          <SalesDashboard
            clientCount={clientCount}
            documentCount={documentCount}
            fiscalEntityCount={fiscalEntityCount}
          />
        ) : (
          <NewsDashboard />
        )}
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

function assertNoError(error: { message: string } | null, message: string): void {
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }
}
