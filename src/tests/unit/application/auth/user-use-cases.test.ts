import { beforeEach, describe, expect, it } from "vitest";

import { LastAdminError } from "@/application/auth/auth-errors";
import { ChangeUserRoleUseCase, SetUserActiveUseCase } from "@/application/auth/user.use-cases";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import { InMemorySessionRepository, InMemoryUserRepository, makeUser } from "@/tests/fakes/in-memory-auth";

const NOW = new Date("2026-10-26T12:00:00.000Z");

let users: InMemoryUserRepository;
let sessions: InMemorySessionRepository;

beforeEach(() => {
  users = new InMemoryUserRepository([
    makeUser({ id: "root", email: "root@example.org", name: "Root", role: "ADMIN" }),
    makeUser({ id: "ana", email: "ana@example.org", name: "Ana", role: "EDITOR" }),
  ]);
  sessions = new InMemorySessionRepository(users);
});

describe("ChangeUserRoleUseCase", () => {
  const change = () => new ChangeUserRoleUseCase(users);

  it("promotes an editor", async () => {
    await change().execute({ id: "ana", role: "ADMIN" });

    expect((await users.findById("ana"))?.role).toBe("ADMIN");
  });

  it("demotes an admin while another active admin remains", async () => {
    await change().execute({ id: "ana", role: "ADMIN" });
    await change().execute({ id: "root", role: "EDITOR" });

    expect((await users.findById("root"))?.role).toBe("EDITOR");
  });

  it("cannot demote the last active admin, and changes nothing", async () => {
    await expect(change().execute({ id: "root", role: "EDITOR" })).rejects.toBeInstanceOf(LastAdminError);

    expect((await users.findById("root"))?.role).toBe("ADMIN");
  });

  it("does not count a deactivated admin as a remaining admin", async () => {
    users.users.set("old", makeUser({ id: "old", email: "old@example.org", role: "ADMIN", active: false }));

    await expect(change().execute({ id: "root", role: "EDITOR" })).rejects.toBeInstanceOf(LastAdminError);
  });

  it("reports an unknown user and an invalid role", async () => {
    await expect(change().execute({ id: "ghost", role: "ADMIN" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(change().execute({ id: "ana", role: "boss" as never })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("SetUserActiveUseCase", () => {
  const setActive = () => new SetUserActiveUseCase(users, sessions, () => NOW);

  beforeEach(async () => {
    for (const [id, userId] of [["s-ana-1", "ana"], ["s-ana-2", "ana"], ["s-root", "root"]] as const) {
      await sessions.create({ id, kind: "user", userId, createdAt: NOW, expiresAt: new Date(NOW.getTime() + 1e6), revokedAt: null, lastSeenAt: NOW, userAgent: null, ipHash: null });
    }
  });

  it("deactivating a user revokes all of their sessions and none of anyone else's", async () => {
    await setActive().execute({ id: "ana", active: false });

    expect((await users.findById("ana"))?.active).toBe(false);
    expect(sessions.sessions.get("s-ana-1")?.revokedAt).toEqual(NOW);
    expect(sessions.sessions.get("s-ana-2")?.revokedAt).toEqual(NOW);
    expect(sessions.sessions.get("s-root")?.revokedAt).toBeNull();
  });

  it("cannot deactivate the last active admin: nothing changes and the sessions stay", async () => {
    await expect(setActive().execute({ id: "root", active: false })).rejects.toBeInstanceOf(LastAdminError);

    expect((await users.findById("root"))?.active).toBe(true);
    expect(sessions.sessions.get("s-root")?.revokedAt).toBeNull();
  });

  it("reactivating brings the user back without touching sessions", async () => {
    await setActive().execute({ id: "ana", active: false });
    await setActive().execute({ id: "ana", active: true });

    expect((await users.findById("ana"))?.active).toBe(true);
  });

  it("reports an unknown user", async () => {
    await expect(setActive().execute({ id: "ghost", active: false })).rejects.toBeInstanceOf(NotFoundError);
  });
});
