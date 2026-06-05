import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChevronRight,
  LogOut,
  Sparkles
} from "lucide-react";
import { signOut } from "../../login/actions";
import { navigationItems } from "../_lib/module-catalog";
import { formatDashboardError } from "../_lib/formatters";
import type { AppModule, DashboardTab, Organization } from "../_lib/types";

type DashboardShellProps = {
  activeModule: AppModule;
  activeOrganization: Organization;
  activeTab: DashboardTab;
  children: ReactNode;
  displayName: string;
  error?: string | undefined;
  onboarded?: string | undefined;
  organizations: Organization[];
  uploaded?: string | undefined;
  userEmail: string | null;
};

export function DashboardShell({
  activeModule,
  activeOrganization,
  activeTab,
  children,
  displayName,
  error,
  onboarded,
  organizations,
  uploaded,
  userEmail
}: DashboardShellProps) {
  const isOperationalModule = activeModule === "sales"
    || activeModule === "purchases"
    || activeModule === "contacts"
    || activeModule === "products"
    || activeModule === "accounting";
  const moduleHref = (module: AppModule) => `/dashboard?org=${activeOrganization.id}&module=${module}`;
  const tabHref = (tab: DashboardTab) => `/dashboard?org=${activeOrganization.id}&module=dashboard&tab=${tab}`;

  return (
    <main className="fiscal-shell">
      <aside className="fiscal-sidebar" aria-label="Navegacion principal">
        <div className="sidebar-brand" aria-label="GFiscal">
          <span className="sidebar-brand-mark">GF</span>
          <span>GFiscal</span>
        </div>
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.module;

            return (
              <Link className={`sidebar-link${isActive ? " active" : ""}`} href={moduleHref(item.module)} key={item.label}>
                <Icon aria-hidden="true" size={23} strokeWidth={2.7} />
                <span>{item.label}</span>
                {!isActive ? <ChevronRight aria-hidden="true" className="sidebar-chevron" size={15} /> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className={`fiscal-workbench${isOperationalModule ? " sales-workbench" : ""}`}>
        {isOperationalModule ? null : (
          <DashboardHeader
            activeModule={activeModule}
            activeOrganization={activeOrganization}
            activeTab={activeTab}
            displayName={displayName}
            organizations={organizations}
            userEmail={userEmail}
          />
        )}

        {activeModule === "dashboard" ? (
          <DashboardTabs activeTab={activeTab} tabHref={tabHref} />
        ) : null}

        <DashboardNotices error={error} onboarded={onboarded} uploaded={uploaded} />
        {children}
      </section>
    </main>
  );
}

function DashboardHeader({
  activeModule,
  activeOrganization,
  activeTab,
  displayName,
  organizations,
  userEmail
}: {
  activeModule: AppModule;
  activeOrganization: Organization;
  activeTab: DashboardTab;
  displayName: string;
  organizations: Organization[];
  userEmail: string | null;
}) {
  return (
    <header className="fiscal-header">
      <div className="fiscal-title-block">
        <div className="fiscal-title-row">
          <h1>Hola, {displayName}</h1>
          <span className="insights-pill">
            <Sparkles aria-hidden="true" size={18} fill="currentColor" />
            Copilot Insights
          </span>
        </div>
        <p>
          En esta página se muestra información clave sobre tu negocio. Sage Active actualiza tus KPI cada 5 minutos.
        </p>
      </div>
      <div className="fiscal-header-actions">
        <form className="org-switcher" action="/dashboard">
          <label htmlFor="org">Organizacion</label>
          <input type="hidden" name="module" value={activeModule} />
          {activeModule === "dashboard" ? <input type="hidden" name="tab" value={activeTab} /> : null}
          <select id="org" name="org" defaultValue={activeOrganization.id}>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <button className="button compact secondary" type="submit">
            Cambiar
          </button>
        </form>
        <form action={signOut}>
          <button className="icon-action" aria-label="Salir" type="submit" title={userEmail ?? "Salir"}>
            <LogOut aria-hidden="true" size={19} />
          </button>
        </form>
      </div>
    </header>
  );
}

function DashboardTabs({
  activeTab,
  tabHref
}: {
  activeTab: DashboardTab;
  tabHref: (tab: DashboardTab) => string;
}) {
  return (
    <div className="fiscal-tabs" role="tablist" aria-label="Secciones del cuadro de mando">
      <Link className={`tab${activeTab === "accounting" ? " active" : ""}`} href={tabHref("accounting")} role="tab">
        Contabilidad
      </Link>
      <Link className={`tab${activeTab === "management" ? " active" : ""}`} href={tabHref("management")} role="tab">
        Gestoría
      </Link>
      <Link className={`tab${activeTab === "sales" ? " active" : ""}`} href={tabHref("sales")} role="tab">
        Ventas y compras
      </Link>
    </div>
  );
}

function DashboardNotices({
  error,
  onboarded,
  uploaded
}: {
  error?: string | undefined;
  onboarded?: string | undefined;
  uploaded?: string | undefined;
}) {
  return (
    <>
      {uploaded ? (
        <div className="notice success">Documento subido y encolado para procesamiento.</div>
      ) : null}

      {onboarded ? (
        <div className="notice success">Alta inicial completada. Ya puedes subir tu primer PDF.</div>
      ) : null}

      {error ? (
        <div className="notice danger">{formatDashboardError(error)}</div>
      ) : null}
    </>
  );
}
