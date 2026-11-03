import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { SESSION_EXPIRED_MESSAGE } from "@/interface/admin/action-result";
import * as actions from "@/interface/admin/users/actions";
import { cookieJar, registerPolicyCases } from "@/tests/support/action-policy";
import { makeUser } from "@/tests/fakes/in-memory-auth";
import { signInAs, testAuth } from "@/tests/support/test-auth";

const TARGET = makeUser({ id: "target", email: "target@example.org", name: "Target", role: "EDITOR" });

async function withTarget(user = TARGET) {
  testAuth.users.users.set(user.id, user);
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
        inviteUser: () => actions.inviteUser(null, inviteForm({ email: "new@example.org", role: "EDITOR" })),
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

    describe("inviteUser", () => {
      it("registers the email lower-cased with the chosen role, active, and refreshes the page", async () => {
        const result = await actions.inviteUser(null, inviteForm({ email: " New.Person@Example.ORG ", name: "New Person", role: "ADMIN" }));

        expect(result).toEqual({ success: true });
        expect(await testAuth.users.findByEmail("new.person@example.org")).toMatchObject({ name: "New Person", role: "ADMIN", active: true });
        expect(revalidatePathMock).toHaveBeenCalledWith("/admin/usuarios");
      });

      it("keeps the email out of the audit entry", async () => {
        await actions.inviteUser(null, inviteForm({ email: "private.person@example.org", role: "EDITOR" }));

        expect(JSON.stringify(testAuth.audit.entries)).not.toContain("private.person");
        expect(JSON.stringify(testAuth.audit.entries)).not.toContain("@");
      });

      it("says in Spanish, on the field, that an email is taken, malformed, or that the role is not valid", async () => {
        await withTarget();

        expect(await actions.inviteUser(null, inviteForm({ email: "target@example.org", role: "EDITOR" }))).toEqual({
          fieldErrors: { email: "Ese correo ya está registrado." },
        });
        expect(await actions.inviteUser(null, inviteForm({ email: "nope", role: "EDITOR" }))).toEqual({ fieldErrors: { email: "Escriba un correo válido." } });
        expect(await actions.inviteUser(null, inviteForm({ email: "ok@example.org", role: "OWNER" }))).toEqual({ fieldErrors: { role: "Elija un rol de la lista." } });
        expect(await actions.inviteUser(null, inviteForm({ email: "ok@example.org" }))).toEqual({ fieldErrors: { role: "Elija un rol de la lista." } });
        expect(testAuth.audit.entries).toEqual([]);
      });

      it("an editor cannot invite: nothing is created", async () => {
        cookieJar(cookiesMock, await signInAs("EDITOR"));

        expect(await actions.inviteUser(null, inviteForm({ email: "sneaky@example.org", role: "ADMIN" }))).toEqual({ error: "No tiene permiso para realizar esta acción." });
        expect(await testAuth.users.findByEmail("sneaky@example.org")).toBeNull();
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
        await actions.inviteUser(null, inviteForm({ email: "x@example.org", role: "EDITOR" })),
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
