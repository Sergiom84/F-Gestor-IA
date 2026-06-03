import { createHash, randomUUID } from "node:crypto";
import {
  REGULATORY_EVENT_ROW_VERSION,
  REGULATORY_LEDGER_VERSION,
  regulatoryEventRowSchema,
  regulatoryReadinessInputSchema,
  type B2bInvoiceStatus,
  type RegulatoryEvent,
  type RegulatoryEventRow,
  type RegulatoryEventType,
  type RegulatoryPreparation,
  type RegulatoryReadiness,
  type RegulatoryReadinessInput,
  type RegulatoryReadinessIssue
} from "./regulatory-schema.js";

export function prepareRegulatoryRecord(inputValue: unknown): RegulatoryPreparation {
  const input = regulatoryReadinessInputSchema.parse(inputValue);
  const generatedAt = input.generated_at ?? new Date().toISOString();
  const readiness = buildRegulatoryReadiness(input);
  const previousEvent = input.prior_events.at(-1) ?? null;
  const nextEvent = createRegulatoryEvent({
    input,
    eventType: chooseNextEventType(input, readiness),
    occurredAt: generatedAt,
    previousHash: previousEvent?.hash ?? null
  });
  const ledgerValidation = validateRegulatoryAppend(input.prior_events, nextEvent);

  return {
    ledgerVersion: REGULATORY_LEDGER_VERSION,
    organizationId: input.organization_id,
    fiscalEntityId: input.fiscal_entity_id,
    invoiceId: input.invoice.id,
    generatedAt,
    readiness,
    nextEvent,
    ledgerValidation,
    exportRecord: {
      format: "gfiscal_regulatory_json_v1",
      officialSubmissionReady: false,
      payload: buildExportPayload(input, readiness, nextEvent)
    }
  };
}

export function buildRegulatoryEventRow(
  event: RegulatoryEvent,
  createdAt = event.occurred_at
): RegulatoryEventRow {
  return regulatoryEventRowSchema.parse({
    id: event.id,
    organization_id: event.organization_id,
    fiscal_entity_id: event.fiscal_entity_id,
    invoice_id: event.invoice_id,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    actor_user_id: event.actor.user_id,
    actor_role: event.actor.role,
    actor_system_id: event.actor.system_id,
    payload: event.payload,
    previous_hash: event.previous_hash,
    hash: event.hash,
    ledger_version: REGULATORY_LEDGER_VERSION,
    row_version: REGULATORY_EVENT_ROW_VERSION,
    export_format: "gfiscal_regulatory_json_v1",
    official_submission_ready: false,
    created_at: createdAt
  });
}

export function buildRegulatoryReadiness(inputValue: unknown): RegulatoryReadiness {
  const input = regulatoryReadinessInputSchema.parse(inputValue);
  const issues: RegulatoryReadinessIssue[] = [];
  const invoice = input.invoice;
  const isIssuedInvoice = invoice.direction === "issued";
  const requiresVerifactuRecord = isIssuedInvoice && input.regulatory_mode !== "internal_only";
  const requiresB2bEInvoiceState = isIssuedInvoice
    && (input.regulatory_mode === "b2b_einvoice_pending" || input.regulatory_mode === "b2b_einvoice_active");

  if (invoice.direction === "received") {
    issues.push({
      level: "info",
      code: "received_invoice_no_issuance_record",
      message: "La factura recibida se conserva y revisa, pero no genera registro de expedicion."
    });
  }

  requireField(invoice.invoice_number, "invoice_number", "Numero de factura requerido.", issues);
  requireField(invoice.issue_date, "issue_date", "Fecha de expedicion requerida.", issues);
  requireField(invoice.currency, "currency", "Moneda requerida.", issues);
  requireNumber(invoice.total_amount, "total_amount", "Total de factura requerido.", issues);

  if (isIssuedInvoice) {
    requireField(invoice.supplier_tax_id, "supplier_tax_id", "NIF/CIF del emisor requerido.", issues);
    requireField(invoice.customer_tax_id, "customer_tax_id", "NIF/CIF del destinatario requerido.", issues);
  }

  if (!invoice.human_approved_at) {
    issues.push({
      level: "warning",
      code: "not_human_approved",
      message: "La factura no consta como aprobada por revision humana."
    });
  }

  if (requiresVerifactuRecord && input.regulatory_mode === "verifactu_pending") {
    issues.push({
      level: "warning",
      code: "verifactu_not_reporting",
      message: "Modo VERI*FACTU pendiente: preparar registros, pero no marcar como remitidos."
    });
  }

  if (input.regulatory_mode === "verifactu_reporting") {
    issues.push({
      level: "info",
      code: "verifactu_legend_allowed",
      message: "La leyenda VERI*FACTU solo debe usarse si se remiten todos los registros a AEAT."
    });
  }

  if (requiresB2bEInvoiceState) {
    issues.push({
      level: "info",
      code: "b2b_state_tracking_required",
      message: "La factura electronica B2B requiere seguimiento de estados."
    });
  }

  const hasErrors = issues.some((issue) => issue.level === "error");

  return {
    status: hasErrors ? "blocked" : "ready",
    mode: input.regulatory_mode,
    requiresVerifactuRecord,
    requiresQrPlaceholder: isIssuedInvoice && input.regulatory_mode !== "internal_only",
    allowsVerifactuLegend: input.regulatory_mode === "verifactu_reporting",
    requiresB2bEInvoiceState,
    b2bStatus: requiresB2bEInvoiceState ? "prepared" : "not_applicable",
    issues
  };
}

