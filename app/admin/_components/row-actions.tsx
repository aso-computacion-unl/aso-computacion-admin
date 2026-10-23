"use client";

import { useState } from "react";

import type { ActionResult } from "@/interface/admin/action-result";

import { resultMessage, useRunAction } from "./use-run-action";

function RowError({ result }: { result: ActionResult | null }) {
  return result?.error ? (
    <small role="alert" className="field-error">
      {resultMessage(result)}
    </small>
  ) : null;
}

interface PublishedToggleProps {
  /** Names the row for assistive tech, e.g. the question or the person. */
  label: string;
  isPublished: boolean;
  action: (isPublished: boolean) => Promise<ActionResult>;
}

export function PublishedToggle({ label, isPublished, action }: PublishedToggleProps) {
  const { pending, result, run } = useRunAction();
  const [published, setPublished] = useState(isPublished);

  function toggle() {
    if (pending) return;

    const next = !published;
    run(() => action(next), () => setPublished(next));
  }

  return (
    <>
      <button type="button" role="switch" aria-checked={published} aria-label={`Publicado: ${label}`} onClick={toggle}>
        {pending ? "Guardando..." : published ? "Publicado" : "Borrador"}
      </button>
      <RowError result={result} />
    </>
  );
}

interface MoveButtonsProps {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  action: (direction: "up" | "down") => Promise<ActionResult>;
}

export function MoveButtons({ label, isFirst, isLast, action }: MoveButtonsProps) {
  const { pending, result, run } = useRunAction();

  return (
    <div role="group" aria-label={`Orden: ${label}`} className="row-actions">
      <button type="button" disabled={isFirst} aria-disabled={pending || undefined} onClick={() => !pending && run(() => action("up"))}>
        Subir
      </button>
      <button type="button" disabled={isLast} aria-disabled={pending || undefined} onClick={() => !pending && run(() => action("down"))}>
        Bajar
      </button>
      <RowError result={result} />
    </div>
  );
}

interface DeleteButtonProps {
  label: string;
  /** What is lost with the row, shown in the confirmation. */
  warning: string;
  action: () => Promise<ActionResult>;
}

export function DeleteButton({ label, warning, action }: DeleteButtonProps) {
  const { pending, result, run } = useRunAction();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" aria-label={`Eliminar: ${label}`} onClick={() => setConfirming(true)}>
        Eliminar
      </button>
    );
  }

  return (
    <span role="group" aria-label={`Confirmar eliminación de ${label}`}>
      {warning} No se puede deshacer.{" "}
      <button type="button" aria-disabled={pending || undefined} onClick={() => !pending && run(action)}>
        Sí, eliminar
      </button>{" "}
      <button type="button" aria-disabled={pending || undefined} onClick={() => !pending && setConfirming(false)}>
        No, conservar
      </button>
      <RowError result={result} />
    </span>
  );
}
