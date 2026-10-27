"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { replyToForumThread } from "@/interface/forum/forum-posting";

import { ForumField, SubmitError } from "./form-feedback";
import { MarkdownEditor } from "./markdown-editor";
import { useForumForm } from "./use-forum-form";

const BODY_MAX = 5000;

/** The reply box at the end of a thread. A published reply clears it and refreshes the thread in place. */
export function ReplyForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const id = useId();
  const { values, setValue, reset, handleSubmit, state, pending, errors } = useForumForm((previous, formData) => replyToForumThread(threadId, previous, formData), { body: "" });

  useEffect(() => {
    if (state?.success) {
      reset();
      router.refresh();
    }
    // `state` is a new object per submit; `reset` only restores the constants above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-3 rounded-xl border border-border bg-muted p-3 sm:p-4">
      <ForumField id={`${id}-body`} label="Su respuesta" hint="Admite Markdown: **negrita**, *cursiva*, listas, enlaces y bloques de código." error={errors.body}>
        {(describedBy) => (
          <MarkdownEditor
            id={`${id}-body`}
            name="body"
            value={values.body}
            onChange={(value) => setValue("body", value)}
            rows={5}
            maxLength={BODY_MAX}
            placeholder="Escriba su respuesta."
            required
            aria-describedby={describedBy}
            aria-invalid={errors.body ? true : undefined}
          />
        )}
      </ForumField>
      <SubmitError result={state} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" className="text-sm text-mist">
          {state?.success ? (
            <p className="flex items-center gap-1.5 font-semibold text-sky-bright">
              <Icon name="check" className="size-4 stroke-[2.25]" />
              Respuesta publicada.
            </p>
          ) : (
            <p>Se publica con el nombre de su cuenta de Google.</p>
          )}
        </div>
        <Button type="submit" busy={pending} aria-disabled={pending || undefined} className="min-h-12">
          <Icon name="reply" />
          {pending ? "Publicando…" : "Responder"}
        </Button>
      </div>
    </form>
  );
}
