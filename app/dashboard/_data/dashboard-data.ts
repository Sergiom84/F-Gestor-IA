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
  ClientRow,
  DashboardTab,
  DocumentRow,
  FiscalEntityRow,
  Organization,
  OrganizationMember,
  PurchaseDocRow,
  ReviewTaskRow,
  SalesDocRow,
  SalesInvoiceRow,
  SupplierRow
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
  clients: ClientRow[];
  displayName: string;
  documents: DocumentRow[];
  fiscalEntities: FiscalEntityRow[];
  memberCount: number;
  organizations: Organization[];
  overdueInvoices: SalesInvoiceRow[];
  purchaseInvoices: PurchaseDocRow[];
  reviewRate: number;
  reviewTasks: ReviewTaskRow[];
  salesDashboardTotals: { pendingCollection: number; pendingPayment: number; purchaseInvoicesTotal: number };
  salesInvoices: SalesDocRow[];
  salesQuotes: SalesDocRow[];
  suppliers: SupplierRow[];
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

  let clients: ClientRow[] = [];
  let suppliers: SupplierRow[] = [];
  let salesInvoices: SalesDocRow[] = [];
  let salesQuotes: SalesDocRow[] = [];
  let purchaseInvoices: PurchaseDocRow[] = [];
  let memberCount = 0;
  let salesDashboardTotals = { pendingCollection: 0, pendingPayment: 0, purchaseInvoicesTotal: 0 };
  let overdueInvoices: SalesInvoiceRow[] = [];

  if (activeModule === "contacts") {
    [clients, suppliers] = await Promise.all([
      readClients(activeOrganization.id),
      readSuppliers(activeOrganization.id)
    ]);
  } else if (activeModule === "sales") {
    [salesInvoices, salesQuotes] = await Promise.all([
      readSalesInvoices(activeOrganization.id),
      readSalesQuotes(activeOrganization.id)
    ]);
  } else if (activeModule === "purchases") {
    purchaseInvoices = await readPurchaseInvoices(activeOrganization.id);
  } else if (activeModule === "dashboard") {
    const promises: [
      Promise<number>,
      Promise<number>,
      Promise<number>,
      Promise<SalesInvoiceRow[]>
    ] = [
      readPendingCollection(activeOrganization.id),
      readPendingPayment(activeOrganization.id),
      readPurchaseInvoicesTotal(activeOrganization.id),
      readOverdueSalesInvoices(activeOrganization.id)
    ];
    const [pendingCollection, pendingPayment, purchaseInvoicesTotal, overdue] = await Promise.all(promises);
    salesDashboardTotals = { pendingCollection, pendingPayment, purchaseInvoicesTotal };
    overdueInvoices = overdue;
    memberCount = await readMemberCount(activeOrganization.id);
  } else if (activeModule === "settings") {
    memberCount = await readMemberCount(activeOrganization.id);
  }

  return {
    activeMembership,
    activeModule,
    activeOrganization,
    activeTab,
    aiBudget: formatCurrency(activeOrganization.ai_monthly_budget_cents / 100),
    automationRate,
    cleanDocumentCount,
    clientCount,
    clients,
    displayName: getDisplayName(user.email),
    documentCount,
    documents,
    fiscalEntities,
    fiscalEntityCount,
    memberCount,
    needsReviewCount,
    ocrRequiredCount,
    organizations,
    overdueInvoices,
    purchaseInvoices,
    reviewRate,
    reviewTasks,
    salesDashboardTotals,
    salesInvoices,
    salesQuotes,
    suppliers,
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

async function readClients(organizationId: string): Promise<ClientRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, type, contact_email, contact_phone, status")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<ClientRow[]>();

  assertNoError(error, "No se pudieron cargar los clientes");
  return data ?? [];
}

async function readSuppliers(organizationId: string): Promise<SupplierRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, tax_id, contact_email, status")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<SupplierRow[]>();

  assertNoError(error, "No se pudieron cargar los proveedores");
  return data ?? [];
}

