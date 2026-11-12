"use client";

import { useState, useTransition } from "react";

import { registerForEvent } from "@/interface/forum/event-registration";

import { PassGoogleButton } from "../_components/pass-google-button";
import { ArrowGlyph } from "../_components/ticket-parts";

interface RegisterButtonProps {
  slug: string;
  /** Where the sign-in that comes back to this page starts; null when the Google login is not configured here. */
  signInHref: string | null;
}

/**
 * Registers the signed-in member and says what happened; the page behind it refreshes by itself on success. When the
 * session is gone (D5) the message is the registration's and, where the login works, the way back in is offered
 * right under it: it returns to this same event page.
 */
export function RegisterButton({ slug, signInHref }: RegisterButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{ message: string; sessionExpired: boolean } | null>(null);

  function register() {
    setError(null);
    startTransition(async () => {
      const result = await registerForEvent(slug);

      if (result.error) setError({ message: result.error, sessionExpired: result.sessionExpired === true });
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
          {error.message}
        </p>
      ) : null}
      {error?.sessionExpired && signInHref ? <PassGoogleButton href={signInHref}>Entrar con Google</PassGoogleButton> : null}
    </div>
  );
}
