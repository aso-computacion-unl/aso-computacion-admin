"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { registrationsPanelPath } from "@/interface/admin/event-registrations/saved-flag";

import { useToast } from "../../_components/toast";

/**
 * Rendered only on the panel right after a registration was created (`?guardada=1`): it confirms the save once and
 * drops the flag from the URL, keeping the event selected, so a reload or a shared link does not repeat the toast.
 */
export function RegistrationSavedArrival({ eventId }: { eventId: string }) {
  const { notify } = useToast();
  const router = useRouter();
  // Strict Mode runs effects twice in development; the arrival happens once.
  const arrived = useRef(false);

  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;

    notify("Inscripción creada.");
    router.replace(registrationsPanelPath(eventId), { scroll: false });
  }, [notify, router, eventId]);

  return null;
}
