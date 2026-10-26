"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/interface/admin/action-result";

import { FieldError } from "./form-parts";
import { useToast } from "./toast";
import { RESTORED_MESSAGE, undoAction } from "./undo-toast";
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
  // `published` is what the server confirmed; `shown` flips at once while the action runs and
  // falls back to `published` by itself if the action fails, leaving the inline error to explain.
  const [published, setPublished] = useState(isPublished);
  const [shown, setShown] = useOptimistic(published);

  function toggle() {
    if (pending) return;

    const next = !published;
    run(
      async () => {
        setShown(next);
        return action(next);
      },
      () => setPublished(next),
      next ? `«${label}» publicado.` : `«${label}» pasó a borrador.`,
    );
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-busy={pending || undefined}
        aria-label={`Publicado: ${label}`}
        onClick={toggle}
        className="group inline-flex min-h-11 items-center gap-2.5 rounded pr-1 text-sm font-semibold text-mist transition-colors duration-150 ease-out hover:text-foreground aria-checked:text-foreground"
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
        {shown ? "Publicado" : "Borrador"}
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
  position: number;
  total: number;
  action: (direction: "up" | "down") => Promise<ActionResult>;
}

export function MoveButtons({ label, isFirst, isLast, position, total, action }: MoveButtonsProps) {
  const { pending, result, run } = useRunAction();
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const [moved, setMoved] = useState<"up" | "down" | null>(null);
  const { notify } = useToast();

  // The list re-renders in the new order and the browser drops focus from the node it moved:
  // put it back on the same button, or on the other one when this one just became disabled.
  useEffect(() => {
    if (!moved || pending) return;

    const preferred = moved === "up" ? up : down;
    const other = moved === "up" ? down : up;
    const target = preferred.current && !preferred.current.disabled ? preferred.current : other.current;

    target?.focus();
    // The toast is the announcement: the live region reads the new place aloud.
    notify(`${label}: posición ${position} de ${total}.`);
    setMoved(null);
  }, [moved, pending, label, position, total, notify]);

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
      <RowError result={result} />
    </div>
  );
}

/** A two-step removal. The copy is the caller's: nothing here assumes the item goes to the trash. */
interface DeleteButtonProps {
  label: string;
  /** What is lost with the row, shown in the confirmation. */
  warning: string;
  action: () => Promise<ActionResult>;
  /** The trigger's wording, e.g. "Quitar" for a photo that is kept in storage. */
  triggerLabel: string;
  /** Extra classes for the trigger, e.g. a negative margin to align it with the text above. */
  triggerClassName?: string;
  /** In a crowded row the trigger shrinks to its icon on a phone; set false where there is room for the word. */
  compactOnMobile?: boolean;
  confirmLabel: string;
  note: string;
  /** Toast shown once the removal went through. */
  successMessage: string;
  /** Puts the removal back. When given, the success toast offers "Deshacer", which calls it. */
  undo?: () => Promise<ActionResult>;
}

export function DeleteButton({
  label,
  warning,
  action,
  triggerLabel,
  triggerClassName,
  compactOnMobile = true,
  confirmLabel,
  note,
  successMessage,
  undo,
}: DeleteButtonProps) {
  const { pending, result, run } = useRunAction();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="quiet" size="sm" aria-label={`${triggerLabel}: ${label}`} onClick={() => setConfirming(true)} className={cn(compactOnMobile && "max-sm:min-w-10 max-sm:px-0", triggerClassName)}>
        <Icon name="trash" className="size-4" />
        <span className={cn(compactOnMobile && "max-sm:sr-only")}>{triggerLabel}</span>
      </Button>
    );
  }

  return (
    <div role="group" aria-label={`Confirmar: ${triggerLabel.toLowerCase()} ${label}`} className="grid basis-full gap-3 rounded bg-muted p-3 text-sm">
      <p>
        {warning} <span className="text-mist">{note}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" size="sm" busy={pending} aria-disabled={pending || undefined} onClick={() => !pending && run(action, undefined, successMessage, undo && undoAction(undo, notify))}>
          {confirmLabel}
        </Button>
        <Button variant="line" size="sm" aria-disabled={pending || undefined} onClick={() => !pending && setConfirming(false)} autoFocus>
          No, conservar
        </Button>
      </div>
      <RowError result={result} />
    </div>
  );
}

type TrashButtonProps = Pick<DeleteButtonProps, "label" | "warning" | "action" | "undo">;

/** Moves a row to the trash, which `undo` (when given) brings back: the only removal whose copy promises a restore. */
export function TrashButton(props: TrashButtonProps) {
  return (
    <DeleteButton
      {...props}
      triggerLabel="Mover a la papelera"
      confirmLabel="Sí, mover"
      note="Podrá restaurarlo desde la papelera; volverá como borrador."
      successMessage="Movido a la papelera"
    />
  );
}

interface RestoreButtonProps {
  label: string;
  action: () => Promise<ActionResult>;
}

/** Brings a trashed item back as a draft; a refusal (its name is taken again) is shown on the row. */
export function RestoreButton({ label, action }: RestoreButtonProps) {
  const { pending, result, run } = useRunAction();

  return (
    <>
      <Button variant="line" size="sm" busy={pending} aria-label={`Restaurar: ${label}`} aria-disabled={pending || undefined} onClick={() => !pending && run(action, undefined, RESTORED_MESSAGE)}>
        <Icon name="undo" className="size-4" />
        Restaurar
      </Button>
      <RowError result={result} />
    </>
  );
}
