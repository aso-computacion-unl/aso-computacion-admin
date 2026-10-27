import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ForumReportItemResult } from "@/application";
import { getAdminForumReports } from "@/interface/admin/forum/forum-moderation-read";
import { parseReportQueueParams, reportQueueHref } from "@/interface/admin/forum/report-queue-params";
import { pluralize } from "@/interface/admin/publication-summary";
import { cn } from "@/lib/utils";

import { PageHeader } from "../../_components/page-header";
import { Panel } from "../../_components/form-layout";
import { EmptyState } from "../../_components/empty-state";
import { Stamp } from "../../_components/timeline-parts";
import { CloseReportForm, PostControls } from "./_components/report-controls";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

type SearchParams = Promise<{ estado?: string | string[]; pagina?: string | string[] }>;

const OUTCOME_LABELS = { RESOLVED: "Resuelto", DISMISSED: "Descartado", OPEN: "Abierto" } as const;

function ReportCard({ report }: { report: ForumReportItemResult }) {
  const { target } = report;
  const open = report.status === "OPEN";

  return (
    <li>
      <Panel aria-labelledby={`report-${report.id}`} className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Stamp>{target.kind === "thread" ? "Hilo" : "Respuesta"}</Stamp>
          {target.hidden ? <Stamp>Oculto</Stamp> : null}
          {target.locked ? <Stamp>Hilo cerrado</Stamp> : null}
          {target.authorSuspended ? <Stamp>Autor suspendido</Stamp> : null}
          {open ? null : <Stamp>{OUTCOME_LABELS[report.status]}</Stamp>}
        </div>

        <div className="grid gap-1">
          <h2 id={`report-${report.id}`} className="text-lg font-bold font-stretch-[112%] wrap-anywhere">
            {target.threadTitle}
          </h2>
          <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">
            Publicado por {target.authorName} · reportado por {report.reporterName} el {WHEN.format(report.createdAt)}
          </p>
        </div>

        <blockquote className="border-l-2 border-dashed border-sky pl-4 text-sm whitespace-pre-wrap wrap-anywhere">{target.excerpt}</blockquote>

        <p className="text-sm wrap-anywhere">
          <span className="font-bold">Motivo: </span>
          {report.reason}
        </p>

        {open ? null : (
          <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">
            Cerrado {report.resolvedAt ? `el ${WHEN.format(report.resolvedAt)}` : ""}
            {report.resolutionNote ? ` · Nota: ${report.resolutionNote}` : ""}
          </p>
        )}

        <PostControls target={target} />
        {open ? <CloseReportForm reportId={report.id} /> : null}
      </Panel>
    </li>
  );
}

export default async function AdminForumReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { status, page: requested } = parseReportQueueParams(await searchParams);
  const { items, total, page, pageCount } = await getAdminForumReports({ status, page: requested });

  return (
    <div>
      <PageHeader
        title="Reportes del foro"
        status={`${pluralize(total, status === "open" ? "reporte abierto" : "reporte cerrado", status === "open" ? "reportes abiertos" : "reportes cerrados")}`}
        description="Lo que los estudiantes marcaron para revisar. Oculte la publicación, cierre el hilo o suspenda la cuenta si hace falta, y luego cierre el reporte. Cada acción queda en el registro de cambios."
      />

      <nav aria-label="Filtrar reportes" className="mt-5">
        <ul className="flex flex-wrap gap-2">
          {(["open", "closed"] as const).map((queue) => (
            <li key={queue}>
              <Link
                href={reportQueueHref(queue, 1)}
                aria-current={queue === status ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded border border-input px-3.5 text-sm font-semibold text-mist",
                  "transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground",
                  "aria-[current=true]:border-sky aria-[current=true]:bg-sky aria-[current=true]:text-primary-foreground",
                )}
              >
                {queue === "open" ? "Abiertos" : "Cerrados"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <EmptyState icon="alert">{status === "open" ? "No hay reportes abiertos. Cuando un estudiante reporte una publicación, aparecerá aquí." : "Todavía no se cerró ningún reporte."}</EmptyState>
      ) : (
        <ul className="mt-6 grid gap-4" aria-label={status === "open" ? "Reportes abiertos" : "Reportes cerrados"}>
          {items.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Páginas de reportes" className="mt-6 flex items-center gap-4">
          {page > 1 ? (
            <Button asChild variant="line" size="sm">
              <Link href={reportQueueHref(status, page - 1)} rel="prev">
                Anteriores
              </Link>
            </Button>
          ) : null}
          <span className="font-mono text-[0.8125rem] text-mist">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Button asChild variant="line" size="sm">
              <Link href={reportQueueHref(status, page + 1)} rel="next">
                Siguientes
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
