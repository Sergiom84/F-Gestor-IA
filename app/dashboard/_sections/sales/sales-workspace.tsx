"use client";

import "../quotes/quotes.css";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Filter,
  FileCog,
  BarChart3,
  ListChecks,
  Mail,
  MoreVertical,
  PackageSearch,
  PenLine,
  Plus,
  Search,
  Settings,
  Trash2,
  X
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createSalesDeliveryNote,
  createSalesInvoice,
  createSalesOrder,
  createSalesQuote,
  createSalesRecurringInvoice,
  duplicateSalesDocument,
  getSalesQuoteLineDetails,
  getSalesDocumentStatusDetail,
  saveSalesConfigSection,
  softDeleteSalesDocument,
  updateSalesDocumentStatus
} from "../../commercial-actions";
import type { SalesConfigPayload, SalesDocumentKind, SalesDocumentStatusDetail, SalesQuoteLineDetail } from "../../commercial-actions";
import { artificialSalesDocuments } from "../../_data/artificial-business-data";
import type { ArtificialContactListItem, SalesSectionId } from "../../_data/artificial-business-data";
import type { ProductItem } from "../../_data/commercial-data";
import type { SalesDocRow } from "../../_lib/types";
import { formatMoney } from "../../_lib/formatters";
import { loadQuotesInitialData, upsertQuoteDocument } from "../quotes/quotes-actions";

type QuoteFormTab = "products" | "totals" | "notes" | "client";
type SalesDocumentDetailTab = "products" | "totals" | "notes" | "client";
type SalesSettingsPanelId = "numbering" | "payments" | "preferences";
type SalesColumnId = "status" | "date" | "number" | "reference" | "clientCode" | "client" | "total" | "baseAvailable";
type SalesNotice = {
  tone: "success" | "warning";
  text: string;
};

type StatusPresentation = {
  className: string;
  summary: string;
};

type SalesSection = {
  id: SalesSectionId;
  label: string;
  title: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  searchLabel: string;
  singularTitle: string;
  dateLabel: string;
  numberLabel: string;
  tableHeaders: {
    date: string;
    number: string;
    reference?: string;
    client: string;
    clientCode: string;
    baseAvailable?: string;
    total: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    actions: Array<{
      kind: "create" | "contacts" | "quotes" | "orders" | "delivery-notes" | "invoices" | "recurring-invoices";
      label: string;
    }>;
  };
  metrics: Array<{
    label: string;
    description: string;
    tone: "teal" | "indigo" | "green";
    type: "count" | "amount";
  }>;
  tableDescription: string;
};

type SalesDocumentRow = {
  id: string;
  status: string;
  date: string;
  number: string;
  reference: string;
  clientCode: string;
  clientCountry?: string;
  clientEmail?: string;
  clientPhone?: string;
  client: string;
  baseAvailable?: number;
  total: number;
};

