import type postgres from "postgres";
import type { DbClient } from "../db.js";
import type {
  ApprovedInvoiceDraft,
  InvoiceReviewOutcome,
  ReviewAction
} from "./review-schema.js";

export type ReviewTaskExtractionInput = {
  reviewTaskId: string;
  organizationId: string;
  documentId: string;
  extractionId: string | null;
  normalizedData: unknown;
};

export type PersistedInvoiceReview = {
  reviewTaskId: string | null;
  documentId: string;
  extractionId: string | null;
  invoiceId: string | null;
  action: ReviewAction;
  documentStatus: InvoiceReviewOutcome["documentStatus"];
  reviewTaskStatus: InvoiceReviewOutcome["reviewTaskStatus"];
};

type ReviewTaskExtractionRow = {
  review_task_id: string;
  organization_id: string;
  document_id: string;
  extraction_id: string | null;
  normalized_data: unknown;
};

type IdRow = {
  id: string;
};

export async function getReviewTaskExtractionInput(
  db: DbClient,
  reviewTaskId: string
): Promise<ReviewTaskExtractionInput> {
  const rows = await db<ReviewTaskExtractionRow[]>`
    select
      rt.id::text as review_task_id,
      rt.organization_id::text,
      rt.document_id::text,
      rt.extraction_id::text,
      de.normalized_data
    from public.review_tasks rt
    left join public.document_extractions de
      on de.id = rt.extraction_id
     and de.organization_id = rt.organization_id
    where rt.id = ${reviewTaskId}
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    throw new Error(`Review task ${reviewTaskId} was not found`);
  }

  if (row.extraction_id && row.normalized_data === null) {
    throw new Error(`Review task ${reviewTaskId} is missing normalized extraction data`);
  }

  return {
    reviewTaskId: row.review_task_id,
    organizationId: row.organization_id,
    documentId: row.document_id,
    extractionId: row.extraction_id,
    normalizedData: row.normalized_data
  };
}

export async function persistInvoiceReviewOutcome(
  db: DbClient,
  outcome: InvoiceReviewOutcome
): Promise<PersistedInvoiceReview> {
  const reviewTaskId = getNullableString(outcome.auditEvent.beforeSnapshot, "review_task_id");
  const extractionId = getNullableString(outcome.auditEvent.beforeSnapshot, "extraction_id");
  const documentId = outcome.auditEvent.resourceId;

  return db.begin(async (tx) => {
    let invoiceId: string | null = null;

    if (outcome.action === "approve") {
      if (outcome.validation.status !== "valid" || !outcome.invoiceDraft) {
        throw new Error(`Cannot approve invalid review: ${outcome.validation.errors.join("; ")}`);
      }

      invoiceId = await insertApprovedInvoice(tx, outcome.invoiceDraft);
    }

    if (extractionId) {
      await tx`
        update public.document_extractions
        set status = ${toExtractionStatus(outcome.action, outcome.validation.status)},
            needs_human_review = ${outcome.action !== "approve"},
            validation_errors = ${tx.json(toJsonValue(outcome.validation.errors))},
            updated_at = now()
        where id = ${extractionId}
          and organization_id = ${outcome.auditEvent.organizationId}
      `;
    }

    if (reviewTaskId) {
      await tx`
        update public.review_tasks
        set status = ${outcome.reviewTaskStatus},
            reviewed_by = ${outcome.reviewedBy},
            reviewed_at = ${outcome.reviewedAt},
            review_notes = ${outcome.reviewNotes},
            updated_at = now()
        where id = ${reviewTaskId}
          and organization_id = ${outcome.auditEvent.organizationId}
      `;
    }

    await tx`
      update public.documents
      set status = ${outcome.documentStatus},
          failure_reason = null,
          updated_at = now()
      where id = ${documentId}
        and organization_id = ${outcome.auditEvent.organizationId}
    `;

    await tx`
      insert into public.audit_logs (
        organization_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        before_snapshot,
        after_snapshot,
        created_at
      )
      values (
        ${outcome.auditEvent.organizationId},
        ${outcome.auditEvent.actorUserId},
        ${outcome.auditEvent.action},
        ${outcome.auditEvent.resourceType},
        ${outcome.auditEvent.resourceId},
        ${tx.json(toJsonValue(outcome.auditEvent.beforeSnapshot))},
        ${tx.json(toJsonValue({
          ...outcome.auditEvent.afterSnapshot,
          persisted_invoice_id: invoiceId
        }))},
        ${outcome.auditEvent.createdAt}
      )
    `;

    return {
      reviewTaskId,
      documentId,
      extractionId,
      invoiceId,
      action: outcome.action,
      documentStatus: outcome.documentStatus,
      reviewTaskStatus: outcome.reviewTaskStatus
    };
  });
}

async function insertApprovedInvoice(
  tx: postgres.TransactionSql,
  draft: ApprovedInvoiceDraft
): Promise<string> {
  if (draft.sourceExtractionId) {
    const existingRows = await tx<IdRow[]>`
      select id::text
      from public.invoices
      where source_extraction_id = ${draft.sourceExtractionId}
        and organization_id = ${draft.organizationId}
        and deleted_at is null
      limit 1
    `;

    if (existingRows[0]) {
      throw new Error(`Extraction ${draft.sourceExtractionId} is already linked to invoice ${existingRows[0].id}`);
    }
  }

  const invoiceRows = await tx<IdRow[]>`
    insert into public.invoices (
      organization_id,
      fiscal_entity_id,
      client_id,
      source_document_id,
      source_extraction_id,
      direction,
      supplier_tax_id,
      customer_tax_id,
      invoice_number,
      issue_date,
      due_date,
      currency,
      subtotal_amount,
      tax_amount,
      total_amount,
      status,
      human_approved_by,
      human_approved_at
    )
    values (
      ${draft.organizationId},
      ${draft.fiscalEntityId},
      ${draft.clientId},
      ${draft.sourceDocumentId},
      ${draft.sourceExtractionId},
      ${draft.direction},
      ${draft.supplierTaxId},
      ${draft.customerTaxId},
      ${draft.invoiceNumber},
      ${draft.issueDate},
      ${draft.dueDate},
      ${draft.currency},
      ${draft.subtotalAmount},
      ${draft.taxAmount},
      ${draft.totalAmount},
      ${draft.status},
      ${draft.humanApprovedBy},
      ${draft.humanApprovedAt}
    )
    returning id::text
  `;
  const invoice = invoiceRows[0];

  if (!invoice) {
    throw new Error("Invoice insert did not return an id");
  }

  for (const [index, line] of draft.lines.entries()) {
    await tx`
      insert into public.invoice_lines (
        organization_id,
        invoice_id,
        line_index,
        description,
        quantity,
        unit_price,
        tax_rate,
        line_total
      )
      values (
        ${draft.organizationId},
        ${invoice.id},
        ${index},
        ${line.description},
        ${line.quantity},
        ${line.unit_price},
        ${line.tax_rate_percent},
        ${line.line_total}
      )
    `;
  }

  for (const breakdown of draft.taxBreakdowns) {
    await tx`
      insert into public.tax_breakdowns (
        organization_id,
        invoice_id,
        tax_rate,
        taxable_base,
        tax_amount
      )
      values (
        ${draft.organizationId},
        ${invoice.id},
        ${breakdown.tax_rate_percent},
        ${breakdown.taxable_base},
        ${breakdown.tax_amount}
      )
    `;
  }

  return invoice.id;
}

function toExtractionStatus(
  action: ReviewAction,
  validationStatus: InvoiceReviewOutcome["validation"]["status"]
): "draft" | "valid" | "invalid" {
  if (action === "approve" && validationStatus === "valid") {
    return "valid";
  }

  if (action === "reject") {
    return "invalid";
  }

  return "draft";
}

function getNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function toJsonValue(value: unknown): postgres.JSONValue {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}
