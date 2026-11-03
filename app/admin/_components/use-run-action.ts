"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/interface/admin/action-result";
import type { ToastAction } from "@/interface/admin/toasts";

import { useToast } from "./toast";

const UNEXPECTED_ERROR = "Ocurrió un error inesperado. Intente nuevamente.";

/** First message of a result, whichever way the server reported it. */
export function resultMessage(result: ActionResult | null): string | undefined {
  return result?.error ?? Object.values(result?.fieldErrors ?? {})[0];
}

/**
 * Runs a server action inside a transition and keeps its last result. A
 * rejected call (network, redirect to login) becomes an error result instead
 * of unmounting the component. A success toast, when given, is shown on the
 * layout's provider, so it outlives a row that the result removes; `successAction`
 * adds a button to that toast (e.g. "Deshacer").
 */
export function useRunAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const { notify } = useToast();

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void, successMessage?: string, successAction?: ToastAction) {
    setResult(null);
    startTransition(async () => {
      let outcome: ActionResult;

      try {
        outcome = await action();
      } catch {
        outcome = { error: UNEXPECTED_ERROR };
      }

      setResult(outcome);
      if (outcome.success) {
        onSuccess?.();
        if (successMessage) notify(successMessage, successAction);
      }
    });
  }

  return { pending, result, run };
}
