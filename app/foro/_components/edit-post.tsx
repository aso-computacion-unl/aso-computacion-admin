"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { editForumReply, editForumThread } from "@/interface/forum/forum-posting";

import { ForumField, SubmitError } from "./form-feedback";
import { MarkdownEditor } from "./markdown-editor";
import { useForumForm } from "./use-forum-form";

const TITLE_MAX = 120;
const THREAD_BODY_MAX = 10000;
const REPLY_BODY_MAX = 5000;

/** The post being edited, as it is shown now. `threadId` is where a session that ended sends the member back. */
export type EditTarget = { kind: "thread"; id: string; threadId: string; title: string; body: string } | { kind: "reply"; id: string; threadId: string; body: string };

/**
 * «Editar» under the viewer's own post (D2). It opens the post's text in place; saving refreshes the thread, which
 * then shows the new text marked "editado". The server decides who may edit: this is only offered, never trusted.
 */
export function EditPost({ target }: { target: EditTarget }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        <Icon name="edit" className="size-4" />
        Editar
      </Button>
    );
  }

  return <EditForm target={target} onClose={() => setOpen(false)} />;
}

// Mounted per opening, so «Cancelar» drops what was typed and the next opening starts from the post again.
function EditForm({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const { values, setValue, handleSubmit, state, pending, errors } = useForumForm(
    (previous, formData) => (target.kind === "thread" ? editForumThread(target.id, previous, formData) : editForumReply(target.id, previous, formData)),
    target.kind === "thread" ? { title: target.title, body: target.body } : { body: target.body },
  );

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onClose();
    }
    // `state` is a new object per submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid w-full gap-3 p-2">
      {target.kind === "thread" ? (
        <ForumField id={`${id}-title`} label="Título" error={errors.title}>
          {(describedBy) => (
            <Input
              id={`${id}-title`}
              name="title"
              value={values.title}
              onChange={(event) => setValue("title", event.target.value)}
              maxLength={TITLE_MAX}
              autoComplete="off"
              required
              aria-describedby={describedBy}
              aria-invalid={errors.title ? true : undefined}
            />
          )}
        </ForumField>
      ) : null}
      <ForumField id={`${id}-body`} label={target.kind === "thread" ? "Texto del hilo" : "Su respuesta"} error={errors.body}>
        {(describedBy) => (
          <MarkdownEditor
            id={`${id}-body`}
            name="body"
            value={values.body ?? ""}
            onChange={(value) => setValue("body", value)}
            rows={5}
            maxLength={target.kind === "thread" ? THREAD_BODY_MAX : REPLY_BODY_MAX}
            required
            aria-describedby={describedBy}
            aria-invalid={errors.body ? true : undefined}
          />
        )}
      </ForumField>
      <SubmitError result={state} returnTo={`/foro/hilo/${encodeURIComponent(target.threadId)}`} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="quiet" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" busy={pending} aria-disabled={pending || undefined}>
          <Icon name="check" />
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
