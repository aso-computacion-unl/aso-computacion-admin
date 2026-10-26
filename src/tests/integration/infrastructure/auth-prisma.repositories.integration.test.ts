import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";
import { AuditLogPrismaRepository } from "@/infrastructure/repositories/audit-log-prisma.repository";
import { SessionPrismaRepository } from "@/infrastructure/repositories/session-prisma.repository";
import { UserPrismaRepository } from "@/infrastructure/repositories/user-prisma.repository";
import { makeUser } from "@/tests/fakes/in-memory-auth";

const users = new UserPrismaRepository();
const sessions = new SessionPrismaRepository();
const audit = new AuditLogPrismaRepository();

const T0 = new Date("2026-10-26T12:00:00.000Z");
const later = (ms: number) => new Date(T0.getTime() + ms);

const admin = (id: string) => makeUser({ id, email: `${id}@example.org`, name: id, role: "ADMIN" });

function sessionOf(id: string, userId: string | null, overrides: Record<string, unknown> = {}) {
  return { id, kind: userId ? ("user" as const) : ("break_glass" as const), userId, createdAt: T0, expiresAt: later(3_600_000), revokedAt: null, lastSeenAt: T0, userAgent: "UA", ipHash: "h", ...overrides };
}

describe("UserPrismaRepository (integration)", () => {
  it("creates a user and finds it by email and by id", async () => {
    expect(await users.create(makeUser({ id: "ana" }))).toBe(true);

    expect(await users.findByEmail("ana@example.org")).toEqual(makeUser({ id: "ana" }));
    expect(await users.findById("ana")).toMatchObject({ email: "ana@example.org", role: "EDITOR", active: true });
    expect(await users.findByEmail("ghost@example.org")).toBeNull();
  });

  it("reports a taken email instead of throwing, even for two creates at once", async () => {
    const results = await Promise.all([users.create(makeUser({ id: "a" })), users.create(makeUser({ id: "b" }))]);

    expect(results.sort()).toEqual([false, true]);
    expect(await prisma.user.count()).toBe(1);
  });

  it("lists users by email", async () => {
    await users.create(makeUser({ id: "b", email: "b@example.org" }));
    await users.create(makeUser({ id: "a", email: "a@example.org" }));

    expect((await users.list()).map((user) => user.id)).toEqual(["a", "b"]);
  });

  it("records the last login", async () => {
    await users.create(makeUser({ id: "ana" }));
    await users.recordLogin("ana", T0);

    expect((await users.findById("ana"))?.lastLoginAt).toEqual(T0);
  });

  describe("applyChange keeps at least one active admin", () => {
    it("changes a role and the active flag, and reports an unknown user", async () => {
      await users.create(makeUser({ id: "ana" }));

      expect(await users.applyChange("ana", { role: "ADMIN" })).toBe("ok");
      expect(await users.applyChange("ana", { active: false })).toBe("last-admin");
      expect(await users.applyChange("ghost", { role: "ADMIN" })).toBe("not-found");
    });

    it("refuses to demote or deactivate the only active admin, and leaves it untouched", async () => {
      await users.create(admin("root"));
      await users.create(makeUser({ id: "off", email: "off@example.org", role: "ADMIN", active: false }));

      expect(await users.applyChange("root", { role: "EDITOR" })).toBe("last-admin");
      expect(await users.applyChange("root", { active: false })).toBe("last-admin");
      expect(await users.findById("root")).toMatchObject({ role: "ADMIN", active: true });
    });

    it("allows it while another active admin remains", async () => {
      await users.create(admin("one"));
      await users.create(admin("two"));

      expect(await users.applyChange("one", { role: "EDITOR" })).toBe("ok");
      expect(await users.applyChange("two", { active: false })).toBe("last-admin");
    });

    it("cannot be raced: two admins demoting each other at once leave one admin", async () => {
      await users.create(admin("one"));
      await users.create(admin("two"));

      const outcomes = await Promise.all([users.applyChange("one", { role: "EDITOR" }), users.applyChange("two", { role: "EDITOR" })]);

      expect(outcomes.sort()).toEqual(["last-admin", "ok"]);
      expect(await prisma.user.count({ where: { role: "ADMIN", active: true } })).toBe(1);
    });

    it("lets a non-admin be deactivated freely and an inactive admin be promoted back", async () => {
      await users.create(admin("root"));
      await users.create(makeUser({ id: "ana" }));

      expect(await users.applyChange("ana", { active: false })).toBe("ok");
      expect(await users.applyChange("ana", { active: true, role: "ADMIN" })).toBe("ok");
    });
  });
});

