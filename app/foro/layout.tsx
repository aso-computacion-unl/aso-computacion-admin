import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getForumMember } from "@/interface/forum/require-forum-member";

import { AppTopBar } from "../_components/app-top-bar";
import { IdentityChip } from "../_components/identity-chip";
import { ThemeToggle } from "../_components/theme-toggle";

import { SignOutButton } from "./_components/sign-out-button";
import "./forum.css";

export const metadata: Metadata = {
  title: { default: "Foro — ASO Computación", template: "%s — Foro ASO" },
  description: "El foro de estudiantes de ASO Computación.",
  robots: { index: false, follow: false },
};

// The header names the signed-in member and every page checks the session: none of it can be prerendered.
export const dynamic = "force-dynamic";

// Sign-in is limited to the university's Google accounts, so the forum labels every member as a student.
const MEMBER_ROLE_LABEL = "Estudiante UNL";

export default async function ForumLayout({ children }: { children: ReactNode }) {
  const member = await getForumMember();

  return (
    <div className="min-h-screen">
      <a href="#main" className="fixed top-[-4rem] left-3 z-100 rounded bg-action px-4 py-2.5 font-bold text-on-action focus:top-3">
        Saltar al contenido
      </a>

      <AppTopBar productName="Foro" homeHref="/foro" homeLabel="Foro de ASO Computación, inicio">
        {member ? (
          <IdentityChip name={member.displayName} roleLabel={MEMBER_ROLE_LABEL} signOut={<SignOutButton />} />
        ) : (
          <ThemeToggle />
        )}
      </AppTopBar>

      {/*
        * A reading column by default (threads, events, the new-thread form). A page marks what it needs inside:
        * `data-wide` for the three-column list, `data-bleed` for the sign-in, which fills the width under the top bar.
        */}
      <main
        id="main"
        className="mx-auto w-full max-w-[62rem] px-4 pt-8 pb-16 sm:px-6 has-[[data-wide]]:max-w-[88rem] has-[[data-bleed]]:max-w-none has-[[data-bleed]]:p-0 has-[[data-bleed]]:sm:px-0"
      >
        {children}
      </main>
    </div>
  );
}
