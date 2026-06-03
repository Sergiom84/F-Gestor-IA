import { z } from "zod";

export const OCR_PLAN_VERSION = "ocr_plan_v1";

export const DEFAULT_OCR_PLAN_POLICY = {
  provider_key: "eu_ocr_provider_pending",
  provider_region: "eu",
  min_text_chars: 40,
  min_text_quality: 0.7,
  cost_per_page_cents: 0,
  budget_cents: 0,
  max_pages_per_run: 25,
  max_attempts: 3,
  retry_base_seconds: 60
} as const;

export const ocrPageInputSchema = z.object({
  page_number: z.number().int().positive(),
  text: z.string(),
  text_quality: z.number().min(0).max(1),
  image_available: z.boolean().default(true)
});

export const ocrPlanPolicySchema = z.object({
  provider_key: z.string().min(1).default("eu_ocr_provider_pending"),
  provider_region: z.enum(["eu", "unknown"]).default("eu"),
  min_text_chars: z.number().int().nonnegative().default(40),
  min_text_quality: z.number().min(0).max(1).default(0.7),
  cost_per_page_cents: z.number().nonnegative().default(0),
  budget_cents: z.number().nonnegative().default(0),
  max_pages_per_run: z.number().int().positive().default(25),
  max_attempts: z.number().int().positive().default(3),
  retry_base_seconds: z.number().int().positive().default(60)
});

export const ocrPlanInputSchema = z.object({
  organization_id: z.string(),
  document_id: z.string(),
  document_file_id: z.string().nullable(),
  sha256_hash: z.string().nullable(),
  page_count: z.number().int().nonnegative(),
  pages: z.array(ocrPageInputSchema),
  policy: ocrPlanPolicySchema.default(DEFAULT_OCR_PLAN_POLICY)
});

export const ocrPageResultSchema = z.object({
  page_number: z.number().int().positive(),
  status: z.enum(["succeeded", "failed"]),
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  provider_key: z.string(),
  attempt_count: z.number().int().positive(),
  error_message: z.string().nullable()
});

export type OcrPageInput = z.infer<typeof ocrPageInputSchema>;
export type OcrPlanPolicy = z.infer<typeof ocrPlanPolicySchema>;
export type OcrPlanInput = z.infer<typeof ocrPlanInputSchema>;
export type OcrPageResult = z.infer<typeof ocrPageResultSchema>;

export type OcrPageDecision = {
  pageNumber: number;
  action: "skip" | "ocr" | "blocked";
  reason: "has_embedded_text" | "empty_text" | "low_text_quality" | "image_missing" | "over_budget" | "over_run_limit";
  textChars: number;
  textQuality: number;
  estimatedCostCents: number;
};

export type OcrPlan = {
  planVersion: typeof OCR_PLAN_VERSION;
  organizationId: string;
  documentId: string;
  documentFileId: string | null;
  sha256Hash: string | null;
  provider: {
    key: string;
    region: "eu" | "unknown";
  };
  policy: OcrPlanPolicy;
  pageCount: number;
  pages: OcrPageDecision[];
  selectedPages: number[];
  blockedPages: number[];
  skippedPages: number[];
  estimatedCostCents: number;
  willExceedBudget: boolean;
  requiresOcr: boolean;
  nextDocumentStatus: "text_extracted" | "ocr_required";
};

export type OcrRetryDecision = {
  status: "retrying" | "failed";
  shouldRetry: boolean;
  nextAttemptCount: number;
  retryDelaySeconds: number | null;
  errorMessage: string;
};

export type OcrMergeResult = {
  succeededPages: number[];
  failedPages: number[];
  partialText: Array<{
    pageNumber: number;
    text: string;
    confidence: number | null;
    providerKey: string;
  }>;
};
