import type { ReactNode } from "react";

import { getActiveSessions } from "@/interface/admin/sessions/sessions-admin-read";
import { getAdminActivityByDay } from "@/interface/admin/audit/audit-activity-read";
import { getAuditLogPage } from "@/interface/admin/audit/audit-admin-read";
import { actorLabel, entityTypeLabel } from "@/interface/admin/audit/audit-labels";
import { shortId } from "@/interface/admin/day-groups";
import { getLastDeployStatus } from "@/interface/admin/deploy-status-admin-read";
import { describeDeployStatus, formatElapsed } from "@/interface/admin/deploy-status-label";
import { getAdminRegistrationOverview } from "@/interface/admin/event-registrations/registrations-overview-admin-read";
import { getAdminEventCounts, getAdminEvents } from "@/interface/admin/events/events-admin-read";
import { getAdminFaqsCounts } from "@/interface/admin/faqs/faqs-admin-read";
import { getAdminForumMembers, getAdminForumReports } from "@/interface/admin/forum/forum-moderation-read";
import { buildHomeAgenda } from "@/interface/admin/home-agenda";
import { getAdminNewsCounts, getAdminNewsItems } from "@/interface/admin/news/news-admin-read";
import { RESTRICTED_NOTICE } from "@/interface/admin/role-labels";
import { getAdminTrash } from "@/interface/admin/trash/trash-admin-read";
import { requirePageSession } from "@/interface/auth/require-page-session";

import { ActivityMap } from "./_components/activity-map";
import { CommandPalette } from "./_components/command-palette";
import { Drafts, RecentActivity, StatusStrip, Tier, TIER_GRID, UpcomingRegistrations, type ActivityEntry } from "./_components/dashboard-parts";
import { PageHeader } from "./_components/page-header";
import { QuickActions, type LastChange } from "./_components/quick-actions";

// Counts are read on every request.
export const dynamic = "force-dynamic";

/** A read that fails yields `undefined` instead of taking the whole home down. */
async function attempt<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

