import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";

const NOW = new Date("2026-10-26T12:00:00.000Z");

const member = (id: string, email = `${id}@unl.edu.ec`) => ({ id, email, googleSub: `sub-${id}`, displayName: "Ana", createdAt: NOW });
const thread = (id: string, authorId: string, categoryId = "c1") => ({
  id,
  categoryId,
  authorId,
  title: "Duda",
  body: "Cuerpo",
  createdAt: NOW,
  updatedAt: NOW,
  lastActivityAt: NOW,
});
const reply = (id: string, threadId: string, authorId: string) => ({ id, threadId, authorId, body: "Respuesta", createdAt: NOW, updatedAt: NOW });

async function seed() {
  await prisma.forumCategory.create({ data: { id: "c1", slug: "programacion", name: "Programación", sortOrder: 1, updatedAt: NOW } });
  await prisma.forumMember.create({ data: member("m1") });
  await prisma.forumMember.create({ data: member("m2") });
  await prisma.forumThread.create({ data: thread("t1", "m1") });
  await prisma.forumReply.create({ data: reply("r1", "t1", "m2") });
}

describe("forum schema (integration)", () => {
  it("stores a member as active with no suspension, and refuses a duplicate email, sub or an upper-case email", async () => {
    const created = await prisma.forumMember.create({ data: member("m1") });

    expect(created).toMatchObject({ status: "ACTIVE", suspendedAt: null, suspendedBy: null, lastLoginAt: null });
    await expect(prisma.forumMember.create({ data: { ...member("m2"), email: "m1@unl.edu.ec" } })).rejects.toThrow();
    await expect(prisma.forumMember.create({ data: { ...member("m3"), googleSub: "sub-m1" } })).rejects.toThrow();
    await expect(prisma.forumMember.create({ data: member("m4", "Ana@unl.edu.ec") })).rejects.toThrow();
  });

  it("keeps SUSPENDED and suspendedAt together", async () => {
    await expect(prisma.forumMember.create({ data: { ...member("m1"), status: "SUSPENDED" } })).rejects.toThrow();
    await expect(prisma.forumMember.create({ data: { ...member("m2"), suspendedAt: NOW } })).rejects.toThrow();
    await expect(prisma.forumMember.create({ data: { ...member("m3"), status: "SUSPENDED", suspendedAt: NOW, suspendedBy: "u1" } })).resolves.toMatchObject({ status: "SUSPENDED" });
  });

  it("deletes a member's sessions with the member and refuses a session for nobody", async () => {
    await prisma.forumMember.create({ data: member("m1") });
    await prisma.forumSession.create({ data: { id: "s1", memberId: "m1", createdAt: NOW, expiresAt: NOW, lastSeenAt: NOW } });
    await expect(prisma.forumSession.create({ data: { id: "s2", memberId: "ghost", createdAt: NOW, expiresAt: NOW, lastSeenAt: NOW } })).rejects.toThrow();
    await expect(prisma.forumSession.create({ data: { id: "s3", memberId: "m1", createdAt: NOW, expiresAt: NOW, lastSeenAt: NOW, userAgent: "x".repeat(201) } })).rejects.toThrow();

    await prisma.forumMember.delete({ where: { id: "m1" } });

    expect(await prisma.forumSession.count()).toBe(0);
  });

  it("refuses a duplicate category slug and refuses to delete a category that has threads", async () => {
    await seed();

    await expect(prisma.forumCategory.create({ data: { id: "c2", slug: "programacion", name: "Otra", sortOrder: 2, updatedAt: NOW } })).rejects.toThrow();
    await expect(prisma.forumCategory.delete({ where: { id: "c1" } })).rejects.toThrow();
  });

  it("starts a thread unlocked, visible and without a best answer; replies cascade with their thread", async () => {
    await seed();

    expect(await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).toMatchObject({ lockedAt: null, lockedBy: null, hiddenAt: null, hiddenBy: null, bestReplyId: null, editedAt: null });
    expect(await prisma.forumReply.findUniqueOrThrow({ where: { id: "r1" } })).toMatchObject({ hiddenAt: null, hiddenBy: null, editedAt: null });

    await prisma.forumThread.delete({ where: { id: "t1" } });

    expect(await prisma.forumReply.count()).toBe(0);
  });

  it("refuses an empty or over-long title and body", async () => {
    await seed();

    await expect(prisma.forumThread.create({ data: { ...thread("t2", "m1"), title: "" } })).rejects.toThrow();
    await expect(prisma.forumThread.create({ data: { ...thread("t3", "m1"), title: "x".repeat(121) } })).rejects.toThrow();
    await expect(prisma.forumThread.create({ data: { ...thread("t4", "m1"), body: "x".repeat(10001) } })).rejects.toThrow();
    await expect(prisma.forumReply.create({ data: { ...reply("r2", "t1", "m1"), body: "x".repeat(5001) } })).rejects.toThrow();
  });

  it("keeps the best answer one reply of at most one thread, and clears it when the reply goes", async () => {
    await seed();
    await prisma.forumThread.create({ data: thread("t2", "m1") });
    await prisma.forumThread.update({ where: { id: "t1" }, data: { bestReplyId: "r1" } });

    await expect(prisma.forumThread.update({ where: { id: "t2" }, data: { bestReplyId: "r1" } })).rejects.toThrow();

    await prisma.forumReply.delete({ where: { id: "r1" } });

    expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).bestReplyId).toBeNull();
  });

  it("allows one reaction per member per target and refuses none or two targets", async () => {
    await seed();
    const onReply = { id: "x1", memberId: "m1", replyId: "r1", createdAt: NOW };

    await prisma.forumReaction.create({ data: onReply });
    await prisma.forumReaction.create({ data: { id: "x2", memberId: "m1", threadId: "t1", createdAt: NOW } });
    await prisma.forumReaction.create({ data: { id: "x3", memberId: "m2", replyId: "r1", createdAt: NOW } });

    await expect(prisma.forumReaction.create({ data: { ...onReply, id: "x4" } })).rejects.toThrow();
    await expect(prisma.forumReaction.create({ data: { id: "x5", memberId: "m1", threadId: "t1", createdAt: NOW } })).rejects.toThrow();
    await expect(prisma.forumReaction.create({ data: { id: "x6", memberId: "m2", createdAt: NOW } })).rejects.toThrow();
    await expect(prisma.forumReaction.create({ data: { id: "x7", memberId: "m2", threadId: "t1", replyId: "r1", createdAt: NOW } })).rejects.toThrow();
  });

  it("opens a report, allows one per reporter per target, and needs a closing time exactly when it is closed", async () => {
    await seed();
    const report = { id: "p1", reporterId: "m2", threadId: "t1", reason: "Spam", createdAt: NOW };

    expect(await prisma.forumReport.create({ data: report })).toMatchObject({ status: "OPEN", resolvedAt: null, resolvedBy: null, resolutionNote: null });
    await expect(prisma.forumReport.create({ data: { ...report, id: "p2" } })).rejects.toThrow();
    await expect(prisma.forumReport.create({ data: { id: "p3", reporterId: "m2", reason: "Spam", createdAt: NOW } })).rejects.toThrow();
    await expect(prisma.forumReport.create({ data: { ...report, id: "p4", replyId: "r1", threadId: null, status: "DISMISSED" } })).rejects.toThrow();
    await expect(prisma.forumReport.create({ data: { ...report, id: "p5", replyId: "r1", threadId: null, resolvedAt: NOW } })).rejects.toThrow();
    await expect(prisma.forumReport.create({ data: { ...report, id: "p6", replyId: "r1", threadId: null, status: "RESOLVED", resolvedAt: NOW, resolvedBy: "u1" } })).resolves.toMatchObject({ status: "RESOLVED" });
    await expect(prisma.forumReport.create({ data: { ...report, id: "p7", reporterId: "m1", reason: "" } })).rejects.toThrow();
  });
});
