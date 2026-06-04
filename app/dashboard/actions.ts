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

  const { data: documentRow, error: documentError } = await supabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      fiscal_entity_id: fiscalEntity.id,
      client_id: fiscalEntity.client_id,
      document_type: "invoice_received",
      status: "uploaded",
      source: "manual_upload",
      title: uploads[0]?.name || `Factura ${new Date().toISOString().slice(0, 10)}`,
      uploaded_by: user.id
    })
    .select("id")
    .single()
    .returns<DocumentInsertRow>();

  if (documentError || !documentRow) {
    redirect(`/dashboard?org=${organizationId}&error=document_create`);
  }

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

  try {
    await withDb(async (db) => {
      await persistDashboardReview(db, formData, action, {
        reviewTaskId,
        organizationId: task.organization_id,
        documentId: task.document_id,
        extractionId: task.extraction_id,
        fiscalEntityId: documentRow.fiscal_entity_id,
        clientId: documentRow.client_id,
        reviewedBy: user.id,
        reviewedAt: new Date().toISOString()
      });
    });
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160));
    redirect(`/dashboard/review/${reviewTaskId}?error=${message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/review/${reviewTaskId}`);
  redirect(`/dashboard/review/${reviewTaskId}?result=${action}`);
}

async function persistDashboardReview(
  db: DbClient,
  formData: FormData,
  action: ReviewAction,
  context: {
    reviewTaskId: string;
    organizationId: string;
    documentId: string;
    extractionId: string | null;
    fiscalEntityId: string;
    clientId: string;
    reviewedBy: string;
    reviewedAt: string;
  }
): Promise<void> {
  const reviewNotes = stringValue(formData, "review_notes");
  const reviewTaskStatus = toReviewTaskStatus(action);
  const documentStatus = toDocumentStatus(action);
  const auditAction = toAuditAction(action);

  await db.begin(async (tx) => {
    let invoiceId: string | null = null;
    const beforeSnapshot = {
      review_task_id: context.reviewTaskId,
      extraction_id: context.extractionId,
      document_id: context.documentId,
      action
    };

    if (action === "approve") {
      const draft = buildApprovedInvoiceDraft(formData, context);

      if (draft.sourceExtractionId) {
        const existingRows = await tx<{ id: string }[]>`
          select id::text
          from public.invoices
          where source_extraction_id = ${draft.sourceExtractionId}
            and organization_id = ${draft.organizationId}
            and deleted_at is null
          limit 1
        `;

        if (existingRows[0]) {
          throw new Error(`La extraccion ya esta vinculada a la factura ${existingRows[0].id}`);
        }
      }

      const invoiceRows = await tx<{ id: string }[]>`
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
          'received',
          ${draft.supplierTaxId},
          ${draft.customerTaxId},
          ${draft.invoiceNumber},
          ${draft.issueDate},
          ${draft.dueDate},
          ${draft.currency},
          ${draft.subtotalAmount},
          ${draft.taxAmount},
          ${draft.totalAmount},
          'draft',
          ${draft.humanApprovedBy},
          ${draft.humanApprovedAt}
        )
        returning id::text
      `;
      invoiceId = invoiceRows[0]?.id ?? null;

      if (!invoiceId) {
        throw new Error("No se pudo crear la factura aprobada");
      }

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
          ${invoiceId},
          0,
          ${draft.lineDescription},
          1,
          ${draft.subtotalAmount},
          ${draft.taxRatePercent},
          ${draft.subtotalAmount}
        )
      `;

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
          ${invoiceId},
          ${draft.taxRatePercent},
          ${draft.subtotalAmount},
          ${draft.taxAmount}
        )
      `;
    }

    if (context.extractionId) {
      await tx`
        update public.document_extractions
        set status = ${toExtractionStatus(action)},
            needs_human_review = ${action !== "approve"},
            validation_errors = ${tx.json([])},
            updated_at = now()
        where id = ${context.extractionId}
          and organization_id = ${context.organizationId}
      `;
    }

    await tx`
      update public.review_tasks
      set status = ${reviewTaskStatus},
          reviewed_by = ${context.reviewedBy},
          reviewed_at = ${context.reviewedAt},
          review_notes = ${reviewNotes},
          updated_at = now()
      where id = ${context.reviewTaskId}
        and organization_id = ${context.organizationId}
    `;

    await tx`
      update public.documents
      set status = ${documentStatus},
          failure_reason = null,
          updated_at = now()
      where id = ${context.documentId}
        and organization_id = ${context.organizationId}
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
        ${context.organizationId},
        ${context.reviewedBy},
        ${auditAction},
        'document',
        ${context.documentId},
        ${tx.json(beforeSnapshot)},
        ${tx.json({
          review_task_status: reviewTaskStatus,
          document_status: documentStatus,
          persisted_invoice_id: invoiceId
        })},
        ${context.reviewedAt}
      )
    `;
  });
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

