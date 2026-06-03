import { z } from "zod";

const nullableUuidSchema = z.string().uuid().nullable();
const nullableStringSchema = z.string().nullable();
const nullableNumberSchema = z.number().nullable();

export const reviewActionSchema = z.enum(["approve", "reject", "changes_requested"]);

export const invoiceCorrectionSchema = z.object({
  supplier_tax_id: nullableStringSchema,
  customer_tax_id: nullableStringSchema,
  invoice_number: nullableStringSchema,
  issue_date: nullableStringSchema,
  due_date: nullableStringSchema,
  currency: nullableStringSchema,
  subtotal_amount: nullableNumberSchema,
  tax_amount: nullableNumberSchema,
  total_amount: nullableNumberSchema
});

export const reviewLineItemSchema = z.object({
  description: nullableStringSchema,
  quantity: z.number(),
  unit_price: z.number(),
  tax_rate_percent: nullableNumberSchema,
  line_total: z.number()
});

export const reviewTaxBreakdownSchema = z.object({
  tax_rate_percent: z.number(),
  taxable_base: z.number(),
  tax_amount: z.number()
});

export const invoiceReviewCommandSchema = z.object({
  action: reviewActionSchema,
  organization_id: z.string().uuid(),
  document_id: z.string().uuid(),
  extraction_id: nullableUuidSchema,
  review_task_id: nullableUuidSchema,
  fiscal_entity_id: nullableUuidSchema,
  client_id: nullableUuidSchema,
  reviewed_by: nullableUuidSchema,
  review_notes: z.string(),
  corrections: invoiceCorrectionSchema,
  line_items: z.array(reviewLineItemSchema),
  tax_breakdowns: z.array(reviewTaxBreakdownSchema)
});

export type ReviewAction = z.infer<typeof reviewActionSchema>;
export type InvoiceCorrection = z.infer<typeof invoiceCorrectionSchema>;
export type InvoiceReviewCommand = z.infer<typeof invoiceReviewCommandSchema>;
export type ReviewLineItem = z.infer<typeof reviewLineItemSchema>;
export type ReviewTaxBreakdown = z.infer<typeof reviewTaxBreakdownSchema>;

export type ReviewValidation = {
  status: "valid" | "invalid";
  errors: string[];
  warnings: string[];
};

export type ApprovedInvoiceDraft = {
  organizationId: string;
  fiscalEntityId: string;
  clientId: string;
  sourceDocumentId: string;
  sourceExtractionId: string | null;
  direction: "received";
  supplierTaxId: string | null;
  customerTaxId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: "draft";
  humanApprovedBy: string;
  humanApprovedAt: string;
  lines: ReviewLineItem[];
  taxBreakdowns: ReviewTaxBreakdown[];
};

export type ReviewAuditEvent = {
  organizationId: string;
  actorUserId: string | null;
  action: "document.review_approved" | "document.review_rejected" | "document.review_changes_requested";
  resourceType: "document";
  resourceId: string;
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot: Record<string, unknown>;
  createdAt: string;
};

export type InvoiceReviewOutcome = {
  action: ReviewAction;
  documentStatus: "approved" | "rejected" | "needs_review";
  reviewTaskStatus: "approved" | "rejected" | "changes_requested";
  reviewNotes: string;
  reviewedBy: string | null;
  reviewedAt: string;
  validation: ReviewValidation;
  invoiceDraft: ApprovedInvoiceDraft | null;
  auditEvent: ReviewAuditEvent;
};
