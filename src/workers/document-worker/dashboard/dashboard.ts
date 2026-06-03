import {
  dashboardInputSchema,
  dashboardOptionsSchema,
  type DashboardAiCostEvent,
  type DashboardInput,
  type DashboardInvoice,
  type DashboardOptions,
  type DashboardSnapshot
} from "./dashboard-schema.js";

const DOCUMENT_PENDING_STATUSES = new Set([
  "uploaded",
  "queued",
  "extracting_text",
  "text_extracted",
  "ocr_required",
  "ocr_processing",
  "ai_processing",
  "ai_processed",
  "needs_review"
]);

export function buildDashboardSnapshot(
  inputValue: unknown,
  optionsValue: unknown = {}
): DashboardSnapshot {
  const input = dashboardInputSchema.parse(inputValue);
  const options = dashboardOptionsSchema.parse(optionsValue);
  const periodStart = options.period_start ?? null;
  const periodEnd = options.period_end ?? null;

  const documents = input.documents.filter((document) => document.organization_id === input.organization_id);
  const reviewTasks = input.review_tasks.filter((task) => task.organization_id === input.organization_id);
  const invoices = input.invoices
    .filter((invoice) => invoice.organization_id === input.organization_id)
    .filter((invoice) => isWithinPeriod(invoice.issue_date, periodStart, periodEnd));
  const aiCostEvents = input.ai_cost_events
    .filter((event) => event.organization_id === input.organization_id)
    .filter((event) => isWithinPeriod(event.created_at, periodStart, periodEnd));

  const snapshot: DashboardSnapshot = {
    organizationId: input.organization_id,
    generatedAt: input.generated_at ?? new Date().toISOString(),
    period: {
      start: periodStart,
      end: periodEnd,
      currency: options.currency
    },
    documents: summarizeDocuments(documents),
    review: summarizeReview(reviewTasks),
    invoices: summarizeInvoices(invoices, options.currency),
    aiCost: summarizeAiCosts(aiCostEvents),
    periods: summarizePeriods(invoices, aiCostEvents),
    alerts: []
  };

  snapshot.alerts = buildAlerts(snapshot);

  return snapshot;
}

function summarizeDocuments(documents: DashboardInput["documents"]): DashboardSnapshot["documents"] {
  const byStatus = countBy(documents, (document) => document.status);

  return {
    total: documents.length,
    pending: documents.filter((document) => DOCUMENT_PENDING_STATUSES.has(document.status)).length,
    failed: byStatus.failed ?? 0,
    needsReview: byStatus.needs_review ?? 0,
    approved: byStatus.approved ?? 0,
    rejected: byStatus.rejected ?? 0,
    ocrRequired: byStatus.ocr_required ?? 0,
    byStatus
  };
}

function summarizeReview(reviewTasks: DashboardInput["review_tasks"]): DashboardSnapshot["review"] {
  const byStatus = countBy(reviewTasks, (task) => task.status);

  return {
    open: byStatus.open ?? 0,
    inReview: byStatus.in_review ?? 0,
    changesRequested: byStatus.changes_requested ?? 0,
    highPriority: reviewTasks.filter((task) => (task.priority ?? 0) >= 10 && !isTerminalReviewStatus(task.status)).length,
    byStatus
  };
}

function summarizeInvoices(
  invoices: DashboardInvoice[],
  currency: string
): DashboardSnapshot["invoices"] {
  const approvedInvoices = invoices.filter((invoice) => isApprovedInvoice(invoice));
  const receivedInvoices = approvedInvoices.filter((invoice) => invoice.direction === "received" && invoice.currency === currency);
  const issuedInvoices = approvedInvoices.filter((invoice) => invoice.direction === "issued" && invoice.currency === currency);

  const inputVat = sumMoney(receivedInvoices, (invoice) => invoice.tax_amount);
  const outputVat = sumMoney(issuedInvoices, (invoice) => invoice.tax_amount);

  return {
    approvedCount: approvedInvoices.length,
    receivedCount: receivedInvoices.length,
    issuedCount: issuedInvoices.length,
    expenseTotal: sumMoney(receivedInvoices, (invoice) => invoice.total_amount),
    incomeTotal: sumMoney(issuedInvoices, (invoice) => invoice.total_amount),
    inputVat,
    outputVat,
    vatPosition: roundMoney(outputVat - inputVat),
    byStatus: countBy(invoices, (invoice) => invoice.status)
  };
}

