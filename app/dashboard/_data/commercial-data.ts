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
  name: string;
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

  const [clientsResult, suppliersResult] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbClientRow[]>(),
    supabase
      .from("suppliers")
      .select("id, name, tax_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbSupplierRow[]>()
  ]);

  const clients: ArtificialContactListItem[] = (clientsResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    code: shortId(c.id),
    taxId: ""
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
};

export async function readPurchasesData(organizationId: string): Promise<PurchasesData> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("purchase_invoices")
    .select("id, invoice_number, issue_date, due_date, status, total_amount, notes, created_at, suppliers!supplier_id(name)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<DbPurchaseInvoiceRow[]>();

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

  return { invoices };
}

export type SalesData = {
  documents: Record<SalesSectionId, ArtificialSalesDocumentRow[]>;
};

export async function readSalesData(organizationId: string): Promise<SalesData> {
  const supabase = await createClient();

  const [invoicesResult, quotesResult] = await Promise.all([
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
      .returns<DbSalesQuoteRow[]>()
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
    documents: {
      invoices,
      quotes,
      orders: [],
      "delivery-notes": [],
      "recurring-invoices": []
    }
  };
}

export type ProductItem = {
  id: string;
  code: string;
  name: string;
  kind: "product" | "service";
  unitPrice: number;
  isActive: boolean;
};

export type ProductsData = {
  products: ProductItem[];
};

export async function readProductsData(organizationId: string): Promise<ProductsData> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products_services")
    .select("id, code, name, kind, unit_price, is_active")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .returns<DbProductRow[]>();

  const products: ProductItem[] = (data ?? []).map((row) => ({
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    kind: row.kind as "product" | "service",
    unitPrice: Number(row.unit_price),
    isActive: row.is_active
  }));

  return { products };
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
