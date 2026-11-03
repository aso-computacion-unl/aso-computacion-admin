"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Children, createContext, isValidElement, useContext, useId, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";

import { dropResult, placeMessage } from "@/interface/admin/reorder/reorder-drag";
import { reorderContent } from "@/interface/admin/reorder/actions";
import type { ReorderKind } from "@/interface/admin/reorder/reorder-input";

import { useToast } from "./toast";

const UNEXPECTED_ERROR = "Ocurrió un error inesperado. Intente nuevamente.";
const DRAG_DISTANCE = 6;

const ReorderContext = createContext(false);

/** True inside a list whose rows can be dragged: a row shows its handle only then. */
export function useReorderable(): boolean {
  return useContext(ReorderContext);
}

/** A list is one column: a row only ever moves up or down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Para reordenar, pulse la barra espaciadora y mueva el elemento con las flechas arriba y abajo. Vuelva a pulsar la barra espaciadora para soltarlo en su nuevo lugar, o Escape para cancelar.",
};

interface ReorderableListProps {
  kind: ReorderKind;
  /** The rows of the page, in order. */
  items: readonly { id: string; label: string }[];
  /** How many items come before this page, so a drop on a later page sends its place in the whole list. */
  offset: number;
  /** How many items the whole list has, for the place announced after a drop. */
  total: number;
  /** Off while the list is searched: a place in the whole list is not known for a subset. */
  enabled: boolean;
  label: string;
  /** The rows: elements whose `id` prop (or key) is the id of their item. */
  children?: ReactNode;
}

/**
 * The item a row stands for: its `id` prop, else its key. The key alone is not enough: in development the server streams
 * rows past the first few as separate chunks and the browser hands them over keyed by index (".3"), not by id.
 */
const keyOf = (child: ReactNode) => {
  if (!isValidElement(child)) return null;

  const { id } = child.props as { id?: unknown };

  if (typeof id === "string") return id;

  return child.key !== null ? String(child.key).replace(/^\.\$/, "") : null;
};

/**
 * An ordered list whose rows can be dragged to a new place with the mouse, a finger or the
 * keyboard (the handle of each row). The new order shows at once and the server renumbers the
 * list; if it refuses, the list goes back and says why. The move buttons stay as the one-step way.
 */
export function ReorderableList({ kind, items, offset, total, enabled, label, children }: ReorderableListProps) {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const labels = useMemo(() => new Map(items.map((item) => [item.id, item.label])), [items]);
  const [order, setOrder] = useOptimistic<string[], string[]>(ids, (_current, next) => next);
  const [problem, setProblem] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { notify } = useToast();
  // dnd-kit numbers its aria ids with a module-level counter: the server keeps counting across requests and the browser starts at zero.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_DISTANCE },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const rows = useMemo(() => {
    const byId = new Map(Children.toArray(children).map((child) => [keyOf(child), child] as const));

    return order.map((id) => byId.get(id)).filter((row) => row !== undefined);
  }, [children, order]);

  const nameOf = (id: unknown) => labels.get(String(id)) ?? "Elemento";
  const placeOf = (id: unknown) => offset + order.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Se tomó «${nameOf(active.id)}», posición ${placeOf(active.id)} de ${total}.`,
    onDragOver: ({ active, over }) => (over ? `«${nameOf(active.id)}» está sobre la posición ${placeOf(over.id)} de ${total}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `«${nameOf(active.id)}» se soltó en la posición ${placeOf(over.id)} de ${total}.` : `«${nameOf(active.id)}» se soltó fuera de la lista.`,
    onDragCancel: ({ active }) => `Se canceló el movimiento de «${nameOf(active.id)}».`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    const drop = dropResult(order, String(active.id), over ? String(over.id) : null, offset);

    if (!drop) return;

    setProblem(null);
    startTransition(async () => {
      setOrder(drop.order);

      let outcome: Awaited<ReturnType<typeof reorderContent>>;

      try {
        outcome = await reorderContent(kind, String(active.id), drop.position);
      } catch {
        outcome = { error: UNEXPECTED_ERROR };
      }

      if (outcome.error !== undefined) {
        setProblem(outcome.error);
        return;
      }

      notify(placeMessage(nameOf(active.id), drop.position + 1, total));
    });
  }

  return (
    <ReorderContext.Provider value={enabled}>
      {problem ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-signal">
          {problem}
        </p>
      ) : null}
      <div className="tl mt-6">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: INSTRUCTIONS,
          }}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy} disabled={!enabled}>
            <ol aria-label={label} className="tl-trunk pb-6">
              {rows}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
    </ReorderContext.Provider>
  );
}
