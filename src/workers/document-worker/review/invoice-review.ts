import {
  receivedInvoiceExtractionSchema,
  type ReceivedInvoiceExtraction
} from "../ai/invoice-schema.js";
import {
  invoiceReviewCommandSchema,
  type ApprovedInvoiceDraft,
  type InvoiceReviewCommand,
  type InvoiceReviewOutcome,
  type ReviewAuditEvent,
  type ReviewLineItem,
  type ReviewTaxBreakdown,
  type ReviewValidation
} from "./review-schema.js";

export function parseReceivedInvoiceExtractionInput(input: unknown): ReceivedInvoiceExtraction {
  const record = asRecord(input);
  const normalizedData = record?.normalized_data;

  if (normalizedData !== undefined) {
    return receivedInvoiceExtractionSchema.parse(normalizedData);
  }

  return receivedInvoiceExtractionSchema.parse(input);
}

export function applyInvoiceReview(
  extractionInput: unknown,
  commandInput: unknown,
  reviewedAt = new Date().toISOString()
): InvoiceReviewOutcome {
  const extraction = parseReceivedInvoiceExtractionInput(extractionInput);
  const command = invoiceReviewCommandSchema.parse(commandInput);

  const validation = validateInvoiceReviewCommand(extraction, command);
  const invoiceDraft = command.action === "approve" && validation.status === "valid"
    ? buildApprovedInvoiceDraft(extraction, command, reviewedAt)
    : null;

  return {
    action: command.action,
    documentStatus: toDocumentStatus(command.action),
    reviewTaskStatus: toReviewTaskStatus(command.action),
    reviewNotes: command.review_notes,
    reviewedBy: command.reviewed_by,
    reviewedAt,
    validation,
    invoiceDraft,
    auditEvent: buildAuditEvent(extraction, command, invoiceDraft, validation, reviewedAt)
  };
}

function validateInvoiceReviewCommand(
  extraction: ReceivedInvoiceExtraction,
  command: InvoiceReviewCommand
): ReviewValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (command.action !== "approve") {
    if (!command.review_notes.trim()) {
      warnings.push("review_notes is empty");
    }

    return {
      status: "valid",
      errors,
      warnings
    };
  }

  if (!command.reviewed_by) {
    errors.push("reviewed_by is required to approve");
  }

  if (!command.fiscal_entity_id) {
    errors.push("fiscal_entity_id is required to create an invoice");
  }

  if (!command.client_id) {
    errors.push("client_id is required to create an invoice");
  }

  const invoiceNumber = chooseString(command.corrections.invoice_number, extraction.invoice.invoice_number);
  const issueDate = chooseString(command.corrections.issue_date, extraction.invoice.issue_date);
  const currency = chooseString(command.corrections.currency, extraction.invoice.currency);
  const totalAmount = chooseNumber(command.corrections.total_amount, extraction.amounts.total_amount);
  const subtotalAmount = chooseNumber(command.corrections.subtotal_amount, extraction.amounts.subtotal_amount);
  const taxAmount = chooseNumber(command.corrections.tax_amount, extraction.amounts.tax_amount);
  const supplierTaxId = chooseString(command.corrections.supplier_tax_id, extraction.supplier.tax_id);

  if (!invoiceNumber) {
    errors.push("invoice_number is required to approve");
  }

  if (!issueDate) {
    errors.push("issue_date is required to approve");
  }

  if (!currency) {
    errors.push("currency is required to approve");
  }

  if (totalAmount === null) {
    errors.push("total_amount is required to approve");
  }

  if (subtotalAmount !== null && taxAmount !== null && totalAmount !== null) {
    const expectedTotal = roundMoney(subtotalAmount + taxAmount);
    const difference = Math.abs(expectedTotal - roundMoney(totalAmount));

    if (difference > 0.02) {
      errors.push(`approved amounts mismatch: expected ${expectedTotal}, got ${roundMoney(totalAmount)}`);
    }
  }

  if (!supplierTaxId) {
    warnings.push("supplier_tax_id is missing");
  }

  if (extraction.confidence.overall < 0.6) {
    warnings.push(`approving low-confidence extraction (${extraction.confidence.overall})`);
  }

  const taxBreakdowns = buildTaxBreakdowns(extraction, command);

  if (taxBreakdowns.length === 0 && taxAmount !== null && taxAmount > 0) {
    warnings.push("tax_amount is present but no tax_breakdowns are available");
  }

  return {
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
    warnings
  };
}

