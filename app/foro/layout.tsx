import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { initialsOf } from "@/interface/forum/forum-display";
import { getForumMember } from "@/interface/forum/require-forum-member";

import { BrandIsotype } from "../_components/brand-mark";
import { ThemeToggle } from "../_components/theme-toggle";

import { SignOutButton } from "./_components/sign-out-button";

export const metadata: Metadata = {
  title: { default: "Foro — ASO Computación", template: "%s — Foro ASO" },
  description: "El foro de estudiantes de ASO Computación.",
  robots: { index: false, follow: false },
};

// The header names the signed-in member and every page checks the session: none of it can be prerendered.
export const dynamic = "force-dynamic";

export default async function ForumLayout({ children }: { children: ReactNode }) {
  const member = await getForumMember();

  return (
    <div className="min-h-screen">
      <a href="#main" className="fixed top-[-4rem] left-3 z-100 rounded bg-sky px-4 py-2.5 font-bold text-primary-foreground focus:top-3">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-muted px-4 py-2 sm:px-6">
        <Link href="/foro" aria-label="Foro de ASO Computación, inicio" className="flex items-center gap-3 rounded">
          <BrandIsotype width={26} height={29} />
          <span className="font-display text-lg tracking-[0.01em]">foro</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {member ? (
            <>
              <span className="mr-1 hidden max-w-48 truncate text-sm text-mist sm:inline">{member.displayName}</span>
              <span aria-hidden="true" className="mr-1 grid size-8 place-items-center rounded-full bg-card text-xs font-bold text-sky-bright">
                {initialsOf(member.displayName)}
              </span>
              <SignOutButton />
            </>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[62rem] px-4 pt-8 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
