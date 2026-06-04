import { createHash, randomUUID } from "node:crypto";
import { loadConfig } from "../workers/document-worker/config.js";
import { createDb, type DbClient } from "../workers/document-worker/db.js";
import { archiveMessage } from "../workers/document-worker/queue.js";
import { processQueueMessage } from "../workers/document-worker/processor.js";
import { createStorageClient, type StorageClient } from "../workers/document-worker/storage.js";
import type { QueueMessage } from "../workers/document-worker/types.js";

type SmokeFixture = {
  runId: string;
  organizationId: string;
  clientId: string;
  fiscalEntityId: string;
  documentId: string;
  documentFileId: string;
  extractJobId: string;
  extractQueueMessageId: number | null;
  storageBucket: string;
  storagePath: string;
};

type SmokeSummary = {
  fixture: SmokeFixture;
  extract: {
    pages: number;
    chunks: number;
    documentStatus: string;
    extractJobStatus: string;
  };
  ai: {
    attempted: boolean;
    skippedReason: string | null;
    jobId: string | null;
    jobStatus: string | null;
    documentStatus: string | null;
    extractionId: string | null;
    reviewTaskId: string | null;
  };
  cleanup: {
    requested: boolean;
    removedStoragePaths: number;
    deletedOrganization: boolean;
  };
};

type CountRow = {
  count: number | string;
};

type StatusRow = {
  status: string;
};

type AiJobRow = {
  id: string;
  status: string;
  queue_message_id: number | string | null;
};

type ExtractionReviewRow = {
  extraction_id: string | null;
  review_task_id: string | null;
  document_status: string | null;
};

const shouldSkipAi = process.argv.includes("--skip-ai") || !process.env.OPENAI_API_KEY;
const shouldCleanup = process.argv.includes("--cleanup");

const config = loadConfig();
const db = createDb(config);
const supabase = createStorageClient(config);

try {
  const fixture = await createSmokeFixture(db, supabase, config.queueName);
  const extractMessage = toQueueMessage(fixture.extractQueueMessageId, {
    job_id: fixture.extractJobId,
    document_id: fixture.documentId,
    organization_id: fixture.organizationId,
    reason: "smoke_mvp_remote"
  });

  const extractResult = await processQueueMessage(config, db, supabase, extractMessage);

  if (extractResult.shouldRetry) {
    throw new Error(`extract_text requested retry after smoke run ${fixture.runId}`);
  }

  if (fixture.extractQueueMessageId !== null) {
    await archiveMessage(db, config.queueName, fixture.extractQueueMessageId);
  }

  const extract = await readExtractSummary(db, fixture);
  const ai = await processOrSkipAi(db, supabase, fixture);
  const cleanup = shouldCleanup
    ? await cleanupFixture(db, supabase, fixture)
    : {
      requested: false,
      removedStoragePaths: 0,
      deletedOrganization: false
    };

  const summary: SmokeSummary = {
    fixture,
    extract,
    ai,
    cleanup
  };

  console.info(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 5 });
}

