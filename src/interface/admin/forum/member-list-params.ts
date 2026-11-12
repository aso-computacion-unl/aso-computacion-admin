import type { ForumMemberFilter } from "@/application/forum/forum-members.use-cases";

import { parsePage, parseSearch } from "../list-params";

type Param = string | string[] | undefined;

export const MEMBERS_PATH = "/admin/foro/miembros";

export interface MemberListParams {
  filter: ForumMemberFilter;
  search: string;
  page: number;
}

/** The query string of the members list, reduced to what it can mean: all or only the suspended, a search and a page number. */
export function parseMemberListParams(params: { estado?: Param; q?: Param; pagina?: Param }): MemberListParams {
  const estado = Array.isArray(params.estado) ? params.estado[0] : params.estado;

  return { filter: estado === "suspendidos" ? "suspended" : "all", search: parseSearch(params.q), page: parsePage(params.pagina) };
}

/** Link to a view of the members list; defaults are left out, so the plain list is the bare path. */
export function memberListHref({ filter, search, page }: MemberListParams): string {
  const query = new URLSearchParams();

  if (filter === "suspended") query.set("estado", "suspendidos");
  if (search !== "") query.set("q", search);
  if (page > 1) query.set("pagina", String(page));

  const text = query.toString();

  return text ? `${MEMBERS_PATH}?${text}` : MEMBERS_PATH;
}
