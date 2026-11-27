import { todayInEcuador } from "@/domain/calendar-date";
import type { Actor } from "@/domain/user";

import type { AuditActivityReader, AuditDayCount } from "../ports/auth.ports";

/** 16 weeks, oldest first, ending today. */
export const ACTIVITY_DAYS = 16 * 7;

/** Ecuador is UTC-5 all year (no daylight saving): its midnight is 05:00 UTC. */
const ECUADOR_MIDNIGHT_UTC_HOURS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuditActivity {
  days: AuditDayCount[];
  total: number;
  scope: "team" | "own";
}

const isoDay = (utcMidnight: number) => new Date(utcMidnight).toISOString().slice(0, 10);

/** How many audit entries were made each day of the last 16 weeks: the team's for an ADMIN, their own for an EDITOR. */
export class AuditActivityUseCase {
  constructor(private readonly reader: AuditActivityReader) {}

  async execute(input: { actor: Pick<Actor, "role" | "userId">; now?: Date }): Promise<AuditActivity> {
    const today = Date.parse(`${todayInEcuador(input.now ?? new Date())}T00:00:00.000Z`);
    const dates = Array.from({ length: ACTIVITY_DAYS }, (_, index) => isoDay(today - (ACTIVITY_DAYS - 1 - index) * DAY_MS));
    const offset = ECUADOR_MIDNIGHT_UTC_HOURS * 60 * 60 * 1000;
    const from = new Date(today - (ACTIVITY_DAYS - 1) * DAY_MS + offset);
    const to = new Date(today + DAY_MS + offset);

    const own = input.actor.role !== "ADMIN";
    const { userId } = input.actor;
    // Fail closed: an EDITOR without an account (not a real session) sees nothing, never the team.
    const counts = !own ? await this.reader.countByDay({ from, to }) : userId ? await this.reader.countByDay({ from, to, actorUserId: userId }) : [];
    const byDate = new Map(counts.map((row) => [row.date, row.count]));
    const days = dates.map((date) => ({ date, count: byDate.get(date) ?? 0 }));

    return { days, total: days.reduce((sum, day) => sum + day.count, 0), scope: own ? "own" : "team" };
  }
}
