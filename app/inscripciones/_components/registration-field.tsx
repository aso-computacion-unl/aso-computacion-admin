import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Label } from "@/components/ui/label";

/** A labelled control with its hint and error wired together, so a screen reader reads them as one field. */
export function RegistrationField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: (describedBy: string | undefined) => ReactNode }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(describedBy)}
      {hint ? (
        <small id={`${id}-hint`} className="text-[0.8125rem] leading-[1.4] text-mist">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] leading-[1.35] font-semibold text-error">
          <Icon name="alert" className="mt-px size-3.5" />
          {error}
        </small>
      ) : null}
    </div>
  );
}
