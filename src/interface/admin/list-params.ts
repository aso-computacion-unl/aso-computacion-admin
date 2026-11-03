import type { ListCriteria } from "@/application";

import { filterHref, statusCriteria, type StatusFilter } from "./status-filter";

/** Rows per page of every admin list. */
export const PAGE_SIZE = 20;
export const SEARCH_MAX_LENGTH = 80;
/** Far beyond any real list; it only keeps `(page - 1) * PAGE_SIZE` far from overflowing. */
export const MAX_PAGE = 10_000;

/** A search param as Next hands it over. */
type Raw = string | string[] | undefined;

export interface ListParams {
  search: string;
  page: number;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

/** `?q=`: trimmed, whitespace collapsed, control characters dropped, cut to the maximum. A repeated param means no search. */
export function parseSearch(raw: Raw): string {
  if (typeof raw !== "string") return "";

  return raw.replace(/\s+/g, " ").replace(CONTROL_CHARACTERS, "").trim().slice(0, SEARCH_MAX_LENGTH).trim();
}

/** `?pagina=`: a plain positive integer, else the first page. The server clamps it to the last page that exists. */
export function parsePage(raw: Raw): number {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return 1;

  return raw.length > 5 ? MAX_PAGE : Math.min(Number(raw), MAX_PAGE);
}

export function parseListParams(searchParams: { q?: Raw; pagina?: Raw }): ListParams {
  return { search: parseSearch(searchParams.q), page: parsePage(searchParams.pagina) };
}

interface ListHrefParts {
  filter?: StatusFilter;
  search?: string;
  page?: number;
}

/** The URL of a list view. Defaults are left out, so the plain list has one URL and every view is shareable. */
export function listHref(path: string, { filter = "todos", search = "", page = 1 }: ListHrefParts): string {
  const [, query = ""] = filterHref(path, filter).split("?");
  const params = new URLSearchParams(query);

  if (search !== "") params.set("q", search);
  if (page > 1) params.set("pagina", String(page));

  const text = params.toString();

  return text === "" ? path : `${path}?${text}`;
}

/** What the repository is asked for: the status filter and the search, each only when set. */
export function listCriteria(filter: StatusFilter, search: string): ListCriteria {
  return { ...statusCriteria(filter), ...(search === "" ? {} : { search }) };
}
