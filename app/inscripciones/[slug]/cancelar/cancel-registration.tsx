"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { cancelOutcomeMessage, submitCancellation, type CancelMessage } from "@/interface/event-registration/cancel-registration";

import { ArrowGlyph } from "../../_components/ticket-parts";
import { CancelResult } from "./cancel-result";

interface CancelRegistrationProps {
  slug: string;
  /** The signed token of the email link; the server checks it again on POST. */
  token: string;
  /** The event's registration page, where the person can look again or register anew. */
  eventHref: string;
}

/**
 * The button of the cancel page. Opening the link cancels nothing (mail scanners and link previews open every link):
 * the registration is only deleted when the person presses this, with a POST. The answer replaces the button, unless it
 * is a failure worth trying again.
 */
export function CancelRegistration({ slug, token, eventHref }: CancelRegistrationProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<CancelMessage | null>(null);
  const sending = useRef(false);
  const resultBox = useRef<HTMLDivElement>(null);
  const done = message !== null && !message.retry;

  // The result takes the focus when it appears: a keyboard user would otherwise never reach it.
  useEffect(() => {
    if (done) resultBox.current?.focus();
  }, [done]);

  async function cancel() {
    if (sending.current) return;

    sending.current = true;
    setPending(true);

    const outcome = await submitCancellation(slug, token);

    sending.current = false;
    setPending(false);
    setMessage(cancelOutcomeMessage(outcome));

    // The seats on the ticket behind change when the seat is freed.
    if (outcome.kind === "cancelled") router.refresh();
  }

  if (message && done) {
    return <CancelResult message={message} eventHref={eventHref} boxRef={resultBox} />;
  }

  return (
    <div className="stub-row">
      <div>
        <p className="stub-legend">Cancelar inscripción</p>
        <p className="stub-line">¿Ya no puede asistir?</p>
        <p className="stub-text">Al cancelar se libera su cupo y se borran sus datos de este evento.</p>
        {message ? (
          <div role="alert" className="stub-alert">
            <Icon name="alert" className="size-4" />
            <p>
              <strong>{message.title}.</strong> {message.detail}
            </p>
          </div>
        ) : null}
      </div>
      <div className="stub-actions">
        <button type="button" className="ticket-cta" aria-disabled={pending || undefined} onClick={pending ? undefined : cancel}>
          {pending ? "Cancelando…" : "Cancelar mi inscripción"}
          {pending ? null : <ArrowGlyph />}
        </button>
      </div>
    </div>
  );
}
