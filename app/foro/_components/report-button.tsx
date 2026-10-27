"use client";

import { useId, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportForumReply, reportForumThread } from "@/interface/forum/forum-moderation";

import { ForumField, SubmitError } from "./form-feedback";
import { useForumForm } from "./use-forum-form";

/** The server takes one text of up to 500 characters: the chosen reason, a colon and the note. */
const REASONS = {
  spam: "Spam o publicidad",
  offensive: "Contenido ofensivo o acoso",
  "off-topic": "Fuera de tema",
  false: "Información falsa o engañosa",
  other: "Otro motivo",
} as const;

type ReasonKey = keyof typeof REASONS;

const NOTE_MAX = 400;

function reasonText(key: string, note: string): string {
  const label = REASONS[key as ReasonKey] ?? REASONS.other;
  const detail = note.trim();

  return detail ? `${label}: ${detail}` : label;
}

type Target = { kind: "thread" | "reply"; id: string };

/** «Reportar» under a post: a reason to choose, an optional note, and a confirmation once it is sent. */
export function ReportButton({ target }: { target: Target }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const { values, setValue, handleSubmit, state, pending, errors } = useForumForm(
    (previous, formData) => {
      const body = new FormData();

      body.set("reason", reasonText(String(formData.get("reason") ?? ""), String(formData.get("note") ?? "")));

      return target.kind === "thread" ? reportForumThread(target.id, previous, body) : reportForumReply(target.id, previous, body);
    },
    { reason: "spam", note: "" },
  );

  if (state?.success || state?.alreadyReported) {
    return (
      <p role="status" className="flex items-center gap-1.5 px-2 py-1 text-[0.8125rem] font-semibold text-sky-bright">
        <Icon name="check" className="size-4 stroke-[2.25]" />
        {state.success ? "Reporte enviado. La moderación lo revisará." : "Ya reportó esta publicación. La moderación la revisará."}
      </p>
    );
  }

  return (
    <>
      <Button variant="quiet" size="sm" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => setOpen((previous) => !previous)}>
        Reportar
      </Button>
      {open ? (
        <form id={`${id}-form`} onSubmit={handleSubmit} noValidate className="mt-1 grid basis-full gap-3 rounded-lg border border-border bg-background/40 p-3">
          <ForumField id={`${id}-reason`} label="Motivo" error={errors.reason}>
            {(describedBy) => (
              <Select id={`${id}-reason`} name="reason" value={values.reason} onChange={(event) => setValue("reason", event.target.value)} aria-describedby={describedBy}>
                {Object.entries(REASONS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </ForumField>
          <ForumField id={`${id}-note`} label="Nota (opcional)" hint="Ayuda a la moderación a entender qué ocurrió. La ve solo el equipo.">
            {(describedBy) => <Textarea id={`${id}-note`} name="note" rows={2} maxLength={NOTE_MAX} value={values.note} onChange={(event) => setValue("note", event.target.value)} aria-describedby={describedBy} />}
          </ForumField>
          <SubmitError result={state} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="quiet" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" busy={pending} aria-disabled={pending || undefined}>
              {pending ? "Enviando…" : "Enviar reporte"}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
