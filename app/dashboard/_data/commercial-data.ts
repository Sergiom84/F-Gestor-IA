import { createClient } from "@/src/lib/supabase/server";
import type {
  ArtificialContactListItem,
  ArtificialPurchaseInvoiceRow,
  ArtificialPurchaseTabId,
  ArtificialSalesDocumentRow,
  SalesSectionId
} from "./artificial-business-data";

type DbClientRow = {
  id: string;
  apply_irpf_by_default: boolean | null;
  city: string | null;
  code: string | null;
  contact_email: string | null;
  default_irpf_rate: number | null;
  fiscal_address: string | null;
  name: string;
  postal_code: string | null;
  province: string | null;
  tax_id: string | null;
};

type DbSupplierRow = {
  id: string;
  name: string;
  tax_id: string | null;
};

type DbPurchaseInvoiceRow = {
  id: string;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  suppliers: { name: string } | null;
};

type DbSalesInvoiceRow = {
  id: string;
  invoice_number: string | null;
  issue_date: string | null;
  status: string;
  total_amount: number;
  clients: { name: string } | null;
};

type DbFiscalEntityOptionRow = {
  id: string;
  legal_name: string;
};

type DbSalesQuoteRow = {
  id: string;
  quote_number: string | null;
  quote_date: string | null;
  status: string;
  total_amount: number;
  clients: { name: string } | null;
};

type DbProductRow = {
  id: string;
  code: string | null;
  name: string;
  kind: string;
  unit_price: number;
  tax_rate: number | null;
  is_active: boolean;
};

type DbMaturityRow = {
  direction: string;
  status: string;
  outstanding_amount: number;
};

function formatIsoDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function shortId(uuid: string): string {
  return uuid.slice(0, 8);
}

async function readClientRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<DbClientRow[]> {
  const extendedResult = await supabase
    .from("clients")
    .select("id, code, name, tax_id, contact_email, fiscal_address, city, province, postal_code, apply_irpf_by_default, default_irpf_rate")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<DbClientRow[]>();

  if (!extendedResult.error) {
    return extendedResult.data ?? [];
  }

  const fallbackResult = await supabase
    .from("clients")
    .select("id, name, contact_email")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string; contact_email: string | null }>>();

  return (fallbackResult.data ?? []).map((client) => ({
    id: client.id,
    apply_irpf_by_default: false,
    city: null,
    code: null,
    contact_email: client.contact_email,
    default_irpf_rate: 0,
    fiscal_address: null,
    name: client.name,
    postal_code: null,
    province: null,
    tax_id: null
  }));
}

function mapPurchaseStatus(status: string): {
  display: ArtificialPurchaseInvoiceRow["status"];
  tab: Exclude<ArtificialPurchaseTabId, "all">;
} {
  switch (status) {
    case "overdue": return { display: "Vencida", tab: "pay" };
    case "paid": return { display: "Pagada", tab: "paid" };
    case "draft": return { display: "Pendiente", tab: "review" };
    default: return { display: "Pendiente", tab: "pay" };
  }
}

function mapSalesStatus(status: string): string {
  switch (status) {
    case "draft": return "Borrador";
    case "open": return "Abierta";
    case "booked": return "Contabilizada";
    case "sent": return "Enviada";
    case "accepted": return "Aceptada";
    case "rejected": return "Rechazada";
    case "overdue": return "Vencida";
    case "paid": return "Pagada";
    case "cancelled": return "Cancelada";
    default: return status;
  }
}

export type ContactsData = {
  clients: ArtificialContactListItem[];
  suppliers: ArtificialContactListItem[];
};

export async function readContactsData(organizationId: string): Promise<ContactsData> {
  const supabase = await createClient();

  const [clientRows, suppliersResult] = await Promise.all([
    readClientRows(supabase, organizationId),
    supabase
      .from("suppliers")
      .select("id, name, tax_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbSupplierRow[]>()
  ]);

  const clients: ArtificialContactListItem[] = clientRows.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code ?? shortId(c.id),
    taxId: c.tax_id ?? "",
    applyIrpfByDefault: Boolean(c.apply_irpf_by_default),
    city: c.city ?? "",
    contactEmail: c.contact_email ?? "",
    defaultIrpfRate: Number(c.default_irpf_rate ?? 0),
    fiscalAddress: c.fiscal_address ?? "",
    postalCode: c.postal_code ?? "",
    province: c.province ?? ""
  }));

  const suppliers: ArtificialContactListItem[] = (suppliersResult.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: shortId(s.id),
    taxId: s.tax_id ?? ""
  }));

  return { clients, suppliers };
}

export type PurchasesData = {
  invoices: ArtificialPurchaseInvoiceRow[];
  fiscalEntityId: string | null;
};

