import type { WorkerConfig } from "./config.js";
import type { DbClient } from "./db.js";
import { loadOpenAiInvoiceConfig } from "./ai/config.js";
import { processReceivedInvoiceExtraction } from "./ai/processor.js";
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
import type { ProcessingJobRecord } from "./types.js";
import type { QueueMessage } from "./types.js";

export async function processQueueMessage(
  config: WorkerConfig,
  db: DbClient,
  supabase: StorageClient,
  queueMessage: QueueMessage
): Promise<{ shouldRetry: boolean; retryDelaySeconds?: number }> {
  const { job_id: jobId, document_id: documentId } = queueMessage.message;

  try {
    const job = await getProcessingJob(db, jobId, documentId);

    if (job.organization_id !== queueMessage.message.organization_id) {
      throw new Error(`Queue message organization does not match job ${jobId}`);
    }

    if (job.status === "succeeded" || job.status === "cancelled") {
      return { shouldRetry: false };
    }

    switch (job.job_type) {
      case "extract_text":
        await processExtractTextJob(config, db, supabase, job);
        return { shouldRetry: false };

      case "ai_extract":
        await processAiExtractJob(db, job);
        return { shouldRetry: false };

      default:
        throw new Error(`Unsupported document job type: ${job.job_type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failure = await markJobFailed(db, jobId, documentId, errorMessage);

    if (failure.attemptCount >= failure.maxAttempts) {
      return { shouldRetry: false };
    }

    return {
      shouldRetry: true,
      retryDelaySeconds: config.retryBaseSeconds * failure.attemptCount
    };
  }
}

async function processExtractTextJob(
  config: WorkerConfig,
  db: DbClient,
  supabase: StorageClient,
  job: ProcessingJobRecord
): Promise<void> {
  const documentId = requiredDocumentId(job);

  await markJobRunning(db, job.id, documentId, "extracting_text");

  const files = await getDocumentFiles(db, documentId);
  const primaryFile = files[0];

  if (!primaryFile) {
    throw new Error(`Document ${documentId} has no available files`);
  }

  if (primaryFile.mime_type !== "application/pdf") {
    throw new Error(`Unsupported mime type: ${primaryFile.mime_type}`);
  }

  const buffer = await downloadStorageObject(
    supabase,
    primaryFile.storage_bucket,
    primaryFile.storage_path
  );

  const extracted = await extractEmbeddedPdfText(buffer);
  const chunks = buildTextChunks(extracted.pages, config.maxChunkChars);

  await saveExtractedText(db, config.queueName, job.id, documentId, primaryFile.id, extracted, chunks);
}

async function processAiExtractJob(db: DbClient, job: ProcessingJobRecord): Promise<void> {
  const documentId = requiredDocumentId(job);

  await markJobRunning(db, job.id, documentId, "ai_processing");

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
