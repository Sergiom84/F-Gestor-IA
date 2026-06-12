"use client";

// Ported from SOHL_Presupuestos src/App.tsx. Renders the standalone
// quote/invoice generator inside GFiscal, scoped under .quotes-shell.
import "./quotes.css";

import { Image as ImageIcon, Search, Settings, Trash2, X } from "lucide-react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  bulkUpsertQuoteDocuments,
  deleteQuoteDocument,
  upsertQuoteDocument,
  upsertQuotesConfig,
  type QuotesInitialData
} from "./quotes-actions";

function OrbLogo({ size = 48 }: { size?: number }) {
  const logoId = useId().replace(/:/g, "");
  const gradientId = `${logoId}-sphere`;
  const haloId = `${logoId}-halo`;
  const shineId = `${logoId}-shine`;
  const printGradientId = `${logoId}-print-sphere`;

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
          <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0077ff" stopOpacity="0.22" />
            <stop offset="48%" stopColor="#66b3ff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0077ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gradientId} cx="40%" cy="32%" r="64%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="18%" stopColor="#9bd1ff" />
            <stop offset="52%" stopColor="#0077ff" />
            <stop offset="100%" stopColor="#004db8" />
          </radialGradient>
          <radialGradient id={shineId} cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="52%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="orb-logo-halo orb-logo-halo-outer" cx="60" cy="60" r="52" fill={`url(#${haloId})`} />
        <circle className="orb-logo-halo orb-logo-halo-inner" cx="60" cy="61" r="41" fill="#0077ff" opacity="0.08" />
        <circle className="orb-logo-shadow" cx="61" cy="73" r="27" fill="#004ca8" opacity="0.08" />
        <circle className="orb-logo-sphere" cx="60" cy="60" r="30" fill={`url(#${gradientId})`} />
        <circle className="orb-logo-shine" cx="51" cy="48" r="12" fill={`url(#${shineId})`} />
        <path
          className="orb-logo-curve"
          d="M35 61c10 8 29 11 50 4"
          stroke="#f6fbff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.34"
        />
      </svg>
      <svg
        className="orb-logo orb-logo-print"
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id={printGradientId} cx="39%" cy="33%" r="68%">
            <stop offset="0%" stopColor="#f7fbff" />
            <stop offset="24%" stopColor="#72bdff" />
            <stop offset="58%" stopColor="#0077ff" />
            <stop offset="100%" stopColor="#0050bd" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="47" fill="#eaf5ff" />
        <circle cx="60" cy="60" r="33" fill={`url(#${printGradientId})`} />
        <path d="M36 66c13 7 35 7 48 0" stroke="#d8efff" strokeWidth="3" strokeLinecap="round" opacity="0.68" />
        <circle cx="50" cy="47" r="10" fill="#ffffff" opacity="0.7" />
      </svg>
    </span>
  );
}

type QuoteItem = {
  id: string;
  serviceType: string;
  description: string;
  hours: number;
  hourlyRate: number;
  manualAmountEnabled: boolean;
  manualAmount: number;
};

type QuoteNoteItem = {
  id: string;
  text: string;
  hours: number;
};

type PdfTaxItem = {
  id: string;
  label: string;
  base: number;
  rate: number;
  amount: number;
};

type PdfPaymentRow = {
  id: string;
  label: string;
  value: string;
};

type PdfInvoiceFields = {
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  issuerCity: string;
  paymentMethod: string;
  iban: string;
  paymentRows: PdfPaymentRow[];
  suplido: number;
};

type TemplateScope = "sales" | "quotes";
type ConfigFormat = "pdf" | "template";
type DocumentType = "quote" | "invoice" | "pdfQuote" | "pdfInvoice";
type SalesTemplateDocumentKind = "quote" | "order" | "delivery-note" | "invoice";

type AppConfigBase = {
  companyName: string;
  companyTagline: string;
  logoDataUrl: string;
  templateIssuerName: string;
  templateIssuerTaxId: string;
  templateIssuerAddress: string;
  templateIssuerCity: string;
  templatePaymentRows: PdfPaymentRow[];
  templateSectionTitle: string;
  templateShowQuantity: boolean;
  defaultNotes: string;
  quoteFixedNotes: string;
  invoiceFixedNotes: string;
  quotePrepaymentEnabled: boolean;
  quotePrepaymentRate: number;
  quotePrepaymentText: string;
  paymentDetails: string;
  pdfPaymentRows: PdfPaymentRow[];
  accentColor: string;
  pageBackgroundColor: string;
  clientBoxBackgroundColor: string;
};

type AppConfigProfiles = Record<TemplateScope, Record<ConfigFormat, Partial<AppConfigBase>>>;

type Quote = {
  id: string;
  documentType: DocumentType;
  templateScope: TemplateScope;
  sourceKind?: SalesTemplateDocumentKind;
  createdAt: string;
  updatedAt: string;
  quoteNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientDetails: string;
  items: QuoteItem[];
  taxEnabled: boolean;
  taxRate: number;
  discountRate: number;
  discountAmount: number;
  notes: string;
  noteItems: QuoteNoteItem[];
  pdfFields: PdfInvoiceFields;
  taxItems: PdfTaxItem[];
};

type HistoryExportPayload = {
  format: "documents-backup-v1" | "documents-history-v1";
  exportedAt: string;
  appVersion: string;
  quotes: Quote[];
  config?: AppConfig;
  layout?: AppLayout;
};

type AppConfig = AppConfigBase & {
  profiles: AppConfigProfiles;
};

const stripControlChars = (value: string) => value.replace(/\u0000/g, "").trim();

const fixMojibake = (value: string) => {
  if (!value) return value;
  const cleaned = stripControlChars(value);

  // Attempt common latin1/utf8 mojibake recovery (e.g. "DiseÃ±o" -> "Diseño").
  if (/[ÃÂÐ]/.test(cleaned)) {
    try {
      const recovered = decodeURIComponent(escape(cleaned));
      if (recovered) return recovered;
    } catch {
      // Keep original when recovery is not possible.
    }
  }

  // Remove replacement glyphs that come from corrupted imports.
  return cleaned.replace(/\uFFFD/g, "");
};

const parseJsonIfString = <T,>(value: unknown): T | null => {
  if (typeof value !== "string") return null;
  const cleaned = stripControlChars(value);
  if (!cleaned) return null;
  const first = cleaned[0];
  if (first !== "{" && first !== "[") return null;
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
};

const quoteToDbRow = (quote: Quote) => ({
  id: quote.id,
  document_type: quote.documentType,
  quote_number: quote.quoteNumber || null,
  client_name: quote.clientName || null,
  date: quote.date || null,
  due_date: quote.dueDate || null,
  total_amount: 0,
  payload: quote as unknown as Record<string, unknown>
});

const STORAGE_KEY = "documents-quotes";
const CONFIG_STORAGE_KEY = "documents-config";
const LAYOUT_STORAGE_KEY = "documents-layout";
const DEFAULT_QUOTE_NOTES = "";
const DEFAULT_INVOICE_NOTES = "";
const MAX_DOCUMENT_ITEMS = 4;
const MAX_NOTE_LINES = 13;
const DEFAULT_QUOTE_PREPAYMENT_TEXT =
  "Para iniciar el desarrollo, será necesario abonar un anticipo del 20% del total:";
const DEFAULT_PDF_INVOICE_FIELDS: PdfInvoiceFields = {
  issuerName: "",
  issuerTaxId: "",
  issuerAddress: "",
  issuerCity: "",
  paymentMethod: "",
  iban: "",
  paymentRows: [],
  suplido: 0,
};
const DEFAULT_APP_CONFIG: AppConfig = {
  companyName: "",
  companyTagline: "",
  logoDataUrl: "",
  templateIssuerName: "",
  templateIssuerTaxId: "",
  templateIssuerAddress: "",
  templateIssuerCity: "",
  templatePaymentRows: [],
  templateSectionTitle: "PRESUPUESTO",
  templateShowQuantity: false,
  defaultNotes: "",
  quoteFixedNotes: "",
  invoiceFixedNotes: "",
  quotePrepaymentEnabled: false,
  quotePrepaymentRate: 20,
  quotePrepaymentText: DEFAULT_QUOTE_PREPAYMENT_TEXT,
  paymentDetails: "",
  pdfPaymentRows: [],
  accentColor: "#0077ff",
  pageBackgroundColor: "#fffdf8",
  clientBoxBackgroundColor: "#eff7ff",
  profiles: {
    sales: {
      pdf: {},
      template: {
        templateSectionTitle: "PRODUCTOS Y SERVICIOS",
        templateShowQuantity: true,
      },
    },
    quotes: {
      pdf: {},
      template: {},
    },
  },
};
const ACCENT_COLOR_OPTIONS = [
  "#0077ff",
  "#0057d8",
  "#1d4ed8",
  "#2563eb",
  "#0891b2",
  "#0f766e",
  "#15803d",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#be123c",
  "#c026d3",
  "#7c3aed",
  "#4f46e5",
  "#334155",
  "#111827",
  "#986f3f",
];
const DOCUMENT_BACKGROUND_OPTIONS = [
  { label: "Blanco", value: "#ffffff" },
  { label: "Blanco roto", value: "#fffdf8" },
  { label: "Grisáceo", value: "#f3f4f6" },
  { label: "Crema", value: "#fff7e6" },
];
const CLIENT_BOX_BACKGROUND_OPTIONS = [
  { label: "Azul suave", value: "#eff7ff" },
  { label: "Blanco", value: "#ffffff" },
  { label: "Blanco roto", value: "#fffdf8" },
  { label: "Grisáceo", value: "#f3f4f6" },
  { label: "Crema", value: "#fff7e6" },
];
const EURO_FORMATTER = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const today = () => formatDateInput(new Date());
const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
};
const addMonths = (dateValue: string, months: number) => {
  const [year = 0, month = 1, day = 1] = dateValue.split("-").map(Number);
  const lastDayOfTargetMonth = new Date(year, month - 1 + months + 1, 0).getDate();
  return formatDateInput(new Date(year, month - 1 + months, Math.min(day, lastDayOfTargetMonth)));
};
const isInvoiceDocument = (documentType: DocumentType) =>
  documentType === "invoice" || documentType === "pdfInvoice";

const isQuoteDocument = (documentType: DocumentType) =>
  documentType === "quote" || documentType === "pdfQuote";

const isTemplateDocument = (documentType: DocumentType) =>
  documentType === "pdfQuote" || documentType === "pdfInvoice";

const sourceKindForDocument = (documentType: DocumentType): SalesTemplateDocumentKind =>
  isInvoiceDocument(documentType) ? "invoice" : "quote";

const salesTemplateRoutes: Array<{ kind: SalesTemplateDocumentKind; label: string; templateType: DocumentType; pdfType: DocumentType }> = [
  { kind: "quote", label: "Presupuestos", templateType: "pdfQuote", pdfType: "quote" },
  { kind: "order", label: "Pedido", templateType: "pdfQuote", pdfType: "quote" },
  { kind: "delivery-note", label: "Albaranes", templateType: "pdfQuote", pdfType: "quote" },
  { kind: "invoice", label: "Facturas", templateType: "pdfInvoice", pdfType: "invoice" },
];

const templateDocumentLabels = (sourceKind: SalesTemplateDocumentKind) => {
  if (sourceKind === "order") return { title: "Pedido", upper: "PEDIDO", number: "Nº PEDIDO", total: "TOTAL IMPORTE DEL PEDIDO" };
  if (sourceKind === "delivery-note") return { title: "Albarán", upper: "ALBARÁN", number: "Nº ALBARÁN", total: "TOTAL IMPORTE DEL ALBARÁN" };
  if (sourceKind === "invoice") return { title: "Factura", upper: "FACTURA", number: "Nº FACTURA", total: "TOTAL IMPORTE FACTURADO" };
  return { title: "Presupuesto", upper: "PRESUPUESTO", number: "Nº PRESUPUESTO", total: "TOTAL IMPORTE PRESUPUESTADO" };
};

const getDefaultDueDate = (dateValue: string, documentType: DocumentType) =>
  isInvoiceDocument(documentType) ? addDays(dateValue, 30) : addMonths(dateValue, 3);
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatCurrency = (value: number) => EURO_FORMATTER.format(Number.isFinite(value) ? value : 0);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const parseNumericInput = (value: string) => (value === "" ? 0 : Number(value));
const numericInputValue = (value: number) => (value === 0 ? "" : String(value));
const limitTextLines = (value: string, maxLines = MAX_NOTE_LINES) => value.split(/\r?\n/).slice(0, maxLines).join("\n");
const countTextLines = (value: string) => (value.trim() ? value.split(/\r?\n/).length : 0);

