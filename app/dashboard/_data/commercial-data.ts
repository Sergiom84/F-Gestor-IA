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
  contact_phone: string | null;
  country: string | null;
  default_irpf_rate: number | null;
  fiscal_address: string | null;
  name: string;
  postal_code: string | null;
  province: string | null;
  tax_id: string | null;
  type: "individual" | "company";
};

type DbSalesClientSnapshot = {
  apply_irpf_by_default: boolean | null;
  city: string | null;
  code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
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
  client_id: string;
  invoice_number: string | null;
  issue_date: string | null;
  status: string;
  subtotal_amount: number | null;
  tax_amount: number | null;
  retention_rate: number | null;
  retention_amount: number | null;
  suplido_amount: number | null;
  total_amount: number;
  reference: string | null;
  clients: DbSalesClientSnapshot | null;
};

type DbFiscalEntityOptionRow = {
  id: string;
  legal_name: string;
};

type DbSalesQuoteRow = {
  id: string;
  client_id: string;
  quote_number: string | null;
  quote_date: string | null;
  status: string;
  subtotal_amount: number | null;
  tax_amount: number | null;
  retention_rate: number | null;
  retention_amount: number | null;
  suplido_amount: number | null;
  total_amount: number;
  reference: string | null;
  clients: DbSalesClientSnapshot | null;
};

type DbSalesOrderRow = {
  id: string;
  client_id: string;
  order_number: string | null;
  order_date: string | null;
  status: string;
  subtotal_amount: number | null;
  tax_amount: number | null;
  retention_rate: number | null;
  retention_amount: number | null;
  suplido_amount: number | null;
  total_amount: number;
  reference: string | null;
  clients: DbSalesClientSnapshot | null;
};

type DbSalesDeliveryNoteRow = {
  id: string;
  client_id: string;
  note_number: string | null;
  note_date: string | null;
  status: string;
  subtotal_amount: number | null;
  tax_amount: number | null;
  retention_rate: number | null;
  retention_amount: number | null;
  suplido_amount: number | null;
  total_amount: number;
  reference: string | null;
  clients: DbSalesClientSnapshot | null;
};

type DbSalesRecurringInvoiceRow = {
  id: string;
  client_id: string;
  template_number: string | null;
  next_issue_date: string | null;
  frequency: string;
  status: string;
  subtotal_amount: number | null;
  tax_amount: number | null;
  retention_rate: number | null;
  retention_amount: number | null;
  suplido_amount: number | null;
  total_amount: number;
  reference: string | null;
  clients: DbSalesClientSnapshot | null;
};

type DbProductRow = {
  id: string;
  code: string | null;
  name: string;
  kind: string;
  description: string | null;
  unit_measure: string | null;
  unit_price: number;
  tax_rate: number | null;
  is_active: boolean;
};

