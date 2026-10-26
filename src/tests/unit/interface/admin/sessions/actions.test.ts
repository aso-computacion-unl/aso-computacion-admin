import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { FORBIDDEN_MESSAGE, SESSION_EXPIRED_MESSAGE } from "@/interface/admin/action-result";
import * as actions from "@/interface/admin/sessions/actions";
import { cookieJar } from "@/tests/support/action-policy";
import { expectGuardFirstInEveryAction } from "@/tests/support/guard-first";
import { makeUser } from "@/tests/fakes/in-memory-auth";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const idsOf = (userId: string | null) => [...testAuth.sessions.sessions.values()].filter((session) => session.userId === userId).map((session) => session.id);
const revoked = (id: string) => testAuth.sessions.sessions.get(id)?.revokedAt != null;

describe("session server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("the guard is the first statement of every action", () => {
    expect(expectGuardFirstInEveryAction("src/interface/admin/sessions/actions.ts")).toEqual(["revokeSession"]);
  });

  it("rejects without a session and revokes nothing", async () => {
    const stray = await testAuth.services.startSession.execute({ subject: { kind: "break_glass" } });
    cookieJar(cookiesMock, undefined);

    expect(await actions.revokeSession(stray.sessionId)).toEqual({ error: SESSION_EXPIRED_MESSAGE });
    expect(revoked(stray.sessionId)).toBe(false);
    expect(testAuth.audit.entries).toEqual([]);
  });

  describe("an editor", () => {
    beforeEach(async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));
    });

    it("revokes another session of their own", async () => {
      const other = await testAuth.services.startSession.execute({ subject: { kind: "user", userId: "test-editor" } });

      expect(await actions.revokeSession(other.sessionId)).toEqual({ success: true });

      expect(revoked(other.sessionId)).toBe(true);
      expect(testAuth.audit.entries.map((entry) => [entry.action, entry.entityType, entry.entityId, entry.actorUserId])).toEqual([
        ["session.revoke", "session", other.sessionId, "test-editor"],
      ]);
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/sesiones");
    });

    it("cannot revoke someone else's session, an admin's or the emergency one: forbidden, nothing changes, nothing is audited", async () => {
      testAuth.users.users.set("ben", makeUser({ id: "ben", email: "ben@example.org" }));
      const bens = await testAuth.services.startSession.execute({ subject: { kind: "user", userId: "ben" } });
      await signInAs("ADMIN");
      const emergency = await testAuth.services.startSession.execute({ subject: { kind: "break_glass" } });

      for (const id of [bens.sessionId, ...idsOf("test-admin"), emergency.sessionId]) {
        expect(await actions.revokeSession(id)).toEqual({ error: FORBIDDEN_MESSAGE });
        expect(revoked(id)).toBe(false);
      }

      expect(testAuth.audit.entries).toEqual([]);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe("an admin", () => {
    beforeEach(async () => {
      cookieJar(cookiesMock, await signInAs("ADMIN"));
    });

    it("revokes any user's session and the emergency one", async () => {
      testAuth.users.users.set("ben", makeUser({ id: "ben", email: "ben@example.org" }));
      const bens = await testAuth.services.startSession.execute({ subject: { kind: "user", userId: "ben" } });
      const emergency = await testAuth.services.startSession.execute({ subject: { kind: "break_glass" } });

      expect(await actions.revokeSession(bens.sessionId)).toEqual({ success: true });
      expect(await actions.revokeSession(emergency.sessionId)).toEqual({ success: true });

      expect(revoked(bens.sessionId) && revoked(emergency.sessionId)).toBe(true);
      expect(testAuth.audit.entries.map((entry) => entry.entityId)).toEqual([emergency.sessionId, bens.sessionId]);
    });

    it("says the session is no longer active when it is unknown or already revoked", async () => {
      const gone = await testAuth.services.startSession.execute({ subject: { kind: "break_glass" } });
      await actions.revokeSession(gone.sessionId);

      expect(await actions.revokeSession(gone.sessionId)).toEqual({ error: "La sesión ya no está activa." });
      expect(await actions.revokeSession("ghost")).toEqual({ error: "La sesión ya no está activa." });
    });

    it("an audit failure does not change the outcome", async () => {
      const target = await testAuth.services.startSession.execute({ subject: { kind: "break_glass" } });
      testAuth.audit.failWith = new Error("db down");

      expect(await actions.revokeSession(target.sessionId)).toEqual({ success: true });
      expect(revoked(target.sessionId)).toBe(true);
    });
  });
});
