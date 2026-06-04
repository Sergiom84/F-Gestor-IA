import { redirect } from "next/navigation";
import { BrandLockup } from "../brand-lockup";
import { signOut } from "../login/actions";
import { createOnboardingWorkspace } from "./actions";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

type OrganizationMember = {
  organization_id: string;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .returns<OrganizationMember[]>();

  if (membershipsError) {
    throw new Error(`No se pudo comprobar la organizacion activa: ${membershipsError.message}`);
  }

  const existingOrganizationId = memberships?.[0]?.organization_id;

  if (existingOrganizationId) {
    redirect(`/dashboard?org=${existingOrganizationId}`);
  }

  const params = await searchParams;
  const defaultName = displayNameFromEmail(user.email ?? "");

  return (
    <main className="dashboard onboarding-screen">
      <header className="topbar">
        <div className="page-title">
          <BrandLockup />
          <h1>Configurar espacio fiscal</h1>
          <p className="supporting-text">
            Crea la organizacion, el primer cliente y la entidad fiscal para poder subir documentos.
          </p>
        </div>
        <div className="topbar-actions">
          <span className="user-email">{user.email}</span>
          <form action={signOut}>
            <button className="button secondary" type="submit">
              Salir
            </button>
          </form>
        </div>
      </header>

      {params?.error ? (
        <div className="notice danger">{decodeURIComponent(params.error)}</div>
      ) : null}

      <section className="panel onboarding-panel" aria-labelledby="onboarding-title">
        <div className="panel-header">
          <h2 id="onboarding-title">Alta inicial</h2>
          <span className="row-meta">RLS activo · owner automatico</span>
        </div>
        <form className="onboarding-form" action={createOnboardingWorkspace}>
          <div className="form-grid">
            <label className="field">
              <span>Organizacion</span>
              <input
                className="input"
                name="organization_name"
                defaultValue={defaultName ? `${defaultName} Fiscal` : ""}
                maxLength={120}
                required
              />
            </label>

            <label className="field">
              <span>Cliente</span>
              <input className="input" name="client_name" defaultValue={defaultName} maxLength={120} required />
            </label>

            <label className="field">
              <span>Tipo cliente</span>
              <select className="select" name="client_type" defaultValue="company" required>
                <option value="company">Empresa</option>
                <option value="individual">Particular/autonomo</option>
              </select>
            </label>

            <label className="field">
              <span>Entidad fiscal</span>
              <input
                className="input"
                name="fiscal_entity_legal_name"
                defaultValue={defaultName}
                maxLength={160}
                required
              />
            </label>

            <label className="field">
              <span>NIF/CIF</span>
              <input className="input" name="fiscal_entity_tax_id" autoComplete="off" maxLength={32} />
            </label>

            <label className="field">
              <span>Tipo entidad</span>
              <select className="select" name="fiscal_entity_type" defaultValue="company" required>
                <option value="company">Sociedad</option>
                <option value="self_employed">Autonomo</option>
                <option value="other">Otra</option>
              </select>
            </label>
          </div>

          <div className="form-footer">
            <button className="button" type="submit">
              Crear y abrir dashboard
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0]?.trim() ?? "";

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
