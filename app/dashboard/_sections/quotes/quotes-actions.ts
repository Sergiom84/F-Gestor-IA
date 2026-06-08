"use server";

import { createClient } from "@/src/lib/supabase/server";

export type QuoteDocumentRow = {
  id: string;
  document_type: string;
  quote_number: string | null;
  client_name: string | null;
  date: string | null;
  due_date: string | null;
  total_amount: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type QuotesInitialData = {
  organizationId: string;
  documents: QuoteDocumentRow[];
  config: Record<string, unknown> | null;
};

export async function loadQuotesInitialData(organizationId: string): Promise<QuotesInitialData> {
  const supabase = await createClient();

  const [docsResult, configResult] = await Promise.all([
    supabase
      .from("quotes_documents")
      .select("id, document_type, quote_number, client_name, date, due_date, total_amount, payload, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("quotes_config")
      .select("payload")
      .eq("organization_id", organizationId)
      .maybeSingle()
  ]);

  return {
    organizationId,
    documents: (docsResult.data ?? []) as QuoteDocumentRow[],
    config: configResult.data?.payload ?? null
  };
}

export async function upsertQuoteDocument(
  organizationId: string,
  doc: {
    id: string;
    document_type: string;
    quote_number: string | null;
    client_name: string | null;
    date: string | null;
    due_date: string | null;
    total_amount: number;
    payload: Record<string, unknown>;
  }
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes_documents")
    .upsert({
      id: doc.id,
      organization_id: organizationId,
      document_type: doc.document_type,
      quote_number: doc.quote_number,
      client_name: doc.client_name,
      date: doc.date,
      due_date: doc.due_date,
      total_amount: doc.total_amount,
      payload: doc.payload
    }, { onConflict: "id" });

  return { error: error?.message ?? null };
}

export async function deleteQuoteDocument(
  organizationId: string,
  documentId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes_documents")
    .delete()
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  return { error: error?.message ?? null };
}

export async function upsertQuotesConfig(
  organizationId: string,
  config: Record<string, unknown>
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes_config")
    .upsert(
      { organization_id: organizationId, payload: config },
      { onConflict: "organization_id" }
    );

  return { error: error?.message ?? null };
}

export async function bulkUpsertQuoteDocuments(
  organizationId: string,
  docs: Array<{
    id: string;
    document_type: string;
    quote_number: string | null;
    client_name: string | null;
    date: string | null;
    due_date: string | null;
    total_amount: number;
    payload: Record<string, unknown>;
  }>
): Promise<{ error: string | null }> {
  if (docs.length === 0) return { error: null };
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes_documents")
    .upsert(
      docs.map((doc) => ({
        id: doc.id,
        organization_id: organizationId,
        document_type: doc.document_type,
        quote_number: doc.quote_number,
        client_name: doc.client_name,
        date: doc.date,
        due_date: doc.due_date,
        total_amount: doc.total_amount,
        payload: doc.payload
      })),
      { onConflict: "id" }
    );

  return { error: error?.message ?? null };
}
