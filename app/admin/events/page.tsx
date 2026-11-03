import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { EventListItemResult } from "@/application";
import { groupEvents, todayInLoja, formatEventDate } from "@/interface/admin/events/event-timeline";
import { getAdminEventCounts, getAdminEvents } from "@/interface/admin/events/events-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";
import { parseStatusFilter, statusCriteria } from "@/interface/admin/status-filter";

import { EmptyState, Stamp, TimelineItem } from "../_components/timeline-parts";
import { PageHead } from "../_components/page-head";
import { FilterEmpty, StatusFilter } from "../_components/status-filter";
import { EventDeleteButton } from "./_components/event-delete-button";
import { EventPublishedToggle } from "./_components/event-published-toggle";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  taller: "Taller",
  charla: "Charla",
  evento: "Evento",
  comunidad: "Comunidad",
};

function GroupTitle({ id, title, hint }: { id: string; title: string; hint: string }) {
  return (
    <div className="tl-group-title">
      <h2 id={id} className="text-[0.8125rem] font-bold font-stretch-[118%] tracking-[0.04em] text-mist uppercase">
        {title}
      </h2>
      <p className="text-sm text-mist">{hint}</p>
    </div>
  );
}

/** One event as a commit: date stamp, type, state, title, the joke message, and what can be done with it. */
function EventCommit({ event, when }: { event: EventListItemResult; when?: "next" }) {
  return (
    <TimelineItem published={event.isPublished} when={when}>
      <div className="grid gap-2.5 p-4 md:px-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_auto] lg:items-center lg:gap-x-8 lg:py-4">
        <div className="grid min-w-0 gap-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Stamp solid={when === "next"}>{formatEventDate(event.date, event.datePrecision)}</Stamp>
            {event.type ? (
              <span className="inline-flex h-6 items-center rounded-xs bg-muted px-2 font-mono text-xs leading-none">{TYPE_LABELS[event.type]}</span>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[0.8125rem] text-mist lg:ml-3">
              <Icon name="image" className="size-4" />
              {pluralize(event.photoCount, "foto", "fotos")}
            </span>
          </div>
          <h3 className="font-display text-lg leading-tight wrap-anywhere lg:text-xl">
            <Link href={`/admin/events/${event.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
              {event.title}
            </Link>
          </h3>
          {event.commitMessage ? <p className="font-mono text-[0.8125rem] leading-snug wrap-anywhere text-sky">$ {event.commitMessage}</p> : null}
        </div>
        {event.description ? <p className="hidden line-clamp-3 text-sm text-mist lg:block">{event.description}</p> : <span className="hidden lg:block" />}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 lg:mt-0 lg:flex-nowrap lg:w-96 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <EventPublishedToggle eventId={event.id} title={event.title} isPublished={event.isPublished} />
          <Button asChild variant="line" size="sm" className="ml-auto">
            <Link href={`/admin/events/${event.id}/edit`} aria-label={`Editar: ${event.title}`}>
              <Icon name="edit" className="size-4" />
              Editar
            </Link>
          </Button>
          <EventDeleteButton eventId={event.id} title={event.title} />
        </div>
      </div>
    </TimelineItem>
  );
}

function Legend() {
  return (
    <ul aria-label="Cómo leer la línea" className="flex flex-wrap gap-x-6 gap-y-1.5 border-y border-border py-3.5 text-sm text-mist">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 rounded-full bg-sky" />
        <span>Publicado<span className="hidden sm:inline">: ya está en el sitio</span></span>
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 rounded-full bg-signal" />
        <span>Próximo<span className="hidden sm:inline">: publicado, aún no ocurre</span></span>
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 rounded-full border-2 border-dashed border-sky" />
        <span>Borrador<span className="hidden sm:inline">: solo lo ve la directiva</span></span>
      </li>
    </ul>
  );
}

interface EventsTimelineProps {
  drafts: EventListItemResult[];
  upcoming: EventListItemResult[];
  past: EventListItemResult[];
  today: string;
  /** False when only drafts are listed: the main line has nothing to show then. */
  showMainLine: boolean;
}

function EventsTimeline({ drafts, upcoming, past, today, showMainLine }: EventsTimelineProps) {
  return (
    <>
      <div className="mt-5">
        <Legend />
      </div>

      <div className="tl mt-6">
        {drafts.length > 0 ? (
          <>
            <section className="tl-drafts" aria-labelledby="h-drafts">
              <GroupTitle id="h-drafts" title="Borradores" hint="Rama aparte. Al publicar, el evento se une a la línea principal." />
              <ol className="tl-list">
                {drafts.map((event) => (
                  <EventCommit key={event.id} event={event} />
                ))}
              </ol>
            </section>
            {showMainLine ? (
              <div className="tl-bend" aria-hidden="true">
                <svg viewBox="0 0 56 40" preserveAspectRatio="none">
                  <path d="M14 0C14 22 42 18 42 40" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            ) : null}
          </>
        ) : null}

        {showMainLine ? (
          <div className="tl-trunk">
            <section aria-labelledby="h-upcoming">
              <GroupTitle id="h-upcoming" title="Próximos" hint="Publicados, todavía no ocurren." />
              {upcoming.length > 0 ? (
                <ol className="tl-list">
                  {upcoming.map((event) => (
                    <EventCommit key={event.id} event={event} when="next" />
                  ))}
                </ol>
              ) : (
                <p className="ml-(--lane) py-2 pb-3 text-mist">Sin eventos próximos. Publique un borrador para verlo aquí.</p>
              )}
            </section>

            <div className="tl-head" role="separator" aria-label={`Hoy, ${formatEventDate(today)}`}>
              <span className="tl-node" aria-hidden="true" />
              <span className="tl-link" aria-hidden="true" />
              <p className="relative z-1 col-start-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-1 rounded bg-muted px-4 py-2.5 text-[0.9375rem]">
                <span className="font-mono text-[0.8125rem] font-semibold text-sky">HEAD → main</span>
                <strong>Hoy · {formatEventDate(today)}</strong>
                <span className="text-sm text-mist">Arriba lo que viene; abajo lo que ya pasó.</span>
              </p>
            </div>

            <section aria-labelledby="h-past">
              <GroupTitle id="h-past" title="Pasados" hint="Publicados, del más reciente al más antiguo." />
              {past.length > 0 ? (
                <ol className="tl-list">
                  {past.map((event) => (
                    <EventCommit key={event.id} event={event} />
                  ))}
                </ol>
              ) : (
                <p className="ml-(--lane) py-2 pb-3 text-mist">Sin eventos pasados todavía.</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
}

const LIST_PATH = "/admin/events";

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ estado?: string | string[] }> }) {
  const filter = parseStatusFilter((await searchParams).estado);
  const [events, counts] = await Promise.all([getAdminEvents(statusCriteria(filter)), getAdminEventCounts()]);
  const today = todayInLoja(new Date());
  const { drafts, upcoming, past } = groupEvents(events, today);
  // Drafts have their own branch; with only drafts asked for, the main line has nothing to show.
  const showMainLine = filter !== "borradores";

  return (
    <>
      <PageHead
        title="Eventos"
        meta={`main · ${pluralize(counts.published, "publicado", "publicados")} · ${pluralize(counts.draft, "borrador", "borradores")}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/events/new">
              <Icon name="plus" />
              Nuevo evento
            </Link>
          </Button>
        }
      />

      {counts.published + counts.draft === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/admin/events/new">
                <Icon name="plus" />
                Crear el primer evento
              </Link>
            </Button>
          }
        >
          Todavía no hay eventos. Cada evento es un commit en la historia de ASO: título, fecha y fotos.
        </EmptyState>
      ) : (
        <>
          <StatusFilter path={LIST_PATH} current={filter} counts={counts} />
          {events.length === 0 ? (
            <FilterEmpty path={LIST_PATH} filter={filter} noun="eventos" />
          ) : (
            <EventsTimeline drafts={drafts} upcoming={upcoming} past={past} today={today} showMainLine={showMainLine} />
          )}
        </>
      )}
    </>
  );
}
