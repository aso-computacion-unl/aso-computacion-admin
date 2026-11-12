import Link from "next/link";

import type { ForumMembersPage } from "@/application/forum/forum-members.use-cases";
import { FORUM_MEMBERS_PAGE_SIZE } from "@/application/forum/forum-members.use-cases";
import { memberListHref, type MemberListParams } from "@/interface/admin/forum/member-list-params";
import { pluralize } from "@/interface/admin/publication-summary";
import { cn } from "@/lib/utils";

const STEP_CLASSES = cn(
  "inline-flex min-h-11 items-center rounded border border-input px-3.5 text-sm font-semibold text-mist transition-colors duration-150 ease-out",
  "hover:bg-foreground/6 hover:text-foreground aria-disabled:border-dashed aria-disabled:text-mist/60 aria-disabled:hover:bg-transparent",
);

/** Where the list stands (which rows, how many results) and the two steps through its pages, as links that keep the filter and the search. */
export function MembersPager({ filter, search, page }: Pick<MemberListParams, "filter" | "search"> & { page: Pick<ForumMembersPage, "page" | "pageCount" | "total"> }) {
  const { total, pageCount } = page;
  const first = (page.page - 1) * FORUM_MEMBERS_PAGE_SIZE + 1;
  const last = Math.min(page.page * FORUM_MEMBERS_PAGE_SIZE, total);
  const href = (target: number) => memberListHref({ filter, search, page: target });
  const searching = search !== "";

  if (pageCount === 1 && !searching) return null;

  return (
    <nav aria-label="Páginas de miembros" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mist">
      <p role="status">
        {searching ? `${pluralize(total, "resultado", "resultados")} para «${search}». ` : null}
        {total > 0 && pageCount > 1 ? `Mostrando ${first}–${last} de ${total}.` : null}
      </p>
      {pageCount > 1 ? (
        <>
          {page.page > 1 ? (
            <Link href={href(page.page - 1)} rel="prev" className={STEP_CLASSES}>
              Anteriores
            </Link>
          ) : (
            <span aria-disabled="true" className={STEP_CLASSES}>
              Anteriores
            </span>
          )}
          <span className="font-mono tabular-nums">
            Página {page.page} de {pageCount}
          </span>
          {page.page < pageCount ? (
            <Link href={href(page.page + 1)} rel="next" className={STEP_CLASSES}>
              Siguientes
            </Link>
          ) : (
            <span aria-disabled="true" className={STEP_CLASSES}>
              Siguientes
            </span>
          )}
        </>
      ) : null}
    </nav>
  );
}
