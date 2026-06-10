import { readAccountingData } from "../../_data/accounting-data";
import { AccountingWorkspace } from "./accounting-workspace";

export async function AccountingSection({
  organizationId,
  organizationName
}: {
  organizationId: string;
  organizationName: string;
}) {
  const data = await readAccountingData(organizationId);

  return (
    <AccountingWorkspace
      organizationId={organizationId}
      organizationName={organizationName}
      journals={data.journals}
      initialEntries={data.entries}
      initialFixedAssets={data.fixedAssets}
      initialClosings={data.closings}
      initialUnmatchedLines={data.unmatchedLines}
    />
  );
}
