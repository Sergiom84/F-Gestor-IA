import { readSalesData } from "../../_data/commercial-data";
import { SalesWorkspace } from "./sales-workspace";

export async function SalesSection({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const data = await readSalesData(organizationId);

  return (
    <SalesWorkspace
      organizationName={organizationName}
      initialDocuments={data.documents}
    />
  );
}
