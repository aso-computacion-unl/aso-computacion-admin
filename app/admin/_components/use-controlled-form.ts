"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

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
}

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

/** After a failed submit, moves the focus to the first invalid field of the form, in page order. */
export function useFocusFirstInvalid(result: ActionResult | null, formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const failed = Object.keys(result?.fieldErrors ?? {}).some((name) => name !== "form");

    if (!failed) return;

    for (const field of formRef.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? []) {
      field.focus();
      if (document.activeElement === field) return;
    }
  }, [result, formRef]);
}

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
  const state = clientCheck && clientCheck.over === serverState ? clientCheck.result : serverState;

  useFocusFirstInvalid(state, formRef);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    formRef.current = event.currentTarget;

    const fieldErrors = collectFieldErrors(event.currentTarget, options.fieldMessages);
    const invalid = Object.keys(fieldErrors).length > 0;

    // Passing the check clears what the last submit left on screen while this one is on its way.
    setClientCheck({ result: invalid ? { fieldErrors } : {}, over: serverState });
    if (invalid) return;

    startTransition(() => formAction((options.serialize ?? toFormData)(values)));
  }

  /** Back to the initial values, e.g. after a form that adds one more row saved. */
  function reset() {
    setValues(initialValues);
  }

  return { values, bind, toggle, handleSubmit, reset, setValues, state, isPending, errors: state?.fieldErrors ?? {} };
}
