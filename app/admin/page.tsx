import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RESTRICTED_NOTICE } from "@/interface/admin/role-labels";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { getLastDeployStatus } from "@/interface/admin/deploy-status-admin-read";
import { describeDeployStatus } from "@/interface/admin/deploy-status-label";
import { getAdminRegistrationOverview } from "@/interface/admin/event-registrations/registrations-overview-admin-read";
import { getAdminEvents } from "@/interface/admin/events/events-admin-read";
import { getAdminForumReports } from "@/interface/admin/forum/forum-moderation-read";
import { buildHomeAgenda } from "@/interface/admin/home-agenda";
import { buildHomeCards, nextOpenRegistration, type HomeCard } from "@/interface/admin/home-cards";
import { getAdminNewsItems } from "@/interface/admin/news/news-admin-read";

import { PageHeader } from "./_components/page-header";
import { SectionTitle } from "./_components/section-title";

// Counts are read on every request.
export const dynamic = "force-dynamic";

const CARD_ICONS: Record<HomeCard["id"], IconName> = { foro: "msg", inscripciones: "list", contenido: "edit" };

const CREATE_OPTIONS: readonly { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/events/new", label: "Evento", icon: "events" },
  { href: "/admin/news/new", label: "Novedad", icon: "news" },
  { href: "/admin/faqs/new", label: "Pregunta", icon: "faq" },
];

/** A read that fails yields `undefined` instead of taking the whole home down. */
async function attempt<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** The cards come from reads the admin already makes; `readable` is false when any of them failed, so the page never claims "Todo al día" blind. */
async function readCards(now: Date): Promise<{ cards: HomeCard[]; readable: boolean }> {
  const [events, news, reports, overview] = await Promise.all([
    attempt(getAdminEvents),
    attempt(getAdminNewsItems),
    attempt(() => getAdminForumReports({ status: "open", page: 1 })),
    attempt(getAdminRegistrationOverview),
  ]);
  const agenda = buildHomeAgenda({ events: events ?? [], news: news ?? [], openReports: reports?.total ?? null, now });

  return {
    cards: buildHomeCards({
      openReports: agenda.openReports,
      registration: nextOpenRegistration(overview?.upcoming ?? []),
      draftsTotal: agenda.draftsTotal,
      firstDraftHref: agenda.drafts[0]?.href ?? null,
    }),
    readable: [events, news, reports, overview].every((read) => read !== undefined),
  };
}

function Waiting({ cards, readable }: { cards: readonly HomeCard[]; readable: boolean }) {
  if (cards.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded bg-card px-5 py-4 text-lg font-semibold ring-1 ring-paper-ring ring-inset">
        <Icon name={readable ? "check" : "alert"} className="size-5 shrink-0" />
        {readable ? "Todo al día" : "No pudimos leer lo pendiente. Intente de nuevo en un momento."}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
      {cards.map((card) => (
        <li key={card.id} data-slot="todo-card" className="grid content-start justify-items-start gap-5 border-t-[3px] border-foreground bg-card p-6 ring-1 ring-paper-ring ring-inset">
          <span aria-hidden="true" className="grid size-12 place-items-center bg-signal text-white">
            <Icon name={CARD_ICONS[card.id]} />
          </span>
          <h3 className="text-xl leading-tight font-extrabold">
            <span className="mb-1 block text-6xl leading-none font-black -tracking-[0.04em]">{card.count}</span>
            {card.label}
          </h3>
          <Button asChild variant="line" className="min-h-12 px-6 text-base">
            <Link href={card.href}>{card.action}</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** One primary "+ Crear" that opens the three things the board creates most; a native disclosure, so it needs no script. */
function CreateMenu() {
  return (
    <details className="group">
      <summary className="inline-flex min-h-16 cursor-pointer list-none items-center gap-3 rounded bg-signal px-8 text-xl font-bold text-white hover:bg-signal-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky [&::-webkit-details-marker]:hidden">
        <Icon name="plus" className="size-6" />
        Crear
      </summary>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3 md:max-w-2xl">
        {CREATE_OPTIONS.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              className="flex min-h-14 items-center gap-3 rounded bg-card px-3 text-lg font-extrabold ring-1 ring-input ring-inset hover:ring-2 hover:ring-foreground focus-visible:outline-2 focus-visible:outline-sky"
            >
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-xs bg-tint-navy text-on-tint-navy">
                <Icon name={option.icon} className="size-5" />
              </span>
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ acceso?: string | string[] }> }) {
  // Before the reads below, which swallow their own failures: a lost session must redirect, not show dashes.
  const actor = await requirePageSession();
  const restricted = (await searchParams).acceso === "restringido";
  const now = new Date();
  const [{ cards, readable }, deployStatus] = await Promise.all([readCards(now), getLastDeployStatus()]);
  const deploy = deployStatus === undefined ? undefined : describeDeployStatus(deployStatus, now);
  // The emergency access has no person to greet.
  const firstName = actor.kind === "break_glass" ? undefined : actor.name.trim().split(/\s+/)[0];

  return (
    <div className="grid gap-8">
      <PageHeader title={firstName ? `Hola, ${firstName}` : "Hola"} />

      {restricted ? (
        <p role="status" className="border-l-2 border-dashed border-signal pl-4 text-mist">
          {RESTRICTED_NOTICE}
        </p>
      ) : null}

      <section aria-labelledby="waiting-title" className="grid content-start gap-4">
        <SectionTitle id="waiting-title">Lo que te espera</SectionTitle>
        <Waiting cards={cards} readable={readable} />
      </section>

      <div>
        <CreateMenu />
      </div>

      {deploy ? (
        <p role="status" className="font-mono text-[0.8125rem] text-mist">
          <span className={deploy.tone === "failed" ? "text-error" : undefined}>{deploy.text}</span>
          {deploy.tone === "failed" && deploy.hint ? <span className="block">{deploy.hint}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
