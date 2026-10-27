"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";

import { ListRow, type ListRowProps } from "./list-row";
import { useReorderable } from "./reorderable-list";
import { Stamp } from "./timeline-parts";

interface OrderedRowProps {
  /** The item's id: what a bulk selection and a reorder name it by. */
  id: string;
  published: boolean;
  /** 1-based place in the list: the order of the public site. Null while the list is searched: a place in the whole list is not known then. */
  position: number | null;
  /** Names the row in links and buttons, e.g. the question or the person. */
  label: string;
  editHref: string;
  /** A thumbnail or avatar, left of the text. */
  media?: ReactNode;
  /** What the row says: its title and a line of detail. */
  children?: ReactNode;
  toggle: ReactNode;
  /** Absent while the list is searched: moving a row past neighbours that are hidden would be a guess. */
  move?: ReactNode;
  remove: ReactNode;
}

/** The grip of a draggable row: the only part that starts a drag, so links and buttons in the row keep working. */
function SortableRow(props: OrderedRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription="elemento reordenable"
      aria-label={`Arrastrar para reordenar: ${props.label}`}
      className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xs text-mist hover:text-foreground active:cursor-grabbing"
    >
      <Icon name="grip" />
    </button>
  );

  return <OrderedListRow {...props} handle={handle} itemRef={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} dragging={isDragging} />;
}

/** The shared row, with the row's number as its lead: the place it has on the public site. */
function OrderedListRow({ position, handle, itemRef, style, dragging, ...row }: OrderedRowProps & Pick<ListRowProps, "handle" | "itemRef" | "style" | "dragging">) {
  return <ListRow {...row} lane="trunk" lead={<Stamp>{position === null ? "··" : String(position).padStart(2, "0")}</Stamp>} handle={handle} itemRef={itemRef} style={style} dragging={dragging} />;
}

/**
 * One commit of an ordered list (FAQ, pillars, socials, board...): a `ListRow` whose lead is the row's
 * number. Inside a `ReorderableList` it also has a drag handle.
 */
export function OrderedRow(props: OrderedRowProps) {
  const reorderable = useReorderable();

  if (reorderable) return <SortableRow {...props} />;

  return <OrderedListRow {...props} />;
}
