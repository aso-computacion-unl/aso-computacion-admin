import type { ActionResult } from "@/interface/admin/action-result";
import type { ToastAction } from "@/interface/admin/toasts";

import { resultMessage } from "./use-run-action";

export const UNDO_LABEL = "Deshacer";
export const RESTORED_MESSAGE = "Restaurado como borrador.";
const UNDO_FAILED = "No se pudo deshacer. Revise la papelera.";

/**
 * The "Deshacer" button of a removal toast: it restores the item and says so in a new toast.
 * The row that was removed is already gone, so a failure cannot be shown inline there: it is
 * announced on a toast too, with the server's reason when there is one.
 * It runs at most once: a second press (a double click, a press while the restore is pending) is ignored.
 */
export function undoAction(undo: () => Promise<ActionResult>, notify: (message: string) => void): ToastAction {
  let used = false;

  return {
    label: UNDO_LABEL,
    onAction: () => {
      if (used) return;

      used = true;
      void undo().then(
        (result) => notify(result.success ? RESTORED_MESSAGE : (resultMessage(result) ?? UNDO_FAILED)),
        () => notify(UNDO_FAILED),
      );
    },
  };
}
