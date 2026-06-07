"use client";

import dynamic from "next/dynamic";

// QuotesWorkspace reads localStorage in state initializers, so it must run
// only on the client. Disable SSR to avoid `localStorage is not defined`.
const QuotesWorkspace = dynamic(
  () => import("./quotes-workspace").then((m) => m.QuotesWorkspace),
  { ssr: false }
);

export function QuotesSection() {
  return <QuotesWorkspace />;
}
