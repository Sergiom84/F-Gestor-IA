import type {
  DocumentRow,
  FiscalEntityRow,
  Organization,
  OrganizationMember,
  ReviewTaskRow
} from "../_lib/types";
import { AccountingDashboardPro } from "./AccountingDashboardPro";

export function AccountingDashboard({
  activeOrganization,
  documents,
  reviewTasks,
  fiscalEntities,
  documentCount,
  needsReviewCount,
  ocrRequiredCount,
  fiscalEntityCount,
  cleanDocumentCount,
  automationRate,
  reviewRate,
  uploadCoverage,
  aiBudget
}: {
  activeOrganization: Organization;
  activeMembership: OrganizationMember | null | undefined;
  documents: DocumentRow[];
  reviewTasks: ReviewTaskRow[];
  fiscalEntities: FiscalEntityRow[];
  documentCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
  clientCount: number;
  fiscalEntityCount: number;
  cleanDocumentCount: number;
  automationRate: number;
  reviewRate: number;
  uploadCoverage: number;
  aiBudget: string;
}) {
  return (
    <AccountingDashboardPro
      activeOrganizationId={activeOrganization.id}
      docs={documents}
      fiscalEntities={fiscalEntities}
      layout="ejecutivo"
      metrics={{
        aiBudget,
        automationRate,
        cleanDocumentCount,
        documentCount,
        fiscalEntityCount,
        needsReviewCount,
        ocrRequiredCount,
        reviewRate,
        uploadCoverage
      }}
      tasks={reviewTasks}
    />
  );
}
