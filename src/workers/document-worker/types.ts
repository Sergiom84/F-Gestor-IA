import { z } from "zod";

export const documentJobMessageSchema = z.object({
  job_id: z.string().uuid(),
  document_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  requested_by: z.string().uuid().optional(),
  reason: z.string().optional()
});

export type DocumentJobMessage = z.infer<typeof documentJobMessageSchema>;

export type QueueMessage = {
  msgId: number;
  readCount: number;
  message: DocumentJobMessage;
};

export type ProcessingJobType = "extract_text" | "ocr" | "ai_extract" | "classify" | "deduplicate" | "validate";

export type ProcessingJobStatus = "queued" | "running" | "succeeded" | "failed" | "retrying" | "cancelled";

export type DocumentStatus =
  | "uploaded"
  | "queued"
  | "extracting_text"
  | "text_extracted"
  | "ocr_required"
  | "ocr_processing"
  | "ai_processing"
  | "ai_processed"
  | "needs_review"
  | "approved"
  | "rejected"
  | "failed";

export type ProcessingJobRecord = {
  id: string;
  organization_id: string;
  document_id: string | null;
  job_type: ProcessingJobType;
  status: ProcessingJobStatus;
  attempt_count: number;
  max_attempts: number;
};

export type DocumentFileRecord = {
  id: string;
  organization_id: string;
  document_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number | string;
  sha256_hash: string | null;
  is_primary: boolean;
};

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
  textQuality: number;
};

export type ExtractedPdf = {
  pageCount: number;
  pages: ExtractedPdfPage[];
  fullText: string;
  sha256Hash: string;
};

export type TextChunk = {
  chunkIndex: number;
  text: string;
  tokenCountEstimate: number;
  pageNumbers: number[];
};
