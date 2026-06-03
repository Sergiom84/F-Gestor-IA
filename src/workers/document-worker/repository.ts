import type { DbClient } from "./db.js";
import type { DocumentFileRecord, ExtractedPdf, TextChunk } from "./types.js";

export async function markJobRunning(db: DbClient, jobId: string, documentId: string): Promise<void> {
  await db.begin(async (tx) => {
    await tx`
      update public.processing_jobs
      set status = 'running',
          started_at = coalesce(started_at, now()),
          attempt_count = attempt_count + 1,
          updated_at = now()
      where id = ${jobId}
        and document_id = ${documentId}
    `;

    await tx`
      update public.documents
      set status = 'extracting_text',
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
  jobId: string,
  documentId: string,
  documentFileId: string,
  extracted: ExtractedPdf,
  chunks: TextChunk[]
): Promise<void> {
  await db.begin(async (tx) => {
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

    await tx`
      update public.documents
      set status = ${chunks.length > 0 ? "text_extracted" : "ocr_required"},
          failure_reason = null,
          updated_at = now()
      where id = ${documentId}
    `;

    await tx`
      update public.processing_jobs
      set status = 'succeeded',
          finished_at = now(),
          updated_at = now()
      where id = ${jobId}
    `;
  });
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
