export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "2 publicados · 1 borrador" from the two totals of a list. */
export function countsSummary({ published, draft }: { published: number; draft: number }): string {
  if (published + draft === 0) return "Sin elementos todavía";

  return `${pluralize(published, "publicado", "publicados")} · ${pluralize(draft, "borrador", "borradores")}`;
}

/** "2 publicados · 1 borrador": the one-line state of a list, shown on the home and the page heads. */
export function publicationSummary(items: readonly { isPublished: boolean }[]): string {
  const published = items.filter((item) => item.isPublished).length;

  return countsSummary({ published, draft: items.length - published });
}
