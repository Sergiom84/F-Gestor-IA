import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import {
  formatCurrency,
  getDisplayName,
  resolveAppModule,
  resolveDashboardTab
} from "../_lib/formatters";
import type {
  AppModule,
  DashboardTab,
  DocumentRow,
  FiscalEntityRow,
  Organization,
  OrganizationMember,
  ReviewTaskRow
} from "../_lib/types";

export type DashboardSearchParams = {
  org?: string;
  module?: string;
  tab?: string;
  uploaded?: string;
  onboarded?: string;
  error?: string;
};

export type DashboardCounts = {
  documentCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
  clientCount: number;
  fiscalEntityCount: number;
};

export type DashboardData = DashboardCounts & {
  activeModule: AppModule;
  activeTab: DashboardTab;
  activeMembership: OrganizationMember | null | undefined;
  activeOrganization: Organization;
  aiBudget: string;
  automationRate: number;
  cleanDocumentCount: number;
  displayName: string;
  documents: DocumentRow[];
  fiscalEntities: FiscalEntityRow[];
  organizations: Organization[];
  reviewRate: number;
  reviewTasks: ReviewTaskRow[];
  uploadCoverage: number;
  userEmail: string | null;
};

export async function readDashboardData(params?: DashboardSearchParams): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

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

  const activeModule = resolveAppModule(params?.module);
  const activeTab = resolveDashboardTab(params?.tab);
  const canUseLightModulePayload = activeModule === "sales"
    || activeModule === "quotes"
    || activeModule === "purchases"
    || activeModule === "contacts"
    || activeModule === "products"
    || activeModule === "accounting";
  const lightModulePayload: [
    DocumentRow[],
    ReviewTaskRow[],
    number,
    number,
    number,
    number,
    number,
    FiscalEntityRow[]
  ] = [[], [], 0, 0, 0, 0, 0, []];
  const [
    documents,
    reviewTasks,
    documentCount,
    needsReviewCount,
    ocrRequiredCount,
    clientCount,
    fiscalEntityCount,
    fiscalEntities
  ] = canUseLightModulePayload
    ? lightModulePayload
    : await Promise.all([
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
  const uploadCoverage = clientCount > 0
    ? Math.round((fiscalEntityCount / clientCount) * 100)
    : 0;

  return {
    activeMembership,
    activeModule,
    activeOrganization,
    activeTab,
    aiBudget: formatCurrency(activeOrganization.ai_monthly_budget_cents / 100),
    automationRate,
    cleanDocumentCount,
    clientCount,
    displayName: getDisplayName(user.email),
    documentCount,
    documents,
    fiscalEntities,
    fiscalEntityCount,
    needsReviewCount,
    ocrRequiredCount,
    organizations,
    reviewRate,
    reviewTasks,
    uploadCoverage,
    userEmail: user.email ?? null
  };

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
