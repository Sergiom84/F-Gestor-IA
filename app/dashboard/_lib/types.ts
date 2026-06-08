export type DashboardTab = "accounting" | "management" | "sales";

export type AppModule =
  | "dashboard"
  | "sales"
  | "quotes"
  | "purchases"
  | "contacts"
  | "products"
  | "banks"
  | "accounting"
  | "tax"
  | "reports"
  | "settings";

export type OrganizationMember = {
  organization_id: string;
  role: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  ai_monthly_budget_cents: number;
};

export type DocumentRow = {
  id: string;
  title: string | null;
  document_type: string;
  status: string;
  source: string;
  created_at: string;
  failure_reason: string | null;
};

export type ReviewTaskRow = {
  id: string;
  status: string;
  reason: string;
  priority: number;
  document_id: string;
  created_at: string;
};

export type FiscalEntityRow = {
  id: string;
  legal_name: string;
  tax_id: string | null;
};

export type SalesInvoiceRow = {
  id: string;
  status: string;
  invoiceDate: string;
  invoiceNumber: string;
  customer: string;
  customerCode: string;
  total: number;
};

export type ClientRow = {
  id: string;
  name: string;
  type: "individual" | "company";
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
};

export type SupplierRow = {
  id: string;
  name: string;
  tax_id: string | null;
  contact_email: string | null;
  status: string;
};

export type SalesDocRow = {
  id: string;
  status: string;
  date: string;
  number: string;
  reference: string;
  clientName: string;
  total: number;
};

export type PurchaseDocRow = {
  id: string;
  status: string;
  invoiceDate: string;
  dueDate: string;
  invoiceNumber: string;
  supplierName: string;
  total: number;
  tab: "review" | "pay" | "paid";
};
