import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const LATER = new Date("2026-11-02T12:00:00.000Z");
const HASH = "a".repeat(64);

const newInvite = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  tokenHash: HASH,
  email: "ana@example.org",
  role: "EDITOR" as const,
  createdAt: NOW,
  expiresAt: LATER,
  ...overrides,
});

describe("admin invite schema (integration)", () => {
  it("stores a pending invite with no use and no revocation by default", async () => {
    expect(await prisma.adminInvite.create({ data: newInvite() })).toMatchObject({ usedAt: null, usedByUserId: null, revokedAt: null, createdById: null });
  });

  it("refuses a second invite with the same token hash", async () => {
    await prisma.adminInvite.create({ data: newInvite() });

    await expect(prisma.adminInvite.create({ data: newInvite({ id: "i2", email: "ben@example.org" }) })).rejects.toThrow();
  });

  it("refuses an upper-case email, a token hash that is not SHA-256 hex, and an expiry not after the creation", async () => {
    await expect(prisma.adminInvite.create({ data: newInvite({ email: "Ana@Example.org" }) })).rejects.toThrow();
    await expect(prisma.adminInvite.create({ data: newInvite({ tokenHash: "raw-token" }) })).rejects.toThrow();
    await expect(prisma.adminInvite.create({ data: newInvite({ expiresAt: NOW }) })).rejects.toThrow();

    expect(await prisma.adminInvite.count()).toBe(0);
  });

  it("refuses an invite that is both used and revoked, and a use without the user it created", async () => {
    await expect(prisma.adminInvite.create({ data: newInvite({ usedAt: NOW, usedByUserId: "u1", revokedAt: NOW }) })).rejects.toThrow();
    await expect(prisma.adminInvite.create({ data: newInvite({ usedAt: NOW }) })).rejects.toThrow();
    await expect(prisma.adminInvite.create({ data: newInvite({ usedByUserId: "u1" }) })).rejects.toThrow();

    expect(await prisma.adminInvite.count()).toBe(0);
  });
});
