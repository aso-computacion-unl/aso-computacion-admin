import type { ListCriteria } from "@/application";

/** Values of the `?estado=` search param; they are also what the filter's links say. */
export const STATUS_FILTERS = ["todos", "publicados", "borradores"] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** The param as Next hands it over. Anything unknown, or repeated, means "todos": the filter never errors. */
export function parseStatusFilter(raw: string | string[] | undefined): StatusFilter {
  return STATUS_FILTERS.find((filter) => filter === raw) ?? "todos";
}

export function statusCriteria(filter: StatusFilter): ListCriteria {
  if (filter === "publicados") return { status: "published" };
  if (filter === "borradores") return { status: "draft" };

  return {};
}

/** "Todos" is the bare path, so the unfiltered list has a single URL. */
export function filterHref(path: string, filter: StatusFilter): string {
  return filter === "todos" ? path : `${path}?estado=${filter}`;
}
