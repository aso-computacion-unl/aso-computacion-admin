"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/interface/admin/action-result";

import { useToast } from "./toast";
import { useHasUnsavedChanges } from "./use-controlled-form";

const SAVED_MESSAGE = "Cambios guardados.";

interface FieldProps {
  label: string;
  hint?: string;
  /**
   * Help behind a small "?" next to the label: it is not on the page until asked for. The "?" is called "Ayuda"
   * and described by the label, never named after it: a second control whose name carries the label's text
   * would make the field ambiguous (`getByLabel`, voice control).
   */
  help?: string;
  /** The text typed and its limit; the count shows only near the limit. */
  count?: { length: number; max: number };
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

/** A count of characters stays out of sight until it is 80% of the limit. */
const COUNT_FROM = 0.8;

/** Label, control, hint and error wired together with ids so screen readers read them as one field. */
export function Field({ label, hint, help, count, error, className, children }: FieldProps) {
  const id = useId();
  const [helpOpen, setHelpOpen] = useState(false);
  const describedBy = [hint && `${id}-hint`, helpOpen && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const showCount = count !== undefined && count.length >= count.max * COUNT_FROM;

  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      {help || count ? (
        <div className="flex items-center gap-2">
          <Label id={`${id}-label`} htmlFor={id}>{label}</Label>
          {help ? (
            <button
              type="button"
              aria-label="Ayuda"
              aria-describedby={`${id}-label`}
              aria-expanded={helpOpen}
              aria-controls={`${id}-help`}
              onClick={() => setHelpOpen((open) => !open)}
              className="grid size-6 place-items-center rounded-full border border-input text-xs leading-none font-bold text-mist hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky aria-expanded:bg-muted aria-expanded:text-foreground"
            >
              ?
            </button>
          ) : null}
          {showCount ? <span className="ml-auto font-mono text-[0.8125rem] text-mist">{count.length} / {count.max}</span> : null}
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {help ? (
        <p id={`${id}-help`} hidden={!helpOpen} className="text-[0.8125rem] leading-[1.4] text-mist">
          {help}
        </p>
      ) : null}
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
 * when the form already confirms the save its own way, and `savedMessage` for a save that says more (publishing).
 */
export function FormFeedback({ state, toast = true, savedMessage = SAVED_MESSAGE }: { state: ActionResult | null; toast?: boolean; savedMessage?: string }) {
  const { notify } = useToast();

  // Each submit hands back a new result object, so saving the same form twice toasts twice.
  useEffect(() => {
    if (toast && state?.success) notify(savedMessage);
  }, [state, toast, savedMessage, notify]);

  return (
    <div data-slot="form-feedback" className="min-w-0 text-sm">
      <FormFailure state={state} />
      {state?.success ? (
        <p className="flex items-center gap-2 font-semibold text-sky">
          <Icon name="check" className="size-4 stroke-[2.25]" />
          {savedMessage}
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

/**
 * The "back" link of a page header. With unsaved changes in a form on the page it asks first, in the page
 * like the bulk actions do: the safe choice ("Seguir editando") has the focus and gives it back to the link.
 */
export function GuardedBackLink({ href, children }: { href: string; children: ReactNode }) {
  const unsaved = useHasUnsavedChanges();
  const [asking, setAsking] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  // Saving, or putting the text back, leaves nothing to ask about.
  if (asking && !unsaved) setAsking(false);

  return (
    <>
      <Link
        ref={link}
        href={href}
        onClick={(event) => {
          if (!unsaved) return;

          event.preventDefault();
          setAsking(true);
        }}
        className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded px-1 text-sm font-semibold text-mist transition-colors duration-150 ease-out hover:text-foreground"
      >
        <Icon name="left" className="size-4" />
        {children}
      </Link>
      {asking ? (
        <div role="group" aria-label="Confirmar: salir sin guardar" className="mt-2 grid gap-3 rounded bg-muted p-3 text-sm">
          <p>Tiene cambios sin guardar. Si sale ahora, se perderán.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="line"
              size="sm"
              autoFocus
              onClick={() => {
                setAsking(false);
                link.current?.focus();
              }}
            >
              Seguir editando
            </Button>
            <Button asChild variant="danger" size="sm">
              <Link href={href}>Salir sin guardar</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
