"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ForumReportItemResult } from "@/application";
import type { ActionResult } from "@/interface/admin/action-result";
import { closeForumReport, setForumMemberSuspended, setForumReplyHidden, setForumThreadHidden, setForumThreadLocked } from "@/interface/admin/forum/moderation-actions";

import { Field, FieldError } from "../../../_components/form-parts";
import { useToast } from "../../../_components/toast";
import { resultMessage, useRunAction } from "../../../_components/use-run-action";

export const ALREADY_DONE_MESSAGE = "Sin cambios: otra persona ya lo había hecho.";

type StepButtonProps = { label: string; run: () => Promise<ActionResult>; done: string; variant?: "primary" | "line" | "quiet"; size?: "default" | "sm" };

/** One moderation step as a button: the server action, the toast on success and the inline error when it fails. */
function StepButton({ label, run: action, done, variant = "line", size = "default" }: StepButtonProps) {
  const { pending, result, run } = useRunAction();
  const { notify } = useToast();
  const message = resultMessage(result);
  // A step that found the target already in the wanted state says so instead of claiming it did the work.
  const report = async () => {
    const outcome = await action();

    if (outcome.success) notify(outcome.unchanged ? ALREADY_DONE_MESSAGE : done);

    return outcome;
  };

  return (
    <>
      <Button variant={variant} size={size} busy={pending} aria-disabled={pending || undefined} onClick={() => !pending && run(report)}>
        {label}
      </Button>
      {message ? <FieldError>{message}</FieldError> : null}
    </>
  );
}

/**
 * Suspending asks first, like a removal, but the account is not removed: the trigger carries a lock, not the trash can
 * that `DeleteButton` draws for "Mover a la papelera".
 */
function SuspendButton({ memberId, name }: { memberId: string; name: string }) {
  const { pending, result, run } = useRunAction();
  const [confirming, setConfirming] = useState(false);
  const message = resultMessage(result);

  if (!confirming) {
    return (
      <Button variant="quiet" size="sm" aria-label={`Suspender…: ${name}`} onClick={() => setConfirming(true)} className="min-h-11 border-action px-4.5 text-[0.9375rem] text-foreground">
        <Icon name="lock" className="size-4" />
        Suspender…
      </Button>
    );
  }

  return (
    <div role="group" aria-label={`Confirmar: suspender… ${name}`} className="grid basis-full gap-3 rounded bg-muted p-3 text-sm">
      <p>
        «{name}» ya no podrá publicar y se cerrarán todas sus sesiones del foro. <span className="text-mist">Podrá reactivar la cuenta cuando quiera.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          busy={pending}
          aria-disabled={pending || undefined}
          onClick={() => !pending && run(() => setForumMemberSuspended(memberId, true), undefined, "Cuenta suspendida y sesiones cerradas.")}
        >
          Sí, suspender
        </Button>
        <Button variant="line" size="sm" aria-disabled={pending || undefined} onClick={() => !pending && setConfirming(false)} autoFocus>
          No, conservar
        </Button>
      </div>
      {message ? <FieldError>{message}</FieldError> : null}
    </div>
  );
}

/**
 * What a moderator can do with the report in view. The three decisions come first: hide (or show) the post, ignore the
 * report, suspend (or reactivate) the author. Below, quieter: lock the thread, close the report as resolved with the
 * optional note, and read the whole thread. The note goes with whichever way the report is closed.
 */
export function ReportActions({ report }: { report: Pick<ForumReportItemResult, "id" | "target"> }) {
  const { target } = report;
  const { pending, result, run } = useRunAction();
  const [note, setNote] = useState("");
  const hideAction = (hidden: boolean) => (target.kind === "thread" ? setForumThreadHidden(target.threadId, hidden) : setForumReplyHidden(target.replyId ?? "", hidden));
  const close = (outcome: "RESOLVED" | "DISMISSED", done: string) => !pending && run(() => closeForumReport(report.id, outcome, note), undefined, done);
  const error = result?.error ?? result?.fieldErrors?.note ?? result?.fieldErrors?.outcome;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Decidir">
        <StepButton
          variant="primary"
          label={target.hidden ? "Mostrar" : "Ocultar"}
          run={() => hideAction(!target.hidden)}
          done={target.hidden ? "Publicación visible de nuevo." : "Publicación oculta para los estudiantes."}
        />
        <Button variant="line" aria-disabled={pending || undefined} onClick={() => close("DISMISSED", "Reporte descartado.")}>
          Ignorar
        </Button>
        {target.authorSuspended ? (
          <StepButton label="Reactivar la cuenta" run={() => setForumMemberSuspended(target.authorId, false)} done="Cuenta reactivada." />
        ) : (
          <SuspendButton memberId={target.authorId} name={target.authorName} />
        )}
      </div>

      <form className="grid gap-3 border-t border-dashed border-sky/50 pt-4" onSubmit={(event) => event.preventDefault()}>
        <Field label="Nota (opcional)" hint="Queda en el historial del reporte. Hasta 500 caracteres.">
          {(control) => <Textarea {...control} rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />}
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="line" size="sm" busy={pending} aria-disabled={pending || undefined} onClick={() => close("RESOLVED", "Reporte resuelto.")}>
            Marcar como resuelto
          </Button>
          <StepButton
            variant="quiet"
            size="sm"
            label={target.locked ? "Reabrir el hilo" : "Cerrar el hilo"}
            run={() => setForumThreadLocked(target.threadId, !target.locked)}
            done={target.locked ? "Hilo reabierto." : "Hilo cerrado: ya no admite respuestas ni cambios."}
          />
          <Button asChild variant="quiet" size="sm">
            <Link href={`/foro/hilo/${target.threadId}`} target="_blank" rel="noopener">
              Ver el hilo completo
            </Link>
          </Button>
        </div>
      </form>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
