"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { signOutOfForum } from "@/interface/forum/forum-posting";

import { clearForumDrafts } from "../foro/_components/forum-drafts";

/**
 * The identity menu's sign-out row: ends the forum session on the server, then shows `returnTo` as a visitor: the
 * forum's landing, or the list of registrations, whose header signs out the same member session (S2).
 */
export function SignOutButton({ returnTo = "/foro" }: { returnTo?: "/foro" | "/inscripciones" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      try {
        await signOutOfForum();
      } finally {
        // What was being written stays in this tab: it must not be there for the next person to sign in, even if the call failed.
        clearForumDrafts();
      }
      router.replace(returnTo);
      router.refresh();
    });
  }

  return (
    <Button variant="quiet" busy={pending} onClick={signOut} className="w-full justify-start">
      <Icon name="out" />
      Cerrar sesión
    </Button>
  );
}
