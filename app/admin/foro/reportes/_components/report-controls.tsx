"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ForumReportItemResult } from "@/application";
import type { ActionResult } from "@/interface/admin/action-result";
import { closeForumReport, setForumMemberSuspended, setForumReplyHidden, setForumThreadHidden, setForumThreadLocked } from "@/interface/admin/forum/moderation-actions";

import { Field, FieldError } from "../../../_components/form-parts";
import { DeleteButton } from "../../../_components/row-actions";
import { resultMessage, useRunAction } from "../../../_components/use-run-action";

/** One moderation step as a button: the server action, the toast on success and the inline error when it fails. */
function StepButton({ label, run: action, done }: { label: string; run: () => Promise<ActionResult>; done: string }) {
  const { pending, result, run } = useRunAction();
  const message = resultMessage(result);

  return (
    <>
      <Button variant="line" size="sm" busy={pending} aria-disabled={pending || undefined} onClick={() => !pending && run(action, undefined, done)}>
        {label}
      </Button>
      {message ? <FieldError>{message}</FieldError> : null}
    </>
  );
}

/** Hide or show the reported post, lock or unlock its thread, suspend or reactivate its author. */
export function PostControls({ target }: { target: ForumReportItemResult["target"] }) {
  const hideAction = (hidden: boolean) => (target.kind === "thread" ? setForumThreadHidden(target.threadId, hidden) : setForumReplyHidden(target.replyId ?? "", hidden));
  const noun = target.kind === "thread" ? "el hilo" : "la respuesta";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Acciones sobre la publicación">
      <StepButton
        label={target.hidden ? `Mostrar ${noun}` : `Ocultar ${noun}`}
        run={() => hideAction(!target.hidden)}
        done={target.hidden ? "Publicación visible de nuevo." : "Publicación oculta para los estudiantes."}
      />
      <StepButton
        label={target.locked ? "Reabrir el hilo" : "Cerrar el hilo"}
        run={() => setForumThreadLocked(target.threadId, !target.locked)}
        done={target.locked ? "Hilo reabierto." : "Hilo cerrado: ya no admite respuestas ni cambios."}
      />
      {target.authorSuspended ? (
        <StepButton label="Reactivar la cuenta" run={() => setForumMemberSuspended(target.authorId, false)} done="Cuenta reactivada." />
      ) : (
        <DeleteButton
          label={target.authorName}
          triggerLabel="Suspender la cuenta"
          confirmLabel="Sí, suspender"
          warning={`«${target.authorName}» ya no podrá publicar y se cerrarán todas sus sesiones del foro.`}
          note="Podrá reactivar la cuenta cuando quiera."
          successMessage="Cuenta suspendida y sesiones cerradas."
          compactOnMobile={false}
          action={() => setForumMemberSuspended(target.authorId, true)}
        />
      )}
    </div>
  );
}

/** Closes an open report, with an optional note that stays in the queue's history. */
export function CloseReportForm({ reportId }: { reportId: string }) {
  const { pending, result, run } = useRunAction();
  const [note, setNote] = useState("");
  const error = result?.error ?? result?.fieldErrors?.note ?? result?.fieldErrors?.outcome;

  return (
    <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
      <Field label="Nota (opcional)" hint="Queda en el historial del reporte. Hasta 500 caracteres.">
        {(control) => <Textarea {...control} rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" busy={pending} aria-disabled={pending || undefined} onClick={() => !pending && run(() => closeForumReport(reportId, "RESOLVED", note), undefined, "Reporte resuelto.")}>
          Marcar como resuelto
        </Button>
        <Button type="button" variant="line" size="sm" aria-disabled={pending || undefined} onClick={() => !pending && run(() => closeForumReport(reportId, "DISMISSED", note), undefined, "Reporte descartado.")}>
          Descartar
        </Button>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </form>
  );
}
