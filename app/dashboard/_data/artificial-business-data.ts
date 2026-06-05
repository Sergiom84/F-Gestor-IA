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

export const artificialSalesCustomers = [
  "GENESIS BIENESTAR SL",
  "INTERVENCIONES ORIENTADAS SL",
  "SANSANO OIL SERVICE SL"
];

export const artificialSalesDefaults = {
  quoteDate: "2026-06-04",
  settingsEmail: "facturacion@gfiscal.local",
  nextNumber: "0002"
};

export const artificialSalesDocuments: Record<SalesSectionId, ArtificialSalesDocumentRow[]> = {
  quotes: [
    {
      id: "quote-0001",
      status: "Cerrado",
      date: "06/04/2026",
      number: "0001",
      reference: "",
      clientCode: "32",
      client: "GENESIS BIENESTAR SL",
      total: 6265.38
    }
  ],
  orders: [
    {
      id: "order-0007",
      status: "Preparado",
      date: "05/06/2026",
      number: "0007",
      reference: "WEB-JUNIO",
      clientCode: "18",
      client: "INTERVENCIONES ORIENTADAS SL",
      total: 1840.25
    }
  ],
  "delivery-notes": [
    {
      id: "delivery-0012",
      status: "Pendiente",
      date: "05/06/2026",
      number: "0012",
      reference: "SALIDA-ALM",
      clientCode: "42",
      client: "SANSANO OIL SERVICE SL",
      total: 946.18
    }
  ],
  invoices: [
    {
      id: "invoice-0021",
      status: "Emitida",
      date: "04/06/2026",
      number: "0021",
      reference: "JUN-ASES",
      clientCode: "32",
      client: "GENESIS BIENESTAR SL",
      total: 6265.38
    }
  ],
  "recurring-invoices": [
    {
      id: "recurring-0003",
      status: "Activa",
      date: "01/06/2026",
      number: "0003",
      reference: "MENSUAL",
      clientCode: "32",
      client: "GENESIS BIENESTAR SL",
      total: 420
    }
  ]
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

export const artificialPurchaseTabs: Array<{ id: ArtificialPurchaseTabId; label: string; count?: number }> = [
  { id: "all", label: "Todas" },
  { id: "review", label: "Por revisar", count: 1 },
  { id: "pay", label: "Por pagar", count: 57 },
  { id: "paid", label: "Pagadas" }
];

export const artificialPurchaseRows: ArtificialPurchaseInvoiceRow[] = [
  {
    id: "purchase-001",
    importDate: "19/03/2026",
    fileName: "20260319173...",
    status: "Vencida",
    description: "La factura esta contabilizada.",
    supplier: "BRICOLAJE BRICOMAN,...",
    invoiceDate: "26/01/2026",
    invoiceNumber: "004-0001-677...",
    total: 54,
    tab: "pay"
  },
  {
    id: "purchase-002",
    importDate: "19/03/2026",
    fileName: "20260319173...",
    status: "Vencida",
    description: "La factura esta contabilizada.",
    supplier: "BRICOLAJE BRICOMAN,...",
    invoiceDate: "07/03/2026",
    invoiceNumber: "012-0003-006...",
    total: 12,
    tab: "pay"
  },
  {
    id: "purchase-003",
    importDate: "19/03/2026",
    fileName: "20260319173...",
    status: "Vencida",
    description: "La factura esta contabilizada.",
    supplier: "BRICOLAJE BRICOMAN,...",
    invoiceDate: "27/02/2026",
    invoiceNumber: "004-0002-736...",
    total: 6,
    tab: "pay"
  },
  {
    id: "purchase-004",
    importDate: "19/03/2026",
    fileName: "20260319173...",
    status: "Vencida",
    description: "La factura esta contabilizada.",
    supplier: "BRICOLAJE BRICOMAN,...",
    invoiceDate: "21/01/2026",
    invoiceNumber: "004-0001-668...",
    total: 8,
    tab: "pay"
  },
  {
    id: "purchase-005",
    importDate: "19/03/2026",
    fileName: "20260319173...",
    status: "Pendiente",
    description: "Los datos se han extraido. Inspeccion pendiente.",
    supplier: "TALLERES PACHE 18 SL",
    invoiceDate: "27/02/2026",
    invoiceNumber: "176",
    total: 21.87,
    tab: "review"
  },
  {
    id: "purchase-006",
    importDate: "18/03/2026",
    fileName: "20260318142...",
    status: "Pagada",
    description: "La factura esta contabilizada y pagada.",
    supplier: "SUMINISTROS COSTA SL",
    invoiceDate: "18/03/2026",
    invoiceNumber: "A-2026-118",
    total: 142.36,
    tab: "paid"
  }
];

export type ArtificialContactListItem = {
  id: string;
  name: string;
  code: string;
  taxId: string;
};

export const artificialClientRows: ArtificialContactListItem[] = [
  { id: "client-43", name: "AIRE NORTE 1649 SL", code: "43", taxId: "B26590299" },
  { id: "client-2", name: "ANA ZORRILLA TORRAS", code: "2", taxId: "01495127N" },
  { id: "client-38", name: "ANDA CONMIGO SL", code: "38", taxId: "B05315700" },
  { id: "client-29", name: "ANDRES MAURICIO GIRALDO", code: "29", taxId: "60056406W" },
  { id: "client-15", name: "ANTONIO LOPEZ DIAZ", code: "15", taxId: "50794342S" },
  { id: "client-23", name: "AUTOALMACENAJE PERSONAL SL", code: "23", taxId: "B86713567" },
  { id: "client-6", name: "CAJICATOLU SL", code: "6", taxId: "B87940912" },
  { id: "client-45", name: "CESAR MANUEL MARINO BRAVO", code: "45", taxId: "53309922Q" }
];

export const artificialSupplierRows: ArtificialContactListItem[] = [
  { id: "supplier-1", name: "BRICOLAJE BRICOMAN SL", code: "102", taxId: "B84402031" },
  { id: "supplier-2", name: "TALLERES PACHE 18 SL", code: "103", taxId: "B87900176" }
];

export const artificialEmployeeRows: ArtificialContactListItem[] = [
  { id: "employee-1", name: "MARTA ADMINISTRACION", code: "E01", taxId: "00000001E" }
];

export const artificialSalesDashboardRows: SalesInvoiceRow[] = [
  {
    id: "0013",
    status: "Vencida",
    invoiceDate: "30/05/2026",
    invoiceNumber: "0013",
    customer: "INTERVENCIONES ORIENTADAS SL",
    customerCode: "47",
    total: 18856.11
  },
  {
    id: "0012",
    status: "Vencida",
    invoiceDate: "25/05/2026",
    invoiceNumber: "0012",
    customer: "SANSANO OIL SERVICE SL",
    customerCode: "24",
    total: 1294.7
  },
  {
    id: "0011",
    status: "Vencida",
    invoiceDate: "25/05/2026",
    invoiceNumber: "0011",
    customer: "FENIX DISTRIBUCIONES SL",
    customerCode: "26",
    total: -1452
  }
];

export const artificialSalesDashboardTotals = {
  pendingCollection: 46004.88,
  pendingPayment: 6455.46,
  purchaseInvoicesTotal: 6134.97
};

export const artificialAccountingValues = {
  grossProfit: 33557.13,
  sales: 38020.56,
  purchases: 4463.43,
  profitBeforeTax: 32950.35,
  operatingResult: 32950.35,
  financialResult: 0,
  exceptionalResult: 0,
  assets: 47069.64,
  netWorth: 32950.35,
  treasury: 0,
  workingCapital: 32950.35,
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

export const artificialMatchingCategories = [
  "Clientes",
  "Proveedores",
  "Banco",
  "Efectivo",
  "Gastos",
  "Ingresos",
  "Capital",
  "Inmovilizado",
  "Empleados",
  "Anticipos de clientes",
  "Anticipos a proveedores",
  "Impuestos soportados",
  "Impuestos repercutidos",
  "Envases y embalajes a devolver a proveedores",
  "Envases y embalajes a devolver por clientes"
];

export const artificialMatchingSubjects: ArtificialMatchingSubject[] = [
  { id: "aire-norte", name: "AIRE NORTE 1649 SL", type: "Cliente", category: "Clientes", count: 43, amount: 6814.72 },
  { id: "bricolaje", name: "BRICOLAJE BRICOMAN SL", type: "Proveedor", category: "Proveedores", count: 3, amount: -96.63 },
  { id: "comunidad-a", name: "COMUNIDAD DE PROPIETARIOS OLIVO", type: "Cliente", category: "Clientes", count: 12, amount: 883.3 },
  { id: "comunidad-b", name: "COMUNIDAD PROPIETARIOS LAGO", type: "Cliente", category: "Clientes", count: 46, amount: 278.3 },
  { id: "cristobal", name: "CRISTOBAL SANCHEZ DIAZ", type: "Cliente", category: "Clientes", count: 45, amount: 205.7 },
  { id: "echafan", name: "ECHAFAN SL", type: "Cliente", category: "Clientes", count: 44, amount: 895.4 },
  { id: "electronica", name: "ELECTRONICA EMBARCADA SL", type: "Proveedor", category: "Proveedores", count: 23, amount: -21.02 },
  { id: "capital-social", name: "Capital social", type: "Capital", category: "Capital", count: 0, amount: 0 }
];

export const artificialMatchingLines: Record<string, ArtificialMatchingLine[]> = {
  "aire-norte": [
    {
      id: "line-001",
      journal: "VEN - Facturas emitidas",
      date: "21/04/2026",
      entryNumber: "60",
      documentNumber: "0005",
      account: "43000000 - Clientes",
      thirdParty: "AIRE NORTE 1649 SL",
      description: "Factura de venta no 0005",
      debit: 6814.72,
      credit: 0,
      mark: ""
    }
  ],
  bricolaje: [
    {
      id: "line-002",
      journal: "COM - Facturas recibidas",
      date: "07/03/2026",
      entryNumber: "28",
      documentNumber: "004-0003",
      account: "40000000 - Proveedores",
      thirdParty: "BRICOLAJE BRICOMAN SL",
      description: "Factura de compra pendiente",
      debit: 0,
      credit: 96.63,
      mark: ""
    }
  ]
};

export const artificialClosingPeriods: ArtificialClosingPeriod[] = [
  { id: "close-2026-06", period: "Junio 2026", kind: "Cierre mensual", status: "Abierto", checks: "3 controles pendientes", date: "30/06/2026" },
  { id: "close-2026-05", period: "Mayo 2026", kind: "Cierre mensual", status: "Preparado", checks: "Sin descuadre", date: "31/05/2026" },
  { id: "close-2025", period: "Ejercicio 2025", kind: "Cierre anual", status: "Cerrado", checks: "FEC exportado", date: "31/12/2025" }
];
