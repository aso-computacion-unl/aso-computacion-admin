import type { Metadata } from "next";

import { login } from "@/interface/auth/actions";

import { BrandLogo } from "../_components/brand-mark";
import { ThemeToggle } from "../_components/theme-toggle";

import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "Acceso — ASO Computación",
  description: "Acceso administrativo para ASO Computación.",
};

export default function LoginPage() {
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
          <p className="mt-2 mb-6 text-mist">Ingrese la contraseña de la directiva para editar el sitio de ASO Computación.</p>
          <LoginForm action={login} />
        </section>
      </div>
    </main>
  );
}
