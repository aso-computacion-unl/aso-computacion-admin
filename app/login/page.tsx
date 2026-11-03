import type { Metadata } from "next";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { loginAvailability } from "@/infrastructure/auth/auth-config";
import { login } from "@/interface/auth/actions";
import { CONFIG_INCOMPLETE_MESSAGE, loginErrorMessage } from "@/interface/auth/login-errors";
import { reportAuthConfigProblems } from "@/interface/auth/report-auth-config";

import { BrandLogo } from "../_components/brand-mark";
import { ThemeToggle } from "../_components/theme-toggle";

import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "Acceso — ASO Computación",
  description: "Acceso administrativo para ASO Computación.",
};

// Which ways in exist depends on the environment, and `?error=` is per request.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { google, emergency, problems } = loginAvailability();
  const misconfigured = problems.length > 0;
  const error = misconfigured ? CONFIG_INCOMPLETE_MESSAGE : loginErrorMessage((await searchParams).error);

  reportAuthConfigProblems(problems);

  return (
    <main className="relative grid min-h-screen place-items-center px-6 py-10">
      <ThemeToggle className="absolute top-3 right-3" />
      <div className="w-full max-w-sm">
        <BrandLogo alt="ASO Computación" width={168} className="mb-10 h-auto w-42" />

        {/* The landing's branch line, with the page title as its first commit. */}
        <section aria-labelledby="login-title" className="relative border-l-2 border-sky pb-2 pl-7">
          <span
            aria-hidden="true"
            className="absolute top-[0.8125rem] -left-[calc(0.5625rem+1px)] size-[1.125rem] rounded-full border-[3px] border-navy bg-sky"
          />
          <h1 id="login-title" className="font-display text-[1.75rem] leading-[1.15]">
            Panel de administración
          </h1>
          <p className="mt-2 mb-6 text-mist">
            {google
              ? "Entre con su cuenta de Google para editar el sitio de ASO Computación."
              : misconfigured && !emergency
                ? "El acceso no está disponible hasta corregir la configuración."
                : "Ingrese la contraseña de la directiva para editar el sitio de ASO Computación."}
          </p>
          {error ? (
            <p role="alert" className="mb-4 flex items-start gap-2 border-l-2 border-error bg-error/10 px-3 py-2 text-sm">
              <Icon name="alert" className="mt-px size-4 shrink-0 text-error" />
              {error}
            </p>
          ) : null}
          {google ? (
            // A plain link, not next/link: it must not be prefetched, it starts a redirect flow.
            <Button asChild className="min-h-12 w-full">
              <a href="/auth/google/start">Entrar con Google</a>
            </Button>
          ) : null}
          {misconfigured && emergency ? <LoginForm action={login} /> : null}
          {google && emergency ? (
            <details className="mt-8 border-t border-border pt-4">
              <summary className="cursor-pointer font-semibold text-mist">Acceso de emergencia</summary>
              <p className="mt-3 mb-4 text-sm text-mist">Solo si el acceso con Google no está disponible. Queda registrado.</p>
              <LoginForm action={login} />
            </details>
          ) : null}
          {google || misconfigured ? null : <LoginForm action={login} />}
        </section>
      </div>
    </main>
  );
}
