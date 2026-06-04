import test from "node:test";
import assert from "node:assert/strict";
import { assertAiBudgetStateAvailable, classifyAiRequestFailure } from "./processor.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

test("allows AI extraction when monthly budget is unlimited", () => {
  assert.doesNotThrow(() => assertAiBudgetStateAvailable(organizationId, {
    monthlyBudgetCents: 0,
    spentThisMonthCents: 10_000
  }));
});

test("allows AI extraction while monthly budget has remaining capacity", () => {
  assert.doesNotThrow(() => assertAiBudgetStateAvailable(organizationId, {
    monthlyBudgetCents: 1_000,
    spentThisMonthCents: 999
  }));
});

test("blocks AI extraction when monthly budget is exhausted", () => {
  assert.throws(
    () => assertAiBudgetStateAvailable(organizationId, {
      monthlyBudgetCents: 1_000,
      spentThisMonthCents: 1_000
    }),
    /AI monthly budget exhausted.*1000\/1000 cents/
  );
});

test("classifies AI failures for ai_requests audit rows", () => {
  assert.equal(classifyAiRequestFailure(new Error("OpenAI response output text was empty")), "schema_error");
  assert.equal(classifyAiRequestFailure(new Error("OpenAI Responses API failed (500): nope")), "provider_error");
  assert.equal(classifyAiRequestFailure(new DOMException("timed out", "AbortError")), "timeout");
});
