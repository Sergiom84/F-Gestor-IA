import type { DbClient } from "../db.js";
import type { OpenAiInvoiceConfig } from "./config.js";
import { extractReceivedInvoiceWithOpenAi } from "./openai-provider.js";
import {
  getDocumentAiInput,
  markDocumentAiFailed,
  markDocumentAiProcessing,
  saveReceivedInvoiceExtraction,
  type DocumentAiInput,
  type SavedInvoiceExtraction
} from "./repository.js";
import {
  validateReceivedInvoiceExtraction,
  type ReceivedInvoiceValidation
} from "./invoice-schema.js";

export type InvoiceExtractionRunResult = {
  document: DocumentAiInput;
  validation: ReceivedInvoiceValidation;
  saved: SavedInvoiceExtraction;
};

export async function processReceivedInvoiceExtraction(
  db: DbClient,
  aiConfig: OpenAiInvoiceConfig,
  documentId: string
): Promise<InvoiceExtractionRunResult> {
  const documentInput = await getDocumentAiInput(db, documentId);

  if (!documentInput) {
    throw new Error(`Document ${documentId} was not found`);
  }

  if (documentInput.chunkCount === 0 || !documentInput.text.trim()) {
    const errorMessage = `Document ${documentId} has no extracted text chunks`;
    await markDocumentAiFailed(db, documentId, errorMessage);
    throw new Error(errorMessage);
  }

  await markDocumentAiProcessing(db, documentId);

  try {
    const aiResult = await extractReceivedInvoiceWithOpenAi(aiConfig, documentInput.text);
    const validation = validateReceivedInvoiceExtraction(aiResult.extraction);
    const saved = await saveReceivedInvoiceExtraction(db, documentInput, aiResult, validation);

    return {
      document: documentInput,
      validation,
      saved
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markDocumentAiFailed(db, documentId, errorMessage);
    throw error;
  }
}
