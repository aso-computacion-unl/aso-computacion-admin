import Link from "next/link";

import { Icon } from "@/components/icons";

import { CreateTiles, PaletteButton } from "./command-palette";
import { SectionTitle } from "./section-title";

export interface LastChange {
  /** Short id of the audit entry, shown like a commit hash. */
  hash: string;
  summary: string;
  /** "hace 12 min" */
  elapsed: string;
}

interface QuickActionsProps {
  /** Open forum reports, or null when the queue could not be read. */
  openReports: number | null;
  /** The last edited draft, to pick it up where it was left. */
  lastDraft: { title: string; href: string } | null;
  /** The newest entry of the change log (administrators only), as a `git log` line. */
  lastChange: LastChange | null;
}

const TILE =
  "relative grid min-h-24 content-start gap-2.5 rounded-control bg-background p-3.5 ring-1 ring-input ring-inset transition-shadow duration-150 ease-out hover:ring-2 hover:ring-foreground focus-visible:outline-2 focus-visible:outline-sky";
const ICON = "grid size-9 place-items-center rounded-control bg-tint-navy text-on-tint-navy";

/** «Acciones rápidas»: the palette's command line, the three single-key creates, the forum queue and the draft to continue. */
export function QuickActions({ openReports, lastDraft, lastChange }: QuickActionsProps) {
  const reports = openReports ?? 0;

  return (
    <section aria-labelledby="quick-actions-title" className="grid min-w-0 content-start gap-3.5 rounded-card bg-card p-5 ring-1 ring-paper-ring ring-inset">
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle id="quick-actions-title">Acciones rápidas</SectionTitle>
        <span className="text-[0.8125rem] whitespace-nowrap text-mist">o pulse la tecla</span>
      </div>

      <PaletteButton className="flex min-h-12 w-full cursor-text items-center gap-2.5 rounded-control bg-field px-3.5 text-left font-mono text-sm text-mist ring-1 ring-input ring-inset hover:ring-foreground focus-visible:outline-2 focus-visible:outline-sky">
        <span className="text-sky">$ aso</span>
        <span>buscar o crear…</span>
        <span aria-hidden="true" className="h-4.5 w-2 bg-sky motion-safe:animate-pulse" />
        <kbd className="ml-auto grid h-5.5 min-w-5.5 place-items-center rounded-[6px] bg-foreground/10 px-1.5 text-xs font-semibold text-foreground">Ctrl K</kbd>
      </PaletteButton>

      <ul className="grid grid-cols-2 gap-2">
        <CreateTiles tileClassName={TILE} iconClassName={ICON} />
        <li>
          <Link href="/admin/foro/reportes" aria-label={reports > 0 ? `Revisar ${reports} ${reports === 1 ? "reporte" : "reportes"} del foro` : undefined} className={TILE}>
            <span aria-hidden="true" className={ICON}>
              <Icon name="msg" className="size-5" />
            </span>
            <b className="text-[0.9375rem] leading-tight">Revisar el foro</b>
            {reports > 0 ? (
              <span aria-hidden="true" className="absolute top-3.5 right-3.5 h-6 min-w-6 rounded-full bg-signal px-1.75 text-center text-[0.8125rem] leading-6 font-bold text-white">
                {reports}
              </span>
            ) : null}
          </Link>
        </li>
        {lastDraft ? (
          <li className="col-span-2">
            <Link href={lastDraft.href} className={`${TILE} min-h-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center`}>
              <span aria-hidden="true" className={ICON}>
                <Icon name="edit" className="size-5" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="font-mono text-[0.8125rem] text-mist">Continuar borrador</span>
                <b className="truncate text-[0.9375rem] leading-tight">{lastDraft.title}</b>
              </span>
              <Icon name="right" className="size-5" />
            </Link>
          </li>
        ) : null}
      </ul>

      {lastChange ? (
        <p className="truncate font-mono text-[0.78125rem] text-mist">
          <span className="text-sky">{lastChange.hash}</span> {lastChange.summary} · {lastChange.elapsed}
        </p>
      ) : null}
    </section>
  );
}
