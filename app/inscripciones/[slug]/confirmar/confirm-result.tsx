import type { Ref } from "react";

import type { ConfirmMessage } from "@/interface/event-registration/confirm-registration";

import { ArrowGlyph, CalendarLink, CheckMark } from "../../_components/ticket-parts";

/** What happened to the confirmation, in the tear-off: the reserved seat with its calendar, or why not and where to go next. */
export function ConfirmResult({ message, calendarHref, formHref, boxRef }: { message: ConfirmMessage; calendarHref: string | null; formHref: string; boxRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={boxRef} role="status" tabIndex={-1} className="stub-done">
      {message.reserved ? <CheckMark /> : null}
      <div>
        <h2 className="stub-title">{message.title}</h2>
        <p className="stub-text">{message.detail}</p>
      </div>
      {message.reserved && calendarHref ? (
        <div className="stub-actions">
          <CalendarLink href={calendarHref} />
        </div>
      ) : null}
      {message.backToForm ? (
        <div className="stub-actions">
          <a href={formHref} className="ticket-cta">
            Volver al formulario
            <ArrowGlyph />
          </a>
        </div>
      ) : null}
    </div>
  );
}
