"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import type { RegistrationChangeWarning } from "@/interface/admin/events/registration-change";

interface RegistrationChangeDialogProps {
  warning: RegistrationChangeWarning;
  /** Saves the change as it is: the form sends it with the confirmation. */
  onConfirm: () => void;
  onKeepEditing: () => void;
}

/**
 * D14: the question before a save that changes the mode of an event with registered people, or sets seats below them.
 * It sits above the save bar, takes the focus when it opens and gives it back to the button that asked, and Escape keeps
 * editing. Nothing has been sent while it is open.
 */
export function RegistrationChangeDialog({ warning, onConfirm, onKeepEditing }: RegistrationChangeDialogProps) {
  const titleId = useId();
  const detailId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    root.current?.focus();
    root.current?.scrollIntoView?.({ block: "nearest" });

    return () => opener?.focus();
  }, []);

  function handleKeyDown(keyboard: KeyboardEvent<HTMLDivElement>) {
    if (keyboard.key === "Escape") {
      keyboard.preventDefault();
      onKeepEditing();
    }
  }

  return (
    <div
      ref={root}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={detailId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="mt-6 grid gap-3 rounded border-2 border-foreground bg-card p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky"
    >
      <h2 id={titleId} className="text-base font-[650]">
        {warning.title}
      </h2>
      <div id={detailId} className="grid gap-2 text-sm">
        {warning.consequences.map((consequence) => (
          <p key={consequence}>{consequence}</p>
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button type="button" onClick={onConfirm}>
          Guardar el cambio
        </Button>
        <Button type="button" variant="line" onClick={onKeepEditing}>
          Seguir editando
        </Button>
      </div>
    </div>
  );
}