describe("SessionPrismaRepository (integration)", () => {
  it("round-trips a user session with its user and a break-glass one without", async () => {
    await users.create(makeUser({ id: "ana" }));
    await sessions.create(sessionOf("s1", "ana"));
    await sessions.create(sessionOf("s2", null));

    expect(await sessions.findWithUser("s1")).toMatchObject({ session: { id: "s1", kind: "user", userId: "ana", revokedAt: null }, user: { id: "ana", role: "EDITOR" } });
    expect(await sessions.findWithUser("s2")).toMatchObject({ session: { kind: "break_glass", userId: null }, user: null });
    expect(await sessions.findWithUser("ghost")).toBeNull();
  });

  it("revokes once: true the first time, false after, and false for an unknown session", async () => {
    await users.create(makeUser({ id: "ana" }));
    await sessions.create(sessionOf("s1", "ana"));

    expect(await sessions.revoke("s1", later(1))).toBe(true);
    expect(await sessions.revoke("s1", later(2))).toBe(false);
    expect(await sessions.revoke("ghost", later(2))).toBe(false);
    expect((await sessions.findWithUser("s1"))?.session.revokedAt).toEqual(later(1));
  });

  it("revokes all of a user's active sessions and only theirs", async () => {
    await users.create(makeUser({ id: "ana" }));
    await users.create(makeUser({ id: "ben", email: "ben@example.org" }));
    await sessions.create(sessionOf("s1", "ana"));
    await sessions.create(sessionOf("s2", "ana"));
    await sessions.create(sessionOf("s3", "ben"));

    expect(await sessions.revokeAllForUser("ana", later(1))).toBe(2);
    expect((await sessions.findWithUser("s3"))?.session.revokedAt).toBeNull();
  });

  it("touches lastSeenAt", async () => {
    await users.create(makeUser({ id: "ana" }));
    await sessions.create(sessionOf("s1", "ana"));
    await sessions.touch("s1", later(5));

    expect((await sessions.findWithUser("s1"))?.session.lastSeenAt).toEqual(later(5));
  });

  it("lists only active sessions, newest first, optionally for one user, with the user's name", async () => {
    await users.create(makeUser({ id: "ana" }));
    await users.create(makeUser({ id: "ben", email: "ben@example.org", name: "Ben" }));
    await sessions.create(sessionOf("old", "ana", { createdAt: T0 }));
    await sessions.create(sessionOf("new", "ben", { createdAt: later(10) }));
    await sessions.create(sessionOf("gone", "ana", { revokedAt: later(1) }));
    await sessions.create(sessionOf("expired", "ana", { expiresAt: later(-1) }));
    await sessions.create(sessionOf("bg", null, { createdAt: later(20) }));

    const all = await sessions.listActive(later(100), "all");

    expect(all.map((session) => session.id)).toEqual(["bg", "new", "old"]);
    expect(all[1]).toMatchObject({ userName: "Ben", userEmail: "ben@example.org", kind: "user" });
    expect(all[0]).toMatchObject({ userName: null, kind: "break_glass" });
    expect((await sessions.listActive(later(100), { userId: "ana" })).map((session) => session.id)).toEqual(["old"]);
    expect(await sessions.listActive(later(100), { userId: "" })).toEqual([]);
  });
});

describe("AuditLogPrismaRepository (integration)", () => {
  const record = (action: string, entityType: string, actor: { actorUserId: string | null; actorKind: "user" | "break_glass" | "system" }, at: number) =>
    audit.record({ ...actor, action, entityType, entityId: "e1", summary: action }, later(at));

  it("stores an entry as given and reads it back", async () => {
    await audit.record({ actorUserId: null, actorKind: "break_glass", action: "login.success", entityType: "session", summary: "Acceso de emergencia" }, T0);

    expect(await audit.list({ page: 1, pageSize: 10 })).toMatchObject({
      total: 1,
      items: [{ actorUserId: null, actorKind: "break_glass", action: "login.success", entityType: "session", entityId: null, summary: "Acceso de emergencia", at: T0 }],
    });
  });

  it("lists newest first, paginated, with the total", async () => {
    for (let index = 0; index < 5; index += 1) await record(`a${index}`, "event", { actorUserId: "ana", actorKind: "user" }, index);

    const first = await audit.list({ page: 1, pageSize: 2 });
    const last = await audit.list({ page: 3, pageSize: 2 });

    expect(first.total).toBe(5);
    expect(first.items.map((entry) => entry.action)).toEqual(["a4", "a3"]);
    expect(last.items.map((entry) => entry.action)).toEqual(["a0"]);
  });

  it("filters by entity type and by actor (a user id, or the break-glass / system kind)", async () => {
    await record("event.create", "event", { actorUserId: "ana", actorKind: "user" }, 1);
    await record("faq.create", "faq", { actorUserId: "ana", actorKind: "user" }, 2);
    await record("faq.trash", "faq", { actorUserId: null, actorKind: "break_glass" }, 3);
    await record("deploy", "settings", { actorUserId: null, actorKind: "system" }, 4);

    const actions = async (criteria: { entityType?: string; actor?: string }) =>
      (await audit.list({ ...criteria, page: 1, pageSize: 10 })).items.map((entry) => entry.action);

    expect(await actions({ entityType: "faq" })).toEqual(["faq.trash", "faq.create"]);
    expect(await actions({ actor: "ana" })).toEqual(["faq.create", "event.create"]);
    expect(await actions({ actor: "break_glass" })).toEqual(["faq.trash"]);
    expect(await actions({ actor: "system" })).toEqual(["deploy"]);
    expect(await actions({ actor: "ana", entityType: "faq" })).toEqual(["faq.create"]);
  });

  it("lists the entity types present, sorted", async () => {
    await record("a", "faq", { actorUserId: null, actorKind: "system" }, 1);
    await record("b", "event", { actorUserId: null, actorKind: "system" }, 2);
    await record("c", "faq", { actorUserId: null, actorKind: "system" }, 3);

    expect(await audit.entityTypes()).toEqual(["event", "faq"]);
  });
});
