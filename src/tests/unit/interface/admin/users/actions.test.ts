import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { SESSION_EXPIRED_MESSAGE } from "@/interface/admin/action-result";
import * as actions from "@/interface/admin/users/actions";
import { cookieJar, registerPolicyCases } from "@/tests/support/action-policy";
import { inviteTokens } from "@/infrastructure/auth/invite-token";
import { makeInvite, makeUser } from "@/tests/fakes/in-memory-auth";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const TARGET = makeUser({ id: "target", email: "target@example.org", name: "Target", role: "EDITOR" });

async function withTarget(user = TARGET) {
  testAuth.users.users.set(user.id, user);
}

const DAY = 24 * 60 * 60 * 1000;

async function withPendingInvite(overrides: Parameters<typeof makeInvite>[0] = {}) {
  const invite = makeInvite({ createdAt: new Date(Date.now() - DAY), expiresAt: new Date(Date.now() + DAY), ...overrides });

  await testAuth.invites.create(invite);

  return invite;
}

function inviteForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("users server actions", () => {
  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: "src/interface/admin/users/actions.ts",
      actionCalls: {
        createAdminInvite: async () => {
          vi.stubEnv("AUTH_URL", "https://admin.example.org");

          try {
            return await actions.createAdminInvite(null, inviteForm({ email: "new@example.org", role: "EDITOR" }));
          } finally {
            // A lone AUTH_URL is a half-set Google configuration, which switches the emergency login off for later tests.
            vi.stubEnv("AUTH_URL", undefined);
          }
        },
        revokeAdminInvite: async () => actions.revokeAdminInvite((await withPendingInvite()).id),
        changeUserRole: async () => (await withTarget(), actions.changeUserRole("target", "ADMIN")),
        setUserActive: async () => (await withTarget(), actions.setUserActive("target", false)),
      },
      cookiesMock,
      untouchedMocks: [revalidatePathMock],
    });
  });

  describe("behaviour", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      cookieJar(cookiesMock, await signInAs("ADMIN"));
    });

    describe("createAdminInvite", () => {
      beforeEach(() => vi.stubEnv("AUTH_URL", "https://admin.example.org/"));
      afterEach(() => vi.stubEnv("AUTH_URL", undefined));

      it("returns a link to the invitation page whose token is not what the database keeps", async () => {
        const result = await actions.createAdminInvite(null, inviteForm({ email: " New.Person@Example.ORG ", role: "ADMIN" }));

        expect(result).toEqual({ success: true, link: expect.stringMatching(/^https:\/\/admin\.example\.org\/invitacion\/[A-Za-z0-9_-]{43}$/) });
        const token = (result as { link: string }).link.split("/invitacion/")[1]!;
        const [stored] = [...testAuth.invites.invites.values()];

        expect(stored).toMatchObject({ email: "new.person@example.org", role: "ADMIN", tokenHash: inviteTokens.hash(token), createdById: "test-admin" });
        expect(JSON.stringify([...testAuth.invites.invites.values()])).not.toContain(token);
        expect(revalidatePathMock).toHaveBeenCalledWith("/admin/usuarios");
      });

      it("audits invite.create with the role and the invite id, never the email or the token", async () => {
        const result = await actions.createAdminInvite(null, inviteForm({ email: "private.person@example.org", role: "EDITOR" }));
        const token = (result as { link: string }).link.split("/invitacion/")[1]!;
        const [invite] = [...testAuth.invites.invites.values()];

        expect(testAuth.audit.entries).toHaveLength(1);
        expect(testAuth.audit.entries[0]).toMatchObject({ action: "invite.create", entityType: "invite", entityId: invite?.id, actorUserId: "test-admin" });
        expect(testAuth.audit.entries[0]?.summary).toContain("Editor");
        expect(JSON.stringify(testAuth.audit.entries)).not.toContain("private.person");
        expect(JSON.stringify(testAuth.audit.entries)).not.toContain("@");
        expect(JSON.stringify(testAuth.audit.entries)).not.toContain(token);
      });

      it("audits invite.revoke for each invite the new one supersedes, with no email or token", async () => {
        const older = await withPendingInvite({ id: "older", tokenHash: "c".repeat(64), email: "again@example.org" });
        const result = await actions.createAdminInvite(null, inviteForm({ email: "again@example.org", role: "EDITOR" }));
        const token = (result as { link: string }).link.split("/invitacion/")[1]!;
        const created = [...testAuth.invites.invites.values()].find((invite) => invite.id !== older.id)!;

        expect(testAuth.invites.invites.get(older.id)?.revokedAt).toBeInstanceOf(Date);
        expect(testAuth.audit.entries).toHaveLength(2);
        expect(testAuth.audit.entries).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ action: "invite.create", entityType: "invite", entityId: created.id }),
            expect.objectContaining({
              action: "invite.revoke",
              entityType: "invite",
              entityId: older.id,
              actorUserId: "test-admin",
              summary: "Invitación anterior revocada al generar una nueva",
            }),
          ]),
        );
        expect(JSON.stringify(testAuth.audit.entries)).not.toContain("@");
        expect(JSON.stringify(testAuth.audit.entries)).not.toContain(token);
      });

      it("writes no invite.revoke when the invite supersedes nothing", async () => {
        await actions.createAdminInvite(null, inviteForm({ email: "fresh@example.org", role: "EDITOR" }));

        expect(testAuth.audit.entries.map((entry) => entry.action)).toEqual(["invite.create"]);
      });

      it("says in Spanish, on the field, that an email is taken, malformed, or that the role is not valid, storing nothing", async () => {
        await withTarget();

        expect(await actions.createAdminInvite(null, inviteForm({ email: "target@example.org", role: "EDITOR" }))).toEqual({ fieldErrors: { email: "Ese correo ya está registrado." } });
        expect(await actions.createAdminInvite(null, inviteForm({ email: "nope", role: "EDITOR" }))).toEqual({ fieldErrors: { email: "Escriba un correo válido." } });
        expect(await actions.createAdminInvite(null, inviteForm({ email: "ok@example.org", role: "OWNER" }))).toEqual({ fieldErrors: { role: "Elija un rol de la lista." } });
        expect(await actions.createAdminInvite(null, inviteForm({ email: "ok@example.org" }))).toEqual({ fieldErrors: { role: "Elija un rol de la lista." } });
        expect(testAuth.invites.invites.size).toBe(0);
        expect(testAuth.audit.entries).toEqual([]);
      });

      it.each([["not set", undefined], ["not a usable origin", "ftp://admin.example.org"]])("refuses to make a link when AUTH_URL is %s, storing nothing", async (_label, value) => {
        vi.stubEnv("AUTH_URL", value);

        const result = await actions.createAdminInvite(null, inviteForm({ email: "new@example.org", role: "EDITOR" }));

        expect(result).toEqual({ error: expect.stringContaining("AUTH_URL") });
        expect(testAuth.invites.invites.size).toBe(0);
        expect(testAuth.audit.entries).toEqual([]);
      });

      it("an editor cannot invite: nothing is stored", async () => {
        cookieJar(cookiesMock, await signInAs("EDITOR"));

        expect(await actions.createAdminInvite(null, inviteForm({ email: "sneaky@example.org", role: "ADMIN" }))).toEqual({ error: "No tiene permiso para realizar esta acción." });
        expect(testAuth.invites.invites.size).toBe(0);
      });
    });

    describe("revokeAdminInvite", () => {
      it("revokes a pending invite, audits it without the email, and refreshes the page", async () => {
        const invite = await withPendingInvite({ email: "ben@example.org" });

        expect(await actions.revokeAdminInvite(invite.id)).toEqual({ success: true });
        expect(testAuth.invites.invites.get(invite.id)?.revokedAt).toBeInstanceOf(Date);
        expect(testAuth.audit.entries[0]).toMatchObject({ action: "invite.revoke", entityType: "invite", entityId: invite.id, actorUserId: "test-admin" });
        expect(JSON.stringify(testAuth.audit.entries)).not.toContain("ben");
        expect(revalidatePathMock).toHaveBeenCalledWith("/admin/usuarios");
      });

      it("says the invite is no longer pending when it was already revoked, used or never existed, auditing nothing", async () => {
        const invite = await withPendingInvite();
        await actions.revokeAdminInvite(invite.id);
        testAuth.audit.entries.length = 0;

        const used = await withPendingInvite({ id: "used", usedAt: new Date(), usedByUserId: "x" });

        for (const id of [invite.id, used.id, "ghost"]) {
          expect(await actions.revokeAdminInvite(id)).toEqual({ error: "La invitación ya no está pendiente." });
        }

        expect(testAuth.audit.entries).toEqual([]);
      });

      it("an editor cannot revoke: the invite stays pending", async () => {
        const invite = await withPendingInvite();
        cookieJar(cookiesMock, await signInAs("EDITOR"));

        expect(await actions.revokeAdminInvite(invite.id)).toEqual({ error: "No tiene permiso para realizar esta acción." });
        expect(testAuth.invites.invites.get(invite.id)?.revokedAt).toBeNull();
      });
    });

    describe("changeUserRole", () => {
      it("changes the role, and the user's next request sees it", async () => {
        await withTarget();

        expect(await actions.changeUserRole("target", "ADMIN")).toEqual({ success: true });
        expect((await testAuth.users.findById("target"))?.role).toBe("ADMIN");
      });

      it("refuses to demote the last active admin, with a clear message, and audits nothing", async () => {
        expect(await actions.changeUserRole("test-admin", "EDITOR")).toEqual({ error: "No se puede quitar ni degradar al último administrador activo." });
        expect((await testAuth.users.findById("test-admin"))?.role).toBe("ADMIN");
        expect(testAuth.audit.entries).toEqual([]);
      });

      it("refuses an unknown role and an unknown user", async () => {
        await withTarget();

        expect(await actions.changeUserRole("target", "owner")).toEqual({ fieldErrors: { role: "Elija un rol de la lista." } });
        expect(await actions.changeUserRole("ghost", "ADMIN")).toEqual({ error: "No se encontró el usuario." });
      });
    });

    describe("setUserActive", () => {
      it("deactivating signs the user out everywhere", async () => {
        await withTarget();
        await testAuth.services.startSession.execute({ subject: { kind: "user", userId: "target" } });
        await testAuth.services.startSession.execute({ subject: { kind: "user", userId: "target" } });

        expect(await actions.setUserActive("target", false)).toEqual({ success: true });

        expect((await testAuth.users.findById("target"))?.active).toBe(false);
        expect([...testAuth.sessions.sessions.values()].filter((session) => session.userId === "target").every((session) => session.revokedAt)).toBe(true);
        expect(testAuth.audit.entries[0]?.action).toBe("user.deactivate");
      });

      it("reactivating is audited as such and does not touch sessions", async () => {
        await withTarget({ ...TARGET, active: false });

        expect(await actions.setUserActive("target", true)).toEqual({ success: true });

        expect((await testAuth.users.findById("target"))?.active).toBe(true);
        expect(testAuth.audit.entries[0]?.action).toBe("user.reactivate");
      });

      it("cannot deactivate the last active admin, even the one acting", async () => {
        expect(await actions.setUserActive("test-admin", false)).toEqual({ error: "No se puede quitar ni degradar al último administrador activo." });
        expect((await testAuth.users.findById("test-admin"))?.active).toBe(true);
      });
    });

    it("every action answers a missing session with the expired-session message and writes nothing", async () => {
      cookieJar(cookiesMock, undefined);
      await withTarget();

      for (const result of [
        await actions.createAdminInvite(null, inviteForm({ email: "x@example.org", role: "EDITOR" })),
        await actions.revokeAdminInvite("any"),
        await actions.changeUserRole("target", "ADMIN"),
        await actions.setUserActive("target", false),
      ]) {
        expect(result).toEqual({ error: SESSION_EXPIRED_MESSAGE });
      }

      expect(testAuth.audit.entries).toEqual([]);
      expect((await testAuth.users.findById("target"))).toEqual(TARGET);
    });
  });
});
