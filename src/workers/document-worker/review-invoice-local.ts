import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { applyInvoiceReview } from "./review/invoice-review.js";

const extractionPath = process.argv[2];
const reviewPath = process.argv[3];

if (!extractionPath || !reviewPath) {
  console.error("Usage: npm run review:invoice-local -- <extraction.json> <review-command.json>");
  process.exit(1);
}

try {
  const extractionInput = await readJsonFile(extractionPath);
  const reviewCommandInput = await readJsonFile(reviewPath);
  const outcome = applyInvoiceReview(extractionInput, reviewCommandInput);

  console.info(JSON.stringify(
    {
      extraction_file: basename(extractionPath),
      review_file: basename(reviewPath),
      outcome
    },
    null,
    2
  ));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function readJsonFile(path: string): Promise<unknown> {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as unknown;
}
