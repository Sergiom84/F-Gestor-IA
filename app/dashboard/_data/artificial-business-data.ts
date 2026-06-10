import type { SalesInvoiceRow } from "../_lib/types";

export type SalesSectionId = "quotes" | "orders" | "delivery-notes" | "invoices" | "recurring-invoices";

export type ArtificialSalesDocumentRow = {
  id: string;
  status: string;
  date: string;
  number: string;
  reference: string;
  clientCode: string;
  client: string;
  total: number;
};

export const artificialSalesCustomers: string[] = [];

export const artificialSalesDefaults = {
  quoteDate: "",
  settingsEmail: "",
  nextNumber: ""
};

export const artificialSalesDocuments: Record<SalesSectionId, ArtificialSalesDocumentRow[]> = {
  quotes: [],
  orders: [],
  "delivery-notes": [],
  invoices: [],
  "recurring-invoices": []
};

export type ArtificialPurchaseTabId = "all" | "review" | "pay" | "paid";

export type ArtificialPurchaseInvoiceRow = {
  id: string;
  importDate: string;
  fileName: string;
  status: "Vencida" | "Pendiente" | "Pagada";
  description: string;
  supplier: string;
  invoiceDate: string;
  invoiceNumber: string;
  total: number;
  tab: Exclude<ArtificialPurchaseTabId, "all">;
};

export const artificialPurchaseRows: ArtificialPurchaseInvoiceRow[] = [];

export type ArtificialContactListItem = {
  id: string;
  name: string;
  code: string;
  taxId: string;
  applyIrpfByDefault?: boolean;
  city?: string;
  contactEmail?: string;
  defaultIrpfRate?: number;
  fiscalAddress?: string;
  postalCode?: string;
  province?: string;
};

export const artificialClientRows: ArtificialContactListItem[] = [];

export const artificialSupplierRows: ArtificialContactListItem[] = [];

export const artificialEmployeeRows: ArtificialContactListItem[] = [];

export const artificialSalesDashboardRows: SalesInvoiceRow[] = [];

export const artificialSalesDashboardTotals = {
  pendingCollection: 0,
  pendingPayment: 0,
  purchaseInvoicesTotal: 0,
  overdueCollection: 0,
  overduePayment: 0
};

export const artificialAccountingValues = {
  grossProfit: 0,
  sales: 0,
  purchases: 0,
  profitBeforeTax: 0,
  operatingResult: 0,
  financialResult: 0,
  exceptionalResult: 0,
  assets: 0,
  netWorth: 0,
  treasury: 0,
  workingCapital: 0,
  staffCosts: 0
};

export type ArtificialMatchingSubject = {
  id: string;
  name: string;
  type: string;
  category: string;
  count: number;
  amount: number;
};

export type ArtificialMatchingLine = {
  id: string;
  journal: string;
  date: string;
  entryNumber: string;
  documentNumber: string;
  account: string;
  thirdParty: string;
  description: string;
  debit: number;
  credit: number;
  mark: string;
};

export type ArtificialClosingPeriod = {
  id: string;
  period: string;
  kind: string;
  status: string;
  checks: string;
  date: string;
};

export const artificialMatchingCategories: string[] = [];

export const artificialMatchingSubjects: ArtificialMatchingSubject[] = [];

export const artificialMatchingLines: Record<string, ArtificialMatchingLine[]> = {};

export const artificialClosingPeriods: ArtificialClosingPeriod[] = [];
