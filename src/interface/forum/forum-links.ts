import type { ThreadFilter } from "./forum-display";

/** The URL of a category page. The default filter and the first page are left out, so the plain URL stays the canonical one. */
export function categoryHref(slug: string, options: { filter?: ThreadFilter; page?: number } = {}): string {
  const query = new URLSearchParams();

  if (options.filter === "solved") query.set("estado", "resueltos");
  if (options.page && options.page > 1) query.set("pagina", String(options.page));

  const suffix = query.toString();

  return `/foro/c/${slug}${suffix ? `?${suffix}` : ""}`;
}

/** The URL of the forum home list. Like `categoryHref`, the default tab, every category and the first page are left out. */
export function feedHref(options: { category?: string; filter?: ThreadFilter; page?: number } = {}): string {
  const query = new URLSearchParams();

  if (options.category) query.set("categoria", options.category);
  if (options.filter === "solved") query.set("estado", "resueltos");
  if (options.page && options.page > 1) query.set("pagina", String(options.page));

  const suffix = query.toString();

  return `/foro${suffix ? `?${suffix}` : ""}`;
}