const formatDate = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatPdfDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const createItem = (): QuoteItem => ({
  id: newId(),
  serviceType: "Servicio",
  description: "",
  hours: 0,
  hourlyRate: 0,
  manualAmountEnabled: false,
  manualAmount: 0,
});

const createPdfInvoiceItems = (): QuoteItem[] => [
  {
    id: newId(),
    serviceType: "CONCEPTO",
    description: "",
    hours: 0,
    hourlyRate: 0,
    manualAmountEnabled: true,
    manualAmount: 0,
  },
  {
    id: newId(),
    serviceType: "CONCEPTO",
    description: "",
    hours: 0,
    hourlyRate: 0,
    manualAmountEnabled: true,
    manualAmount: 0,
  },
];

const createNoteItem = (): QuoteNoteItem => ({
  id: newId(),
  text: "",
  hours: 0,
});

const createPdfTaxItems = (): PdfTaxItem[] => [
  { id: newId(), label: "IVA", base: 0, rate: 21, amount: 0 },
  { id: newId(), label: "IRPF", base: 0, rate: 0, amount: 0 },
];

const createPdfPaymentRows = (paymentMethod = "", iban = ""): PdfPaymentRow[] => [
  { id: newId(), label: "Cuenta bancaria", value: paymentMethod },
  { id: newId(), label: "No. de IBAN", value: iban },
];

const clonePaymentRows = (rows: PdfPaymentRow[]) =>
  rows.map((row) => ({ ...row, id: newId() }));

const getDocumentConfig = (documentType: DocumentType) =>
  documentType === "pdfInvoice"
    ? {
        title: "Factura",
        pluralTitle: "Facturas Plantilla",
        numberLabel: "Nº factura",
        listLabel: "Factura Plantilla",
        newLabel: "Nueva factura plantilla",
        prefix: "A26",
        defaultNotes: "",
      }
    : documentType === "pdfQuote"
    ? {
        title: "Presupuesto",
        pluralTitle: "Presupuestos Plantilla",
        numberLabel: "Numero presupuesto",
        listLabel: "Presupuesto Plantilla",
        newLabel: "Nuevo presupuesto plantilla",
        prefix: "PTO",
        defaultNotes: DEFAULT_QUOTE_NOTES,
      }
    : documentType === "invoice"
    ? {
        title: "Factura",
        pluralTitle: "Facturas PDF",
        numberLabel: "Numero factura",
        listLabel: "Factura PDF",
        newLabel: "Nueva factura PDF",
        prefix: "FAC",
        defaultNotes: DEFAULT_INVOICE_NOTES,
      }
    : {
        title: "Presupuesto",
        pluralTitle: "Presupuestos PDF",
        numberLabel: "Numero presupuesto",
        listLabel: "Presupuesto PDF",
        newLabel: "Nuevo presupuesto PDF",
        prefix: "PTO",
        defaultNotes: DEFAULT_QUOTE_NOTES,
      };

const createDocumentNumber = (documentType: DocumentType, sequence = 1) =>
  documentType === "pdfInvoice"
    ? `A26-${String(sequence + 15).padStart(3, "0")}`
    : isQuoteDocument(documentType)
    ? String(sequence).padStart(3, "0")
    : `${getDocumentConfig(documentType).prefix}-${new Date().getFullYear()}-${String(sequence).padStart(3, "0")}`;

const createQuote = (
  sequence = 1,
  documentType: DocumentType = "quote",
  config: AppConfig = DEFAULT_APP_CONFIG,
  templateScope: TemplateScope = "quotes",
  sourceKind: SalesTemplateDocumentKind = sourceKindForDocument(documentType),
): Quote => {
  const documentConfig = resolveConfigProfile(config, templateScope, getConfigFormatForDocument(documentType));
  const now = new Date().toISOString();
  const date = today();
  return {
    id: newId(),
    documentType,
    templateScope,
    sourceKind,
    createdAt: now,
    updatedAt: now,
    quoteNumber: createDocumentNumber(documentType, sequence),
    date,
    dueDate: getDefaultDueDate(date, documentType),
    clientName: "",
    clientDetails: "",
    items: isTemplateDocument(documentType) ? createPdfInvoiceItems() : [createItem()],
    taxEnabled: true,
    taxRate: 21,
    discountRate: 0,
    discountAmount: 0,
    notes: "",
    noteItems: [],
    pdfFields: {
      ...DEFAULT_PDF_INVOICE_FIELDS,
      issuerName: documentConfig.templateIssuerName || documentConfig.companyName,
      issuerTaxId: documentConfig.templateIssuerTaxId,
      issuerAddress: documentConfig.templateIssuerAddress,
      issuerCity: documentConfig.templateIssuerCity,
      paymentMethod: "",
      paymentRows: clonePaymentRows(documentConfig.templatePaymentRows),
    },
    taxItems: isTemplateDocument(documentType) ? createPdfTaxItems() : [],
  };
};

const calculateLineAmount = (item: QuoteItem) =>
  item.manualAmountEnabled ? item.manualAmount || 0 : (item.hours || 0) * (item.hourlyRate || 0);

const isWithholdingTax = (item: PdfTaxItem) => /irpf|retenci[oó]n|withholding/i.test(item.label);

const getPdfTaxBase = (item: PdfTaxItem, fallbackBase = 0) => item.base || fallbackBase;

const calculatePdfTaxAmount = (item: PdfTaxItem, fallbackBase = 0) => {
  const amount = getPdfTaxBase(item, fallbackBase) * ((item.rate || 0) / 100);
  return isWithholdingTax(item) ? -Math.abs(amount) : amount;
};

const calculateTotals = (quote: Quote) => {
  const subtotal = quote.items.reduce((sum, item) => sum + calculateLineAmount(item), 0);
  const discountRate = Math.min(Math.max(quote.discountRate || 0, 0), 100);
  const discountRateAmount = Math.min(subtotal, subtotal * (discountRate / 100));
  const fixedDiscountAmount = Math.min(subtotal - discountRateAmount, Math.max(quote.discountAmount || 0, 0));
  const totalDiscount = discountRateAmount + fixedDiscountAmount;
  const discountedSubtotal = subtotal - totalDiscount;
  const taxAmount = quote.taxEnabled ? discountedSubtotal * ((quote.taxRate || 0) / 100) : 0;
  return {
    subtotal,
    discountRate,
    discountRateAmount,
    fixedDiscountAmount,
    totalDiscount,
    discountedSubtotal,
    taxAmount,
    total: discountedSubtotal + taxAmount,
  };
};

const calculatePdfInvoiceTotals = (quote: Quote) => {
  const invoiceTotal = quote.items.reduce((sum, item) => sum + calculateLineAmount(item), 0);
  const taxTotal = quote.taxItems.reduce((sum, item) => sum + calculatePdfTaxAmount(item, invoiceTotal), 0);
  const suplido = quote.pdfFields.suplido || 0;

  return {
    invoiceTotal,
    total: invoiceTotal + taxTotal,
    suplido,
    netTotal: invoiceTotal + taxTotal + suplido,
  };
};

const sanitizeStoredNotes = (notes: string, documentType: DocumentType) => {
  const trimmedNotes = notes.trim();
  if (trimmedNotes === getDocumentConfig(documentType).defaultNotes) {
    return "";
  }

  return notes.trim();
};

const normalizeColor = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

const normalizePercentage = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : fallback;

const sanitizePaymentText = (value: string) => {
  const cleaned = fixMojibake(value);
  return cleaned.replace(/\s/g, "").toLocaleLowerCase("es-ES") === "cuentabancaria:bizum:" ? "" : cleaned;
};

const normalizePaymentRows = (rows: unknown): PdfPaymentRow[] =>
  Array.isArray(rows)
    ? rows.map((row) => {
        const source = row && typeof row === "object" ? (row as Partial<PdfPaymentRow>) : {};
        return {
          id: typeof source.id === "string" && source.id ? source.id : newId(),
          label: typeof source.label === "string" ? sanitizePaymentText(source.label) : "",
          value: typeof source.value === "string" ? sanitizePaymentText(source.value) : "",
        };
      })
    : [];

const createEmptyProfiles = (): AppConfigProfiles => ({
  sales: {
    pdf: {},
    template: {
      templateSectionTitle: "PRODUCTOS Y SERVICIOS",
      templateShowQuantity: true,
    },
  },
  quotes: { pdf: {}, template: {} },
});

const isConfigScope = (value: unknown): value is TemplateScope => value === "sales" || value === "quotes";
const isConfigFormat = (value: unknown): value is ConfigFormat => value === "pdf" || value === "template";

const normalizeConfigPatch = (config: Partial<AppConfigBase> | null | undefined): Partial<AppConfigBase> => {
  if (!config || typeof config !== "object") return {};
  const normalized = normalizeAppConfig(config);
  const patch: Record<string, unknown> = {};

  (Object.keys(DEFAULT_APP_CONFIG) as Array<keyof AppConfigBase | "profiles">).forEach((key) => {
    if (key === "profiles") return;
    if (key in config) {
      patch[key] = normalized[key];
    }
  });

  return patch as Partial<AppConfigBase>;
};

const normalizeAppConfigProfiles = (profiles: unknown): AppConfigProfiles => {
  const normalized = createEmptyProfiles();
  if (!profiles || typeof profiles !== "object") return normalized;
  const source = profiles as Record<string, unknown>;

  (["sales", "quotes"] as const).forEach((scope) => {
    const scopeSource = source[scope];
    if (!scopeSource || typeof scopeSource !== "object") return;
    const scopeRecord = scopeSource as Record<string, unknown>;

    (["pdf", "template"] as const).forEach((format) => {
      const profileSource = scopeRecord[format];
      normalized[scope][format] = {
        ...normalized[scope][format],
        ...normalizeConfigPatch(
          profileSource && typeof profileSource === "object"
            ? (profileSource as Partial<AppConfigBase>)
            : null,
        ),
      };
    });
  });

  return normalized;
};

const normalizeAppConfig = (config: Partial<AppConfig> | null | undefined): AppConfig => ({
  companyName: typeof config?.companyName === "string" ? fixMojibake(config.companyName) : "",
  companyTagline: typeof config?.companyTagline === "string" ? fixMojibake(config.companyTagline) : "",
  logoDataUrl:
    typeof config?.logoDataUrl === "string" && config.logoDataUrl.startsWith("data:image/")
      ? config.logoDataUrl
      : "",
  templateIssuerName:
    typeof config?.templateIssuerName === "string"
      ? fixMojibake(config.templateIssuerName)
      : typeof config?.companyName === "string"
        ? fixMojibake(config.companyName)
        : "",
  templateIssuerTaxId: typeof config?.templateIssuerTaxId === "string" ? fixMojibake(config.templateIssuerTaxId) : "",
  templateIssuerAddress:
    typeof config?.templateIssuerAddress === "string" ? fixMojibake(config.templateIssuerAddress) : "",
  templateIssuerCity: typeof config?.templateIssuerCity === "string" ? fixMojibake(config.templateIssuerCity) : "",
  templatePaymentRows: normalizePaymentRows(config?.templatePaymentRows),
  templateSectionTitle:
    typeof config?.templateSectionTitle === "string" && config.templateSectionTitle.trim()
      ? fixMojibake(config.templateSectionTitle)
      : DEFAULT_APP_CONFIG.templateSectionTitle,
  templateShowQuantity:
    typeof config?.templateShowQuantity === "boolean"
      ? config.templateShowQuantity
      : DEFAULT_APP_CONFIG.templateShowQuantity,
  defaultNotes: typeof config?.defaultNotes === "string" ? fixMojibake(config.defaultNotes) : "",
  quoteFixedNotes:
    typeof config?.quoteFixedNotes === "string"
      ? fixMojibake(config.quoteFixedNotes)
      : typeof config?.defaultNotes === "string"
        ? fixMojibake(config.defaultNotes)
        : "",
  invoiceFixedNotes: typeof config?.invoiceFixedNotes === "string" ? fixMojibake(config.invoiceFixedNotes) : "",
  quotePrepaymentEnabled:
    typeof config?.quotePrepaymentEnabled === "boolean"
      ? config.quotePrepaymentEnabled
      : DEFAULT_APP_CONFIG.quotePrepaymentEnabled,
  quotePrepaymentRate: normalizePercentage(config?.quotePrepaymentRate, DEFAULT_APP_CONFIG.quotePrepaymentRate),
  quotePrepaymentText:
    typeof config?.quotePrepaymentText === "string"
      ? fixMojibake(config.quotePrepaymentText)
      : DEFAULT_APP_CONFIG.quotePrepaymentText,
  paymentDetails: typeof config?.paymentDetails === "string" ? fixMojibake(config.paymentDetails) : "",
  pdfPaymentRows:
    normalizePaymentRows(config?.pdfPaymentRows).length > 0
      ? normalizePaymentRows(config?.pdfPaymentRows)
      : typeof config?.paymentDetails === "string" && config.paymentDetails.trim()
        ? [{ id: newId(), label: "Método de pago", value: fixMojibake(config.paymentDetails) }]
        : [],
  accentColor: normalizeColor(config?.accentColor, DEFAULT_APP_CONFIG.accentColor),
  pageBackgroundColor: normalizeColor(config?.pageBackgroundColor, DEFAULT_APP_CONFIG.pageBackgroundColor),
  clientBoxBackgroundColor: normalizeColor(
    config?.clientBoxBackgroundColor,
    DEFAULT_APP_CONFIG.clientBoxBackgroundColor,
  ),
  profiles: normalizeAppConfigProfiles(config?.profiles),
});

