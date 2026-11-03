import type { MediaUsage, MediaUsageKind } from "@/application";

/** Cloudinary's cursors are opaque hex-like tokens; anything else in `?despues=` is dropped. */
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

/** `?despues=`: the cursor of the page to show, or undefined for the first page. A repeated param means the first page. */
export function parseMediaCursor(raw: string | string[] | undefined): string | undefined {
  return typeof raw === "string" && CURSOR_PATTERN.test(raw) ? raw : undefined;
}

export const MEDIA_KIND_LABELS: Record<MediaUsageKind, string> = {
  event: "Evento",
  news: "Novedad",
  pillar: "Pilar",
  board: "Directiva",
  testimonial: "Testimonio",
  sponsor: "Aliado",
};

/** Kinds with no admin page (testimonials are kept in the database but no longer managed) have no edit path. */
const EDIT_PATH: Record<MediaUsageKind, string | null> = {
  event: "/admin/events",
  news: "/admin/news",
  pillar: "/admin/pillars",
  board: "/admin/board",
  testimonial: null,
  sponsor: "/admin/sponsors",
};

export function usageHref(usage: Pick<MediaUsage, "kind" | "id">): string | null {
  const path = EDIT_PATH[usage.kind];

  return path === null ? null : `${path}/${usage.id}/edit`;
}

/** "340 KB", "1,2 MB": sizes are for judging weight, not for exact accounting. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1).replace(".", ",") : Math.round(kilobytes)} KB`;

  return `${(kilobytes / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function mediaHref(cursor?: string): string {
  return cursor ? `/admin/medios?despues=${encodeURIComponent(cursor)}` : "/admin/medios";
}
