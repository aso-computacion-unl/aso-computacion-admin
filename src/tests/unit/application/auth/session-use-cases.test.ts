import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ListActiveSessionsUseCase,
  RevokeSessionUseCase,
  SESSION_TTL_MS,
  StartSessionUseCase,
  ValidateSessionUseCase,
} from "@/application/auth/session.use-cases";
import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import type { Actor } from "@/domain/user";
import { InMemorySessionRepository, InMemoryUserRepository, makeUser } from "@/tests/fakes/in-memory-auth";

const NOW = new Date("2026-10-26T12:00:00.000Z");

let users: InMemoryUserRepository;
let sessions: InMemorySessionRepository;
let clock: Date;
let ids: string[];

const now = () => clock;
const newId = () => ids.shift() ?? "unexpected-id";
const start = () => new StartSessionUseCase(sessions, users, now, newId);
const validate = () => new ValidateSessionUseCase(sessions, now);

beforeEach(() => {
  clock = NOW;
  ids = ["s1", "s2", "s3", "s4"];
  users = new InMemoryUserRepository([makeUser({ id: "ana", role: "EDITOR" }), makeUser({ id: "root", email: "root@example.org", name: "Root", role: "ADMIN" })]);
  sessions = new InMemorySessionRepository(users);
});

describe("StartSessionUseCase", () => {
  it("opens a session that lasts the cookie's lifetime and records the login", async () => {
    const result = await start().execute({ subject: { kind: "user", userId: "ana" }, userAgent: "UA", ipHash: "abc" });

    expect(result).toEqual({ sessionId: "s1", expiresAt: new Date(NOW.getTime() + SESSION_TTL_MS) });
    expect(sessions.sessions.get("s1")).toMatchObject({ kind: "user", userId: "ana", revokedAt: null, userAgent: "UA", ipHash: "abc" });
    expect((await users.findById("ana"))?.lastLoginAt).toEqual(NOW);
  });

  it("opens a break-glass session with no user", async () => {
    await start().execute({ subject: { kind: "break_glass" } });

    expect(sessions.sessions.get("s1")).toMatchObject({ kind: "break_glass", userId: null });
  });

  it("truncates a long user agent", async () => {
    await start().execute({ subject: { kind: "break_glass" }, userAgent: "x".repeat(500) });

    expect(sessions.sessions.get("s1")?.userAgent).toHaveLength(200);
  });

  it("rotates: the session the browser presented is revoked when a new one opens", async () => {
    await start().execute({ subject: { kind: "user", userId: "ana" } });
    await start().execute({ subject: { kind: "user", userId: "ana" }, replaces: "s1" });

    expect(sessions.sessions.get("s1")?.revokedAt).toEqual(NOW);
    expect(sessions.sessions.get("s2")?.revokedAt).toBeNull();
  });
});

describe("ValidateSessionUseCase", () => {
  const userSession = async () => (await start().execute({ subject: { kind: "user", userId: "ana" } })).sessionId;

  it("resolves the actor from the database: the role is the user's current one", async () => {
    const sessionId = await userSession();

    expect(await validate().execute({ sessionId, kind: "user", breakGlassEnabled: false })).toEqual({
      kind: "user",
      sessionId,
      userId: "ana",
      name: "Ana",
      role: "EDITOR",
    });

    await users.applyChange("ana", { role: "ADMIN" });

    expect((await validate().execute({ sessionId, kind: "user", breakGlassEnabled: false }))?.role).toBe("ADMIN");
  });

  it.each([
    ["an unknown session", async () => "ghost"],
    [
      "a revoked session",
      async () => {
        const id = await userSession();
        await sessions.revoke(id, NOW);
        return id;
      },
    ],
    [
      "an expired session",
      async () => {
        const id = await userSession();
        clock = new Date(NOW.getTime() + SESSION_TTL_MS);
        return id;
      },
    ],
    [
      "a session of a deactivated user",
      async () => {
        const id = await userSession();
        await users.applyChange("ana", { active: false });
        return id;
      },
    ],
  ])("rejects %s", async (_label, arrange) => {
    const sessionId = await arrange();

    expect(await validate().execute({ sessionId, kind: "user", breakGlassEnabled: true })).toBeNull();
  });

  it("rejects a token whose kind differs from the session's", async () => {
    const sessionId = await userSession();

    expect(await validate().execute({ sessionId, kind: "break_glass", breakGlassEnabled: true })).toBeNull();
  });

  describe("break-glass", () => {
    const breakGlassSession = async () => (await start().execute({ subject: { kind: "break_glass" } })).sessionId;

    it("resolves to a synthetic admin while the emergency login is enabled", async () => {
      const sessionId = await breakGlassSession();

      expect(await validate().execute({ sessionId, kind: "break_glass", breakGlassEnabled: true })).toEqual({
        kind: "break_glass",
        sessionId,
        userId: null,
        name: "Acceso de emergencia",
        role: "ADMIN",
      });
    });

    it("is rejected once an admin revoked it", async () => {
      const sessionId = await breakGlassSession();
      await sessions.revoke(sessionId, NOW);

      expect(await validate().execute({ sessionId, kind: "break_glass", breakGlassEnabled: true })).toBeNull();
    });

    it("is rejected when the emergency login was switched off (Google configured), though the row is still active", async () => {
      const sessionId = await breakGlassSession();

      expect(await validate().execute({ sessionId, kind: "break_glass", breakGlassEnabled: false })).toBeNull();
      expect(sessions.sessions.get(sessionId)?.revokedAt).toBeNull();
    });

    it("expires like any session", async () => {
      const sessionId = await breakGlassSession();
      clock = new Date(NOW.getTime() + SESSION_TTL_MS + 1);

      expect(await validate().execute({ sessionId, kind: "break_glass", breakGlassEnabled: true })).toBeNull();
    });
  });

  it("touches lastSeenAt at most once a minute, and a failing touch does not fail the request", async () => {
    const sessionId = await userSession();

    clock = new Date(NOW.getTime() + 10_000);
    await validate().execute({ sessionId, kind: "user", breakGlassEnabled: false });
    expect(sessions.touched).toEqual([]);

    clock = new Date(NOW.getTime() + 61_000);
    await validate().execute({ sessionId, kind: "user", breakGlassEnabled: false });
    expect(sessions.touched).toEqual([sessionId]);

    sessions.touch = async () => {
      throw new Error("db down");
    };
    clock = new Date(NOW.getTime() + 200_000);
    await expect(validate().execute({ sessionId, kind: "user", breakGlassEnabled: false })).resolves.not.toBeNull();
  });
});

