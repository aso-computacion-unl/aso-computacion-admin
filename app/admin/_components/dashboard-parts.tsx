import Link from "next/link";
import type { ReactNode } from "react";

import type { RegistrationOverviewRow } from "@/application";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import type { DeployStatusDescription } from "@/interface/admin/deploy-status-label";
import type { PendingDraft } from "@/interface/admin/home-agenda";
import { cn } from "@/lib/utils";

import { closing, MODE_LABELS, NOT_PUBLIC_LABELS, seatsSpoken, STATE_LABELS } from "../registrations/_components/registration-format";
import { SectionTitle } from "./section-title";

/** One tier of the home: a quiet eyebrow over its cards, so priority reads from top to bottom. */
export function Tier({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <SectionTitle id={id} variant="label" className="tracking-[0.12em]">
        {title}
      </SectionTitle>
      {children}
    </section>
  );
}

/** The 12-column frame of a tier from 1024px; one column below it. */
export const TIER_GRID = "grid gap-4 lg:grid-cols-12 lg:gap-6";

const CARD = "grid min-w-0 content-start gap-3 rounded-card bg-card p-5 ring-1 ring-paper-ring ring-inset";

function Card({ id, title, aside, className, children }: { id: string; title: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn(CARD, className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <SectionTitle id={id}>{title}</SectionTitle>
        {aside ? <span className="text-sm text-mist">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

const LINK = "text-sm font-semibold text-sky underline underline-offset-4 hover:text-sky-bright focus-visible:outline-2 focus-visible:outline-sky";
const TITLE_LINK = "font-bold wrap-anywhere hover:underline focus-visible:outline-2 focus-visible:outline-sky";
const ROW = "border-b border-paper-ring px-1 py-2.5 last:border-b-0";
const META = "font-mono text-[0.8125rem] text-mist";
const CHIP = "inline-flex items-center rounded-full px-2.5 text-xs leading-5 font-semibold whitespace-nowrap";

const STATE_CHIPS: Record<RegistrationOverviewRow["state"], string> = {
  open: "bg-success-tint text-success",
  full: "bg-tint-red text-on-tint-red",
  closed: "text-mist shadow-[inset_0_0_0_1px_var(--color-border)]",
};

const ROWS_SHOWN = 5;

/** «Inscripciones próximas»: seats, state and closing of each upcoming event that takes registrations. */
export function UpcomingRegistrations({ rows, className }: { rows: readonly RegistrationOverviewRow[] | null; className?: string }) {
  const registered = (rows ?? []).reduce((sum, row) => sum + row.registered, 0);
  const aside =
    rows && rows.length > 0 ? (
      <>
        <b className="text-foreground">{registered}</b> {registered === 1 ? "inscrito" : "inscritos"} en {rows.length} {rows.length === 1 ? "evento" : "eventos"} ·{" "}
        <Link href="/admin/registrations" className={LINK}>
          Ver inscripciones
        </Link>
      </>
    ) : (
      <Link href="/admin/registrations" className={LINK}>
        Ver inscripciones
      </Link>
    );

  return (
    <Card id="home-registrations" title="Inscripciones próximas" aside={aside} className={className}>
      {rows === null ? (
        <p className="py-3 text-mist">No pudimos leer las inscripciones. Intente de nuevo en un momento.</p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-mist">No hay eventos próximos con inscripción.</p>
      ) : (
        <ul>
          {rows.slice(0, ROWS_SHOWN).map((row) => {
            const fill = row.capacity ? Math.min(100, Math.round((row.registered / row.capacity) * 100)) : null;

            return (
              <li
                key={row.id}
                className={cn(
                  ROW,
                  "grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(7.5rem,42%)] items-center gap-x-6 gap-y-0.5",
                  "sm:grid-cols-[6rem_minmax(0,1fr)_12.5rem] min-[1600px]:grid-cols-[7rem_minmax(0,1fr)_10.5rem_16rem]",
                )}
              >
                <span className={META}>{formatEventDate(row.date, row.datePrecision)}</span>
                <span className="grid min-w-0 gap-0.5 max-sm:col-start-1">
                  <Link href={`/admin/registrations?evento=${row.id}`} className={TITLE_LINK}>
                    {row.title}
                  </Link>
                  <span className="text-[0.8125rem] text-mist">
                    {MODE_LABELS[row.mode]}
                    {row.publication === "live" ? null : ` · ${NOT_PUBLIC_LABELS[row.publication].toLowerCase()}`}
                  </span>
                </span>
                <span className={cn(META, "hidden min-[1600px]:block")}>cierra {closing(row)}</span>
                <span className="grid gap-1.5 max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1">
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <b aria-hidden="true" className="tabular-nums">
                      {row.capacity === null ? `${row.registered} ${row.registered === 1 ? "inscrito" : "inscritos"}` : `${row.registered} / ${row.capacity}`}
                    </b>
                    <span className="sr-only">{seatsSpoken(row)}</span>
                    <span className={cn(CHIP, STATE_CHIPS[row.state])}>{STATE_LABELS[row.state]}</span>
                  </span>
                  {fill !== null ? (
                    <span aria-hidden="true" className="relative h-1.5 overflow-hidden rounded-full bg-foreground/14">
                      <i className={cn("absolute inset-y-0 left-0 rounded-full", row.state === "full" ? "bg-signal" : "bg-sky")} style={{ width: `${fill}%` }} />
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** «Borradores»: what is half done, the last edited first; a scheduled one says so instead of offering to continue. */
export function Drafts({ drafts, total, scheduled, className }: { drafts: readonly PendingDraft[] | null; total: number; scheduled: number; className?: string }) {
  return (
    <Card
      id="home-drafts"
      title="Borradores"
      aside={drafts && total > 0 ? <><b className="text-foreground">{total}</b>{scheduled > 0 ? ` · ${scheduled} ${scheduled === 1 ? "programado" : "programados"}` : null}</> : undefined}
      className={className}
    >
      {drafts === null ? (
        <p className="py-3 text-mist">No pudimos leer los borradores. Intente de nuevo en un momento.</p>
      ) : drafts.length === 0 ? (
        <p className="py-3 text-mist">No hay borradores.</p>
      ) : (
        <ul>
          {drafts.map((draft) => (
            <li key={`${draft.kind}-${draft.id}`} className={cn(ROW, "flex min-h-14 items-center justify-between gap-4")}>
              <span className="grid min-w-0 gap-0.5">
                <span className={META}>{draft.kind}</span>
                <Link href={draft.href} className={TITLE_LINK}>
                  {draft.title}
                </Link>
              </span>
              {draft.scheduled ? (
                <span className={cn(CHIP, "bg-tint-blue text-on-tint-blue")}>Programado</span>
              ) : (
                <Link href={draft.href} aria-label={`Continuar: ${draft.title}`} className={cn(LINK, "shrink-0")}>
                  Continuar
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export interface ActivityEntry {
  id: string;
  when: string;
  what: string;
  who: string;
  emergency: boolean;
  summary: string;
}

/** «Actividad reciente» (administrators): the newest entries of the change log. */
export function RecentActivity({ entries, className }: { entries: readonly ActivityEntry[] | null; className?: string }) {
  return (
    <Card
      id="home-activity"
      title="Actividad reciente"
      aside={
        <Link href="/admin/registro" className={LINK}>
          Historial completo
        </Link>
      }
      className={className}
    >
      {entries === null ? (
        <p className="py-3 text-mist">No pudimos leer el historial. Intente de nuevo en un momento.</p>
      ) : entries.length === 0 ? (
        <p className="py-3 text-mist">Todavía no hay cambios registrados.</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id} className={cn(ROW, "grid min-h-14 content-center gap-0.5")}>
              <span className={META}>
                {entry.when} · {entry.what}
              </span>
              <span className="wrap-anywhere">
                <b className={entry.emergency ? "text-on-tint-red" : undefined}>{entry.who}</b> · {entry.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export interface PublishedCounts {
  events: number | null;
  news: number | null;
  faqs: number | null;
}

export interface AccountCare {
  sessions: number | null;
  suspended: number | null;
  trash: number | null;
}

function Value({ href, value, label }: { href: string; value: number | null; label: string }) {
  if (value === null) return null;

  return (
    <Link href={href} className="hover:underline focus-visible:outline-2 focus-visible:outline-sky">
      <b className="mr-1 font-display text-xl leading-tight">{value}</b>
      {label}
    </Link>
  );
}

const STRIP_CELL = "grid content-start gap-1.5 px-5 py-4 max-lg:border-t max-lg:first:border-t-0 lg:border-l lg:first:border-l-0 border-paper-ring";
const STRIP_TITLE = "text-[0.8125rem] font-[650] text-mist";
const VALUES = "m-0 flex flex-wrap gap-x-5 gap-y-1 text-[0.9375rem]";

/** «Estado»: one small strip with the public site, what is published and (administrators) the care of the accounts. */
export function StatusStrip({ deploy, published, account }: { deploy: DeployStatusDescription | undefined; published: PublishedCounts; account: AccountCare | null }) {
  return (
    <div className={cn("grid rounded-card bg-card ring-1 ring-paper-ring ring-inset", account ? "lg:grid-cols-[1fr_1.2fr_1.4fr]" : "lg:grid-cols-[1fr_1.2fr]")}>
      <section aria-labelledby="status-site" className={STRIP_CELL}>
        <h3 id="status-site" className={STRIP_TITLE}>
          Sitio público
        </h3>
        {deploy === undefined ? (
          <p className="m-0 text-mist">No pudimos leer el último despliegue.</p>
        ) : (
          <div role="status" className="grid gap-0.5">
            {deploy.tone === "ok" ? (
              <span className="flex items-center gap-2 font-bold">
                <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                Al día
              </span>
            ) : null}
            <span className={cn("font-mono text-[0.8125rem] wrap-anywhere", deploy.tone === "failed" ? "text-error" : "text-mist")}>{deploy.text}</span>
            {deploy.tone === "failed" && deploy.hint ? <span className="max-w-[68ch] text-[0.8125rem] text-mist">{deploy.hint}</span> : null}
          </div>
        )}
      </section>
      <section aria-labelledby="status-published" className={STRIP_CELL}>
        <h3 id="status-published" className={STRIP_TITLE}>
          Publicado en el sitio
        </h3>
        <p className={VALUES}>
          <Value href="/admin/events" value={published.events} label="eventos" />
          <Value href="/admin/news" value={published.news} label="novedades" />
          <Value href="/admin/faqs" value={published.faqs} label="preguntas" />
        </p>
      </section>
      {account ? (
        <section aria-labelledby="status-account" className={STRIP_CELL}>
          <h3 id="status-account" className={STRIP_TITLE}>
            Cuidado de la cuenta
          </h3>
          <p className={VALUES}>
            <Value href="/admin/sesiones" value={account.sessions} label={account.sessions === 1 ? "sesión activa" : "sesiones activas"} />
            <Value href="/admin/foro/miembros?estado=suspendidos" value={account.suspended} label={account.suspended === 1 ? "cuenta suspendida" : "cuentas suspendidas"} />
            <Value href="/admin/papelera" value={account.trash} label="en la papelera" />
          </p>
        </section>
      ) : null}
    </div>
  );
}
