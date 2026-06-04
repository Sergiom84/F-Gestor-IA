import test from "node:test";
import assert from "node:assert/strict";
import { applyInvoiceReview } from "./invoice-review.js";

const baseExtraction = {
  document_kind: "invoice_received",
  supplier: {
    name: "Proveedor Smoke SL",
    tax_id: "B12345678",
    country: "ES"
  },
  customer: {
    name: "Cliente Smoke SL",
    tax_id: "B00000000",
    country: "ES"
  },
  invoice: {
    invoice_number: null,
    issue_date: null,
    due_date: null,
    currency: null,
    language: "es"
  },
  amounts: {
    subtotal_amount: null,
    tax_amount: null,
    total_amount: null,
    withholding_amount: null
  },
  payment: {
    iban: null,
    payment_method: null,
    due_date: null
  },
  tax_breakdowns: [],
  line_items: [],
  duplicate_candidate_keys: [],
  validations: {
    total_matches_breakdown: null,
    supplier_tax_id_present: true,
    customer_tax_id_present: true,
    invoice_number_present: false,
    issue_date_present: false,
    currency_present: false,
    spanish_vat_rates_detected: [21]
  },
  confidence: {
    overall: 0.7,
    critical_fields: []
  },
  doubtful_fields: [],
  evidence: [],
  summary: "Factura recibida smoke"
};

const baseCommand = {
  action: "approve",
  organization_id: "00000000-0000-4000-8000-000000000001",
  document_id: "00000000-0000-4000-8000-000000000002",
  extraction_id: "00000000-0000-4000-8000-000000000003",
  review_task_id: "00000000-0000-4000-8000-000000000004",
  fiscal_entity_id: "00000000-0000-4000-8000-000000000005",
  client_id: "00000000-0000-4000-8000-000000000006",
  reviewed_by: "00000000-0000-4000-8000-000000000007",
  review_notes: "Smoke approval",
  corrections: {
    supplier_tax_id: "B12345678",
    customer_tax_id: "B00000000",
    invoice_number: "SMOKE-001",
    issue_date: "2026-06-04",
    due_date: null,
    currency: "EUR",
    subtotal_amount: 100,
    tax_amount: 21,
    total_amount: 121
  },
  line_items: [
    {
      description: "Servicio smoke",
      quantity: 1,
      unit_price: 100,
      tax_rate_percent: 21,
      line_total: 100
    }
  ],
  tax_breakdowns: [
    {
      tax_rate_percent: 21,
      taxable_base: 100,
      tax_amount: 21
    }
  ]
};

test("approval with human corrections creates an invoice draft", () => {
  const outcome = applyInvoiceReview(baseExtraction, baseCommand, "2026-06-04T09:00:00.000Z");

  assert.equal(outcome.validation.status, "valid");
  assert.equal(outcome.documentStatus, "approved");
  assert.equal(outcome.reviewTaskStatus, "approved");
  assert.equal(outcome.invoiceDraft?.invoiceNumber, "SMOKE-001");
  assert.equal(outcome.invoiceDraft?.totalAmount, 121);
  assert.equal(outcome.invoiceDraft?.taxBreakdowns[0]?.tax_rate_percent, 21);
  assert.equal(outcome.auditEvent.action, "document.review_approved");
});

test("approval without required fiscal fields stays invalid", () => {
  const command = {
    ...baseCommand,
    corrections: {
      ...baseCommand.corrections,
      invoice_number: null,
      issue_date: null,
      total_amount: null
    }
  };
  const outcome = applyInvoiceReview(baseExtraction, command, "2026-06-04T09:00:00.000Z");

  assert.equal(outcome.validation.status, "invalid");
  assert.equal(outcome.invoiceDraft, null);
  assert.match(outcome.validation.errors.join("\n"), /invoice_number is required/);
  assert.match(outcome.validation.errors.join("\n"), /issue_date is required/);
  assert.match(outcome.validation.errors.join("\n"), /total_amount is required/);
});
