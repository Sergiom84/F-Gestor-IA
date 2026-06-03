import {
  OCR_PLAN_VERSION,
  ocrPageResultSchema,
  ocrPlanInputSchema,
  type OcrMergeResult,
  type OcrPageDecision,
  type OcrPageInput,
  type OcrPageResult,
  type OcrPlan,
  type OcrPlanInput,
  type OcrPlanPolicy,
  type OcrRetryDecision
} from "./ocr-schema.js";

export function buildOcrPlan(inputValue: unknown): OcrPlan {
  const input = ocrPlanInputSchema.parse(inputValue);
  const rawDecisions = input.pages
    .slice()
    .sort((a, b) => a.page_number - b.page_number)
    .map((page) => classifyPageForOcr(page, input.policy));

  const decisions = applyPlanLimits(rawDecisions, input.policy);
  const selectedPages = decisions.filter((decision) => decision.action === "ocr").map((decision) => decision.pageNumber);
  const blockedPages = decisions.filter((decision) => decision.action === "blocked").map((decision) => decision.pageNumber);
  const skippedPages = decisions.filter((decision) => decision.action === "skip").map((decision) => decision.pageNumber);
  const estimatedCostCents = roundCost(
    decisions
      .filter((decision) => decision.action === "ocr")
      .reduce((sum, decision) => sum + decision.estimatedCostCents, 0)
  );

  return {
    planVersion: OCR_PLAN_VERSION,
    organizationId: input.organization_id,
    documentId: input.document_id,
    documentFileId: input.document_file_id,
    sha256Hash: input.sha256_hash,
    provider: {
      key: input.policy.provider_key,
      region: input.policy.provider_region
    },
    policy: input.policy,
    pageCount: input.page_count,
    pages: decisions,
    selectedPages,
    blockedPages,
    skippedPages,
    estimatedCostCents,
    willExceedBudget: decisions.some((decision) => decision.reason === "over_budget"),
    requiresOcr: selectedPages.length > 0 || blockedPages.length > 0,
    nextDocumentStatus: selectedPages.length > 0 || blockedPages.length > 0 ? "ocr_required" : "text_extracted"
  };
}

export function buildOcrRetryDecision(
  attemptCount: number,
  policyValue: OcrPlanPolicy,
  errorMessage: string
): OcrRetryDecision {
  const nextAttemptCount = attemptCount + 1;

  if (nextAttemptCount >= policyValue.max_attempts) {
    return {
      status: "failed",
      shouldRetry: false,
      nextAttemptCount,
      retryDelaySeconds: null,
      errorMessage
    };
  }

  return {
    status: "retrying",
    shouldRetry: true,
    nextAttemptCount,
    retryDelaySeconds: policyValue.retry_base_seconds * nextAttemptCount,
    errorMessage
  };
}

export function mergeOcrPageResults(resultsValue: unknown[]): OcrMergeResult {
  const results = resultsValue.map((result) => ocrPageResultSchema.parse(result));
  const succeededResults = results.filter((result) => result.status === "succeeded");
  const failedResults = results.filter((result) => result.status === "failed");

  return {
    succeededPages: succeededResults.map((result) => result.page_number).sort(sortNumbers),
    failedPages: failedResults.map((result) => result.page_number).sort(sortNumbers),
    partialText: succeededResults
      .sort((a, b) => a.page_number - b.page_number)
      .map((result) => ({
        pageNumber: result.page_number,
        text: result.text,
        confidence: result.confidence,
        providerKey: result.provider_key
      }))
  };
}

export function createOcrPlanInputFromExtractedPdf(args: {
  organizationId: string;
  documentId: string;
  documentFileId: string | null;
  sha256Hash: string | null;
  pageCount: number;
  pages: Array<{ pageNumber: number; text: string; textQuality: number }>;
  policy?: Partial<OcrPlanPolicy>;
}): OcrPlanInput {
  const policy = {
    provider_key: args.policy?.provider_key ?? "eu_ocr_provider_pending",
    provider_region: args.policy?.provider_region ?? "eu",
    min_text_chars: args.policy?.min_text_chars ?? 40,
    min_text_quality: args.policy?.min_text_quality ?? 0.7,
    cost_per_page_cents: args.policy?.cost_per_page_cents ?? 0,
    budget_cents: args.policy?.budget_cents ?? 0,
    max_pages_per_run: args.policy?.max_pages_per_run ?? 25,
    max_attempts: args.policy?.max_attempts ?? 3,
    retry_base_seconds: args.policy?.retry_base_seconds ?? 60
  } satisfies OcrPlanPolicy;

  return {
    organization_id: args.organizationId,
    document_id: args.documentId,
    document_file_id: args.documentFileId,
    sha256_hash: args.sha256Hash,
    page_count: args.pageCount,
    pages: args.pages.map((page) => ({
      page_number: page.pageNumber,
      text: page.text,
      text_quality: page.textQuality,
      image_available: true
    })),
    policy
  };
}

function classifyPageForOcr(page: OcrPageInput, policy: OcrPlanPolicy): OcrPageDecision {
  const textChars = page.text.trim().length;

  if (!page.image_available) {
    return buildDecision(page, "blocked", "image_missing", textChars, policy);
  }

  if (textChars === 0 || textChars < policy.min_text_chars) {
    return buildDecision(page, "ocr", "empty_text", textChars, policy);
  }

  if (page.text_quality < policy.min_text_quality) {
    return buildDecision(page, "ocr", "low_text_quality", textChars, policy);
  }

  return buildDecision(page, "skip", "has_embedded_text", textChars, policy);
}

function applyPlanLimits(decisions: OcrPageDecision[], policy: OcrPlanPolicy): OcrPageDecision[] {
  let selectedCount = 0;
  let selectedCost = 0;

  return decisions.map((decision) => {
    if (decision.action !== "ocr") {
      return decision;
    }

    if (selectedCount >= policy.max_pages_per_run) {
      return {
        ...decision,
        action: "blocked",
        reason: "over_run_limit"
      };
    }

    const nextCost = roundCost(selectedCost + decision.estimatedCostCents);

    if (policy.budget_cents > 0 && nextCost > policy.budget_cents) {
      return {
        ...decision,
        action: "blocked",
        reason: "over_budget"
      };
    }

    selectedCount += 1;
    selectedCost = nextCost;
    return decision;
  });
}

function buildDecision(
  page: OcrPageInput,
  action: OcrPageDecision["action"],
  reason: OcrPageDecision["reason"],
  textChars: number,
  policy: OcrPlanPolicy
): OcrPageDecision {
  return {
    pageNumber: page.page_number,
    action,
    reason,
    textChars,
    textQuality: page.text_quality,
    estimatedCostCents: action === "ocr" ? policy.cost_per_page_cents : 0
  };
}

function roundCost(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function sortNumbers(a: number, b: number): number {
  return a - b;
}
