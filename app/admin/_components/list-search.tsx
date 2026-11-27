import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listHref, SEARCH_MAX_LENGTH } from "@/interface/admin/list-params";
import type { StatusFilter } from "@/interface/admin/status-filter";

interface ListSearchProps {
  /**
   * The list's own path: the form is a plain GET to it, so a search is a URL anyone can share and it works without
   * scripts. Params it carries (the events tab, `?vista=`) are sent along as hidden fields.
   */
  path: string;
  filter: StatusFilter;
  search: string;
  /** What the list holds, for the label: "eventos", "preguntas". */
  label: string;
}

export function ListSearch({ path, filter, search, label }: ListSearchProps) {
  // A GET form drops the query of its action, so the params of the path travel as hidden fields.
  const [action = path, fixed = ""] = path.split("?");
  const inputId = `search-${action.split("/").pop()}`;

  return (
    // In a toolbar row it sits at the end (ml-auto) and, once the row wraps on a phone, fills its own line (grow).
    <form role="search" method="get" action={action} className="mt-6 ml-auto flex grow flex-wrap items-center gap-1.5 sm:grow-0">
      {[...new URLSearchParams(fixed)].map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {filter === "todos" ? null : <input type="hidden" name="estado" value={filter} />}
      <label htmlFor={inputId} className="sr-only">
        Buscar en {label}
      </label>
      <Input id={inputId} type="search" name="q" defaultValue={search} maxLength={SEARCH_MAX_LENGTH} placeholder={`Buscar en ${label}`} autoComplete="off" className="min-h-11 min-w-0 flex-1 basis-40 sm:w-72 sm:flex-none" />
      <Button type="submit" variant="line" className="shrink-0">
        Buscar
      </Button>
      {search === "" ? null : (
        <Link href={listHref(path, { filter })} className="inline-flex min-h-11 items-center rounded-xs px-2 text-sm text-mist underline underline-offset-4 hover:text-foreground">
          Quitar búsqueda
        </Link>
      )}
    </form>
  );
}
