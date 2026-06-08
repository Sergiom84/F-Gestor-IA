import { loadQuotesInitialData } from "./quotes-actions";
import { QuotesClient } from "./quotes-client";

export async function QuotesSection({ organizationId }: { organizationId: string }) {
  const initialData = await loadQuotesInitialData(organizationId);
  return <QuotesClient initialData={initialData} />;
}
