"use client";

import { useState } from "react";

import { setEventPublished } from "@/interface/admin/events/actions";

import { resultMessage, useRunAction } from "../../_components/use-run-action";

interface EventPublishedToggleProps {
  eventId: string;
  title: string;
  isPublished: boolean;
}

export function EventPublishedToggle({ eventId, title, isPublished }: EventPublishedToggleProps) {
  const { pending, result, run } = useRunAction();
  const [published, setPublished] = useState(isPublished);

  function toggle() {
    if (pending) return;

    const next = !published;
    run(() => setEventPublished(eventId, next), () => setPublished(next));
  }

  return (
    <>
      <button type="button" role="switch" aria-checked={published} aria-label={`Publicado: ${title}`} onClick={toggle}>
        {pending ? "Guardando..." : published ? "Publicado" : "Borrador"}
      </button>
      {result?.error ? <small role="alert" className="field-error">{resultMessage(result)}</small> : null}
    </>
  );
}
