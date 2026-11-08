import Link from "next/link";

import { FORUM_REPORTS_PAGE_SIZE, type ForumReportItemResult } from "@/application";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getAdminForumReports } from "@/interface/admin/forum/forum-moderation-read";
import { parseReportPosition, parseReportQueueParams, reportPositionHref, reportQueueHref } from "@/interface/admin/forum/report-queue-params";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { cn } from "@/lib/utils";

import { PageHeader } from "../../_components/page-header";
import { Panel } from "../../_components/form-layout";
import { EmptyState } from "../../_components/empty-state";
import { Stamp } from "../../_components/timeline-parts";
import { ReportActions } from "./_components/report-controls";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

type SearchParams = Promise<{ estado?: string | string[]; pagina?: string | string[]; n?: string | string[] }>;

const OUTCOME_LABELS = { RESOLVED: "Resuelto", DISMISSED: "Descartado", OPEN: "Abierto" } as const;

const LINK = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sky underline-offset-4 hover:underline";

/** The one report in view: where it is, the quoted text, who wrote and who reported it, and what it says now. */
function ReportCard({ report }: { report: ForumReportItemResult }) {
  const { target } = report;

  return (
    <Panel aria-labelledby={`report-${report.id}`} className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Stamp>{target.kind === "thread" ? "Hilo" : "Respuesta"}</Stamp>
        {target.hidden ? <Stamp>Oculto</Stamp> : null}
        {target.locked ? <Stamp>Hilo cerrado</Stamp> : null}
        {target.authorSuspended ? <Stamp>Autor suspendido</Stamp> : null}
      </div>

      <div className="grid gap-1">
        <h2 id={`report-${report.id}`} className="text-lg font-bold font-stretch-[112%] wrap-anywhere">
          {target.threadTitle}
        </h2>
        <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">
          Publicado por {target.authorName} · reportado por {report.reporterName} el {WHEN.format(report.createdAt)}
        </p>
      </div>

      <blockquote className="border-l-2 border-dashed border-sky pl-4 text-base whitespace-pre-wrap wrap-anywhere">{target.excerpt}</blockquote>

      <p className="text-sm wrap-anywhere">
        <span className="font-bold">Motivo: </span>
        {report.reason}
      </p>

      <ReportActions key={report.id} report={report} />
    </Panel>
  );
}

/** A closed report as one compact row: what it was about, how it ended and when. */
function ClosedRow({ report }: { report: ForumReportItemResult }) {
  return (
    <li className="grid gap-1 rounded bg-card p-4">
      <p className="flex flex-wrap items-center gap-2">
        <Stamp>{OUTCOME_LABELS[report.status]}</Stamp>
        <span className="font-bold wrap-anywhere">{report.target.threadTitle}</span>
      </p>
      <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">
        Cerrado {report.resolvedAt ? `el ${WHEN.format(report.resolvedAt)}` : ""}
        {report.resolutionNote ? ` · Nota: ${report.resolutionNote}` : ""}
      </p>
    </li>
  );
}

export default async function AdminForumReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePageSession();
  const params = await searchParams;
  const { status, page: closedPage } = parseReportQueueParams(params);
  const requested = parseReportPosition(params);
  const showingOpen = status === "open";
  // Both queues are read for the counts in the tabs; the one in view is read at the page that holds the report asked for.
  const [open, closed] = await Promise.all([
    getAdminForumReports({ status: "open", page: showingOpen ? Math.ceil(requested / FORUM_REPORTS_PAGE_SIZE) : 1 }),
    getAdminForumReports({ status: "closed", page: showingOpen ? 1 : closedPage }),
  ]);
  // A position past the end (a report was closed meanwhile) lands on the last one.
  const position = Math.min(requested, open.total);
  const report = open.items[position - 1 - (open.page - 1) * FORUM_REPORTS_PAGE_SIZE];
  const counts = { open: open.total, closed: closed.total };

  return (
    <div>
      <PageHeader title="Reportes del foro" />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <nav aria-label="Filtrar reportes">
          <ul className="flex flex-wrap gap-2">
            {(["open", "closed"] as const).map((queue) => (
              <li key={queue}>
                <Link
                  href={reportQueueHref(queue, 1)}
                  aria-current={queue === status ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded border border-input px-3.5 text-sm font-semibold text-mist",
                    "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                    "aria-[current=true]:border-action aria-[current=true]:bg-action aria-[current=true]:text-on-action",
                  )}
                >
                  {queue === "open" ? "Abiertos" : "Cerrados"}
                  <span className="font-mono text-xs">{counts[queue]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {actor.role === "ADMIN" ? (
          <Link href="/admin/foro/categorias" className={LINK}>
            Categorías
          </Link>
        ) : null}
      </div>

      {showingOpen ? (
        report ? (
          <section className="mt-6 grid gap-4" aria-label="Reporte abierto">
            <nav aria-label="Recorrer los reportes" className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[0.8125rem] text-mist">
                {position} de {open.total}
              </span>
              {position > 1 ? (
                <Button asChild variant="line" size="sm">
                  <Link href={reportPositionHref(position - 1)} rel="prev">
                    <Icon name="left" />
                    Anterior
                  </Link>
                </Button>
              ) : null}
              {position < open.total ? (
                <Button asChild variant="line" size="sm">
                  <Link href={reportPositionHref(position + 1)} rel="next">
                    Siguiente
                    <Icon name="right" />
                  </Link>
                </Button>
              ) : null}
            </nav>
            <ReportCard report={report} />
          </section>
        ) : (
          <EmptyState icon="check">No hay reportes abiertos</EmptyState>
        )
      ) : closed.items.length === 0 ? (
        <EmptyState icon="alert">Todavía no se cerró ningún reporte.</EmptyState>
      ) : (
        <ul className="mt-6 grid gap-2" aria-label="Reportes cerrados">
          {closed.items.map((item) => (
            <ClosedRow key={item.id} report={item} />
          ))}
        </ul>
      )}

      {!showingOpen && closed.pageCount > 1 ? (
        <nav aria-label="Páginas de reportes" className="mt-6 flex items-center gap-4">
          {closed.page > 1 ? (
            <Button asChild variant="line" size="sm">
              <Link href={reportQueueHref("closed", closed.page - 1)} rel="prev">
                Anteriores
              </Link>
            </Button>
          ) : null}
          <span className="font-mono text-[0.8125rem] text-mist">
            Página {closed.page} de {closed.pageCount}
          </span>
          {closed.page < closed.pageCount ? (
            <Button asChild variant="line" size="sm">
              <Link href={reportQueueHref("closed", closed.page + 1)} rel="next">
                Siguientes
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