export function validateRegulatoryLedger(events: RegulatoryEvent[]) {
  const errors: string[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const previousEvent = index > 0 ? events[index - 1] : null;
    const expectedPreviousHash = previousEvent?.hash ?? null;

    if (!event) {
      errors.push(`Event at index ${index} is missing`);
      continue;
    }

    if (event.previous_hash !== expectedPreviousHash) {
      errors.push(`Event ${event.id} previous_hash mismatch`);
    }

    const expectedHash = hashRegulatoryEvent(event);

    if (event.hash !== expectedHash) {
      errors.push(`Event ${event.id} hash mismatch`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateRegulatoryAppend(
  priorEvents: RegulatoryEvent[],
  nextEvent: RegulatoryEvent
) {
  const errors = validateRegulatoryLedger([...priorEvents, nextEvent]).errors;
  const previousEvent = priorEvents.at(-1) ?? null;

  for (const priorEvent of priorEvents) {
    if (priorEvent.organization_id !== nextEvent.organization_id) {
      errors.push(`Event ${nextEvent.id} organization_id mismatch with prior event ${priorEvent.id}`);
    }

    if (priorEvent.invoice_id !== nextEvent.invoice_id) {
      errors.push(`Event ${nextEvent.id} invoice_id mismatch with prior event ${priorEvent.id}`);
    }
  }

  if (previousEvent && nextEvent.occurred_at < previousEvent.occurred_at) {
    errors.push(`Event ${nextEvent.id} occurred_at is before previous event ${previousEvent.id}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function hashRegulatoryEvent(event: Omit<RegulatoryEvent, "hash"> | RegulatoryEvent): string {
  const { hash: _hash, ...hashableEvent } = event as RegulatoryEvent;
  return sha256(canonicalJson(hashableEvent));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

function createRegulatoryEvent(args: {
  input: RegulatoryReadinessInput;
  eventType: RegulatoryEventType;
  occurredAt: string;
  previousHash: string | null;
}): RegulatoryEvent {
  const baseEvent: Omit<RegulatoryEvent, "hash"> = {
    id: randomUUID(),
    organization_id: args.input.organization_id,
    fiscal_entity_id: args.input.fiscal_entity_id,
    invoice_id: args.input.invoice.id,
    event_type: args.eventType,
    occurred_at: args.occurredAt,
    actor: args.input.actor,
    payload: {
      regulatory_mode: args.input.regulatory_mode,
      invoice: args.input.invoice
    },
    previous_hash: args.previousHash
  };

  return {
    ...baseEvent,
    hash: hashRegulatoryEvent(baseEvent)
  };
}

function chooseNextEventType(
  input: RegulatoryReadinessInput,
  readiness: RegulatoryReadiness
): RegulatoryEventType {
  if (readiness.requiresB2bEInvoiceState) {
    return "b2b_einvoice.prepared";
  }

  if (readiness.requiresVerifactuRecord) {
    return "verifactu.record_prepared";
  }

  if (input.invoice.status === "cancelled" || input.invoice.status === "void") {
    return "invoice.cancelled";
  }

  if (input.invoice.direction === "issued") {
    return "invoice.issued";
  }

  return "invoice.draft_prepared";
}

function buildExportPayload(
  input: RegulatoryReadinessInput,
  readiness: RegulatoryReadiness,
  event: RegulatoryEvent
): Record<string, unknown> {
  return {
    schema_version: REGULATORY_LEDGER_VERSION,
    generated_at: event.occurred_at,
    organization_id: input.organization_id,
    fiscal_entity_id: input.fiscal_entity_id,
    regulatory_mode: input.regulatory_mode,
    invoice: input.invoice,
    readiness,
    event,
    notices: [
      "GFiscal export is an internal preparation record.",
      "This payload is not an official AEAT, VERI*FACTU, Facturae, UBL, CII or Peppol submission."
    ]
  };
}

function requireField(
  value: string | null,
  code: string,
  message: string,
  issues: RegulatoryReadinessIssue[]
): void {
  if (!value || !value.trim()) {
    issues.push({
      level: "error",
      code,
      message
    });
  }
}

function requireNumber(
  value: number | null,
  code: string,
  message: string,
  issues: RegulatoryReadinessIssue[]
): void {
  if (value === null || !Number.isFinite(value)) {
    issues.push({
      level: "error",
      code,
      message
    });
  }
}

function toCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toCanonicalValue);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, toCanonicalValue(record[key])])
    );
  }

  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
