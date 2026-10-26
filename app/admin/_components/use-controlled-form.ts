"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import type { ActionResult } from "@/interface/admin/action-result";
import { toFormData } from "@/interface/admin/form-fields";

type FormAction = (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type StringKeys<V> = { [K in keyof V]: V[K] extends string ? K : never }[keyof V] & string;
type BooleanKeys<V> = { [K in keyof V]: V[K] extends boolean ? K : never }[keyof V] & string;

/**
 * Keeps the form values in state and submits them by hand through
 * `startTransition`, never through `<form action>`: React 19 empties
 * uncontrolled fields after a form action settles, which would wipe what the
 * owner typed when a save fails.
 */
export function useControlledForm<V extends { [K in keyof V]: string | boolean }>(action: FormAction, initialValues: V) {
  const [values, setValues] = useState<V>(initialValues);
  const [state, formAction, isPending] = useActionState(action, null);

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

    startTransition(() => formAction(toFormData(values as Record<string, string | boolean>)));
  }

  /** Back to the initial values, e.g. after a form that adds one more row saved. */
  function reset() {
    setValues(initialValues);
  }

  return { bind, toggle, handleSubmit, reset, state, isPending, errors: state?.fieldErrors ?? {} };
}
