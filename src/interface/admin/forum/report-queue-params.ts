import type { ForumReportQueue } from "@/application/ports/forum-moderation.ports";

type Param = string | string[] | undefined;

const REPORTS_PATH = "/admin/foro/reportes";

const single = (value: Param) => (Array.isArray(value) ? value[0] : value);

/** The query string of the report queue, reduced to what it can mean: which queue and a page number. */
export function parseReportQueueParams(params: { estado?: Param; pagina?: Param }): { status: ForumReportQueue; page: number } {
  const raw = single(params.pagina);

  return {
    status: single(params.estado) === "cerrados" ? "closed" : "open",
    page: raw !== undefined && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1,
  };
}

/** Link to a page of a queue; the first page of the open one is the bare path. */
export function reportQueueHref(status: ForumReportQueue, page: number): string {
  const query = new URLSearchParams();

  if (status === "closed") query.set("estado", "cerrados");
  if (page > 1) query.set("pagina", String(page));

  const text = query.toString();

  return text ? `${REPORTS_PATH}?${text}` : REPORTS_PATH;
}

/** The open queue is walked one report at a time: `?n=` is the 1-based position, anything else is the first. */
export function parseReportPosition(params: { n?: Param }): number {
  const raw = single(params.n);

  return raw !== undefined && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
}

/** Link to the report at a position of the open queue; the first one is the bare path. */
export function reportPositionHref(position: number): string {
  return position > 1 ? `${REPORTS_PATH}?n=${position}` : REPORTS_PATH;
}