type DbPriceListRow = {
  id: string;
  code: string;
  name: string;
  adjustment_type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type DbDiscountGroupRow = {
  id: string;
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
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
    .select("id, code, name, type, tax_id, contact_email, contact_phone, fiscal_address, city, province, postal_code, country, apply_irpf_by_default, default_irpf_rate")
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
    contact_phone: null,
    country: "ES",
    default_irpf_rate: 0,
    fiscal_address: null,
    name: client.name,
    postal_code: null,
    province: null,
    tax_id: null,
    type: "company"
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

function mapQuoteStatus(status: string): string {
  if (status === "open") return "Pendiente";

  return mapSalesStatus(status);
}

function mapSalesClientSnapshot(client: DbSalesClientSnapshot | null) {
  return {
    clientApplyIrpfByDefault: Boolean(client?.apply_irpf_by_default),
    clientCode: client?.code ?? "",
    clientCountry: client?.country ?? "ES",
    clientDefaultIrpfRate: Number(client?.default_irpf_rate ?? 0),
    clientEmail: client?.contact_email ?? "",
    clientFiscalAddress: client?.fiscal_address ?? "",
    clientPhone: client?.contact_phone ?? "",
    clientPostalCode: client?.postal_code ?? "",
    clientProvince: client?.province ?? "",
    clientTaxId: client?.tax_id ?? "",
    clientCity: client?.city ?? "",
    client: client?.name ?? "—"
  };
}

function mapSalesAmounts(row: {
  subtotal_amount?: number | null;
  tax_amount?: number | null;
  retention_rate?: number | null;
  retention_amount?: number | null;
  suplido_amount?: number | null;
}) {
  return {
    baseAvailable: Number(row.subtotal_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    retentionRate: Number(row.retention_rate ?? 0),
    retentionAmount: Number(row.retention_amount ?? 0),
    suplidoAmount: Number(row.suplido_amount ?? 0)
  };
}

export type ContactsData = {
  clients: ArtificialContactListItem[];
  suppliers: ArtificialContactListItem[];
};

export async function readContactsData(organizationId: string): Promise<ContactsData> {
  const supabase = await createClient();

  const [clientRows, fiscalEntityClientsResult, suppliersResult] = await Promise.all([
    readClientRows(supabase, organizationId),
    supabase
      .from("fiscal_entities")
      .select("client_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .returns<Array<{ client_id: string }>>(),
    supabase
      .from("suppliers")
      .select("id, name, tax_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbSupplierRow[]>()
  ]);

  const fiscalEntityClientIds = new Set((fiscalEntityClientsResult.data ?? []).map((row) => row.client_id));
  const clients: ArtificialContactListItem[] = clientRows.filter((c) => !fiscalEntityClientIds.has(c.id)).map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code ?? shortId(c.id),
    taxId: c.tax_id ?? "",
    clientKind: c.type === "individual" ? "individual" : "self_employed",
    applyIrpfByDefault: Boolean(c.apply_irpf_by_default),
    city: c.city ?? "",
    contactEmail: c.contact_email ?? "",
    contactPhone: c.contact_phone ?? "",
    country: c.country ?? "ES",
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

  const [invoicesResult, quotesResult, ordersResult, deliveryNotesResult, recurringInvoicesResult, clientRows, fiscalEntitiesResult, fiscalEntityClientsResult, configResult, productsResult] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id, client_id, invoice_number, issue_date, status, subtotal_amount, tax_amount, retention_rate, retention_amount, suplido_amount, total_amount, reference, clients!client_id(name, code, tax_id, contact_email, contact_phone, fiscal_address, city, province, postal_code, country, apply_irpf_by_default, default_irpf_rate)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(50)
      .returns<DbSalesInvoiceRow[]>(),
    supabase
      .from("sales_quotes")
      .select("id, client_id, quote_number, quote_date, status, subtotal_amount, tax_amount, retention_rate, retention_amount, suplido_amount, total_amount, reference, clients!client_id(name, code, tax_id, contact_email, contact_phone, fiscal_address, city, province, postal_code, country, apply_irpf_by_default, default_irpf_rate)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("quote_date", { ascending: false })
      .limit(50)
      .returns<DbSalesQuoteRow[]>(),
    supabase
      .from("sales_orders")
      .select("id, client_id, order_number, order_date, status, subtotal_amount, tax_amount, retention_rate, retention_amount, suplido_amount, total_amount, reference, clients!client_id(name, code, tax_id, contact_email, contact_phone, fiscal_address, city, province, postal_code, country, apply_irpf_by_default, default_irpf_rate)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("order_date", { ascending: false })
      .limit(50)
      .returns<DbSalesOrderRow[]>(),
    supabase
      .from("sales_delivery_notes")
      .select("id, client_id, note_number, note_date, status, subtotal_amount, tax_amount, retention_rate, retention_amount, suplido_amount, total_amount, reference, clients!client_id(name, code, tax_id, contact_email, contact_phone, fiscal_address, city, province, postal_code, country, apply_irpf_by_default, default_irpf_rate)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("note_date", { ascending: false })
      .limit(50)
      .returns<DbSalesDeliveryNoteRow[]>()
      .then((r) => ({ data: r.data ?? [], error: r.error })),
    supabase
      .from("sales_recurring_invoices")
      .select("id, client_id, template_number, next_issue_date, frequency, status, subtotal_amount, tax_amount, retention_rate, retention_amount, suplido_amount, total_amount, reference, clients!client_id(name, code, tax_id, contact_email, contact_phone, fiscal_address, city, province, postal_code, country, apply_irpf_by_default, default_irpf_rate)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("next_issue_date", { ascending: true })
      .limit(50)
      .returns<DbSalesRecurringInvoiceRow[]>()
      .then((r) => ({ data: r.data ?? [], error: r.error })),
    readClientRows(supabase, organizationId),
    supabase
      .from("fiscal_entities")
      .select("id, legal_name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .returns<DbFiscalEntityOptionRow[]>(),
    supabase
      .from("fiscal_entities")
      .select("client_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .returns<Array<{ client_id: string }>>(),
    supabase
      .from("sales_config")
      .select("payload")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("products_services")
      .select("id, code, name, kind, description, unit_measure, unit_price, tax_rate, is_active")
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
    reference: row.reference ?? "",
    clientId: row.client_id,
    ...mapSalesClientSnapshot(row.clients),
    ...mapSalesAmounts(row),
    total: Number(row.total_amount)
  }));

  const quotes: ArtificialSalesDocumentRow[] = (quotesResult.data ?? []).map((row) => ({
    id: row.id,
    status: mapQuoteStatus(row.status),
    date: formatIsoDate(row.quote_date),
    number: row.quote_number ?? shortId(row.id),
    reference: row.reference ?? "",
    clientId: row.client_id,
    ...mapSalesClientSnapshot(row.clients),
    ...mapSalesAmounts(row),
    total: Number(row.total_amount)
  }));

  const orders: ArtificialSalesDocumentRow[] = (ordersResult.data ?? []).map((row) => ({
    id: row.id,
    status: mapSalesStatus(row.status),
    date: formatIsoDate(row.order_date),
    number: row.order_number ?? shortId(row.id),
    reference: row.reference ?? "",
    clientId: row.client_id,
    ...mapSalesClientSnapshot(row.clients),
    ...mapSalesAmounts(row),
    total: Number(row.total_amount)
  }));

  const deliveryNotes: ArtificialSalesDocumentRow[] = (deliveryNotesResult.data ?? []).map((row) => ({
    id: row.id,
    status: mapSalesStatus(row.status),
    date: formatIsoDate(row.note_date),
    number: row.note_number ?? shortId(row.id),
    reference: row.reference ?? "",
    clientId: row.client_id,
    ...mapSalesClientSnapshot(row.clients),
    ...mapSalesAmounts(row),
    total: Number(row.total_amount)
  }));

  const recurringInvoices: ArtificialSalesDocumentRow[] = (recurringInvoicesResult.data ?? []).map((row) => ({
    id: row.id,
    status: mapSalesStatus(row.status),
    date: formatIsoDate(row.next_issue_date),
    number: row.template_number ?? shortId(row.id),
    reference: row.reference ?? "",
    clientId: row.client_id,
    ...mapSalesClientSnapshot(row.clients),
    ...mapSalesAmounts(row),
    total: Number(row.total_amount)
  }));

  const fiscalEntityClientIds = new Set((fiscalEntityClientsResult.data ?? []).map((row) => row.client_id));

  return {
    clients: clientRows.filter((c) => !fiscalEntityClientIds.has(c.id)).map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code ?? shortId(c.id),
      taxId: c.tax_id ?? "",
      clientKind: c.type === "individual" ? "individual" : "self_employed",
      applyIrpfByDefault: Boolean(c.apply_irpf_by_default),
      city: c.city ?? "",
      contactEmail: c.contact_email ?? "",
      contactPhone: c.contact_phone ?? "",
      country: c.country ?? "ES",
      defaultIrpfRate: Number(c.default_irpf_rate ?? 0),
      fiscalAddress: c.fiscal_address ?? "",
      postalCode: c.postal_code ?? "",
      province: c.province ?? ""
    })),
    documents: {
      invoices,
      quotes,
      orders,
      "delivery-notes": deliveryNotes,
      "recurring-invoices": recurringInvoices
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
  description: string;
  unitMeasure: "day" | "hour" | "month" | "none" | "percentage";
  unitPrice: number;
  taxRate: number | null;
  isActive: boolean;
};

export type PriceListItem = {
  id: string;
  code: string;
  name: string;
  adjustmentType: "fixed_price" | "percentage_discount" | "tiered";
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
};

export type DiscountGroupItem = {
  id: string;
  code: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
};

export type ProductsData = {
  products: ProductItem[];
  priceLists: PriceListItem[];
  discountGroups: DiscountGroupItem[];
};

export async function readProductsData(organizationId: string): Promise<ProductsData> {
  const supabase = await createClient();

  const [productsResult, priceListsResult, discountGroupsResult] = await Promise.all([
    supabase
      .from("products_services")
      .select("id, code, name, kind, description, unit_measure, unit_price, tax_rate, is_active")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbProductRow[]>()
      .then((r) => ({ data: r.data ?? [], error: r.error })),
    supabase
      .from("price_lists")
      .select("id, code, name, adjustment_type, start_date, end_date, is_active")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbPriceListRow[]>()
      .then((r) => ({ data: r.data ?? [], error: r.error })),
    supabase
      .from("discount_groups")
      .select("id, code, name, start_date, end_date, is_active")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<DbDiscountGroupRow[]>()
      .then((r) => ({ data: r.data ?? [], error: r.error }))
  ]);

  return {
    products: productsResult.data.map(mapProductRow),
    priceLists: priceListsResult.data.map(mapPriceListRow),
    discountGroups: discountGroupsResult.data.map(mapDiscountGroupRow)
  };
}

function mapProductRow(row: DbProductRow): ProductItem {
  const unitMeasureOptions = ["day", "hour", "month", "none", "percentage"] as const;
  const unitMeasure = unitMeasureOptions.includes(row.unit_measure as ProductItem["unitMeasure"])
    ? row.unit_measure as ProductItem["unitMeasure"]
    : "hour";

  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    kind: row.kind as "product" | "service",
    description: row.description ?? "",
    unitMeasure,
    unitPrice: Number(row.unit_price),
    taxRate: row.tax_rate === null ? null : Number(row.tax_rate),
    isActive: row.is_active
  };
}

function mapPriceListRow(row: DbPriceListRow): PriceListItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    adjustmentType: (row.adjustment_type as PriceListItem["adjustmentType"]) ?? "fixed_price",
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active
  };
}

function mapDiscountGroupRow(row: DbDiscountGroupRow): DiscountGroupItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
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
