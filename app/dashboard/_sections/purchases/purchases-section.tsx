import { readPurchasesData } from "../../_data/commercial-data";
import { PurchasesWorkspace } from "./purchases-workspace";

export async function PurchasesSection({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const data = await readPurchasesData(organizationId);

  return (
    <PurchasesWorkspace
      organizationName={organizationName}
      initialInvoices={data.invoices}
    />
  );
}
