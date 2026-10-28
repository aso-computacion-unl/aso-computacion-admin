import Link from "next/link";

import { Icon } from "@/components/icons";
import type { ThreadFilter } from "@/interface/forum/forum-display";
import { cn } from "@/lib/utils";

interface ThreadFilterTabsProps {
  /** `null` on a page that is not the list (the registrations): no tab is current. */
  active: ThreadFilter | null;
  /** The URL of each tab: the list decides which parameters travel with it. */
  hrefFor: (filter: ThreadFilter) => string;
  /** Per-filter counts; omitted when they would mislead (a category list spanning several pages). */
  counts?: Record<ThreadFilter, number>;
  /** Stacked in the side rail of wide screens; side by side on top of the list otherwise. */
  orientation?: "horizontal" | "vertical";
}

const TABS = [
  { filter: "open", label: "Abiertos", icon: "dot" },
  { filter: "solved", label: "Resueltos", icon: "merge" },
] as const;

/** Abiertos / Resueltos as two links: the filter lives in the URL, works without scripts and can be shared. */
export function ThreadFilterTabs({ active, hrefFor, counts, orientation = "horizontal" }: ThreadFilterTabsProps) {
  const vertical = orientation === "vertical";

  return (
    <nav aria-label="Estado de los hilos" className={cn("flex gap-1", vertical && "flex-col")}>
      {TABS.map(({ filter, label, icon }) => {
        const current = filter === active;

        return (
          <Link
            key={filter}
            href={hrefFor(filter)}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold transition-colors",
              vertical ? "hover:bg-muted/70" : "hover:bg-card/60",
              current ? (vertical ? "bg-muted text-foreground shadow-[inset_3px_0_0_var(--color-signal)]" : "bg-card text-foreground shadow-[inset_0_-2px_0_var(--color-signal)]") : "text-mist hover:text-foreground",
            )}
          >
            <Icon name={icon} className="size-4.5" />
            {label}
            {counts ? <span className={cn("min-w-6 rounded-full bg-foreground/12 px-1.5 text-center font-mono text-xs leading-6 text-foreground", vertical && "ml-auto")}>{counts[filter]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
