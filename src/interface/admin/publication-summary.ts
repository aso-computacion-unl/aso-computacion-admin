export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "2 publicados · 1 borrador": the one-line state of a list, shown on the home and the page heads. */
export function publicationSummary(items: readonly { isPublished: boolean }[]): string {
  if (items.length === 0) return "Sin elementos todavía";

  const published = items.filter((item) => item.isPublished).length;

  return `${pluralize(published, "publicado", "publicados")} · ${pluralize(items.length - published, "borrador", "borradores")}`;
}
