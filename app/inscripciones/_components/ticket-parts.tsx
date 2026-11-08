import type { ReactNode } from "react";

/** The calendar glyph of the pass's buttons (the shared icon set has none), drawn on the same 22px grid as the arrow. */
export function CalendarGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="16" height="15" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h16M7 2v4M15 2v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ArrowGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <path d="M3 11h15M12 5l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function CheckMark() {
  return (
    <span className="stub-okmark" aria-hidden="true">
      <svg viewBox="0 0 34 34" focusable="false">
        <path d="M7 18l7 7 13-14" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
    </span>
  );
}

/** "Añadir al calendario": the event's public `.ics`. */
export function CalendarLink({ href }: { href: string }) {
  return (
    <a href={href} className="ticket-calendar">
      <CalendarGlyph />
      Añadir al calendario
    </a>
  );
}

/** The person is in: the mark, what to do next, and the event's calendar file when there is one. */
export function StubDone({ title, children, calendarHref }: { title: string; children: ReactNode; calendarHref: string | null }) {
  return (
    <div role="status" className="stub-done">
      <CheckMark />
      <div>
        <h2 className="stub-title">{title}</h2>
        <p className="stub-text">{children}</p>
      </div>
      {calendarHref ? (
        <div className="stub-actions">
          <CalendarLink href={calendarHref} />
        </div>
      ) : null}
    </div>
  );
}