const resolveConfigProfile = (
  config: AppConfig,
  scope: TemplateScope,
  format: ConfigFormat,
): AppConfig => normalizeAppConfig({
  ...config,
  ...(config.profiles[scope]?.[format] ?? {}),
  profiles: config.profiles,
});

const getConfigFormatForDocument = (documentType: DocumentType): ConfigFormat =>
  isTemplateDocument(documentType) ? "template" : "pdf";

const getConfigForDocument = (config: AppConfig, quote: Quote): AppConfig =>
  resolveConfigProfile(config, quote.templateScope, getConfigFormatForDocument(quote.documentType));

const updateConfigProfile = (
  config: AppConfig,
  scope: TemplateScope,
  format: ConfigFormat,
  patch: Partial<AppConfigBase>,
): AppConfig => ({
  ...config,
  profiles: {
    ...config.profiles,
    [scope]: {
      ...config.profiles[scope],
      [format]: {
        ...(config.profiles[scope]?.[format] ?? {}),
        ...patch,
      },
    },
  },
});

const hasStoredAppConfig = () => {
  try {
    return localStorage.getItem(CONFIG_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

const readStoredAppConfig = (): AppConfig => {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_CONFIG;
    return normalizeAppConfig(JSON.parse(raw) as Partial<AppConfig>);
  } catch {
    return DEFAULT_APP_CONFIG;
  }
};

const normalizeQuote = (quote: Partial<Quote> | string): Quote => {
  const parsedQuote = (typeof quote === "string" ? parseJsonIfString<Partial<Quote>>(quote) : null) ?? quote;
  const safeQuote = (parsedQuote && typeof parsedQuote === "object" ? parsedQuote : {}) as Partial<Quote>;
  const documentType: DocumentType =
    safeQuote.documentType === "pdfInvoice"
      ? "pdfInvoice"
      : safeQuote.documentType === "pdfQuote"
        ? "pdfQuote"
        : safeQuote.documentType === "invoice"
          ? "invoice"
          : "quote";
  const sourceKind: SalesTemplateDocumentKind =
    safeQuote.sourceKind === "order" ||
    safeQuote.sourceKind === "delivery-note" ||
    safeQuote.sourceKind === "invoice" ||
    safeQuote.sourceKind === "quote"
      ? safeQuote.sourceKind
      : sourceKindForDocument(documentType);
  const notes =
    typeof safeQuote.notes === "string" ? fixMojibake(safeQuote.notes) : getDocumentConfig(documentType).defaultNotes;
  const parsedItems = parseJsonIfString<Partial<QuoteItem>[]>(safeQuote.items);
  const parsedNoteItems = parseJsonIfString<Partial<QuoteNoteItem>[]>(safeQuote.noteItems);
  const itemsSource = Array.isArray(safeQuote.items) ? safeQuote.items : parsedItems;
  const noteItemsSource = Array.isArray(safeQuote.noteItems) ? safeQuote.noteItems : parsedNoteItems;
  const taxItemsSource = Array.isArray(safeQuote.taxItems) ? safeQuote.taxItems : null;
  const pdfFieldsSource =
    safeQuote.pdfFields && typeof safeQuote.pdfFields === "object" ? safeQuote.pdfFields : null;
  const paymentMethod =
    typeof pdfFieldsSource?.paymentMethod === "string"
      ? fixMojibake(pdfFieldsSource.paymentMethod)
      : DEFAULT_PDF_INVOICE_FIELDS.paymentMethod;
  const iban =
    typeof pdfFieldsSource?.iban === "string" ? fixMojibake(pdfFieldsSource.iban) : DEFAULT_PDF_INVOICE_FIELDS.iban;
  const paymentRowsSource = Array.isArray(pdfFieldsSource?.paymentRows)
    ? pdfFieldsSource.paymentRows
    : createPdfPaymentRows(paymentMethod, iban);

  return {
    ...safeQuote,
    id: typeof safeQuote.id === "string" && safeQuote.id ? stripControlChars(safeQuote.id) : newId(),
    documentType,
    templateScope: isConfigScope(safeQuote.templateScope) ? safeQuote.templateScope : "quotes",
    sourceKind,
    createdAt:
      typeof safeQuote.createdAt === "string" && safeQuote.createdAt
        ? stripControlChars(safeQuote.createdAt)
        : new Date().toISOString(),
    updatedAt:
      typeof safeQuote.updatedAt === "string" && safeQuote.updatedAt
        ? stripControlChars(safeQuote.updatedAt)
        : new Date().toISOString(),
    quoteNumber:
      typeof safeQuote.quoteNumber === "string" && safeQuote.quoteNumber
        ? fixMojibake(safeQuote.quoteNumber)
        : createDocumentNumber(documentType, 1),
    date: typeof safeQuote.date === "string" && safeQuote.date ? stripControlChars(safeQuote.date) : today(),
    dueDate:
      typeof safeQuote.dueDate === "string" && safeQuote.dueDate
        ? stripControlChars(safeQuote.dueDate)
        : getDefaultDueDate(
            typeof safeQuote.date === "string" && safeQuote.date ? stripControlChars(safeQuote.date) : today(),
            documentType,
          ),
    clientName: typeof safeQuote.clientName === "string" ? fixMojibake(safeQuote.clientName) : "",
    clientDetails: typeof safeQuote.clientDetails === "string" ? fixMojibake(safeQuote.clientDetails) : "",
    notes: limitTextLines(sanitizeStoredNotes(notes, documentType)),
    noteItems: Array.isArray(noteItemsSource)
      ? noteItemsSource.slice(0, MAX_NOTE_LINES).map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : newId(),
          text: typeof item.text === "string" ? fixMojibake(item.text) : "",
          hours: typeof item.hours === "number" && Number.isFinite(item.hours) ? item.hours : 0,
        }))
      : [],
    items: Array.isArray(itemsSource)
      ? itemsSource.slice(0, MAX_DOCUMENT_ITEMS).map((item: Partial<QuoteItem>) => ({
          id: typeof item.id === "string" && item.id ? item.id : newId(),
          serviceType: typeof item.serviceType === "string" ? fixMojibake(item.serviceType) : "Servicio",
          description: typeof item.description === "string" ? fixMojibake(item.description) : "",
          hours: typeof item.hours === "number" && Number.isFinite(item.hours) ? item.hours : 0,
          hourlyRate: typeof item.hourlyRate === "number" && Number.isFinite(item.hourlyRate) ? item.hourlyRate : 0,
          manualAmountEnabled: Boolean(item.manualAmountEnabled),
          manualAmount:
            typeof item.manualAmount === "number" && Number.isFinite(item.manualAmount) ? item.manualAmount : 0,
        }))
      : isTemplateDocument(documentType)
        ? createPdfInvoiceItems()
        : [createItem()],
    taxEnabled: Boolean(safeQuote.taxEnabled),
    taxRate: typeof safeQuote.taxRate === "number" && Number.isFinite(safeQuote.taxRate) ? safeQuote.taxRate : 21,
    discountRate:
      typeof safeQuote.discountRate === "number" && Number.isFinite(safeQuote.discountRate) ? safeQuote.discountRate : 0,
    discountAmount:
      typeof safeQuote.discountAmount === "number" && Number.isFinite(safeQuote.discountAmount)
        ? safeQuote.discountAmount
        : 0,
    pdfFields: {
      ...DEFAULT_PDF_INVOICE_FIELDS,
      issuerName:
        typeof pdfFieldsSource?.issuerName === "string"
          ? fixMojibake(pdfFieldsSource.issuerName)
          : DEFAULT_PDF_INVOICE_FIELDS.issuerName,
      issuerTaxId:
        typeof pdfFieldsSource?.issuerTaxId === "string"
          ? fixMojibake(pdfFieldsSource.issuerTaxId)
          : DEFAULT_PDF_INVOICE_FIELDS.issuerTaxId,
      issuerAddress:
        typeof pdfFieldsSource?.issuerAddress === "string"
          ? fixMojibake(pdfFieldsSource.issuerAddress)
          : DEFAULT_PDF_INVOICE_FIELDS.issuerAddress,
      issuerCity:
        typeof pdfFieldsSource?.issuerCity === "string"
          ? fixMojibake(pdfFieldsSource.issuerCity)
          : DEFAULT_PDF_INVOICE_FIELDS.issuerCity,
      paymentMethod,
      iban,
      paymentRows: paymentRowsSource.map((row) => ({
        id: typeof row.id === "string" && row.id ? row.id : newId(),
        label: typeof row.label === "string" ? fixMojibake(row.label) : "Forma de pago",
        value: typeof row.value === "string" ? fixMojibake(row.value) : "",
      })),
      suplido:
        typeof pdfFieldsSource?.suplido === "number" && Number.isFinite(pdfFieldsSource.suplido)
          ? pdfFieldsSource.suplido
          : DEFAULT_PDF_INVOICE_FIELDS.suplido,
    },
    taxItems: Array.isArray(taxItemsSource)
      ? taxItemsSource.map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : newId(),
          label: typeof item.label === "string" ? fixMojibake(item.label) : "IMPUESTO",
          base: typeof item.base === "number" && Number.isFinite(item.base) ? item.base : 0,
          rate: typeof item.rate === "number" && Number.isFinite(item.rate) ? item.rate : 0,
          amount: typeof item.amount === "number" && Number.isFinite(item.amount) ? item.amount : 0,
        }))
      : isTemplateDocument(documentType)
        ? createPdfTaxItems()
        : [],
  };
};

const readStoredQuotes = (): Quote[] => {
  const readQuotesFromKey = (key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((quote) => normalizeQuote(quote));
  };

  try {
    const currentQuotes = readQuotesFromKey(STORAGE_KEY);
    if (currentQuotes.length > 0) return currentQuotes;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === STORAGE_KEY || !key.endsWith("-presupuestos-quotes")) continue;
      const legacyQuotes = readQuotesFromKey(key);
      if (legacyQuotes.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyQuotes));
        return legacyQuotes;
      }
    }

    return [];
  } catch {
    return [];
  }
};

const createInitialQuoteState = () => {
  const stored = readStoredQuotes();
  return {
    hadStoredQuotes: stored.length > 0,
    quotes: stored,
    draftQuote: stored.length > 0 ? null : createQuote(1, "quote", readStoredAppConfig()),
  };
};

type AppLayout = {
  left: number;
  editor: number;
};

const DEFAULT_LAYOUT: AppLayout = {
  left: 274,
  editor: 520,
};

const LAYOUT_FIXED_LEFT = 274;
const LAYOUT_MIN_EDITOR = 360;
const LAYOUT_MAX_EDITOR = 760;
const LAYOUT_MIN_PREVIEW = 320;
const LAYOUT_SHELL_PADDING = 36;
const LAYOUT_GRID_GAPS = 20;
const LAYOUT_RESIZER_WIDTHS = 10;
const LAYOUT_FIXED_WIDTH = LAYOUT_SHELL_PADDING + LAYOUT_GRID_GAPS + LAYOUT_RESIZER_WIDTHS + LAYOUT_MIN_PREVIEW;

const calcEditorMax = (leftWidth: number) =>
  Math.max(LAYOUT_MIN_EDITOR, Math.min(LAYOUT_MAX_EDITOR, window.innerWidth - leftWidth - LAYOUT_FIXED_WIDTH));

