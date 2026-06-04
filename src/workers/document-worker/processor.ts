import type { WorkerConfig } from "./config.js";
import type { DbClient } from "./db.js";
import { loadOpenAiInvoiceConfig } from "./ai/config.js";
import { processReceivedInvoiceExtraction } from "./ai/processor.js";
import { logError, logInfo } from "./logger.js";
import { buildTextChunks, extractEmbeddedPdfText } from "./pdf.js";
import {
  getProcessingJob,
  getDocumentFiles,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
  saveExtractedText
} from "./repository.js";
import { downloadStorageObject, type StorageClient } from "./storage.js";
import type { ProcessingJobRecord, ProcessingJobType } from "./types.js";
import type { QueueMessage } from "./types.js";

export type ProcessingJobRoute = "extract_text" | "ai_extract";
export type ExtractedDocumentFileText = {
  documentFileId: string;
  extracted: Awaited<ReturnType<typeof extractEmbeddedPdfText>>;
  chunks: ReturnType<typeof buildTextChunks>;
};

export async function processQueueMessage(
  config: WorkerConfig,
  db: DbClient,
  supabase: StorageClient,
  queueMessage: QueueMessage
): Promise<{ shouldRetry: boolean; retryDelaySeconds?: number }> {
  const { job_id: jobId, document_id: documentId } = queueMessage.message;

  try {
    const job = await getProcessingJob(db, jobId, documentId);
    const logContext = {
      job_id: job.id,
      document_id: documentId,
      organization_id: job.organization_id,
      job_type: job.job_type
    };

    if (job.organization_id !== queueMessage.message.organization_id) {
      throw new Error(`Queue message organization does not match job ${jobId}`);
    }

    if (job.status === "succeeded" || job.status === "cancelled") {
      return { shouldRetry: false };
    }

    switch (resolveProcessingJobRoute(job.job_type)) {
      case "extract_text":
        await processExtractTextJob(config, db, supabase, job);
        logInfo("document_job.extract_text_completed", logContext);
        return { shouldRetry: false };

      case "ai_extract":
        await processAiExtractJob(db, job);
        logInfo("document_job.ai_extract_completed", logContext);
        return { shouldRetry: false };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failure = await markJobFailed(db, jobId, documentId, errorMessage);
    logError("document_job.failed", error, {
      job_id: jobId,
      document_id: documentId,
      organization_id: queueMessage.message.organization_id,
      attempt_count: failure.attemptCount,
      max_attempts: failure.maxAttempts
    });

    if (failure.attemptCount >= failure.maxAttempts) {
      return { shouldRetry: false };
    }

    return {
      shouldRetry: true,
      retryDelaySeconds: calculateRetryDelaySeconds(config.retryBaseSeconds, failure.attemptCount)
    };
  }
}

export function calculateRetryDelaySeconds(retryBaseSeconds: number, attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  return retryBaseSeconds * 2 ** exponent;
}

export function resolveProcessingJobRoute(jobType: ProcessingJobType): ProcessingJobRoute {
  switch (jobType) {
    case "extract_text":
      return "extract_text";

    case "ai_extract":
      return "ai_extract";

    default:
      throw new Error(`Unsupported document job type: ${jobType}`);
  }
}

async function processExtractTextJob(
  config: WorkerConfig,
  db: DbClient,
  supabase: StorageClient,
  job: ProcessingJobRecord
): Promise<void> {
  const documentId = requiredDocumentId(job);

  const claimed = await markJobRunning(db, job.id, documentId, "extracting_text");

  if (!claimed) {
    logInfo("document_job.claim_skipped", {
      job_id: job.id,
      document_id: documentId,
      organization_id: job.organization_id,
      job_type: job.job_type
    });
    return;
  }

  const files = await getDocumentFiles(db, documentId);
  const pdfFiles = files.filter((file) => file.mime_type === "application/pdf");

  if (files.length === 0) {
    throw new Error(`Document ${documentId} has no available files`);
  }

  if (pdfFiles.length === 0) {
    const unsupportedTypes = [...new Set(files.map((file) => file.mime_type))].join(", ");
    throw new Error(`Document ${documentId} has no processable PDF files. Found: ${unsupportedTypes}`);
  }

  const extractedFiles: ExtractedDocumentFileText[] = [];

  for (const file of pdfFiles) {
    const buffer = await downloadStorageObject(
      supabase,
      file.storage_bucket,
      file.storage_path
    );

    const extracted = await extractEmbeddedPdfText(buffer);
    const chunks = buildTextChunks(extracted.pages, config.maxChunkChars);

    extractedFiles.push({
      documentFileId: file.id,
      extracted,
      chunks
    });
  }

  await saveExtractedText(db, config.queueName, job.id, documentId, extractedFiles);
}

async function processAiExtractJob(db: DbClient, job: ProcessingJobRecord): Promise<void> {
  const documentId = requiredDocumentId(job);

  const claimed = await markJobRunning(db, job.id, documentId, "ai_processing");

  if (!claimed) {
    logInfo("document_job.claim_skipped", {
      job_id: job.id,
      document_id: documentId,
      organization_id: job.organization_id,
      job_type: job.job_type
    });
    return;
  }

  await processReceivedInvoiceExtraction(db, loadOpenAiInvoiceConfig(), documentId, {
    markFailedDocument: false
  });
  await markJobSucceeded(db, job.id, documentId);
}

function requiredDocumentId(job: ProcessingJobRecord): string {
  if (!job.document_id) {
    throw new Error(`Processing job ${job.id} is not attached to a document`);
  }

  return job.document_id;
}
