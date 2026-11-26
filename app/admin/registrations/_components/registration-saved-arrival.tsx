"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useToast } from "../../_components/toast";

/**
 * Rendered only on the panel right after a registration was created or turned off (`?guardada=…`): it confirms the save
 * once and replaces the URL with `path`, without the flag, so a reload or a shared link does not repeat the toast.
 */
export function RegistrationSavedArrival({ message, path }: { message: string; path: string }) {
  const { notify } = useToast();
  const router = useRouter();
  // Strict Mode runs effects twice in development; the arrival happens once.
  const arrived = useRef(false);

  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;

    notify(message);
    router.replace(path, { scroll: false });
  }, [notify, router, message, path]);

  return null;
}
