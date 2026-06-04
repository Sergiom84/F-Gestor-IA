import type postgres from "postgres";
import type { DbClient } from "./db.js";
import type {
  DocumentFileRecord,
  DocumentStatus,
  ExtractedPdf,
  ProcessingJobRecord,
  ProcessingJobType,
  TextChunk
} from "./types.js";

export type ExtractedTextSaveResult = {
  nextJob: {
    id: string;
    organizationId: string;
    documentId: string;
    jobType: "ai_extract";
    queueMessageId: number | null;
  } | null;
  duplicateFileDocumentIds: string[];
};

type ProcessingJobRow = {
  id: string;
  organization_id: string;
  document_id: string | null;
  job_type: ProcessingJobType;
  status: ProcessingJobRecord["status"];
  attempt_count: number;
  max_attempts: number;
};

type DuplicateFileRow = {
  document_id: string;
};

type AiJobRow = {
  id: string;
  organization_id: string;
  inserted: boolean;
};

type QueueSendRow = {
  send: number | string | null;
};

export async function getProcessingJob(
  db: DbClient,
  jobId: string,
  documentId: string
): Promise<ProcessingJobRecord> {
  const rows = await db<ProcessingJobRow[]>`
    select
      id,
      organization_id,
      document_id,
      job_type,
      status,
      attempt_count,
      max_attempts
    from public.processing_jobs
    where id = ${jobId}
      and document_id = ${documentId}
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    throw new Error(`Processing job ${jobId} for document ${documentId} was not found`);
  }

  return {
    id: row.id,
    organization_id: row.organization_id,
    document_id: row.document_id,
    job_type: row.job_type,
    status: row.status,
    attempt_count: Number(row.attempt_count),
    max_attempts: Number(row.max_attempts)
  };
}

export async function markJobRunning(
  db: DbClient,
  jobId: string,
  documentId: string,
  documentStatus: DocumentStatus
): Promise<void> {
  await db.begin(async (tx) => {
    const updatedJobs = await tx<{ id: string }[]>`
      update public.processing_jobs
      set status = 'running',
          started_at = coalesce(started_at, now()),
          finished_at = null,
          attempt_count = attempt_count + 1,
          updated_at = now()
      where id = ${jobId}
        and document_id = ${documentId}
        and status in ('queued', 'retrying', 'running')
      returning id
    `;

    if (updatedJobs.length === 0) {
      throw new Error(`Processing job ${jobId} is not queued/retryable`);
    }

    await tx`
      update public.documents
      set status = ${documentStatus},
          failure_reason = null,
          updated_at = now()
      where id = ${documentId}
    `;
  });
}

export async function getDocumentFiles(db: DbClient, documentId: string): Promise<DocumentFileRecord[]> {
  return db<DocumentFileRecord[]>`
    select
      id,
      organization_id,
      document_id,
      storage_bucket,
      storage_path,
      original_filename,
      mime_type,
      size_bytes,
      sha256_hash,
      is_primary
    from public.document_files
    where document_id = ${documentId}
      and deleted_at is null
      and file_status in ('uploaded', 'available')
    order by is_primary desc, created_at asc
  `;
}

export async function saveExtractedText(
  db: DbClient,
  queueName: string,
  jobId: string,
  documentId: string,
  documentFileId: string,
  extracted: ExtractedPdf,
  chunks: TextChunk[]
): Promise<ExtractedTextSaveResult> {
  return db.begin(async (tx) => {
    let nextJob: ExtractedTextSaveResult["nextJob"] = null;
    const duplicateFileDocumentIds: string[] = [];

    await tx`delete from public.document_text_chunks where document_id = ${documentId}`;
    await tx`delete from public.document_pages where document_id = ${documentId}`;

    for (const page of extracted.pages) {
      await tx`
        insert into public.document_pages (
          organization_id,
          document_id,
          document_file_id,
          page_number,
          text,
          text_quality,
          extraction_method,
          metadata
        )
        select
          df.organization_id,
          df.document_id,
          df.id,
          ${page.pageNumber},
          ${page.text},
          ${page.textQuality},
          'embedded_text',
          ${tx.json({ source: "document-worker" })}
        from public.document_files df
        where df.id = ${documentFileId}
          and df.document_id = ${documentId}
          and df.deleted_at is null
        limit 1
      `;
    }

    for (const chunk of chunks) {
      await tx`
        insert into public.document_text_chunks (
          organization_id,
          document_id,
          chunk_index,
          text,
          token_count,
          metadata
        )
        select
          d.organization_id,
          d.id,
          ${chunk.chunkIndex},
          ${chunk.text},
          ${chunk.tokenCountEstimate},
          ${tx.json({ page_numbers: chunk.pageNumbers, source: "document-worker" })}
        from public.documents d
        where d.id = ${documentId}
      `;
    }

    await tx`
      update public.document_files
      set file_status = 'available',
          page_count = ${extracted.pageCount},
          sha256_hash = coalesce(sha256_hash, ${extracted.sha256Hash}),
          updated_at = now()
      where id = ${documentFileId}
        and document_id = ${documentId}
        and deleted_at is null
    `;

    const duplicateRows = await tx<DuplicateFileRow[]>`
      select distinct other.document_id
      from public.document_files current_file
      join public.document_files other
        on other.organization_id = current_file.organization_id
       and other.sha256_hash = ${extracted.sha256Hash}
       and other.document_id <> current_file.document_id
       and other.deleted_at is null
       and other.file_status in ('uploaded', 'available')
      where current_file.id = ${documentFileId}
        and current_file.document_id = ${documentId}
        and current_file.deleted_at is null
      limit 10
    `;
    duplicateFileDocumentIds.push(...duplicateRows.map((row) => row.document_id));

    const nextDocumentStatus: DocumentStatus = duplicateFileDocumentIds.length > 0
      ? "needs_review"
      : chunks.length > 0
        ? "text_extracted"
        : "ocr_required";

    await tx`
      update public.documents
      set status = ${nextDocumentStatus},
          failure_reason = null,
          updated_at = now()
      where id = ${documentId}
    `;

    if (duplicateFileDocumentIds.length > 0) {
      await tx`
        insert into public.review_tasks (
          organization_id,
          document_id,
          status,
          priority,
          reason
        )
        select
          d.organization_id,
          d.id,
          'open',
          20,
          'duplicate_file_candidate'
        from public.documents d
        where d.id = ${documentId}
          and not exists (
            select 1
            from public.review_tasks rt
            where rt.document_id = d.id
              and rt.status in ('open', 'in_review')
              and rt.reason = 'duplicate_file_candidate'
          )
      `;
    }

    if (chunks.length > 0 && duplicateFileDocumentIds.length === 0) {
      nextJob = await enqueueAiExtractionJob(tx, queueName, documentId);
    }

    await tx`
      update public.processing_jobs
      set status = 'succeeded',
          finished_at = now(),
          updated_at = now()
      where id = ${jobId}
    `;

    return {
      nextJob,
      duplicateFileDocumentIds
    };
  });
}

export async function markJobSucceeded(db: DbClient, jobId: string, documentId: string): Promise<void> {
  await db`
    update public.processing_jobs
    set status = 'succeeded',
        finished_at = now(),
        updated_at = now()
    where id = ${jobId}
      and document_id = ${documentId}
  `;
}

export async function markJobFailed(
  db: DbClient,
  jobId: string,
  documentId: string,
  errorMessage: string
): Promise<{ attemptCount: number; maxAttempts: number }> {
  const rows = await db<{ attempt_count: number; max_attempts: number }[]>`
    update public.processing_jobs
    set status = case when attempt_count >= max_attempts then 'failed' else 'retrying' end,
        last_error = ${errorMessage},
        finished_at = case when attempt_count >= max_attempts then now() else finished_at end,
        updated_at = now()
    where id = ${jobId}
      and document_id = ${documentId}
    returning attempt_count, max_attempts
  `;

  const result = rows[0];

  await db`
    update public.documents
    set status = case when ${result?.attempt_count ?? 1} >= ${result?.max_attempts ?? 1} then 'failed' else status end,
        failure_reason = ${errorMessage},
        updated_at = now()
    where id = ${documentId}
  `;

  return {
    attemptCount: result?.attempt_count ?? 1,
    maxAttempts: result?.max_attempts ?? 1
  };
}

async function enqueueAiExtractionJob(
  tx: postgres.TransactionSql,
  queueName: string,
  documentId: string
): Promise<ExtractedTextSaveResult["nextJob"]> {
  const jobRows = await tx<AiJobRow[]>`
    with existing as (
      select id, organization_id
      from public.processing_jobs
      where document_id = ${documentId}
        and job_type = 'ai_extract'
        and status in ('queued', 'running', 'retrying', 'succeeded')
      order by created_at desc
      limit 1
    ),
    inserted as (
      insert into public.processing_jobs (
        organization_id,
        document_id,
        job_type,
        status
      )
      select
        d.organization_id,
        d.id,
        'ai_extract',
        'queued'
      from public.documents d
      where d.id = ${documentId}
        and not exists (select 1 from existing)
      returning id, organization_id
    )
    select id, organization_id, true as inserted
    from inserted
    union all
    select id, organization_id, false as inserted
    from existing
    limit 1
  `;
  const job = jobRows[0];

  if (!job || !job.inserted) {
    return null;
  }

  const message = {
    job_id: job.id,
    document_id: documentId,
    organization_id: job.organization_id,
    reason: "text_extracted"
  };

  const sendRows = await tx<QueueSendRow[]>`
    select * from pgmq.send(${queueName}::text, ${tx.json(message)}::jsonb, 0::integer)
  `;
  const queueMessageId = sendRows[0]?.send === undefined || sendRows[0]?.send === null
    ? null
    : Number(sendRows[0].send);

  await tx`
    update public.processing_jobs
    set queue_message_id = ${queueMessageId},
        updated_at = now()
    where id = ${job.id}
  `;

  return {
    id: job.id,
    organizationId: job.organization_id,
    documentId,
    jobType: "ai_extract",
    queueMessageId
  };
}
