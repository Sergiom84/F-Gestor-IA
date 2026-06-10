"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/src/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

async function getAuthenticatedUser() {
  const supabase = await createSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
}

type EntryLineInput = {
  accountCode: string;
  accountDescription?: string;
  thirdPartyName?: string;
  description?: string;
  debit: number;
  credit: number;
};

export async function createAccountingEntry(
  formData: FormData
): Promise<{ error?: string; entry?: { id: string; number: number } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!isUuid(organizationId)) return { error: "Organización inválida." };

  const journalId = String(formData.get("journal_id") ?? "").trim();
  if (!isUuid(journalId)) return { error: "Selecciona un diario." };

  const entryDate = String(formData.get("entry_date") ?? "").trim();
  if (!entryDate) return { error: "La fecha del asiento es obligatoria." };

  const { supabase } = await getAuthenticatedUser();

  const documentDate = String(formData.get("document_date") ?? "").trim() || null;
  const documentNumber = String(formData.get("document_number") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  const linesRaw = String(formData.get("lines_json") ?? "[]");
  let lines: EntryLineInput[] = [];
  try {
    const parsed = JSON.parse(linesRaw) as unknown;
    if (Array.isArray(parsed)) {
      lines = parsed.filter((l): l is EntryLineInput => typeof l === "object" && l !== null && typeof (l as EntryLineInput).accountCode === "string");
    }
  } catch {
    return { error: "Las líneas del asiento son inválidas." };
  }

  if (lines.length < 2) return { error: "Un asiento necesita al menos dos líneas." };

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `El asiento no cuadra: Debe=${totalDebit.toFixed(2)} Haber=${totalCredit.toFixed(2)}.` };
  }

  const numberResult = await supabase.rpc("next_entry_number", { target_journal_id: journalId });
  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error?.message ?? "No se pudo asignar número de asiento." };
  }

  const entryNumber = Number(numberResult.data);

  const { data: entry, error: insertError } = await supabase
    .from("accounting_entries")
    .insert({
      organization_id: organizationId,
      journal_id: journalId,
      entry_number: entryNumber,
      entry_date: entryDate,
      document_date: documentDate,
      document_number: documentNumber,
      description,
      status: "draft",
      total_debit: Math.round(totalDebit * 100) / 100,
      total_credit: Math.round(totalCredit * 100) / 100
    })
    .select("id, entry_number")
    .single();

  if (insertError || !entry) return { error: insertError?.message ?? "No se pudo crear el asiento." };

  const lineRows = lines.map((line, index) => ({
    organization_id: organizationId,
    entry_id: entry.id,
    line_index: index,
    account_code: line.accountCode.trim() || "—",
    account_description: line.accountDescription?.trim() || null,
    third_party_name: line.thirdPartyName?.trim() || null,
    description: line.description?.trim() || null,
    debit: Math.round((Number(line.debit) || 0) * 100) / 100,
    credit: Math.round((Number(line.credit) || 0) * 100) / 100
  }));

  const { error: linesError } = await supabase.from("accounting_entry_lines").insert(lineRows);
  if (linesError) {
    await supabase.from("accounting_entries").update({ deleted_at: new Date().toISOString() }).eq("id", entry.id);
    return { error: linesError.message };
  }

  revalidatePath("/dashboard");
  return { entry: { id: entry.id as string, number: entryNumber } };
}

