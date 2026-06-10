import { redirect } from "next/navigation";
import { signInWithPassword, signUpWithPassword } from "./actions";
import { createClient } from "@/src/lib/supabase/server";
import { BrandLockup } from "../brand-lockup";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    registered?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="login-screen">
      <div className="auth-grid">
        <section className="login-panel" aria-labelledby="login-title">
          <BrandLockup />
          <h1 id="login-title">Acceso al panel</h1>

          {params?.error ? (
            <p className="alert" role="alert">
              {formatAuthError(params.error)}
            </p>
          ) : null}

          {params?.registered ? (
            <p className="notice success" role="status">
              Revisa tu email para confirmar la cuenta antes de entrar.
            </p>
          ) : null}

          <form action={signInWithPassword} className="form-stack">
            <label className="field">
              <span>Email</span>
              <input className="input" name="email" type="email" autoComplete="email" required />
            </label>

            <label className="field">
              <span>Clave</span>
              <input className="input" name="password" type="password" autoComplete="current-password" required />
            </label>

            <button className="button" type="submit">
              Entrar
            </button>
          </form>
        </section>

        <section className="login-panel" aria-labelledby="signup-title">
          <h1 id="signup-title">Crear cuenta</h1>

          <form action={signUpWithPassword} className="form-stack">
            <label className="field">
              <span>Nombre</span>
              <input className="input" name="display_name" autoComplete="name" />
            </label>

            <label className="field">
              <span>Email</span>
              <input className="input" name="email" type="email" autoComplete="email" required />
            </label>

            <label className="field">
              <span>Clave</span>
              <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </label>

            <button className="button secondary" type="submit">
              Registrarme
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function formatAuthError(error: string): string {
  const messages: Record<string, string> = {
    auth: "No se pudo iniciar sesion con esos datos.",
    missing: "Introduce email y clave para continuar.",
    password_length: "La clave debe tener al menos 8 caracteres.",
    signup: "No se pudo crear la cuenta con esos datos."
  };

  return messages[error] ?? "La operacion de acceso no se pudo completar.";
}