const editor: Actor = { kind: "user", sessionId: "own", userId: "ana", name: "Ana", role: "EDITOR" };
const admin: Actor = { kind: "user", sessionId: "adm", userId: "root", name: "Root", role: "ADMIN" };

describe("ListActiveSessionsUseCase", () => {
  beforeEach(async () => {
    await start().execute({ subject: { kind: "user", userId: "ana" } });
    await start().execute({ subject: { kind: "user", userId: "root" } });
    await start().execute({ subject: { kind: "break_glass" } });
  });

  it("shows an editor only their own sessions", async () => {
    const list = await new ListActiveSessionsUseCase(sessions, now).execute({ actor: editor });

    expect(list.map((session) => session.userId)).toEqual(["ana"]);
  });

  it("shows an admin everyone's, break-glass included", async () => {
    const list = await new ListActiveSessionsUseCase(sessions, now).execute({ actor: admin });

    expect(list.map((session) => session.id).sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("shows an editor without a user id nothing, never everyone's (an empty id is not a wildcard)", async () => {
    const orphan: Actor = { kind: "user", sessionId: "x", userId: null, name: "Orphan", role: "EDITOR" };

    expect(await new ListActiveSessionsUseCase(sessions, now).execute({ actor: orphan })).toEqual([]);
  });

  it("asks the repository for an explicit scope: the actor's own id, or all only for an admin", async () => {
    const listActive = vi.spyOn(sessions, "listActive");
    const list = new ListActiveSessionsUseCase(sessions, now);

    await list.execute({ actor: editor });
    await list.execute({ actor: admin });

    expect(listActive).toHaveBeenNthCalledWith(1, NOW, { userId: "ana" });
    expect(listActive).toHaveBeenNthCalledWith(2, NOW, "all");
    expect(listActive).not.toHaveBeenCalledWith(NOW, undefined);
  });

  it("never lists others' sessions for an editor, whoever the scope names", async () => {
    expect((await sessions.listActive(NOW, { userId: "" })).map((session) => session.id)).toEqual([]);
  });

  it("shows a break-glass actor everything (it is an admin)", async () => {
    const breakGlass: Actor = { kind: "break_glass", sessionId: "s3", userId: null, name: "Acceso de emergencia", role: "ADMIN" };

    expect(await new ListActiveSessionsUseCase(sessions, now).execute({ actor: breakGlass })).toHaveLength(3);
  });
});

describe("RevokeSessionUseCase", () => {
  beforeEach(async () => {
    await start().execute({ subject: { kind: "user", userId: "ana" } });
    await start().execute({ subject: { kind: "user", userId: "root" } });
    await start().execute({ subject: { kind: "break_glass" } });
  });

  const revoke = () => new RevokeSessionUseCase(sessions, now);

  it("lets anyone revoke their own session", async () => {
    await revoke().execute({ actor: editor, sessionId: "s1" });

    expect(sessions.sessions.get("s1")?.revokedAt).toEqual(NOW);
  });

  it("refuses an editor revoking someone else's, and changes nothing", async () => {
    await expect(revoke().execute({ actor: editor, sessionId: "s2" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(revoke().execute({ actor: editor, sessionId: "s3" })).rejects.toBeInstanceOf(ForbiddenError);

    expect(sessions.sessions.get("s2")?.revokedAt).toBeNull();
    expect(sessions.sessions.get("s3")?.revokedAt).toBeNull();
  });

  it("lets an admin revoke any session, break-glass included", async () => {
    await revoke().execute({ actor: admin, sessionId: "s1" });
    await revoke().execute({ actor: admin, sessionId: "s3" });

    expect(sessions.sessions.get("s1")?.revokedAt).toEqual(NOW);
    expect(sessions.sessions.get("s3")?.revokedAt).toEqual(NOW);
  });

  it("reports an unknown or already revoked session as not found", async () => {
    await expect(revoke().execute({ actor: admin, sessionId: "ghost" })).rejects.toBeInstanceOf(NotFoundError);

    await revoke().execute({ actor: admin, sessionId: "s1" });

    await expect(revoke().execute({ actor: admin, sessionId: "s1" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
