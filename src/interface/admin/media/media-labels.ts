/** Cloudinary's cursors are opaque hex-like tokens; anything else in `?despues=` is dropped. */
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

/** `?despues=`: the cursor of the page to show, or undefined for the first page. A repeated param means the first page. */
export function parseMediaCursor(raw: string | string[] | undefined): string | undefined {
  return typeof raw === "string" && CURSOR_PATTERN.test(raw) ? raw : undefined;
}

/** "340 KB", "1,2 MB": sizes are for judging weight, not for exact accounting. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1).replace(".", ",") : Math.round(kilobytes)} KB`;

  return `${(kilobytes / 1024).toFixed(1).replace(".", ",")} MB`;
}
