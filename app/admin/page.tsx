import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RESTRICTED_NOTICE } from "@/interface/admin/role-labels";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { getLastDeployStatus } from "@/interface/admin/deploy-status-admin-read";
import { describeDeployStatus } from "@/interface/admin/deploy-status-label";
import { getAdminBoardMembers } from "@/interface/admin/board/board-members-admin-read";
import { getAdminCommands } from "@/interface/admin/commands/commands-admin-read";
import { getAdminEvents } from "@/interface/admin/events/events-admin-read";
import { getAdminFaqs } from "@/interface/admin/faqs/faqs-admin-read";
import { getAdminForumReports } from "@/interface/admin/forum/forum-moderation-read";
import { buildHomeAgenda, type HomeAgenda } from "@/interface/admin/home-agenda";
import { getAdminImpactStats } from "@/interface/admin/impact/impact-admin-read";
import { getAdminNewsItems } from "@/interface/admin/news/news-admin-read";
import { getAdminPillars } from "@/interface/admin/pillars/pillars-admin-read";
import { pluralize, publicationSummary } from "@/interface/admin/publication-summary";
import { getAdminSocialLinks } from "@/interface/admin/socials/socials-admin-read";
import { getAdminSponsors } from "@/interface/admin/sponsors/sponsors-admin-read";
import { getAdminTestimonials } from "@/interface/admin/testimonials/testimonials-admin-read";

import { EmptyState } from "./_components/empty-state";
import { PageHeader } from "./_components/page-header";
import { Stamp } from "./_components/timeline-parts";
import { MODULE_NAV, visibleTo } from "./_components/nav-items";

// Counts are read on every request.
export const dynamic = "force-dynamic";

type Summary = (typeof MODULE_NAV)[number]["href"];

interface ModuleSummary {
  line: string;
}

/** A read that fails yields `undefined` instead of taking the whole home down. */
async function attempt<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** One summary per module; a module whose read failed shows a dash. */
function describe(items: readonly { isPublished: boolean }[] | undefined): ModuleSummary {
  return items === undefined ? { line: "—" } : { line: publicationSummary(items) };
}

async function readHome(now: Date): Promise<{ lines: Record<Summary, ModuleSummary>; agenda: HomeAgenda }> {
  const [events, news, faqs, commands, board, pillars, socials, impact, testimonials, sponsors, reports] = await Promise.all([
    attempt(getAdminEvents),
    attempt(getAdminNewsItems),
    attempt(getAdminFaqs),
    attempt(getAdminCommands),
    attempt(getAdminBoardMembers),
    attempt(getAdminPillars),
    attempt(getAdminSocialLinks),
    attempt(getAdminImpactStats),
    attempt(getAdminTestimonials),
    attempt(getAdminSponsors),
    attempt(() => getAdminForumReports({ status: "open", page: 1 })),
  ]);

  return {
    lines: {
      "/admin/events": describe(events),
      "/admin/news": describe(news),
      "/admin/faqs": describe(faqs),
      "/admin/commands": describe(commands),
      "/admin/board": describe(board),
      "/admin/pillars": describe(pillars),
      "/admin/socials": describe(socials),
      "/admin/impact": describe(impact),
      "/admin/testimonials": describe(testimonials),
      "/admin/sponsors": describe(sponsors),
      "/admin/settings": { line: "Lema, descripción y «Acerca de»" },
    },
    agenda: buildHomeAgenda({ events: events ?? [], news: news ?? [], openReports: reports?.total ?? null, now }),
  };
}

const SECTION_TITLE = "text-lg font-bold font-stretch-[112%]";
const ROW_LINK =
  "group flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors duration-150 ease-out hover:bg-foreground/4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky";

function RowChevron() {
  return <Icon name="right" className="ml-auto size-4 shrink-0 text-mist transition-transform duration-200 ease-(--ease-reveal) group-hover:translate-x-0.5 group-hover:text-foreground" />;
}

