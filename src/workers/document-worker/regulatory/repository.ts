import type postgres from "postgres";
import type { DbClient } from "../db.js";
import {
  buildRegulatoryEventRow,
  prepareRegulatoryRecord
} from "./regulatory-ledger.js";
import {
  type RegulatoryActor,
  type RegulatoryEvent,
  type RegulatoryEventRow,
  type RegulatoryEventType,
  type RegulatoryMode,
  type RegulatoryPreparation,
  type RegulatoryReadinessInput
} from "./regulatory-schema.js";

export type RegulatoryInvoiceRow = {
  id: string;
  organization_id: string;
  fiscal_entity_id: string | null;
  direction: "issued" | "received";
  invoice_number: string | null;
  issue_date: string | Date | null;
  currency: string;
  supplier_tax_id: string | null;
  customer_tax_id: string | null;
  subtotal_amount: string | number | null;
  tax_amount: string | number | null;
  total_amount: string | number | null;
  status: string;
  human_approved_at: string | Date | null;
};

export type RegulatoryEventDbRow = {
  id: string;
  organization_id: string;
  fiscal_entity_id: string | null;
  invoice_id: string;
  event_type: RegulatoryEventType;
  occurred_at: string | Date;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_system_id: string;
  payload: unknown;
  previous_hash: string | null;
  hash: string;
};

export type SavedRegulatoryEvent = {
  id: string;
  organizationId: string;
  invoiceId: string;
  eventType: RegulatoryEventType;
  previousHash: string | null;
  hash: string;
  createdAt: string;
};

export type PersistRegulatoryInvoiceOptions = {
  invoiceId: string;
  regulatoryMode: RegulatoryMode;
  actor?: RegulatoryActor;
  generatedAt?: string;
};

export type PersistedRegulatoryPreparation = {
  input: RegulatoryReadinessInput;
  preparation: RegulatoryPreparation;
  eventRow: RegulatoryEventRow;
  savedEvent: SavedRegulatoryEvent;
};

const DEFAULT_REGULATORY_ACTOR: RegulatoryActor = {
  user_id: null,
  role: "system",
  system_id: "gfiscal-worker"
};

type SavedRegulatoryEventRow = {
  id: string;
  organization_id: string;
  invoice_id: string;
  event_type: RegulatoryEventType;
  previous_hash: string | null;
  hash: string;
  created_at: string | Date;
};

export async function persistRegulatoryEventForInvoice(
  db: DbClient,
  options: PersistRegulatoryInvoiceOptions
): Promise<PersistedRegulatoryPreparation> {
  const input = await getRegulatoryReadinessInputForInvoice(db, options);
  const preparation = prepareRegulatoryRecord(input);

  assertRegulatoryPreparationPersistable(preparation);

  const eventRow = buildRegulatoryEventRow(preparation.nextEvent);
  const savedEvent = await insertRegulatoryEventRow(db, eventRow);

  return {
    input,
    preparation,
    eventRow,
    savedEvent
  };
}

export async function getRegulatoryReadinessInputForInvoice(
  db: DbClient,
  options: PersistRegulatoryInvoiceOptions
): Promise<RegulatoryReadinessInput> {
  const invoiceRows = await db<RegulatoryInvoiceRow[]>`
    select
      id::text,
      organization_id::text,
      fiscal_entity_id::text,
      direction,
      invoice_number,
      issue_date,
      currency,
      supplier_tax_id,
      customer_tax_id,
      subtotal_amount,
      tax_amount,
      total_amount,
      status,
      human_approved_at
    from public.invoices
    where id = ${options.invoiceId}
      and deleted_at is null
    limit 1
  `;
  const invoice = invoiceRows[0];

  if (!invoice) {
    throw new Error(`Invoice ${options.invoiceId} was not found or is deleted`);
  }

  const priorEvents = await db<RegulatoryEventDbRow[]>`
    select
      id::text,
      organization_id::text,
      fiscal_entity_id::text,
      invoice_id::text,
      event_type,
      occurred_at,
      actor_user_id::text,
      actor_role,
      actor_system_id,
      payload,
      previous_hash,
      hash
    from public.regulatory_events
    where invoice_id = ${options.invoiceId}
    order by occurred_at asc, created_at asc
  `;

  return buildRegulatoryReadinessInputFromRows({
    invoice,
    priorEvents: [...priorEvents],
    regulatoryMode: options.regulatoryMode,
    actor: options.actor ?? DEFAULT_REGULATORY_ACTOR,
    ...(options.generatedAt === undefined ? {} : { generatedAt: options.generatedAt })
  });
}

