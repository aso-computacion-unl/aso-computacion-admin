import type { ThreadFilter } from "./forum-display";

/** The URL of the forum home list. The default tab, every category and the first page are left out. */
export function feedHref(options: { category?: string; filter?: ThreadFilter; page?: number } = {}): string {
  const query = new URLSearchParams();

  if (options.category) query.set("categoria", options.category);
  if (options.filter === "solved") query.set("estado", "resueltos");
  if (options.page && options.page > 1) query.set("pagina", String(options.page));

  const suffix = query.toString();

  return `/foro${suffix ? `?${suffix}` : ""}`;
}