async function readSalesInvoices(organizationId: string): Promise<SalesDocRow[]> {
  const supabase = await createClient();
  type DbRow = {
    id: string;
    invoice_number: string | null;
    issue_date: string | null;
    status: string;
    total_amount: number;
    clients: { name: string } | null;
  };

  const { data, error } = await supabase
    .from("sales_invoices")
    .select("id, invoice_number, issue_date, status, total_amount, clients!client_id(name)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(200)
    .returns<DbRow[]>();

  assertNoError(error, "No se pudieron cargar las facturas de venta");
  return (data ?? []).map((row) => ({
    id: row.id,
    status: translateCommercialStatus(row.status),
    date: formatSpanishDate(row.issue_date),
    number: row.invoice_number ?? "—",
    reference: "",
    clientName: row.clients?.name ?? "—",
    total: row.total_amount
  }));
}

async function readSalesQuotes(organizationId: string): Promise<SalesDocRow[]> {
  const supabase = await createClient();
  type DbRow = {
    id: string;
    quote_number: string | null;
    quote_date: string | null;
    status: string;
    total_amount: number;
    clients: { name: string } | null;
  };

  const { data, error } = await supabase
    .from("sales_quotes")
    .select("id, quote_number, quote_date, status, total_amount, clients!client_id(name)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("quote_date", { ascending: false })
    .limit(200)
    .returns<DbRow[]>();

  assertNoError(error, "No se pudieron cargar los presupuestos");
  return (data ?? []).map((row) => ({
    id: row.id,
    status: translateCommercialStatus(row.status),
    date: formatSpanishDate(row.quote_date),
    number: row.quote_number ?? "—",
    reference: "",
    clientName: row.clients?.name ?? "—",
    total: row.total_amount
  }));
}

async function readPurchaseInvoices(organizationId: string): Promise<PurchaseDocRow[]> {
  const supabase = await createClient();
  type DbRow = {
    id: string;
    invoice_number: string | null;
    issue_date: string | null;
    due_date: string | null;
    status: string;
    total_amount: number;
    suppliers: { name: string } | null;
  };

  const { data, error } = await supabase
    .from("purchase_invoices")
    .select("id, invoice_number, issue_date, due_date, status, total_amount, suppliers!supplier_id(name)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(200)
    .returns<DbRow[]>();

  assertNoError(error, "No se pudieron cargar las facturas de compra");
  return (data ?? []).map((row) => ({
    id: row.id,
    status: translateCommercialStatus(row.status),
    invoiceDate: formatSpanishDate(row.issue_date),
    dueDate: formatSpanishDate(row.due_date),
    invoiceNumber: row.invoice_number ?? "—",
    supplierName: row.suppliers?.name ?? "—",
    total: row.total_amount,
    tab: purchaseStatusToTab(row.status)
  }));
}

function translateCommercialStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: "Borrador",
    open: "Abierta",
    booked: "Contabilizada",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    overdue: "Vencida",
    paid: "Pagada",
    cancelled: "Cancelada"
  };
  return labels[status] ?? status;
}

function purchaseStatusToTab(status: string): "review" | "pay" | "paid" {
  if (status === "paid") return "paid";
  if (status === "draft" || status === "open") return "review";
  return "pay";
}

function formatSpanishDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function readMemberCount(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");

  assertNoError(error, "No se pudo contar miembros");
  return count ?? 0;
}

async function readPendingCollection(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commercial_maturities")
    .select("outstanding_amount")
    .eq("organization_id", organizationId)
    .eq("direction", "receivable")
    .in("status", ["open", "overdue", "partial"])
    .is("deleted_at", null);

  assertNoError(error, "No se pudo calcular pendiente de cobro");
  return (data ?? []).reduce((sum, row) => sum + (row.outstanding_amount ?? 0), 0);
}

async function readPendingPayment(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commercial_maturities")
    .select("outstanding_amount")
    .eq("organization_id", organizationId)
    .eq("direction", "payable")
    .in("status", ["open", "overdue", "partial"])
    .is("deleted_at", null);

  assertNoError(error, "No se pudo calcular pendiente de pago");
  return (data ?? []).reduce((sum, row) => sum + (row.outstanding_amount ?? 0), 0);
}

async function readPurchaseInvoicesTotal(organizationId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_invoices")
    .select("total_amount")
    .eq("organization_id", organizationId)
    .not("status", "eq", "cancelled")
    .is("deleted_at", null);

  assertNoError(error, "No se pudo calcular total facturas de compra");
  return (data ?? []).reduce((sum, row) => sum + (row.total_amount ?? 0), 0);
}

async function readOverdueSalesInvoices(organizationId: string): Promise<SalesInvoiceRow[]> {
  const supabase = await createClient();
  type DbRow = {
    id: string;
    invoice_number: string | null;
    issue_date: string | null;
    status: string;
    total_amount: number;
    clients: { name: string } | null;
  };

  const { data, error } = await supabase
    .from("sales_invoices")
    .select("id, invoice_number, issue_date, status, total_amount, clients!client_id(name)")
    .eq("organization_id", organizationId)
    .eq("status", "overdue")
    .is("deleted_at", null)
    .order("issue_date", { ascending: false })
    .limit(20)
    .returns<DbRow[]>();

  assertNoError(error, "No se pudieron cargar facturas vencidas");
  return (data ?? []).map((row) => ({
    id: row.id,
    status: translateCommercialStatus(row.status),
    invoiceDate: formatSpanishDate(row.issue_date),
    invoiceNumber: row.invoice_number ?? "—",
    customer: row.clients?.name ?? "—",
    customerCode: "",
    total: row.total_amount
  }));
}
