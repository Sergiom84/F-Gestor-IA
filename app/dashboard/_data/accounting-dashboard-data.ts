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
};

type AmountRow = {
  total_amount: number | null;
};

function sumAmountRows(rows: AmountRow[] | null | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
}

export async function readAccountingDashboardData(
  organizationId: string
): Promise<AccountingDashboardData> {
  try {
    const supabase = await createClient();
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const [
      linesResult,
      assetsResult,
      acceptedQuotesResult,
      acceptedOrdersResult,
      acceptedDeliveryNotesResult,
      issuedInvoicesResult,
      purchasesResult
    ] = await Promise.all([
        supabase
          .from("accounting_entry_lines")
          .select("account_code, debit, credit, accounting_entries!entry_id!inner(entry_date)")
          .eq("organization_id", organizationId)
          .eq("accounting_entries.status", "posted")
          .is("accounting_entries.deleted_at", null)
          .gte("accounting_entries.entry_date", yearStart)
          .lte("accounting_entries.entry_date", yearEnd)
          .returns<EntryLineRow[]>(),
        supabase
          .from("accounting_fixed_assets")
          .select("acquisition_value")
          .eq("organization_id", organizationId)
          .eq("status", "active"),
        supabase
          .from("sales_quotes")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .eq("status", "accepted")
          .is("converted_sales_invoice_id", null)
          .is("deleted_at", null),
        supabase
          .from("sales_orders")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .eq("status", "accepted")
          .is("deleted_at", null),
        supabase
          .from("sales_delivery_notes")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .eq("status", "accepted")
          .is("deleted_at", null),
        supabase
          .from("sales_invoices")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .in("status", ["open", "sent", "booked", "overdue", "paid"])
          .is("deleted_at", null),
        supabase
          .from("purchase_invoices")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .in("status", ["open", "overdue", "booked", "paid"])
          .is("deleted_at", null)
      ]);

    const postedLines: EntryLineRow[] = linesResult.data ?? [];
    const commercialSales =
      sumAmountRows(acceptedQuotesResult.data as AmountRow[] | null) +
      sumAmountRows(acceptedOrdersResult.data as AmountRow[] | null) +
      sumAmountRows(acceptedDeliveryNotesResult.data as AmountRow[] | null) +
      sumAmountRows(issuedInvoicesResult.data as AmountRow[] | null);
    const commercialPurchases = sumAmountRows(purchasesResult.data as AmountRow[] | null);

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
    }

    sales = Math.max(sales, commercialSales);
    purchases = Math.max(purchases, commercialPurchases);

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
