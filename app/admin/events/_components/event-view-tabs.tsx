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

/** Próximos / Pasados, as links: each keeps the status filter and the search, and starts at the first page. */
export function EventViewTabs({ path, current, counts, filter, search }: EventViewTabsProps) {
  return (
    <nav aria-label="Vista de eventos">
      <ul className="flex flex-wrap gap-2">
        {EVENT_VIEWS.map((view) => (
          <li key={view}>
            <Link
              href={listHref(eventViewPath(path, view), { filter, search })}
              aria-current={view === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded border border-input px-3.5 text-sm font-semibold text-mist",
                "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                "aria-[current=page]:border-action aria-[current=page]:bg-action aria-[current=page]:text-on-action",
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
