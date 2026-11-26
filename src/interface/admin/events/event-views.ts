import { fetchPage, type Page } from "@/application";

import { PAGE_SIZE } from "../list-params";
import { groupEvents, type TimelineEvent } from "./event-timeline";

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

export interface EventViews<E> {
  /** Unpublished, most recently edited first. */
  drafts: E[];
  /** Published, today or later, soonest first: page 1 shows what happens next. */
  upcoming: E[];
  /** Próximos: the drafts (work in progress, whatever their date), then the upcoming ones. */
  proximos: E[];
  /** Pasados: published before today, most recent first, the undated ones last. */
  pasados: E[];
}

/** The rows of each tab, split once by `groupEvents` (the one place that tells past from upcoming). */
export function eventViews<E extends TimelineEvent>(events: readonly E[], today: string): EventViews<E> {
  const { drafts, upcoming, past } = groupEvents(events, today);

  return { drafts, upcoming, proximos: [...drafts, ...upcoming], pasados: past };
}

/** One page of a tab's rows, with the same page size and clamping as every admin list. */
export function eventViewPage<E>(rows: readonly E[], page: number): Promise<Page<E>> {
  return fetchPage(
    { page, pageSize: PAGE_SIZE },
    async () => rows.length,
    async (limit, offset) => rows.slice(offset, offset + limit),
  );
}
