import { readFile } from "node:fs/promises";
import { z } from "zod";
import { loadDatabaseUrl } from "./ai/config.js";
import { createDb } from "./db.js";
import { applyInvoiceReview } from "./review/invoice-review.js";
import {
  getReviewTaskExtractionInput,
  persistInvoiceReviewOutcome
} from "./review/repository.js";

const reviewTaskId = process.argv[2];
const reviewCommandPath = process.argv[3];

const parsedReviewTaskId = z.string().uuid().safeParse(reviewTaskId);

if (!parsedReviewTaskId.success || !reviewCommandPath) {
  console.error("Usage: npm run review:invoice-db -- <review_task_id> <review-command.json>");
  process.exit(1);
}

const db = createDb({ databaseUrl: loadDatabaseUrl() });

try {
  const taskInput = await getReviewTaskExtractionInput(db, parsedReviewTaskId.data);
  const reviewCommandInput = await readJsonFile(reviewCommandPath);
  const command = buildReviewCommand(taskInput, reviewCommandInput);
  const outcome = applyInvoiceReview(taskInput.normalizedData, command);
  const persisted = await persistInvoiceReviewOutcome(db, outcome);

  console.info(JSON.stringify(
    {
      review_task_id: persisted.reviewTaskId,
      document_id: persisted.documentId,
      extraction_id: persisted.extractionId,
      invoice_id: persisted.invoiceId,
      action: persisted.action,
      document_status: persisted.documentStatus,
      review_task_status: persisted.reviewTaskStatus,
      validation: outcome.validation
    },
    null,
    2
  ));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 5 });
}

async function readJsonFile(path: string): Promise<unknown> {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as unknown;
}

function buildReviewCommand(
  taskInput: {
    reviewTaskId: string;
    organizationId: string;
    documentId: string;
    extractionId: string | null;
  },
  input: unknown
): unknown {
  const record = input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};

  return {
    ...record,
    organization_id: taskInput.organizationId,
    document_id: taskInput.documentId,
    extraction_id: taskInput.extractionId,
    review_task_id: taskInput.reviewTaskId
  };
}
