import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listHref, SEARCH_MAX_LENGTH } from "@/interface/admin/list-params";
import type { StatusFilter } from "@/interface/admin/status-filter";

interface ListSearchProps {
  /** The list's own path: the form is a plain GET to it, so a search is a URL anyone can share and it works without scripts. */
  path: string;
  filter: StatusFilter;
  search: string;
  /** What the list holds, for the label: "eventos", "preguntas". */
  label: string;
}

export function ListSearch({ path, filter, search, label }: ListSearchProps) {
  const inputId = `search-${path.split("/").pop()}`;

  return (
    <form role="search" method="get" action={path} className="mt-5 flex flex-wrap items-center gap-2">
      {filter === "todos" ? null : <input type="hidden" name="estado" value={filter} />}
      <label htmlFor={inputId} className="sr-only">
        Buscar en {label}
      </label>
      <Input id={inputId} type="search" name="q" defaultValue={search} maxLength={SEARCH_MAX_LENGTH} placeholder={`Buscar en ${label}`} autoComplete="off" className="min-h-11 w-full max-w-sm" />
      <Button type="submit" variant="line">
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
