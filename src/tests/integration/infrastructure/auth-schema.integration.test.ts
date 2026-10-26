import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";

const NOW = new Date("2026-10-26T12:00:00.000Z");

const newUser = (id: string, email: string) => ({ id, email, name: "Ana", role: "EDITOR" as const, createdAt: NOW });

describe("users, sessions and audit log schema (integration)", () => {
  it("stores a user with the role, active flag and no last login by default", async () => {
    const user = await prisma.user.create({ data: newUser("u1", "ana@example.org") });

    expect(user).toMatchObject({ role: "EDITOR", active: true, lastLoginAt: null });
  });

  it("refuses, in the database, a second user with the same email and an email with upper-case letters", async () => {
    await prisma.user.create({ data: newUser("u1", "ana@example.org") });

    await expect(prisma.user.create({ data: newUser("u2", "ana@example.org") })).rejects.toThrow();
    await expect(prisma.user.create({ data: newUser("u3", "Ben@Example.org") })).rejects.toThrow();
  });

  it("refuses a role that is not ADMIN or EDITOR", async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO "User" ("id", "email", "name", "role") VALUES ('u1', 'a@example.org', 'A', 'ROOT')`,
    ).rejects.toThrow();
  });

  it("deletes a user's sessions with the user and keeps the session columns the guard reads", async () => {
    await prisma.user.create({ data: newUser("u1", "ana@example.org") });
    const session = await prisma.session.create({
      data: { id: "s1", userId: "u1", createdAt: NOW, expiresAt: new Date(NOW.getTime() + 1000), lastSeenAt: NOW, userAgent: "UA", ipHash: "abcd" },
    });

    expect(session).toMatchObject({ revokedAt: null, userAgent: "UA", ipHash: "abcd" });

    await prisma.user.delete({ where: { id: "u1" } });

    expect(await prisma.session.count()).toBe(0);
  });

  it("refuses a session for a user that does not exist and an over-long user agent", async () => {
    await expect(
      prisma.session.create({ data: { id: "s1", userId: "ghost", createdAt: NOW, expiresAt: NOW, lastSeenAt: NOW } }),
    ).rejects.toThrow();

    await prisma.user.create({ data: newUser("u1", "ana@example.org") });

    await expect(
      prisma.session.create({ data: { id: "s2", userId: "u1", createdAt: NOW, expiresAt: NOW, lastSeenAt: NOW, userAgent: "x".repeat(201) } }),
    ).rejects.toThrow();
  });

  it("lets a break-glass session have no user, and refuses a user session without one or a system session", async () => {
    const base = { createdAt: NOW, expiresAt: NOW, lastSeenAt: NOW };

    await expect(prisma.session.create({ data: { id: "s1", kind: "break_glass", ...base } })).resolves.toMatchObject({ userId: null });
    await expect(prisma.session.create({ data: { id: "s2", kind: "user", ...base } })).rejects.toThrow();
    await prisma.user.create({ data: newUser("u1", "ana@example.org") });
    await expect(prisma.session.create({ data: { id: "s3", kind: "break_glass", userId: "u1", ...base } })).rejects.toThrow();
    await expect(prisma.session.create({ data: { id: "s4", kind: "system", ...base } })).rejects.toThrow();
  });

  it("keeps an audit entry without an actor user, and refuses unknown actor kinds and long summaries", async () => {
    const entry = await prisma.auditLog.create({
      data: { id: "a1", at: NOW, actorKind: "break_glass", action: "login.success", entityType: "session", summary: "Acceso de emergencia" },
    });

    expect(entry).toMatchObject({ actorUserId: null, entityId: null, actorKind: "break_glass" });
    await expect(
      prisma.$executeRaw`INSERT INTO "AuditLog" ("id", "actorKind", "action", "entityType", "summary") VALUES ('a2', 'robot', 'x', 'y', 'z')`,
    ).rejects.toThrow();
    await expect(
      prisma.auditLog.create({ data: { id: "a3", actorKind: "system", action: "x", entityType: "y", summary: "x".repeat(201) } }),
    ).rejects.toThrow();
  });

  it("indexes the audit log for listing by time and by entity", async () => {
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'AuditLog' ORDER BY indexname
    `;

    expect(indexes.map((index) => index.indexname)).toEqual(
      expect.arrayContaining(["AuditLog_at_idx", "AuditLog_entityType_at_idx", "AuditLog_actorUserId_at_idx"]),
    );
  });
});
