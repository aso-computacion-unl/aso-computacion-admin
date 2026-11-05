"use client";

import { useEffect, useId, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/interface/admin/action-result";

import { useToast } from "./toast";

const SAVED_MESSAGE = "Cambios guardados.";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Grid span classes, e.g. `@xl:col-span-2` (container query of the enclosing Panel). */
  className?: string;
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

/**
 * A message in the error style. It is an alert unless `announce={false}`: a field's own error is read with
 * its field (`aria-describedby`) and the whole failure is announced once by the form's summary
 * (`FormFailure`), so a form with several invalid fields does not read them all out at once.
 */
export function FieldError({ id, announce = true, children }: { id?: string; announce?: boolean; children: ReactNode }) {
  return (
    <small id={id} role={announce ? "alert" : undefined} className="flex items-start gap-1.5 text-[0.8125rem] leading-[1.35] font-semibold text-error">
      <Icon name="alert" className="mt-px size-3.5" />
      {children}
    </small>
  );
}

/** Label, control, hint and error wired together with ids so screen readers read them as one field. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <small id={`${id}-hint`} className="text-[0.8125rem] leading-[1.4] text-mist">
          {hint}
        </small>
      ) : null}
      {error ? (
        <FieldError id={`${id}-error`} announce={false}>
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}

/** A titled group of fields. */
export function FormSection({ legend, children, className }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className="min-w-0 border-0 p-0 [&+&]:mt-8">
      <legend className="mb-4 w-full border-b border-border pb-2 text-lg font-bold font-stretch-[112%]">{legend}</legend>
      <div className={cn("grid gap-x-4 gap-y-5 @xl:grid-cols-2", className)}>{children}</div>
    </fieldset>
  );
}

const reviewMessage = (count: number) => `Revise ${count} ${count === 1 ? "campo" : "campos"}.`;

/**
 * The failure of a save as one announcement: the general error, a form-level error, and how many fields to
 * review. The field errors themselves sit next to their fields and are not alerts, so the screen reader hears
 * this line once, then the first invalid field when the focus moves to it.
 */
export function FormFailure({ state }: { state: ActionResult | null }) {
  const fieldCount = Object.keys(state?.fieldErrors ?? {}).filter((name) => name !== "form").length;
  const message = [state?.error ?? state?.fieldErrors?.form, fieldCount > 0 ? reviewMessage(fieldCount) : undefined].filter(Boolean).join(" ");

  return message ? <FieldError>{message}</FieldError> : null;
}

/**
 * Whole-form outcome: the failure summary (`FormFailure`) or the saved notice.
 * A save also shows a toast, which is easier to notice than the line next to the button; the toast
 * is the one screen readers announce, so the line is not a live region too. Pass `toast={false}`
 * when the form already confirms the save its own way.
 */
export function FormFeedback({ state, toast = true }: { state: ActionResult | null; toast?: boolean }) {
  const { notify } = useToast();

  // Each submit hands back a new result object, so saving the same form twice toasts twice.
  useEffect(() => {
    if (toast && state?.success) notify(SAVED_MESSAGE);
  }, [state, toast, notify]);

  return (
    <div data-slot="form-feedback" className="min-w-0 text-sm">
      <FormFailure state={state} />
      {state?.success ? (
        <p className="flex items-center gap-2 font-semibold text-sky">
          <Icon name="check" className="size-4 stroke-[2.25]" />
          {SAVED_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The save bar stays at the bottom of the screen (above the tab bar on a phone) so the
 * button is always one tap away, however long the form is.
 */
export function ActionBar({ status, children }: { status: ReactNode; children: ReactNode }) {
  return (
    <div data-slot="action-bar" className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-5 -mx-4 mt-4 grid gap-3 bg-muted px-4 py-3.5 shadow-[0_-1px_0_var(--color-border)] md:-mx-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6 md:px-5 lg:bottom-0 lg:-mb-5 lg:rounded-b">
      {status}
      <div className="flex flex-wrap justify-end gap-2 [&>*]:flex-1 md:[&>*]:flex-none">{children}</div>
    </div>
  );
}
