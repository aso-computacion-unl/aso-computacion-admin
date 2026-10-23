import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A mono tag: a date, a position or a type. `solid` is the signal fill, reserved for what is yet to come. */
export function Stamp({ children, solid = false, className }: { children: ReactNode; solid?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center px-2.5 font-mono text-xs leading-none font-semibold tracking-[0.02em] tabular-nums",
        solid ? "bg-signal text-white" : "text-mist shadow-[inset_0_0_0_1px_var(--color-sky)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface TimelineItemProps {
  published: boolean;
  /** `next` paints the node in signal red: published and still to come. */
  when?: "next";
  /** `trunk` keeps a draft on the main line (ordered lists); events put drafts on their own branch. */
  lane?: "trunk";
  children: ReactNode;
}

/** One commit: a node on the line, a link to the card, and the card itself. */
export function TimelineItem({ published, when, lane, children }: TimelineItemProps) {
  return (
    <li className="tl-item" data-state={published ? "published" : "draft"} data-when={when} data-lane={lane}>
      <span className="tl-node" aria-hidden="true" />
      <span className="tl-link" aria-hidden="true" />
      <article className="tl-card">{children}</article>
    </li>
  );
}

/** A list whose order is the order on the public site: one lane, one commit per item. */
export function OrderedList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tl mt-6">
      <ol aria-label={label} className="tl-trunk pb-6">
        {children}
      </ol>
    </div>
  );
}

/** The empty state says what the list is for and offers the one next step. */
export function EmptyState({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <div role="status" className="mt-8 grid max-w-xl justify-items-start gap-4 border-l-2 border-dashed border-sky pl-5">
      <p className="text-mist">{children}</p>
      {action}
    </div>
  );
}
