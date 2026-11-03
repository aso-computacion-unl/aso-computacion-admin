import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode, type Ref } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BulkCheckbox } from "./bulk-selection";
import { TimelineItem } from "./timeline-parts";

export interface ListRowProps {
  /** The item's id: what a bulk selection names it by. */
  id: string;
  /** Names the row in links and buttons, e.g. the question, the person or the event. */
  label: string;
  published: boolean;
  /** `next` paints the node in signal red: published and still to come. */
  when?: "next";
  /** `trunk` keeps a draft on the main line (ordered lists); events put drafts on their own branch. */
  lane?: "trunk";
  /** The drag handle of a reorderable row. */
  handle?: ReactNode;
  /** What places the row: a date stamp or its number in the list. */
  lead: ReactNode;
  /** A thumbnail or avatar, left of the text. */
  media?: ReactNode;
  /** What the row says: its title and the lines of detail under it. */
  children?: ReactNode;
  toggle: ReactNode;
  /** Absent while the list is searched: moving a row past neighbours that are hidden would be a guess. */
  move?: ReactNode;
  remove: ReactNode;
  editHref: string;
  itemRef?: Ref<HTMLLIElement>;
  style?: CSSProperties;
  dragging?: boolean;
}

/*
 * One row of every admin list (events, news, FAQ, board...). Below 84rem the three parts stack: the lead and its
 * checkbox on top, the text, then one actions area; from 84rem they sit in one line: lead | text | [move] | actions.
 * The actions area holds the publish toggle, Editar and a compact removal, in a fixed width so Editar lines up
 * from row to row.
 *
 * The slots (media, toggle, remove) are wrapped in keyed fragments: a row the server streams in pieces hands them
 * over as lazy elements without a key, and React's development build reports each one next to its siblings as a
 * list child ("Each child in a list should have a unique key") even though none of them is a list.
 */
export function ListRow({ id, label, published, when, lane, handle, lead, media, children, toggle, move, remove, editHref, itemRef, style, dragging }: ListRowProps) {
  return (
    <TimelineItem published={published} when={when} lane={lane} itemRef={itemRef} style={style} dragging={dragging}>
      <div
        data-slot="list-row"
        className={cn(
          "grid gap-2.5 p-4 md:px-5 min-[84rem]:items-center min-[84rem]:gap-x-6 min-[84rem]:py-3.5",
          move ? "min-[84rem]:grid-cols-[10rem_minmax(0,1fr)_auto_auto]" : "min-[84rem]:grid-cols-[10rem_minmax(0,1fr)_auto]",
        )}
      >
        <div className="flex items-center justify-between gap-3 min-[84rem]:contents">
          <div className="flex items-center gap-2 min-[84rem]:order-1">
            {handle}
            <BulkCheckbox id={id} label={label} />
            {lead}
          </div>
          {move ? <div className="min-[84rem]:order-3">{move}</div> : null}
        </div>
        <div className="flex min-w-0 items-start gap-4 min-[84rem]:order-2 min-[84rem]:items-center">
          <Fragment key="media">{media}</Fragment>
          <div className="grid min-w-0 flex-1 gap-1">{children}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 min-[84rem]:order-4 min-[84rem]:mt-0 min-[84rem]:w-84 min-[84rem]:border-t-0 min-[84rem]:gap-x-3 min-[84rem]:border-l min-[84rem]:pt-0 min-[84rem]:pl-6">
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
    </TimelineItem>
  );
}

/** The end of a short list: where the next row goes, instead of an empty page. Lines up with the cards of the timeline. */
export function AddRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="tl mt-1.5">
      <Link
        href={href}
        data-slot="add-row"
        className="ml-(--lane) flex min-h-14 items-center gap-3 rounded border border-dashed border-sky/70 px-5 font-semibold text-mist transition-colors duration-150 ease-out hover:border-sky hover:bg-sky/10 hover:text-foreground"
      >
        <Icon name="plus" className="size-4 text-sky" />
        {children}
      </Link>
    </div>
  );
}
