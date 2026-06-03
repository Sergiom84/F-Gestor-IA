import type postgres from "postgres";
import type { DbClient } from "../db.js";
import type { OpenAiInvoiceExtractionResult } from "./openai-provider.js";
import type { ReceivedInvoiceValidation } from "./invoice-schema.js";

export type DocumentAiInput = {
  documentId: string;
  organizationId: string;
  documentType: string;
  status: string;
  text: string;
  chunkCount: number;
};

export type SavedInvoiceExtraction = {
  aiRequestId: string;
  aiResponseId: string;
  extractionId: string;
  reviewTaskId: string;
};

type DocumentAiInputRow = {
  document_id: string;
  organization_id: string;
  document_type: string;
  status: string;
  text: string | null;
  chunk_count: number | string;
};

type IdRow = {
  id: string;
};

export async function getDocumentAiInput(db: DbClient, documentId: string): Promise<DocumentAiInput | null> {
  const rows = await db<DocumentAiInputRow[]>`
    select
      d.id as document_id,
      d.organization_id,
      d.document_type,
      d.status,
      coalesce(
        string_agg('[chunk ' || c.chunk_index::text || ']' || E'\n' || c.text, E'\n\n' order by c.chunk_index),
        ''
      ) as text,
      count(c.id) as chunk_count
    from public.documents d
    left join public.document_text_chunks c
      on c.document_id = d.id
    where d.id = ${documentId}
    group by d.id, d.organization_id, d.document_type, d.status
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    documentId: row.document_id,
    organizationId: row.organization_id,
    documentType: row.document_type,
    status: row.status,
    text: row.text ?? "",
    chunkCount: Number(row.chunk_count)
  };
}

export async function markDocumentAiProcessing(db: DbClient, documentId: string): Promise<void> {
  await db`
    update public.documents
    set status = 'ai_processing',
        failure_reason = null,
        updated_at = now()
    where id = ${documentId}
  `;
}

export async function markDocumentAiFailed(
  db: DbClient,
  documentId: string,
  errorMessage: string
): Promise<void> {
  await db`
    update public.documents
    set status = 'failed',
        failure_reason = ${errorMessage},
        updated_at = now()
    where id = ${documentId}
  `;
}

export async function saveReceivedInvoiceExtraction(
  db: DbClient,
  documentInput: DocumentAiInput,
  result: OpenAiInvoiceExtractionResult,
  validation: ReceivedInvoiceValidation
): Promise<SavedInvoiceExtraction> {
  return db.begin(async (tx) => {
    const rawResponseJson = toJsonValue(result.rawResponse);

    const aiRequest = await insertAndReturnId(tx<IdRow[]>`
      insert into public.ai_requests (
        organization_id,
        document_id,
        task_type,
        provider_key,
        model_key,
        prompt_version,
        schema_version,
        input_token_count,
        output_token_count,
        estimated_cost_cents,
        latency_ms,
        status
      )
      values (
        ${documentInput.organizationId},
        ${documentInput.documentId},
        'invoice_received_extraction',
        ${result.providerKey},
        ${result.modelKey},
        ${result.promptVersion},
        ${result.schemaVersion},
        ${result.usage.inputTokens},
        ${result.usage.outputTokens},
        ${result.estimatedCostCents},
        ${result.latencyMs},
        'success'
      )
      returning id
    `);

    const aiResponse = await insertAndReturnId(tx<IdRow[]>`
      insert into public.ai_responses (
        organization_id,
        ai_request_id,
        raw_response,
        validation_errors
      )
      values (
        ${documentInput.organizationId},
        ${aiRequest.id},
        ${tx.json(rawResponseJson)},
        ${tx.json([...validation.errors, ...validation.warnings])}
      )
      returning id
    `);

    const extraction = await insertAndReturnId(tx<IdRow[]>`
      insert into public.document_extractions (
        organization_id,
        document_id,
        ai_request_id,
        ai_response_id,
        provider_key,
        model_key,
        prompt_version,
        schema_version,
        normalized_data,
        confidence_overall,
        status,
        validation_errors,
        needs_human_review
      )
      values (
        ${documentInput.organizationId},
        ${documentInput.documentId},
        ${aiRequest.id},
        ${aiResponse.id},
        ${result.providerKey},
        ${result.modelKey},
        ${result.promptVersion},
        ${result.schemaVersion},
        ${tx.json(result.extraction)},
        ${result.extraction.confidence.overall},
        ${validation.status},
        ${tx.json([...validation.errors, ...validation.warnings])},
        true
      )
      returning id
    `);

    await tx`
      update public.ai_responses
      set normalized_result_ref = ${extraction.id}
      where id = ${aiResponse.id}
    `;

    if (result.estimatedCostCents !== null) {
      await tx`
        insert into public.ai_cost_events (
          organization_id,
          ai_request_id,
          provider_key,
          model_key,
          estimated_cost_cents,
          input_token_count,
          output_token_count
        )
        values (
          ${documentInput.organizationId},
          ${aiRequest.id},
          ${result.providerKey},
          ${result.modelKey},
          ${result.estimatedCostCents},
          ${result.usage.inputTokens},
          ${result.usage.outputTokens}
        )
      `;
    }

    await tx`
      update public.documents
      set current_extraction_id = ${extraction.id},
          status = 'needs_review',
          failure_reason = null,
          updated_at = now()
      where id = ${documentInput.documentId}
    `;

    const reviewTask = await insertAndReturnId(tx<IdRow[]>`
      insert into public.review_tasks (
        organization_id,
        document_id,
        extraction_id,
        status,
        priority,
        reason
      )
      values (
        ${documentInput.organizationId},
        ${documentInput.documentId},
        ${extraction.id},
        'open',
        ${validation.status === "invalid" ? 10 : 0},
        ${validation.status === "invalid" ? "ai_invoice_extraction_needs_attention" : "ai_invoice_extraction"}
      )
      returning id
    `);

    return {
      aiRequestId: aiRequest.id,
      aiResponseId: aiResponse.id,
      extractionId: extraction.id,
      reviewTaskId: reviewTask.id
    };
  });
}

async function insertAndReturnId(rowsPromise: Promise<IdRow[]>): Promise<IdRow> {
  const rows = await rowsPromise;
  const row = rows[0];

  if (!row) {
    throw new Error("Insert did not return an id");
  }

  return row;
}

function toJsonValue(value: unknown): postgres.JSONValue {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}
