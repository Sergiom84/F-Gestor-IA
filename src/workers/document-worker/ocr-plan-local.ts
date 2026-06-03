import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createOcrPlanInputFromExtractedPdf, buildOcrPlan } from "./ocr/ocr-planner.js";
import { extractEmbeddedPdfText } from "./pdf.js";
import type { OcrPlanPolicy } from "./ocr/ocr-schema.js";

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error("Usage: npm run worker:ocr-plan-local -- <path-to-pdf> [budget_cents] [cost_per_page_cents] [max_pages_per_run]");
  process.exit(1);
}

const policy: Partial<OcrPlanPolicy> = {};
const budgetCents = parseOptionalNumber(process.argv[3]);
const costPerPageCents = parseOptionalNumber(process.argv[4]);
const maxPagesPerRun = parseOptionalInteger(process.argv[5]);

if (budgetCents !== null) {
  policy.budget_cents = budgetCents;
}

if (costPerPageCents !== null) {
  policy.cost_per_page_cents = costPerPageCents;
}

if (maxPagesPerRun !== null) {
  policy.max_pages_per_run = maxPagesPerRun;
}

try {
  const buffer = await readFile(pdfPath);
  const extracted = await extractEmbeddedPdfText(buffer);
  const planInput = createOcrPlanInputFromExtractedPdf({
    organizationId: "local",
    documentId: basename(pdfPath),
    documentFileId: null,
    sha256Hash: extracted.sha256Hash,
    pageCount: extracted.pageCount,
    pages: extracted.pages,
    policy
  });
  const plan = buildOcrPlan(planInput);

  console.info(JSON.stringify(
    {
      file: basename(pdfPath),
      embedded_text_pages: extracted.pages.filter((page) => page.text.trim().length > 0).length,
      plan
    },
    null,
    2
  ));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric argument: ${value}`);
  }

  return parsed;
}

function parseOptionalInteger(value: string | undefined): number | null {
  const parsed = parseOptionalNumber(value);

  if (parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer argument: ${value}`);
  }

  return parsed;
}
