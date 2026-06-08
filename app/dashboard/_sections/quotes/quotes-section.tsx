import dynamic from "next/dynamic";
import { loadQuotesInitialData } from "./quotes-actions";
import type { QuotesInitialData } from "./quotes-actions";

// QuotesWorkspace uses localStorage for layout and migration, so it must run
// client-only. SSR is disabled to avoid `localStorage is not defined`.
const QuotesWorkspace = dynamic(
  () => import("./quotes-workspace").then((m) => m.QuotesWorkspace),
  { ssr: false }
);

export async function QuotesSection({ organizationId }: { organizationId: string }) {
  const initialData = await loadQuotesInitialData(organizationId);
  return <QuotesWorkspace initialData={initialData} />;
}
