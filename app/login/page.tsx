import type { Metadata } from "next";

import { Icon } from "@/components/icons";
import { loginAvailability } from "@/infrastructure/auth/auth-config";
import { login } from "@/interface/auth/actions";
import { CONFIG_INCOMPLETE_MESSAGE, loginErrorMessage } from "@/interface/auth/login-errors";
import { reportAuthConfigProblems } from "@/interface/auth/report-auth-config";
import { THEME_COLOR, THEME_KEY } from "@/interface/theme/theme";

import { AuthAlert } from "../_components/auth-alert";
import { BrandLogo } from "../_components/brand-mark";
import { GoogleButton } from "../_components/google-button";
import { AdminThemeDefault, ThemeToggle } from "../_components/theme-toggle";

import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "Acceso — ASO Computación",
  description: "Acceso administrativo para ASO Computación.",
};

// Which ways in exist depends on the environment, and `?error=` is per request.
export const dynamic = "force-dynamic";

/**
 * The login opens in the admin's light look unless the user has chosen a theme, like `/admin` does (the root layout's
 * pre-paint script is scoped to `/admin`, so the forum keeps following the system). It runs at the top of this page's
 * body, before the card paints; `AdminThemeDefault` covers the client-side navigations, where scripts do not rerun.
 */
const LIGHT_LOGIN_SCRIPT = `(function(){var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(s==="light"||s==="dark")return;document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(THEME_COLOR.light)})})();`;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { google, emergency, problems } = loginAvailability();
  const misconfigured = problems.length > 0;
  const error = misconfigured ? CONFIG_INCOMPLETE_MESSAGE : loginErrorMessage((await searchParams).error);

  reportAuthConfigProblems(problems);

  return (
    <main className="relative grid min-h-dvh place-items-center p-4 sm:p-10">
      <script dangerouslySetInnerHTML={{ __html: LIGHT_LOGIN_SCRIPT }} />
      <AdminThemeDefault />
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5">
        <ThemeToggle />
      </div>
      <section
        aria-labelledby="login-title"
        className="grid w-full max-w-140 justify-items-center gap-5 border-t-4 border-foreground bg-card px-5 py-9 text-center ring-1 ring-paper-ring ring-inset shadow-[8px_8px_0_color-mix(in_srgb,var(--color-sky)_28%,transparent)] sm:px-13 sm:py-11 sm:shadow-[14px_14px_0_color-mix(in_srgb,var(--color-sky)_28%,transparent)]"
      >
        <BrandLogo alt="" width={96} className="h-auto w-24" />
        <p className="font-mono text-[0.8125rem] font-semibold tracking-[0.16em] text-sky uppercase">Admin</p>
        <h1 id="login-title" className="font-display text-4xl leading-none sm:text-[2.75rem]">
          ASO Computación
        </h1>

        {error ? (
          <AuthAlert className="w-full text-left">
            <p>{error}</p>
          </AuthAlert>
        ) : null}
        {/* A plain link, not next/link: it must not be prefetched, it starts a redirect flow. */}
        {google ? <GoogleButton href="/auth/google/start" className="min-h-16 w-full text-xl">Entrar con Google</GoogleButton> : null}
        {misconfigured && emergency ? <PasswordForm /> : null}
        {google && emergency ? (
          <details className="emergency w-full">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold text-sky hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky [&::-webkit-details-marker]:hidden">
              <Icon name="lock" className="size-4.5" />
              Acceso de emergencia
            </summary>
            <div className="mt-3 grid gap-3 text-left">
              <p className="text-[0.9375rem] text-mist">Solo si Google no está disponible. Queda registrado.</p>
              <LoginForm action={login} />
            </div>
          </details>
        ) : null}
        {google || misconfigured ? null : <PasswordForm />}
      </section>
    </main>
  );
}

function PasswordForm() {
  return (
    <div className="w-full text-left">
      <LoginForm action={login} />
    </div>
  );
}
