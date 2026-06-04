import { z } from "zod";

export const REGULATORY_LEDGER_VERSION = "regulatory_ledger_v1";
export const REGULATORY_EVENT_ROW_VERSION = "regulatory_event_row_v1";

export const regulatoryModeSchema = z.enum([
  "internal_only",
  "verifactu_pending",
  "verifactu_reporting",
  "b2b_einvoice_pending",
  "b2b_einvoice_active"
]);

export const regulatoryEventTypeSchema = z.enum([
  "invoice.draft_prepared",
  "invoice.issued",
  "invoice.corrected",
  "invoice.cancelled",
  "verifactu.record_prepared",
  "verifactu.record_exported",
  "verifactu.record_submitted",
  "b2b_einvoice.prepared",
  "b2b_einvoice.sent",
  "b2b_einvoice.status_received",
  "regulatory.export_generated"
]);

export const b2bInvoiceStatusSchema = z.enum([
  "not_applicable",
  "prepared",
  "sent",
  "delivered",
  "accepted",
  "rejected",
  "paid",
  "payment_overdue"
]);

export const regulatoryInvoiceSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  fiscal_entity_id: z.string().nullable(),
  direction: z.enum(["issued", "received"]),
  invoice_number: z.string().nullable(),
  issue_date: z.string().nullable(),
  currency: z.string().default("EUR"),
  supplier_tax_id: z.string().nullable(),
  customer_tax_id: z.string().nullable(),
  subtotal_amount: z.number().nullable(),
  tax_amount: z.number().nullable(),
  total_amount: z.number().nullable(),
  status: z.string(),
  human_approved_at: z.string().nullable()
});

export const regulatoryActorSchema = z.object({
  user_id: z.string().nullable(),
  role: z.string().nullable(),
  system_id: z.string().default("gfiscal")
});

export const regulatoryEventSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  fiscal_entity_id: z.string().nullable(),
  invoice_id: z.string(),
  event_type: regulatoryEventTypeSchema,
  occurred_at: z.string(),
  actor: regulatoryActorSchema,
  payload: z.record(z.string(), z.unknown()),
  previous_hash: z.string().nullable(),
  hash: z.string()
});

export const regulatoryReadinessInputSchema = z.object({
  organization_id: z.string(),
  fiscal_entity_id: z.string().nullable(),
  regulatory_mode: regulatoryModeSchema.default("internal_only"),
  invoice: regulatoryInvoiceSchema,
  actor: regulatoryActorSchema.default({
    user_id: null,
    role: null,
    system_id: "gfiscal"
  }),
  prior_events: z.array(regulatoryEventSchema).default([]),
  generated_at: z.string().optional()
});

export const regulatoryEventRowSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  fiscal_entity_id: z.string(),
  invoice_id: z.string(),
  event_type: regulatoryEventTypeSchema,
  occurred_at: z.string(),
  actor_user_id: z.string().nullable(),
  actor_role: z.string().nullable(),
  actor_system_id: z.string(),
  payload: z.record(z.string(), z.unknown()),
  previous_hash: z.string().nullable(),
  hash: z.string(),
  ledger_version: z.literal(REGULATORY_LEDGER_VERSION),
  row_version: z.literal(REGULATORY_EVENT_ROW_VERSION),
  export_format: z.literal("gfiscal_regulatory_json_v1"),
  official_submission_ready: z.literal(false),
  created_at: z.string()
});

export type RegulatoryMode = z.infer<typeof regulatoryModeSchema>;
export type RegulatoryEventType = z.infer<typeof regulatoryEventTypeSchema>;
export type B2bInvoiceStatus = z.infer<typeof b2bInvoiceStatusSchema>;
export type RegulatoryInvoice = z.infer<typeof regulatoryInvoiceSchema>;
export type RegulatoryActor = z.infer<typeof regulatoryActorSchema>;
export type RegulatoryEvent = z.infer<typeof regulatoryEventSchema>;
export type RegulatoryReadinessInput = z.infer<typeof regulatoryReadinessInputSchema>;
export type RegulatoryEventRow = z.infer<typeof regulatoryEventRowSchema>;

export type RegulatoryReadinessIssue = {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
};

export type RegulatoryReadiness = {
  status: "ready" | "blocked";
  mode: RegulatoryMode;
  requiresVerifactuRecord: boolean;
  requiresQrPlaceholder: boolean;
  allowsVerifactuLegend: boolean;
  requiresB2bEInvoiceState: boolean;
  b2bStatus: B2bInvoiceStatus;
  issues: RegulatoryReadinessIssue[];
};

export type RegulatoryLedgerValidation = {
  valid: boolean;
  errors: string[];
};

export type RegulatoryPreparation = {
  ledgerVersion: typeof REGULATORY_LEDGER_VERSION;
  organizationId: string;
  fiscalEntityId: string | null;
  invoiceId: string;
  generatedAt: string;
  readiness: RegulatoryReadiness;
  nextEvent: RegulatoryEvent;
  ledgerValidation: RegulatoryLedgerValidation;
  exportRecord: {
    format: "gfiscal_regulatory_json_v1";
    officialSubmissionReady: false;
    payload: Record<string, unknown>;
  };
};
