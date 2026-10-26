import { beforeEach, describe, expect, it } from "vitest";

import {
  CreateAdminInviteUseCase,
  ListPendingInvitesUseCase,
  LookupPendingInviteUseCase,
  RedeemAdminInviteUseCase,
  RevokeAdminInviteUseCase,
  type InviteTokens,
} from "@/application/auth/admin-invite.use-cases";
import { UserEmailTakenError } from "@/application/auth/auth-errors";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import { InMemoryAdminInviteRepository, InMemoryUserRepository, makeInvite, makeUser } from "@/tests/fakes/in-memory-auth";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const SEVEN_DAYS_LATER = new Date("2026-11-02T12:00:00.000Z");
const HASH = "b".repeat(64);

/** A token maps to a fixed, recognisable hash, so a test can tell what was stored. */
const tokens: InviteTokens = { generate: () => "the-token", hash: (token) => (token === "the-token" ? HASH : "f".repeat(64)) };

let users: InMemoryUserRepository;
let invites: InMemoryAdminInviteRepository;
let clock: Date;

beforeEach(() => {
  users = new InMemoryUserRepository([makeUser({ id: "root", email: "root@example.org", name: "Root", role: "ADMIN" })]);
  invites = new InMemoryAdminInviteRepository(users);
  clock = NOW;
});

const identity = (overrides: Partial<{ email: string; emailVerified: boolean; name: string; hostedDomain: string }> = {}) => ({
  email: "ben@example.org",
  emailVerified: true,
  name: "Ben Ruiz",
  ...overrides,
});

describe("CreateAdminInviteUseCase", () => {
  const create = () => new CreateAdminInviteUseCase(invites, users, tokens, () => clock, () => "invite-1");

  it("returns the link token once and stores only its hash, bound to the lower-cased email and the role, expiring in 7 days", async () => {
    const { invite, token } = await create().execute({ email: "  Ben@Example.ORG ", role: "ADMIN", createdById: "root" });

    expect(token).toBe("the-token");
    expect(invite).toEqual({
      id: "invite-1",
      email: "ben@example.org",
      role: "ADMIN",
      createdById: "root",
      createdAt: NOW,
      expiresAt: SEVEN_DAYS_LATER,
      usedAt: null,
      usedByUserId: null,
      revokedAt: null,
    });
    expect(invites.invites.get("invite-1")?.tokenHash).toBe(HASH);
    expect(JSON.stringify([...invites.invites.values()])).not.toContain("the-token");
  });

  it("refuses an email that already belongs to a user, whatever its case, and stores nothing", async () => {
    await expect(create().execute({ email: "ROOT@example.org", role: "EDITOR", createdById: "root" })).rejects.toBeInstanceOf(UserEmailTakenError);

    expect(invites.invites.size).toBe(0);
  });

  it("refuses an invalid email or role, and stores nothing", async () => {
    await expect(create().execute({ email: "nope", role: "EDITOR", createdById: "root" })).rejects.toBeInstanceOf(ValidationError);
    await expect(create().execute({ email: "ben@example.org", role: "OWNER" as never, createdById: "root" })).rejects.toBeInstanceOf(ValidationError);

    expect(invites.invites.size).toBe(0);
  });

  it("a new invite for the same email revokes the previous pending one: one live link per person", async () => {
    invites.invites.set("old", makeInvite({ id: "old", tokenHash: "c".repeat(64), email: "ben@example.org", createdAt: new Date("2026-10-25T12:00:00.000Z") }));

    await create().execute({ email: "ben@example.org", role: "EDITOR", createdById: "root" });

    expect(invites.invites.get("old")?.revokedAt).toEqual(NOW);
    expect((await invites.listPending(NOW)).map((invite) => invite.id)).toEqual(["invite-1"]);
  });
});

describe("ListPendingInvitesUseCase", () => {
  it("lists only invites that are not used, not revoked and not expired, newest first, without their hashes", async () => {
    invites.invites.set("a", makeInvite({ id: "a", tokenHash: "1".repeat(64), email: "a@example.org", createdAt: new Date("2026-10-24T00:00:00.000Z"), expiresAt: new Date("2026-10-31T00:00:00.000Z") }));
    invites.invites.set("b", makeInvite({ id: "b", tokenHash: "2".repeat(64), email: "b@example.org", createdAt: new Date("2026-10-25T00:00:00.000Z"), expiresAt: new Date("2026-11-01T00:00:00.000Z") }));
    invites.invites.set("used", makeInvite({ id: "used", tokenHash: "3".repeat(64), usedAt: NOW, usedByUserId: "u" }));
    invites.invites.set("revoked", makeInvite({ id: "revoked", tokenHash: "4".repeat(64), revokedAt: NOW }));
    invites.invites.set("expired", makeInvite({ id: "expired", tokenHash: "5".repeat(64), expiresAt: NOW }));

    const pending = await new ListPendingInvitesUseCase(invites, () => NOW).execute();

    expect(pending.map((invite) => invite.id)).toEqual(["b", "a"]);
    expect(JSON.stringify(pending)).not.toContain("tokenHash");
  });
});

