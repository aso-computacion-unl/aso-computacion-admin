import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppTopBar } from "../_components/app-top-bar";
import { ThemeToggle } from "../_components/theme-toggle";

import "./inscripciones.css";

export const metadata: Metadata = {
  title: { default: "Inscripción — ASO Computación", template: "%s — ASO Computación" },
  description: "Inscripción a los eventos de ASO Computación.",
  robots: { index: false, follow: false },
};

/**
 * The registrations' own shell, apart from the forum's (D8): a public section anyone can open from the landing, with
 * its own top bar ("Inscripciones", whose brand leads to the list of events), the theme toggle and a reading column.
 * The list and the event's page share it. Nothing here knows about the forum's rail or top bar, and none of it says "Foro".
 */
export default function RegistrationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#registration-main" className="fixed top-[-4rem] left-3 z-100 rounded bg-action px-4 py-2.5 font-bold text-on-action focus:top-3">
        Saltar al contenido
      </a>

      <AppTopBar productName="Inscripciones" homeHref="/inscripciones" homeLabel="Inscripciones de ASO Computación, inicio">
        <ThemeToggle />
      </AppTopBar>

      <main id="registration-main" className="mx-auto w-full max-w-[70rem] px-4 pt-8 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