export async function readPurchasesData(organizationId: string): Promise<PurchasesData> {
  const supabase = await createClient();

  const [{ data }, fiscalEntityResult] = await Promise.all([
    supabase
      .from("purchase_invoices")
      .select("id, invoice_number, issue_date, due_date, status, total_amount, notes, created_at, suppliers!supplier_id(name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<DbPurchaseInvoiceRow[]>(),
    supabase
      .from("fiscal_entities")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  const invoices: ArtificialPurchaseInvoiceRow[] = (data ?? []).map((row) => {
    const { display, tab } = mapPurchaseStatus(row.status);
    const supplierName = row.suppliers?.name ?? "—";

    return {
      id: row.id,
      importDate: formatIsoDate(row.created_at),
      fileName: row.invoice_number ?? shortId(row.id),
      status: display,
      description: row.notes ?? (display === "Pagada" ? "La factura esta contabilizada y pagada." : "La factura esta contabilizada."),
      supplier: supplierName,
      invoiceDate: formatIsoDate(row.issue_date),
      invoiceNumber: row.invoice_number ?? shortId(row.id),
      total: Number(row.total_amount),
      tab
    };
  });

  return {
    invoices,
    fiscalEntityId: (fiscalEntityResult.data?.id as string | undefined) ?? null
  };
}

export type SalesConfigPayload = {
  numbering?: { series?: string; nextNumber?: string; format?: string; reset?: string };
  payments?: { term?: string; method?: string; bankAccount?: string; reminder?: string };
  preferences?: { email?: string; pdfTemplate?: string; message?: string };
};

export type SalesData = {
  clients: ArtificialContactListItem[];
  documents: Record<SalesSectionId, ArtificialSalesDocumentRow[]>;
  fiscalEntities: Array<{ id: string; name: string }>;
  config: SalesConfigPayload;
  products: ProductItem[];
};

export async function readSalesData(organizationId: string): Promise<SalesData> {
  const supabase = await createClient();

  const [invoicesResult, quotesResult, clientRows, fiscalEntitiesResult, configResult, productsResult] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id, invoice_number, issue_date, status, total_amount, clients!client_id(name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(50)
      .returns<DbSalesInvoiceRow[]>(),
    supabase
      .from("sales_quotes")
      .select("id, quote_number, quote_date, status, total_amount, clients!client_id(name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("quote_date", { ascending: false })
      .limit(50)
      .returns<DbSalesQuoteRow[]>(),
    readClientRows(supabase, organizationId),
    supabase
      .from("fiscal_entities")
      .select("id, legal_name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .returns<DbFiscalEntityOptionRow[]>(),
    supabase
      .from("sales_config")
      .select("payload")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("products_services")
      .select("id, code, name, kind, unit_price, tax_rate, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbProductRow[]>()
  ]);

  const invoices: ArtificialSalesDocumentRow[] = (invoicesResult.data ?? []).map((row) => ({
    id: row.id,
    status: mapSalesStatus(row.status),
    date: formatIsoDate(row.issue_date),
    number: row.invoice_number ?? shortId(row.id),
    reference: "",
    clientCode: "",
    client: row.clients?.name ?? "—",
    total: Number(row.total_amount)
  }));

  const quotes: ArtificialSalesDocumentRow[] = (quotesResult.data ?? []).map((row) => ({
    id: row.id,
    status: mapSalesStatus(row.status),
    date: formatIsoDate(row.quote_date),
    number: row.quote_number ?? shortId(row.id),
    reference: "",
    clientCode: "",
    client: row.clients?.name ?? "—",
    total: Number(row.total_amount)
  }));

  return {
    clients: clientRows.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code ?? shortId(c.id),
      taxId: c.tax_id ?? "",
      applyIrpfByDefault: Boolean(c.apply_irpf_by_default),
      city: c.city ?? "",
      contactEmail: c.contact_email ?? "",
      defaultIrpfRate: Number(c.default_irpf_rate ?? 0),
      fiscalAddress: c.fiscal_address ?? "",
      postalCode: c.postal_code ?? "",
      province: c.province ?? ""
    })),
    documents: {
      invoices,
      quotes,
      orders: [],
      "delivery-notes": [],
      "recurring-invoices": []
    },
    fiscalEntities: (fiscalEntitiesResult.data ?? []).map((entity) => ({
      id: entity.id,
      name: entity.legal_name
    })),
    config: (configResult.data?.payload as SalesConfigPayload | null) ?? {},
    products: (productsResult.data ?? []).map(mapProductRow)
  };
}

export type ProductItem = {
  id: string;
  code: string;
  name: string;
  kind: "product" | "service";
  unitPrice: number;
  taxRate: number | null;
  isActive: boolean;
};

export type ProductsData = {
  products: ProductItem[];
};

export async function readProductsData(organizationId: string): Promise<ProductsData> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products_services")
    .select("id, code, name, kind, unit_price, tax_rate, is_active")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<DbProductRow[]>();

  return { products: (data ?? []).map(mapProductRow) };
}

function mapProductRow(row: DbProductRow): ProductItem {
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    kind: row.kind as "product" | "service",
    unitPrice: Number(row.unit_price),
    taxRate: row.tax_rate === null ? null : Number(row.tax_rate),
    isActive: row.is_active
  };
}

export type SalesDashboardMetrics = {
  pendingCollection: number;
  pendingPayment: number;
  overdueCollection: number;
  overduePayment: number;
  purchaseInvoicesTotal: number;
};

export async function readSalesDashboardMetrics(organizationId: string): Promise<SalesDashboardMetrics> {
  const supabase = await createClient();

  const [maturitiesResult, purchasesTotalResult] = await Promise.all([
    supabase
      .from("commercial_maturities")
      .select("direction, status, outstanding_amount")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("status", ["open", "overdue", "partial"])
      .returns<DbMaturityRow[]>(),
    supabase
      .from("purchase_invoices")
      .select("total_amount")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("status", ["open", "overdue", "booked", "paid"])
  ]);

  const maturities = maturitiesResult.data ?? [];

  let pendingCollection = 0;
  let pendingPayment = 0;
  let overdueCollection = 0;
  let overduePayment = 0;

  for (const m of maturities) {
    const amount = Number(m.outstanding_amount);

    if (m.direction === "receivable") {
      pendingCollection += amount;
      if (m.status === "overdue") overdueCollection += amount;
    } else {
      pendingPayment += amount;
      if (m.status === "overdue") overduePayment += amount;
    }
  }

  const purchaseInvoicesTotal = (purchasesTotalResult.data ?? []).reduce(
    (sum, row) => sum + Number((row as { total_amount: number }).total_amount),
    0
  );

  return { pendingCollection, pendingPayment, overdueCollection, overduePayment, purchaseInvoicesTotal };
}
