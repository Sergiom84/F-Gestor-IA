import test from "node:test";
import assert from "node:assert/strict";
import { resolveProcessingJobRoute } from "./processor.js";

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
