import type { DbClient } from "../db.js";
import type { OpenAiInvoiceConfig } from "./config.js";
import { extractReceivedInvoiceWithOpenAi } from "./openai-provider.js";
import {
  findReceivedInvoiceDuplicates,
  getOrganizationAiBudgetState,
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

export type InvoiceExtractionRunOptions = {
  markFailedDocument?: boolean;
};

export async function processReceivedInvoiceExtraction(
  db: DbClient,
  aiConfig: OpenAiInvoiceConfig,
  documentId: string,
  options: InvoiceExtractionRunOptions = {}
): Promise<InvoiceExtractionRunResult> {
  const markFailedDocument = options.markFailedDocument ?? true;
  const documentInput = await getDocumentAiInput(db, documentId);

  if (!documentInput) {
    throw new Error(`Document ${documentId} was not found`);
  }

  if (documentInput.chunkCount === 0 || !documentInput.text.trim()) {
    const errorMessage = `Document ${documentId} has no extracted text chunks`;
    if (markFailedDocument) {
      await markDocumentAiFailed(db, documentId, errorMessage);
    }
    throw new Error(errorMessage);
  }

  await markDocumentAiProcessing(db, documentId);

  try {
    await assertAiBudgetAvailable(db, documentInput);

    const aiResult = await extractReceivedInvoiceWithOpenAi(aiConfig, documentInput.text);
    const baseValidation = validateReceivedInvoiceExtraction(aiResult.extraction);
    const duplicates = await findReceivedInvoiceDuplicates(
      db,
      documentInput.organizationId,
      aiResult.extraction
    );
    const validation = withDuplicateWarnings(baseValidation, duplicates.map((duplicate) => duplicate.id));
    const saved = await saveReceivedInvoiceExtraction(db, documentInput, aiResult, validation);

    return {
      document: documentInput,
      validation,
      saved
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (markFailedDocument) {
      await markDocumentAiFailed(db, documentId, errorMessage);
    }
    throw error;
  }
}

async function assertAiBudgetAvailable(db: DbClient, documentInput: DocumentAiInput): Promise<void> {
  const budgetState = await getOrganizationAiBudgetState(db, documentInput.organizationId);

  if (budgetState.monthlyBudgetCents === 0) {
    return;
  }

  if (budgetState.spentThisMonthCents >= budgetState.monthlyBudgetCents) {
    throw new Error(
      `AI monthly budget exhausted for organization ${documentInput.organizationId}: ` +
      `${budgetState.spentThisMonthCents}/${budgetState.monthlyBudgetCents} cents`
    );
  }
}

function withDuplicateWarnings(
  validation: ReceivedInvoiceValidation,
  duplicateInvoiceIds: string[]
): ReceivedInvoiceValidation {
  if (duplicateInvoiceIds.length === 0) {
    return validation;
  }

  return {
    ...validation,
    warnings: [
      ...validation.warnings,
      `duplicate invoice candidates: ${duplicateInvoiceIds.join(", ")}`
    ]
  };
}
