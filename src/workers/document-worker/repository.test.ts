import test from "node:test";
import assert from "node:assert/strict";
import { decideExtractedTextNextStep } from "./repository.js";

test("dedupe by file hash sends the document to human review without AI enqueue", () => {
  const nextStep = decideExtractedTextNextStep({
    duplicateFileDocumentIds: ["11111111-1111-4111-8111-111111111111"],
    chunkCount: 3
  });

  assert.deepEqual(nextStep, {
    documentStatus: "needs_review",
    shouldCreateDuplicateReviewTask: true,
    shouldEnqueueAiExtraction: false
  });
});

test("text chunks without duplicate file candidates enqueue AI extraction", () => {
  const nextStep = decideExtractedTextNextStep({
    duplicateFileDocumentIds: [],
    chunkCount: 2
  });

  assert.deepEqual(nextStep, {
    documentStatus: "text_extracted",
    shouldCreateDuplicateReviewTask: false,
    shouldEnqueueAiExtraction: true
  });
});

test("documents without text chunks require OCR and do not enqueue AI extraction", () => {
  const nextStep = decideExtractedTextNextStep({
    duplicateFileDocumentIds: [],
    chunkCount: 0
  });

  assert.deepEqual(nextStep, {
    documentStatus: "ocr_required",
    shouldCreateDuplicateReviewTask: false,
    shouldEnqueueAiExtraction: false
  });
});
