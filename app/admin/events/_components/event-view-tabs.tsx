import Link from "next/link";

import { EVENT_VIEWS, eventViewPath, type EventView } from "@/interface/admin/events/event-views";
import { listHref } from "@/interface/admin/list-params";
import type { StatusFilter } from "@/interface/admin/status-filter";
import { cn } from "@/lib/utils";

const LABELS: Record<EventView, string> = { proximos: "Próximos", pasados: "Pasados" };

interface EventViewTabsProps {
  path: string;
  current: EventView;
  /** Rows of each tab under the filter and search in force. */
  counts: Record<EventView, number>;
  filter: StatusFilter;
  search: string;
}

/**
 * Próximos / Pasados, as links: each keeps the status filter and the search, and starts at the first page. Drawn as a
 * segmented control as wide as its two options, like the status filter beside it.
 */
export function EventViewTabs({ path, current, counts, filter, search }: EventViewTabsProps) {
  return (
    <nav aria-label="Vista de eventos">
      <ul className="inline-flex max-w-full gap-[3px] overflow-hidden rounded-segmented bg-field p-[3px]">
        {EVENT_VIEWS.map((view) => (
          <li key={view}>
            <Link
              href={listHref(eventViewPath(path, view), { filter, search })}
              aria-current={view === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-mist sm:px-4",
                "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground",
                "aria-[current=page]:bg-action aria-[current=page]:text-on-action",
              )}
            >
              {LABELS[view]}
              <span className="font-mono text-xs tabular-nums">{counts[view]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
