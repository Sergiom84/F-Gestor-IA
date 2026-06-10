import { readSalesData } from "../../_data/commercial-data";
import { SalesWorkspace } from "./sales-workspace";

export async function SalesSection({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const data = await readSalesData(organizationId);

  return (
    <SalesWorkspace
      clients={data.clients}
      fiscalEntities={data.fiscalEntities}
      organizationName={organizationName}
      organizationId={organizationId}
      initialDocuments={data.documents}
    />
  );
}
