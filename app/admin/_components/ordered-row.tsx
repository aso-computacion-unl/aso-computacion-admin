import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { Stamp, TimelineItem } from "./timeline-parts";

interface OrderedRowProps {
  published: boolean;
  /** 1-based place in the list: the order of the public site. */
  position: number;
  /** Names the row in links and buttons, e.g. the question or the person. */
  label: string;
  editHref: string;
  /** A thumbnail or avatar, left of the text. */
  media?: ReactNode;
  /** What the row says: its title and a line of detail. */
  children: ReactNode;
  toggle: ReactNode;
  move: ReactNode;
  remove: ReactNode;
}

/**
 * One commit of an ordered list (FAQ, pillars, socials, board, news): content on top, the four
 * things you can do below. On lg+ the same four parts sit in one row (number, content, move,
 * actions) so a wide card is not a tall one.
 */
export function OrderedRow({ published, position, label, editHref, media, children, toggle, move, remove }: OrderedRowProps) {
  return (
    <TimelineItem published={published} lane="trunk">
      <div className="grid gap-2.5 p-4 md:px-5 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center lg:gap-x-6 lg:py-3.5">
        <div className="flex items-center justify-between gap-3 lg:contents">
          <Stamp className="lg:order-1">{String(position).padStart(2, "0")}</Stamp>
          <div className="lg:order-3">{move}</div>
        </div>
        <div className="flex min-w-0 items-start gap-4 lg:order-2 lg:items-center">
          {media}
          <div className="grid min-w-0 flex-1 gap-1">{children}</div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 lg:order-4 lg:mt-0 lg:w-92 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          {toggle}
          <Button asChild variant="line" size="sm" className="ml-auto">
            <Link href={editHref} aria-label={`Editar: ${label}`}>
              <Icon name="edit" className="size-4" />
              Editar
            </Link>
          </Button>
          {remove}
        </div>
      </div>
    </TimelineItem>
  );
}
