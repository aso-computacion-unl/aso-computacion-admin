"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import { toFormData } from "@/interface/admin/form-fields";
import type { ForumActionResult } from "@/interface/forum/forum-action-result";

type ForumAction = (prevState: ForumActionResult | null, formData: FormData) => Promise<ForumActionResult>;

const UNEXPECTED: ForumActionResult = { error: "Ocurrió un error inesperado. Intente nuevamente." };

/**
 * Keeps the values in state and submits them by hand through `startTransition`, never through
 * `<form action>`: React 19 empties uncontrolled fields after a form action settles, which would wipe a
 * long post when the server refuses it. A rejected call (network) becomes an error result instead of
 * unmounting the form.
 */
export function useForumForm<V extends Record<string, string>>(action: ForumAction, initialValues: V) {
  const [values, setValues] = useState<V>(initialValues);
  const [state, formAction, pending] = useActionState<ForumActionResult | null, FormData>(async (previous, formData) => {
    try {
      return await action(previous, formData);
    } catch {
      return UNEXPECTED;
    }
  }, null);

  function setValue(key: keyof V & string, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    startTransition(() => formAction(toFormData(values)));
  }

  return { values, setValue, reset: () => setValues(initialValues), handleSubmit, state, pending, errors: state?.fieldErrors ?? {} };
}
