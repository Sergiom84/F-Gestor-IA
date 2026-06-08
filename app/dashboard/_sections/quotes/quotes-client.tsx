"use client";

import dynamic from "next/dynamic";
import type { QuotesInitialData } from "./quotes-actions";

// QuotesWorkspace uses localStorage for layout and migration, so it must run
// client-only. SSR is disabled here because this module is a Client Component.
const QuotesWorkspace = dynamic(
  () => import("./quotes-workspace").then((m) => m.QuotesWorkspace),
  { ssr: false }
);

export function QuotesClient({ initialData }: { initialData: QuotesInitialData }) {
  return <QuotesWorkspace initialData={initialData} />;
}
