import type { Metadata } from "next";

import { Icon } from "@/components/icons";
import { loginAvailability } from "@/infrastructure/auth/auth-config";
import { login } from "@/interface/auth/actions";
import { CONFIG_INCOMPLETE_MESSAGE, loginErrorMessage } from "@/interface/auth/login-errors";
import { reportAuthConfigProblems } from "@/interface/auth/report-auth-config";

import { AuthSplit } from "../_components/auth-split";
import { GoogleButton } from "../_components/google-button";
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
    <main>
      <AuthSplit
        panelLabel="Sobre el panel"
        headline="El sitio de la asociación, siempre al día."
        lines={["Publique eventos, noticias y galerías sin pedir ayuda a nadie.", "Cada cambio reconstruye el sitio público de ASO Computación."]}
        terminal="git log --oneline"
        visual={<CommitLog />}
        logo
        title="Panel de administración"
        titleId="login-title"
        titleClassName="font-display text-[1.75rem] leading-[1.15] lg:text-[clamp(1.75rem,2.3vw,2.25rem)]"
        corner={<ThemeToggle />}
      >
        <p className="text-lg text-mist">
          {google
            ? "Entre con su cuenta de Google para editar el sitio de ASO Computación."
            : misconfigured && !emergency
              ? "El acceso no está disponible hasta corregir la configuración."
              : "Ingrese la contraseña de la directiva para editar el sitio de ASO Computación."}
        </p>
        {error ? (
          <p role="alert" className="flex items-start gap-2 border-l-2 border-error bg-error/10 px-3 py-2 text-sm">
            <Icon name="alert" className="mt-px size-4 shrink-0 text-error" />
            {error}
          </p>
        ) : null}
        {google ? (
          // A plain link, not next/link: it must not be prefetched, it starts a redirect flow.
          <GoogleButton href="/auth/google/start" className="w-full">
            Entrar con Google
          </GoogleButton>
        ) : null}
        {misconfigured && emergency ? <LoginForm action={login} /> : null}
        {google && emergency ? (
          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer font-semibold text-mist">Acceso de emergencia</summary>
            <p className="mt-3 mb-4 text-sm text-mist">Solo si el acceso con Google no está disponible. Queda registrado.</p>
            <LoginForm action={login} />
          </details>
        ) : null}
        {google || misconfigured ? null : <LoginForm action={login} />}
      </AuthSplit>
    </main>
  );
}

// Made-up history that shows what the panel is for; decoration, never read from the database.
const COMMITS = [
  ["a3f9c21", "evento publicado"],
  ["7be04d8", "galería ordenada"],
  ["c19a5f3", "noticia actualizada"],
  ["02d6e7b", "preguntas frecuentes al día"],
] as const;

function CommitLog() {
  return (
    <ol aria-hidden="true" className="grid gap-4 font-mono text-sm xl:gap-5 xl:text-base">
      {COMMITS.map(([hash, message]) => (
        <li key={hash} className="relative flex gap-4">
          <span className="absolute top-[0.5em] left-[calc(-1.75rem-0.375rem)] size-[0.6875rem] rounded-full border-2 border-sky bg-muted" />
          <span className="text-sky">{hash}</span>
          <span className="text-foreground">{message}</span>
        </li>
      ))}
    </ol>
  );
}
