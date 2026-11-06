import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { EventListItemResult } from "@/application";
import { groupEvents, todayInLoja, formatEventDate } from "@/interface/admin/events/event-timeline";
import { getAdminEventCounts, getAdminEventsPage } from "@/interface/admin/events/events-admin-read";
import { windowBadge } from "@/interface/admin/publication-window-badge";
import { pluralize } from "@/interface/admin/publication-summary";
import { listCriteria, parseListParams, showListTools } from "@/interface/admin/list-params";
import { parseStatusFilter } from "@/interface/admin/status-filter";

import { EmptyState } from "../_components/empty-state";
import { Stamp } from "../_components/timeline-parts";
import { WindowBadge } from "../_components/window-badge";
import { PageHeader } from "../_components/page-header";
import { SectionTitle } from "../_components/section-title";
import { BulkSelection } from "../_components/bulk-selection";
import { AddRow, ListRow } from "../_components/list-row";
import { ListSearch } from "../_components/list-search";
import { Pager } from "../_components/pager";
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
      <SectionTitle id={id} variant="label">
        {title}
      </SectionTitle>
      <p className="text-sm text-mist">{hint}</p>
    </div>
  );
}

/** One event as a commit: date stamp, title, the joke message, what it is, and what can be done with it. */
function EventCommit({ event, when }: { event: EventListItemResult; when?: "next" }) {
  const typeLabel = event.type ? TYPE_LABELS[event.type] : undefined;

  return (
    <ListRow
      id={event.id}
      label={event.title}
      published={event.isPublished}
      when={when}
      lead={<Stamp solid={when === "next"}>{formatEventDate(event.date, event.datePrecision)}</Stamp>}
      toggle={<EventPublishedToggle eventId={event.id} title={event.title} isPublished={event.isPublished} />}
      editHref={`/admin/events/${event.id}/edit`}
      remove={<EventDeleteButton eventId={event.id} title={event.title} />}
    >
      <h3 className="font-display text-lg leading-tight wrap-anywhere min-[84rem]:text-xl">
        <Link href={`/admin/events/${event.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
          {event.title}
        </Link>
      </h3>
      {event.commitMessage ? <p className="font-mono text-[0.8125rem] leading-snug wrap-anywhere text-foreground/72">$ {event.commitMessage}</p> : null}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.8125rem] text-mist">
        {typeLabel ? <span>{typeLabel}</span> : null}
        <span className="inline-flex items-center gap-1.5">
          <Icon name="image" className="size-4" />
          {pluralize(event.photoCount, "foto", "fotos")}
        </span>
      </p>
      {event.description ? <p className="line-clamp-2 hidden text-sm text-mist md:block">{event.description}</p> : null}
      <WindowBadge badge={windowBadge(event, new Date())} />
    </ListRow>
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

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ estado?: string | string[]; q?: string | string[]; pagina?: string | string[] }> }) {
  const params = await searchParams;
  const filter = parseStatusFilter(params.estado);
  const { search, page: requestedPage } = parseListParams(params);
  const [page, counts] = await Promise.all([getAdminEventsPage(listCriteria(filter, search), requestedPage), getAdminEventCounts()]);
  const events = page.items;
  const today = todayInLoja(new Date());
  const { drafts, upcoming, past } = groupEvents(events, today);
  // Drafts have their own branch; with only drafts asked for, the main line has nothing to show.
  const showMainLine = filter !== "borradores";
  const total = counts.published + counts.draft;
  const tools = showListTools(total, { search, filter });

  return (
    <>
      <PageHeader
        title="Eventos"
        status={`main · ${pluralize(counts.published, "publicado", "publicados")} · ${pluralize(counts.draft, "borrador", "borradores")}`}
        action={
          <Button asChild>
            <Link href="/admin/events/new">
              <Icon name="plus" />
              Nuevo evento
            </Link>
          </Button>
        }
      />

      {counts.published + counts.draft === 0 ? (
        <EmptyState
          icon="events"
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
          {/* Tabs and search share one row; the wrapper owns the top margin both bring along. */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 [&>*]:mt-0!">
            <StatusFilter path={LIST_PATH} current={filter} counts={counts} search={search} />
            {tools ? <ListSearch path={LIST_PATH} filter={filter} search={search} label="eventos" /> : null}
          </div>
          {events.length === 0 ? (
            <FilterEmpty path={LIST_PATH} filter={filter} noun="eventos" search={search} />
          ) : (
            <BulkSelection kind="event" enabled={tools} items={events.map((event) => ({ id: event.id, label: event.title }))}>
              <EventsTimeline drafts={drafts} upcoming={upcoming} past={past} today={today} showMainLine={showMainLine} />
              {tools ? null : <AddRow href="/admin/events/new">Agregar evento</AddRow>}
            </BulkSelection>
          )}
          <Pager path={LIST_PATH} filter={filter} search={search} page={page} />
          {events.length > 0 ? (
            <div className="mt-6">
              <Legend />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
