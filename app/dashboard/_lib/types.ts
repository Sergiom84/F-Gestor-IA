export type DashboardTab = "accounting" | "sales" | "news";

export type AppModule =
  | "dashboard"
  | "sales"
  | "purchases"
  | "contacts"
  | "products"
  | "banks"
  | "accounting"
  | "tax"
  | "reports";

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
