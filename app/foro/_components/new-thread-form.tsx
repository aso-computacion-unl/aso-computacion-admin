"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createForumThread } from "@/interface/forum/forum-posting";

import { ForumField, SubmitError } from "./form-feedback";
import { MarkdownBody } from "./markdown-body";
import { MarkdownEditor } from "./markdown-editor";
import { useForumForm } from "./use-forum-form";

const TITLE_MAX = 120;
const BODY_MAX = 10000;

/** The composer of a new thread: title, Markdown text with its preview, and the way back to the category. */
export function NewThreadForm({ categorySlug }: { categorySlug: string }) {
  const router = useRouter();
  const id = useId();
  const { values, setValue, handleSubmit, state, pending, errors } = useForumForm((previous, formData) => createForumThread(categorySlug, previous, formData), { title: "", body: "" });
  const published = state?.success === true;

  useEffect(() => {
    if (state?.success && state.id) router.push(`/foro/hilo/${state.id}`);
  }, [state, router]);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <ForumField id={`${id}-title`} label="Título" error={errors.title}>
        {(describedBy) => (
          <Input
            id={`${id}-title`}
            name="title"
            value={values.title}
            onChange={(event) => setValue("title", event.target.value)}
            maxLength={TITLE_MAX}
            autoComplete="off"
            placeholder="Resuma su duda en una línea"
            required
            aria-describedby={describedBy}
            aria-invalid={errors.title ? true : undefined}
          />
        )}
      </ForumField>

      <div className="grid gap-5 lg:grid-cols-2">
        <ForumField
          id={`${id}-body`}
          label="Texto (Markdown)"
          hint="Admite **negrita**, *cursiva*, listas con «- », enlaces [texto](https://…) y bloques de código entre líneas de tres comillas invertidas."
          error={errors.body}
        >
          {(describedBy) => (
            <MarkdownEditor
              id={`${id}-body`}
              name="body"
              value={values.body}
              onChange={(value) => setValue("body", value)}
              rows={12}
              maxLength={BODY_MAX}
              placeholder="Cuente qué intentó y qué esperaba."
              required
              aria-describedby={describedBy}
              aria-invalid={errors.body ? true : undefined}
            />
          )}
        </ForumField>
        <section aria-labelledby={`${id}-preview`} className="grid min-w-0 content-start gap-1.5">
          <h2 id={`${id}-preview`} className="text-sm leading-[1.3] font-[650]">
            Vista previa
          </h2>
          <div className="min-h-32 rounded border border-border bg-muted p-3.5">
            {values.body.trim() ? <MarkdownBody source={values.body} /> : <p className="text-mist">Aquí verá cómo se lee su texto mientras escribe.</p>}
          </div>
        </section>
      </div>

      <SubmitError result={state} />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto font-mono text-xs text-mist" aria-hidden="true">
          {values.body.length} / {BODY_MAX}
        </span>
        <Button asChild variant="line">
          <Link href={`/foro/c/${categorySlug}`}>Cancelar</Link>
        </Button>
        <Button type="submit" busy={pending || published} aria-disabled={pending || published || undefined} className="min-h-12">
          {pending || published ? "Publicando…" : "Publicar hilo"}
        </Button>
      </div>
    </form>
  );
}
