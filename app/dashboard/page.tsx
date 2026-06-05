import { DashboardShell } from "./_components/dashboard-shell";
import { readDashboardData } from "./_data/dashboard-data";
import { DashboardSection } from "./_sections/section-registry";
import type { DashboardSearchParams } from "./_data/dashboard-data";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const data = await readDashboardData(params);

  return (
    <DashboardShell
      activeModule={data.activeModule}
      activeOrganization={data.activeOrganization}
      activeTab={data.activeTab}
      displayName={data.displayName}
      error={params?.error}
      onboarded={params?.onboarded}
      organizations={data.organizations}
      uploaded={params?.uploaded}
      userEmail={data.userEmail}
    >
      <DashboardSection data={data} />
    </DashboardShell>
  );
}