const readStoredLayout = (): AppLayout => {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    return {
      left: LAYOUT_FIXED_LEFT,
      editor: clamp(Number(parsed.editor) || DEFAULT_LAYOUT.editor, LAYOUT_MIN_EDITOR, calcEditorMax(LAYOUT_FIXED_LEFT)),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

export function QuotesWorkspace({ initialData }: { initialData: QuotesInitialData }) {
  const { organizationId } = initialData;
  const [, startTransition] = useTransition();

  const initialQuoteState = useMemo(() => {
    if (initialData.documents.length > 0) {
      const quotes = initialData.documents.map((row) => normalizeQuote(row.payload as Partial<Quote>));
      return { hadStoredQuotes: true, quotes, draftQuote: null };
    }
    return createInitialQuoteState();
  }, []);

  const initialConfig = useMemo(() => {
    if (initialData.config !== null) {
      return normalizeAppConfig(initialData.config as Partial<AppConfig>);
    }
    return readStoredAppConfig();
  }, []);

  const [appConfig, setAppConfig] = useState<AppConfig>(initialConfig);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuoteState.quotes);
  const [draftQuote, setDraftQuote] = useState<Quote | null>(initialQuoteState.draftQuote);
  const [openSidebarSections, setOpenSidebarSections] = useState({
    template: false,
    pdf: false,
    history: false,
  });
  const [configTab, setConfigTab] = useState<"pdf" | "template" | "backup">("pdf");
  const [configScope, setConfigScope] = useState<TemplateScope>("sales");
  const [toolbarFeedback, setToolbarFeedback] = useState("");
  const [layout, setLayout] = useState<AppLayout>(readStoredLayout);
  const [activeQuoteId, setActiveQuoteId] = useState(() => quotes[0]?.id ?? "");
  const [historyDialogRoute, setHistoryDialogRoute] = useState<{
    documentType: DocumentType;
    templateScope: TemplateScope;
    sourceKind: SalesTemplateDocumentKind;
    label: string;
  } | null>(null);
  const [historyNameFilter, setHistoryNameFilter] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [hasCompletedConfig, setHasCompletedConfig] = useState(
    () => initialData.config !== null || hasStoredAppConfig()
  );
  const [hasDetectedData, setHasDetectedData] = useState(initialQuoteState.hadStoredQuotes);
  const [configDialogOpen, setConfigDialogOpen] = useState(
    () => initialData.config === null && !hasStoredAppConfig()
  );
  const [configDraft, setConfigDraft] = useState<AppConfig>(initialConfig);
  const importFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const activeQuote = draftQuote ?? quotes.find((quote) => quote.id === activeQuoteId) ?? quotes[0]!;
  const activeQuoteConfig = getConfigForDocument(appConfig, activeQuote);
  const activeConfigFormat: ConfigFormat = configTab === "template" ? "template" : "pdf";
  const activeConfigDraft = resolveConfigProfile(configDraft, configScope, activeConfigFormat);
  const activeDocumentConfig = getDocumentConfig(activeQuote.documentType);
  const totals = useMemo(() => calculateTotals(activeQuote), [activeQuote]);
  const pdfTotals = useMemo(() => calculatePdfInvoiceTotals(activeQuote), [activeQuote]);
  const routeCount = (documentType: DocumentType, templateScope: TemplateScope, sourceKind: SalesTemplateDocumentKind) =>
    quotes.filter((quote) =>
      quote.documentType === documentType &&
      quote.templateScope === templateScope &&
      (quote.sourceKind ?? sourceKindForDocument(quote.documentType)) === sourceKind
    ).length;
  const quoteCount = quotes.filter((quote) => quote.documentType === "quote").length;
  const invoiceCount = quotes.filter((quote) => quote.documentType === "invoice").length;
  const pdfQuoteCount = quotes.filter((quote) => quote.documentType === "pdfQuote").length;
  const pdfInvoiceCount = quotes.filter((quote) => quote.documentType === "pdfInvoice").length;
  const activeNoteItemLines = activeQuote.noteItems.length;
  const activeTextNoteLines = countTextLines(activeQuote.notes);
  const activeNoteLineCount = activeNoteItemLines + activeTextNoteLines;
  const remainingNoteLines = Math.max(MAX_NOTE_LINES - activeNoteItemLines, 0);
  const historyDialogConfig = historyDialogRoute ? getDocumentConfig(historyDialogRoute.documentType) : null;
  const filteredHistoryDocuments = useMemo(() => {
    if (!historyDialogRoute) return [];
    const normalizedNameFilter = historyNameFilter.trim().toLocaleLowerCase("es-ES");

    return quotes.filter((quote) => {
      if (quote.documentType !== historyDialogRoute.documentType) return false;
      if (quote.templateScope !== historyDialogRoute.templateScope) return false;
      if ((quote.sourceKind ?? sourceKindForDocument(quote.documentType)) !== historyDialogRoute.sourceKind) return false;
      if (normalizedNameFilter && !quote.clientName.toLocaleLowerCase("es-ES").includes(normalizedNameFilter)) {
        return false;
      }
      if (historyDateFilter && quote.date !== historyDateFilter) return false;
      return true;
    });
  }, [historyDateFilter, historyDialogRoute, historyNameFilter, quotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(appConfig));
  }, [appConfig]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  // Migrate localStorage data to Supabase on first load if Supabase was empty.
  useEffect(() => {
    if (initialData.documents.length === 0 && initialQuoteState.quotes.length > 0) {
      startTransition(() => {
        void bulkUpsertQuoteDocuments(organizationId, initialQuoteState.quotes.map(quoteToDbRow));
      });
    }
    if (initialData.config === null) {
      const localConfig = readStoredAppConfig();
      startTransition(() => {
        void upsertQuotesConfig(organizationId, localConfig as Record<string, unknown>);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => {
      setLayout((current) => {
        const maxEditor = calcEditorMax(LAYOUT_FIXED_LEFT);
        const nextEditor = Math.min(current.editor, maxEditor);
        if (current.left === LAYOUT_FIXED_LEFT && current.editor === nextEditor) return current;
        return { left: LAYOUT_FIXED_LEFT, editor: nextEditor };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const nextSequence = (documentType: DocumentType) =>
    quotes.filter((quote) => quote.documentType === documentType).length + 1;

  const updateQuote = (patch: Partial<Quote>) => {
    const updatedAt = new Date().toISOString();
    if (draftQuote?.id === activeQuote.id) {
      setDraftQuote({ ...draftQuote, ...patch, updatedAt });
      return;
    }

    setQuotes((current) =>
      current.map((quote) =>
        quote.id === activeQuote.id ? { ...quote, ...patch, updatedAt } : quote,
      ),
    );
  };

  const updateItem = (itemId: string, patch: Partial<QuoteItem>) => {
    updateQuote({
      items: activeQuote.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  };

  const addItem = () => {
    if (activeQuote.items.length >= MAX_DOCUMENT_ITEMS) return;
    updateQuote({ items: [...activeQuote.items, createItem()] });
  };

  const removeItem = (itemId: string) => {
    updateQuote({
      items:
        activeQuote.items.length > 1
          ? activeQuote.items.filter((item) => item.id !== itemId)
          : activeQuote.items,
    });
  };

  const updateNoteItem = (noteItemId: string, patch: Partial<QuoteNoteItem>) => {
    updateQuote({
      noteItems: activeQuote.noteItems.map((item) =>
        item.id === noteItemId ? { ...item, ...patch } : item,
      ),
    });
  };

  const addNoteItem = () => {
    if (activeNoteLineCount >= MAX_NOTE_LINES) return;
    updateQuote({ noteItems: [...activeQuote.noteItems, createNoteItem()] });
  };

  const removeNoteItem = (noteItemId: string) => {
    updateQuote({
      noteItems: activeQuote.noteItems.filter((item) => item.id !== noteItemId),
    });
  };

  const updatePdfFields = (patch: Partial<PdfInvoiceFields>) => {
    updateQuote({
      pdfFields: {
        ...activeQuote.pdfFields,
        ...patch,
      },
    });
  };

  const updatePdfPaymentRow = (rowId: string, patch: Partial<PdfPaymentRow>) => {
    updatePdfFields({
      paymentRows: activeQuote.pdfFields.paymentRows.map((row) =>
        row.id === rowId ? { ...row, ...patch } : row,
      ),
    });
  };

  const addPdfPaymentRow = () => {
    updatePdfFields({
      paymentRows: [...activeQuote.pdfFields.paymentRows, { id: newId(), label: "Forma de pago", value: "" }],
    });
  };

  const removePdfPaymentRow = (rowId: string) => {
    updatePdfFields({
      paymentRows:
        activeQuote.pdfFields.paymentRows.length > 1
          ? activeQuote.pdfFields.paymentRows.filter((row) => row.id !== rowId)
          : activeQuote.pdfFields.paymentRows,
    });
  };

  const updateTaxItem = (taxItemId: string, patch: Partial<PdfTaxItem>) => {
    updateQuote({
      taxItems: activeQuote.taxItems.map((item) => (item.id === taxItemId ? { ...item, ...patch } : item)),
    });
  };

  const addTaxItem = () => {
    updateQuote({
      taxItems: [...activeQuote.taxItems, { id: newId(), label: "IMPUESTO", base: 0, rate: 0, amount: 0 }],
    });
  };

  const removeTaxItem = (taxItemId: string) => {
    updateQuote({
      taxItems: activeQuote.taxItems.length > 1
        ? activeQuote.taxItems.filter((item) => item.id !== taxItemId)
        : activeQuote.taxItems,
    });
  };

  const createNewQuote = (
    documentType: DocumentType = "quote",
    templateScope: TemplateScope = "quotes",
    sourceKind: SalesTemplateDocumentKind = sourceKindForDocument(documentType),
  ) => {
    const quote = createQuote(nextSequence(documentType), documentType, appConfig, templateScope, sourceKind);
    setDraftQuote(quote);
    setActiveQuoteId(quote.id);
  };

  const duplicateQuote = () => {
    const now = new Date().toISOString();
    const duplicated: Quote = {
      ...activeQuote,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      quoteNumber: `${activeQuote.quoteNumber}-COPIA`,
      items: activeQuote.items.map((item) => ({ ...item, id: newId() })),
      taxItems: activeQuote.taxItems.map((item) => ({ ...item, id: newId() })),
      pdfFields: { ...activeQuote.pdfFields },
    };
    setDraftQuote(duplicated);
    setActiveQuoteId(duplicated.id);
  };

  const deleteQuote = () => {
    if (draftQuote?.id === activeQuote.id) {
      const quote = createQuote(1, "quote", appConfig);
      setDraftQuote(quote);
      setActiveQuoteId(quote.id);
      return;
    }

    startTransition(() => { void deleteQuoteDocument(organizationId, activeQuote.id); });

    const remaining = quotes.filter((quote) => quote.id !== activeQuote.id);
    setQuotes(remaining);
    if (remaining.length > 0) {
      setActiveQuoteId(remaining[0]!.id);
      return;
    }

    const quote = createQuote(1, "quote", appConfig);
    setDraftQuote(quote);
    setActiveQuoteId(quote.id);
    setHasDetectedData(false);
  };

  const saveQuote = () => {
    const now = new Date().toISOString();
    const savedQuote = { ...activeQuote, updatedAt: now };

    setQuotes((current) => {
      const exists = current.some((quote) => quote.id === savedQuote.id);
      return exists
        ? current.map((quote) => (quote.id === savedQuote.id ? savedQuote : quote))
        : [savedQuote, ...current];
    });
    setDraftQuote(null);
    setActiveQuoteId(savedQuote.id);
    setHasDetectedData(true);
    startTransition(() => {
      void upsertQuoteDocument(organizationId, quoteToDbRow(savedQuote));
    });
  };

  const exportHistory = () => {
    const payload: HistoryExportPayload = {
      format: "documents-backup-v1",
      exportedAt: new Date().toISOString(),
      appVersion: "2.0.0",
      quotes,
      config: appConfig,
      layout,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `copia-documentos-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importHistoryFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as Partial<HistoryExportPayload> | Quote[];
      const importedFormat = Array.isArray(parsed) ? "" : typeof parsed.format === "string" ? parsed.format : "";
      const incomingQuotes = Array.isArray(parsed)
        ? parsed
        : (importedFormat === "documents-backup-v1" ||
              importedFormat === "documents-history-v1" ||
              importedFormat.endsWith("-history-v1")) &&
            Array.isArray(parsed.quotes)
          ? parsed.quotes
          : null;

      if (!incomingQuotes) {
        window.alert("El archivo no es un historial válido.");
        return;
      }

      const normalizedIncoming = incomingQuotes.map((quote) => normalizeQuote(quote));
      const mergedMap = new Map<string, Quote>();
      quotes.forEach((quote) => mergedMap.set(quote.id, quote));
      normalizedIncoming.forEach((quote) => {
        const current = mergedMap.get(quote.id);
        if (!current || new Date(quote.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) {
          mergedMap.set(quote.id, quote);
        }
      });

      const mergedQuotes = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      if (mergedQuotes.length === 0) {
        window.alert("No se encontraron documentos válidos para importar.");
        return;
      }

      setQuotes(mergedQuotes);
      setHasDetectedData(true);
      setActiveQuoteId((currentId) => (mergedMap.has(currentId) ? currentId : mergedQuotes[0]!.id));
      startTransition(() => {
        void bulkUpsertQuoteDocuments(organizationId, mergedQuotes.map(quoteToDbRow));
      });
      let importedConfig = false;
      if (!Array.isArray(parsed) && parsed.config && typeof parsed.config === "object") {
        const nextConfig = normalizeAppConfig(parsed.config);
        setAppConfig(nextConfig);
        setConfigDraft(nextConfig);
        setHasCompletedConfig(true);
        setConfigDialogOpen(false);
        importedConfig = true;
        startTransition(() => {
          void upsertQuotesConfig(organizationId, nextConfig as unknown as Record<string, unknown>);
        });
      }

        if (!Array.isArray(parsed) && parsed.layout && typeof parsed.layout === "object") {
          setLayout({
            left: LAYOUT_FIXED_LEFT,
            editor: clamp(
              Number(parsed.layout.editor) || DEFAULT_LAYOUT.editor,
              LAYOUT_MIN_EDITOR,
              calcEditorMax(LAYOUT_FIXED_LEFT),
            ),
          });
        }

      window.alert(
        `Importación completada: ${normalizedIncoming.length} documento(s) procesado(s)${
          importedConfig ? " y configuración recuperada" : ""
        }.`,
      );
    } catch {
      window.alert("No se pudo leer el archivo. Revisa que sea un JSON válido.");
    } finally {
      event.target.value = "";
    }
  };

  const openConfigDialog = () => {
    setConfigDraft(appConfig);
    setConfigDialogOpen(true);
  };

  const updateConfigDraft = (patch: Partial<AppConfigBase>) => {
    setConfigDraft((current) => updateConfigProfile(current, configScope, activeConfigFormat, patch));
  };

  const addConfigPaymentRow = (key: "pdfPaymentRows" | "templatePaymentRows") => {
    setConfigDraft((current) => {
      const currentProfile = resolveConfigProfile(current, configScope, activeConfigFormat);
      return updateConfigProfile(current, configScope, activeConfigFormat, {
        [key]: [...currentProfile[key], { id: newId(), label: "", value: "" }],
      });
    });
  };

  const updateConfigPaymentRow = (
    key: "pdfPaymentRows" | "templatePaymentRows",
    rowId: string,
    patch: Partial<PdfPaymentRow>,
  ) => {
    setConfigDraft((current) => {
      const currentProfile = resolveConfigProfile(current, configScope, activeConfigFormat);
      return updateConfigProfile(current, configScope, activeConfigFormat, {
        [key]: currentProfile[key].map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
      });
    });
  };

  const removeConfigPaymentRow = (key: "pdfPaymentRows" | "templatePaymentRows", rowId: string) => {
    setConfigDraft((current) => {
      const currentProfile = resolveConfigProfile(current, configScope, activeConfigFormat);
      return updateConfigProfile(current, configScope, activeConfigFormat, {
        [key]: currentProfile[key].filter((row) => row.id !== rowId),
      });
    });
  };

  const handleLogoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Selecciona una imagen válida para el logo.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateConfigDraft({ logoDataUrl: typeof reader.result === "string" ? reader.result : "" });
    };
    reader.onerror = () => window.alert("No se pudo cargar la imagen.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const saveAppConfig = () => {
    const nextConfig = normalizeAppConfig(configDraft);
    setAppConfig(nextConfig);
    setQuotes((current) =>
      current.map((quote) => {
        if (isTemplateDocument(quote.documentType)) {
          const documentConfig = getConfigForDocument(nextConfig, quote);
          return {
            ...quote,
            pdfFields: {
              ...quote.pdfFields,
              issuerName: quote.pdfFields.issuerName || documentConfig.templateIssuerName || documentConfig.companyName,
              issuerTaxId: quote.pdfFields.issuerTaxId || documentConfig.templateIssuerTaxId,
              issuerAddress: quote.pdfFields.issuerAddress || documentConfig.templateIssuerAddress,
              issuerCity: quote.pdfFields.issuerCity || documentConfig.templateIssuerCity,
              paymentMethod: quote.pdfFields.paymentMethod,
              paymentRows:
                quote.pdfFields.paymentRows.length > 0
                  ? quote.pdfFields.paymentRows
                  : clonePaymentRows(documentConfig.templatePaymentRows),
            },
          };
        }

        return quote;
      }),
    );
    setDraftQuote((current) =>
      current && isTemplateDocument(current.documentType)
        ? {
            ...current,
            pdfFields: {
              ...current.pdfFields,
              issuerName: getConfigForDocument(nextConfig, current).templateIssuerName || getConfigForDocument(nextConfig, current).companyName,
              issuerTaxId: getConfigForDocument(nextConfig, current).templateIssuerTaxId,
              issuerAddress: getConfigForDocument(nextConfig, current).templateIssuerAddress,
              issuerCity: getConfigForDocument(nextConfig, current).templateIssuerCity,
              paymentMethod: "",
              paymentRows: clonePaymentRows(getConfigForDocument(nextConfig, current).templatePaymentRows),
            },
          }
        : current,
    );
    setConfigDialogOpen(false);
    setHasCompletedConfig(true);
    startTransition(() => {
      void upsertQuotesConfig(organizationId, nextConfig as unknown as Record<string, unknown>);
    });
  };

  const openHistoryDialog = (
    documentType: DocumentType,
    templateScope: TemplateScope,
    sourceKind: SalesTemplateDocumentKind,
    label: string,
  ) => {
    setHistoryDialogRoute({ documentType, templateScope, sourceKind, label });
    setHistoryNameFilter("");
    setHistoryDateFilter("");
  };

  const selectHistoryDocument = (quoteId: string) => {
    setDraftQuote(null);
    setActiveQuoteId(quoteId);
    setHistoryDialogRoute(null);
  };

  const deleteHistoryDocument = (quoteId: string) => {
    const target = quotes.find((quote) => quote.id === quoteId);
    if (!target) return;
    const documentLabel = `${getDocumentConfig(target.documentType).listLabel} ${target.quoteNumber}`;
    const clientLabel = target.clientName.trim() || "Cliente sin nombre";

    if (!window.confirm(`¿Eliminar ${documentLabel} de ${clientLabel}?`)) return;

    startTransition(() => { void deleteQuoteDocument(organizationId, quoteId); });

    const remaining = quotes.filter((quote) => quote.id !== quoteId);
    if (remaining.length === 0) {
      const fallback = createQuote(1, "quote", appConfig);
      setQuotes([]);
      setDraftQuote(fallback);
      setActiveQuoteId(fallback.id);
      setHistoryDialogRoute(null);
      setHasDetectedData(false);
      return;
    }

    setQuotes(remaining);
    if (draftQuote?.id === quoteId) {
      setDraftQuote(null);
    }
    setActiveQuoteId((currentId) => (currentId === quoteId ? remaining[0]!.id : currentId));
  };

  const updateDocumentType = (documentType: DocumentType) => {
    if (documentType === activeQuote.documentType) return;
    const documentConfig = resolveConfigProfile(appConfig, activeQuote.templateScope, getConfigFormatForDocument(documentType));
    updateQuote({
      documentType,
      quoteNumber: createDocumentNumber(documentType, nextSequence(documentType)),
      dueDate: getDefaultDueDate(activeQuote.date || today(), documentType),
      items: isTemplateDocument(documentType) ? createPdfInvoiceItems() : activeQuote.items,
      taxItems: isTemplateDocument(documentType) ? createPdfTaxItems() : [],
      pdfFields:
        isTemplateDocument(documentType)
            ? {
                ...DEFAULT_PDF_INVOICE_FIELDS,
                issuerName: documentConfig.templateIssuerName || documentConfig.companyName,
                issuerTaxId: documentConfig.templateIssuerTaxId,
                issuerAddress: documentConfig.templateIssuerAddress,
                issuerCity: documentConfig.templateIssuerCity,
                paymentMethod: "",
                paymentRows: clonePaymentRows(documentConfig.templatePaymentRows),
              }
          : activeQuote.pdfFields,
      notes:
        activeQuote.notes === getDocumentConfig(activeQuote.documentType).defaultNotes
          ? ""
          : activeQuote.notes,
    });
  };

  const startResize = (panel: keyof AppLayout) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startValue = layout[panel];
    const dynamicEditorMax = panel === "editor" ? calcEditorMax(LAYOUT_FIXED_LEFT) : layout.editor;
    const limits = { min: LAYOUT_MIN_EDITOR, max: dynamicEditorMax };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextValue = clamp(startValue + moveEvent.clientX - startX, limits.min, limits.max);
      setLayout((current) => ({ ...current, [panel]: nextValue }));
    };

    const stopResize = () => {
      document.body.classList.remove("is-resizing-layout");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };

    document.body.classList.add("is-resizing-layout");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
  };

  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  const runToolbarAction = (actionName: string, action: () => void) => {
    action();
    setToolbarFeedback(actionName);
    window.setTimeout(() => {
      setToolbarFeedback((current) => (current === actionName ? "" : current));
    }, 900);
  };

  const toggleSidebarSection = (section: keyof typeof openSidebarSections) => {
    setOpenSidebarSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const layoutStyle = {
    "--left-panel-width": `${layout.left}px`,
    "--editor-panel-width": `${layout.editor}px`,
  } as CSSProperties;

  return (
    <div className="quotes-shell">
      <main className="app-shell" style={layoutStyle}>
      <aside className="history-panel no-print" aria-label="Historial de documentos">
        <div className="brand-block">
          <h1>Documentos</h1>
          {activeQuoteConfig.companyName.trim() && <p>{activeQuoteConfig.companyName}</p>}
        </div>

        <div className="template-section">
          <div className="section-title">Configuración</div>
          <button className="config-action" type="button" onClick={openConfigDialog}>
            <Settings aria-hidden="true" size={17} />
            Ajustes generales
          </button>
        </div>

        <div className="template-section">
          <button
            className={`section-title section-toggle ${openSidebarSections.template ? "is-open" : ""}`}
            type="button"
            aria-expanded={openSidebarSections.template}
            onClick={() => toggleSidebarSection("template")}
          >
            <span>Plantilla Ventas</span>
            <span className="accordion-indicator" aria-hidden="true" />
          </button>
          {openSidebarSections.template && (
            <div className="sidebar-section-content">
              {salesTemplateRoutes.map((route) => (
                <button
                  className="history-category-card template-card"
                  key={`template-${route.kind}`}
                  type="button"
                  onClick={() => createNewQuote(route.templateType, "sales", route.kind)}
                >
                  <span>{route.label}</span>
                  <strong>PL</strong>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="template-section">
          <button
            className={`section-title section-toggle ${openSidebarSections.pdf ? "is-open" : ""}`}
            type="button"
            aria-expanded={openSidebarSections.pdf}
            onClick={() => toggleSidebarSection("pdf")}
          >
            <span>Formato PDF</span>
            <span className="accordion-indicator" aria-hidden="true" />
          </button>
          {openSidebarSections.pdf && (
            <div className="sidebar-section-content">
              {salesTemplateRoutes.map((route) => (
                <button
                  className="history-category-card template-card"
                  key={`pdf-${route.kind}`}
                  type="button"
                  onClick={() => createNewQuote(route.pdfType, "sales", route.kind)}
                >
                  <span>{route.label}</span>
                  <strong>PDF</strong>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="history-list">
          <button
            className={`section-title section-toggle ${openSidebarSections.history ? "is-open" : ""}`}
            type="button"
            aria-expanded={openSidebarSections.history}
            onClick={() => toggleSidebarSection("history")}
          >
            <span>Historial</span>
            <span className="accordion-indicator" aria-hidden="true" />
          </button>
          {openSidebarSections.history && (
            <div className="sidebar-section-content">
              <div className="sidebar-subgroup-title">Plantilla Ventas</div>
              {salesTemplateRoutes.map((route) => (
                <button
                  className="history-category-card"
                  key={`history-template-${route.kind}`}
                  type="button"
                  onClick={() => openHistoryDialog(route.templateType, "sales", route.kind, `Plantilla Ventas · ${route.label}`)}
                >
                  <span>{route.label}</span>
                  <strong>{routeCount(route.templateType, "sales", route.kind)}</strong>
                </button>
              ))}
              <div className="sidebar-subgroup-title">PDF</div>
              {salesTemplateRoutes.map((route) => (
                <button
                  className="history-category-card"
                  key={`history-pdf-${route.kind}`}
                  type="button"
                  onClick={() => openHistoryDialog(route.pdfType, "sales", route.kind, `PDF · ${route.label}`)}
                >
                  <span>{route.label}</span>
                  <strong>{routeCount(route.pdfType, "sales", route.kind)}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {historyDialogRoute && historyDialogConfig && (
        <div className="history-modal-backdrop no-print" role="presentation" onClick={() => setHistoryDialogRoute(null)}>
          <section
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="history-modal-header">
              <div>
                <span>Historial</span>
                <h2 id="history-modal-title">{historyDialogRoute.label}</h2>
              </div>
              <button type="button" onClick={() => setHistoryDialogRoute(null)} title="Cerrar">
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="history-filters">
              <label>
                Nombre
                <input
                  placeholder="Buscar por cliente"
                  value={historyNameFilter}
                  onChange={(event) => setHistoryNameFilter(event.target.value)}
                />
              </label>
              <label>
                Fecha
                <input
                  type="date"
                  value={historyDateFilter}
                  onChange={(event) => setHistoryDateFilter(event.target.value)}
                />
              </label>
            </div>

            <div className="history-modal-list">
              {filteredHistoryDocuments.length > 0 ? (
                filteredHistoryDocuments.map((quote) => (
                  <div className="history-document-row" key={quote.id}>
                    <button
                      className={`quote-list-item ${quote.id === activeQuote.id ? "is-active" : ""}`}
                      type="button"
                      onClick={() => selectHistoryDocument(quote.id)}
                    >
                      <span>{getDocumentConfig(quote.documentType).listLabel}</span>
                      <span>{quote.quoteNumber}</span>
                      <strong>{quote.clientName || "Cliente sin nombre"}</strong>
                      <small>{formatDate(quote.date)}</small>
                    </button>
                    <button
                      className="history-delete-button"
                      type="button"
                      onClick={() => deleteHistoryDocument(quote.id)}
                      title="Eliminar documento"
                      aria-label={`Eliminar ${getDocumentConfig(quote.documentType).listLabel} ${quote.quoteNumber}`}
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="history-empty-state">
                  <Search aria-hidden="true" size={20} />
                  <p>No hay resultados con esos filtros.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {configDialogOpen && (
        <div
          className="history-modal-backdrop no-print"
          role="presentation"
        >
          <section
            className="history-modal config-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="history-modal-header">
              <div>
                <span>{hasCompletedConfig ? "Configuración" : "Primer uso"}</span>
                <h2 id="config-modal-title">Personaliza tus documentos</h2>
              </div>
              {hasCompletedConfig && (
                <button type="button" onClick={() => setConfigDialogOpen(false)} title="Cerrar">
                  <X aria-hidden="true" size={18} />
                </button>
              )}
            </div>

            <div className="config-tabs" role="tablist" aria-label="Tipos de formato">
              <button
                className={configTab === "pdf" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={configTab === "pdf"}
                onClick={() => setConfigTab("pdf")}
              >
                Formato PDF
              </button>
              <button
                className={configTab === "template" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={configTab === "template"}
                onClick={() => setConfigTab("template")}
              >
                Formato Plantilla
              </button>
              <button
                className={configTab === "backup" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={configTab === "backup"}
                onClick={() => setConfigTab("backup")}
              >
                Backup
              </button>
            </div>

            {configTab !== "backup" ? (
              <div className="config-scope-tabs" role="tablist" aria-label="Destino de la plantilla">
                <button
                  className={configScope === "sales" ? "is-active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={configScope === "sales"}
                  onClick={() => setConfigScope("sales")}
                >
                  Ventas
                </button>
                <button
                  className={configScope === "quotes" ? "is-active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={configScope === "quotes"}
                  onClick={() => setConfigScope("quotes")}
                >
                  Presupuestos
                </button>
              </div>
            ) : null}

            {configTab === "pdf" ? (
              <>
                <div className="config-logo-row">
                  <div className="config-logo-preview">
                    {activeConfigDraft.logoDataUrl ? (
                      <img src={activeConfigDraft.logoDataUrl} alt="" />
                    ) : (
                      <OrbLogo size={62} />
                    )}
                  </div>
                  <div className="config-logo-actions">
                    <button type="button" onClick={() => logoFileRef.current?.click()}>
                      <ImageIcon aria-hidden="true" size={17} />
                      Subir logo
                    </button>
                    {activeConfigDraft.logoDataUrl && (
                      <button type="button" onClick={() => updateConfigDraft({ logoDataUrl: "" })}>
                        Quitar
                      </button>
                    )}
                  </div>
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/*"
                    className="no-print"
                    style={{ display: "none" }}
                    onChange={handleLogoFile}
                  />
                </div>

                <div className="form-grid">
                  <label>
                    Nombre de la empresa
                    <input
                      autoFocus
                      value={activeConfigDraft.companyName}
                      onChange={(event) => updateConfigDraft({ companyName: event.target.value })}
                    />
                  </label>
                  <label>
                    Actividad o subtítulo
                    <input
                      placeholder="Opcional"
                      value={activeConfigDraft.companyTagline}
                      onChange={(event) => updateConfigDraft({ companyTagline: event.target.value })}
                    />
                  </label>
                </div>

                <div className="config-fixed-notes-section">
                  <div className="card-heading">
                    <h2>Notas fijas</h2>
                  </div>
                  <label>
                    Para presupuestos
                    <textarea
                      className="large-textarea"
                      placeholder="Condiciones fijas que solo aparecerán en presupuestos."
                      value={activeConfigDraft.quoteFixedNotes}
                      onChange={(event) => updateConfigDraft({ quoteFixedNotes: event.target.value })}
                    />
                  </label>
                  <div className="prepayment-config">
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={activeConfigDraft.quotePrepaymentEnabled}
                        onChange={(event) => updateConfigDraft({ quotePrepaymentEnabled: event.target.checked })}
                      />
                      Mostrar porcentaje si vas a cobrar por adelantado en los presupuestos
                    </label>
                    {activeConfigDraft.quotePrepaymentEnabled && (
                      <div className="prepayment-config-fields">
                        <label className="compact-label">
                          Porcentaje
                          <input
                            className="prepayment-rate-input"
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={numericInputValue(activeConfigDraft.quotePrepaymentRate)}
                            onChange={(event) =>
                              updateConfigDraft({
                                quotePrepaymentRate: normalizePercentage(
                                  parseNumericInput(event.target.value),
                                  DEFAULT_APP_CONFIG.quotePrepaymentRate,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Texto
                          <textarea
                            placeholder={DEFAULT_QUOTE_PREPAYMENT_TEXT}
                            value={activeConfigDraft.quotePrepaymentText}
                            onChange={(event) => updateConfigDraft({ quotePrepaymentText: event.target.value })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <label>
                    Para facturas
                    <textarea
                      placeholder="Texto fijo que solo aparecerá en facturas."
                      value={activeConfigDraft.invoiceFixedNotes}
                      onChange={(event) => updateConfigDraft({ invoiceFixedNotes: event.target.value })}
                    />
                  </label>
                </div>

                <div className="config-payment-section">
                  <div className="card-heading">
                    <h2>Método de pago</h2>
                    <div className="inline-actions">
                      <button type="button" onClick={() => addConfigPaymentRow("pdfPaymentRows")} aria-label="Añadir método de pago PDF">
                        +
                      </button>
                    </div>
                  </div>
                  <div className="pdf-payment-rows-editor">
                    {activeConfigDraft.pdfPaymentRows.map((row) => (
                      <div className="pdf-payment-row-editor" key={row.id}>
                        <label>
                          Tipo
                          <input
                            placeholder="Bizum, Cuenta bancaria..."
                            value={row.label}
                            onChange={(event) =>
                              updateConfigPaymentRow("pdfPaymentRows", row.id, { label: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          Número o valor fijo
                          <input
                            placeholder="Número de Bizum, IBAN..."
                            value={row.value}
                            onChange={(event) =>
                              updateConfigPaymentRow("pdfPaymentRows", row.id, { value: event.target.value })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeConfigPaymentRow("pdfPaymentRows", row.id)}
                          title="Eliminar fila"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </div>
                    ))}
                    {activeConfigDraft.pdfPaymentRows.length === 0 && (
                      <p className="empty-helper-text">No hay métodos configurados. Pulsa + para añadir uno.</p>
                    )}
                  </div>
                </div>

                <div className="config-style-section">
                  <div className="card-heading">
                    <h2>Colores</h2>
                  </div>

                  <label>
                    Color del texto destacado
                    <div className="color-control-row">
                      <input
                        className="native-color-input"
                        type="color"
                        value={activeConfigDraft.accentColor}
                        onChange={(event) => updateConfigDraft({ accentColor: event.target.value })}
                      />
                      <input
                        value={activeConfigDraft.accentColor}
                        onChange={(event) => updateConfigDraft({ accentColor: event.target.value })}
                      />
                    </div>
                  </label>
                  <div className="color-swatch-grid" aria-label="Gama cromática">
                    {ACCENT_COLOR_OPTIONS.map((color) => (
                      <button
                        className={activeConfigDraft.accentColor.toLowerCase() === color ? "is-selected" : ""}
                        key={color}
                        type="button"
                        style={{ backgroundColor: color }}
                        onClick={() => updateConfigDraft({ accentColor: color })}
                        title={color}
                      />
                    ))}
                  </div>

                  <div className="background-options-grid">
                    <fieldset>
                      <legend>Fondo del documento</legend>
                      <div className="background-swatch-list">
                        {DOCUMENT_BACKGROUND_OPTIONS.map((option) => (
                          <button
                            className={activeConfigDraft.pageBackgroundColor.toLowerCase() === option.value ? "is-selected" : ""}
                            key={option.value}
                            type="button"
                            onClick={() => updateConfigDraft({ pageBackgroundColor: option.value })}
                          >
                            <span style={{ backgroundColor: option.value }} />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend>Caja del cliente</legend>
                      <div className="background-swatch-list">
                        {CLIENT_BOX_BACKGROUND_OPTIONS.map((option) => (
                          <button
                            className={
                              activeConfigDraft.clientBoxBackgroundColor.toLowerCase() === option.value ? "is-selected" : ""
                            }
                            key={option.value}
                            type="button"
                            onClick={() => updateConfigDraft({ clientBoxBackgroundColor: option.value })}
                          >
                            <span style={{ backgroundColor: option.value }} />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </div>
              </>
            ) : configTab === "template" ? (
              <div className="config-template-section">
                <div className="form-grid">
                  <label>
                    Título del bloque central
                    <input
                      placeholder="PRESUPUESTO"
                      value={activeConfigDraft.templateSectionTitle}
                      onChange={(event) => updateConfigDraft({ templateSectionTitle: event.target.value })}
                    />
                  </label>
                  <label className="switch-row template-quantity-toggle">
                    <input
                      type="checkbox"
                      checked={activeConfigDraft.templateShowQuantity}
                      onChange={(event) => updateConfigDraft({ templateShowQuantity: event.target.checked })}
                    />
                    Mostrar cantidad en el bloque central
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    Quién emite la factura
                    <input
                      value={activeConfigDraft.templateIssuerName}
                      onChange={(event) => updateConfigDraft({ templateIssuerName: event.target.value })}
                    />
                  </label>
                  <label>
                    CIF
                    <input
                      value={activeConfigDraft.templateIssuerTaxId}
                      onChange={(event) => updateConfigDraft({ templateIssuerTaxId: event.target.value })}
                    />
                  </label>
                  <label>
                    Domicilio
                    <input
                      value={activeConfigDraft.templateIssuerAddress}
                      onChange={(event) => updateConfigDraft({ templateIssuerAddress: event.target.value })}
                    />
                  </label>
                  <label>
                    Ciudad
                    <input
                      value={activeConfigDraft.templateIssuerCity}
                      onChange={(event) => updateConfigDraft({ templateIssuerCity: event.target.value })}
                    />
                  </label>
                </div>
                <div className="card-heading">
                  <h2>Cuentas bancarias</h2>
                  <div className="inline-actions">
                    <button
                      type="button"
                      onClick={() => addConfigPaymentRow("templatePaymentRows")}
                      aria-label="Añadir cuenta bancaria"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="pdf-payment-rows-editor">
                  {activeConfigDraft.templatePaymentRows.map((row) => (
                    <div className="pdf-payment-row-editor" key={row.id}>
                      <label>
                        Tipo
                        <input
                          placeholder="Bizum, Cuenta bancaria..."
                          value={row.label}
                          onChange={(event) =>
                            updateConfigPaymentRow("templatePaymentRows", row.id, { label: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Número o valor fijo
                        <input
                          placeholder="Número de Bizum, IBAN..."
                          value={row.value}
                          onChange={(event) =>
                            updateConfigPaymentRow("templatePaymentRows", row.id, { value: event.target.value })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeConfigPaymentRow("templatePaymentRows", row.id)}
                        title="Eliminar fila"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  ))}
                  {activeConfigDraft.templatePaymentRows.length === 0 && (
                    <p className="empty-helper-text">No hay cuentas configuradas. Pulsa + para añadir una.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="config-data-section">
                <div className="card-heading">
                  <h2>Backup</h2>
                </div>
                <p>
                  {hasDetectedData
                    ? `${pdfQuoteCount} presupuesto(s) plantilla, ${quoteCount} presupuesto(s) PDF, ${pdfInvoiceCount} factura(s) plantilla y ${invoiceCount} factura(s) PDF guardadas.`
                    : "No se ha detectado historial guardado en esta instalación."}
                </p>
                <div className="config-data-actions">
                  <button type="button" onClick={() => importFileRef.current?.click()}>
                    Importar historial
                  </button>
                  <button type="button" onClick={exportHistory} disabled={quotes.length === 0}>
                    Exportar copia
                  </button>
                </div>
              </div>
            )}

            <div className="config-modal-actions">
              <button className="primary-action" type="button" onClick={saveAppConfig}>
                Guardar configuración
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="editor-panel no-print" aria-label="Editor del documento">
        <div className="toolbar">
          <button
            className={toolbarFeedback === "guardar" ? "is-confirmed" : ""}
            type="button"
            onClick={() => runToolbarAction("guardar", saveQuote)}
            title="Guardar documento"
          >
            Guardar
          </button>
          <button
            className={toolbarFeedback === "duplicar" ? "is-confirmed" : ""}
            type="button"
            onClick={() => runToolbarAction("duplicar", duplicateQuote)}
            title="Duplicar documento"
          >
            Duplicar
          </button>
          <button
            className={toolbarFeedback === "exportar" ? "is-confirmed" : ""}
            type="button"
            onClick={() => runToolbarAction("exportar", exportHistory)}
            title="Exportar historial en JSON"
          >
            Exportar
          </button>
          <button
            className={toolbarFeedback === "importar" ? "is-confirmed" : ""}
            type="button"
            onClick={() => runToolbarAction("importar", () => importFileRef.current?.click())}
            title="Importar historial en JSON"
          >
            Importar
          </button>
          <button
            className={toolbarFeedback === "imprimir" ? "is-confirmed" : ""}
            type="button"
            onClick={() => runToolbarAction("imprimir", () => window.print())}
            title="Imprimir o guardar en PDF"
          >
            Imprimir
          </button>
          <button
            className={`danger-button ${toolbarFeedback === "eliminar" ? "is-confirmed" : ""}`}
            type="button"
            onClick={() => runToolbarAction("eliminar", deleteQuote)}
            title="Eliminar documento"
          >
            <Trash2 aria-hidden="true" size={18} />
            Eliminar
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            className="no-print"
            style={{ display: "none" }}
            onChange={importHistoryFromFile}
          />
        </div>

        {isTemplateDocument(activeQuote.documentType) ? (
          <>
            <div className="form-card">
              <div className="card-heading">
                <h2>Cliente</h2>
              </div>
              <div className="form-grid">
                <label>
                  Nombre
                  <input
                    value={activeQuote.clientName}
                    onChange={(event) => updateQuote({ clientName: event.target.value })}
                  />
                </label>
                <label>
                  CIF/NIF
                  <input
                    value={activeQuote.clientDetails.split("\n")[0] ?? ""}
                    onChange={(event) => {
                      const [, address = "", city = "", phone = "", email = ""] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [event.target.value, address, city, phone, email].join("\n") });
                    }}
                  />
                </label>
                <label>
                  Dirección
                  <input
                    value={activeQuote.clientDetails.split("\n")[1] ?? ""}
                    onChange={(event) => {
                      const [taxId = "", , city = "", phone = "", email = ""] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [taxId, event.target.value, city, phone, email].join("\n") });
                    }}
                  />
                </label>
                <label>
                  Ciudad
                  <input
                    value={activeQuote.clientDetails.split("\n")[2] ?? ""}
                    onChange={(event) => {
                      const [taxId = "", address = "", , phone = "", email = ""] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [taxId, address, event.target.value, phone, email].join("\n") });
                    }}
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    value={activeQuote.clientDetails.split("\n")[3] ?? ""}
                    onChange={(event) => {
                      const [taxId = "", address = "", city = "", , email = ""] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [taxId, address, city, event.target.value, email].join("\n") });
                    }}
                  />
                </label>
                <label>
                  E-mail
                  <input
                    value={activeQuote.clientDetails.split("\n")[4] ?? ""}
                    onChange={(event) => {
                      const [taxId = "", address = "", city = "", phone = ""] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [taxId, address, city, phone, event.target.value].join("\n") });
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="form-card">
              <div className="card-heading">
                <h2>{activeDocumentConfig.title}</h2>
              </div>
              <div className="form-grid">
                <label>
                  {activeDocumentConfig.numberLabel}
                  <input
                    value={activeQuote.quoteNumber}
                    onChange={(event) => updateQuote({ quoteNumber: event.target.value })}
                  />
                </label>
                <label>
                  {isInvoiceDocument(activeQuote.documentType) ? "Fecha emisión" : "Fecha presupuesto"}
                  <input
                    type="date"
                    value={activeQuote.date}
                    onChange={(event) => updateQuote({ date: event.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="form-card">
              <div className="card-heading">
                <h2>Descripción</h2>
                <div className="inline-actions">
                  <button type="button" onClick={addItem} disabled={activeQuote.items.length >= MAX_DOCUMENT_ITEMS}>
                    Añadir {activeQuote.items.length}/{MAX_DOCUMENT_ITEMS}
                  </button>
                </div>
              </div>
              <div className="items-editor">
                {activeQuote.items.map((item) => (
                  <article className="item-editor pdf-item-editor" key={item.id}>
                    <div className="item-topline">
                      <label className="service-title-field">
                        Concepto
                        <input
                          value={item.serviceType}
                          onChange={(event) => updateItem(item.id, { serviceType: event.target.value })}
                        />
                      </label>
                      <button type="button" onClick={() => removeItem(item.id)} title="Eliminar concepto">
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                    <div className="pdf-line-grid">
                      <label>
                        Línea adicional
                        <input
                          value={item.description}
                          onChange={(event) => updateItem(item.id, { description: event.target.value })}
                        />
                      </label>
                      <label>
                        Importe
                        <input
                          type="number"
                          step="0.01"
                          value={numericInputValue(item.manualAmount)}
                          onChange={(event) =>
                            updateItem(item.id, {
                              manualAmountEnabled: true,
                              manualAmount: parseNumericInput(event.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
              <div className="pdf-total-row">
                <span>Total importe facturado</span>
                <strong>{formatCurrency(pdfTotals.invoiceTotal)}</strong>
              </div>
            </div>

            <div className="form-card">
              <div className="card-heading">
                <h2>Impuestos</h2>
                <div className="inline-actions">
                  <button type="button" onClick={addTaxItem}>
                    Añadir
                  </button>
                </div>
              </div>
              <div className="tax-items-editor">
                {activeQuote.taxItems.map((item) => (
                  <div className="tax-item-editor" key={item.id}>
                    <label>
                      Descripción
                      <input
                        value={item.label}
                        onChange={(event) => updateTaxItem(item.id, { label: event.target.value })}
                      />
                    </label>
                    <label>
                      Base
                      <input
                        type="number"
                        step="0.01"
                        value={numericInputValue(item.base)}
                        placeholder={formatCurrency(pdfTotals.invoiceTotal)}
                        onChange={(event) => updateTaxItem(item.id, { base: parseNumericInput(event.target.value) })}
                      />
                    </label>
                    <label>
                      %
                      <input
                        type="number"
                        step="0.01"
                        value={numericInputValue(item.rate)}
                        onChange={(event) => updateTaxItem(item.id, { rate: parseNumericInput(event.target.value) })}
                      />
                    </label>
                    <label>
                      Importe
                      <input
                        type="number"
                        step="0.01"
                        disabled
                        value={numericInputValue(calculatePdfTaxAmount(item, pdfTotals.invoiceTotal))}
                        readOnly
                      />
                    </label>
                    <button type="button" onClick={() => removeTaxItem(item.id)} title="Eliminar impuesto">
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="pdf-suplido-field">
                Suplido
                <input
                  type="number"
                  step="0.01"
                  value={numericInputValue(activeQuote.pdfFields.suplido)}
                  onChange={(event) => updatePdfFields({ suplido: parseNumericInput(event.target.value) })}
                />
              </label>
              <div className="pdf-total-row">
                <span>Total neto</span>
                <strong>{formatCurrency(pdfTotals.netTotal)}</strong>
              </div>
            </div>

          </>
        ) : (
          <>
        <div className="form-card">
          <div className="form-grid">
            <label>
              Tipo
              <select
                value={activeQuote.documentType}
                onChange={(event) => updateDocumentType(event.target.value as DocumentType)}
              >
                <option value="pdfQuote">Presupuesto Plantilla</option>
                <option value="pdfInvoice">Factura Plantilla</option>
                <option value="quote">Presupuesto PDF</option>
                <option value="invoice">Factura PDF</option>
              </select>
            </label>
            <label>
              {activeDocumentConfig.numberLabel}
              <input
                value={activeQuote.quoteNumber}
                onChange={(event) => updateQuote({ quoteNumber: event.target.value })}
              />
            </label>
            <label>
              Fecha
              <input
                type="date"
                value={activeQuote.date}
                onChange={(event) => {
                  const date = event.target.value;
                  updateQuote({
                    date,
                    dueDate: date ? getDefaultDueDate(date, activeQuote.documentType) : "",
                  });
                }}
              />
            </label>
            {isQuoteDocument(activeQuote.documentType) && (
              <label>
                Validez hasta
                <input
                  type="date"
                  value={activeQuote.dueDate}
                  onChange={(event) => updateQuote({ dueDate: event.target.value })}
                />
              </label>
            )}
            <label>
              Cliente
              <input
                placeholder="Nombre del cliente"
                value={activeQuote.clientName}
                onChange={(event) => updateQuote({ clientName: event.target.value })}
              />
            </label>
            <label>
              Datos del cliente
              <textarea
                placeholder="Email, telefono, empresa o direccion"
                value={activeQuote.clientDetails}
                onChange={(event) => updateQuote({ clientDetails: event.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="form-card">
          <div className="card-heading">
            <h2>Servicios</h2>
            <div className="inline-actions">
              <button type="button" onClick={() => addItem()} disabled={activeQuote.items.length >= MAX_DOCUMENT_ITEMS}>
                Más {activeQuote.items.length}/{MAX_DOCUMENT_ITEMS}
              </button>
            </div>
          </div>

          <div className="items-editor">
            {activeQuote.items.map((item) => (
              <article className="item-editor" key={item.id}>
                <div className="item-topline">
                  <label className="service-title-field">
                    Servicio
                    <input
                      value={item.serviceType}
                      onChange={(event) => updateItem(item.id, { serviceType: event.target.value })}
                    />
                  </label>
                  <button type="button" onClick={() => removeItem(item.id)} title="Eliminar servicio">
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>

                <label>
                  Descripcion
                  <textarea
                    value={item.description}
                    onChange={(event) => updateItem(item.id, { description: event.target.value })}
                  />
                </label>

                <div className="item-numbers">
                  <label>
                    Horas
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={numericInputValue(item.hours)}
                      onChange={(event) => updateItem(item.id, { hours: parseNumericInput(event.target.value) })}
                    />
                  </label>
                  <label>
                    Tarifa/h
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={numericInputValue(item.hourlyRate)}
                      onChange={(event) =>
                        updateItem(item.id, { hourlyRate: parseNumericInput(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Importe manual
                    <input
                      type="number"
                      min="0"
                      step="1"
                      disabled={!item.manualAmountEnabled}
                      value={numericInputValue(item.manualAmount)}
                      onChange={(event) =>
                        updateItem(item.id, { manualAmount: parseNumericInput(event.target.value) })
                      }
                    />
                  </label>
                </div>

                <div className="item-footer">
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={item.manualAmountEnabled}
                      onChange={(event) => updateItem(item.id, { manualAmountEnabled: event.target.checked })}
                    />
                    Usar importe manual
                  </label>
                  <strong>{formatCurrency(calculateLineAmount(item))}</strong>
                </div>
              </article>
            ))}
          </div>
          <div className="card-heading">
            <h2>Descuento</h2>
          </div>
          <div className="discount-grid">
            <label>
              Descuento %
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={numericInputValue(activeQuote.discountRate)}
                onChange={(event) => updateQuote({ discountRate: parseNumericInput(event.target.value) })}
              />
            </label>
            <label>
              Descuento EUR
              <input
                type="number"
                min="0"
                step="1"
                value={numericInputValue(activeQuote.discountAmount)}
                onChange={(event) => updateQuote({ discountAmount: parseNumericInput(event.target.value) })}
              />
            </label>
          </div>
        </div>

        <div className="form-card">
          <div className="tax-row">
            <label className="switch-row">
              <input
                type="checkbox"
                checked={activeQuote.taxEnabled}
                onChange={(event) => updateQuote({ taxEnabled: event.target.checked })}
              />
              Aplicar IVA
            </label>
            <label className="compact-label">
              IVA %
              <input
                type="number"
                min="0"
                step="1"
                value={numericInputValue(activeQuote.taxRate)}
                onChange={(event) => updateQuote({ taxRate: parseNumericInput(event.target.value) })}
              />
            </label>
          </div>
          <div className="card-heading">
            <h2>Conceptos con horas</h2>
            <div className="inline-actions">
              <button type="button" onClick={addNoteItem} disabled={activeNoteLineCount >= MAX_NOTE_LINES}>
                Añadir {activeNoteLineCount}/{MAX_NOTE_LINES}
              </button>
            </div>
          </div>
          <div className="note-items-editor">
            {activeQuote.noteItems.map((item) => (
              <div className="note-item-editor" key={item.id}>
                <label>
                  Texto
                  <input
                    placeholder="Diseño página"
                    value={item.text}
                    onChange={(event) => updateNoteItem(item.id, { text: event.target.value })}
                  />
                </label>
                <label>
                  Horas
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={numericInputValue(item.hours)}
                    onChange={(event) =>
                      updateNoteItem(item.id, { hours: parseNumericInput(event.target.value) })
                    }
                  />
                </label>
                <button type="button" onClick={() => removeNoteItem(item.id)} title="Eliminar concepto">
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </div>
          <label>
            Notas
            <textarea
              placeholder="Notas específicas para este documento."
              value={activeQuote.notes}
              onChange={(event) => updateQuote({ notes: limitTextLines(event.target.value, remainingNoteLines) })}
            />
          </label>
        </div>
          </>
        )}
      </section>

      <button
        className="layout-resizer layout-resizer-editor no-print"
        type="button"
        aria-label="Cambiar ancho del editor"
        title="Arrastra para cambiar el ancho. Doble clic para restablecer."
        onPointerDown={startResize("editor")}
        onDoubleClick={resetLayout}
      />

      <section className="preview-panel" aria-label="Vista previa imprimible">
        <QuotePreview quote={activeQuote} totals={totals} config={activeQuoteConfig} />
      </section>
      </main>
    </div>
  );
}

const renderFixedNotes = (quote: Quote, totals: ReturnType<typeof calculateTotals>, config: AppConfig) => {
  const fixedNotes = (isInvoiceDocument(quote.documentType) ? config.invoiceFixedNotes : config.quoteFixedNotes).trim();

  if (!fixedNotes) return "";

  const prepaymentAmount = formatCurrency(totals.total * (config.quotePrepaymentRate / 100));
  return fixedNotes
    .replace(/\{\{anticipo\}\}/gi, prepaymentAmount)
    .replace(/\{anticipo\}/gi, prepaymentAmount);
};

const renderPrepaymentNote = (quote: Quote, totals: ReturnType<typeof calculateTotals>, config: AppConfig) => {
  if (!isQuoteDocument(quote.documentType) || !config.quotePrepaymentEnabled) return "";

  const text = config.quotePrepaymentText.trim() || DEFAULT_QUOTE_PREPAYMENT_TEXT;
  const amount = formatCurrency(totals.total * (config.quotePrepaymentRate / 100));
  return `${text} ${amount}`;
};

function QuotePreview({
  quote,
  totals,
  config,
}: {
  quote: Quote;
  totals: ReturnType<typeof calculateTotals>;
  config: AppConfig;
}) {
  const documentConfig = getDocumentConfig(quote.documentType);
  const companyName = config.companyName.trim() || "Tu empresa";
  const fixedNotes = renderFixedNotes(quote, totals, config);
  const prepaymentNote = renderPrepaymentNote(quote, totals, config);
  const previewStyle = {
    "--document-accent-color": config.accentColor,
    "--document-page-bg": config.pageBackgroundColor,
    "--document-client-box-bg": config.clientBoxBackgroundColor,
  } as CSSProperties;

  if (isTemplateDocument(quote.documentType)) {
    return <PdfInvoicePreview config={config} quote={quote} totals={calculatePdfInvoiceTotals(quote)} />;
  }

  return (
    <article className={`quote-page ${isInvoiceDocument(quote.documentType) ? "is-invoice" : "is-quote"}`} style={previewStyle}>
      <header className="quote-header">
        <div className="quote-header-left">
          <div className="orb-lockup">
            {config.logoDataUrl ? <img className="brand-logo-image" src={config.logoDataUrl} alt="" /> : <OrbLogo size={56} />}
            <div className="orb-lockup-text">
              <p className="quote-kicker">{documentConfig.title}</p>
              <h2>{companyName}</h2>
              {config.companyTagline.trim() && <span className="orb-lockup-tagline">{config.companyTagline}</span>}
            </div>
          </div>
        </div>
        <div className="quote-meta">
          <span>{quote.quoteNumber}</span>
          <span>{formatDate(quote.date)}</span>
          {isQuoteDocument(quote.documentType) && <span>Valido hasta {formatDate(quote.dueDate)}</span>}
        </div>
      </header>

      <section className="client-strip">
        <div>
          <span>Cliente</span>
          <strong>{quote.clientName || "Nombre del cliente"}</strong>
        </div>
        <p>{quote.clientDetails || "Datos del cliente"}</p>
      </section>

      <section className="quote-section">
        <div className="quote-table">
          <div className="quote-table-row quote-table-head">
            <span>{isInvoiceDocument(quote.documentType) ? "Concepto" : "Servicio"}</span>
            <span>Horas</span>
            <span>Tarifa</span>
            <span>Importe</span>
          </div>
          {quote.items.map((item) => (
            <div className="quote-table-row" key={item.id}>
              <div>
                <strong>{item.serviceType}</strong>
                <p>{item.description}</p>
              </div>
              <span>{item.hours ? `${item.hours} h` : "-"}</span>
              <span>{item.manualAmountEnabled ? "-" : formatCurrency(item.hourlyRate)}</span>
              <strong>{formatCurrency(calculateLineAmount(item))}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="totals-block">
        <div className="totals-card">
          <div>
            <span>Subtotal</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </div>
          {totals.discountRateAmount > 0 && (
            <div>
              <span>Descuento {totals.discountRate}%</span>
              <strong>-{formatCurrency(totals.discountRateAmount)}</strong>
            </div>
          )}
          {totals.fixedDiscountAmount > 0 && (
            <div>
              <span>Descuento fijo</span>
              <strong>-{formatCurrency(totals.fixedDiscountAmount)}</strong>
            </div>
          )}
          {totals.totalDiscount > 0 && (
            <div>
              <span>Base imponible</span>
              <strong>{formatCurrency(totals.discountedSubtotal)}</strong>
            </div>
          )}
          {quote.taxEnabled && (
            <div>
              <span>IVA {quote.taxRate}%</span>
              <strong>{formatCurrency(totals.taxAmount)}</strong>
            </div>
          )}
          <div className="grand-total">
            <span>Total</span>
            <strong>{formatCurrency(totals.total)}</strong>
          </div>
        </div>
      </section>

      <footer className="quote-footer">
        <div className="quote-notes">
          <span>Notas</span>
          {quote.noteItems.length > 0 && (
            <div className="note-hours-table">
              {quote.noteItems
                .filter((item) => item.text.trim() || item.hours)
                .map((item) => (
                  <div className="note-hours-row" key={item.id}>
                    <span>{item.text || "Concepto"}</span>
                    <strong>{item.hours ? `${item.hours} h` : "-"}</strong>
                  </div>
                ))}
            </div>
          )}
          {quote.notes.trim() && <p>{quote.notes}</p>}
        </div>
        <div className="quote-terms">
          {prepaymentNote && <p className="fixed-notes-text">{prepaymentNote}</p>}
          {fixedNotes && <p className="fixed-notes-text">{fixedNotes}</p>}
          {config.pdfPaymentRows.length > 0 && (
            <div className="payment-block">
              <span>Metodo de pago</span>
              {config.pdfPaymentRows.map((row) => (
                <p key={row.id}>
                  {row.label.trim() && <strong>{row.label.trim()}: </strong>}
                  {row.value}
                </p>
              ))}
              {!quote.taxEnabled && <small>Precios sin IVA.</small>}
            </div>
          )}
        </div>
      </footer>
    </article>
  );
}

function PdfInvoicePreview({
  config,
  quote,
  totals,
}: {
  config: AppConfig;
  quote: Quote;
  totals: ReturnType<typeof calculatePdfInvoiceTotals>;
}) {
  const [clientTaxId = "", clientAddress = "", clientCity = "", clientPhone = "", clientEmail = ""] =
    quote.clientDetails.split("\n");
  const documentConfig = getDocumentConfig(quote.documentType);
  const documentLabels = templateDocumentLabels(quote.sourceKind ?? sourceKindForDocument(quote.documentType));
  const isInvoice = isInvoiceDocument(quote.documentType);

  return (
    <article className="quote-page pdf-invoice-page">
      <header className="pdf-invoice-header">
        <section className="pdf-issuer">
          <strong>{quote.clientName}</strong>
          <span>CIF: {clientTaxId}</span>
          <span>{clientAddress}</span>
          <span>{clientCity}</span>
          {clientPhone.trim() && <span>Tel: {clientPhone}</span>}
          {clientEmail.trim() && <span>{clientEmail}</span>}
        </section>

        <section className="pdf-meta-table">
          <div>{documentLabels.number}</div>
          <strong>{quote.quoteNumber}</strong>
          <div>FECHA</div>
          <strong>{formatPdfDate(quote.date)}</strong>
        </section>
      </header>

      <section className={`pdf-description-table${config.templateShowQuantity ? " has-quantity" : ""}`}>
        <h2>{config.templateSectionTitle.trim() || (isInvoice ? "DESCRIPCIÓN" : documentLabels.upper)}</h2>
        <div className="pdf-description-body">
          {quote.items.map((item) => (
            <div className="pdf-description-line" key={item.id}>
              <div>
                <strong>{item.serviceType || "CONCEPTO"}</strong>
                {item.description.trim() ? <span>{item.description}</span> : null}
              </div>
              {config.templateShowQuantity ? <span className="pdf-line-quantity">{numericInputValue(item.hours || 1)}</span> : null}
              <strong>{formatCurrency(calculateLineAmount(item))}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="pdf-invoice-total-row">
        <strong>{documentLabels.total}</strong>
        <span>{formatCurrency(totals.invoiceTotal)}</span>
      </section>

      <section className="pdf-taxes-section">
        <div className="pdf-tax-table">
          <div className="pdf-tax-head">IMPUESTOS</div>
          <div className="pdf-tax-head">BASE IMPONIBLE</div>
          <div className="pdf-tax-head">%</div>
          <div className="pdf-tax-head"></div>
          {quote.taxItems.map((item) => (
            <div className="pdf-tax-row" key={item.id}>
              <span>{item.label}</span>
              <span>{formatCurrency(getPdfTaxBase(item, totals.invoiceTotal))}</span>
              <span>{item.rate ? `${item.rate}%` : "0"}</span>
              <span>{formatCurrency(calculatePdfTaxAmount(item, totals.invoiceTotal))}</span>
            </div>
          ))}
        </div>
        <div className="pdf-summary-table">
          <span>TOTAL</span>
          <strong>{formatCurrency(totals.total)}</strong>
          <span>SUPLIDO</span>
          <strong>{formatCurrency(totals.suplido)}</strong>
          <strong>TOTAL NETO</strong>
          <strong>{formatCurrency(totals.netTotal)}</strong>
        </div>
      </section>

      <footer className="pdf-invoice-footer">
        <section className="pdf-client-block">
          <strong>{quote.pdfFields.issuerName || "EMISOR"}</strong>
          {quote.pdfFields.issuerTaxId ? <p>CIF: {quote.pdfFields.issuerTaxId}</p> : null}
          {quote.pdfFields.issuerAddress ? <p>{quote.pdfFields.issuerAddress}</p> : null}
          {quote.pdfFields.issuerCity ? <p>{quote.pdfFields.issuerCity}</p> : null}
        </section>

        <strong className="pdf-payment-heading">Forma de Pago:</strong>
        <section className="pdf-payment-table">
          {quote.pdfFields.paymentRows.map((row) => (
            <div key={row.id}>
              <strong>{row.label}:</strong> {row.value}
            </div>
          ))}
        </section>
      </footer>
    </article>
  );
}
