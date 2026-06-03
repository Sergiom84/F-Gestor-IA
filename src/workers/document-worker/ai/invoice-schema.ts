import { z } from "zod";

export const INVOICE_EXTRACTION_PROMPT_VERSION = "invoice_received_v1";
export const INVOICE_EXTRACTION_SCHEMA_VERSION = "invoice_received_v1";

const nullableStringSchema = z.string().nullable();
const nullableNumberSchema = z.number().nullable();
const nullableBooleanSchema = z.boolean().nullable();

export const evidenceItemSchema = z.object({
  field: z.string(),
  page_numbers: z.array(z.number().int().positive()),
  quote: nullableStringSchema,
  reason: z.string()
});

export const doubtfulFieldSchema = z.object({
  field: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceItemSchema)
});

export const taxBreakdownSchema = z.object({
  tax_rate_percent: nullableNumberSchema,
  taxable_base: nullableNumberSchema,
  tax_amount: nullableNumberSchema,
  total_amount: nullableNumberSchema,
  reason: z.string()
});

export const invoiceLineSchema = z.object({
  description: nullableStringSchema,
  quantity: nullableNumberSchema,
  unit_price: nullableNumberSchema,
  tax_rate_percent: nullableNumberSchema,
  line_total: nullableNumberSchema,
  evidence: z.array(evidenceItemSchema)
});

export const receivedInvoiceExtractionSchema = z.object({
  document_kind: z.enum(["invoice_received", "not_invoice", "uncertain"]),
  supplier: z.object({
    name: nullableStringSchema,
    tax_id: nullableStringSchema,
    country: nullableStringSchema
  }),
  customer: z.object({
    name: nullableStringSchema,
    tax_id: nullableStringSchema,
    country: nullableStringSchema
  }),
  invoice: z.object({
    invoice_number: nullableStringSchema,
    issue_date: nullableStringSchema,
    due_date: nullableStringSchema,
    currency: nullableStringSchema,
    language: nullableStringSchema
  }),
  amounts: z.object({
    subtotal_amount: nullableNumberSchema,
    tax_amount: nullableNumberSchema,
    total_amount: nullableNumberSchema,
    withholding_amount: nullableNumberSchema
  }),
  payment: z.object({
    iban: nullableStringSchema,
    payment_method: nullableStringSchema,
    due_date: nullableStringSchema
  }),
  tax_breakdowns: z.array(taxBreakdownSchema),
  line_items: z.array(invoiceLineSchema),
  duplicate_candidate_keys: z.array(z.string()),
  validations: z.object({
    total_matches_breakdown: nullableBooleanSchema,
    supplier_tax_id_present: nullableBooleanSchema,
    customer_tax_id_present: nullableBooleanSchema,
    invoice_number_present: nullableBooleanSchema,
    issue_date_present: nullableBooleanSchema,
    currency_present: nullableBooleanSchema,
    spanish_vat_rates_detected: z.array(z.number())
  }),
  confidence: z.object({
    overall: z.number().min(0).max(1),
    critical_fields: z.array(z.string())
  }),
  doubtful_fields: z.array(doubtfulFieldSchema),
  evidence: z.array(evidenceItemSchema),
  summary: z.string()
});

export type ReceivedInvoiceExtraction = z.infer<typeof receivedInvoiceExtractionSchema>;

export type ReceivedInvoiceValidation = {
  status: "valid" | "invalid";
  errors: string[];
  warnings: string[];
};

export const RECEIVED_INVOICE_SYSTEM_PROMPT = [
  "Eres un extractor fiscal para facturas recibidas en Espana.",
  "Extrae solo datos presentes en el texto. No inventes importes, NIF/CIF, fechas ni numeros de factura.",
  "Si un dato no aparece o es dudoso, usa null y anade el campo a doubtful_fields con evidencia.",
  "Devuelve importes como numeros decimales en la moneda de la factura.",
  "Incluye evidencias breves con pagina cuando el texto tenga marcas [page N] o [chunk N].",
  "Marca document_kind como not_invoice si el texto no parece una factura recibida."
].join("\n");

