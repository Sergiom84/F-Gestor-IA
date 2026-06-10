import { createClient } from "@/src/lib/supabase/server";

type DbJournalRow = {
  id: string;
  code: string;
  name: string;
};

type DbEntryRow = {
  id: string;
  journal_id: string;
  entry_number: number | null;
  entry_date: string | null;
  document_date: string | null;
  document_number: string | null;
  description: string | null;
  status: string;
  total_debit: number;
  total_credit: number;
  accounting_journals: { code: string; name: string } | null;
};

type DbFixedAssetRow = {
  id: string;
  code: string;
  description: string;
  acquisition_date: string | null;
  account_code: string | null;
  acquisition_value: number;
  accumulated_depreciation: number;
  status: string;
};

type DbClosingPeriodRow = {
  id: string;
  period: string;
  kind: string;
  status: string;
  closing_date: string | null;
};

type DbUnmatchedLineRow = {
  id: string;
  entry_id: string;
  account_code: string;
  third_party_name: string | null;
  description: string | null;
  debit: number;
  credit: number;
  accounting_entries: {
    entry_number: number | null;
    entry_date: string | null;
    document_number: string | null;
    accounting_journals: { code: string } | null;
  } | null;
};

function formatIsoDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export type JournalItem = {
  id: string;
  code: string;
  name: string;
};

export type EntryItem = {
  id: string;
  journalId: string;
  journalCode: string;
  journalName: string;
  entryNumber: number | null;
  entryDate: string;
  documentDate: string;
  documentNumber: string;
  description: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
};

export type FixedAssetItem = {
  id: string;
  code: string;
  description: string;
  acquisitionDate: string;
  accountCode: string;
  acquisitionValue: number;
  accumulatedDepreciation: number;
  status: string;
};

export type ClosingPeriodItem = {
  id: string;
  period: string;
  kind: string;
  status: string;
  closingDate: string;
};

export type UnmatchedLineItem = {
  id: string;
  entryId: string;
  accountCode: string;
  thirdPartyName: string;
  description: string;
  debit: number;
  credit: number;
  entryNumber: number | null;
  entryDate: string;
  documentNumber: string;
  journalCode: string;
};

export type AccountingData = {
  journals: JournalItem[];
  entries: EntryItem[];
  fixedAssets: FixedAssetItem[];
  closings: ClosingPeriodItem[];
  unmatchedLines: UnmatchedLineItem[];
};

export async function readAccountingData(organizationId: string): Promise<AccountingData> {
  const supabase = await createClient();

  let journalsResult = await supabase
    .from("accounting_journals")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("code", { ascending: true })
    .returns<DbJournalRow[]>();

  if ((journalsResult.data ?? []).length === 0) {
    await supabase.rpc("seed_default_journals", { target_organization_id: organizationId });
    journalsResult = await supabase
      .from("accounting_journals")
      .select("id, code, name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("code", { ascending: true })
      .returns<DbJournalRow[]>();
  }

  const [entriesResult, fixedAssetsResult, closingsResult, unmatchedLinesResult] = await Promise.all([
    supabase
      .from("accounting_entries")
      .select("id, journal_id, entry_number, entry_date, document_date, document_number, description, status, total_debit, total_credit, accounting_journals!journal_id(code, name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(100)
      .returns<DbEntryRow[]>(),
    supabase
      .from("accounting_fixed_assets")
      .select("id, code, description, acquisition_date, account_code, acquisition_value, accumulated_depreciation, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "written_off")
      .order("acquisition_date", { ascending: false })
      .limit(100)
      .returns<DbFixedAssetRow[]>(),
    supabase
      .from("accounting_closing_periods")
      .select("id, period, kind, status, closing_date")
      .eq("organization_id", organizationId)
      .order("period", { ascending: false })
      .limit(50)
      .returns<DbClosingPeriodRow[]>(),
    supabase
      .from("accounting_entry_lines")
      .select("id, entry_id, account_code, third_party_name, description, debit, credit, accounting_entries!entry_id(entry_number, entry_date, document_number, accounting_journals!journal_id(code))")
      .eq("organization_id", organizationId)
      .is("matching_mark", null)
      .limit(500)
      .returns<DbUnmatchedLineRow[]>()
  ]);

  return {
    journals: (journalsResult.data ?? []).map((j) => ({ id: j.id, code: j.code, name: j.name })),
    entries: (entriesResult.data ?? []).map((row) => ({
      id: row.id,
      journalId: row.journal_id,
      journalCode: row.accounting_journals?.code ?? "",
      journalName: row.accounting_journals?.name ?? "",
      entryNumber: row.entry_number,
      entryDate: formatIsoDate(row.entry_date),
      documentDate: formatIsoDate(row.document_date),
      documentNumber: row.document_number ?? "",
      description: row.description ?? "",
      status: row.status,
      totalDebit: Number(row.total_debit),
      totalCredit: Number(row.total_credit)
    })),
    fixedAssets: (fixedAssetsResult.data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      description: row.description,
      acquisitionDate: formatIsoDate(row.acquisition_date),
      accountCode: row.account_code ?? "",
      acquisitionValue: Number(row.acquisition_value),
      accumulatedDepreciation: Number(row.accumulated_depreciation),
      status: row.status
    })),
    closings: (closingsResult.data ?? []).map((row) => ({
      id: row.id,
      period: row.period,
      kind: row.kind,
      status: row.status,
      closingDate: formatIsoDate(row.closing_date)
    })),
    unmatchedLines: (unmatchedLinesResult.data ?? []).map((row) => ({
      id: row.id,
      entryId: row.entry_id,
      accountCode: row.account_code,
      thirdPartyName: row.third_party_name ?? "",
      description: row.description ?? "",
      debit: Number(row.debit),
      credit: Number(row.credit),
      entryNumber: row.accounting_entries?.entry_number ?? null,
      entryDate: formatIsoDate(row.accounting_entries?.entry_date ?? null),
      documentNumber: row.accounting_entries?.document_number ?? "",
      journalCode: row.accounting_entries?.accounting_journals?.code ?? ""
    }))
  };
}
