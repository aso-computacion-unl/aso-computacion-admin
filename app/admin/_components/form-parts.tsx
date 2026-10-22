"use client";

import { useId, type ReactNode } from "react";

import type { ActionResult } from "@/interface/admin/action-result";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

/** Label, control, hint and error wired together with ids so screen readers read them as one field. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <p className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      ) : null}
    </p>
  );
}

/** Whole-form outcome: a general error, a form-level field error (unknown fields) or the saved notice. */
export function FormFeedback({ state }: { state: ActionResult | null }) {
  const message = state?.error ?? state?.fieldErrors?.form;

  return (
    <div aria-live="polite">
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      {state?.success ? <p role="status">Cambios guardados.</p> : null}
    </div>
  );
}
