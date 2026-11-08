import type { ReactNode } from "react";

import { Icon } from "@/components/icons";

/** A labelled control of the pass's tear-off with its hint and error wired together, so a screen reader reads them as one field. */
export function RegistrationField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: (describedBy: string | undefined) => ReactNode }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="stub-field">
      <label htmlFor={id} className="ticket-label">
        {label}
      </label>
      {children(describedBy)}
      {hint ? (
        <small id={`${id}-hint`} className="stub-note">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={`${id}-error`} role="alert" className="ticket-error">
          <Icon name="alert" className="size-3.5" />
          {error}
        </small>
      ) : null}
    </div>
  );
}
