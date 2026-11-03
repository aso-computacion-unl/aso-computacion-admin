/** Soonest date first, undated last, the title breaking ties: the order the public registration lists use. */
export function soonestFirst(a: { date: string | null; title: string }, b: { date: string | null; title: string }): number {
  if (a.date === b.date) return a.title.localeCompare(b.title);
  if (a.date === null) return 1;
  if (b.date === null) return -1;

  return a.date < b.date ? -1 : 1;
}
