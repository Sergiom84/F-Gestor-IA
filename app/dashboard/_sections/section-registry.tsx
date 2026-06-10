import { AccountingWorkspace } from "./accounting/accounting-workspace";
import { AccountingDashboard } from "./dashboard/accounting-dashboard";
import { GestoriaDashboard } from "./dashboard/gestoria-dashboard";
import { SalesDashboardSection } from "./dashboard/sales-dashboard-section";
import { ContactsSection } from "./contacts/contacts-section";
import { ProductsSection } from "./products/products-section";
import { PurchasesSection } from "./purchases/purchases-section";
import { QuotesSection } from "./quotes/quotes-section";
import { SalesSection } from "./sales/sales-section";
import { ModuleWorkspace } from "./shared/module-workspace";
import type { ReactNode } from "react";
import type { DashboardData } from "../_data/dashboard-data";
import type { AppModule } from "../_lib/types";

type SectionRenderer = (data: DashboardData) => ReactNode;

const sectionRegistry = {
  sales: (data) => (
    <SalesSection
      organizationId={data.activeOrganization.id}
      organizationName={data.activeOrganization.name}
    />
  ),
  purchases: (data) => (
    <PurchasesSection
      organizationId={data.activeOrganization.id}
      organizationName={data.activeOrganization.name}
    />
  ),
  contacts: (data) => (
    <ContactsSection
      organizationId={data.activeOrganization.id}
      organizationName={data.activeOrganization.name}
    />
  ),
  quotes: (data) => <QuotesSection organizationId={data.activeOrganization.id} />,
  products: (data) => (
    <ProductsSection
      organizationId={data.activeOrganization.id}
      organizationName={data.activeOrganization.name}
    />
  ),
  accounting: (data) => (
    <AccountingWorkspace organizationName={data.activeOrganization.name} />
  ),
  banks: (data) => <ReferenceModuleSection data={data} module="banks" />,
  tax: (data) => <ReferenceModuleSection data={data} module="tax" />,
  reports: (data) => <ReferenceModuleSection data={data} module="reports" />,
  settings: (data) => <ReferenceModuleSection data={data} module="settings" />
} satisfies Partial<Record<AppModule, SectionRenderer>>;

export function DashboardSection({ data }: { data: DashboardData }) {
  if (data.activeModule === "dashboard") {
    return <DashboardHomeSection data={data} />;
  }

  const renderSection = sectionRegistry[data.activeModule];

  return renderSection ? renderSection(data) : <ReferenceModuleSection data={data} module={data.activeModule} />;
}

function DashboardHomeSection({ data }: { data: DashboardData }) {
  if (data.activeTab === "accounting") {
    return (
      <AccountingDashboard
        activeOrganization={data.activeOrganization}
        activeMembership={data.activeMembership}
        documents={data.documents}
        reviewTasks={data.reviewTasks}
        fiscalEntities={data.fiscalEntities}
        documentCount={data.documentCount}
        needsReviewCount={data.needsReviewCount}
        ocrRequiredCount={data.ocrRequiredCount}
        clientCount={data.clientCount}
        fiscalEntityCount={data.fiscalEntityCount}
        cleanDocumentCount={data.cleanDocumentCount}
        automationRate={data.automationRate}
        reviewRate={data.reviewRate}
        uploadCoverage={data.uploadCoverage}
        aiBudget={data.aiBudget}
      />
    );
  }

  if (data.activeTab === "sales") {
    return (
      <SalesDashboardSection
        organizationId={data.activeOrganization.id}
        clientCount={data.clientCount}
        documentCount={data.documentCount}
        fiscalEntityCount={data.fiscalEntityCount}
      />
    );
  }

  return (
    <GestoriaDashboard
      activeOrganization={data.activeOrganization}
      documents={data.documents}
      fiscalEntities={data.fiscalEntities}
      metrics={{
        aiBudget: data.aiBudget,
        automationRate: data.automationRate,
        cleanDocumentCount: data.cleanDocumentCount,
        documentCount: data.documentCount,
        fiscalEntityCount: data.fiscalEntityCount,
        needsReviewCount: data.needsReviewCount,
        ocrRequiredCount: data.ocrRequiredCount,
        reviewRate: data.reviewRate,
        uploadCoverage: data.uploadCoverage
      }}
      reviewTasks={data.reviewTasks}
    />
  );
}

function ReferenceModuleSection({
  data,
  module
}: {
  data: DashboardData;
  module: AppModule;
}) {
  return (
    <ModuleWorkspace
      module={module}
      clientCount={data.clientCount}
      documentCount={data.documentCount}
      fiscalEntityCount={data.fiscalEntityCount}
      needsReviewCount={data.needsReviewCount}
      ocrRequiredCount={data.ocrRequiredCount}
      memberCount={data.memberCount}
    />
  );
}
