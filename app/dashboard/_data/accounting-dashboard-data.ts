import { createClient } from "@/src/lib/supabase/server";

export type AccountingDashboardData = {
  sales: number;
  purchases: number;
  staffCosts: number;
  grossProfit: number;
  operatingResult: number;
  financialResult: number;
  exceptionalResult: number;
  profitBeforeTax: number;
  treasury: number;
  assets: number;
  netWorth: number;
  workingCapital: number;
};

const ZERO: AccountingDashboardData = {
  sales: 0,
  purchases: 0,
  staffCosts: 0,
  grossProfit: 0,
  operatingResult: 0,
  financialResult: 0,
  exceptionalResult: 0,
  profitBeforeTax: 0,
  treasury: 0,
  assets: 0,
  netWorth: 0,
  workingCapital: 0
};

type EntryLineRow = {
  account_code: string;
  debit: number;
  credit: number;
  accounting_entries: { status: string; deleted_at: string | null; entry_date: string } | null;
};

export async function readAccountingDashboardData(
  organizationId: string
): Promise<AccountingDashboardData> {
  try {
    const supabase = await createClient();
    const currentYear = new Date().getFullYear();

    const [linesResult, assetsResult, salesFallbackResult, purchasesFallbackResult] =
      await Promise.all([
        supabase
          .from("accounting_entry_lines")
          .select(
            "account_code, debit, credit, accounting_entries!entry_id(status, deleted_at, entry_date)"
          )
          .eq("organization_id", organizationId)
          .returns<EntryLineRow[]>(),
        supabase
          .from("accounting_fixed_assets")
          .select("acquisition_value")
          .eq("organization_id", organizationId)
          .eq("status", "active"),
        supabase
          .from("sales_invoices")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .in("status", ["sent", "paid"]),
        supabase
          .from("purchase_invoices")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .in("status", ["approved", "paid"])
      ]);

    const allLines: EntryLineRow[] = linesResult.data ?? [];

    const postedLines = allLines.filter((line) => {
      const entry = line.accounting_entries;
      if (!entry) return false;
      if (entry.status !== "posted") return false;
      if (entry.deleted_at !== null) return false;
      return new Date(entry.entry_date).getFullYear() === currentYear;
    });

    let sales = 0;
    let purchases = 0;
    let staffCosts = 0;
    let financialResult = 0;
    let exceptionalResult = 0;
    let treasury = 0;
    let netWorth = 0;

    if (postedLines.length > 0) {
      for (const line of postedLines) {
        const code = line.account_code ?? "";
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);

        if (code.startsWith("7")) {
          sales += credit;
        } else if (code.startsWith("64")) {
          staffCosts += debit;
        } else if (code.startsWith("6")) {
          purchases += debit;
        } else if (code.startsWith("76") || code.startsWith("66")) {
          financialResult += credit - debit;
        } else if (code.startsWith("77") || code.startsWith("67")) {
          exceptionalResult += credit - debit;
        } else if (code.startsWith("57")) {
          treasury += debit - credit;
        } else if (code.startsWith("1")) {
          netWorth += credit - debit;
        }
      }
    } else {
      // No posted lines — approximate from commercial invoices
      sales = ((salesFallbackResult.data ?? []) as { total_amount: number }[]).reduce(
        (sum, r) => sum + (r.total_amount ?? 0),
        0
      );
      purchases = ((purchasesFallbackResult.data ?? []) as { total_amount: number }[]).reduce(
        (sum, r) => sum + (r.total_amount ?? 0),
        0
      );
    }

    const assets = ((assetsResult.data ?? []) as { acquisition_value: number }[]).reduce(
      (sum, r) => sum + (r.acquisition_value ?? 0),
      0
    );

    const grossProfit = sales - purchases;
    const operatingResult = grossProfit - staffCosts;
    const profitBeforeTax = operatingResult + financialResult + exceptionalResult;

    return {
      sales,
      purchases,
      staffCosts,
      grossProfit,
      operatingResult,
      financialResult,
      exceptionalResult,
      profitBeforeTax,
      treasury,
      assets,
      netWorth,
      workingCapital: treasury
    };
  } catch {
    return ZERO;
  }
}