async function createSmokeFixture(
  dbClient: DbClient,
  storageClient: StorageClient,
  queueName: string
): Promise<SmokeFixture> {
  const runId = `smoke-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const organizationId = randomUUID();
  const clientId = randomUUID();
  const fiscalEntityId = randomUUID();
  const documentId = randomUUID();
  const documentFileId = randomUUID();
  const extractJobId = randomUUID();
  const storageBucket = "document-files";
  const storagePath = [
    "organizations",
    organizationId,
    "fiscal-entities",
    fiscalEntityId,
    "documents",
    documentId,
    "files",
    `${documentFileId}-factura-smoke.pdf`
  ].join("/");
  const pdfBuffer = buildSmokeInvoicePdf(runId);

  const upload = await storageClient.storage
    .from(storageBucket)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false
    });

  if (upload.error) {
    throw new Error(`Smoke PDF upload failed: ${upload.error.message}`);
  }

  try {
    const queueRows = await dbClient.begin(async (tx) => {
      await tx`
        insert into public.organizations (
          id,
          name,
          slug,
          ai_monthly_budget_cents
        )
        values (
          ${organizationId},
          ${`GFiscal Smoke ${runId}`},
          ${runId},
          0
        )
      `;

      await tx`
        insert into public.clients (
          id,
          organization_id,
          name,
          type
        )
        values (
          ${clientId},
          ${organizationId},
          'Cliente Smoke',
          'company'
        )
      `;

      await tx`
        insert into public.fiscal_entities (
          id,
          organization_id,
          client_id,
          legal_name,
          tax_id,
          entity_type
        )
        values (
          ${fiscalEntityId},
          ${organizationId},
          ${clientId},
          'Cliente Smoke SL',
          'B00000000',
          'company'
        )
      `;

      await tx`
        insert into public.documents (
          id,
          organization_id,
          fiscal_entity_id,
          client_id,
          document_type,
          status,
          source,
          title
        )
        values (
          ${documentId},
          ${organizationId},
          ${fiscalEntityId},
          ${clientId},
          'invoice_received',
          'queued',
          'manual_upload',
          ${`Factura smoke ${runId}`}
        )
      `;

      await tx`
        insert into public.document_files (
          id,
          organization_id,
          document_id,
          storage_bucket,
          storage_path,
          original_filename,
          mime_type,
          size_bytes,
          sha256_hash,
          file_status,
          is_primary
        )
        values (
          ${documentFileId},
          ${organizationId},
          ${documentId},
          ${storageBucket},
          ${storagePath},
          'factura-smoke.pdf',
          'application/pdf',
          ${pdfBuffer.byteLength},
          ${createHash("sha256").update(pdfBuffer).digest("hex")},
          'uploaded',
          true
        )
      `;

      await tx`
        insert into public.processing_jobs (
          id,
          organization_id,
          document_id,
          job_type,
          status
        )
        values (
          ${extractJobId},
          ${organizationId},
          ${documentId},
          'extract_text',
          'queued'
        )
      `;

      return tx<{ send: number | string | null }[]>`
        select * from pgmq.send(
          ${queueName}::text,
          ${tx.json({
            job_id: extractJobId,
            document_id: documentId,
            organization_id: organizationId,
            reason: "smoke_mvp_remote"
          })}::jsonb,
          0::integer
        )
      `;
    });

    const extractQueueMessageId = queueRows[0]?.send === undefined || queueRows[0]?.send === null
      ? null
      : Number(queueRows[0].send);

    if (extractQueueMessageId !== null) {
      await dbClient`
        update public.processing_jobs
        set queue_message_id = ${extractQueueMessageId},
            updated_at = now()
        where id = ${extractJobId}
      `;
    }

    return {
      runId,
      organizationId,
      clientId,
      fiscalEntityId,
      documentId,
      documentFileId,
      extractJobId,
      extractQueueMessageId,
      storageBucket,
      storagePath
    };
  } catch (error) {
    await storageClient.storage.from(storageBucket).remove([storagePath]);
    throw error;
  }
}

async function readExtractSummary(
  dbClient: DbClient,
  fixture: SmokeFixture
): Promise<SmokeSummary["extract"]> {
  const pageRows = await dbClient<CountRow[]>`
    select count(*)::int as count
    from public.document_pages
    where document_id = ${fixture.documentId}
  `;
  const chunkRows = await dbClient<CountRow[]>`
    select count(*)::int as count
    from public.document_text_chunks
    where document_id = ${fixture.documentId}
  `;
  const documentRows = await dbClient<StatusRow[]>`
    select status
    from public.documents
    where id = ${fixture.documentId}
  `;
  const jobRows = await dbClient<StatusRow[]>`
    select status
    from public.processing_jobs
    where id = ${fixture.extractJobId}
  `;

  return {
    pages: Number(pageRows[0]?.count ?? 0),
    chunks: Number(chunkRows[0]?.count ?? 0),
    documentStatus: documentRows[0]?.status ?? "missing",
    extractJobStatus: jobRows[0]?.status ?? "missing"
  };
}

async function processOrSkipAi(
  dbClient: DbClient,
  storageClient: StorageClient,
  fixture: SmokeFixture
): Promise<SmokeSummary["ai"]> {
  const aiJob = await getLatestAiJob(dbClient, fixture.documentId);

  if (!aiJob) {
    return {
      attempted: false,
      skippedReason: "ai_extract job was not created",
      jobId: null,
      jobStatus: null,
      documentStatus: null,
      extractionId: null,
      reviewTaskId: null
    };
  }

  if (shouldSkipAi) {
    if (aiJob.queue_message_id !== null) {
      await archiveMessage(dbClient, config.queueName, Number(aiJob.queue_message_id));
    }

    await dbClient`
      update public.processing_jobs
      set status = 'cancelled',
          finished_at = now(),
          last_error = 'Smoke skipped ai_extract because OPENAI_API_KEY is not configured or --skip-ai was passed',
          updated_at = now()
      where id = ${aiJob.id}
    `;

    return {
      attempted: false,
      skippedReason: process.env.OPENAI_API_KEY ? "--skip-ai was passed" : "OPENAI_API_KEY is not configured",
      jobId: aiJob.id,
      jobStatus: "cancelled",
      documentStatus: await getDocumentStatus(dbClient, fixture.documentId),
      extractionId: null,
      reviewTaskId: null
    };
  }

  const aiMessage = toQueueMessage(
    aiJob.queue_message_id === null ? null : Number(aiJob.queue_message_id),
    {
      job_id: aiJob.id,
      document_id: fixture.documentId,
      organization_id: fixture.organizationId,
      reason: "smoke_mvp_remote"
    }
  );
  const result = await processQueueMessage(config, dbClient, storageClient, aiMessage);

  if (result.shouldRetry) {
    throw new Error(`ai_extract requested retry after smoke run ${fixture.runId}`);
  }

  if (aiJob.queue_message_id !== null) {
    await archiveMessage(dbClient, config.queueName, Number(aiJob.queue_message_id));
  }

  const extractionReview = await getExtractionReview(dbClient, fixture.documentId);
  const finalAiJob = await getLatestAiJob(dbClient, fixture.documentId);

  return {
    attempted: true,
    skippedReason: null,
    jobId: finalAiJob?.id ?? aiJob.id,
    jobStatus: finalAiJob?.status ?? null,
    documentStatus: extractionReview.document_status,
    extractionId: extractionReview.extraction_id,
    reviewTaskId: extractionReview.review_task_id
  };
}

async function getLatestAiJob(dbClient: DbClient, documentId: string): Promise<AiJobRow | null> {
  const rows = await dbClient<AiJobRow[]>`
    select
      id::text,
      status,
      queue_message_id
    from public.processing_jobs
    where document_id = ${documentId}
      and job_type = 'ai_extract'
    order by created_at desc
    limit 1
  `;

  return rows[0] ?? null;
}

async function getDocumentStatus(dbClient: DbClient, documentId: string): Promise<string | null> {
  const rows = await dbClient<StatusRow[]>`
    select status
    from public.documents
    where id = ${documentId}
    limit 1
  `;

  return rows[0]?.status ?? null;
}

async function getExtractionReview(
  dbClient: DbClient,
  documentId: string
): Promise<ExtractionReviewRow> {
  const rows = await dbClient<ExtractionReviewRow[]>`
    select
      d.current_extraction_id::text as extraction_id,
      rt.id::text as review_task_id,
      d.status as document_status
    from public.documents d
    left join public.review_tasks rt
      on rt.document_id = d.id
     and rt.status in ('open', 'in_review')
    where d.id = ${documentId}
    order by rt.created_at desc nulls last
    limit 1
  `;

  return rows[0] ?? {
    extraction_id: null,
    review_task_id: null,
    document_status: null
  };
}

async function cleanupFixture(
  dbClient: DbClient,
  storageClient: StorageClient,
  fixture: SmokeFixture
): Promise<SmokeSummary["cleanup"]> {
  const removeResult = await storageClient.storage
    .from(fixture.storageBucket)
    .remove([fixture.storagePath]);

  if (removeResult.error) {
    throw new Error(`Smoke cleanup storage remove failed: ${removeResult.error.message}`);
  }

  const deletedRows = await dbClient<{ id: string }[]>`
    delete from public.organizations
    where id = ${fixture.organizationId}
    returning id::text
  `;

  return {
    requested: true,
    removedStoragePaths: removeResult.data?.length ?? 0,
    deletedOrganization: deletedRows.length > 0
  };
}

function toQueueMessage(
  msgId: number | null,
  message: QueueMessage["message"]
): QueueMessage {
  return {
    msgId: msgId ?? 0,
    readCount: 1,
    message
  };
}

function buildSmokeInvoicePdf(runId: string): Buffer {
  const lines = [
    "FACTURA RECIBIDA",
    `Numero: ${runId.toUpperCase()}`,
    "Proveedor: Proveedor Smoke SL",
    "CIF proveedor: B12345678",
    "Cliente: Cliente Smoke SL",
    "CIF cliente: B00000000",
    "Fecha: 2026-06-04",
    "Base imponible: 100.00 EUR",
    "IVA 21%: 21.00 EUR",
    "Total factura: 121.00 EUR"
  ];
  const textCommands = lines
    .map((line, index) => {
      const y = 760 - index * 22;
      return `1 0 0 1 72 ${y} Tm (${escapePdfText(line)}) Tj`;
    })
    .join("\n");
  const content = [
    "BT",
    "/F1 12 Tf",
    textCommands,
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    ""
  ].join("\n");

  return Buffer.from(pdf, "ascii");
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