function buildApprovedInvoiceDraft(
  extraction: ReceivedInvoiceExtraction,
  command: InvoiceReviewCommand,
  reviewedAt: string
): ApprovedInvoiceDraft {
  const invoiceNumber = requiredString(chooseString(command.corrections.invoice_number, extraction.invoice.invoice_number), "invoice_number");
  const issueDate = requiredString(chooseString(command.corrections.issue_date, extraction.invoice.issue_date), "issue_date");
  const currency = requiredString(chooseString(command.corrections.currency, extraction.invoice.currency), "currency");
  const totalAmount = requiredNumber(chooseNumber(command.corrections.total_amount, extraction.amounts.total_amount), "total_amount");

  return {
    organizationId: command.organization_id,
    fiscalEntityId: requiredString(command.fiscal_entity_id, "fiscal_entity_id"),
    clientId: requiredString(command.client_id, "client_id"),
    sourceDocumentId: command.document_id,
    sourceExtractionId: command.extraction_id,
    direction: "received",
    supplierTaxId: chooseString(command.corrections.supplier_tax_id, extraction.supplier.tax_id),
    customerTaxId: chooseString(command.corrections.customer_tax_id, extraction.customer.tax_id),
    invoiceNumber,
    issueDate,
    dueDate: chooseString(command.corrections.due_date, extraction.invoice.due_date),
    currency,
    subtotalAmount: chooseNumber(command.corrections.subtotal_amount, extraction.amounts.subtotal_amount) ?? 0,
    taxAmount: chooseNumber(command.corrections.tax_amount, extraction.amounts.tax_amount) ?? 0,
    totalAmount,
    status: "draft",
    humanApprovedBy: requiredString(command.reviewed_by, "reviewed_by"),
    humanApprovedAt: reviewedAt,
    lines: buildInvoiceLines(extraction, command),
    taxBreakdowns: buildTaxBreakdowns(extraction, command)
  };
}

function buildInvoiceLines(
  extraction: ReceivedInvoiceExtraction,
  command: InvoiceReviewCommand
): ReviewLineItem[] {
  if (command.line_items.length > 0) {
    return command.line_items;
  }

  return extraction.line_items
    .map((line) => ({
      description: line.description,
      quantity: line.quantity ?? 1,
      unit_price: line.unit_price ?? 0,
      tax_rate_percent: line.tax_rate_percent,
      line_total: line.line_total ?? 0
    }))
    .filter((line) => line.description !== null || line.line_total !== 0);
}

function buildTaxBreakdowns(
  extraction: ReceivedInvoiceExtraction,
  command: InvoiceReviewCommand
): ReviewTaxBreakdown[] {
  if (command.tax_breakdowns.length > 0) {
    return command.tax_breakdowns;
  }

  return extraction.tax_breakdowns
    .filter((breakdown) => {
      return breakdown.tax_rate_percent !== null
        && breakdown.taxable_base !== null
        && breakdown.tax_amount !== null;
    })
    .map((breakdown) => ({
      tax_rate_percent: requiredNumber(breakdown.tax_rate_percent, "tax_rate_percent"),
      taxable_base: requiredNumber(breakdown.taxable_base, "taxable_base"),
      tax_amount: requiredNumber(breakdown.tax_amount, "tax_amount")
    }));
}

function buildAuditEvent(
  extraction: ReceivedInvoiceExtraction,
  command: InvoiceReviewCommand,
  invoiceDraft: ApprovedInvoiceDraft | null,
  validation: ReviewValidation,
  reviewedAt: string
): ReviewAuditEvent {
  return {
    organizationId: command.organization_id,
    actorUserId: command.reviewed_by,
    action: toAuditAction(command.action),
    resourceType: "document",
    resourceId: command.document_id,
    beforeSnapshot: {
      extraction,
      review_task_id: command.review_task_id,
      extraction_id: command.extraction_id
    },
    afterSnapshot: {
      action: command.action,
      review_notes: command.review_notes,
      corrections: command.corrections,
      invoice_draft: invoiceDraft,
      validation
    },
    createdAt: reviewedAt
  };
}

function toDocumentStatus(action: InvoiceReviewCommand["action"]): InvoiceReviewOutcome["documentStatus"] {
  if (action === "approve") {
    return "approved";
  }

  if (action === "reject") {
    return "rejected";
  }

  return "needs_review";
}

function toReviewTaskStatus(action: InvoiceReviewCommand["action"]): InvoiceReviewOutcome["reviewTaskStatus"] {
  if (action === "approve") {
    return "approved";
  }

  if (action === "reject") {
    return "rejected";
  }

  return "changes_requested";
}

function toAuditAction(action: InvoiceReviewCommand["action"]): ReviewAuditEvent["action"] {
  if (action === "approve") {
    return "document.review_approved";
  }

  if (action === "reject") {
    return "document.review_rejected";
  }

  return "document.review_changes_requested";
}

function chooseString(correction: string | null, original: string | null): string | null {
  const chosen = correction ?? original;
  return chosen?.trim() ? chosen.trim() : null;
}

function chooseNumber(correction: number | null, original: number | null): number | null {
  return correction ?? original;
}

function requiredString(value: string | null, fieldName: string): string {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function requiredNumber(value: number | null, fieldName: string): number {
  if (value === null) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}
