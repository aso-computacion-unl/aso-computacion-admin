import Link from "next/link";

import type { Page } from "@/application";
import { listHref } from "@/interface/admin/list-params";
import type { StatusFilter } from "@/interface/admin/status-filter";
import { pluralize } from "@/interface/admin/publication-summary";
import { cn } from "@/lib/utils";

interface PagerProps {
  path: string;
  filter: StatusFilter;
  search: string;
  page: Pick<Page<unknown>, "page" | "pageCount" | "pageSize" | "total">;
}

const STEP_CLASSES = cn(
  "inline-flex min-h-11 items-center rounded border border-input px-3.5 text-sm font-semibold text-mist transition-colors duration-150 ease-out",
  "hover:bg-foreground/6 hover:text-foreground aria-disabled:border-dashed aria-disabled:text-mist/60 aria-disabled:hover:bg-transparent",
);

/** Where the list stands (which rows, how many results) and the two steps through its pages, as links that keep the filter and the search. */
export function Pager({ path, filter, search, page }: PagerProps) {
  const { total, pageSize, pageCount } = page;
  const first = (page.page - 1) * pageSize + 1;
  const last = Math.min(page.page * pageSize, total);
  const href = (target: number) => listHref(path, { filter, search, page: target });
  const searching = search !== "";

  if (pageCount === 1 && !searching) return null;

  return (
    <nav aria-label="Paginación" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mist">
      <p role="status">
        {searching ? `${pluralize(total, "resultado", "resultados")} para «${search}». ` : null}
        {total > 0 && pageCount > 1 ? `Mostrando ${first}–${last} de ${total}.` : null}
      </p>
      {pageCount > 1 ? (
        <>
          {page.page > 1 ? (
            <Link href={href(page.page - 1)} rel="prev" className={STEP_CLASSES}>
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className={STEP_CLASSES}>
              Anterior
            </span>
          )}
          <span className="font-mono tabular-nums">
            Página {page.page} de {pageCount}
          </span>
          {page.page < pageCount ? (
            <Link href={href(page.page + 1)} rel="next" className={STEP_CLASSES}>
              Siguiente
            </Link>
          ) : (
            <span aria-disabled="true" className={STEP_CLASSES}>
              Siguiente
            </span>
          )}
        </>
      ) : null}
    </nav>
  );
}
