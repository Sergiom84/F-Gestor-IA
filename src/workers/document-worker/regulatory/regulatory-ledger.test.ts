import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRegulatoryEventRow,
  prepareRegulatoryRecord,
  validateRegulatoryAppend,
  validateRegulatoryLedger
} from "./regulatory-ledger.js";
import type {
  RegulatoryEvent,
  RegulatoryMode,
  RegulatoryReadinessInput
} from "./regulatory-schema.js";

const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";
const FISCAL_ENTITY_ID = "00000000-0000-0000-0000-000000000002";
const INVOICE_ID = "invoice-1";

test("prepares a verifiable first regulatory event row", () => {
  const preparation = prepareRegulatoryRecord(buildInput());
  const row = buildRegulatoryEventRow(preparation.nextEvent);

  assert.equal(preparation.ledgerValidation.valid, true);
  assert.equal(preparation.nextEvent.previous_hash, null);
  assert.equal(preparation.nextEvent.event_type, "verifactu.record_prepared");
  assert.equal(row.organization_id, ORGANIZATION_ID);
  assert.equal(row.invoice_id, INVOICE_ID);
  assert.equal(row.ledger_version, "regulatory_ledger_v1");
  assert.equal(row.row_version, "regulatory_event_row_v1");
  assert.equal(row.official_submission_ready, false);
});

test("links a second event to the previous hash", () => {
  const firstPreparation = prepareRegulatoryRecord(buildInput({
    generatedAt: "2026-06-03T10:00:00.000Z"
  }));
  const secondPreparation = prepareRegulatoryRecord(buildInput({
    generatedAt: "2026-06-03T10:05:00.000Z",
    priorEvents: [firstPreparation.nextEvent],
    regulatoryMode: "b2b_einvoice_pending"
  }));

  assert.equal(secondPreparation.ledgerValidation.valid, true);
  assert.equal(secondPreparation.nextEvent.previous_hash, firstPreparation.nextEvent.hash);
  assert.equal(secondPreparation.nextEvent.event_type, "b2b_einvoice.prepared");
  assert.deepEqual(
    validateRegulatoryAppend([firstPreparation.nextEvent], secondPreparation.nextEvent),
    {
      valid: true,
      errors: []
    }
  );
});

test("detects payload tampering through the event hash", () => {
  const preparation = prepareRegulatoryRecord(buildInput());
  const tamperedEvent: RegulatoryEvent = {
    ...preparation.nextEvent,
    payload: {
      ...preparation.nextEvent.payload,
      tampered_total_amount: 999
    }
  };

  const validation = validateRegulatoryLedger([tamperedEvent]);

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /hash mismatch/);
});

test("rejects append events from another tenant or invoice", () => {
  const firstPreparation = prepareRegulatoryRecord(buildInput({
    generatedAt: "2026-06-03T10:00:00.000Z"
  }));
  const secondPreparation = prepareRegulatoryRecord(buildInput({
    generatedAt: "2026-06-03T10:05:00.000Z",
    priorEvents: [firstPreparation.nextEvent]
  }));
  const crossTenantEvent: RegulatoryEvent = {
    ...secondPreparation.nextEvent,
    organization_id: "00000000-0000-0000-0000-000000000099",
    invoice_id: "invoice-from-another-ledger"
  };

  const validation = validateRegulatoryAppend([firstPreparation.nextEvent], crossTenantEvent);

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /organization_id mismatch/);
  assert.match(validation.errors.join("\n"), /invoice_id mismatch/);
});

test("rejects append events that move backwards in time", () => {
  const firstPreparation = prepareRegulatoryRecord(buildInput({
    generatedAt: "2026-06-03T10:00:00.000Z"
  }));
  const secondPreparation = prepareRegulatoryRecord(buildInput({
    generatedAt: "2026-06-03T09:59:00.000Z",
    priorEvents: [firstPreparation.nextEvent]
  }));

  assert.equal(secondPreparation.ledgerValidation.valid, false);
  assert.match(secondPreparation.ledgerValidation.errors.join("\n"), /occurred_at is before previous event/);
});

function buildInput(args: {
  generatedAt?: string;
  priorEvents?: RegulatoryEvent[];
  regulatoryMode?: RegulatoryMode;
} = {}): RegulatoryReadinessInput {
  return {
    organization_id: ORGANIZATION_ID,
    fiscal_entity_id: FISCAL_ENTITY_ID,
    regulatory_mode: args.regulatoryMode ?? "verifactu_pending",
    invoice: {
      id: INVOICE_ID,
      organization_id: ORGANIZATION_ID,
      fiscal_entity_id: FISCAL_ENTITY_ID,
      direction: "issued",
      invoice_number: "2026-0001",
      issue_date: "2026-06-03",
      currency: "EUR",
      supplier_tax_id: "B12345678",
      customer_tax_id: "B87654321",
      subtotal_amount: 100,
      tax_amount: 21,
      total_amount: 121,
      status: "draft",
      human_approved_at: "2026-06-03T09:00:00.000Z"
    },
    actor: {
      user_id: "00000000-0000-0000-0000-000000000003",
      role: "accountant",
      system_id: "gfiscal"
    },
    prior_events: args.priorEvents ?? [],
    generated_at: args.generatedAt ?? "2026-06-03T10:00:00.000Z"
  };
}
