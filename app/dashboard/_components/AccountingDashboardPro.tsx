"use client";

import type {
  DocumentRow,
  FiscalEntityRow,
  ReviewTaskRow
} from "../_lib/types";
import {
  ChartRow,
  DocsPanel,
  KpiHero,
  QuickUpload,
  ReviewPanel,
  AssistantPanel
} from "./DashboardWidgets";
import "./dashboard-pro.css";

type DashboardMetrics = {
  aiBudget: string;
  automationRate: number;
  cleanDocumentCount: number;
  documentCount: number;
  fiscalEntityCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
  reviewRate: number;
  uploadCoverage: number;
};

export function AccountingDashboardPro({
  activeOrganizationId,
  docs,
  fiscalEntities,
  layout = "ejecutivo",
  metrics,
  tasks
}: {
  activeOrganizationId: string;
  docs: DocumentRow[];
  fiscalEntities: FiscalEntityRow[];
  layout?: "ejecutivo" | "operativo";
  metrics: DashboardMetrics;
  tasks: ReviewTaskRow[];
}) {
  if (layout === "operativo") {
    return (
      <div className="dash-pro">
        <section className="chart-row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(320px,0.9fr)" }}>
          <AssistantPanel needsReviewCount={metrics.needsReviewCount} ocrRequiredCount={metrics.ocrRequiredCount} />
          <ReviewPanel tasks={tasks} />
        </section>
        <KpiHero metrics={metrics} />
        <ChartRow metrics={metrics} />
        <section className="ops-grid">
          <DocsPanel docs={docs} />
          <QuickUpload activeOrganizationId={activeOrganizationId} fiscalEntities={fiscalEntities} />
        </section>
      </div>
    );
  }

  return (
    <div className="dash-pro">
      <KpiHero metrics={metrics} />
      <ChartRow metrics={metrics} />
      <AssistantPanel needsReviewCount={metrics.needsReviewCount} ocrRequiredCount={metrics.ocrRequiredCount} />
      <section className="ops-grid">
        <DocsPanel docs={docs} />
        <div style={{ display: "grid", gap: "var(--ft-gap, 24px)" }}>
          <ReviewPanel tasks={tasks} />
          <QuickUpload activeOrganizationId={activeOrganizationId} fiscalEntities={fiscalEntities} />
        </div>
      </section>
    </div>
  );
}
