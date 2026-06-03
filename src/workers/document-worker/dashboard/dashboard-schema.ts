import { z } from "zod";

const nullableStringSchema = z.string().nullable();
const nullableNumberSchema = z.number().nullable();

export const dashboardDocumentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  fiscal_entity_id: nullableStringSchema,
  document_type: z.string(),
  status: z.string(),
  failure_reason: nullableStringSchema,
  created_at: nullableStringSchema
});

export const dashboardReviewTaskSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  document_id: z.string(),
  status: z.string(),
  assigned_to: nullableStringSchema,
  priority: z.number().optional(),
  created_at: nullableStringSchema
});

export const dashboardInvoiceSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  fiscal_entity_id: nullableStringSchema,
  direction: z.enum(["issued", "received"]),
  invoice_number: nullableStringSchema,
  issue_date: nullableStringSchema,
  currency: z.string().default("EUR"),
  subtotal_amount: nullableNumberSchema,
  tax_amount: nullableNumberSchema,
  total_amount: nullableNumberSchema,
  status: z.string(),
  human_approved_at: nullableStringSchema
});

export const dashboardAiCostEventSchema = z.object({
  id: z.string().optional(),
  organization_id: z.string(),
  provider_key: z.string(),
  model_key: z.string(),
  estimated_cost_cents: z.number(),
  input_token_count: z.number(),
  output_token_count: z.number(),
  created_at: nullableStringSchema
});

export const dashboardInputSchema = z.object({
  organization_id: z.string(),
  generated_at: z.string().optional(),
  documents: z.array(dashboardDocumentSchema).default([]),
  review_tasks: z.array(dashboardReviewTaskSchema).default([]),
  invoices: z.array(dashboardInvoiceSchema).default([]),
  ai_cost_events: z.array(dashboardAiCostEventSchema).default([])
});

export const dashboardOptionsSchema = z.object({
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  currency: z.string().default("EUR")
});

export type DashboardDocument = z.infer<typeof dashboardDocumentSchema>;
export type DashboardReviewTask = z.infer<typeof dashboardReviewTaskSchema>;
export type DashboardInvoice = z.infer<typeof dashboardInvoiceSchema>;
export type DashboardAiCostEvent = z.infer<typeof dashboardAiCostEventSchema>;
export type DashboardInput = z.infer<typeof dashboardInputSchema>;
export type DashboardOptions = z.infer<typeof dashboardOptionsSchema>;

export type DashboardSnapshot = {
  organizationId: string;
  generatedAt: string;
  period: {
    start: string | null;
    end: string | null;
    currency: string;
  };
  documents: {
    total: number;
    pending: number;
    failed: number;
    needsReview: number;
    approved: number;
    rejected: number;
    ocrRequired: number;
    byStatus: Record<string, number>;
  };
  review: {
    open: number;
    inReview: number;
    changesRequested: number;
    highPriority: number;
    byStatus: Record<string, number>;
  };
  invoices: {
    approvedCount: number;
    receivedCount: number;
    issuedCount: number;
    expenseTotal: number;
    incomeTotal: number;
    inputVat: number;
    outputVat: number;
    vatPosition: number;
    byStatus: Record<string, number>;
  };
  aiCost: {
    estimatedCostCents: number;
    inputTokens: number;
    outputTokens: number;
    byProvider: Record<string, number>;
  };
  periods: Array<{
    period: string;
    receivedTotal: number;
    issuedTotal: number;
    inputVat: number;
    outputVat: number;
    aiCostCents: number;
  }>;
  alerts: Array<{
    level: "info" | "warning" | "critical";
    code: string;
    message: string;
  }>;
};
