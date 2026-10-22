"use client";

import { useState } from "react";

import { deleteEvent } from "@/interface/admin/events/actions";

import { resultMessage, useRunAction } from "./use-run-action";

interface EventDeleteButtonProps {
  eventId: string;
  title: string;
}

export function EventDeleteButton({ eventId, title }: EventDeleteButtonProps) {
  const { pending, result, run } = useRunAction();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" aria-label={`Eliminar: ${title}`} onClick={() => setConfirming(true)}>
        Eliminar
      </button>
    );
  }

  return (
    <span role="group" aria-label={`Confirmar eliminación de ${title}`}>
      ¿Eliminar este evento y sus fotos? No se puede deshacer.{" "}
      <button type="button" aria-disabled={pending || undefined} onClick={() => !pending && run(() => deleteEvent(eventId))}>
        Sí, eliminar
      </button>{" "}
      <button type="button" aria-disabled={pending || undefined} onClick={() => !pending && setConfirming(false)}>
        No, conservar
      </button>
      {result?.error ? <small role="alert" className="field-error">{resultMessage(result)}</small> : null}
    </span>
  );
}
