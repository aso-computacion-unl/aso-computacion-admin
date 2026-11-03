import Link from "next/link";

import type { PublicationCounts } from "@/application";
import { listHref } from "@/interface/admin/list-params";
import { STATUS_FILTERS, type StatusFilter as Filter } from "@/interface/admin/status-filter";
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
  /** The search in force: every option keeps it, and drops the page (a new filter starts at the first one). */
  search?: string;
}

export function StatusFilter({ path, current, counts, search = "" }: StatusFilterProps) {
  return (
    <nav aria-label="Filtrar por estado" className="mt-5">
      <ul className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <li key={filter}>
            <Link
              href={listHref(path, { filter, search })}
              aria-current={filter === current ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded border border-input px-3.5 text-sm font-semibold text-mist",
                "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                "aria-[current=true]:border-action aria-[current=true]:bg-action aria-[current=true]:text-on-action",
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

/** What a filtered or searched list says when nothing matches, with the way back. */
export function FilterEmpty({ path, filter, noun, search = "" }: { path: string; filter: Filter; noun: string; search?: string }) {
  const state = filter === "publicados" ? " publicados" : filter === "borradores" ? " en borrador" : "";

  if (search !== "") {
    return (
      <p role="status" className="mt-8 max-w-xl text-mist">
        No hay {noun}
        {state} que coincidan con «{search}».{" "}
        <Link href={listHref(path, { filter })} className="rounded-xs text-foreground underline underline-offset-4">
          Quitar la búsqueda
        </Link>
      </p>
    );
  }

  return (
    <p role="status" className="mt-8 max-w-xl text-mist">
      No hay {noun}
      {state}.{" "}
      <Link href={path} className="rounded-xs text-foreground underline underline-offset-4">
        Ver todos
      </Link>
    </p>
  );
}