function summarizeAiCosts(aiCostEvents: DashboardAiCostEvent[]): DashboardSnapshot["aiCost"] {
  return {
    estimatedCostCents: roundMoney(sumMoney(aiCostEvents, (event) => event.estimated_cost_cents)),
    inputTokens: aiCostEvents.reduce((sum, event) => sum + event.input_token_count, 0),
    outputTokens: aiCostEvents.reduce((sum, event) => sum + event.output_token_count, 0),
    byProvider: sumBy(aiCostEvents, (event) => event.provider_key, (event) => event.estimated_cost_cents)
  };
}

function summarizePeriods(
  invoices: DashboardInvoice[],
  aiCostEvents: DashboardAiCostEvent[]
): DashboardSnapshot["periods"] {
  const monthKeys = new Set<string>();

  for (const invoice of invoices) {
    const monthKey = toMonthKey(invoice.issue_date);

    if (monthKey) {
      monthKeys.add(monthKey);
    }
  }

  for (const event of aiCostEvents) {
    const monthKey = toMonthKey(event.created_at);

    if (monthKey) {
      monthKeys.add(monthKey);
    }
  }

  return [...monthKeys]
    .sort()
    .map((period) => {
      const periodInvoices = invoices.filter((invoice) => toMonthKey(invoice.issue_date) === period && isApprovedInvoice(invoice));
      const receivedInvoices = periodInvoices.filter((invoice) => invoice.direction === "received");
      const issuedInvoices = periodInvoices.filter((invoice) => invoice.direction === "issued");
      const periodAiCosts = aiCostEvents.filter((event) => toMonthKey(event.created_at) === period);

      return {
        period,
        receivedTotal: sumMoney(receivedInvoices, (invoice) => invoice.total_amount),
        issuedTotal: sumMoney(issuedInvoices, (invoice) => invoice.total_amount),
        inputVat: sumMoney(receivedInvoices, (invoice) => invoice.tax_amount),
        outputVat: sumMoney(issuedInvoices, (invoice) => invoice.tax_amount),
        aiCostCents: roundMoney(sumMoney(periodAiCosts, (event) => event.estimated_cost_cents))
      };
    });
}

function buildAlerts(snapshot: DashboardSnapshot): DashboardSnapshot["alerts"] {
  const alerts: DashboardSnapshot["alerts"] = [];

  if (snapshot.documents.failed > 0) {
    alerts.push({
      level: "critical",
      code: "documents_failed",
      message: `${snapshot.documents.failed} documentos han fallado y requieren intervencion.`
    });
  }

  if (snapshot.documents.needsReview > 0 || snapshot.review.open > 0) {
    alerts.push({
      level: "warning",
      code: "review_pending",
      message: `${Math.max(snapshot.documents.needsReview, snapshot.review.open)} documentos estan pendientes de revision.`
    });
  }

  if (snapshot.documents.ocrRequired > 0) {
    alerts.push({
      level: "info",
      code: "ocr_required",
      message: `${snapshot.documents.ocrRequired} documentos necesitan OCR.`
    });
  }

  if (snapshot.invoices.vatPosition > 0) {
    alerts.push({
      level: "info",
      code: "vat_payable",
      message: `IVA neto estimado a pagar: ${snapshot.invoices.vatPosition.toFixed(2)} ${snapshot.period.currency}.`
    });
  }

  if (snapshot.invoices.vatPosition < 0) {
    alerts.push({
      level: "info",
      code: "vat_credit",
      message: `IVA neto estimado a compensar: ${Math.abs(snapshot.invoices.vatPosition).toFixed(2)} ${snapshot.period.currency}.`
    });
  }

  return alerts;
}

function isApprovedInvoice(invoice: DashboardInvoice): boolean {
  return invoice.human_approved_at !== null || invoice.status === "booked";
}

function isTerminalReviewStatus(status: string): boolean {
  return status === "approved" || status === "rejected";
}

function isWithinPeriod(value: string | null, start: string | null, end: string | null): boolean {
  if (!value) {
    return true;
  }

  const day = value.slice(0, 10);

  if (start && day < start) {
    return false;
  }

  if (end && day > end) {
    return false;
  }

  return true;
}

function toMonthKey(value: string | null): string | null {
  if (!value || value.length < 7) {
    return null;
  }

  return value.slice(0, 7);
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function sumBy<T>(
  items: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number
): Record<string, number> {
  const sums: Record<string, number> = {};

  for (const item of items) {
    const key = getKey(item);
    sums[key] = roundMoney((sums[key] ?? 0) + getValue(item));
  }

  return sums;
}

function sumMoney<T>(items: T[], getValue: (item: T) => number | null): number {
  return roundMoney(items.reduce((sum, item) => sum + (getValue(item) ?? 0), 0));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
