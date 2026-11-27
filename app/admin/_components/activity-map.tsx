import { cn } from "@/lib/utils";

export interface ActivityDay {
  /** YYYY-MM-DD */
  date: string;
  count: number;
}

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

/** How full one day's square is: 0 for no change, then four steps up to the busiest day of the map. */
export function activityLevel(count: number, max: number): ActivityLevel {
  if (count <= 0 || max <= 0) return 0;

  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as ActivityLevel;
}

/** Noon UTC, so the weekday and the day of the month never move with the server's zone. */
const dayOf = (date: string) => new Date(`${date}T12:00:00Z`);
/** Monday is the first row, as the calendar is read in Ecuador. */
const weekdayIndex = (date: string) => (dayOf(date).getUTCDay() + 6) % 7;
const LONG_DAY = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export interface ActivityCell {
  date: string | null;
  count: number;
  level: ActivityLevel;
}

export interface ActivitySummary {
  total: number;
  /** The day with the most changes (the earliest one on a tie), null when nothing changed. */
  busiest: ActivityDay | null;
  /** Week by week, Monday first: the first week starts with blanks before the oldest day, the last ends with blanks after the newest. */
  cells: ActivityCell[];
}

export function summarizeActivity(days: readonly ActivityDay[]): ActivitySummary {
  const max = days.reduce((top, day) => Math.max(top, day.count), 0);
  const busiest = max > 0 ? (days.find((day) => day.count === max) ?? null) : null;
  const lead = days[0] ? weekdayIndex(days[0].date) : 0;
  const trail = (7 - ((lead + days.length) % 7)) % 7;
  const blank: ActivityCell = { date: null, count: 0, level: 0 };

  return {
    total: days.reduce((sum, day) => sum + Math.max(0, day.count), 0),
    busiest,
    cells: [
      ...Array.from({ length: lead }, () => blank),
      ...days.map((day) => ({ date: day.date, count: day.count, level: activityLevel(day.count, max) })),
      ...Array.from({ length: trail }, () => blank),
    ],
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What a screen reader hears instead of the squares: the total and the busiest day. */
export function activityLabel({ total, busiest }: Pick<ActivitySummary, "total" | "busiest">, own: boolean): string {
  const whose = own ? "Tus cambios en las últimas 16 semanas" : "Actividad del equipo en las últimas 16 semanas";

  if (total === 0 || busiest === null) return `${whose}: sin cambios.`;

  return `${whose}: ${plural(total, "cambio", "cambios")}, el día más activo fue el ${LONG_DAY.format(dayOf(busiest.date)).replace(",", "")} con ${busiest.count}.`;
}

const LEVEL_CLASSES: Record<ActivityLevel, string> = {
  0: "bg-foreground/8",
  1: "bg-sky/35",
  2: "bg-sky/60",
  3: "bg-sky",
  4: "bg-sky-bright",
};

/**
 * The team's pulse on the home: one square per day of the last 16 weeks (oldest to newest), columns are weeks and
 * rows weekdays, five levels of sky. `own` is an editor's map, which counts only their own changes.
 */
export function ActivityMap({ days, own = false }: { days: readonly ActivityDay[]; own?: boolean }) {
  const summary = summarizeActivity(days);
  const captionId = "activity-map-caption";

  return (
    <figure aria-labelledby={captionId} className="m-0 grid justify-items-start gap-1.5 lg:justify-items-end">
      <div role="img" aria-label={activityLabel(summary, own)} className="grid grid-flow-col grid-rows-[repeat(7,0.6875rem)] auto-cols-[0.6875rem] gap-0.75">
        {summary.cells.map((cell, index) => (
          <i key={cell.date ?? `blank-${index}`} className={cn("rounded-[3px]", cell.date === null ? "invisible" : LEVEL_CLASSES[cell.level])} />
        ))}
      </div>
      <figcaption id={captionId} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-mist">
        <span>{own ? `Tus cambios: ${summary.total} · 16 semanas` : `${summary.total} cambios del equipo · 16 semanas`}</span>
        <span aria-hidden="true" className="inline-flex items-center gap-0.75 text-[0.6875rem]">
          menos
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <i key={level} className={cn("size-2.75 rounded-[3px]", LEVEL_CLASSES[level])} />
          ))}
          más
        </span>
      </figcaption>
    </figure>
  );
}
