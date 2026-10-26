"use client";

import { useState, useTransition } from "react";

import type { ForumActionResult } from "@/interface/forum/forum-action-result";

const UNEXPECTED = "Ocurrió un error inesperado. Intente nuevamente.";

/**
 * Runs a forum server action from a button, outside a form. A rejected call (network) becomes the
 * generic message instead of unmounting the control; `error` is the last refusal, cleared by the next run.
 */
export function useInlineAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function run(action: () => Promise<ForumActionResult>, onResult: (result: ForumActionResult) => void) {
    if (pending) return;

    setError(undefined);
    startTransition(async () => {
      let result: ForumActionResult;

      try {
        result = await action();
      } catch {
        result = { error: UNEXPECTED };
      }

      if (!result.success) setError(result.error ?? result.fieldErrors?.form ?? UNEXPECTED);
      onResult(result);
    });
  }

  return { pending, error, run };
}

/** What a control under a post says when its action was refused. */
export function InlineError({ message }: { message: string | undefined }) {
  return message ? (
    <p role="alert" className="basis-full px-2 py-1 text-[0.8125rem] font-semibold text-error">
      {message}
    </p>
  ) : null;
}
