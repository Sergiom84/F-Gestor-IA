"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import {
  assertDocumentStoragePath,
  buildDocumentStoragePath,
  sanitizeStorageFilename
} from "@/src/lib/documents/storage-path";
import { createDb, type DbClient } from "@/src/workers/document-worker/db";
import { loadDatabaseUrl } from "@/src/workers/document-worker/ai/config";
import { applyInvoiceReview } from "@/src/workers/document-worker/review/invoice-review";
import { persistInvoiceReviewOutcome } from "@/src/workers/document-worker/review/repository";
import type { InvoiceReviewCommand } from "@/src/workers/document-worker/review/review-schema";

type ReviewAction = "approve" | "reject" | "changes_requested";

type FiscalEntityRow = {
  id: string;
  organization_id: string;
  client_id: string;
  legal_name: string;
};

type DocumentInsertRow = {
  id: string;
};

type ReviewTaskAccessRow = {
  id: string;
  organization_id: string;
  document_id: string;
  extraction_id: string | null;
  status: string;
};

type ReviewDocumentRow = {
  id: string;
  fiscal_entity_id: string;
  client_id: string;
};

type ReviewExtractionRow = {
  id: string;
  normalized_data: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_BUCKET = "document-files";

export async function uploadDocument(formData: FormData) {
  const organizationId = requiredUuid(formData, "organization_id");
  const fiscalEntityId = requiredUuid(formData, "fiscal_entity_id");
  const uploads = getUploadedFiles(formData);

  if (uploads.length === 0) {
    redirect(`/dashboard?org=${organizationId}&error=missing_file`);
  }

  if (uploads.some((upload) => (upload.type || "application/pdf") !== "application/pdf")) {
    redirect(`/dashboard?org=${organizationId}&error=unsupported_file`);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: fiscalEntity, error: fiscalEntityError } = await supabase
    .from("fiscal_entities")
    .select("id, organization_id, client_id, legal_name")
    .eq("id", fiscalEntityId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle()
    .returns<FiscalEntityRow>();

  if (fiscalEntityError || !fiscalEntity) {
    redirect(`/dashboard?org=${organizationId}&error=upload_scope`);
  }

  // Sin RETURNING: la politica SELECT (can_access_document) no ve la fila
  // recien insertada dentro del mismo statement y el insert fallaria con RLS.
  const documentId = randomUUID();
  const { error: documentError } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      organization_id: organizationId,
      fiscal_entity_id: fiscalEntity.id,
      client_id: fiscalEntity.client_id,
      document_type: "invoice_received",
      status: "uploaded",
      source: "manual_upload",
      title: uploads[0]?.name || `Factura ${new Date().toISOString().slice(0, 10)}`,
      uploaded_by: user.id
    });

  if (documentError) {
    console.error("uploadDocument: documents insert failed", documentError);
    redirect(`/dashboard?org=${organizationId}&error=document_create`);
  }

  const documentRow: DocumentInsertRow = { id: documentId };

  const uploadedStoragePaths: string[] = [];

  for (const [index, upload] of uploads.entries()) {
    const documentFileId = randomUUID();
    const mimeType = upload.type || "application/pdf";
    const storagePath = buildDocumentStoragePath({
      organizationId,
      fiscalEntityId: fiscalEntity.id,
      documentId: documentRow.id,
      documentFileId,
      filename: upload.name
    });
    assertDocumentStoragePath(storagePath, {
      organizationId,
      fiscalEntityId: fiscalEntity.id,
      documentId: documentRow.id,
      documentFileId
    });

    const fileBuffer = Buffer.from(await upload.arrayBuffer());
    const storageUpload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      });

    if (storageUpload.error) {
      await cleanupUploadedStoragePaths(supabase, uploadedStoragePaths);
      await markDocumentFailed(documentRow.id, storageUpload.error.message);
      redirect(`/dashboard?org=${organizationId}&error=storage_upload`);
    }

    uploadedStoragePaths.push(storagePath);

    const { error: fileError } = await supabase
      .from("document_files")
      .insert({
        id: documentFileId,
        organization_id: organizationId,
        document_id: documentRow.id,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        original_filename: sanitizeStorageFilename(upload.name),
        mime_type: mimeType,
        size_bytes: upload.size,
        sha256_hash: createHash("sha256").update(fileBuffer).digest("hex"),
        file_status: "uploaded",
        is_primary: index === 0
      });

    if (fileError) {
      await cleanupUploadedStoragePaths(supabase, uploadedStoragePaths);
      await markDocumentFailed(documentRow.id, fileError.message);
      redirect(`/dashboard?org=${organizationId}&error=file_register`);
    }
  }

  await enqueueExtractTextJob({
    organizationId,
    documentId: documentRow.id,
    requestedBy: user.id
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard?org=${organizationId}&uploaded=${documentRow.id}`);
}

export async function reviewInvoiceTask(formData: FormData) {
  const reviewTaskId = requiredUuid(formData, "review_task_id");
  const action = parseReviewAction(String(formData.get("action") ?? ""));
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: task, error: taskError } = await supabase
    .from("review_tasks")
    .select("id, organization_id, document_id, extraction_id, status")
    .eq("id", reviewTaskId)
    .maybeSingle()
    .returns<ReviewTaskAccessRow>();

  if (taskError || !task) {
    redirect("/dashboard?error=review_not_found");
  }

  if (task.status !== "open" && task.status !== "in_review") {
    redirect(`/dashboard/review/${reviewTaskId}?error=review_closed`);
  }

  const { data: documentRow, error: documentError } = await supabase
    .from("documents")
    .select("id, fiscal_entity_id, client_id")
    .eq("id", task.document_id)
    .single()
    .returns<ReviewDocumentRow>();

  if (documentError || !documentRow) {
    redirect(`/dashboard/review/${reviewTaskId}?error=document_not_found`);
  }

  if (!task.extraction_id) {
    redirect(`/dashboard/review/${reviewTaskId}?error=missing_extraction`);
  }

  const extractionId = task.extraction_id;

  const { data: extraction, error: extractionError } = await supabase
    .from("document_extractions")
    .select("id, normalized_data")
    .eq("id", extractionId)
    .single()
    .returns<ReviewExtractionRow>();

  if (extractionError || !extraction) {
    redirect(`/dashboard/review/${reviewTaskId}?error=missing_extraction`);
  }

  try {
    await withDb(async (db) => {
      const reviewedAt = new Date().toISOString();
      const command = buildInvoiceReviewCommand(formData, action, {
        reviewTaskId,
        organizationId: task.organization_id,
        documentId: task.document_id,
        extractionId,
        fiscalEntityId: documentRow.fiscal_entity_id,
        clientId: documentRow.client_id,
        reviewedBy: user.id
      });
      const outcome = applyInvoiceReview({ normalized_data: extraction.normalized_data }, command, reviewedAt);

      await persistInvoiceReviewOutcome(db, outcome);
    });
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160));
    redirect(`/dashboard/review/${reviewTaskId}?error=${message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/review/${reviewTaskId}`);
  redirect(`/dashboard/review/${reviewTaskId}?result=${action}`);
}

function buildInvoiceReviewCommand(
  formData: FormData,
  action: ReviewAction,
  context: {
    reviewTaskId: string;
    organizationId: string;
    documentId: string;
    extractionId: string;
    fiscalEntityId: string;
    clientId: string;
    reviewedBy: string;
  }
): InvoiceReviewCommand {
  const subtotalAmount = nullableNumber(formData, "subtotal_amount");
  const taxAmount = nullableNumber(formData, "tax_amount");
  const totalAmount = nullableNumber(formData, "total_amount");
  const taxRatePercent = nullableNumber(formData, "tax_rate_percent");
  const lineDescription = nullableString(formData, "line_description");
  const lineItems = lineDescription || subtotalAmount !== null
    ? [{
        description: lineDescription,
        quantity: 1,
        unit_price: subtotalAmount ?? 0,
        tax_rate_percent: taxRatePercent,
        line_total: subtotalAmount ?? 0
      }]
    : [];
  const taxBreakdowns = taxRatePercent !== null && subtotalAmount !== null && taxAmount !== null
    ? [{
        tax_rate_percent: taxRatePercent,
        taxable_base: subtotalAmount,
        tax_amount: taxAmount
      }]
    : [];

  return {
    action,
    organization_id: context.organizationId,
    document_id: context.documentId,
    extraction_id: context.extractionId,
    review_task_id: context.reviewTaskId,
    fiscal_entity_id: context.fiscalEntityId,
    client_id: context.clientId,
    reviewed_by: context.reviewedBy,
    review_notes: stringValue(formData, "review_notes"),
    corrections: {
      supplier_tax_id: nullableString(formData, "supplier_tax_id"),
      customer_tax_id: nullableString(formData, "customer_tax_id"),
      invoice_number: nullableString(formData, "invoice_number"),
      issue_date: nullableString(formData, "issue_date"),
      due_date: nullableString(formData, "due_date"),
      currency: nullableString(formData, "currency"),
      subtotal_amount: subtotalAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount
    },
    line_items: lineItems,
    tax_breakdowns: taxBreakdowns
  };
}

async function enqueueExtractTextJob(args: {
  organizationId: string;
  documentId: string;
  requestedBy: string;
}): Promise<void> {
  await withDb(async (db) => {
    await db.begin(async (tx) => {
      const jobRows = await tx<{ id: string }[]>`
        insert into public.processing_jobs (
          organization_id,
          document_id,
          job_type,
          status
        )
        values (
          ${args.organizationId},
          ${args.documentId},
          'extract_text',
          'queued'
        )
        returning id::text
      `;
      const jobId = jobRows[0]?.id;

      if (!jobId) {
        throw new Error("Could not create extract_text processing job");
      }

      const queueName = process.env.DOCUMENT_WORKER_QUEUE_NAME ?? "document_processing";
      const message = {
        job_id: jobId,
        document_id: args.documentId,
        organization_id: args.organizationId,
        requested_by: args.requestedBy,
        reason: "dashboard_upload"
      };
      const queueRows = await tx<{ send: number | string | null }[]>`
        select * from pgmq.send(${queueName}::text, ${tx.json(message)}::jsonb, 0::integer)
      `;
      const queueMessageId = queueRows[0]?.send === undefined || queueRows[0]?.send === null
        ? null
        : Number(queueRows[0].send);

      await tx`
        update public.processing_jobs
        set queue_message_id = ${queueMessageId},
            updated_at = now()
        where id = ${jobId}
      `;

      await tx`
        update public.documents
        set status = 'queued',
            updated_at = now()
        where id = ${args.documentId}
          and organization_id = ${args.organizationId}
      `;
    });
  });
}

async function markDocumentFailed(documentId: string, errorMessage: string): Promise<void> {
  await withDb(async (db) => {
    await db`
      update public.documents
      set status = 'failed',
          failure_reason = ${errorMessage},
          updated_at = now()
      where id = ${documentId}
    `;
  });
}

async function cleanupUploadedStoragePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePaths: string[]
): Promise<void> {
  if (storagePaths.length === 0) {
    return;
  }

  await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
}

async function withDb<T>(callback: (db: DbClient) => Promise<T>): Promise<T> {
  const db = createDb({
    databaseUrl: loadDatabaseUrl()
  });

  try {
    return await callback(db);
  } finally {
    await db.end({ timeout: 5 });
  }
}

function getUploadedFiles(formData: FormData): File[] {
  const multiFiles = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);

  if (multiFiles.length > 0) {
    return multiFiles;
  }

  const singleFile = formData.get("file");
  return singleFile instanceof File && singleFile.size > 0 ? [singleFile] : [];
}

function parseReviewAction(value: string): ReviewAction {
  if (value === "approve" || value === "reject" || value === "changes_requested") {
    return value;
  }

  throw new Error(`Unsupported review action: ${value}`);
}

function requiredUuid(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();

  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${key} must be a valid UUID`);
  }

  return value;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function nullableNumber(formData: FormData, key: string): number | null {
  const value = String(formData.get(key) ?? "").trim().replace(",", ".");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be numeric`);
  }

  return parsed;
}
