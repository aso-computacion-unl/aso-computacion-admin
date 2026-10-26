import { beforeEach, describe, expect, it } from "vitest";

import { ResolveGoogleLoginUseCase } from "@/application/auth/resolve-google-login.use-case";
import { InMemoryUserRepository, makeUser } from "@/tests/fakes/in-memory-auth";

const NOW = new Date("2026-10-26T12:00:00.000Z");

let users: InMemoryUserRepository;

const resolve = (config: { allowedDomain?: string; bootstrapEmails?: string[] } = {}) =>
  new ResolveGoogleLoginUseCase(users, { bootstrapEmails: [], ...config }, () => NOW, () => "boot-id");

beforeEach(() => {
  users = new InMemoryUserRepository([
    makeUser({ id: "ana", email: "ana@example.org", role: "EDITOR" }),
    makeUser({ id: "off", email: "off@example.org", active: false }),
  ]);
});

describe("ResolveGoogleLoginUseCase", () => {
  it("lets a registered, active user in, matching the email case-insensitively", async () => {
    expect(await resolve().execute({ email: "Ana@Example.org", emailVerified: true })).toMatchObject({ ok: true, user: { id: "ana" } });
  });

  it("requires a verified email", async () => {
    expect(await resolve().execute({ email: "ana@example.org", emailVerified: false })).toEqual({ ok: false, reason: "unverified" });
  });

  it("refuses an email that is not registered, creating nothing", async () => {
    expect(await resolve().execute({ email: "stranger@example.org", emailVerified: true })).toEqual({ ok: false, reason: "unknown" });
    expect(users.users.size).toBe(2);
  });

  it("refuses a deactivated user", async () => {
    expect(await resolve().execute({ email: "off@example.org", emailVerified: true })).toEqual({ ok: false, reason: "inactive" });
  });

  describe("allowed domain", () => {
    it("refuses a registered user outside the domain", async () => {
      expect(await resolve({ allowedDomain: "unl.edu.ec" }).execute({ email: "ana@example.org", emailVerified: true })).toEqual({ ok: false, reason: "domain" });
    });

    it("accepts the domain regardless of case and a leading @, and does not accept a look-alike suffix", async () => {
      users.users.set("u", makeUser({ id: "u", email: "u@unl.edu.ec" }));
      users.users.set("x", makeUser({ id: "x", email: "x@evil-unl.edu.ec" }));

      expect(await resolve({ allowedDomain: "@UNL.edu.ec" }).execute({ email: "u@unl.edu.ec", emailVerified: true })).toMatchObject({ ok: true });
      expect(await resolve({ allowedDomain: "unl.edu.ec" }).execute({ email: "x@evil-unl.edu.ec", emailVerified: true })).toEqual({ ok: false, reason: "domain" });
    });
  });

  describe("bootstrap admins", () => {
    it("creates an ADMIN on the first successful login of a listed email", async () => {
      const outcome = await resolve({ bootstrapEmails: ["First@Example.org", "other@example.org"] }).execute({
        email: "first@example.org",
        emailVerified: true,
        name: "First Admin",
      });

      expect(outcome).toMatchObject({ ok: true, user: { id: "boot-id", email: "first@example.org", name: "First Admin", role: "ADMIN", active: true } });
      expect((await users.findByEmail("first@example.org"))?.role).toBe("ADMIN");
    });

    it("does not create anyone for an unverified email or outside the allowed domain", async () => {
      const bootstrapEmails = ["first@example.org"];

      expect(await resolve({ bootstrapEmails }).execute({ email: "first@example.org", emailVerified: false })).toMatchObject({ ok: false });
      expect(await resolve({ bootstrapEmails, allowedDomain: "unl.edu.ec" }).execute({ email: "first@example.org", emailVerified: true })).toMatchObject({ ok: false });
      expect(users.users.size).toBe(2);
    });

    it("never changes an existing user: the role stays and a deactivated listed user stays out", async () => {
      const config = { bootstrapEmails: ["ana@example.org", "off@example.org"] };

      expect(await resolve(config).execute({ email: "ana@example.org", emailVerified: true })).toMatchObject({ ok: true, user: { role: "EDITOR" } });
      expect(await resolve(config).execute({ email: "off@example.org", emailVerified: true })).toEqual({ ok: false, reason: "inactive" });
    });

    it("falls back to the local part when Google gave no name", async () => {
      const outcome = await resolve({ bootstrapEmails: ["first@example.org"] }).execute({ email: "first@example.org", emailVerified: true });

      expect(outcome).toMatchObject({ ok: true, user: { name: "first" } });
    });
  });
});
