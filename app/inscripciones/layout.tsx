import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BrandIsotype } from "../_components/brand-mark";
import { ThemeToggle } from "../_components/theme-toggle";

import "./inscripciones.css";

export const metadata: Metadata = {
  title: { default: "Inscripción — ASO Computación", template: "%s — ASO Computación" },
  description: "Inscripción a los eventos de ASO Computación.",
  robots: { index: false, follow: false },
};

/**
 * The event registration page's own shell, apart from the forum's: a public page that anyone can open from the
 * landing, with the brand, the theme toggle and a reading column. Nothing here knows about the forum's rail or top bar.
 */
export default function RegistrationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#registration-main" className="fixed top-[-4rem] left-3 z-100 rounded bg-action px-4 py-2.5 font-bold text-on-action focus:top-3">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-muted px-4 shadow-[0_1px_0_var(--color-border)] sm:px-6">
        <span className="flex items-center gap-3">
          <BrandIsotype width={26} height={29} />
          <span className="font-brand text-lg tracking-[0.01em]">ASO Computación</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <main id="registration-main" className="mx-auto w-full max-w-[62rem] px-4 pt-8 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