const ACTIVITY_SHOWN = 6;
const TODAY = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "America/Guayaquil" });

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The `$ git status` line under the greeting: only what needs someone, never "todo al día" when a read failed. */
function statusLine({ openReports, full, scheduled, readable }: { openReports: number; full: number; scheduled: number; readable: boolean }): ReactNode {
  const parts: ReactNode[] = [];

  if (openReports > 0) parts.push(<><b className="text-foreground">{openReports} {plural(openReports, "reporte", "reportes")}</b> del foro por revisar</>);
  if (full > 0) parts.push(<><b className="text-foreground">{full} {plural(full, "evento", "eventos")}</b> sin cupos</>);
  if (scheduled > 0) parts.push(<><b className="text-foreground">{scheduled}</b> {plural(scheduled, "programado", "programados")}</>);

  const rest = parts.length > 0 ? parts.flatMap((part, index) => (index === 0 ? [<span key={index}>{part}</span>] : [" · ", <span key={index}>{part}</span>])) : readable ? "todo al día" : "no pudimos leer todo lo pendiente";

  return (
    <>
      <span className="font-mono text-sky">$ git status</span> → {rest}.
    </>
  );
}

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ acceso?: string | string[] }> }) {
  // Before the reads below, which swallow their own failures: a lost session must redirect, not show dashes.
  const actor = await requirePageSession();
  const isAdmin = actor.role === "ADMIN";
  const restricted = (await searchParams).acceso === "restringido";
  const now = new Date();

  const [events, news, reports, overview, eventCounts, newsCounts, faqCounts, deployStatus, activityByDay, audit, sessions, trash, suspended] = await Promise.all([
    attempt(getAdminEvents),
    attempt(getAdminNewsItems),
    attempt(() => getAdminForumReports({ status: "open", page: 1 })),
    attempt(getAdminRegistrationOverview),
    attempt(getAdminEventCounts),
    attempt(getAdminNewsCounts),
    attempt(getAdminFaqsCounts),
    getLastDeployStatus(),
    attempt(getAdminActivityByDay),
    // The change log and the care of the accounts are the administrator's: an editor's home never asks for them.
    isAdmin ? attempt(() => getAuditLogPage({ pagina: "1" })) : undefined,
    isAdmin ? attempt(getActiveSessions) : undefined,
    isAdmin ? attempt(getAdminTrash) : undefined,
    isAdmin ? attempt(() => getAdminForumMembers({ filter: "suspended", search: "", page: 1 })) : undefined,
  ]);

  const openReports = reports?.total ?? null;
  const agenda = events !== undefined && news !== undefined ? buildHomeAgenda({ events, news, openReports, now }) : null;
  const upcoming = overview?.upcoming ?? null;
  const scheduled = [...(events ?? []), ...(news ?? [])].filter((item) => !item.isPublished && item.publishAt !== null && item.publishAt.getTime() > now.getTime()).length;
  const deploy = deployStatus === undefined ? undefined : describeDeployStatus(deployStatus, now);
  const names = new Map((audit?.users ?? []).map((user) => [user.id, user.name]));
  const newest = audit?.items[0];
  const lastChange: LastChange | null = newest ? { hash: shortId(newest.id), summary: newest.summary, elapsed: formatElapsed(newest.at, now) } : null;
  const activity: ActivityEntry[] | null = audit
    ? audit.items.slice(0, ACTIVITY_SHOWN).map((entry) => ({
        id: entry.id,
        when: formatElapsed(entry.at, now),
        what: entityTypeLabel(entry.entityType),
        who: actorLabel(entry, names),
        emergency: entry.actorKind === "break_glass",
        summary: entry.summary,
      }))
    : null;
  // The emergency access has no person to greet.
  const firstName = actor.kind === "break_glass" ? undefined : actor.name.trim().split(/\s+/)[0];

  return (
    <div className="grid gap-8">
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Hola"}
        status={`${TODAY.format(now)} · Loja`}
        description={statusLine({
          openReports: openReports ?? 0,
          full: (upcoming ?? []).filter((row) => row.state === "full").length,
          scheduled,
          readable: reports !== undefined && overview !== undefined && agenda !== null,
        })}
        // An unreadable log shows no map rather than sixteen empty weeks.
        action={activityByDay ? <ActivityMap days={activityByDay.days} own={activityByDay.scope === "own"} /> : null}
      />

      {restricted ? (
        <p role="status" className="border-l-2 border-dashed border-signal pl-4 text-mist">
          {RESTRICTED_NOTICE}
        </p>
      ) : null}

      <Tier id="tier-attention" title="Necesita atención">
        <div className={TIER_GRID}>
          <div className="min-w-0 lg:col-span-5 min-[1600px]:col-span-4">
            <QuickActions openReports={openReports} lastDraft={agenda?.drafts[0] ?? null} lastChange={lastChange} />
          </div>
          <UpcomingRegistrations rows={upcoming} className="lg:col-span-7 min-[1600px]:col-span-8" />
        </div>
      </Tier>

      <Tier id="tier-work" title="Tu trabajo">
        <div className={TIER_GRID}>
          <Drafts drafts={agenda?.drafts ?? null} total={agenda?.draftsTotal ?? 0} scheduled={scheduled} className={isAdmin ? "lg:col-span-6" : "lg:col-span-12"} />
          {isAdmin ? <RecentActivity entries={activity} className="lg:col-span-6" /> : null}
        </div>
      </Tier>

      <Tier id="tier-status" title="Estado">
        <StatusStrip
          deploy={deploy}
          published={{ events: eventCounts?.published ?? null, news: newsCounts?.published ?? null, faqs: faqCounts?.published ?? null }}
          account={isAdmin ? { sessions: sessions?.sessions.length ?? null, suspended: suspended?.total ?? null, trash: trash?.length ?? null } : null}
        />
      </Tier>

      <CommandPalette role={actor.role} openReports={openReports} />
    </div>
  );
}
