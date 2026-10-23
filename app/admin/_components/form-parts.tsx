"use client";

import { useId, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/interface/admin/action-result";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Grid span classes, e.g. `md:col-span-2`. */
  className?: string;
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <small id={id} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] leading-[1.35] font-semibold text-error">
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
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

/** A titled group of fields. */
export function FormSection({ legend, children, className }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className="min-w-0 border-0 p-0 [&+&]:mt-8">
      <legend className="mb-4 w-full border-b border-border pb-2 text-lg font-bold font-stretch-[112%]">{legend}</legend>
      <div className={cn("grid gap-x-4 gap-y-5 md:grid-cols-2", className)}>{children}</div>
    </fieldset>
  );
}

/** Whole-form outcome: a general error, a form-level field error (unknown fields) or the saved notice. */
export function FormFeedback({ state }: { state: ActionResult | null }) {
  const message = state?.error ?? state?.fieldErrors?.form;

  return (
    <div aria-live="polite" className="min-w-0 text-sm">
      {message ? <FieldError>{message}</FieldError> : null}
      {state?.success ? (
        <p role="status" className="flex items-center gap-2 font-semibold text-sky">
          <Icon name="check" className="size-4 stroke-[2.25]" />
          Cambios guardados.
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
    <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-5 -mx-4 mt-4 grid gap-3 bg-muted px-4 py-3.5 shadow-[0_-1px_0_var(--color-border)] md:-mx-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6 md:px-5 lg:bottom-0 lg:-mb-5 lg:rounded-b">
      {status}
      <div className="flex flex-wrap justify-end gap-2 [&>*]:flex-1 md:[&>*]:flex-none">{children}</div>
    </div>
  );
}
