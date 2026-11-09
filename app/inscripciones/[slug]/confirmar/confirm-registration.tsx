"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { confirmOutcomeMessage, submitConfirmation, type ConfirmMessage } from "@/interface/event-registration/confirm-registration";

import { ArrowGlyph } from "../../_components/ticket-parts";
import { ConfirmResult } from "./confirm-result";

interface ConfirmRegistrationProps {
  slug: string;
  /** The signed token of the email link; the server checks it again on POST. */
  token: string;
  /** The event's `.ics`, offered once the seat is the person's; null when there is nothing to add. */
  calendarHref: string | null;
  /** The registration page, where an expired or unusable link sends the person. */
  formHref: string;
}

/**
 * The button of the confirm page. Opening the link confirms nothing (mail scanners and link previews open every
 * link): the seat is only requested when the person presses this, with a POST. The answer replaces the button.
 */
export function ConfirmRegistration({ slug, token, calendarHref, formHref }: ConfirmRegistrationProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ConfirmMessage | null>(null);
  const sending = useRef(false);
  const resultBox = useRef<HTMLDivElement>(null);
  const done = message !== null && !message.retry;

  // The result takes the focus when it appears: a keyboard user would otherwise never reach it.
  useEffect(() => {
    if (done) resultBox.current?.focus();
  }, [done]);

  async function confirm() {
    if (sending.current) return;

    sending.current = true;
    setPending(true);

    const outcome = await submitConfirmation(slug, token);

    sending.current = false;
    setPending(false);
    setMessage(confirmOutcomeMessage(outcome));

    // The seats on the ticket behind change when the seat is taken, and when it turns out to be gone.
    if (outcome.kind === "confirmed" || outcome.kind === "full") router.refresh();
  }

  if (message && done) {
    return <ConfirmResult message={message} calendarHref={calendarHref} formHref={formHref} boxRef={resultBox} />;
  }

  return (
    <div className="stub-row">
      <div>
        <p className="stub-legend">Un último paso</p>
        <p className="stub-line">Su cupo se reserva al confirmar.</p>
        <p className="stub-text">Pulse el botón para confirmar su correo y reservar su cupo en este evento.</p>
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
        <button type="button" className="ticket-cta" aria-disabled={pending || undefined} onClick={pending ? undefined : confirm}>
          {pending ? "Confirmando…" : "Confirmar mi cupo"}
          {pending ? null : <ArrowGlyph />}
        </button>
      </div>
    </div>
  );
}
