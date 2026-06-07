"use client";

// Ported from SOHL_Presupuestos src/App.tsx. Renders the standalone
// quote/invoice generator inside GFiscal, scoped under .quotes-shell.
import "./quotes.css";

import { Image as ImageIcon, Search, Settings, Trash2, X } from "lucide-react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";

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

type DocumentType = "quote" | "invoice" | "pdfInvoice";

type Quote = {
  id: string;
  documentType: DocumentType;
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

type AppConfig = {
  companyName: string;
  companyTagline: string;
  logoDataUrl: string;
  defaultNotes: string;
  quoteFixedNotes: string;
  invoiceFixedNotes: string;
  quotePrepaymentEnabled: boolean;
  quotePrepaymentRate: number;
  quotePrepaymentText: string;
  paymentDetails: string;
  accentColor: string;
  pageBackgroundColor: string;
  clientBoxBackgroundColor: string;
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
  defaultNotes: "",
  quoteFixedNotes: "",
  invoiceFixedNotes: "",
  quotePrepaymentEnabled: false,
  quotePrepaymentRate: 20,
  quotePrepaymentText: DEFAULT_QUOTE_PREPAYMENT_TEXT,
  paymentDetails: "",
  accentColor: "#0077ff",
  pageBackgroundColor: "#fffdf8",
  clientBoxBackgroundColor: "#eff7ff",
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
const getDefaultDueDate = (dateValue: string, documentType: DocumentType) =>
  documentType === "invoice" ? addDays(dateValue, 30) : addMonths(dateValue, 3);
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

const getDocumentConfig = (documentType: DocumentType) =>
  documentType === "pdfInvoice"
    ? {
        title: "Factura",
        pluralTitle: "Facturas PDF",
        numberLabel: "Nº factura",
        listLabel: "Factura PDF",
        newLabel: "Nueva factura PDF",
        prefix: "A26",
        defaultNotes: "",
      }
    : documentType === "invoice"
    ? {
        title: "Factura",
        pluralTitle: "Facturas",
        numberLabel: "Numero factura",
        listLabel: "Factura",
        newLabel: "Nueva factura",
        prefix: "FAC",
        defaultNotes: DEFAULT_INVOICE_NOTES,
      }
    : {
        title: "Presupuesto",
        pluralTitle: "Presupuestos",
        numberLabel: "Numero presupuesto",
        listLabel: "Presupuesto",
        newLabel: "Nuevo presupuesto",
        prefix: "PTO",
        defaultNotes: DEFAULT_QUOTE_NOTES,
      };

const createDocumentNumber = (documentType: DocumentType, sequence = 1) =>
  documentType === "pdfInvoice"
    ? `A26-${String(sequence + 15).padStart(3, "0")}`
    : documentType === "quote"
    ? String(sequence).padStart(3, "0")
    : `${getDocumentConfig(documentType).prefix}-${new Date().getFullYear()}-${String(sequence).padStart(3, "0")}`;

const createQuote = (
  sequence = 1,
  documentType: DocumentType = "quote",
  config: AppConfig = DEFAULT_APP_CONFIG,
): Quote => {
  const now = new Date().toISOString();
  const date = today();
  return {
    id: newId(),
    documentType,
    createdAt: now,
    updatedAt: now,
    quoteNumber: createDocumentNumber(documentType, sequence),
    date,
    dueDate: getDefaultDueDate(date, documentType),
    clientName: "",
    clientDetails: "",
    items: documentType === "pdfInvoice" ? createPdfInvoiceItems() : [createItem()],
    taxEnabled: true,
    taxRate: 21,
    discountRate: 0,
    discountAmount: 0,
    notes: "",
    noteItems: [],
    pdfFields: {
      ...DEFAULT_PDF_INVOICE_FIELDS,
      issuerName: config.companyName,
      paymentMethod: config.paymentDetails,
      paymentRows: createPdfPaymentRows(config.paymentDetails, ""),
    },
    taxItems: documentType === "pdfInvoice" ? createPdfTaxItems() : [],
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

const normalizeAppConfig = (config: Partial<AppConfig> | null | undefined): AppConfig => ({
  companyName: typeof config?.companyName === "string" ? fixMojibake(config.companyName) : "",
  companyTagline: typeof config?.companyTagline === "string" ? fixMojibake(config.companyTagline) : "",
  logoDataUrl:
    typeof config?.logoDataUrl === "string" && config.logoDataUrl.startsWith("data:image/")
      ? config.logoDataUrl
      : "",
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
  accentColor: normalizeColor(config?.accentColor, DEFAULT_APP_CONFIG.accentColor),
  pageBackgroundColor: normalizeColor(config?.pageBackgroundColor, DEFAULT_APP_CONFIG.pageBackgroundColor),
  clientBoxBackgroundColor: normalizeColor(
    config?.clientBoxBackgroundColor,
    DEFAULT_APP_CONFIG.clientBoxBackgroundColor,
  ),
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
    safeQuote.documentType === "pdfInvoice" ? "pdfInvoice" : safeQuote.documentType === "invoice" ? "invoice" : "quote";
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
      : documentType === "pdfInvoice"
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
      : documentType === "pdfInvoice"
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
    quotes: stored.length > 0 ? stored : [createQuote(1, "quote", readStoredAppConfig())],
  };
};

type AppLayout = {
  left: number;
  editor: number;
};

const DEFAULT_LAYOUT: AppLayout = {
  left: 280,
  editor: 520,
};

const readStoredLayout = (): AppLayout => {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    return {
      left: clamp(Number(parsed.left) || DEFAULT_LAYOUT.left, 220, 480),
      editor: clamp(Number(parsed.editor) || DEFAULT_LAYOUT.editor, 360, 760),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

export function QuotesWorkspace() {
  const initialQuoteState = useMemo(createInitialQuoteState, []);
  const [appConfig, setAppConfig] = useState<AppConfig>(readStoredAppConfig);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuoteState.quotes);
  const [layout, setLayout] = useState<AppLayout>(readStoredLayout);
  const [activeQuoteId, setActiveQuoteId] = useState(() => quotes[0]?.id ?? "");
  const [historyDialogType, setHistoryDialogType] = useState<DocumentType | null>(null);
  const [historyNameFilter, setHistoryNameFilter] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [hasCompletedConfig, setHasCompletedConfig] = useState(hasStoredAppConfig);
  const [hasDetectedData, setHasDetectedData] = useState(initialQuoteState.hadStoredQuotes);
  const [configDialogOpen, setConfigDialogOpen] = useState(() => !hasStoredAppConfig() || !initialQuoteState.hadStoredQuotes);
  const [configDraft, setConfigDraft] = useState<AppConfig>(() => readStoredAppConfig());
  const importFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  // quotes is seeded with a default document, so index 0 always exists.
  const activeQuote = quotes.find((quote) => quote.id === activeQuoteId) ?? quotes[0]!;
  const activeDocumentConfig = getDocumentConfig(activeQuote.documentType);
  const totals = useMemo(() => calculateTotals(activeQuote), [activeQuote]);
  const pdfTotals = useMemo(() => calculatePdfInvoiceTotals(activeQuote), [activeQuote]);
  const quoteCount = quotes.filter((quote) => quote.documentType === "quote").length;
  const invoiceCount = quotes.filter((quote) => quote.documentType === "invoice").length;
  const pdfInvoiceCount = quotes.filter((quote) => quote.documentType === "pdfInvoice").length;
  const activeNoteItemLines = activeQuote.noteItems.length;
  const activeTextNoteLines = countTextLines(activeQuote.notes);
  const activeNoteLineCount = activeNoteItemLines + activeTextNoteLines;
  const remainingNoteLines = Math.max(MAX_NOTE_LINES - activeNoteItemLines, 0);
  const historyDialogConfig = historyDialogType ? getDocumentConfig(historyDialogType) : null;
  const filteredHistoryDocuments = useMemo(() => {
    if (!historyDialogType) return [];
    const normalizedNameFilter = historyNameFilter.trim().toLocaleLowerCase("es-ES");

    return quotes.filter((quote) => {
      if (quote.documentType !== historyDialogType) return false;
      if (normalizedNameFilter && !quote.clientName.toLocaleLowerCase("es-ES").includes(normalizedNameFilter)) {
        return false;
      }
      if (historyDateFilter && quote.date !== historyDateFilter) return false;
      return true;
    });
  }, [historyDateFilter, historyDialogType, historyNameFilter, quotes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(appConfig));
  }, [appConfig]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const nextSequence = (documentType: DocumentType) =>
    quotes.filter((quote) => quote.documentType === documentType).length + 1;

  const updateQuote = (patch: Partial<Quote>) => {
    setHasDetectedData(true);
    setQuotes((current) =>
      current.map((quote) =>
        quote.id === activeQuote.id ? { ...quote, ...patch, updatedAt: new Date().toISOString() } : quote,
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

  const createNewQuote = (documentType: DocumentType = "quote") => {
    const quote = createQuote(nextSequence(documentType), documentType, appConfig);
    setHasDetectedData(true);
    setQuotes((current) => [quote, ...current]);
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
    setQuotes((current) => [duplicated, ...current]);
    setActiveQuoteId(duplicated.id);
  };

  const deleteQuote = () => {
    if (quotes.length === 1) {
      const quote = createQuote(1, "quote", appConfig);
      setQuotes([quote]);
      setActiveQuoteId(quote.id);
      return;
    }

    const remaining = quotes.filter((quote) => quote.id !== activeQuote.id);
    setQuotes(remaining);
    setActiveQuoteId(remaining[0]!.id);
  };

  const saveQuote = () => {
    updateQuote({});
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
      let importedConfig = false;
      if (!Array.isArray(parsed) && parsed.config && typeof parsed.config === "object") {
        const nextConfig = normalizeAppConfig(parsed.config);
        setAppConfig(nextConfig);
        setConfigDraft(nextConfig);
        setHasCompletedConfig(true);
        setConfigDialogOpen(false);
        importedConfig = true;
      }

      if (!Array.isArray(parsed) && parsed.layout && typeof parsed.layout === "object") {
        setLayout({
          left: clamp(Number(parsed.layout.left) || DEFAULT_LAYOUT.left, 220, 480),
          editor: clamp(Number(parsed.layout.editor) || DEFAULT_LAYOUT.editor, 360, 760),
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

  const updateConfigDraft = (patch: Partial<AppConfig>) => {
    setConfigDraft((current) => ({ ...current, ...patch }));
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
        if (quote.documentType === "pdfInvoice") {
          return {
            ...quote,
            pdfFields: {
              ...quote.pdfFields,
              issuerName: quote.pdfFields.issuerName || nextConfig.companyName,
              paymentMethod: quote.pdfFields.paymentMethod || nextConfig.paymentDetails,
              paymentRows:
                quote.pdfFields.paymentRows.length > 0
                  ? quote.pdfFields.paymentRows
                  : createPdfPaymentRows(quote.pdfFields.paymentMethod || nextConfig.paymentDetails, quote.pdfFields.iban),
            },
          };
        }

        return quote;
      }),
    );
    setConfigDialogOpen(false);
    setHasCompletedConfig(true);
  };

  const openHistoryDialog = (documentType: DocumentType) => {
    setHistoryDialogType(documentType);
    setHistoryNameFilter("");
    setHistoryDateFilter("");
  };

  const selectHistoryDocument = (quoteId: string) => {
    setActiveQuoteId(quoteId);
    setHistoryDialogType(null);
  };

  const deleteHistoryDocument = (quoteId: string) => {
    const target = quotes.find((quote) => quote.id === quoteId);
    if (!target) return;
    const documentLabel = `${getDocumentConfig(target.documentType).listLabel} ${target.quoteNumber}`;
    const clientLabel = target.clientName.trim() || "Cliente sin nombre";

    if (!window.confirm(`¿Eliminar ${documentLabel} de ${clientLabel}?`)) return;

    const remaining = quotes.filter((quote) => quote.id !== quoteId);
    if (remaining.length === 0) {
      const fallback = createQuote(1, "quote", appConfig);
      setQuotes([fallback]);
      setActiveQuoteId(fallback.id);
      setHistoryDialogType(null);
      setHasDetectedData(false);
      return;
    }

    setQuotes(remaining);
    setActiveQuoteId((currentId) => (currentId === quoteId ? remaining[0]!.id : currentId));
  };

  const updateDocumentType = (documentType: DocumentType) => {
    if (documentType === activeQuote.documentType) return;
    updateQuote({
      documentType,
      quoteNumber: createDocumentNumber(documentType, nextSequence(documentType)),
      dueDate: getDefaultDueDate(activeQuote.date || today(), documentType),
      items: documentType === "pdfInvoice" ? createPdfInvoiceItems() : activeQuote.items,
      taxItems: documentType === "pdfInvoice" ? createPdfTaxItems() : [],
      pdfFields:
        documentType === "pdfInvoice"
          ? {
              ...DEFAULT_PDF_INVOICE_FIELDS,
              issuerName: appConfig.companyName,
              paymentMethod: appConfig.paymentDetails,
              paymentRows: createPdfPaymentRows(appConfig.paymentDetails, ""),
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
    const limits = panel === "left" ? { min: 220, max: 480 } : { min: 360, max: 760 };

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
          {appConfig.companyName.trim() && <p>{appConfig.companyName}</p>}
        </div>

        <button className="config-action" type="button" onClick={openConfigDialog}>
          <Settings aria-hidden="true" size={17} />
          Configuración
        </button>

        <div className="new-document-actions">
          <button className="primary-action" type="button" onClick={() => createNewQuote("quote")}>
            Nuevo presupuesto
          </button>
          <button className="primary-action secondary-action" type="button" onClick={() => createNewQuote("invoice")}>
            Nueva factura
          </button>
        </div>

        <div className="template-section">
          <div className="section-title">Formato PDF</div>
          <button className="history-category-card template-card" type="button" onClick={() => createNewQuote("pdfInvoice")}>
            <span>Factura editable</span>
            <strong>PDF</strong>
            <small>Plantilla editable para facturas</small>
          </button>
        </div>

        <div className="history-list">
          <div className="section-title">
            Historial
          </div>
          <button className="history-category-card" type="button" onClick={() => openHistoryDialog("quote")}>
            <span>Presupuestos</span>
            <strong>{quoteCount}</strong>
            <small>{quoteCount === 1 ? "documento guardado" : "documentos guardados"}</small>
          </button>
          <button className="history-category-card" type="button" onClick={() => openHistoryDialog("invoice")}>
            <span>Facturas</span>
            <strong>{invoiceCount}</strong>
            <small>{invoiceCount === 1 ? "documento guardado" : "documentos guardados"}</small>
          </button>
          <button className="history-category-card" type="button" onClick={() => openHistoryDialog("pdfInvoice")}>
            <span>Facturas PDF</span>
            <strong>{pdfInvoiceCount}</strong>
            <small>{pdfInvoiceCount === 1 ? "documento guardado" : "documentos guardados"}</small>
          </button>
        </div>
      </aside>

      {historyDialogType && historyDialogConfig && (
        <div className="history-modal-backdrop no-print" role="presentation" onClick={() => setHistoryDialogType(null)}>
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
                <h2 id="history-modal-title">{historyDialogConfig.pluralTitle}</h2>
              </div>
              <button type="button" onClick={() => setHistoryDialogType(null)} title="Cerrar">
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

            <div className="config-logo-row">
              <div className="config-logo-preview">
                {configDraft.logoDataUrl ? (
                  <img src={configDraft.logoDataUrl} alt="" />
                ) : (
                  <OrbLogo size={62} />
                )}
              </div>
              <div className="config-logo-actions">
                <button type="button" onClick={() => logoFileRef.current?.click()}>
                  <ImageIcon aria-hidden="true" size={17} />
                  Subir logo
                </button>
                {configDraft.logoDataUrl && (
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
                  value={configDraft.companyName}
                  onChange={(event) => updateConfigDraft({ companyName: event.target.value })}
                />
              </label>
              <label>
                Actividad o subtítulo
                <input
                  placeholder="Opcional"
                  value={configDraft.companyTagline}
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
                  value={configDraft.quoteFixedNotes}
                  onChange={(event) => updateConfigDraft({ quoteFixedNotes: event.target.value })}
                />
              </label>
              <div className="prepayment-config">
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={configDraft.quotePrepaymentEnabled}
                    onChange={(event) => updateConfigDraft({ quotePrepaymentEnabled: event.target.checked })}
                  />
                  Mostrar porcentaje si vas a cobrar por adelantado en los presupuestos
                </label>
                {configDraft.quotePrepaymentEnabled && (
                  <div className="prepayment-config-fields">
                    <label className="compact-label">
                      Porcentaje
                      <input
                        className="prepayment-rate-input"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={numericInputValue(configDraft.quotePrepaymentRate)}
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
                        value={configDraft.quotePrepaymentText}
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
                  value={configDraft.invoiceFixedNotes}
                  onChange={(event) => updateConfigDraft({ invoiceFixedNotes: event.target.value })}
                />
              </label>
            </div>

            <label>
              Método de pago
              <textarea
                placeholder="Transferencia, Bizum, instrucciones de pago..."
                value={configDraft.paymentDetails}
                onChange={(event) => updateConfigDraft({ paymentDetails: event.target.value })}
              />
            </label>

            <div className="config-data-section">
              <div className="card-heading">
                <h2>Datos</h2>
              </div>
              <p>
                {hasDetectedData
                  ? `${quoteCount} presupuesto(s), ${invoiceCount} factura(s) y ${pdfInvoiceCount} factura(s) PDF guardadas.`
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
                    value={configDraft.accentColor}
                    onChange={(event) => updateConfigDraft({ accentColor: event.target.value })}
                  />
                  <input
                    value={configDraft.accentColor}
                    onChange={(event) => updateConfigDraft({ accentColor: event.target.value })}
                  />
                </div>
              </label>
              <div className="color-swatch-grid" aria-label="Gama cromática">
                {ACCENT_COLOR_OPTIONS.map((color) => (
                  <button
                    className={configDraft.accentColor.toLowerCase() === color ? "is-selected" : ""}
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
                        className={configDraft.pageBackgroundColor.toLowerCase() === option.value ? "is-selected" : ""}
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
                          configDraft.clientBoxBackgroundColor.toLowerCase() === option.value ? "is-selected" : ""
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

            <div className="config-modal-actions">
              <button className="primary-action" type="button" onClick={saveAppConfig}>
                Guardar configuración
              </button>
            </div>
          </section>
        </div>
      )}

      <button
        className="layout-resizer layout-resizer-left no-print"
        type="button"
        aria-label="Cambiar ancho del historial"
        title="Arrastra para cambiar el ancho. Doble clic para restablecer."
        onPointerDown={startResize("left")}
        onDoubleClick={resetLayout}
      />

      <section className="editor-panel no-print" aria-label="Editor del documento">
        <div className="toolbar">
          <button type="button" onClick={saveQuote} title="Guardar documento">
            Guardar
          </button>
          <button type="button" onClick={duplicateQuote} title="Duplicar documento">
            Duplicar
          </button>
          <button type="button" onClick={exportHistory} title="Exportar historial en JSON">
            Exportar
          </button>
          <button type="button" onClick={() => importFileRef.current?.click()} title="Importar historial en JSON">
            Importar
          </button>
          <button type="button" onClick={() => window.print()} title="Imprimir o guardar en PDF">
            Imprimir/PDF
          </button>
          <button className="danger-button" type="button" onClick={deleteQuote} title="Eliminar documento">
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

        {activeQuote.documentType === "pdfInvoice" ? (
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
                      const [, ...rest] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [event.target.value, ...rest].join("\n") });
                    }}
                  />
                </label>
                <label>
                  Dirección
                  <input
                    value={activeQuote.clientDetails.split("\n")[1] ?? ""}
                    onChange={(event) => {
                      const [taxId = "", , ...rest] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [taxId, event.target.value, ...rest].join("\n") });
                    }}
                  />
                </label>
                <label>
                  Ciudad
                  <input
                    value={activeQuote.clientDetails.split("\n")[2] ?? ""}
                    onChange={(event) => {
                      const [taxId = "", address = ""] = activeQuote.clientDetails.split("\n");
                      updateQuote({ clientDetails: [taxId, address, event.target.value].join("\n") });
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="form-card">
              <div className="card-heading">
                <h2>Factura</h2>
              </div>
              <div className="form-grid">
                <label>
                  Nº factura
                  <input
                    value={activeQuote.quoteNumber}
                    onChange={(event) => updateQuote({ quoteNumber: event.target.value })}
                  />
                </label>
                <label>
                  Fecha emisión
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
              <div className="pdf-total-row">
                <span>Total neto</span>
                <strong>{formatCurrency(pdfTotals.netTotal)}</strong>
              </div>
            </div>

            <div className="form-card">
              <div className="card-heading">
                <h2>Emisor y pago</h2>
              </div>
              <div className="form-grid">
                <label>
                  Emisor
                  <input
                    value={activeQuote.pdfFields.issuerName}
                    onChange={(event) => updatePdfFields({ issuerName: event.target.value })}
                  />
                </label>
                <label>
                  CIF/NIF
                  <input
                    value={activeQuote.pdfFields.issuerTaxId}
                    onChange={(event) => updatePdfFields({ issuerTaxId: event.target.value })}
                  />
                </label>
                <label>
                  Dirección
                  <input
                    value={activeQuote.pdfFields.issuerAddress}
                    onChange={(event) => updatePdfFields({ issuerAddress: event.target.value })}
                  />
                </label>
                <label>
                  Ciudad
                  <input
                    value={activeQuote.pdfFields.issuerCity}
                    onChange={(event) => updatePdfFields({ issuerCity: event.target.value })}
                  />
                </label>
                <label>
                  Suplido
                  <input
                    type="number"
                    step="0.01"
                    value={numericInputValue(activeQuote.pdfFields.suplido)}
                    onChange={(event) => updatePdfFields({ suplido: parseNumericInput(event.target.value) })}
                  />
                </label>
              </div>
              <div className="card-heading">
                <h2>Forma de pago</h2>
                <div className="inline-actions">
                  <button type="button" onClick={addPdfPaymentRow}>
                    Añadir
                  </button>
                </div>
              </div>
              <div className="pdf-payment-rows-editor">
                {activeQuote.pdfFields.paymentRows.map((row) => (
                  <div className="pdf-payment-row-editor" key={row.id}>
                    <label>
                      Texto
                      <input
                        value={row.label}
                        onChange={(event) => updatePdfPaymentRow(row.id, { label: event.target.value })}
                      />
                    </label>
                    <label>
                      Valor
                      <input
                        value={row.value}
                        onChange={(event) => updatePdfPaymentRow(row.id, { value: event.target.value })}
                      />
                    </label>
                    <button type="button" onClick={() => removePdfPaymentRow(row.id)} title="Eliminar fila">
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                ))}
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
                <option value="quote">Presupuesto</option>
                <option value="invoice">Factura</option>
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
            {activeQuote.documentType === "quote" && (
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
        <QuotePreview quote={activeQuote} totals={totals} config={appConfig} />
      </section>
    </main>
    </div>
  );
}

const renderFixedNotes = (quote: Quote, totals: ReturnType<typeof calculateTotals>, config: AppConfig) => {
  const fixedNotes = (quote.documentType === "invoice" ? config.invoiceFixedNotes : config.quoteFixedNotes).trim();

  if (!fixedNotes) return "";

  const prepaymentAmount = formatCurrency(totals.total * (config.quotePrepaymentRate / 100));
  return fixedNotes
    .replace(/\{\{anticipo\}\}/gi, prepaymentAmount)
    .replace(/\{anticipo\}/gi, prepaymentAmount);
};

const renderPrepaymentNote = (quote: Quote, totals: ReturnType<typeof calculateTotals>, config: AppConfig) => {
  if (quote.documentType !== "quote" || !config.quotePrepaymentEnabled) return "";

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

  if (quote.documentType === "pdfInvoice") {
    return <PdfInvoicePreview quote={quote} totals={calculatePdfInvoiceTotals(quote)} />;
  }

  return (
    <article className={`quote-page ${quote.documentType === "invoice" ? "is-invoice" : "is-quote"}`} style={previewStyle}>
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
          {quote.documentType === "quote" && <span>Valido hasta {formatDate(quote.dueDate)}</span>}
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
            <span>{quote.documentType === "invoice" ? "Concepto" : "Servicio"}</span>
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
          {config.paymentDetails.trim() && (
            <div className="payment-block">
              <span>Metodo de pago</span>
              <p>{config.paymentDetails}</p>
              {!quote.taxEnabled && <small>Precios sin IVA.</small>}
            </div>
          )}
        </div>
      </footer>
    </article>
  );
}

function PdfInvoicePreview({
  quote,
  totals,
}: {
  quote: Quote;
  totals: ReturnType<typeof calculatePdfInvoiceTotals>;
}) {
  const [clientTaxId = "", clientAddress = "", clientCity = ""] = quote.clientDetails.split("\n");

  return (
    <article className="quote-page pdf-invoice-page">
      <header className="pdf-invoice-header">
        <section className="pdf-issuer">
          <strong>{quote.clientName}</strong>
          <span>CIF: {clientTaxId}</span>
          <span>{clientAddress}</span>
          <span>{clientCity}</span>
        </section>

        <section className="pdf-meta-table">
          <div>Nº FACTURA</div>
          <strong>{quote.quoteNumber}</strong>
          <div>FECHA EMISIÓN</div>
          <strong>{formatPdfDate(quote.date)}</strong>
        </section>
      </header>

      <section className="pdf-description-table">
        <h2>DESCRIPCIÓN</h2>
        <div className="pdf-description-body">
          {quote.items.map((item) => (
            <div className="pdf-description-line" key={item.id}>
              <div>
                <strong>{item.serviceType || "CONCEPTO"}</strong>
                {item.description.trim() ? <span>{item.description}</span> : null}
              </div>
              <strong>{formatCurrency(calculateLineAmount(item))}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="pdf-invoice-total-row">
        <strong>TOTAL IMPORTE FACTURADO</strong>
        <span>{formatCurrency(totals.invoiceTotal)}</span>
      </section>

      <section className="pdf-taxes-section">
        <h2>IMPUESTOS</h2>
        <div className="pdf-tax-table">
          <div className="pdf-tax-head">DESCRIPCIÓN</div>
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
          <p>
            {[
              quote.pdfFields.issuerTaxId ? `CIF: ${quote.pdfFields.issuerTaxId}` : "",
              quote.pdfFields.issuerAddress,
              quote.pdfFields.issuerCity,
            ]
              .filter(Boolean)
              .join("\n")}
          </p>
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

