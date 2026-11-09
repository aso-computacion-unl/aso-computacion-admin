"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { signOutOfForum } from "@/interface/forum/forum-posting";

import { clearForumDrafts } from "./forum-drafts";

/** The identity menu's sign-out row: ends the forum session on the server, then shows the landing as a visitor. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await signOutOfForum();
      // What was being written stays in this tab: it must not be there for the next person to sign in.
      clearForumDrafts();
      router.replace("/foro");
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