type QuoteLine = {
  id: number;
  product: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

type SalesPrintFormat = "template" | "pdf";
type SalesPrintSourceKind = "quote" | "order" | "delivery-note" | "invoice";

type QuotesTemplateConfig = {
  companyName: string;
  companyTagline: string;
  logoDataUrl: string;
  templateIssuerName: string;
  templateIssuerTaxId: string;
  templateIssuerAddress: string;
  templateIssuerCity: string;
  templatePaymentRows: Array<{ id: string; label: string; value: string }>;
  templateSectionTitle: string;
  templateShowQuantity: boolean;
  quoteFixedNotes: string;
  invoiceFixedNotes: string;
  quotePrepaymentEnabled: boolean;
  quotePrepaymentRate: number;
  quotePrepaymentText: string;
  paymentDetails: string;
  pdfPaymentRows: Array<{ id: string; label: string; value: string }>;
  accentColor: string;
  pageBackgroundColor: string;
  clientBoxBackgroundColor: string;
};

const salesSections: SalesSection[] = [
  {
    id: "quotes",
    label: "Presupuestos",
    title: "Presupuestos",
    createLabel: "Crear presupuesto",
    emptyTitle: "No hay presupuestos.",
    emptyDescription: "Crea un presupuesto o ajusta los filtros para ver resultados.",
    searchLabel: "Buscar presupuestos",
    singularTitle: "Presupuesto de venta",
    dateLabel: "Fecha de presup...",
    numberLabel: "Numero de presupuesto",
    tableHeaders: {
      date: "Fecha de presupuesto",
      number: "Numero de presupuesto",
      reference: "Referencia",
      client: "Cliente",
      clientCode: "Codigo de cliente",
      baseAvailable: "Base imponible",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Presupuestos",
      description: "",
      actions: [
        { kind: "create", label: "Crear presupuesto" },
        { kind: "contacts", label: "Crear cliente" }
      ]
    },
    metrics: [
      { label: "Presupuestos", description: "", tone: "indigo", type: "count" },
      { label: "Pendientes", description: "", tone: "teal", type: "count" },
      { label: "Importe ofertado", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  },
  {
    id: "orders",
    label: "Pedidos",
    title: "Pedidos",
    createLabel: "Crear pedido",
    emptyTitle: "No hay pedidos.",
    emptyDescription: "Crea un pedido o revisa los filtros aplicados.",
    searchLabel: "Buscar pedidos",
    singularTitle: "Pedido de venta",
    dateLabel: "Fecha de pedido",
    numberLabel: "Numero de pedido",
    tableHeaders: {
      date: "Fecha de pedido",
      number: "Numero de pedido",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Pedidos",
      description: "",
      actions: [
        { kind: "create", label: "Crear pedido" },
        { kind: "contacts", label: "Crear cliente" }
      ]
    },
    metrics: [
      { label: "Pedidos", description: "", tone: "teal", type: "count" },
      { label: "Pendientes", description: "", tone: "indigo", type: "count" },
      { label: "Importe pedido", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  },
  {
    id: "delivery-notes",
    label: "Albaranes",
    title: "Albaranes",
    createLabel: "Crear albaran",
    emptyTitle: "No hay albaranes.",
    emptyDescription: "Crea un albaran o cambia los filtros para consultar entregas.",
    searchLabel: "Buscar albaranes",
    singularTitle: "Albaran de venta",
    dateLabel: "Fecha de albaran",
    numberLabel: "Numero de albaran",
    tableHeaders: {
      date: "Fecha de albaran",
      number: "Numero de albaran",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Albaranes",
      description: "",
      actions: [
        { kind: "create", label: "Crear albaran" },
        { kind: "contacts", label: "Crear cliente" }
      ]
    },
    metrics: [
      { label: "Albaranes", description: "", tone: "teal", type: "count" },
      { label: "Sin facturar", description: "", tone: "indigo", type: "count" },
      { label: "Importe entregado", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  },
  {
    id: "invoices",
    label: "Facturas",
    title: "Facturas",
    createLabel: "Crear factura",
    emptyTitle: "No hay facturas.",
    emptyDescription: "Crea una factura o ajusta los filtros para revisar ventas.",
    searchLabel: "Buscar facturas",
    singularTitle: "Factura de venta",
    dateLabel: "Fecha de factura",
    numberLabel: "Numero de factura",
    tableHeaders: {
      date: "Fecha de factura",
      number: "Numero de factura",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Ventas",
      description: "",
      actions: [
        { kind: "create", label: "Crear factura de venta" },
        { kind: "contacts", label: "Crear cliente" }
      ]
    },
    metrics: [
      { label: "Facturas de venta", description: "", tone: "teal", type: "count" },
      { label: "Presupuestos", description: "", tone: "indigo", type: "count" },
      { label: "Cobros", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  },
  {
    id: "recurring-invoices",
    label: "Facturas recurrentes",
    title: "Facturas recurrentes",
    createLabel: "Crear recurrente",
    emptyTitle: "No hay facturas recurrentes.",
    emptyDescription: "Crea una factura recurrente o revisa los filtros actuales.",
    searchLabel: "Buscar facturas recurrentes",
    singularTitle: "Factura recurrente",
    dateLabel: "Fecha de factura",
    numberLabel: "Numero de factura",
    tableHeaders: {
      date: "Proxima emision",
      number: "Numero de plantilla",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Importe recurrente"
    },
    hero: {
      eyebrow: "",
      title: "Facturas recurrentes",
      description: "",
      actions: [
        { kind: "create", label: "Crear recurrente" },
        { kind: "contacts", label: "Crear cliente" }
      ]
    },
    metrics: [
      { label: "Recurrentes", description: "", tone: "teal", type: "count" },
      { label: "Proximas", description: "", tone: "indigo", type: "count" },
      { label: "Importe recurrente", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  }
];

const salesSectionIds = new Set<SalesSectionId>(salesSections.map((section) => section.id));

const creatableSectionIds = new Set<SalesSectionId>(["quotes", "orders", "invoices", "delivery-notes", "recurring-invoices"]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const statusOptionsByKind: Record<SalesDocumentKind, Array<{ value: string; label: string }>> = {
  invoice: [
    { value: "draft", label: "Borrador" },
    { value: "open", label: "Abierta" },
    { value: "sent", label: "Enviada" },
    { value: "booked", label: "Contabilizada" },
    { value: "overdue", label: "Vencida" },
    { value: "paid", label: "Pagada" },
    { value: "cancelled", label: "Cancelada" }
  ],
  quote: [
    { value: "draft", label: "Borrador" },
    { value: "open", label: "Abierta" },
    { value: "sent", label: "Enviada" },
    { value: "accepted", label: "Aceptada" },
    { value: "rejected", label: "Rechazada" },
    { value: "cancelled", label: "Cancelada" }
  ],
  order: [
    { value: "draft", label: "Borrador" },
    { value: "open", label: "Abierta" },
    { value: "sent", label: "Enviada" },
    { value: "accepted", label: "Aceptada" },
    { value: "rejected", label: "Rechazada" },
    { value: "cancelled", label: "Cancelada" }
  ],
  "delivery-note": [
    { value: "open", label: "Abierta" },
    { value: "sent", label: "Enviada" },
    { value: "accepted", label: "Aceptada" },
    { value: "cancelled", label: "Cancelada" }
  ],
  "recurring-invoice": [
    { value: "draft", label: "Borrador" },
    { value: "open", label: "Abierta" },
    { value: "cancelled", label: "Cancelada" }
  ]
};

function statusLabel(kind: SalesDocumentKind, dbStatus: string): string {
  return statusOptionsByKind[kind].find((option) => option.value === dbStatus)?.label ?? dbStatus;
}

function statusValueFromLabel(kind: SalesDocumentKind, label: string): string {
  return statusOptionsByKind[kind].find((option) => option.label === label)?.value ?? "draft";
}

function statusPresentation(status: string): StatusPresentation {
  switch (status) {
    case "draft":
      return { className: "status-draft", summary: "Todavia en borrador." };
    case "open":
      return { className: "status-open", summary: "Creado y pendiente de envio." };
    case "sent":
      return { className: "status-sent", summary: "Enviado al cliente." };
    case "accepted":
      return { className: "status-accepted", summary: "Aceptado por el cliente." };
    case "rejected":
      return { className: "status-rejected", summary: "Rechazado por el cliente." };
    case "overdue":
      return { className: "status-overdue", summary: "Vencido sin pagar." };
    case "paid":
      return { className: "status-paid", summary: "Cobrado y cerrado." };
    case "booked":
      return { className: "status-booked", summary: "Contabilizado." };
    case "cancelled":
      return { className: "status-cancelled", summary: "Cancelado y fuera de circuito." };
    default:
      return { className: "status-default", summary: "Estado actualizado." };
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sin registro";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getConfigString(config: Record<string, unknown> | null | undefined, key: string, fallback = ""): string {
  const value = config?.[key];
  return typeof value === "string" ? value : fallback;
}

function getConfigNumber(config: Record<string, unknown> | null | undefined, key: string, fallback: number): number {
  const value = config?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getConfigBoolean(config: Record<string, unknown> | null | undefined, key: string, fallback: boolean): boolean {
  const value = config?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function normalizePaymentRows(value: unknown): QuotesTemplateConfig["pdfPaymentRows"] {
  if (!Array.isArray(value)) return [];

  return value.map((row, index) => {
    const source = row && typeof row === "object" ? row as { id?: unknown; label?: unknown; value?: unknown } : {};

    return {
      id: typeof source.id === "string" && source.id ? source.id : `payment-${index}`,
      label: typeof source.label === "string" ? source.label : "",
      value: typeof source.value === "string" ? source.value : ""
    };
  });
}

function normalizeQuotesTemplateConfig(config: Record<string, unknown> | null, organizationName: string): QuotesTemplateConfig {
  const pdfRows = normalizePaymentRows(config?.pdfPaymentRows);
  const fallbackPayment = getConfigString(config, "paymentDetails").trim();

  return {
    companyName: getConfigString(config, "companyName", organizationName),
    companyTagline: getConfigString(config, "companyTagline"),
    logoDataUrl: getConfigString(config, "logoDataUrl"),
    templateIssuerName: getConfigString(config, "templateIssuerName", getConfigString(config, "companyName", organizationName)),
    templateIssuerTaxId: getConfigString(config, "templateIssuerTaxId"),
    templateIssuerAddress: getConfigString(config, "templateIssuerAddress"),
    templateIssuerCity: getConfigString(config, "templateIssuerCity"),
    templatePaymentRows: normalizePaymentRows(config?.templatePaymentRows),
    templateSectionTitle: getConfigString(config, "templateSectionTitle", "PRESUPUESTO"),
    templateShowQuantity: getConfigBoolean(config, "templateShowQuantity", false),
    quoteFixedNotes: getConfigString(config, "quoteFixedNotes"),
    invoiceFixedNotes: getConfigString(config, "invoiceFixedNotes"),
    quotePrepaymentEnabled: getConfigBoolean(config, "quotePrepaymentEnabled", false),
    quotePrepaymentRate: getConfigNumber(config, "quotePrepaymentRate", 20),
    quotePrepaymentText: getConfigString(
      config,
      "quotePrepaymentText",
      "Para iniciar el desarrollo, será necesario abonar un anticipo del 20% del total:"
    ),
    paymentDetails: fallbackPayment,
    pdfPaymentRows: pdfRows.length > 0
      ? pdfRows
      : fallbackPayment
        ? [{ id: "payment-details", label: "Metodo de pago", value: fallbackPayment }]
        : [],
    accentColor: getConfigString(config, "accentColor", "#0077ff"),
    pageBackgroundColor: getConfigString(config, "pageBackgroundColor", "#fffdf8"),
    clientBoxBackgroundColor: getConfigString(config, "clientBoxBackgroundColor", "#eff7ff")
  };
}

function selectQuotesPrintConfig(
  config: Record<string, unknown> | null,
  format: SalesPrintFormat
): Record<string, unknown> | null {
  const salesTemplateDefaults = format === "template"
    ? { templateSectionTitle: "PRODUCTOS Y SERVICIOS", templateShowQuantity: true }
    : {};
  const profiles = config?.profiles;
  if (!profiles || typeof profiles !== "object") return config ? { ...config, ...salesTemplateDefaults } : salesTemplateDefaults;

  const salesProfiles = (profiles as Record<string, unknown>).sales;
  if (!salesProfiles || typeof salesProfiles !== "object") return config ? { ...config, ...salesTemplateDefaults } : salesTemplateDefaults;

  const profile = (salesProfiles as Record<string, unknown>)[format === "template" ? "template" : "pdf"];
  if (!profile || typeof profile !== "object") return config ? { ...config, ...salesTemplateDefaults } : salesTemplateDefaults;

  return {
    ...config,
    ...salesTemplateDefaults,
    ...(profile as Record<string, unknown>),
  };
}

const newPrintHistoryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function printSourceKind(kind: SalesDocumentKind): SalesPrintSourceKind {
  if (kind === "order") return "order";
  if (kind === "delivery-note") return "delivery-note";
  if (kind === "invoice" || kind === "recurring-invoice") return "invoice";
  return "quote";
}

function salesPrintDocumentLabel(kind: SalesDocumentKind): { singular: string; upper: string; total: string; number: string } {
  if (kind === "order") return { singular: "pedido", upper: "PEDIDO", total: "TOTAL IMPORTE DEL PEDIDO", number: "Nº PEDIDO" };
  if (kind === "delivery-note") return { singular: "albarán", upper: "ALBARÁN", total: "TOTAL IMPORTE DEL ALBARÁN", number: "Nº ALBARÁN" };
  if (kind === "invoice" || kind === "recurring-invoice") return { singular: "factura", upper: "FACTURA", total: "TOTAL IMPORTE FACTURADO", number: "Nº FACTURA" };
  return { singular: "presupuesto", upper: "PRESUPUESTO", total: "TOTAL IMPORTE PRESUPUESTADO", number: "Nº PRESUPUESTO" };
}

function taxableLineAmount(line: SalesQuoteLineDetail): number {
  if (Number.isFinite(line.taxableBase)) return line.taxableBase;

  const raw = line.quantity * line.unitPrice;
  return Math.max(raw - raw * (line.discountRate / 100), 0);
}

function calculateSalesPrintTotals(row: SalesDocumentRow, lines: SalesQuoteLineDetail[]) {
  const subtotal = lines.length > 0
    ? lines.reduce((sum, line) => sum + taxableLineAmount(line), 0)
    : row.baseAvailable ?? row.total;
  const lineTaxAmount = lines.length > 0
    ? lines.reduce((sum, line) => sum + taxableLineAmount(line) * ((line.taxRate ?? 0) / 100), 0)
    : Math.max(row.total - (row.baseAvailable ?? row.total), 0);
  const total = Number.isFinite(row.total) && row.total > 0 ? row.total : subtotal + lineTaxAmount;
  const taxAmount = Math.max(total - subtotal, 0);
  const effectiveTaxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;

  return { subtotal, taxAmount, total, effectiveTaxRate };
}

function formatSalesPrintDate(value: string): string {
  const [day, month, year] = value.split("/");
  const date = day && month && year ? new Date(`${year}-${month}-${day}T00:00:00`) : new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function SalesOrbLogo({ size = 56 }: { size?: number }) {
  return (
    <span className="orb-logo-frame" style={{ width: size, height: size }} aria-hidden="true">
      <svg
        className="orb-logo orb-logo-screen"
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="sales-orb-sphere" cx="40%" cy="32%" r="64%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="18%" stopColor="#9bd1ff" />
            <stop offset="52%" stopColor="#0077ff" />
            <stop offset="100%" stopColor="#004db8" />
          </radialGradient>
          <radialGradient id="sales-orb-shine" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="52%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="orb-logo-halo orb-logo-halo-outer" cx="60" cy="60" r="52" fill="#eaf5ff" />
        <circle className="orb-logo-shadow" cx="61" cy="73" r="27" fill="#004ca8" opacity="0.08" />
        <circle className="orb-logo-sphere" cx="60" cy="60" r="30" fill="url(#sales-orb-sphere)" />
        <circle className="orb-logo-shine" cx="51" cy="48" r="12" fill="url(#sales-orb-shine)" />
        <path
          className="orb-logo-curve"
          d="M35 61c10 8 29 11 50 4"
          stroke="#f6fbff"
          strokeLinecap="round"
          strokeWidth="2"
          opacity="0.34"
        />
      </svg>
    </span>
  );
}

function sectionDocumentKind(sectionId: SalesSectionId): SalesDocumentKind | null {
  if (sectionId === "quotes") return "quote";
  if (sectionId === "orders") return "order";
  if (sectionId === "invoices") return "invoice";
  if (sectionId === "delivery-notes") return "delivery-note";
  if (sectionId === "recurring-invoices") return "recurring-invoice";
  return null;
}

function resolveSalesSectionId(value: string | null): SalesSectionId | null {
  return value && salesSectionIds.has(value as SalesSectionId) ? value as SalesSectionId : null;
}

type SalesWorkspaceProps = {
  clients: ArtificialContactListItem[];
  fiscalEntities: Array<{ id: string; name: string }>;
  organizationId: string;
  organizationName: string;
  initialDocuments?: Record<SalesSectionId, SalesDocumentRow[]>;
  initialConfig?: SalesConfigPayload;
  products?: ProductItem[];
};

export function SalesWorkspace({ clients, fiscalEntities, organizationId, organizationName, initialDocuments, initialConfig, products }: SalesWorkspaceProps) {
  const searchParams = useSearchParams();
  const sectionFromUrl = resolveSalesSectionId(searchParams.get("salesSection"));
  const [activeSectionId, setActiveSectionId] = useState<SalesSectionId>(sectionFromUrl ?? "invoices");
  const [documentsBySection, setDocumentsBySection] = useState<Record<SalesSectionId, SalesDocumentRow[]>>(() => initialDocuments ?? artificialSalesDocuments);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<SalesSettingsPanelId | null>(null);
  const [notice, setNotice] = useState<SalesNotice | null>(null);
  const activeSection = salesSections.find((section) => section.id === activeSectionId) ?? salesSections[0]!;

  useEffect(() => {
    if (sectionFromUrl) {
      setActiveSectionId(sectionFromUrl);
    }
  }, [sectionFromUrl]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return documentsBySection[activeSectionId];
    }

    return documentsBySection[activeSectionId].filter((row) => (
      row.status.toLowerCase().includes(normalizedQuery)
      || row.date.toLowerCase().includes(normalizedQuery)
      || row.number.toLowerCase().includes(normalizedQuery)
      || row.reference.toLowerCase().includes(normalizedQuery)
      || row.clientCode.toLowerCase().includes(normalizedQuery)
      || row.client.toLowerCase().includes(normalizedQuery)
    ));
  }, [activeSectionId, documentsBySection, query]);

  const openSection = (sectionId: SalesSectionId) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("module", "sales");
    nextParams.set("salesSection", sectionId);
    setActiveSectionId(sectionId);
    setIsCreating(false);
    setQuery("");
    setShowFilters(false);
    setShowColumns(false);
    setActiveSettingsPanel(null);
    window.history.pushState(null, "", `/dashboard?${nextParams.toString()}`);
  };

  const openContacts = () => {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("module", "contacts");
    nextParams.delete("salesSection");
    window.history.pushState(null, "", `/dashboard?${nextParams.toString()}`);
    window.location.assign(`/dashboard?${nextParams.toString()}`);
  };

  const activeKind = sectionDocumentKind(activeSectionId);

  const deleteDocument = async (row: SalesDocumentRow) => {
    if (!activeKind || !UUID_PATTERN.test(row.id)) {
      setNotice({ tone: "warning", text: "Este documento no esta conectado al modelo real y no se puede eliminar." });
      return;
    }

    const result = await softDeleteSalesDocument(activeKind, row.id);

    if (result.error) {
      setNotice({ tone: "warning", text: `No se pudo eliminar: ${result.error}` });
      return;
    }

    setDocumentsBySection((current) => ({
      ...current,
      [activeSectionId]: current[activeSectionId].filter((item) => item.id !== row.id)
    }));
    setNotice({ tone: "success", text: `${activeSection.singularTitle} ${row.number} eliminado.` });
  };

  const duplicateDocument = async (row: SalesDocumentRow) => {
    if (!activeKind || !UUID_PATTERN.test(row.id)) {
      setNotice({ tone: "warning", text: "Este documento no esta conectado al modelo real y no se puede duplicar." });
      return;
    }

    const result = await duplicateSalesDocument(activeKind, row.id);

    if (result.error || !result.document) {
      setNotice({ tone: "warning", text: `No se pudo duplicar: ${result.error ?? "error desconocido"}` });
      return;
    }

    const copy: SalesDocumentRow = {
      id: result.document.id,
      status: statusLabel(activeKind, result.document.status),
      date: result.document.date ? new Date(result.document.date).toLocaleDateString("es-ES") : row.date,
      number: result.document.number,
      reference: row.reference,
      clientCode: row.clientCode,
      client: result.document.client,
      total: result.document.total
    };

    setDocumentsBySection((current) => ({
      ...current,
      [activeSectionId]: [copy, ...current[activeSectionId]]
    }));
    setNotice({ tone: "success", text: `Duplicado creado como ${result.document.number}.` });
  };

  const updateDocumentStatus = async (rowId: string, dbStatus: string, options?: { notes?: string; isPaid?: boolean }) => {
    if (!activeKind || !UUID_PATTERN.test(rowId)) {
      setNotice({ tone: "warning", text: "Este documento no esta conectado al modelo real y no se puede actualizar." });
      return;
    }

    const result = await updateSalesDocumentStatus(activeKind, rowId, dbStatus, options);

    if (result.error) {
      setNotice({ tone: "warning", text: `No se pudo actualizar el estado: ${result.error}` });
      return;
    }

    const label = statusLabel(activeKind, dbStatus);

    setDocumentsBySection((current) => ({
      ...current,
      [activeSectionId]: current[activeSectionId].map((row) => (
        row.id === rowId ? { ...row, status: label } : row
      ))
    }));
    setNotice({ tone: "success", text: `Estado actualizado a ${label}.` });
    return result;
  };

  return (
    <section className="sales-module-shell sections-collapsed" aria-label="Modulo de ventas">
      <div className="sales-operation-surface">
        {isCreating ? (
          <QuoteForm
            clients={clients}
            fiscalEntities={fiscalEntities}
            organizationId={organizationId}
            products={products ?? []}
            section={activeSection}
            onCancel={() => setIsCreating(false)}
            onCreated={(document) => {
              setDocumentsBySection((current) => ({
                ...current,
                [activeSectionId]: [document, ...current[activeSectionId]]
              }));
              setIsCreating(false);
              setNotice({ tone: "success", text: `${activeSection.singularTitle} ${document.number} creado.` });
            }}
            onPersistenceError={(message) => {
              setNotice({ tone: "warning", text: `${activeSection.singularTitle} creado en la vista, pero no se pudo guardar: ${message}` });
            }}
          />
        ) : (
          <DocumentList
            activeSection={activeSection}
            activeSectionId={activeSectionId}
            activeKind={activeKind}
            config={initialConfig ?? {}}
            organizationId={organizationId}
            organizationName={organizationName}
            rows={rows}
            sections={salesSections}
            query={query}
            showColumns={showColumns}
            showFilters={showFilters}
            showSettings={showSettings}
            activeSettingsPanel={activeSettingsPanel}
            notice={notice}
            onHeroAction={(kind) => {
              if (kind === "create") {
                if (creatableSectionIds.has(activeSectionId)) {
                  setIsCreating(true);
                } else {
                  setNotice({
                    tone: "warning",
                    text: `La creacion de ${activeSection.label.toLowerCase()} aun no esta conectada al modelo real. Disponible proximamente.`
                  });
                }
                return;
              }

              if (kind === "contacts") {
                openContacts();
                return;
              }

              openSection(kind);
            }}
            onDeleteDocument={deleteDocument}
            onDuplicateDocument={duplicateDocument}
            onQueryChange={setQuery}
            onSectionChange={openSection}
            onShowNotice={setNotice}
            onSettingsPanelChange={setActiveSettingsPanel}
            onToggleColumns={() => setShowColumns((current) => !current)}
            onToggleFilters={() => setShowFilters((current) => !current)}
            onToggleSettings={() => setShowSettings((current) => !current)}
            onUpdateDocumentStatus={updateDocumentStatus}
          />
        )}
      </div>
    </section>
  );
}

function DocumentList({
  activeSection,
  activeSectionId,
  activeKind,
  config,
  organizationId,
  activeSettingsPanel,
  notice,
  organizationName,
  rows,
  sections,
  query,
  showColumns,
  showFilters,
  showSettings,
  onHeroAction,
  onDeleteDocument,
  onDuplicateDocument,
  onQueryChange,
  onSectionChange,
  onSettingsPanelChange,
  onShowNotice,
  onToggleColumns,
  onToggleFilters,
  onToggleSettings,
  onUpdateDocumentStatus
}: {
  activeSection: SalesSection;
  activeSectionId: SalesSectionId;
  activeKind: SalesDocumentKind | null;
  config: SalesConfigPayload;
  organizationId: string;
  activeSettingsPanel: SalesSettingsPanelId | null;
  notice: SalesNotice | null;
  organizationName: string;
  rows: SalesDocumentRow[];
  sections: SalesSection[];
  query: string;
  showColumns: boolean;
  showFilters: boolean;
  showSettings: boolean;
  onHeroAction: (kind: SalesSection["hero"]["actions"][number]["kind"]) => void;
  onDeleteDocument: (row: SalesDocumentRow) => void;
  onDuplicateDocument: (row: SalesDocumentRow) => void;
  onQueryChange: (value: string) => void;
  onSectionChange: (sectionId: SalesSectionId) => void;
  onSettingsPanelChange: (panel: SalesSettingsPanelId | null) => void;
  onShowNotice: (notice: SalesNotice | null) => void;
  onToggleColumns: () => void;
  onToggleFilters: () => void;
  onToggleSettings: () => void;
  onUpdateDocumentStatus: (rowId: string, dbStatus: string, options?: { notes?: string; isPaid?: boolean }) => Promise<{ error?: string } | undefined>;
}) {
  const [selectedRow, setSelectedRow] = useState<SalesDocumentRow | null>(null);
  const [rowPendingDelete, setRowPendingDelete] = useState<SalesDocumentRow | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<SalesColumnId[]>([]);
  const totalAmount = rows.reduce((sum, row) => sum + row.total, 0);
  const statusOptions = Array.from(new Set(rows.map((row) => row.status))).sort();
  const clientOptions = Array.from(new Set(rows.map((row) => row.client).filter(Boolean))).sort();
  const visibleRows = rows.filter((row) => (
    (statusFilter === "" || row.status === statusFilter)
    && (clientFilter === "" || row.client === clientFilter)
  ));
  const columns: Array<{ id: SalesColumnId; label: string }> = activeSectionId === "quotes" ? [
    { id: "status", label: "Estado" },
    { id: "date", label: activeSection.tableHeaders.date },
    { id: "number", label: activeSection.tableHeaders.number },
    { id: "reference", label: activeSection.tableHeaders.reference ?? "Referencia" },
    { id: "clientCode", label: activeSection.tableHeaders.clientCode },
    { id: "client", label: activeSection.tableHeaders.client },
    { id: "total", label: activeSection.tableHeaders.total },
    { id: "baseAvailable", label: activeSection.tableHeaders.baseAvailable ?? "Base imponible" }
  ] : [
    { id: "status", label: "Estado" },
    { id: "date", label: activeSection.tableHeaders.date },
    { id: "number", label: activeSection.tableHeaders.number },
    { id: "client", label: activeSection.tableHeaders.client },
    { id: "clientCode", label: activeSection.tableHeaders.clientCode },
    { id: "total", label: activeSection.tableHeaders.total }
  ];
  const isColumnVisible = (id: SalesColumnId) => !hiddenColumns.includes(id);
  const visibleColumnCount = columns.filter((column) => isColumnVisible(column.id)).length + 1;
  const toggleColumn = (id: SalesColumnId) => {
    setHiddenColumns((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };
  const openSettingsPanel = (panel: SalesSettingsPanelId) => {
    onSettingsPanelChange(panel);
    setSelectedRow(null);
    setRowPendingDelete(null);
    onToggleSettings();
  };

  return (
    <>
      <header className="sales-operation-header">
        <div className="sales-operation-title">
          <SalesSectionTabs
            activeSectionId={activeSectionId}
            onSectionChange={onSectionChange}
            sections={sections}
          />
        </div>
        <div className="sales-settings-menu">
          <button className="sales-settings-button" onClick={onToggleSettings} type="button">
            <Settings aria-hidden="true" size={27} fill="currentColor" />
            <span>Configuracion</span>
            <ChevronDown aria-hidden="true" size={15} />
          </button>
          {showSettings ? (
            <div className="sales-popover settings-popover" role="menu">
              <button onClick={() => openSettingsPanel("numbering")} type="button">
                <FileCog aria-hidden="true" size={18} />
                Numeracion de ventas
              </button>
              <button onClick={() => openSettingsPanel("payments")} type="button">
                <CreditCard aria-hidden="true" size={18} />
                Condiciones de pago
              </button>
              <button onClick={() => openSettingsPanel("preferences")} type="button">
                <Mail aria-hidden="true" size={18} />
                Preferencias de {organizationName}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {notice ? (
        <div className={`sales-live-notice ${notice.tone}`} role="status">
          {notice.tone === "success" ? <CheckCircle2 aria-hidden="true" size={18} /> : <AlertTriangle aria-hidden="true" size={18} />}
          <span>{notice.text}</span>
          <button onClick={() => onShowNotice(null)} type="button" aria-label="Cerrar aviso">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}

      {activeSettingsPanel ? (
        <SalesSettingsPanel
          activePanel={activeSettingsPanel}
          activeSection={activeSection}
          config={config}
          organizationId={organizationId}
          organizationName={organizationName}
          onClose={() => onSettingsPanelChange(null)}
          onError={(message) => onShowNotice({ tone: "warning", text: message })}
          onSave={(message) => {
            onSettingsPanelChange(null);
            onShowNotice({ tone: "success", text: message });
          }}
        />
      ) : null}

      <SalesHero activeSection={activeSection} onAction={onHeroAction} />
      <SalesMetricGrid activeSection={activeSection} rows={rows} totalAmount={totalAmount} />

      <div className="sales-list-toolbar">
        <span aria-hidden="true" />
        <div className="sales-toolbar-actions">
          <label className="sales-search-control">
            <Search aria-hidden="true" size={25} />
            <input
              aria-label={activeSection.searchLabel}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar..."
              type="search"
              value={query}
            />
          </label>
          <button className="sage-outline-button" onClick={onToggleFilters} type="button">
            <Filter aria-hidden="true" size={20} fill="currentColor" />
            Filtrar
          </button>
          <button className="sage-outline-button" onClick={onToggleColumns} type="button">
            Personalizar
            <ChevronDown aria-hidden="true" size={15} />
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="sales-filter-strip">
          <span>Filtros activos</span>
          <label className="sales-filter-select">
            Estado
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="sales-filter-select">
            Cliente
            <select onChange={(event) => setClientFilter(event.target.value)} value={clientFilter}>
              <option value="">Todos</option>
              {clientOptions.map((clientName) => (
                <option key={clientName} value={clientName}>{clientName}</option>
              ))}
            </select>
          </label>
          {statusFilter !== "" || clientFilter !== "" ? (
            <button onClick={() => { setStatusFilter(""); setClientFilter(""); }} type="button">
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : null}

      {showColumns ? (
        <div className="sales-filter-strip columns-strip">
          <span>Columnas visibles</span>
          {columns.map((column) => (
            <label key={column.id}>
              <input
                checked={isColumnVisible(column.id)}
                onChange={() => toggleColumn(column.id)}
                type="checkbox"
              />
              {column.label}
            </label>
          ))}
        </div>
      ) : null}

      <section className="sage-list-panel sales-template-table-panel" aria-label={activeSection.title}>
        <div className="sales-template-table-head">
          <div>
            <h2>{activeSection.title}</h2>
            {activeSection.tableDescription ? <p>{activeSection.tableDescription}</p> : null}
          </div>
        </div>
        <div className="sales-document-table-wrap">
          <table className="sales-document-table">
            <thead>
              <tr>
                {columns.filter((column) => isColumnVisible(column.id)).map((column) => (
                  <th key={column.id}>{column.label}</th>
                ))}
                <th>{activeSectionId === "quotes" ? "Editar" : "Acciones"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length > 0 ? visibleRows.flatMap((row) => {
                const kind = activeKind ?? "quote";
                const presentation = statusPresentation(statusValueFromLabel(kind, row.status));
                const visibleColumns = columns.filter((column) => isColumnVisible(column.id));

                return [
                  (
                    <tr key={`${row.id}-${row.status}`}>
                      {visibleColumns.map((column) => {
                        switch (column.id) {
                          case "status":
                            return <td key={column.id}><span className={`closed-badge ${presentation.className}`}>{row.status}</span></td>;
                          case "date":
                            return <td key={column.id}>{row.date}</td>;
                          case "number":
                            return <td key={column.id}>{row.number}</td>;
                          case "reference":
                            return <td key={column.id}>{row.reference}</td>;
                          case "clientCode":
                            return <td key={column.id}>{row.clientCode}</td>;
                          case "client":
                            return <td key={column.id}>{row.client}</td>;
                          case "total":
                            return <td key={column.id}>{formatMoney(row.total)}</td>;
                          case "baseAvailable":
                            return <td key={column.id}>{formatMoney(row.baseAvailable ?? 0)}</td>;
                        }
                      })}
                      <td className="sales-row-actions-cell">
                        <button
                          className="sage-table-button"
                          onClick={() => {
                            setSelectedRow(selectedRow?.id === row.id ? null : row);
                            setRowPendingDelete(null);
                            onSettingsPanelChange(null);
                          }}
                          type="button"
                          aria-label={`Abrir acciones de ${row.number}`}
                        >
                          <MoreVertical aria-hidden="true" size={22} />
                        </button>
                      </td>
                    </tr>
                  ),
                  selectedRow?.id === row.id ? (
                    <tr className="sales-detail-row" key={`${row.id}-detail`}>
                      <td colSpan={visibleColumnCount}>
                        <SalesDocumentPanel
                          activeSection={activeSection}
                          kind={kind}
                          organizationId={organizationId}
                          organizationName={organizationName}
                          row={selectedRow}
                          onClose={() => setSelectedRow(null)}
                          onDelete={() => {
                            setRowPendingDelete(selectedRow);
                            setSelectedRow(null);
                          }}
                          onDuplicate={() => {
                            onDuplicateDocument(selectedRow);
                            setSelectedRow(null);
                          }}
                          onSave={async (dbStatus, notes, isPaid) => {
                            const result = await onUpdateDocumentStatus(selectedRow.id, dbStatus, { notes, isPaid });

                            if (result?.error) {
                              onShowNotice({ tone: "warning", text: `No se pudo actualizar el estado: ${result.error}` });
                              return;
                            }

                            setSelectedRow(null);
                          }}
                        />
                      </td>
                    </tr>
                  ) : null
                ];
              }) : (
                <tr>
                  <td colSpan={visibleColumnCount}>
                    <div className="sales-empty-list">
                      <FileText aria-hidden="true" size={64} />
                      <strong>{activeSection.emptyTitle}</strong>
                      <p>{activeSection.emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={visibleColumnCount}>Elementos: {visibleRows.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {rowPendingDelete ? (
        <DeleteDocumentPanel
          activeSection={activeSection}
          row={rowPendingDelete}
          onCancel={() => setRowPendingDelete(null)}
          onConfirm={() => {
            onDeleteDocument(rowPendingDelete);
            setRowPendingDelete(null);
          }}
        />
      ) : null}
    </>
  );
}

function SalesHero({
  activeSection,
  onAction
}: {
  activeSection: SalesSection;
  onAction: (kind: SalesSection["hero"]["actions"][number]["kind"]) => void;
}) {
  return (
    <section className="sales-template-hero" aria-label={activeSection.title}>
      <div>
        {activeSection.hero.eyebrow ? <span>{activeSection.hero.eyebrow}</span> : null}
        <h1>{activeSection.hero.title}</h1>
        {activeSection.hero.description ? <p>{activeSection.hero.description}</p> : null}
      </div>
      <div className="sales-template-hero-actions">
        {activeSection.hero.actions.map((action) => (
          <button key={action.label} onClick={() => onAction(action.kind)} type="button">{action.label}</button>
        ))}
      </div>
    </section>
  );
}

function SalesMetricGrid({
  activeSection,
  rows,
  totalAmount
}: {
  activeSection: SalesSection;
  rows: SalesDocumentRow[];
  totalAmount: number;
}) {
  const count = rows.length;
  const pendingCount = rows.filter((row) => /pendiente|vencida|preparacion|borrador|facturable/i.test(row.status)).length;
  const values = activeSection.metrics.map((metric, index) => ({
    ...metric,
    value: metric.type === "amount" ? formatMoney(totalAmount) : String(index === 1 ? pendingCount : count)
  }));

  return (
    <section className="sales-template-metrics" aria-label={`Resumen de ${activeSection.label.toLowerCase()}`}>
      {values.map((metric) => (
        <article className="sales-template-metric" key={metric.label}>
          <span className={`sales-template-metric-icon ${metric.tone}`}>
            <BarChart3 aria-hidden="true" size={20} strokeWidth={2.3} />
          </span>
          <strong>{metric.value}</strong>
          <h2>{metric.label}</h2>
          {metric.description ? <p>{metric.description}</p> : null}
        </article>
      ))}
    </section>
  );
}

function SalesSectionTabs({
  activeSectionId,
  onSectionChange,
  sections
}: {
  activeSectionId: SalesSectionId;
  onSectionChange: (sectionId: SalesSectionId) => void;
  sections: SalesSection[];
}) {
  return (
    <div className="fiscal-tabs sales-section-tabs" role="tablist" aria-label="Subsecciones de ventas">
      {sections.map((section) => (
        <button
          className={`tab${section.id === activeSectionId ? " active" : ""}`}
          key={section.id}
          onClick={() => onSectionChange(section.id)}
          role="tab"
          type="button"
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

function SalesSettingsPanel({
  activePanel,
  activeSection,
  config,
  organizationId,
  organizationName,
  onClose,
  onError,
  onSave
}: {
  activePanel: SalesSettingsPanelId;
  activeSection: SalesSection;
  config: SalesConfigPayload;
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onError: (message: string) => void;
  onSave: (message: string) => void;
}) {
  const panelTitle = {
    numbering: "Numeracion de ventas",
    payments: "Condiciones de pago",
    preferences: `Preferencias de ${organizationName}`
  }[activePanel];
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (activePanel === "numbering") {
      return {
        series: config.numbering?.series ?? "VENTA-2026",
        nextNumber: config.numbering?.nextNumber ?? "",
        format: config.numbering?.format ?? "",
        reset: config.numbering?.reset ?? "Anual"
      };
    }

    if (activePanel === "payments") {
      return {
        term: config.payments?.term ?? "30 dias",
        method: config.payments?.method ?? "Transferencia",
        bankAccount: config.payments?.bankAccount ?? "",
        reminder: config.payments?.reminder ?? "3 dias antes"
      };
    }

    return {
      email: config.preferences?.email ?? "",
      pdfTemplate: config.preferences?.pdfTemplate ?? "Profesional",
      message: config.preferences?.message ?? ""
    };
  });

  const setValue = (key: string) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveSalesConfigSection(organizationId, activePanel, values);

    setIsSaving(false);

    if (result.error) {
      onError(`No se pudo guardar la configuracion: ${result.error}`);
      return;
    }

    onSave(`${panelTitle} guardado.`);
  };

  return (
    <section className="sales-action-panel settings-detail-panel" aria-label={panelTitle}>
      <header>
        <div>
          {activePanel === "numbering" ? <FileCog aria-hidden="true" size={22} /> : null}
          {activePanel === "payments" ? <CreditCard aria-hidden="true" size={22} /> : null}
          {activePanel === "preferences" ? <Mail aria-hidden="true" size={22} /> : null}
          <h2>{panelTitle}</h2>
        </div>
        <button className="panel-icon-button" onClick={onClose} type="button" aria-label="Cerrar panel">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      {activePanel === "numbering" ? (
        <div className="settings-panel-grid">
          <label className="sage-field">
            <span>Serie activa</span>
            <select value={values.series} onChange={setValue("series")}>
              {[...new Set([values.series, activeSection.id.toUpperCase(), "VENTA-2026", "RECT-2026"])].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="sage-field">
            <span>Siguiente numero</span>
            <input value={values.nextNumber} onChange={setValue("nextNumber")} />
          </label>
          <label className="sage-field">
            <span>Formato visible</span>
            <input value={values.format} onChange={setValue("format")} placeholder={`${activeSection.label.slice(0, 3).toUpperCase()}-2026-0001`} />
          </label>
          <label className="sage-field">
            <span>Reinicio</span>
            <select value={values.reset} onChange={setValue("reset")}>
              <option>Anual</option>
              <option>Mensual</option>
              <option>Nunca</option>
            </select>
          </label>
        </div>
      ) : null}

      {activePanel === "payments" ? (
        <div className="settings-panel-grid">
          <label className="sage-field">
            <span>Condicion por defecto</span>
            <select value={values.term} onChange={setValue("term")}>
              <option>Contado</option>
              <option>15 dias</option>
              <option>30 dias</option>
              <option>60 dias</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Metodo preferido</span>
            <select value={values.method} onChange={setValue("method")}>
              <option>Transferencia</option>
              <option>Domiciliacion</option>
              <option>Tarjeta</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Cuenta bancaria</span>
            <input value={values.bankAccount} onChange={setValue("bankAccount")} placeholder="ES00 0000 0000 0000 0000 0000" />
          </label>
          <label className="sage-field">
            <span>Recordatorio</span>
            <select value={values.reminder} onChange={setValue("reminder")}>
              <option>Sin recordatorio</option>
              <option>3 dias antes</option>
              <option>En vencimiento</option>
            </select>
          </label>
        </div>
      ) : null}

      {activePanel === "preferences" ? (
        <div className="settings-panel-grid">
          <label className="sage-field">
            <span>Email de envio</span>
            <input value={values.email} onChange={setValue("email")} type="email" />
          </label>
          <label className="sage-field">
            <span>Plantilla PDF</span>
            <select value={values.pdfTemplate} onChange={setValue("pdfTemplate")}>
              <option>Profesional</option>
              <option>Compacta</option>
              <option>Detallada</option>
            </select>
          </label>
          <label className="sage-field span-2">
            <span>Mensaje por defecto</span>
            <input value={values.message} onChange={setValue("message")} placeholder={`Adjuntamos ${activeSection.singularTitle.toLowerCase()} para su revision.`} />
          </label>
        </div>
      ) : null}

      <footer>
        <button className="sage-outline-button" onClick={onClose} type="button">Cancelar</button>
        <button className="sage-primary-button" disabled={isSaving} onClick={handleSave} type="button">
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </button>
      </footer>
    </section>
  );
}

function SalesDocumentPanel({
  activeSection,
  kind,
  organizationId,
  organizationName,
  row,
  onClose,
  onDelete,
  onDuplicate,
  onSave
}: {
  activeSection: SalesSection;
  kind: SalesDocumentKind;
  organizationId: string;
  organizationName: string;
  row: SalesDocumentRow;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSave: (dbStatus: string, notes: string, isPaid: boolean) => void;
}) {
  const [statusValue, setStatusValue] = useState(() => statusValueFromLabel(kind, row.status));
  const [documentTitle, setDocumentTitle] = useState(`${activeSection.singularTitle} ${row.number}`);
  const [notes, setNotes] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [detail, setDetail] = useState<SalesDocumentStatusDetail | null>(null);
  const [activeTab, setActiveTab] = useState<SalesDocumentDetailTab>("products");
  const [quoteLines, setQuoteLines] = useState<SalesQuoteLineDetail[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isLoadingLines, setIsLoadingLines] = useState(kind === "quote");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<SalesPrintFormat | null>(null);
  const [printConfig, setPrintConfig] = useState<QuotesTemplateConfig | null>(null);
  const [printConfigFormat, setPrintConfigFormat] = useState<SalesPrintFormat | null>(null);
  const [isLoadingPrintConfig, setIsLoadingPrintConfig] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  useEffect(() => {
    let isMounted = true;
    setIsLoadingDetail(true);

    void getSalesDocumentStatusDetail(kind, row.id).then((result) => {
      if (!isMounted) return;
      setDetail(result.detail ?? null);
      setNotes(result.detail?.notes ?? "");
      setIsPaid(Boolean(result.detail?.isPaid));
      setIsLoadingDetail(false);
    });

    return () => {
      isMounted = false;
    };
  }, [kind, row.id]);

  const openPrintPreview = async (format: SalesPrintFormat) => {
    setPrintFormat(format);
    setPrintError(null);

    if (printConfig && printConfigFormat === format) return;

    setIsLoadingPrintConfig(true);

    try {
      const initialData = await loadQuotesInitialData(organizationId);
      setPrintConfig(normalizeQuotesTemplateConfig(selectQuotesPrintConfig(initialData.config, format), organizationName));
      setPrintConfigFormat(format);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : "No se pudo cargar la plantilla de Presupuestos.");
      setPrintConfig(normalizeQuotesTemplateConfig(null, organizationName));
      setPrintConfigFormat(format);
    } finally {
      setIsLoadingPrintConfig(false);
    }
  };

  const openTemplatePrintPreview = () => {
    setIsPrintDialogOpen(true);
    void openPrintPreview("template");
  };

  const saveTemplatePrintHistory = async () => {
    const now = new Date().toISOString();
    const sourceKind = printSourceKind(kind);
    const documentType = sourceKind === "invoice" ? "pdfInvoice" : "pdfQuote";
    const displayLines = printableLines(row, quoteLines);
    const historyId = `sales-print-${kind}-${row.id}-${newPrintHistoryId()}`;

    await upsertQuoteDocument(organizationId, {
      id: historyId,
      document_type: documentType,
      quote_number: row.number,
      client_name: row.client || null,
      date: row.date || null,
      due_date: row.date || null,
      total_amount: row.total,
      payload: {
        id: historyId,
        documentType,
        templateScope: "sales",
        sourceKind,
        createdAt: now,
        updatedAt: now,
        quoteNumber: row.number,
        date: row.date,
        dueDate: row.date,
        clientName: row.client,
        clientDetails: [row.clientCode, row.clientEmail, row.clientPhone, row.clientCountry].filter(Boolean).join("\n"),
        items: displayLines.map((line) => ({
          id: line.id,
          serviceType: line.productOrService || row.reference || row.number,
          description: line.description,
          hours: line.quantity || 1,
          hourlyRate: line.unitPrice || 0,
          manualAmountEnabled: true,
          manualAmount: taxableLineAmount(line),
        })),
        taxEnabled: true,
        taxRate: 21,
        discountRate: 0,
        discountAmount: 0,
        notes: "",
        noteItems: [],
        pdfFields: {
          issuerName: "",
          issuerTaxId: "",
          issuerAddress: "",
          issuerCity: "",
          paymentMethod: "",
          iban: "",
          paymentRows: [],
          suplido: 0,
        },
        taxItems: [],
      },
    });
  };

  const printTemplateDocument = () => {
    void saveTemplatePrintHistory().finally(() => window.print());
  };

  useEffect(() => {
    if (kind !== "quote") {
      setQuoteLines([]);
      setIsLoadingLines(false);
      return;
    }

    let isMounted = true;
    setIsLoadingLines(true);

    void getSalesQuoteLineDetails(row.id).then((result) => {
      if (!isMounted) return;
      setQuoteLines(result.lines ?? []);
      setIsLoadingLines(false);
    });

    return () => {
      isMounted = false;
    };
  }, [kind, row.id]);

  return (
    <section className="sales-action-panel document-detail-panel inline-document-detail-panel" aria-label={`Editar ${row.number}`}>
      <DocumentHeaderSummary
        detail={detail}
        documentTitle={documentTitle}
        isPaid={isPaid}
        kind={kind}
        onClose={onClose}
        onPaidChange={setIsPaid}
        onStatusChange={setStatusValue}
        onTitleChange={setDocumentTitle}
        row={row}
        statusValue={statusValue}
      />

      <div className="document-detail-tabs" role="tablist" aria-label="Detalle del documento">
        <DocumentDetailTab activeTab={activeTab} id="products" label="Productos y servicios" onSelect={setActiveTab} />
        <DocumentDetailTab activeTab={activeTab} id="totals" label="Totales y descuentos" onSelect={setActiveTab} />
        <DocumentDetailTab activeTab={activeTab} id="notes" label="Notas" onSelect={setActiveTab} />
        <DocumentDetailTab activeTab={activeTab} id="client" label="Informacion de cliente" onSelect={setActiveTab} />
      </div>

      <section className="document-detail-tab-panel">
        {activeTab === "products" ? (
          <QuoteLinesTable isLoading={isLoadingLines} lines={quoteLines} row={row} />
        ) : null}
        {activeTab === "totals" ? <DocumentTotalsPanel row={row} /> : null}
        {activeTab === "notes" ? (
          <label className="sage-textarea-field compact-sales-notes detail-tab-notes">
            <span>Notas</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              placeholder={isLoadingDetail ? "Cargando historial..." : "Anade contexto para este estado"}
              rows={4}
              value={notes}
            />
          </label>
        ) : null}
        {activeTab === "client" ? <DocumentClientPanel row={row} /> : null}
      </section>

      <div className="document-action-strip">
        <button className="sage-outline-button" onClick={openTemplatePrintPreview} type="button">
          <FileText aria-hidden="true" size={18} />
          Imprimir
        </button>
        <button className="sage-outline-button" onClick={onDuplicate} type="button">
          <Copy aria-hidden="true" size={18} />
          Duplicar
        </button>
        <button className="sage-danger-button" onClick={onDelete} type="button">
          <Trash2 aria-hidden="true" size={18} />
          Eliminar
        </button>
        <button className="sage-primary-button" onClick={() => onSave(statusValue, notes, isPaid)} type="button">
          Guardar cambios
        </button>
      </div>

      <SalesPrintDialog
        config={printConfig}
        format={printFormat}
        isOpen={isPrintDialogOpen}
        isLoadingConfig={isLoadingPrintConfig}
        kind={kind}
        lines={quoteLines}
        loadError={printError}
        onClose={() => {
          setIsPrintDialogOpen(false);
          setPrintFormat(null);
        }}
        onPrint={printTemplateDocument}
        row={row}
      />
    </section>
  );
}

function SalesPrintDialog({
  config,
  format,
  isLoadingConfig,
  isOpen,
  kind,
  lines,
  loadError,
  onClose,
  onPrint,
  row
}: {
  config: QuotesTemplateConfig | null;
  format: SalesPrintFormat | null;
  isLoadingConfig: boolean;
  isOpen: boolean;
  kind: SalesDocumentKind;
  lines: SalesQuoteLineDetail[];
  loadError: string | null;
  onClose: () => void;
  onPrint: () => void;
  row: SalesDocumentRow;
}) {
  const [previewScale, setPreviewScale] = useState(0.62);
  const previewPanelRef = useRef<HTMLElement | null>(null);
  const documentLabel = salesPrintDocumentLabel(kind);
  const title = `Imprimir ${documentLabel.singular} ${row.number}`;
  const canPrint = Boolean(format && config && !isLoadingConfig);

  useEffect(() => {
    if (!isOpen) return;
    const previewPanel = previewPanelRef.current;
    if (!previewPanel) return;

    const updateScale = () => {
      const rect = previewPanel.getBoundingClientRect();
      const nextScale = Math.min(
        Math.max((rect.width - 20) / 794, 0.34),
        Math.max((rect.height - 20) / 1123, 0.34),
        1,
      );
      setPreviewScale(Number(nextScale.toFixed(3)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(previewPanel);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [config, format, isOpen]);

  if (!isOpen) return null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="sales-print-modal-backdrop" role="presentation">
      <section className="sales-print-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sales-print-dialog-chrome sales-print-modal-header">
          <h2>{row.number}</h2>
          <button className="panel-icon-button" onClick={onClose} type="button" aria-label="Cerrar impresion">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {loadError ? <p className="sales-print-dialog-chrome sales-print-warning">{loadError}</p> : null}
        {isLoadingConfig ? <p className="sales-print-dialog-chrome sales-print-loading">Cargando plantilla guardada...</p> : null}

        {format && config ? (
          <div
            className="quotes-shell sales-print-preview-shell"
            style={{ "--sales-print-preview-scale": previewScale } as CSSProperties}
          >
            <section
              ref={previewPanelRef}
              className="preview-panel"
              aria-label="Vista previa de impresion"
            >
              <div className="sales-print-printable">
                <SalesPrintableDocument config={config} format={format} kind={kind} lines={lines} row={row} />
              </div>
            </section>
          </div>
        ) : (
          <div className="sales-print-dialog-chrome sales-print-empty-state">
            <FileText aria-hidden="true" size={34} />
            <p>Preparando la plantilla de venta guardada.</p>
          </div>
        )}

        <footer className="sales-print-dialog-chrome sales-print-actions">
          <button className="sage-outline-button" onClick={onClose} type="button">Cancelar</button>
          <button className="sage-primary-button" disabled={!canPrint} onClick={onPrint} type="button">
            Imprimir ahora
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function SalesPrintableDocument({
  config,
  format,
  kind,
  lines,
  row
}: {
  config: QuotesTemplateConfig;
  format: SalesPrintFormat;
  kind: SalesDocumentKind;
  lines: SalesQuoteLineDetail[];
  row: SalesDocumentRow;
}) {
  if (format === "template") {
    return <SalesTemplateDocument config={config} kind={kind} lines={lines} row={row} />;
  }

  return <SalesPdfDocument config={config} kind={kind} lines={lines} row={row} />;
}

function printableLines(row: SalesDocumentRow, lines: SalesQuoteLineDetail[]): SalesQuoteLineDetail[] {
  if (lines.length > 0) return lines;

  return [{
    id: `${row.id}-print-summary`,
    productOrService: row.reference || row.number,
    description: "",
    quantity: 1,
    unitPrice: row.baseAvailable ?? row.total,
    discountRate: 0,
    taxableBase: row.baseAvailable ?? row.total,
    taxRate: null,
    status: "Completa"
  }];
}

function SalesPdfDocument({
  config,
  kind,
  lines,
  row
}: {
  config: QuotesTemplateConfig;
  kind: SalesDocumentKind;
  lines: SalesQuoteLineDetail[];
  row: SalesDocumentRow;
}) {
  const displayLines = printableLines(row, lines);
  const totals = calculateSalesPrintTotals(row, displayLines);
  const isInvoice = kind === "invoice" || kind === "recurring-invoice";
  const documentLabel = salesPrintDocumentLabel(kind);
  const fixedNotes = (isInvoice ? config.invoiceFixedNotes : config.quoteFixedNotes).trim();
  const prepaymentAmount = formatMoney(totals.total * (config.quotePrepaymentRate / 100));
  const prepaymentNote = !isInvoice && config.quotePrepaymentEnabled
    ? `${config.quotePrepaymentText} ${prepaymentAmount}`
    : "";
  const style = {
    "--document-accent-color": config.accentColor,
    "--document-page-bg": config.pageBackgroundColor,
    "--document-client-box-bg": config.clientBoxBackgroundColor
  } as CSSProperties;

  return (
    <article className={`quote-page ${isInvoice ? "is-invoice" : "is-quote"}`} style={style}>
      <header className="quote-header">
        <div className="quote-header-left">
          <div className="orb-lockup">
            {config.logoDataUrl ? <img className="brand-logo-image" src={config.logoDataUrl} alt="" /> : <SalesOrbLogo size={56} />}
            <div className="orb-lockup-text">
              <p className="quote-kicker">{documentLabel.upper}</p>
              <h2>{config.companyName || "Tu empresa"}</h2>
              {config.companyTagline.trim() ? <span className="orb-lockup-tagline">{config.companyTagline}</span> : null}
            </div>
          </div>
        </div>
        <div className="quote-meta">
          <span>{row.number}</span>
          <span>{formatSalesPrintDate(row.date)}</span>
          {row.reference.trim() ? <span>{row.reference}</span> : null}
        </div>
      </header>

      <section className="client-strip">
        <div>
          <span>Cliente</span>
          <strong>{row.client || "Nombre del cliente"}</strong>
        </div>
        <p>{[row.clientCode, row.clientEmail, row.clientPhone, row.clientCountry].filter(Boolean).join("\n") || "Datos del cliente"}</p>
      </section>

      <section className="quote-section">
        <div className="quote-table">
          <div className="quote-table-row quote-table-head">
            <span>{isInvoice ? "Concepto" : "Servicio"}</span>
            <span>Horas</span>
            <span>Tarifa</span>
            <span>Importe</span>
          </div>
          {displayLines.map((line) => (
            <div className="quote-table-row" key={line.id}>
              <div>
                <strong>{line.productOrService || "Servicio"}</strong>
                <p>{line.description}</p>
              </div>
              <span>{line.quantity ? `${formatQuantity(line.quantity)} h` : "-"}</span>
              <span>{formatMoney(line.unitPrice)}</span>
              <strong>{formatMoney(taxableLineAmount(line))}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="totals-block">
        <div className="totals-card">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(totals.subtotal)}</strong>
          </div>
          {totals.taxAmount > 0 ? (
            <div>
              <span>IVA {formatPercent(totals.effectiveTaxRate)}</span>
              <strong>{formatMoney(totals.taxAmount)}</strong>
            </div>
          ) : null}
          <div className="grand-total">
            <span>Total</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
        </div>
      </section>

      <footer className="quote-footer">
        <div className="quote-notes">
          <span>Notas</span>
        </div>
        <div className="quote-terms">
          {prepaymentNote ? <p className="fixed-notes-text">{prepaymentNote}</p> : null}
          {fixedNotes ? <p className="fixed-notes-text">{fixedNotes}</p> : null}
          {config.pdfPaymentRows.length > 0 ? (
            <div className="payment-block">
              <span>Metodo de pago</span>
              {config.pdfPaymentRows.map((payment) => (
                <p key={payment.id}>
                  {payment.label.trim() ? <strong>{payment.label}: </strong> : null}
                  {payment.value}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

function SalesTemplateDocument({
  config,
  kind,
  lines,
  row
}: {
  config: QuotesTemplateConfig;
  kind: SalesDocumentKind;
  lines: SalesQuoteLineDetail[];
  row: SalesDocumentRow;
}) {
  const displayLines = printableLines(row, lines);
  const totals = calculateSalesPrintTotals(row, displayLines);
  const isInvoice = kind === "invoice" || kind === "recurring-invoice";
  const documentLabel = salesPrintDocumentLabel(kind);
  const sectionTitle = config.templateSectionTitle.trim() || (isInvoice ? "DESCRIPCIÓN" : documentLabel.upper);
  const taxRows = totals.taxAmount > 0
    ? [{ id: "iva", label: "IVA", base: totals.subtotal, rate: totals.effectiveTaxRate, amount: totals.taxAmount }]
    : [{ id: "iva", label: "IVA", base: totals.subtotal, rate: 0, amount: 0 }];

  return (
    <article className="quote-page pdf-invoice-page">
      <header className="pdf-invoice-header">
        <section className="pdf-issuer">
          <strong>{row.client || "CLIENTE"}</strong>
          {row.clientCode ? <span>Codigo: {row.clientCode}</span> : null}
          {row.clientPhone ? <span>Tel: {row.clientPhone}</span> : null}
          {row.clientEmail ? <span>{row.clientEmail}</span> : null}
        </section>

        <section className="pdf-meta-table">
          <div>{documentLabel.number}</div>
          <strong>{row.number}</strong>
          <div>FECHA</div>
          <strong>{row.date}</strong>
        </section>
      </header>

      <section className={`pdf-description-table${config.templateShowQuantity ? " has-quantity" : ""}`}>
        <h2>{sectionTitle}</h2>
        <div className="pdf-description-body">
          {displayLines.map((line) => (
            <div className="pdf-description-line" key={line.id}>
              <div>
                <strong>{line.productOrService || "CONCEPTO"}</strong>
                {line.description.trim() ? <span>{line.description}</span> : null}
              </div>
              {config.templateShowQuantity ? <span className="pdf-line-quantity">{formatQuantity(line.quantity)}</span> : null}
              <strong>{formatMoney(taxableLineAmount(line))}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="pdf-invoice-total-row">
        <strong>{documentLabel.total}</strong>
        <span>{formatMoney(totals.subtotal)}</span>
      </section>

      <section className="pdf-taxes-section">
        <div className="pdf-tax-table">
          <div className="pdf-tax-head">IMPUESTOS</div>
          <div className="pdf-tax-head">BASE IMPONIBLE</div>
          <div className="pdf-tax-head">%</div>
          <div className="pdf-tax-head"></div>
          {taxRows.map((tax) => (
            <div className="pdf-tax-row" key={tax.id}>
              <span>{tax.label}</span>
              <span>{formatMoney(tax.base)}</span>
              <span>{tax.rate ? formatPercent(tax.rate) : "0"}</span>
              <span>{formatMoney(tax.amount)}</span>
            </div>
          ))}
        </div>
        <div className="pdf-summary-table">
          <span>TOTAL</span>
          <strong>{formatMoney(totals.subtotal + totals.taxAmount)}</strong>
          <span>SUPLIDO</span>
          <strong>{formatMoney(Math.max(totals.total - totals.subtotal - totals.taxAmount, 0))}</strong>
          <strong>TOTAL NETO</strong>
          <strong>{formatMoney(totals.total)}</strong>
        </div>
      </section>

      <footer className="pdf-invoice-footer">
        <section className="pdf-client-block">
          <strong>{config.templateIssuerName || config.companyName || "EMISOR"}</strong>
          {config.templateIssuerTaxId ? <p>CIF: {config.templateIssuerTaxId}</p> : null}
          {config.templateIssuerAddress ? <p>{config.templateIssuerAddress}</p> : null}
          {config.templateIssuerCity ? <p>{config.templateIssuerCity}</p> : null}
        </section>

        {config.templatePaymentRows.length > 0 ? (
          <>
            <strong className="pdf-payment-heading">Forma de Pago:</strong>
            <section className="pdf-payment-table">
              {config.templatePaymentRows.map((payment) => (
                <div key={payment.id}>
                  <strong>{payment.label.trim() ? `${payment.label}:` : "Pago:"}</strong> {payment.value}
                </div>
              ))}
            </section>
          </>
        ) : null}
      </footer>
    </article>
  );
}

function DocumentHeaderSummary({
  detail,
  documentTitle,
  isPaid,
  kind,
  onClose,
  onPaidChange,
  onStatusChange,
  onTitleChange,
  row,
  statusValue
}: {
  detail: SalesDocumentStatusDetail | null;
  documentTitle: string;
  isPaid: boolean;
  kind: SalesDocumentKind;
  onClose: () => void;
  onPaidChange: (isPaid: boolean) => void;
  onStatusChange: (status: string) => void;
  onTitleChange: (title: string) => void;
  row: SalesDocumentRow;
  statusValue: string;
}) {
  return (
    <section className="document-header-summary" aria-label="Resumen del presupuesto">
      <header className="document-header-title-row">
        <label className="document-title-field">
          <PenLine aria-hidden="true" size={22} />
          <input
            aria-label="Nombre del presupuesto"
            onChange={(event) => onTitleChange(event.target.value)}
            value={documentTitle}
          />
        </label>
        <button className="panel-icon-button" onClick={onClose} type="button" aria-label="Cerrar edicion">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="document-header-primary compact">
        <label className="sage-field">
          <span>Estado</span>
          <select value={statusValue} onChange={(event) => onStatusChange(event.target.value)}>
            {statusOptionsByKind[kind].map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="sage-field">
          <span>Cliente</span>
          <input disabled value={row.client} />
        </label>
        <label className="sage-field">
          <span>Nº presupuesto</span>
          <input disabled value={row.number} />
        </label>
        <label className="sage-field">
          <span>Referencia</span>
          <input disabled value={row.reference} />
        </label>
        <label className="sage-field compact-date">
          <span>Fecha presupuesto</span>
          <input disabled value={row.date} />
        </label>
        <label className="sage-field">
          <span>Fecha aceptacion y hora</span>
          <input disabled value={formatDateTime(detail?.eventAt ?? null)} />
        </label>
        <label className="sage-field">
          <span>Abonado</span>
          <select value={isPaid ? "yes" : "no"} onChange={(event) => onPaidChange(event.target.value === "yes")}>
            <option value="yes">Si</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function DocumentDetailTab({
  activeTab,
  id,
  label,
  onSelect
}: {
  activeTab: SalesDocumentDetailTab;
  id: SalesDocumentDetailTab;
  label: string;
  onSelect: (tab: SalesDocumentDetailTab) => void;
}) {
  return (
    <button
      aria-selected={activeTab === id}
      className={`document-detail-tab${activeTab === id ? " active" : ""}`}
      onClick={() => onSelect(id)}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

function QuoteLinesTable({
  isLoading,
  lines,
  row
}: {
  isLoading: boolean;
  lines: SalesQuoteLineDetail[];
  row: SalesDocumentRow;
}) {
  const fallbackLine: SalesQuoteLineDetail = {
    id: `${row.id}-summary`,
    productOrService: row.reference || row.number,
    description: "",
    quantity: 1,
    unitPrice: row.baseAvailable ?? row.total,
    discountRate: 0,
    taxableBase: row.baseAvailable ?? row.total,
    taxRate: null,
    status: "Completa"
  };
  const displayLines = lines.length > 0 ? lines : isLoading ? [] : [fallbackLine];

  return (
    <div className="quote-detail-lines-wrap">
      <table className="quote-detail-lines-table">
        <thead>
          <tr>
            <th>Producto o servicio</th>
            <th>Descripcion</th>
            <th>Cantidad</th>
            <th>Precio unitario</th>
            <th>Descuento</th>
            <th>Base imponible</th>
            <th>% IVA</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={8}>Cargando productos y servicios...</td>
            </tr>
          ) : displayLines.map((line) => (
            <tr key={line.id}>
              <td>{line.productOrService}</td>
              <td className="quote-line-description">{line.description}</td>
              <td>{formatQuantity(line.quantity)}</td>
              <td>{formatMoney(line.unitPrice)}</td>
              <td>{formatPercent(line.discountRate)}</td>
              <td>{formatMoney(line.taxableBase)}</td>
              <td>{line.taxRate === null ? "—" : formatPercent(line.taxRate)}</td>
              <td><span className="quote-line-status">{line.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTotalsPanel({ row }: { row: SalesDocumentRow }) {
  return (
    <div className="document-detail-summary-grid">
      <SummaryBox label="Total base imponible" value={row.baseAvailable ?? 0} />
      <SummaryBox label="Total" value={row.total} />
    </div>
  );
}

function DocumentClientPanel({ row }: { row: SalesDocumentRow }) {
  return (
    <div className="document-detail-client-grid">
      <label className="sage-field">
        <span>Codigo de cliente</span>
        <input disabled value={row.clientCode} />
      </label>
      <label className="sage-field">
        <span>Cliente</span>
        <input disabled value={row.client} />
      </label>
    </div>
  );
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 4,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value)}%`;
}

function DeleteDocumentPanel({
  activeSection,
  row,
  onCancel,
  onConfirm
}: {
  activeSection: SalesSection;
  row: SalesDocumentRow;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="sales-action-panel delete-panel" aria-label={`Eliminar ${row.number}`}>
      <header>
        <div>
          <AlertTriangle aria-hidden="true" size={22} />
          <h2>Eliminar {activeSection.singularTitle.toLowerCase()} {row.number}</h2>
        </div>
      </header>
      <p>El documento se marcara como eliminado en la base de datos y dejara de aparecer en la lista.</p>
      <footer>
        <button className="sage-outline-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="sage-danger-button" onClick={onConfirm} type="button">Eliminar</button>
      </footer>
    </section>
  );
}

function QuoteForm({
  clients,
  fiscalEntities,
  organizationId,
  products,
  section,
  onCancel,
  onCreated,
  onPersistenceError
}: {
  clients: ArtificialContactListItem[];
  fiscalEntities: Array<{ id: string; name: string }>;
  organizationId: string;
  products: ProductItem[];
  section: SalesSection;
  onCancel: () => void;
  onCreated: (invoice: SalesDocumentRow) => void;
  onPersistenceError: (message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<QuoteFormTab>("products");
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [reference, setReference] = useState("");
  const [isReferenceManual, setIsReferenceManual] = useState(false);
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [retentionRate, setRetentionRate] = useState(15);
  const [suplidoAmount, setSuplidoAmount] = useState(0);
  const [pdfTemplate, setPdfTemplate] = useState("standard");
  const [customMessage, setCustomMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientEmailInputRef = useRef<HTMLInputElement>(null);
  const clientPhoneInputRef = useRef<HTMLInputElement>(null);
  const isQuote = section.id === "quotes";
  const isOrder = section.id === "orders";
  const isDeliveryNote = section.id === "delivery-notes";
  const isRecurring = section.id === "recurring-invoices";
  const defaultPrefix = isQuote ? "PRES" : isOrder ? "PED" : isDeliveryNote ? "ALB" : isRecurring ? "REC" : "FAC";
  const [prefix, setPrefix] = useState(defaultPrefix);
  const normalizedDocumentDate = documentDate || new Date().toISOString().slice(0, 10);
  const autoReference = `${prefix}-${normalizedDocumentDate.replaceAll("-", "")}`;
  const subtotal = lines.reduce((total, line) => {
    const rawLineTotal = line.quantity * line.unitPrice;
    const discountAmount = rawLineTotal * (line.discount / 100);

    return total + rawLineTotal - discountAmount;
  }, 0);
  const clientDiscount = subtotal * (discountPercent / 100);
  const taxableBase = Math.max(subtotal - clientDiscount, 0);
  const taxTotal = taxableBase * 0.21;
  const retentionTotal = taxableBase * (retentionRate / 100);
  const total = taxableBase + taxTotal - retentionTotal + suplidoAmount;
  const canCreate = client.trim().length > 0 && lines.length > 0 && !isSaving;

  useEffect(() => {
    if (!isReferenceManual) {
      setReference(autoReference);
    }
  }, [autoReference, isReferenceManual]);

  const selectClient = (nextClientId: string) => {
    setClientId(nextClientId);
    const selectedClient = clients.find((item) => item.id === nextClientId);

    if (!selectedClient) {
      setClient("");
      setClientEmail("");
      setClientPhone("");
      return;
    }

    setClient(selectedClient.name);
    setClientEmail(selectedClient.contactEmail ?? "");
    setClientPhone(selectedClient.contactPhone ?? "");
    if (selectedClient.applyIrpfByDefault) {
      setRetentionRate(selectedClient.defaultIrpfRate ?? 15);
    }
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: Date.now(),
        product: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0
      }
    ]);
  };

  const duplicateLine = (line: QuoteLine) => {
    setLines((current) => [
      ...current,
      {
        ...line,
        id: Date.now()
      }
    ]);
  };

  const updateLine = (id: number, patch: Partial<QuoteLine>) => {
    if (typeof patch.product === "string") {
      const matched = products.find((item) => (
        item.name === patch.product || (item.code !== "" && item.code === patch.product)
      ));

      if (matched) {
        const line = lines.find((item) => item.id === id);

        patch = {
          ...patch,
          product: matched.name,
          unitPrice: line && line.unitPrice > 0 ? line.unitPrice : matched.unitPrice,
          description: line?.description ? line.description : matched.name
        };
      }
    }

    setLines((current) => current.map((line) => (
      line.id === id ? { ...line, ...patch } : line
    )));
  };

  const removeLine = (id: number) => {
    setLines((current) => current.filter((line) => line.id !== id));
  };

  const submitDocument = async () => {
    const formData = new FormData();
    const clientNameValue = clientInputRef.current?.value.trim() || client.trim();
    const clientEmailValue = clientEmailInputRef.current?.value.trim() || clientEmail.trim();
    const clientPhoneValue = clientPhoneInputRef.current?.value.trim() || clientPhone.trim();

    formData.set("organization_id", organizationId);
    formData.set("client_id", clientId);
    formData.set("client_name", clientNameValue);
    formData.set("client_email", clientEmailValue);
    formData.set("client_phone", clientPhoneValue);
    formData.set("number_prefix", prefix);
    formData.set("reference", reference.trim() || autoReference);
    formData.set(
      isQuote ? "quote_date" : isOrder ? "order_date" : isDeliveryNote ? "note_date" : isRecurring ? "next_issue_date" : "issue_date",
      documentDate
    );
    if (isRecurring) {
      const frequencySelect = document.querySelector<HTMLSelectElement>("[data-field='frequency']");

      formData.set("frequency", frequencySelect?.value ?? "monthly");
    }
    formData.set("retention_rate", String(retentionRate));
    formData.set("suplido_amount", String(suplidoAmount));
    formData.set("pdf_template", pdfTemplate);
    formData.set("notes", [customMessage, internalNotes].filter(Boolean).join("\n\n"));
    formData.set("lines_json", JSON.stringify(lines));

    const docLabel = isQuote ? "el presupuesto" : isOrder ? "el pedido" : isDeliveryNote ? "el albarán" : isRecurring ? "la plantilla recurrente" : "la factura";

    setSubmitError(null);
    setIsSaving(true);

    try {
      const result = isQuote
        ? await createSalesQuote(formData)
        : isOrder
          ? await createSalesOrder(formData)
          : isDeliveryNote
            ? await createSalesDeliveryNote(formData)
            : isRecurring
              ? await createSalesRecurringInvoice(formData)
              : await createSalesInvoice(formData);
      const persisted = isQuote
        ? ("quote" in result ? result.quote : null)
        : isOrder
          ? ("order" in result ? result.order : null)
          : isDeliveryNote
            ? ("note" in result ? result.note : null)
            : isRecurring
              ? ("recurring" in result ? result.recurring : null)
              : ("invoice" in result ? result.invoice : null);

      if (result.error || !persisted) {
        setSubmitError(result.error ?? `No se pudo crear ${docLabel}.`);
        return;
      }

      onCreated({
        id: persisted.id,
        status: isQuote || isOrder || isDeliveryNote || isRecurring ? "Abierta" : "Borrador",
        date: new Date(documentDate).toLocaleDateString("es-ES"),
        number: persisted.number,
        reference: reference.trim() || autoReference,
        clientCode: clients.find((item) => item.id === clientId)?.code ?? "",
        client: clientNameValue,
        total: persisted.total
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `No se pudo crear ${docLabel}.`;
      setSubmitError(message);
      onPersistenceError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="quote-form-screen" aria-label={section.singularTitle}>
      <header className="quote-form-heading">
        <h1>{section.singularTitle}</h1>
        <button className="quote-close-button" onClick={onCancel} type="button" aria-label="Cerrar formulario">
          <X aria-hidden="true" size={34} />
        </button>
      </header>

      <section className="quote-main-card" aria-label="Datos generales">
        <div className="quote-top-grid">
          <label className="sage-field">
            <span>Cliente</span>
            <select value={clientId} onChange={(event) => selectClient(event.target.value)}>
              <option value="">Seleccionar...</option>
              {clients.map((clientOption) => (
                <option key={clientOption.id} value={clientOption.id}>{clientOption.name}</option>
              ))}
            </select>
          </label>
          <label className="sage-field">
            <span>Prefijo</span>
            <select value={prefix} onChange={(event) => setPrefix(event.target.value)}>
              {isQuote ? <option value="PRES">PRES</option> : isOrder ? <option value="PED">PED</option> : isDeliveryNote ? <option value="ALB">ALB</option> : isRecurring ? <option value="REC">REC</option> : <option value="FAC">FAC</option>}
            </select>
          </label>
          {isRecurring ? (
            <label className="sage-field">
              <span>Frecuencia</span>
              <select data-field="frequency" defaultValue="monthly">
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
              </select>
            </label>
          ) : null}
          <label className="sage-field">
            <span>Plantilla PDF</span>
            <select value={pdfTemplate} onChange={(event) => setPdfTemplate(event.target.value)}>
              <option value="standard">Factura estandar</option>
              <option value="tablamax">TABLAMAX con impuestos y suplido</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Referencia</span>
            <div className="date-input-shell">
              <input
                readOnly={!isReferenceManual}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
              <button
                aria-label={isReferenceManual ? "Bloquear referencia automatica" : "Editar referencia"}
                className="quote-inline-icon-button"
                onClick={() => {
                  if (isReferenceManual) {
                    setIsReferenceManual(false);
                    setReference(autoReference);
                    return;
                  }

                  setIsReferenceManual(true);
                }}
                type="button"
              >
                <PenLine aria-hidden="true" size={18} />
              </button>
            </div>
          </label>
          <label className="sage-field compact-date">
            <span>{section.dateLabel.replace("...", "uesto")} *</span>
            <span className="date-input-shell">
              <input value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} type="date" />
              <CalendarDays aria-hidden="true" size={24} fill="currentColor" />
            </span>
          </label>
        </div>

        <div className="quote-contact-grid">
          <label className="sage-field">
            <span>Razon social o nombre</span>
            <input ref={clientInputRef} value={client} onChange={(event) => setClient(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>E-mail</span>
            <input ref={clientEmailInputRef} onChange={(event) => setClientEmail(event.target.value)} type="email" value={clientEmail} />
          </label>
          <label className="sage-field span-2">
            <span>Telefono</span>
            <input ref={clientPhoneInputRef} onChange={(event) => setClientPhone(event.target.value)} value={clientPhone} />
          </label>
          <label className="sage-field span-2">
            <span>Pais *</span>
            <select defaultValue="ES - ES">
              <option>ES - ES</option>
              <option>PT - PT</option>
              <option>FR - FR</option>
            </select>
          </label>
        </div>
      </section>

      <div className="quote-tabs" role="tablist" aria-label="Secciones del presupuesto">
        <QuoteTab activeTab={activeTab} id="products" label="Productos y servicios" onSelect={setActiveTab} />
        <QuoteTab activeTab={activeTab} id="totals" label="Totales y descuentos" onSelect={setActiveTab} />
        <QuoteTab activeTab={activeTab} id="notes" label="Notas" onSelect={setActiveTab} />
        <QuoteTab activeTab={activeTab} id="client" label="Informacion de cliente" onSelect={setActiveTab} />
      </div>

      <section className="quote-tab-panel">
        {activeTab === "products" ? (
          <ProductsTab
            lines={lines}
            products={products}
            onAddLine={addLine}
            onDuplicateLine={duplicateLine}
            onRemoveLine={removeLine}
            onUpdateLine={updateLine}
          />
        ) : null}
        {activeTab === "totals" ? (
          <TotalsTab
            clientDiscount={clientDiscount}
            discountPercent={discountPercent}
            productDiscount={subtotal - lines.reduce((totalLine, line) => totalLine + line.quantity * line.unitPrice, 0)}
            subtotal={subtotal}
            taxableBase={taxableBase}
            retentionRate={retentionRate}
            retentionTotal={retentionTotal}
            suplidoAmount={suplidoAmount}
            onDiscountPercentChange={setDiscountPercent}
            onRetentionRateChange={setRetentionRate}
            onSuplidoAmountChange={setSuplidoAmount}
          />
        ) : null}
        {activeTab === "notes" ? (
          <NotesTab
            customMessage={customMessage}
            internalNotes={internalNotes}
            onCustomMessageChange={setCustomMessage}
            onInternalNotesChange={setInternalNotes}
          />
        ) : null}
        {activeTab === "client" ? <ClientInfoTab pdfTemplate={pdfTemplate} onPdfTemplateChange={setPdfTemplate} /> : null}
      </section>

      {submitError ? <div className="sales-live-notice warning" role="alert">{submitError}</div> : null}
      <QuoteStickyBar
        canCreate={canCreate}
        isPending={isSaving}
        taxableBase={taxableBase}
        taxTotal={taxTotal}
        retentionTotal={retentionTotal}
        suplidoAmount={suplidoAmount}
        total={total}
        onCancel={onCancel}
        onCreate={submitDocument}
      />
    </section>
  );
}

function QuoteTab({
  activeTab,
  id,
  label,
  onSelect
}: {
  activeTab: QuoteFormTab;
  id: QuoteFormTab;
  label: string;
  onSelect: (tab: QuoteFormTab) => void;
}) {
  return (
    <button
      aria-selected={activeTab === id}
      className={`quote-tab${activeTab === id ? " active" : ""}`}
      onClick={() => onSelect(id)}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

function ProductsTab({
  lines,
  products,
  onAddLine,
  onDuplicateLine,
  onRemoveLine,
  onUpdateLine
}: {
  lines: QuoteLine[];
  products: ProductItem[];
  onAddLine: () => void;
  onDuplicateLine: (line: QuoteLine) => void;
  onRemoveLine: (id: number) => void;
  onUpdateLine: (id: number, patch: Partial<QuoteLine>) => void;
}) {
  const [lineMenuId, setLineMenuId] = useState<number | null>(null);

  const runLineAction = (action: () => void) => {
    action();
    setLineMenuId(null);
  };

  return (
    <div className="quote-products-panel">
      <button className="sage-primary-button" onClick={onAddLine} type="button">
        <Plus aria-hidden="true" size={23} />
        Anadir
      </button>

      {products.length > 0 ? (
        <datalist id="quote-product-options">
          {products.map((product) => (
            <option key={product.id} value={product.name}>
              {product.code ? `${product.code} · ` : ""}{formatMoney(product.unitPrice)}
            </option>
          ))}
        </datalist>
      ) : null}

      <div className="quote-lines-wrap">
        <table className="quote-lines-table">
          <thead>
            <tr>
              <th aria-label="Seleccion" />
              <th>Producto o servicio</th>
              <th>Descripcion</th>
              <th>Cantidad</th>
              <th>Precio unita...</th>
              <th>Descuento</th>
              <th>Eliminar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lines.length > 0 ? lines.map((line) => (
              <tr key={line.id}>
                <td><PackageSearch aria-hidden="true" size={20} /></td>
                <td>
                  <input
                    aria-label="Producto o servicio"
                    list="quote-product-options"
                    onChange={(event) => onUpdateLine(line.id, { product: event.target.value })}
                    value={line.product}
                  />
                </td>
                <td>
                  <input
                    aria-label="Descripcion"
                    onChange={(event) => onUpdateLine(line.id, { description: event.target.value })}
                    value={line.description}
                  />
                </td>
                <td>
                  <input
                    aria-label="Cantidad"
                    min="0"
                    onChange={(event) => onUpdateLine(line.id, { quantity: Number(event.target.value) })}
                    type="number"
                    value={line.quantity}
                  />
                </td>
                <td>
                  <input
                    aria-label="Precio unitario"
                    min="0"
                    onChange={(event) => onUpdateLine(line.id, { unitPrice: Number(event.target.value) })}
                    type="number"
                    value={line.unitPrice}
                  />
                </td>
                <td>
                  <input
                    aria-label="Descuento"
                    min="0"
                    max="100"
                    onChange={(event) => onUpdateLine(line.id, { discount: Number(event.target.value) })}
                    type="number"
                    value={line.discount}
                  />
                </td>
                <td>
                  <button className="sage-table-button danger" onClick={() => onRemoveLine(line.id)} type="button">
                    <Trash2 aria-hidden="true" size={22} fill="currentColor" />
                  </button>
                </td>
                <td>
                  <div className="quote-line-actions">
                    <button
                      aria-expanded={lineMenuId === line.id}
                      className="sage-table-button"
                      onClick={() => setLineMenuId((current) => current === line.id ? null : line.id)}
                      type="button"
                      aria-label="Mas acciones"
                    >
                      <MoreVertical aria-hidden="true" size={22} />
                    </button>
                    {lineMenuId === line.id ? (
                      <div className="sales-popover quote-line-popover" role="menu">
                        <button onClick={() => runLineAction(() => onDuplicateLine(line))} type="button">Duplicar linea</button>
                        <button onClick={() => runLineAction(() => onUpdateLine(line.id, { discount: 0 }))} type="button">Quitar descuento</button>
                        <button onClick={() => runLineAction(() => onRemoveLine(line.id))} type="button">Eliminar linea</button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8}>
                  <div className="quote-line-empty">
                    <ListChecks aria-hidden="true" size={42} />
                    <span>Anade productos o servicios para activar la creacion.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalsTab({
  clientDiscount,
  discountPercent,
  productDiscount,
  retentionRate,
  retentionTotal,
  subtotal,
  suplidoAmount,
  taxableBase,
  onDiscountPercentChange,
  onRetentionRateChange,
  onSuplidoAmountChange
}: {
  clientDiscount: number;
  discountPercent: number;
  productDiscount: number;
  retentionRate: number;
  retentionTotal: number;
  subtotal: number;
  suplidoAmount: number;
  taxableBase: number;
  onDiscountPercentChange: (value: number) => void;
  onRetentionRateChange: (value: number) => void;
  onSuplidoAmountChange: (value: number) => void;
}) {
  return (
    <div className="totals-panel">
      <SummaryBox label="Total sin descuento de producto" value={subtotal} />
      <SummaryBox label="Descuento total de producto" value={Math.abs(productDiscount)} />
      <SummaryBox label="Total sin descuento de cliente" value={subtotal} />
      <label className="sage-field discount-field">
        <span>% descuento a cliente</span>
        <input
          onChange={(event) => onDiscountPercentChange(Number(event.target.value))}
          type="number"
          value={discountPercent}
        />
      </label>
      <SummaryBox label="Descuento de cliente" value={clientDiscount} />
      <SummaryBox label="Total base imponible" value={taxableBase} />
      <label className="sage-field discount-field">
        <span>IRPF / retencion %</span>
        <input
          max="100"
          min="0"
          onChange={(event) => onRetentionRateChange(Number(event.target.value))}
          type="number"
          value={retentionRate}
        />
      </label>
      <SummaryBox label="Retencion IRPF" value={-retentionTotal} />
      <label className="sage-field discount-field">
        <span>Suplido</span>
        <input
          min="0"
          onChange={(event) => onSuplidoAmountChange(Number(event.target.value))}
          type="number"
          value={suplidoAmount}
        />
      </label>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <article className="quote-summary-box">
      <strong>{formatMoney(value)}</strong>
      <span>{label}</span>
    </article>
  );
}

function NotesTab({
  customMessage,
  internalNotes,
  onCustomMessageChange,
  onInternalNotesChange
}: {
  customMessage: string;
  internalNotes: string;
  onCustomMessageChange: (value: string) => void;
  onInternalNotesChange: (value: string) => void;
}) {
  return (
    <div className="notes-panel">
      <label className="sage-textarea-field">
        <span>Mensaje personalizado</span>
        <small>Anade un mensaje personalizado a la version en PDF del presupuesto.</small>
        <textarea maxLength={500} onChange={(event) => onCustomMessageChange(event.target.value)} value={customMessage} />
        <em>Quedan {500 - customMessage.length} caracteres.</em>
      </label>
      <label className="sage-textarea-field">
        <span>Notas</span>
        <small>Anade notas a este presupuesto. No se muestran al cliente.</small>
        <textarea maxLength={1000} onChange={(event) => onInternalNotesChange(event.target.value)} value={internalNotes} />
        <em>Quedan {1000 - internalNotes.length} caracteres.</em>
      </label>
    </div>
  );
}

function ClientInfoTab({
  pdfTemplate,
  onPdfTemplateChange
}: {
  pdfTemplate: string;
  onPdfTemplateChange: (value: string) => void;
}) {
  return (
    <div className="client-info-panel">
      <section>
        <h2>Informacion de empresa</h2>
        <label className="sage-field">
          <span>Codigo de cliente</span>
          <input disabled />
        </label>
        <label className="sage-field">
          <span>Tipo de identificacion</span>
          <input disabled defaultValue="NIF/DNI/NIE" />
        </label>
        <label className="sage-field">
          <span>Numero de identificacion</span>
          <input />
        </label>
        <label className="sage-field">
          <span>NIF-IVA</span>
          <input />
        </label>
        <label className="sage-field">
          <span>Idioma</span>
          <small>Se aplica a los titulos de las secciones y a las cabeceras de las columnas de los PDF de los documentos de venta.</small>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>Espanol</option>
            <option>Portugues</option>
          </select>
        </label>

        <h2>Informacion de precios y descuentos</h2>
        <label className="sage-field">
          <span>Codigo de tarifa</span>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>GENERAL</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Nombre de tarifa</span>
          <input disabled />
        </label>
        <label className="sage-field">
          <span>Codigo de grupo de descuentos</span>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>MAYORISTA</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Nombre de grupo de descuentos</span>
          <input disabled />
        </label>
        <label className="sage-field">
          <span>Plantilla PDF</span>
          <select value={pdfTemplate} onChange={(event) => onPdfTemplateChange(event.target.value)}>
            <option value="standard">Factura estandar</option>
            <option value="tablamax">TABLAMAX con impuestos y suplido</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Direccion e informacion de contacto</h2>
        <label className="sage-field">
          <span>Tipo de e-mail</span>
          <input disabled defaultValue="Personalizado" />
        </label>
        <label className="sage-field">
          <span>E-mail de factura</span>
          <input type="email" />
        </label>
        <AddressBox title="Direccion de entrega" />
        <AddressBox title="Direccion de facturacion" />
      </section>
    </div>
  );
}

function AddressBox({ title }: { title: string }) {
  return (
    <div className="address-box">
      <span>{title}</span>
      <div className="address-box-body">
        <em>Se utiliza la direccion guardada en la ficha del cliente.</em>
      </div>
    </div>
  );
}

function QuoteStickyBar({
  canCreate,
  isPending,
  onCancel,
  onCreate,
  retentionTotal,
  suplidoAmount,
  taxableBase,
  taxTotal,
  total
}: {
  canCreate: boolean;
  isPending: boolean;
  onCancel: () => void;
  onCreate: () => void;
  retentionTotal: number;
  suplidoAmount: number;
  taxableBase: number;
  taxTotal: number;
  total: number;
}) {
  return (
    <footer className="quote-sticky-bar">
      <SummaryBox label="Total base imponible" value={taxableBase} />
      <SummaryBox label="Total IVA" value={taxTotal} />
      <SummaryBox label="Retencion IRPF" value={-retentionTotal} />
      <SummaryBox label="Suplido" value={suplidoAmount} />
      <SummaryBox label="Total" value={total} />
      <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
      <button className="quote-create-action" disabled={!canCreate} onClick={onCreate} type="button">
        {isPending ? "Creando..." : "Crear"}
      </button>
    </footer>
  );
}

