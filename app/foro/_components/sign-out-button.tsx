"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { signOutOfForum } from "@/interface/forum/forum-posting";

/** Ends the forum session on the server, then shows the landing as a visitor. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await signOutOfForum();
      router.replace("/foro");
      router.refresh();
    });
  }

  return (
    <Button variant="quiet" size="sm" busy={pending} onClick={signOut} aria-label="Cerrar sesión">
      <Icon name="out" className="size-4.5" />
      <span className="hidden sm:inline">Cerrar sesión</span>
    </Button>
  );
}
