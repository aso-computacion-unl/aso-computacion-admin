import type { Metadata } from "next";

import { loginAvailability } from "@/infrastructure/auth/auth-config";
import { login } from "@/interface/auth/actions";
import { CONFIG_INCOMPLETE_MESSAGE, loginErrorMessage } from "@/interface/auth/login-errors";
import { reportAuthConfigProblems } from "@/interface/auth/report-auth-config";

import { AuthAlert } from "../_components/auth-alert";
import { AuthBranch, BranchGoogleButton, BranchLead, BranchNode, BranchNodeText, BranchNodeTitle } from "../_components/auth-branch";
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
      <AuthBranch
        branch="admin"
        title="Panel de administración"
        titleId="login-title"
        logo
        corner={<ThemeToggle />}
        note="Después de entrar, esto es lo que sigue."
        head={
          <>
            <BranchLead>
              {google
                ? "Entre con su cuenta de Google para editar el sitio de ASO Computación."
                : misconfigured && !emergency
                  ? "El acceso no está disponible hasta corregir la configuración."
                  : "Ingrese la contraseña de la directiva para editar el sitio de ASO Computación."}
            </BranchLead>
            {error ? (
              <AuthAlert className="mb-4 max-w-[34rem]">
                <p>{error}</p>
              </AuthAlert>
            ) : null}
            {/* A plain link, not next/link: it must not be prefetched, it starts a redirect flow. */}
            {google ? <BranchGoogleButton href="/auth/google/start">Entrar con Google</BranchGoogleButton> : null}
            {misconfigured && emergency ? (
              <div className="max-w-[34rem]">
                <LoginForm action={login} />
              </div>
            ) : null}
            {google && emergency ? (
              <details className="emergency mt-2.5 max-w-[34rem]">
                <summary className="font-stretch-[108%] font-semibold text-mist hover:text-foreground">Acceso de emergencia</summary>
                <div className="mt-1.5 grid gap-3 rounded-lg border border-border bg-card p-4.5">
                  <p className="text-[0.9375rem] text-mist">Solo si el acceso con Google no está disponible. Queda registrado.</p>
                  <LoginForm action={login} />
                </div>
              </details>
            ) : null}
            {google || misconfigured ? null : (
              <div className="max-w-[34rem]">
                <LoginForm action={login} />
              </div>
            )}
          </>
        }
        nodes={NEXT_STEPS.map(([hash, title, text]) => (
          <BranchNode key={hash} hash={hash}>
            <BranchNodeTitle>{title}</BranchNodeTitle>
            <BranchNodeText>{text}</BranchNodeText>
          </BranchNode>
        ))}
      />
    </main>
  );
}

// What the panel is for, one node each. The hashes are made up; they only dress the branch.
const NEXT_STEPS = [
  ["a3f9c21", "Eventos y galerías", "Publique el evento con todas sus fotos, sin pedir ayuda a nadie."],
  ["c19a5f3", "Noticias y preguntas frecuentes", "Redacte, corrija y programe lo que dice el sitio de la asociación."],
  ["02d6e7b", "Sitio público al día", "Cada cambio reconstruye el sitio público de ASO Computación."],
] as const;
