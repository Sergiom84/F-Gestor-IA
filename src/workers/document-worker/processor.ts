import type { WorkerConfig } from "./config.js";
import type { DbClient } from "./db.js";
import { buildTextChunks, extractEmbeddedPdfText } from "./pdf.js";
import {
  getDocumentFiles,
  markJobFailed,
  markJobRunning,
  saveExtractedText
} from "./repository.js";
import { downloadStorageObject, type StorageClient } from "./storage.js";
import type { QueueMessage } from "./types.js";

export async function processQueueMessage(
  config: WorkerConfig,
  db: DbClient,
  supabase: StorageClient,
  queueMessage: QueueMessage
): Promise<{ shouldRetry: boolean; retryDelaySeconds?: number }> {
  const { job_id: jobId, document_id: documentId } = queueMessage.message;

  try {
    await markJobRunning(db, jobId, documentId);

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

    await saveExtractedText(db, jobId, documentId, primaryFile.id, extracted, chunks);

    return { shouldRetry: false };
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