/** Drafts and open reports: the work waiting for someone, first thing on the page. */
function PendingSection({ agenda }: { agenda: HomeAgenda }) {
  const reports = agenda.openReports ?? 0;
  const rest = agenda.draftsTotal - agenda.drafts.length;

  return (
    <section aria-labelledby="pending-title" className="grid content-start gap-3">
      <h2 id="pending-title" className={SECTION_TITLE}>
        Por atender
      </h2>
      {agenda.needsAttention ? (
        <ul className="divide-y divide-border overflow-hidden rounded bg-card">
          {reports > 0 ? (
            <li>
              <Link href="/admin/foro/reportes" className={ROW_LINK}>
                <Stamp solid>Foro</Stamp>
                <span className="min-w-0 truncate font-semibold">{pluralize(reports, "reporte abierto", "reportes abiertos")}</span>
                <RowChevron />
              </Link>
            </li>
          ) : null}
          {agenda.drafts.map((draft) => (
            <li key={`${draft.kind}-${draft.id}`}>
              <Link href={draft.href} className={ROW_LINK}>
                <Stamp className="w-20 justify-center">{draft.kind}</Stamp>
                <span className="min-w-0 truncate">{draft.title}</span>
                <span className="shrink-0 font-mono text-xs text-mist">{draft.scheduled ? "programado" : "borrador"}</span>
                <RowChevron />
              </Link>
            </li>
          ))}
          {rest > 0 ? <li className="px-4 py-2.5 font-mono text-[0.8125rem] text-mist">y {pluralize(rest, "borrador más", "borradores más")} en sus listas</li> : null}
        </ul>
      ) : (
        <EmptyState icon="check">Todo al día: no hay borradores sin publicar ni reportes abiertos en el foro.</EmptyState>
      )}
    </section>
  );
}

/** The published events still ahead, soonest first, with a shortcut to the registrations of those that take them. */
function UpcomingSection({ agenda }: { agenda: HomeAgenda }) {
  return (
    <section aria-labelledby="upcoming-title" className="grid content-start gap-3">
      <h2 id="upcoming-title" className={SECTION_TITLE}>
        Próximos eventos
      </h2>
      {agenda.upcoming.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded bg-card">
          {agenda.upcoming.map((event) => (
            <li key={event.id} className="grid gap-1 px-4 py-3">
              <Link href={event.href} className="font-semibold wrap-anywhere hover:underline">
                {event.title}
              </Link>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.8125rem] text-mist">
                <span className="whitespace-nowrap">{event.when}</span>
                {event.registration ? (
                  <Link href={`/admin/events/${event.id}/registrations`} className="text-sky hover:underline">
                    Ver inscripciones
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
          {agenda.upcomingTotal > agenda.upcoming.length ? (
            <li>
              <Link href="/admin/events" className={ROW_LINK}>
                <span className="font-mono text-[0.8125rem] text-mist">Ver los {agenda.upcomingTotal} próximos</span>
                <RowChevron />
              </Link>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="rounded bg-card px-4 py-3 text-mist">No hay eventos publicados por delante.</p>
      )}
    </section>
  );
}

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ acceso?: string | string[] }> }) {
  // Before the reads below, which swallow their own failures: a lost session must redirect, not show dashes.
  const actor = await requirePageSession();
  const restricted = (await searchParams).acceso === "restringido";
  const [{ lines, agenda }, deployStatus] = await Promise.all([readHome(new Date()), getLastDeployStatus()]);
  const deploy = deployStatus === undefined ? undefined : describeDeployStatus(deployStatus, new Date());

  return (
    <div>
      <PageHeader
        title="Inicio"
        status="main · el sitio se vuelve a publicar con cada cambio"
        action={
          <Button asChild>
            <Link href="/admin/events/new">
              <Icon name="plus" />
              Nuevo evento
            </Link>
          </Button>
        }
      />

      {restricted ? (
        <p role="status" className="mt-4 border-l-2 border-dashed border-signal pl-4 text-mist">
          {RESTRICTED_NOTICE}
        </p>
      ) : null}

      {deploy ? (
        <p role="status" className="mt-4 font-mono text-[0.8125rem] text-mist">
          <span className={deploy.tone === "failed" ? "text-error" : undefined}>{deploy.text}</span>
          {deploy.hint ? <span className="block">{deploy.hint}</span> : null}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <PendingSection agenda={agenda} />
        <UpcomingSection agenda={agenda} />
      </div>

      {/* The state of every module in one compact line each; the sidebar already lists them, so no big counters here. */}
      <nav aria-labelledby="modules-title" className="mt-10 grid gap-3">
        <h2 id="modules-title" className={SECTION_TITLE}>
          Contenido del sitio
        </h2>
        <ul className="grid gap-px overflow-hidden rounded bg-border sm:grid-cols-2 xl:grid-cols-3">
          {visibleTo(MODULE_NAV, actor.role).map((item) => {
            const { line } = lines[item.href] ?? { line: "—" };

            return (
              <li key={item.href} className="bg-card">
                <Link href={item.href} className={ROW_LINK}>
                  <Icon name={item.icon} className="size-4.5 shrink-0 text-sky" />
                  <span className="grid min-w-0">
                    <span className="font-semibold">{item.label}</span>
                    <span className="truncate font-mono text-xs text-mist">{line}</span>
                  </span>
                  <RowChevron />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