export function buildReceivedInvoiceUserPrompt(documentText: string, maxCharacters = 60_000): string {
  const trimmedText = documentText.trim();
  const truncatedText = trimmedText.slice(0, maxCharacters);
  const suffix = trimmedText.length > maxCharacters
    ? "\n\n[texto truncado por limite de caracteres]"
    : "";

  return [
    "Extrae una propuesta estructurada de factura recibida a partir de este texto documental.",
    "Prioriza campos fiscalmente utiles para Espana: proveedor, cliente, numero, fecha, base, IVA, total, moneda y evidencias.",
    "",
    "Texto documental:",
    truncatedText + suffix
  ].join("\n");
}

export function validateReceivedInvoiceExtraction(
  extraction: ReceivedInvoiceExtraction
): ReceivedInvoiceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (extraction.document_kind !== "invoice_received") {
    errors.push(`document_kind is ${extraction.document_kind}, not invoice_received`);
  }

  if (!extraction.invoice.invoice_number) {
    warnings.push("invoice.invoice_number is missing");
  }

  if (!extraction.invoice.issue_date) {
    errors.push("invoice.issue_date is missing");
  }

  if (!extraction.invoice.currency) {
    warnings.push("invoice.currency is missing");
  } else if (extraction.invoice.currency !== "EUR") {
    warnings.push(`invoice.currency is ${extraction.invoice.currency}, review non-EUR handling`);
  }

  if (!extraction.supplier.tax_id) {
    warnings.push("supplier.tax_id is missing");
  }

  if (extraction.amounts.total_amount === null) {
    errors.push("amounts.total_amount is missing");
  }

  validateAmountCoherence(extraction, errors, warnings);
  validateSpanishVatRates(extraction, warnings);

  if (extraction.confidence.overall < 0.6) {
    warnings.push(`confidence.overall is low (${extraction.confidence.overall})`);
  }

  return {
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
    warnings
  };
}

function validateAmountCoherence(
  extraction: ReceivedInvoiceExtraction,
  errors: string[],
  warnings: string[]
): void {
  const { subtotal_amount: subtotal, tax_amount: tax, total_amount: total, withholding_amount: withholding } = extraction.amounts;

  if (subtotal === null || tax === null || total === null) {
    return;
  }

  const expectedTotal = roundMoney(subtotal + tax - (withholding ?? 0));
  const observedTotal = roundMoney(total);
  const difference = Math.abs(expectedTotal - observedTotal);

  if (difference > 0.02) {
    errors.push(`amounts total mismatch: expected ${expectedTotal}, got ${observedTotal}`);
  }

  const breakdownTax = extraction.tax_breakdowns.reduce((sum, breakdown) => {
    return sum + (breakdown.tax_amount ?? 0);
  }, 0);

  if (extraction.tax_breakdowns.length > 0 && Math.abs(roundMoney(breakdownTax) - roundMoney(tax)) > 0.02) {
    warnings.push("tax_breakdowns tax total does not match amounts.tax_amount");
  }
}

function validateSpanishVatRates(extraction: ReceivedInvoiceExtraction, warnings: string[]): void {
  const acceptedRates = new Set([0, 2, 4, 5, 7.5, 10, 21]);

  for (const rate of extraction.validations.spanish_vat_rates_detected) {
    if (!acceptedRates.has(rate)) {
      warnings.push(`unexpected Spanish VAT rate detected: ${rate}`);
    }
  }

  for (const breakdown of extraction.tax_breakdowns) {
    if (breakdown.tax_rate_percent !== null && !acceptedRates.has(breakdown.tax_rate_percent)) {
      warnings.push(`unexpected tax_breakdown rate: ${breakdown.tax_rate_percent}`);
    }
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
const nullableBoolean = { type: ["boolean", "null"] };

const evidenceItemJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "page_numbers", "quote", "reason"],
  properties: {
    field: { type: "string" },
    page_numbers: {
      type: "array",
      items: { type: "integer" }
    },
    quote: nullableString,
    reason: { type: "string" }
  }
} as const;