function buildApprovedInvoiceDraft(
  formData: FormData,
  context: {
    organizationId: string;
    documentId: string;
    extractionId: string | null;
    fiscalEntityId: string;
    clientId: string;
    reviewedBy: string;
    reviewedAt: string;
  }
): {
  organizationId: string;
  fiscalEntityId: string;
  clientId: string;
  sourceDocumentId: string;
  sourceExtractionId: string | null;
  supplierTaxId: string | null;
  customerTaxId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxRatePercent: number;
  lineDescription: string;
  humanApprovedBy: string;
  humanApprovedAt: string;
} {
  const subtotalAmount = nullableNumber(formData, "subtotal_amount");
  const taxAmount = nullableNumber(formData, "tax_amount");
  const totalAmount = nullableNumber(formData, "total_amount");
  const taxRate = nullableNumber(formData, "tax_rate_percent") ?? 21;
  const lineDescription = stringValue(formData, "line_description") || "Factura recibida";
  const invoiceNumber = nullableString(formData, "invoice_number");
  const issueDate = nullableString(formData, "issue_date");
  const currency = nullableString(formData, "currency") ?? "EUR";

  if (!invoiceNumber) {
    throw new Error("El numero de factura es obligatorio para aprobar");
  }

  if (!issueDate) {
    throw new Error("La fecha de emision es obligatoria para aprobar");
  }

  if (subtotalAmount === null || taxAmount === null || totalAmount === null) {
    throw new Error("Base, IVA y total son obligatorios para aprobar");
  }

  const expectedTotal = roundMoney(subtotalAmount + taxAmount);

  if (expectedTotal !== roundMoney(totalAmount)) {
    throw new Error(`Los importes no cuadran: base + IVA = ${expectedTotal}, total = ${roundMoney(totalAmount)}`);
  }

  return {
    organizationId: context.organizationId,
    fiscalEntityId: context.fiscalEntityId,
    clientId: context.clientId,
    sourceDocumentId: context.documentId,
    sourceExtractionId: context.extractionId,
    supplierTaxId: nullableString(formData, "supplier_tax_id"),
    customerTaxId: nullableString(formData, "customer_tax_id"),
    invoiceNumber,
    issueDate,
    dueDate: nullableString(formData, "due_date"),
    currency,
    subtotalAmount,
    taxAmount,
    totalAmount,
    taxRatePercent: taxRate,
    lineDescription,
    humanApprovedBy: context.reviewedBy,
    humanApprovedAt: context.reviewedAt
  };
}

function toReviewTaskStatus(action: ReviewAction): "approved" | "rejected" | "changes_requested" {
  if (action === "approve") {
    return "approved";
  }

  if (action === "reject") {
    return "rejected";
  }

  return "changes_requested";
}

function toDocumentStatus(action: ReviewAction): "approved" | "rejected" | "needs_review" {
  if (action === "approve") {
    return "approved";
  }

  if (action === "reject") {
    return "rejected";
  }

  return "needs_review";
}

function toExtractionStatus(action: ReviewAction): "draft" | "valid" | "invalid" {
  if (action === "approve") {
    return "valid";
  }

  if (action === "reject") {
    return "invalid";
  }

  return "draft";
}

function toAuditAction(action: ReviewAction): string {
  if (action === "approve") {
    return "document.review_approved";
  }

  if (action === "reject") {
    return "document.review_rejected";
  }

  return "document.review_changes_requested";
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
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
