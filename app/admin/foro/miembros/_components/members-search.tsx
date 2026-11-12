import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEARCH_MAX_LENGTH } from "@/interface/admin/list-params";
import { MEMBERS_PATH, memberListHref, type MemberListParams } from "@/interface/admin/forum/member-list-params";

/** The search of the members list: a plain GET to the list, so a search is a URL anyone can share and it works without scripts. */
export function MembersSearch({ filter, search }: Pick<MemberListParams, "filter" | "search">) {
  return (
    <form role="search" method="get" action={MEMBERS_PATH} className="mt-5 flex flex-wrap items-center gap-2">
      {filter === "all" ? null : <input type="hidden" name="estado" value="suspendidos" />}
      <label htmlFor="search-miembros" className="sr-only">
        Buscar por nombre o correo
      </label>
      <Input
        id="search-miembros"
        type="search"
        name="q"
        defaultValue={search}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder="Buscar por nombre o correo"
        autoComplete="off"
        className="min-h-11 min-w-0 flex-1 basis-40 sm:w-72 sm:flex-none [:root[data-theme=light]_&]:bg-card"
      />
      <Button type="submit" variant="line" className="shrink-0">
        Buscar
      </Button>
      {search === "" ? null : (
        <Link href={memberListHref({ filter, search: "", page: 1 })} className="inline-flex min-h-11 items-center rounded-xs px-2 text-sm text-mist underline underline-offset-4 hover:text-foreground">
          Quitar búsqueda
        </Link>
      )}
    </form>
  );
}
