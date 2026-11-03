import { formatEventDate, groupEvents, todayInLoja } from "./events/event-timeline";

const UPCOMING_LIMIT = 3;
const DRAFTS_LIMIT = 5;

interface AgendaEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string | null;
  datePrecision: "day" | "month";
  isPublished: boolean;
  publishAt: Date | null;
  registrationMode: string;
  updatedAt: Date;
}

interface AgendaNewsItem {
  id: string;
  title: string;
  isPublished: boolean;
  publishAt: Date | null;
  updatedAt: Date;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  /** "27 oct 2026", or "nov 2026" for a month-only date. */
  when: string;
  href: string;
  /** The event takes registrations, so it has a list to watch. */
  registration: boolean;
}

export interface PendingDraft {
  id: string;
  kind: "Evento" | "Noticia";
  title: string;
  href: string;
  /** Unpublished, but set to publish by itself later. */
  scheduled: boolean;
}

export interface HomeAgenda {
  upcoming: UpcomingEvent[];
  upcomingTotal: number;
  drafts: PendingDraft[];
  draftsTotal: number;
  /** Open forum reports, or null when the queue could not be read. */
  openReports: number | null;
  needsAttention: boolean;
}

/**
 * What the admin home leads with: the work waiting for someone (drafts, open reports) and the events
 * coming up. The module counts live in the sidebar, so the home does not repeat them as its headline.
 */
export function buildHomeAgenda({ events, news, openReports, now }: { events: readonly AgendaEvent[]; news: readonly AgendaNewsItem[]; openReports: number | null; now: Date }): HomeAgenda {
  const groups = groupEvents(events, todayInLoja(now));
  // groupEvents orders the upcoming ones newest first, like the list; the home wants the soonest first.
  const upcoming = [...groups.upcoming].reverse();
  const scheduled = (item: { publishAt: Date | null }) => item.publishAt !== null && item.publishAt.getTime() > now.getTime();
  const drafts = [
    ...events.filter((item) => !item.isPublished).map((item) => ({ item, kind: "Evento" as const, href: `/admin/events/${item.id}/edit` })),
    ...news.filter((item) => !item.isPublished).map((item) => ({ item, kind: "Noticia" as const, href: `/admin/news/${item.id}/edit` })),
  ].sort((a, b) => b.item.updatedAt.getTime() - a.item.updatedAt.getTime());

  return {
    upcoming: upcoming.slice(0, UPCOMING_LIMIT).map((item) => ({
      id: item.id,
      title: item.title,
      when: formatEventDate(item.date, item.datePrecision),
      href: `/admin/events/${item.id}/edit`,
      registration: item.registrationMode !== "none",
    })),
    upcomingTotal: upcoming.length,
    drafts: drafts.slice(0, DRAFTS_LIMIT).map(({ item, kind, href }) => ({ id: item.id, kind, title: item.title, href, scheduled: scheduled(item) })),
    draftsTotal: drafts.length,
    openReports,
    needsAttention: drafts.length > 0 || (openReports ?? 0) > 0,
  };
}
