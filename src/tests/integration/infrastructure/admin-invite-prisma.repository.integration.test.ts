import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";
import { AdminInvitePrismaRepository } from "@/infrastructure/repositories/admin-invite-prisma.repository";
import { makeInvite, makeUser } from "@/tests/fakes/in-memory-auth";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const invites = new AdminInvitePrismaRepository();

const newUser = (id: string, email = "ben@example.org") => makeUser({ id, email, name: "Ben", role: "ADMIN", createdAt: NOW });

async function stored() {
  return { users: await prisma.user.findMany({ orderBy: { id: "asc" } }), invites: await prisma.adminInvite.findMany({ orderBy: { id: "asc" } }) };
}

describe("AdminInvitePrismaRepository (integration)", () => {
  it("stores an invite, finds it by its hash without exposing the hash, and lists it as pending", async () => {
    await invites.create(makeInvite());

    const found = await invites.findByTokenHash("a".repeat(64));

    expect(found).toMatchObject({ id: "invite-1", email: "ben@example.org", role: "EDITOR", createdById: "root", usedAt: null, revokedAt: null });
    expect(found).not.toHaveProperty("tokenHash");
    expect(await invites.findByTokenHash("f".repeat(64))).toBeNull();
    expect((await invites.listPending(NOW)).map((invite) => invite.id)).toEqual(["invite-1"]);
  });

  it("a new invite for the same email revokes the older pending one in the same step", async () => {
    await invites.create(makeInvite({ id: "old", tokenHash: "c".repeat(64), createdAt: new Date("2026-10-25T12:00:00.000Z") }));
    await invites.create(makeInvite({ id: "new" }));

    expect((await prisma.adminInvite.findUnique({ where: { id: "old" } }))?.revokedAt).toEqual(NOW);
    expect((await invites.listPending(NOW)).map((invite) => invite.id)).toEqual(["new"]);
  });

  it("lists only pending invites, newest first", async () => {
    await invites.create(makeInvite({ id: "a", tokenHash: "1".repeat(64), email: "a@example.org", createdAt: new Date("2026-10-24T00:00:00.000Z") }));
    await invites.create(makeInvite({ id: "b", tokenHash: "2".repeat(64), email: "b@example.org", createdAt: new Date("2026-10-25T00:00:00.000Z") }));
    await invites.create(makeInvite({ id: "expired", tokenHash: "3".repeat(64), email: "c@example.org", createdAt: new Date("2026-10-01T00:00:00.000Z"), expiresAt: NOW }));
    await invites.create(makeInvite({ id: "revoked", tokenHash: "4".repeat(64), email: "d@example.org", revokedAt: NOW }));

    expect((await invites.listPending(NOW)).map((invite) => invite.id)).toEqual(["b", "a"]);
  });

  it("revokes only a pending invite", async () => {
    await invites.create(makeInvite());
    await invites.create(makeInvite({ id: "expired", tokenHash: "3".repeat(64), email: "c@example.org", createdAt: new Date("2026-10-01T00:00:00.000Z"), expiresAt: NOW }));

    expect(await invites.revoke("invite-1", NOW)).toBe(true);
    expect(await invites.revoke("invite-1", NOW)).toBe(false);
    expect(await invites.revoke("expired", NOW)).toBe(false);
    expect(await invites.revoke("ghost", NOW)).toBe(false);
    expect((await prisma.adminInvite.findUnique({ where: { id: "expired" } }))?.revokedAt).toBeNull();
  });

  it("redeems once: creates the user and marks the invite used by them", async () => {
    await invites.create(makeInvite());

    expect(await invites.redeem("invite-1", newUser("u1"))).toBe("ok");
    expect(await prisma.user.findUnique({ where: { id: "u1" } })).toMatchObject({ email: "ben@example.org", role: "ADMIN", active: true });
    expect(await prisma.adminInvite.findUnique({ where: { id: "invite-1" } })).toMatchObject({ usedAt: NOW, usedByUserId: "u1" });

    const after = await stored();
    expect(await invites.redeem("invite-1", newUser("u2"))).toBe("unavailable");
    expect(await stored()).toEqual(after);
  });

  it("two concurrent redemptions of one link: exactly one user is created", async () => {
    await invites.create(makeInvite());

    const outcomes = await Promise.all([invites.redeem("invite-1", newUser("u1")), invites.redeem("invite-1", newUser("u2"))]);

    expect(outcomes.sort()).toEqual(["ok", "unavailable"]);
    expect(await prisma.user.count()).toBe(1);
  });

  it("refuses a revoked, expired or other-email redemption, changing nothing", async () => {
    await invites.create(makeInvite({ id: "revoked", revokedAt: NOW }));
    await invites.create(makeInvite({ id: "expired", tokenHash: "3".repeat(64), email: "c@example.org", createdAt: new Date("2026-10-01T00:00:00.000Z"), expiresAt: NOW }));
    await invites.create(makeInvite({ id: "pending", tokenHash: "4".repeat(64), email: "d@example.org" }));
    const before = await stored();

    expect(await invites.redeem("revoked", newUser("u1"))).toBe("unavailable");
    expect(await invites.redeem("expired", newUser("u1", "c@example.org"))).toBe("unavailable");
    expect(await invites.redeem("pending", newUser("u1", "eve@example.org"))).toBe("unavailable");
    expect(await stored()).toEqual(before);
  });

  it("refuses when the email already has a user and rolls the claim back: the invite stays pending", async () => {
    await prisma.user.create({ data: newUser("existing") });
    await invites.create(makeInvite());
    const before = await stored();

    expect(await invites.redeem("invite-1", newUser("u1"))).toBe("email-taken");
    expect(await stored()).toEqual(before);
  });
});
