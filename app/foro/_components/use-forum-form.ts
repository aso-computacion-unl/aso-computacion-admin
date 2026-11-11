"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { toFormData } from "@/interface/admin/form-fields";
import type { ForumActionResult } from "@/interface/forum/forum-action-result";

import { clearDraft, readDraft, writeDraft } from "./forum-drafts";

type ForumAction = (prevState: ForumActionResult | null, formData: FormData) => Promise<ForumActionResult>;

const UNEXPECTED: ForumActionResult = { error: "Ocurrió un error inesperado. Intente nuevamente." };

/**
 * Keeps the values in state and submits them by hand through `startTransition`, never through
 * `<form action>`: React 19 empties uncontrolled fields after a form action settles, which would wipe a
 * long post when the server refuses it. A rejected call (network) becomes an error result instead of
 * unmounting the form.
 *
 * With a `draft` (its key and the member who is writing) what is typed is also kept in this tab (see `forum-drafts`)
 * and given back to that member when the form is opened again, so a session that ended while writing costs no
 * text; a published post forgets it.
 */
export function useForumForm<V extends Record<string, string>>(action: ForumAction, initialValues: V, draft?: { key: string; memberId: string }) {
  const draftKey = draft?.key;
  const memberId = draft?.memberId ?? null;
  const [values, setValues] = useState<V>(initialValues);
  const current = useRef(initialValues);
  const [state, formAction, pending] = useActionState<ForumActionResult | null, FormData>(async (previous, formData) => {
    try {
      return await action(previous, formData);
    } catch {
      return UNEXPECTED;
    }
  }, null);

  // After the first render, not in the initial state: the server render has no storage, and both must match.
  useEffect(() => {
    const saved = draftKey ? readDraft<V>(draftKey, Object.keys(initialValues), memberId) : null;

    if (saved) {
      current.current = saved;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage can only be read once the page is hydrated
      setValues(saved);
    }
    // Only when the form opens: `initialValues` is the constant the caller passes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, memberId]);

  useEffect(() => {
    if (state?.success && draftKey) clearDraft(draftKey);
  }, [state, draftKey]);

  function setValue(key: keyof V & string, value: string) {
    current.current = { ...current.current, [key]: value };
    setValues(current.current);
    if (draftKey) writeDraft(draftKey, memberId, current.current);
  }

  function reset() {
    current.current = initialValues;
    setValues(initialValues);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    startTransition(() => formAction(toFormData(values)));
  }

  return { values, setValue, reset, handleSubmit, state, pending, errors: state?.fieldErrors ?? {} };
}
