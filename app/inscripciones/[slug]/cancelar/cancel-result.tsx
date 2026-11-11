import type { Ref } from "react";

import type { CancelMessage } from "@/interface/event-registration/cancel-registration";

import { ArrowGlyph } from "../../_components/ticket-parts";

/** What happened to the cancellation, in the tear-off: the reason, and where to go next when the person can still act. */
export function CancelResult({ message, eventHref, boxRef }: { message: CancelMessage; eventHref: string; boxRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={boxRef} role="status" tabIndex={-1} className="stub-done">
      <div>
        <h2 className="stub-title">{message.title}</h2>
        <p className="stub-text">{message.detail}</p>
      </div>
      {message.backToEvent ? (
        <div className="stub-actions">
          <a href={eventHref} className="ticket-cta">
            Ver el evento
            <ArrowGlyph />
          </a>
        </div>
      ) : null}
    </div>
  );
}