export function buildRegulatoryReadinessInputFromRows(args: {
  invoice: RegulatoryInvoiceRow;
  priorEvents: RegulatoryEventDbRow[];
  regulatoryMode: RegulatoryMode;
  actor?: RegulatoryActor;
  generatedAt?: string;
}): RegulatoryReadinessInput {
  return {
    organization_id: args.invoice.organization_id,
    fiscal_entity_id: args.invoice.fiscal_entity_id,
    regulatory_mode: args.regulatoryMode,
    invoice: {
      id: args.invoice.id,
      organization_id: args.invoice.organization_id,
      fiscal_entity_id: args.invoice.fiscal_entity_id,
      direction: args.invoice.direction,
      invoice_number: args.invoice.invoice_number,
      issue_date: toDateText(args.invoice.issue_date),
      currency: args.invoice.currency,
      supplier_tax_id: args.invoice.supplier_tax_id,
      customer_tax_id: args.invoice.customer_tax_id,
      subtotal_amount: toNullableNumber(args.invoice.subtotal_amount),
      tax_amount: toNullableNumber(args.invoice.tax_amount),
      total_amount: toNullableNumber(args.invoice.total_amount),
      status: args.invoice.status,
      human_approved_at: toTimestampText(args.invoice.human_approved_at)
    },
    actor: args.actor ?? DEFAULT_REGULATORY_ACTOR,
    prior_events: args.priorEvents.map(toRegulatoryEvent),
    generated_at: args.generatedAt
  };
}

export async function insertRegulatoryEventRow(
  db: DbClient,
  rowValue: RegulatoryEventRow
): Promise<SavedRegulatoryEvent> {
  const rows = await db<SavedRegulatoryEventRow[]>`
    insert into public.regulatory_events (
      id,
      organization_id,
      fiscal_entity_id,
      invoice_id,
      event_type,
      occurred_at,
      actor_user_id,
      actor_role,
      actor_system_id,
      payload,
      previous_hash,
      hash,
      ledger_version,
      row_version,
      export_format,
      official_submission_ready,
      created_at
    )
    values (
      ${rowValue.id},
      ${rowValue.organization_id},
      ${rowValue.fiscal_entity_id},
      ${rowValue.invoice_id},
      ${rowValue.event_type},
      ${rowValue.occurred_at},
      ${rowValue.actor_user_id},
      ${rowValue.actor_role},
      ${rowValue.actor_system_id},
      ${db.json(toJsonValue(rowValue.payload))},
      ${rowValue.previous_hash},
      ${rowValue.hash},
      ${rowValue.ledger_version},
      ${rowValue.row_version},
      ${rowValue.export_format},
      ${rowValue.official_submission_ready},
      ${rowValue.created_at}
    )
    returning
      id::text,
      organization_id::text,
      invoice_id::text,
      event_type,
      previous_hash,
      hash,
      created_at
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Regulatory event insert did not return a row");
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    invoiceId: row.invoice_id,
    eventType: row.event_type,
    previousHash: row.previous_hash,
    hash: row.hash,
    createdAt: toTimestampText(row.created_at) ?? new Date().toISOString()
  };
}

export function assertRegulatoryPreparationPersistable(preparation: RegulatoryPreparation): void {
  if (!preparation.ledgerValidation.valid) {
    throw new Error(`Cannot persist invalid regulatory ledger: ${preparation.ledgerValidation.errors.join("; ")}`);
  }

  if (preparation.readiness.status !== "ready") {
    const issueCodes = preparation.readiness.issues
      .filter((issue) => issue.level === "error")
      .map((issue) => issue.code)
      .join(", ");

    throw new Error(`Cannot persist blocked regulatory readiness: ${issueCodes || "unknown"}`);
  }

  if (!preparation.nextEvent.fiscal_entity_id) {
    throw new Error("Cannot persist regulatory event without fiscal_entity_id");
  }
}

function toRegulatoryEvent(row: RegulatoryEventDbRow): RegulatoryEvent {
  return {
    id: row.id,
    organization_id: row.organization_id,
    fiscal_entity_id: row.fiscal_entity_id,
    invoice_id: row.invoice_id,
    event_type: row.event_type,
    occurred_at: toTimestampText(row.occurred_at) ?? "",
    actor: {
      user_id: row.actor_user_id,
      role: row.actor_role,
      system_id: row.actor_system_id
    },
    payload: asPayloadRecord(row.payload),
    previous_hash: row.previous_hash,
    hash: row.hash
  };
}

function toNullableNumber(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateText(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function toTimestampText(value: string | Date | null): string | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function asPayloadRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new Error("Regulatory event payload must be a JSON object");
}

function toJsonValue(value: unknown): postgres.JSONValue {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}