export const RECEIVED_INVOICE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "document_kind",
    "supplier",
    "customer",
    "invoice",
    "amounts",
    "payment",
    "tax_breakdowns",
    "line_items",
    "duplicate_candidate_keys",
    "validations",
    "confidence",
    "doubtful_fields",
    "evidence",
    "summary"
  ],
  properties: {
    document_kind: {
      type: "string",
      enum: ["invoice_received", "not_invoice", "uncertain"]
    },
    supplier: {
      type: "object",
      additionalProperties: false,
      required: ["name", "tax_id", "country"],
      properties: {
        name: nullableString,
        tax_id: nullableString,
        country: nullableString
      }
    },
    customer: {
      type: "object",
      additionalProperties: false,
      required: ["name", "tax_id", "country"],
      properties: {
        name: nullableString,
        tax_id: nullableString,
        country: nullableString
      }
    },
    invoice: {
      type: "object",
      additionalProperties: false,
      required: ["invoice_number", "issue_date", "due_date", "currency", "language"],
      properties: {
        invoice_number: nullableString,
        issue_date: nullableString,
        due_date: nullableString,
        currency: nullableString,
        language: nullableString
      }
    },
    amounts: {
      type: "object",
      additionalProperties: false,
      required: ["subtotal_amount", "tax_amount", "total_amount", "withholding_amount"],
      properties: {
        subtotal_amount: nullableNumber,
        tax_amount: nullableNumber,
        total_amount: nullableNumber,
        withholding_amount: nullableNumber
      }
    },
    payment: {
      type: "object",
      additionalProperties: false,
      required: ["iban", "payment_method", "due_date"],
      properties: {
        iban: nullableString,
        payment_method: nullableString,
        due_date: nullableString
      }
    },
    tax_breakdowns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tax_rate_percent", "taxable_base", "tax_amount", "total_amount", "reason"],
        properties: {
          tax_rate_percent: nullableNumber,
          taxable_base: nullableNumber,
          tax_amount: nullableNumber,
          total_amount: nullableNumber,
          reason: { type: "string" }
        }
      }
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unit_price", "tax_rate_percent", "line_total", "evidence"],
        properties: {
          description: nullableString,
          quantity: nullableNumber,
          unit_price: nullableNumber,
          tax_rate_percent: nullableNumber,
          line_total: nullableNumber,
          evidence: {
            type: "array",
            items: evidenceItemJsonSchema
          }
        }
      }
    },
    duplicate_candidate_keys: {
      type: "array",
      items: { type: "string" }
    },
    validations: {
      type: "object",
      additionalProperties: false,
      required: [
        "total_matches_breakdown",
        "supplier_tax_id_present",
        "customer_tax_id_present",
        "invoice_number_present",
        "issue_date_present",
        "currency_present",
        "spanish_vat_rates_detected"
      ],
      properties: {
        total_matches_breakdown: nullableBoolean,
        supplier_tax_id_present: nullableBoolean,
        customer_tax_id_present: nullableBoolean,
        invoice_number_present: nullableBoolean,
        issue_date_present: nullableBoolean,
        currency_present: nullableBoolean,
        spanish_vat_rates_detected: {
          type: "array",
          items: { type: "number" }
        }
      }
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: ["overall", "critical_fields"],
      properties: {
        overall: { type: "number" },
        critical_fields: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    doubtful_fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "reason", "confidence", "evidence"],
        properties: {
          field: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "number" },
          evidence: {
            type: "array",
            items: evidenceItemJsonSchema
          }
        }
      }
    },
    evidence: {
      type: "array",
      items: evidenceItemJsonSchema
    },
    summary: { type: "string" }
  }
} as const;
