"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { PHOTOS_SECTION_ID } from "@/interface/admin/events/created-flag";

import { useToast } from "../../_components/toast";

/**
 * Rendered only on the edit page of an event that was just created (`?creado=1`). Creating is not the end of the
 * job, since the photos need an existing event, so it confirms the creation, puts focus on the photo drop zone (the
 * browser scrolls it into view) and drops the flag from the URL: a reload or a shared link must not repeat the toast.
 */
export function EventCreatedArrival() {
  const { notify } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  // Strict Mode runs effects twice in development; the arrival happens once.
  const arrived = useRef(false);

  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;

    notify("Evento creado. Agregue las fotos.");
    document.querySelector<HTMLInputElement>(`#${PHOTOS_SECTION_ID} [data-slot="media-dropzone"] input`)?.focus();
    router.replace(`${pathname}#${PHOTOS_SECTION_ID}`, { scroll: false });
  }, [notify, router, pathname]);

  return null;
}
