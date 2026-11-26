import { fetchPage, type Page } from "@/application";

import { PAGE_SIZE } from "../list-params";

/** Values of the events list's `?vista=` param: the two tabs. */
export const EVENT_VIEWS = ["proximos", "pasados"] as const;

export type EventView = (typeof EVENT_VIEWS)[number];

/** The param as Next hands it over. Anything but exactly `pasados` (unknown, repeated, missing) is Próximos. */
export function parseEventView(raw: string | string[] | undefined): EventView {
  return raw === "pasados" ? "pasados" : "proximos";
}

/** The list path of a tab. Próximos is the bare path, so the default tab has a single URL. */
export function eventViewPath(path: string, view: EventView): string {
  return view === "proximos" ? path : `${path}?vista=${view}`;
}

/**
 * The rows of each tab, from `groupEvents` (the one place that tells past from upcoming): Próximos holds the drafts
 * (work in progress, whatever their date) and then the upcoming ones; Pasados the past and the undated ones.
 */
export function eventViews<E>(groups: { drafts: readonly E[]; upcoming: readonly E[]; past: readonly E[] }): Record<EventView, E[]> {
  return { proximos: [...groups.drafts, ...groups.upcoming], pasados: [...groups.past] };
}

/** One page of a tab's rows, with the same page size and clamping as every admin list. */
export function eventViewPage<E>(rows: readonly E[], page: number): Promise<Page<E>> {
  return fetchPage(
    { page, pageSize: PAGE_SIZE },
    async () => rows.length,
    async (limit, offset) => rows.slice(offset, offset + limit),
  );
}
