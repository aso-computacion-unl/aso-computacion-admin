"use client";

import { useState, useTransition } from "react";

import { cancelEventRegistration } from "@/interface/event-registration/cancel-registration-action";

import { PassGoogleButton } from "../_components/pass-google-button";

interface CancelOwnRegistrationProps {
  slug: string;
  /** Where the sign-in that comes back to this page starts; null when the Google login is not configured here. */
  signInHref: string | null;
}

/**
 * The registered student lets their own seat go (D7). Asking comes first: one press cannot delete a registration by
 * accident, and on a full event the seat may not come back. On success the page behind refreshes by itself and shows
 * the reserve button again; a refusal is said here, and a gone session (D5) offers the sign-in that returns to this page.
 */
export function CancelOwnRegistration({ slug, signInHref }: CancelOwnRegistrationProps) {
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<{ message: string; sessionExpired: boolean } | null>(null);

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelEventRegistration(slug);

      if (result.error) {
        setError({ message: result.error, sessionExpired: result.sessionExpired === true });
        setAsking(false);
      }
    });
  }

  return (
    <div className="stub-cancel">
      {asking ? (
        <>
          <p className="stub-text">Se liberará su cupo y se borrarán sus datos de este evento. Si el evento se llena, no podrá recuperarlo.</p>
          <div className="stub-cancel-actions">
            <button type="button" className="stub-cancel-button" data-danger aria-disabled={isPending || undefined} onClick={isPending ? undefined : cancel}>
              {isPending ? "Cancelando…" : "Sí, cancelar mi inscripción"}
            </button>
            <button type="button" className="stub-cancel-button" disabled={isPending} onClick={() => setAsking(false)}>
              No, conservarla
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="stub-cancel-button" onClick={() => setAsking(true)}>
          Cancelar mi inscripción
        </button>
      )}
      {error ? (
        <p role="alert" className="ticket-error">
          {error.message}
        </p>
      ) : null}
      {error?.sessionExpired && signInHref ? <PassGoogleButton href={signInHref}>Entrar con Google</PassGoogleButton> : null}
    </div>
  );
}