describe("RevokeAdminInviteUseCase", () => {
  const revoke = () => new RevokeAdminInviteUseCase(invites, () => NOW);

  it("revokes a pending invite: its link stops working", async () => {
    invites.invites.set("invite-1", makeInvite({ tokenHash: HASH }));

    await revoke().execute("invite-1");

    expect(invites.invites.get("invite-1")?.revokedAt).toEqual(NOW);
    expect(await new RedeemAdminInviteUseCase(invites, tokens, {}, () => NOW, () => "u-1").execute({ token: "the-token", identity: identity() })).toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("refuses an invite that is unknown, already used, already revoked or expired, changing nothing", async () => {
    const used = makeInvite({ id: "used", usedAt: NOW, usedByUserId: "u" });
    invites.invites.set("used", used);
    invites.invites.set("expired", makeInvite({ id: "expired", tokenHash: "5".repeat(64), expiresAt: NOW }));

    for (const id of ["ghost", "used", "expired"]) {
      await expect(revoke().execute(id)).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(invites.invites.get("used")).toEqual(used);
    expect(invites.invites.get("expired")?.revokedAt).toBeNull();
  });
});

describe("RedeemAdminInviteUseCase", () => {
  const redeem = (config: { allowedDomain?: string } = {}) => new RedeemAdminInviteUseCase(invites, tokens, config, () => clock, () => "new-user");

  const snapshot = () => JSON.stringify({ users: [...users.users.values()], invites: [...invites.invites.values()] });

  beforeEach(() => {
    invites.invites.set("invite-1", makeInvite({ tokenHash: HASH, email: "ben@example.org", role: "ADMIN" }));
  });

  it("creates the invited user with the invite's role and the Google name, and marks the invite used by them", async () => {
    const outcome = await redeem().execute({ token: "the-token", identity: identity({ email: "Ben@Example.org" }) });

    const user = { id: "new-user", email: "ben@example.org", name: "Ben Ruiz", role: "ADMIN", active: true, createdAt: NOW, lastLoginAt: null };
    expect(outcome).toEqual({ ok: true, user, inviteId: "invite-1" });
    expect(await users.findByEmail("ben@example.org")).toEqual(user);
    expect(invites.invites.get("invite-1")).toMatchObject({ usedAt: NOW, usedByUserId: "new-user" });
  });

  it("falls back to the email's local part when Google gives no name", async () => {
    const outcome = await redeem().execute({ token: "the-token", identity: { email: "ben@example.org", emailVerified: true } });

    expect(outcome.ok && outcome.user.name).toBe("ben");
  });

  it("works only once: a second redemption of the same link is refused and creates nothing", async () => {
    await redeem().execute({ token: "the-token", identity: identity() });
    const after = snapshot();

    expect(await redeem().execute({ token: "the-token", identity: identity() })).toEqual({ ok: false, reason: "used" });
    expect(snapshot()).toBe(after);
  });

  it("refuses a Google account whose email is not the invited one, leaving users and the invite unchanged", async () => {
    const before = snapshot();

    expect(await redeem().execute({ token: "the-token", identity: identity({ email: "eve@example.org" }) })).toEqual({ ok: false, reason: "mismatch" });
    expect(snapshot()).toBe(before);
  });

  it("refuses an expired link (7 days after creation), changing nothing", async () => {
    clock = SEVEN_DAYS_LATER;
    const before = snapshot();

    expect(await redeem().execute({ token: "the-token", identity: identity() })).toEqual({ ok: false, reason: "expired" });
    expect(snapshot()).toBe(before);
  });

  it("still accepts the link a moment before it expires", async () => {
    clock = new Date(SEVEN_DAYS_LATER.getTime() - 1);

    expect((await redeem().execute({ token: "the-token", identity: identity() })).ok).toBe(true);
  });

  it("refuses an unknown token and an unverified Google email, changing nothing", async () => {
    const before = snapshot();

    expect(await redeem().execute({ token: "forged", identity: identity() })).toEqual({ ok: false, reason: "invalid" });
    expect(await redeem().execute({ token: "the-token", identity: identity({ emailVerified: false }) })).toEqual({ ok: false, reason: "unverified" });
    expect(snapshot()).toBe(before);
  });

  it("applies the admin's Google Workspace domain rule to invites too", async () => {
    const before = snapshot();

    expect(await redeem({ allowedDomain: "example.org" }).execute({ token: "the-token", identity: identity() })).toEqual({ ok: false, reason: "domain" });
    expect(snapshot()).toBe(before);
    expect((await redeem({ allowedDomain: "example.org" }).execute({ token: "the-token", identity: identity({ hostedDomain: "example.org" }) })).ok).toBe(true);
  });

  it("refuses when a user with that email was added meanwhile, keeping the invite pending", async () => {
    users.users.set("ben", makeUser({ id: "ben", email: "ben@example.org", role: "EDITOR" }));
    const before = snapshot();

    expect(await redeem().execute({ token: "the-token", identity: identity() })).toEqual({ ok: false, reason: "taken" });
    expect(snapshot()).toBe(before);
  });
});

describe("LookupPendingInviteUseCase", () => {
  const lookup = () => new LookupPendingInviteUseCase(invites, tokens, () => clock);

  it("finds a pending invite by its token, without the hash", async () => {
    await invites.create(makeInvite({ tokenHash: HASH }));

    const found = await lookup().execute("the-token");

    expect(found).toMatchObject({ id: "invite-1", email: "ben@example.org", role: "EDITOR" });
    expect(found).not.toHaveProperty("tokenHash");
  });

  it.each([
    ["an unknown token", "other-token", {}],
    ["a used invite", "the-token", { usedAt: NOW, usedByUserId: "x" }],
    ["a revoked invite", "the-token", { revokedAt: NOW }],
    ["an expired invite", "the-token", { expiresAt: new Date(NOW.getTime() - 1) }],
  ])("finds nothing for %s", async (_label, token, overrides) => {
    await invites.create(makeInvite({ tokenHash: HASH, ...overrides }));

    expect(await lookup().execute(token)).toBeNull();
  });
});
