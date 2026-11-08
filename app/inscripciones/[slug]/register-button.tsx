"use client";

import { useState, useTransition } from "react";

import { registerForEvent } from "@/interface/forum/event-registration";

import { ArrowGlyph } from "../_components/ticket-parts";

/** Registers the signed-in member and says what happened; the page behind it refreshes by itself on success. */
export function RegisterButton({ slug }: { slug: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function register() {
    setError(null);
    startTransition(async () => {
      const result = await registerForEvent(slug);

      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="stub-actions">
      <button type="button" className="ticket-cta" aria-disabled={isPending || undefined} onClick={isPending ? undefined : register}>
        {isPending ? "Reservando…" : "Reservar mi cupo"}
        {isPending ? null : <ArrowGlyph />}
      </button>
      {error ? (
        <p role="alert" className="ticket-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
