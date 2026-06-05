import type {
  DocumentRow,
  FiscalEntityRow,
  Organization,
  ReviewTaskRow
} from "../../_lib/types";
import { AccountingDashboardPro } from "../../_components/AccountingDashboardPro";

type GestoriaDashboardMetrics = {
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

export function GestoriaDashboard({
  activeOrganization,
  documents,
  fiscalEntities,
  metrics,
  reviewTasks
}: {
  activeOrganization: Organization;
  documents: DocumentRow[];
  fiscalEntities: FiscalEntityRow[];
  metrics: GestoriaDashboardMetrics;
  reviewTasks: ReviewTaskRow[];
}) {
  return (
    <AccountingDashboardPro
      activeOrganizationId={activeOrganization.id}
      docs={documents}
      fiscalEntities={fiscalEntities}
      layout="ejecutivo"
      metrics={metrics}
      tasks={reviewTasks}
    />
  );
}
