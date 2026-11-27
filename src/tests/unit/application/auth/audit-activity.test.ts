import { describe, expect, it } from "vitest";

import { ACTIVITY_DAYS, AuditActivityUseCase } from "@/application/auth/audit-activity.use-case";
import type { AuditActivityCriteria, AuditActivityReader, AuditDayCount } from "@/application/ports/auth.ports";

class StubActivityReader implements AuditActivityReader {
  readonly calls: AuditActivityCriteria[] = [];

  constructor(private readonly rows: AuditDayCount[] = []) {}

  async countByDay(criteria: AuditActivityCriteria) {
    this.calls.push(criteria);

    return this.rows;
  }
}

const admin = { role: "ADMIN" as const, userId: "root" };
const editor = { role: "EDITOR" as const, userId: "ana" };
// 2026-11-26 10:00 in Ecuador.
const NOW = new Date("2026-11-26T15:00:00.000Z");

describe("AuditActivityUseCase", () => {
  it("returns 112 days, oldest first, ending today, zero-filled, with the total", async () => {
    const reader = new StubActivityReader([
      { date: "2026-08-07", count: 2 },
      { date: "2026-11-20", count: 3 },
      { date: "2026-11-26", count: 1 },
    ]);

    const result = await new AuditActivityUseCase(reader).execute({ actor: admin, now: NOW });

    expect(ACTIVITY_DAYS).toBe(112);
    expect(result.days).toHaveLength(112);
    expect(result.days[0]).toEqual({ date: "2026-08-07", count: 2 });
    expect(result.days.at(-1)).toEqual({ date: "2026-11-26", count: 1 });
    expect(result.days.find((day) => day.date === "2026-11-20")?.count).toBe(3);
    expect(result.days.filter((day) => day.count === 0)).toHaveLength(109);
    expect(result.days.map((day) => day.date)).toEqual([...result.days.map((day) => day.date)].sort());
    expect(new Set(result.days.map((day) => day.date)).size).toBe(112);
    expect(result.total).toBe(6);
  });

  it("asks for [Ecuador midnight 111 days ago, Ecuador midnight tomorrow)", async () => {
    const reader = new StubActivityReader();

    await new AuditActivityUseCase(reader).execute({ actor: admin, now: NOW });

    expect(reader.calls).toEqual([{ from: new Date("2026-08-07T05:00:00.000Z"), to: new Date("2026-11-27T05:00:00.000Z") }]);
  });

  it("uses Ecuador's date, not UTC's: 23:30 in Ecuador is already the next day in UTC", async () => {
    const reader = new StubActivityReader();
    const lateEvening = new Date("2026-11-27T04:30:00.000Z");

    const result = await new AuditActivityUseCase(reader).execute({ actor: admin, now: lateEvening });

    expect(result.days.at(-1)?.date).toBe("2026-11-26");
    expect(reader.calls[0]?.to).toEqual(new Date("2026-11-27T05:00:00.000Z"));
  });

  it("starts the new day at Ecuador midnight (05:00 UTC)", async () => {
    const result = await new AuditActivityUseCase(new StubActivityReader()).execute({ actor: admin, now: new Date("2026-11-27T05:00:00.000Z") });

    expect(result.days.at(-1)?.date).toBe("2026-11-27");
    expect(result.days[0]?.date).toBe("2026-08-08");
  });

  it("gives an ADMIN the whole team, unfiltered", async () => {
    const reader = new StubActivityReader();

    const result = await new AuditActivityUseCase(reader).execute({ actor: admin, now: NOW });

    expect(result.scope).toBe("team");
    expect(reader.calls[0]).not.toHaveProperty("actorUserId");
  });

  it("gives break-glass (an ADMIN with no account) the whole team", async () => {
    const reader = new StubActivityReader();

    expect((await new AuditActivityUseCase(reader).execute({ actor: { role: "ADMIN", userId: null }, now: NOW })).scope).toBe("team");
    expect(reader.calls[0]).not.toHaveProperty("actorUserId");
  });

  it("gives an EDITOR only their own entries", async () => {
    const reader = new StubActivityReader([{ date: "2026-11-25", count: 4 }]);

    const result = await new AuditActivityUseCase(reader).execute({ actor: editor, now: NOW });

    expect(result.scope).toBe("own");
    expect(result.total).toBe(4);
    expect(reader.calls).toEqual([expect.objectContaining({ actorUserId: "ana" })]);
  });

  it("never shows the team to an EDITOR without an account", async () => {
    const reader = new StubActivityReader([{ date: "2026-11-25", count: 4 }]);

    const result = await new AuditActivityUseCase(reader).execute({ actor: { role: "EDITOR", userId: null }, now: NOW });

    expect(reader.calls).toEqual([]);
    expect(result).toMatchObject({ scope: "own", total: 0 });
    expect(result.days).toHaveLength(112);
  });
});
