"use client";

import { startTransition, useActionState, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type FormEvent, type RefObject } from "react";

import type { ActionResult } from "@/interface/admin/action-result";
import { fieldMessage } from "@/interface/admin/field-messages";
import { toFormData } from "@/interface/admin/form-fields";

type FormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type StringKeys<V> = { [K in keyof V]: V[K] extends string ? K : never }[keyof V] & string;
type BooleanKeys<V> = { [K in keyof V]: V[K] extends boolean ? K : never }[keyof V] & string;

interface ControlledFormOptions<V> {
  /** The entity's own field texts where its limits differ from the shared ones: the same object its server actions use. */
  fieldMessages?: Record<string, string>;
  /** How the values travel; the default sends text as is and only checked boxes as `on`. */
  serialize?: (values: V) => FormData;
  /**
   * Saves an unpublished draft by itself once the typing stops. Only an edit page turns it on: a create page
   * would create a row, and a published item is never saved before "Sí, publicar". It runs only while both the
   * stored item and the form are drafts (`isPublished` false), through the same action as the button.
   */
  autosave?: boolean;
}

/** Quiet time after the last keystroke before a draft is saved. */
export const AUTOSAVE_DELAY_MS = 1800;
const AUTOSAVE_FAILED_MESSAGE = "No se pudo guardar. Use el botón.";

/** What the save status shows: nothing for a form that does not autosave, nothing while a save is only waiting for the typing to stop. */
export interface AutosaveStatus {
  enabled: boolean;
  phase: "idle" | "saving" | "saved" | "failed";
  /** With `failed`: the line to show. */
  message?: string;
}

type AutosaveOutcome = { phase: "idle" | "saving" | "saved" } | { phase: "failed"; message: string; values: object };

const isDraft = (values: object) => (values as { isPublished?: unknown }).isPublished === false;

const NOT_CHECKED_HERE = new Set(["checkbox", "radio", "hidden", "file", "button", "submit", "reset", "image"]);

/**
 * Asks the browser which fields of a form break their own constraints (`required`, `type="url"` and so on)
 * and answers with the same Spanish text the server uses for each field. A field of only spaces counts as
 * empty, as it does on the server. This is what lets a form show every invalid field at once: the domain
 * rules behind the server stop at the first one they find.
 */
export function collectFieldErrors(form: HTMLFormElement, fieldMessages?: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
    if (!element.name || element.name in errors || !element.willValidate) continue;
    if (element instanceof HTMLInputElement && NOT_CHECKED_HERE.has(element.type)) continue;

    if ((element.required && element.value.trim() === "") || !element.validity.valid) {
      errors[element.name] = fieldMessage(element.name, fieldMessages);
    }
  }

  return errors;
}

const FOCUSABLE = "input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)";

/** After a failed submit, moves the focus to the first invalid field of the form, in page order. */
export function useFocusFirstInvalid(result: ActionResult | null, formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const failed = Object.keys(result?.fieldErrors ?? {}).some((name) => name !== "form");

    if (!failed) return;

    for (const field of formRef.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? []) {
      // A group (a radio fieldset) cannot take the focus: its checked option does, else its first enabled control.
      const target = field.matches(FOCUSABLE) ? field : (field.querySelector<HTMLElement>("input:checked:not(:disabled)") ?? field.querySelector<HTMLElement>(FOCUSABLE) ?? field);

      target.focus();
      if (document.activeElement === target) return;
    }
  }, [result, formRef]);
}

// Which forms on the page hold changes that were never saved: the back link asks before it leaves while any does.
const unsavedForms = new Set<symbol>();
const unsavedListeners = new Set<() => void>();

function announceUnsavedChange() {
  for (const listener of unsavedListeners) listener();
}

/**
 * While `dirty`, the browser asks before the tab closes or reloads, and `useHasUnsavedChanges` says so to the
 * rest of the page (the back link). It does not catch a click on another in-app link: only the back link asks.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const form = Symbol("unsaved form");
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    unsavedForms.add(form);
    announceUnsavedChange();
    window.addEventListener("beforeunload", warn);

    return () => {
      unsavedForms.delete(form);
      announceUnsavedChange();
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
}

export function useHasUnsavedChanges(): boolean {
  return useSyncExternalStore(
    (listener) => {
      unsavedListeners.add(listener);

      return () => unsavedListeners.delete(listener);
    },
    () => unsavedForms.size > 0,
    () => false,
  );
}

const differs = <V extends object>(a: V, b: V) => (Object.keys(a) as (keyof V)[]).some((key) => a[key] !== b[key]);

/**
 * Keeps the form values in state and submits them by hand through
 * `startTransition`, never through `<form action>`: React 19 empties
 * uncontrolled fields after a form action settles, which would wipe what the
 * owner typed when a save fails.
 *
 * Before it submits, it checks the browser's own constraints and, when some fail, shows all of them at once
 * without a round trip. `state` is the outcome to show: that check's, else the server's.
 */
