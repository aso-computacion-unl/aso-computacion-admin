"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { BulkCheckbox } from "./bulk-selection";
import { useReorderable } from "./reorderable-list";
import { Stamp, TimelineItem } from "./timeline-parts";

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

/*
 * The slots (media, toggle, remove) are wrapped in keyed fragments: a row the server streams in pieces hands them over as
 * lazy elements without a key, and React's development build reports each one next to its siblings as a list child
 * ("Each child in a list should have a unique key", from RowBody) even though none of them is a list.
 */
function RowBody({ id, position, label, editHref, media, children, toggle, move, remove, handle }: OrderedRowProps & { handle?: ReactNode }) {
  return (
    <div className="grid gap-2.5 p-4 md:px-5 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center lg:gap-x-6 lg:py-3.5">
      <div className="flex items-center justify-between gap-3 lg:contents">
        <div className="flex items-center gap-2 lg:order-1">
          {handle}
          <BulkCheckbox id={id} label={label} />
          <Stamp>{position === null ? "··" : String(position).padStart(2, "0")}</Stamp>
        </div>
        <div className="lg:order-3">{move}</div>
      </div>
      <div className="flex min-w-0 items-start gap-4 lg:order-2 lg:items-center">
        <Fragment key="media">{media}</Fragment>
        <div className="grid min-w-0 flex-1 gap-1">{children}</div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 lg:order-4 lg:mt-0 lg:w-96 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <Fragment key="toggle">{toggle}</Fragment>
        <Button asChild variant="line" size="sm" className="ml-auto">
          <Link href={editHref} aria-label={`Editar: ${label}`}>
            <Icon name="edit" className="size-4" />
            Editar
          </Link>
        </Button>
        <Fragment key="remove">{remove}</Fragment>
      </div>
    </div>
  );
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

  return (
    <TimelineItem published={props.published} lane="trunk" itemRef={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} dragging={isDragging}>
      <RowBody {...props} handle={handle} />
    </TimelineItem>
  );
}

/**
 * One commit of an ordered list (FAQ, pillars, socials, board, news): content on top, the four
 * things you can do below. On lg+ the same four parts sit in one row (number, content, move,
 * actions) so a wide card is not a tall one. Inside a `ReorderableList` it also has a drag handle.
 */
export function OrderedRow(props: OrderedRowProps) {
  const reorderable = useReorderable();

  if (reorderable) return <SortableRow {...props} />;

  return (
    <TimelineItem published={props.published} lane="trunk">
      <RowBody {...props} />
    </TimelineItem>
  );
}
