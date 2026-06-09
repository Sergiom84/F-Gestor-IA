import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  LogOut,
  SlidersHorizontal,
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
  const moduleHref = (module: AppModule) => `/dashboard?org=${activeOrganization.id}&module=${module}`;
  const tabHref = (tab: DashboardTab) => `/dashboard?org=${activeOrganization.id}&module=dashboard&tab=${tab}`;

  return (
    <main className="fiscal-shell">
      <header className="gfiscal-topbar">
        <div className="gfiscal-topbar-inner">
          <div className="gfiscal-topbar-util">
            <Link className="gfiscal-brand" href={moduleHref("dashboard")} aria-label="GFiscal">
              <img className="gfiscal-brand-mark" src="/icon.svg" alt="" />
              <span>GFiscal</span>
            </Link>

            <span className="gfiscal-util-spacer" />

            <span className="insights-pill">
              <Sparkles aria-hidden="true" size={16} fill="currentColor" />
              Asistente
            </span>

            <DashboardHeader
              activeModule={activeModule}
              activeOrganization={activeOrganization}
              activeTab={activeTab}
              organizations={organizations}
              userEmail={userEmail}
            />
          </div>

          <nav className="gfiscal-topnav" aria-label="Modulos">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.module;

              return (
                <Link className={`gfiscal-nav-item${isActive ? " active" : ""}`} href={moduleHref(item.module)} key={item.label}>
                  <Icon aria-hidden="true" size={17} strokeWidth={2.35} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <section className="fiscal-workbench">
        {activeModule === "dashboard" ? (
          <div className="gfiscal-page-head">
            <div>
              <h1>
                <b>{displayName}</b>
              </h1>
            </div>
            <DashboardTabs activeTab={activeTab} tabHref={tabHref} />
          </div>
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
  organizations,
  userEmail
}: {
  activeModule: AppModule;
  activeOrganization: Organization;
  activeTab: DashboardTab;
  organizations: Organization[];
  userEmail: string | null;
}) {
  return (
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
        <SlidersHorizontal aria-hidden="true" size={15} strokeWidth={2.4} />
        Contabilidad
      </Link>
      <Link className={`tab${activeTab === "management" ? " active" : ""}`} href={tabHref("management")} role="tab">
        <Sparkles aria-hidden="true" size={15} strokeWidth={2.4} />
        Gestoría
      </Link>
      <Link className={`tab${activeTab === "sales" ? " active" : ""}`} href={tabHref("sales")} role="tab">
        <BarChart3 aria-hidden="true" size={15} strokeWidth={2.4} />
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
