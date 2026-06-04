import test from "node:test";
import assert from "node:assert/strict";
import { calculateRetryDelaySeconds, resolveProcessingJobRoute } from "./processor.js";

test("routes supported document jobs by job_type", () => {
  assert.equal(resolveProcessingJobRoute("extract_text"), "extract_text");
  assert.equal(resolveProcessingJobRoute("ai_extract"), "ai_extract");
});

test("rejects unsupported document job types", () => {
  assert.throws(
    () => resolveProcessingJobRoute("ocr"),
    /Unsupported document job type: ocr/
  );
});

test("calculates exponential retry backoff from the current attempt count", () => {
  assert.equal(calculateRetryDelaySeconds(30, 1), 30);
  assert.equal(calculateRetryDelaySeconds(30, 2), 60);
  assert.equal(calculateRetryDelaySeconds(30, 3), 120);
  assert.equal(calculateRetryDelaySeconds(30, 4), 240);
});
