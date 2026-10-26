import Link from "next/link";

import type { PublicationCounts } from "@/application";
import { filterHref, STATUS_FILTERS, type StatusFilter as Filter } from "@/interface/admin/status-filter";
import { cn } from "@/lib/utils";

const LABELS: Record<Filter, string> = { todos: "Todos", publicados: "Publicados", borradores: "Borradores" };

function countFor(filter: Filter, counts: PublicationCounts): number {
  if (filter === "publicados") return counts.published;
  if (filter === "borradores") return counts.draft;

  return counts.published + counts.draft;
}

interface StatusFilterProps {
  /** The list's own path: each option is a link to it with `?estado=`, so the server does the filtering. */
  path: string;
  current: Filter;
  counts: PublicationCounts;
}

export function StatusFilter({ path, current, counts }: StatusFilterProps) {
  return (
    <nav aria-label="Filtrar por estado" className="mt-5">
      <ul className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <li key={filter}>
            <Link
              href={filterHref(path, filter)}
              aria-current={filter === current ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded border border-input px-3.5 text-sm font-semibold text-mist",
                "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                "aria-[current=true]:border-sky aria-[current=true]:bg-sky aria-[current=true]:text-primary-foreground",
              )}
            >
              {LABELS[filter]}
              <span className="font-mono text-xs tabular-nums">{countFor(filter, counts)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** What a filtered list says when nothing matches, with the way back to the whole list. */
export function FilterEmpty({ path, filter, noun }: { path: string; filter: Filter; noun: string }) {
  return (
    <p role="status" className="mt-8 max-w-xl text-mist">
      No hay {noun} {filter === "publicados" ? "publicados" : "en borrador"}.{" "}
      <Link href={path} className="rounded-xs text-foreground underline underline-offset-4">
        Ver todos
      </Link>
    </p>
  );
}
