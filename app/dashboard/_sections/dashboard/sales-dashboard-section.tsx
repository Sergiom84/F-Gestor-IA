import { readSalesDashboardMetrics } from "../../_data/commercial-data";
import { SalesDashboard } from "./sales-dashboard";

export async function SalesDashboardSection({
  organizationId,
  clientCount,
  documentCount,
  fiscalEntityCount
}: {
  organizationId: string;
  clientCount: number;
  documentCount: number;
  fiscalEntityCount: number;
}) {
  const metrics = await readSalesDashboardMetrics(organizationId);

  return (
    <SalesDashboard
      clientCount={clientCount}
      documentCount={documentCount}
      fiscalEntityCount={fiscalEntityCount}
      pendingCollection={metrics.pendingCollection}
      pendingPayment={metrics.pendingPayment}
      overdueCollection={metrics.overdueCollection}
      overduePayment={metrics.overduePayment}
      purchaseInvoicesTotal={metrics.purchaseInvoicesTotal}
    />
  );
}
