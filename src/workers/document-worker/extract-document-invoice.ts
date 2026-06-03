import { z } from "zod";
import { loadDatabaseUrl, loadOpenAiInvoiceConfig } from "./ai/config.js";
import { processReceivedInvoiceExtraction } from "./ai/processor.js";
import { createDb } from "./db.js";

const documentId = process.argv[2];
const parsedDocumentId = z.string().uuid().safeParse(documentId);

if (!parsedDocumentId.success) {
  console.error("Usage: npm run worker:extract-invoice -- <document_id>");
  process.exit(1);
}

const db = createDb({ databaseUrl: loadDatabaseUrl() });
const aiConfig = loadOpenAiInvoiceConfig();

try {
  const result = await processReceivedInvoiceExtraction(db, aiConfig, parsedDocumentId.data);

  console.info(JSON.stringify(
    {
      document_id: result.document.documentId,
      organization_id: result.document.organizationId,
      chunk_count: result.document.chunkCount,
      extraction_id: result.saved.extractionId,
      review_task_id: result.saved.reviewTaskId,
      validation: result.validation
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
