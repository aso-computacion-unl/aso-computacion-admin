"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/interface/admin/action-result";

import { FieldError } from "./form-parts";
import { resultMessage, useRunAction } from "./use-run-action";

function RowError({ result }: { result: ActionResult | null }) {
  // A rule such as "publishing needs a photo" arrives as a field error; the row has no field, so it shows the same way.
  const message = resultMessage(result);

  return message ? <FieldError>{message}</FieldError> : null;
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
      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label={`Publicado: ${label}`}
        onClick={toggle}
        className="group inline-flex min-h-11 items-center gap-2.5 rounded pr-1 text-sm font-semibold text-mist transition-colors duration-150 ease-out hover:text-white aria-checked:text-white"
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative block h-6 w-11 shrink-0 rounded-full border border-mist/55 bg-muted transition-colors duration-200 ease-out",
            "after:absolute after:top-0.5 after:left-0.5 after:size-[1.125rem] after:rounded-full after:bg-mist after:transition-[translate,background-color] after:duration-200 after:ease-(--ease-reveal) after:content-['']",
            "group-aria-checked:border-sky group-aria-checked:bg-sky group-aria-checked:after:translate-x-5 group-aria-checked:after:bg-muted",
            pending && "opacity-60",
          )}
        />
        {pending ? "Guardando…" : published ? "Publicado" : "Borrador"}
      </button>
      <RowError result={result} />
    </>
  );
}

interface MoveButtonsProps {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  /** 1-based place in the list, announced after a move. */
  position?: number;
  total?: number;
  action: (direction: "up" | "down") => Promise<ActionResult>;
}

export function MoveButtons({ label, isFirst, isLast, position, total, action }: MoveButtonsProps) {
  const { pending, result, run } = useRunAction();
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const [moved, setMoved] = useState<"up" | "down" | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // The list re-renders in the new order and the browser drops focus from the node it moved:
  // put it back on the same button, or on the other one when this one just became disabled.
  useEffect(() => {
    if (!moved || pending) return;

    const preferred = moved === "up" ? up : down;
    const other = moved === "up" ? down : up;
    const target = preferred.current && !preferred.current.disabled ? preferred.current : other.current;

    target?.focus();
    setAnnouncement(position && total ? `${label}: posición ${position} de ${total}.` : "");
    setMoved(null);
  }, [moved, pending, label, position, total]);

  function move(direction: "up" | "down") {
    if (pending) return;

    run(() => action(direction), () => setMoved(direction));
  }

  return (
    <div role="group" aria-label={`Orden: ${label}`} className="flex flex-wrap items-center gap-1">
      <Button ref={up} variant="quiet" size="icon-sm" disabled={isFirst} aria-disabled={pending || undefined} onClick={() => move("up")}>
        <Icon name="up" />
        <span className="sr-only">Subir</span>
      </Button>
      <Button ref={down} variant="quiet" size="icon-sm" disabled={isLast} aria-disabled={pending || undefined} onClick={() => move("down")}>
        <Icon name="down" />
        <span className="sr-only">Bajar</span>
      </Button>
      <span role="status" className="sr-only">
        {announcement}
      </span>
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
      <Button variant="quiet" size="sm" aria-label={`Eliminar: ${label}`} onClick={() => setConfirming(true)}>
        <Icon name="trash" className="size-4" />
        Eliminar
      </Button>
    );
  }

  return (
    <div role="group" aria-label={`Confirmar eliminación de ${label}`} className="grid basis-full gap-3 rounded bg-muted p-3 text-sm">
      <p>
        {warning} <span className="text-mist">No se puede deshacer.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" size="sm" busy={pending} aria-disabled={pending || undefined} onClick={() => !pending && run(action)}>
          Sí, eliminar
        </Button>
        <Button variant="line" size="sm" aria-disabled={pending || undefined} onClick={() => !pending && setConfirming(false)} autoFocus>
          No, conservar
        </Button>
      </div>
      <RowError result={result} />
    </div>
  );
}