export function useControlledForm<V extends { [K in keyof V]: string | boolean }>(action: FormAction, initialValues: V, options: ControlledFormOptions<V> = {}) {
  const [values, setValues] = useState<V>(initialValues);
  const [serverState, formAction, isPending] = useActionState(action, null);
  // The browser check's outcome lasts until the server answers a later submit, which replaces it.
  const [clientCheck, setClientCheck] = useState<{ result: ActionResult; over: ActionResult | null } | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // What the server last stored, to tell a form with unsaved changes from one the owner only opened.
  const [stored, setStored] = useState(initialValues);
  const [submitted, setSubmitted] = useState(initialValues);
  const [answered, setAnswered] = useState(serverState);
  const state = clientCheck && clientCheck.over === serverState ? clientCheck.result : serverState;

  const dirty = differs(values, stored);
  const [outcome, setOutcome] = useState<AutosaveOutcome>({ phase: "idle" });
  // Bumped by every save by hand: an autosave that was already out then finds a newer save was made and leaves `stored` alone.
  const saves = useRef(0);
  const autosaving = options.autosave === true && isDraft(stored) && isDraft(values);

  useFocusFirstInvalid(state, formRef);
  useUnsavedChangesGuard(dirty);

  // A save the server accepted makes what was submitted the stored text.
  if (answered !== serverState) {
    setAnswered(serverState);
    if (serverState?.success) setStored(submitted);
  }

  // One request at a time: while one is out, or the button's save is, nothing is scheduled; when it ends, the effect
  // runs again and schedules whatever was typed meanwhile. A failed save is not retried until the owner edits again.
  const saveDraft = useEffectEvent(async (snapshot: V) => {
    const form = formRef.current;

    // Nothing is shown for a form that is not valid yet: it simply is not saved.
    if (!form || Object.keys(collectFieldErrors(form, options.fieldMessages)).length > 0) return;

    const ticket = saves.current;
    let result: ActionResult;

    setOutcome({ phase: "saving" });
    try {
      result = await action(null, (options.serialize ?? toFormData)(snapshot));
    } catch {
      result = { error: AUTOSAVE_FAILED_MESSAGE };
    }

    if (ticket !== saves.current) return;
    if (result.success) {
      setStored(snapshot);
      setOutcome({ phase: "saved" });
    } else {
      setOutcome({ phase: "failed", message: result.error ?? AUTOSAVE_FAILED_MESSAGE, values: snapshot });
    }
  });

  const waiting = autosaving && dirty && outcome.phase !== "saving" && !isPending && !(outcome.phase === "failed" && outcome.values === values);

  useEffect(() => {
    if (!waiting) return;

    const timer = setTimeout(() => void saveDraft(values), AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [waiting, values]);

  // What was saved or refused says nothing about text typed since.
  const stale = (outcome.phase === "saved" && dirty) || (outcome.phase === "failed" && outcome.values !== values);
  const autosaveStatus: AutosaveStatus = {
    enabled: options.autosave === true,
    phase: stale ? "idle" : outcome.phase,
    message: outcome.phase === "failed" ? outcome.message : undefined,
  };

  function bind<K extends StringKeys<V>>(key: K) {
    return {
      name: key,
      value: values[key] as string,
      onChange: (event: { target: { value: string } }) =>
        setValues((previous) => ({ ...previous, [key]: event.target.value })),
    };
  }

  function toggle<K extends BooleanKeys<V>>(key: K) {
    return {
      name: key,
      checked: values[key] as boolean,
      onChange: () => setValues((previous) => ({ ...previous, [key]: !previous[key] })),
    };
  }

  /** Runs the browser check and shows every field that fails; true when all pass. Nothing is sent. */
  function review(event: FormEvent<HTMLFormElement>): boolean {
    event.preventDefault();
    if (isPending) return false;

    formRef.current = event.currentTarget;

    const fieldErrors = collectFieldErrors(event.currentTarget, options.fieldMessages);
    const invalid = Object.keys(fieldErrors).length > 0;

    // Passing the check clears what the last submit left on screen while this one is on its way.
    setClientCheck({ result: invalid ? { fieldErrors } : {}, over: serverState });

    return !invalid;
  }

  /** Sends the current values as they are: the caller has already passed `review`. */
  function submit() {
    saves.current += 1;
    setOutcome({ phase: "idle" });
    setSubmitted(values);
    startTransition(() => formAction((options.serialize ?? toFormData)(values)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (review(event)) submit();
  }

  /** Back to the initial values, e.g. after a form that adds one more row saved. */
  function reset() {
    setValues(initialValues);
    setStored(initialValues);
  }

  return { values, stored, bind, toggle, handleSubmit, review, submit, reset, setValues, state, isPending, errors: state?.fieldErrors ?? {}, formRef, autosaveStatus };
}
