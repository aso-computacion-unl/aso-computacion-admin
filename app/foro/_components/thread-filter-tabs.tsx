import Link from "next/link";

import { Icon } from "@/components/icons";
import type { ThreadFilter } from "@/interface/forum/forum-display";
import { categoryHref } from "@/interface/forum/forum-links";
import { cn } from "@/lib/utils";

interface ThreadFilterTabsProps {
  slug: string;
  active: ThreadFilter;
  /** Per-filter counts of the shown page; omitted when the category spans several pages (they would mislead). */
  counts?: Record<ThreadFilter, number>;
}

const TABS = [
  { filter: "open", label: "Abiertos", icon: "dot" },
  { filter: "solved", label: "Resueltos", icon: "merge" },
] as const;

/** Abiertos / Resueltos as two links: the filter lives in the URL, works without scripts and can be shared. */
export function ThreadFilterTabs({ slug, active, counts }: ThreadFilterTabsProps) {
  return (
    <nav aria-label="Estado de los hilos" className="flex gap-1">
      {TABS.map(({ filter, label, icon }) => {
        const current = filter === active;

        return (
          <Link
            key={filter}
            href={categoryHref(slug, { filter })}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold transition-colors",
              current ? "bg-card text-foreground shadow-[inset_0_-2px_0_var(--color-sky)]" : "text-mist hover:bg-card/60 hover:text-foreground",
            )}
          >
            <Icon name={icon} className="size-4.5" />
            {label}
            {counts ? <span className="min-w-6 rounded-full bg-sky/20 px-1.5 text-center font-mono text-xs leading-6 text-foreground">{counts[filter]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
