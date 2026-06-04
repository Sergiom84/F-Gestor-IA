import { redirect } from "next/navigation";
import { signInWithPassword } from "./actions";
import { createClient } from "@/src/lib/supabase/server";
import { BrandLockup } from "../brand-lockup";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
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
      <section className="login-panel" aria-labelledby="login-title">
        <BrandLockup />
        <h1 id="login-title">Acceso al panel</h1>
        <p className="supporting-text">Documentos, revision humana y trazabilidad fiscal.</p>

        {params?.error ? (
          <p className="alert" role="alert">
            No se pudo iniciar sesion con esos datos.
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
    </main>
  );
}