export async function postAccountingEntry(entryId: string): Promise<{ error?: string }> {
  if (!isUuid(entryId)) return { error: "Asiento inválido." };
  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("accounting_entries")
    .update({ status: "posted" })
    .eq("id", entryId)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function deleteAccountingEntry(entryId: string): Promise<{ error?: string }> {
  if (!isUuid(entryId)) return { error: "Asiento inválido." };
  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("accounting_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", entryId)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function getAccountingEntryLines(entryId: string): Promise<{
  error?: string;
  lines?: Array<{
    id: string;
    lineIndex: number;
    accountCode: string;
    thirdPartyName: string;
    description: string;
    debit: number;
    credit: number;
    matchingMark: string | null;
  }>;
}> {
  if (!isUuid(entryId)) return { error: "Asiento inválido." };
  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from("accounting_entry_lines")
    .select("id, line_index, account_code, third_party_name, description, debit, credit, matching_mark")
    .eq("entry_id", entryId)
    .order("line_index", { ascending: true });
  if (error) return { error: error.message };
  return {
    lines: (data ?? []).map((row) => ({
      id: String(row.id),
      lineIndex: Number(row.line_index),
      accountCode: String(row.account_code ?? ""),
      thirdPartyName: String(row.third_party_name ?? ""),
      description: String(row.description ?? ""),
      debit: Number(row.debit),
      credit: Number(row.credit),
      matchingMark: row.matching_mark ? String(row.matching_mark) : null
    }))
  };
}

export async function createFixedAsset(
  formData: FormData
): Promise<{ error?: string; asset?: { id: string } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!isUuid(organizationId)) return { error: "Organización inválida." };

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "El código es obligatorio." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "La descripción es obligatoria." };

  const { supabase, user } = await getAuthenticatedUser();

  const acquisitionValueRaw = Number(String(formData.get("acquisition_value") ?? "0").replace(",", "."));
  const acquisitionValue = Number.isFinite(acquisitionValueRaw) ? acquisitionValueRaw : 0;

  const { data, error } = await supabase
    .from("accounting_fixed_assets")
    .insert({
      organization_id: organizationId,
      code,
      description,
      acquisition_date: String(formData.get("acquisition_date") ?? "").trim() || null,
      account_code: String(formData.get("account_code") ?? "").trim() || null,
      acquisition_value: acquisitionValue,
      accumulated_depreciation: 0,
      status: "active",
      created_by: user.id
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "No se pudo crear el activo." };
  revalidatePath("/dashboard");
  return { asset: { id: data.id as string } };
}

export async function writeOffFixedAsset(assetId: string): Promise<{ error?: string }> {
  if (!isUuid(assetId)) return { error: "Activo inválido." };
  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("accounting_fixed_assets")
    .update({ status: "written_off" })
    .eq("id", assetId)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function markAccountingLines(lineIds: string[], mark: string): Promise<{ error?: string }> {
  if (lineIds.length === 0) return { error: "Selecciona al menos una línea." };
  const validIds = lineIds.filter(isUuid);
  if (validIds.length === 0) return { error: "IDs de línea inválidos." };
  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("accounting_entry_lines")
    .update({ matching_mark: mark })
    .in("id", validIds);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function createClosingPeriod(
  formData: FormData
): Promise<{ error?: string; period?: { id: string } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!isUuid(organizationId)) return { error: "Organización inválida." };

  const period = String(formData.get("period") ?? "").trim();
  if (!period) return { error: "El período es obligatorio." };

  const kind = String(formData.get("kind") ?? "monthly").trim();
  const closingKind = ["monthly", "annual"].includes(kind) ? kind : "monthly";

  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from("accounting_closing_periods")
    .insert({ organization_id: organizationId, period, kind: closingKind, status: "open" })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "No se pudo crear el período de cierre." };
  revalidatePath("/dashboard");
  return { period: { id: data.id as string } };
}

export async function closeClosingPeriod(periodId: string): Promise<{ error?: string }> {
  if (!isUuid(periodId)) return { error: "Período inválido." };
  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("accounting_closing_periods")
    .update({ status: "closed", closing_date: new Date().toISOString().slice(0, 10) })
    .eq("id", periodId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function lockClosingPeriod(periodId: string): Promise<{ error?: string }> {
  if (!isUuid(periodId)) return { error: "Período inválido." };
  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("accounting_closing_periods")
    .update({ status: "locked" })
    .eq("id", periodId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}
