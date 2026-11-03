import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";
import { ForumCategoryPrismaRepository } from "@/infrastructure/repositories/forum-category-prisma.repository";
import { ForumMemberPrismaRepository } from "@/infrastructure/repositories/forum-member-prisma.repository";
import { ForumModerationPrismaRepository } from "@/infrastructure/repositories/forum-moderation-prisma.repository";
import { ForumPostPrismaRepository } from "@/infrastructure/repositories/forum-post-prisma.repository";
import { ForumSessionPrismaRepository } from "@/infrastructure/repositories/forum-session-prisma.repository";
import { makeForumCategory, makeForumMember, makeForumReply, makeForumReport, makeForumThread } from "@/tests/fakes/in-memory-forum";

const members = new ForumMemberPrismaRepository();
const sessions = new ForumSessionPrismaRepository();
const categories = new ForumCategoryPrismaRepository();
const posts = new ForumPostPrismaRepository();
const moderation = new ForumModerationPrismaRepository();

const T0 = new Date("2026-10-27T12:00:00.000Z");
const later = (ms: number) => new Date(T0.getTime() + ms);
const stamp = (ms = 0, by: string | null = "u1") => ({ at: later(ms), by });

const ana = makeForumMember({ id: "ana", email: "ana@unl.edu.ec", googleSub: "sub-ana", displayName: "Ana" });
const beto = makeForumMember({ id: "beto", email: "beto@unl.edu.ec", googleSub: "sub-beto", displayName: "Beto" });

async function seed() {
  await members.create(ana);
  await members.create(beto);
  await categories.create(makeForumCategory({ id: "c1", slug: "programacion", sortOrder: 1 }));
  await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana", title: "Duda de arrays", body: "Cuerpo del hilo" }));
  await posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "beto", body: "Pruebe con map" }));
}

const report = (overrides: Parameters<typeof makeForumReport>[0] = {}) => makeForumReport({ createdAt: T0, reporterId: "beto", threadId: "t1", ...overrides });

describe("ForumModerationPrismaRepository reports (integration)", () => {
  it("stores a report and refuses a second OPEN one from the same reporter on the same post, even two at once", async () => {
    await seed();

    const results = await Promise.all([moderation.createReport(report({ id: "p1" })), moderation.createReport(report({ id: "p2" }))]);

    expect(results.sort()).toEqual([false, true]);
    expect(await prisma.forumReport.count()).toBe(1);
    expect(await moderation.createReport(report({ id: "p3", reporterId: "ana" }))).toBe(true);
    expect(await moderation.createReport(report({ id: "p4", threadId: null, replyId: "r1" }))).toBe(true);
    expect(await moderation.createReport(report({ id: "p5", threadId: null, replyId: "r1" }))).toBe(false);
  });

  it("takes a new report once the earlier one is closed", async () => {
    await seed();
    await moderation.createReport(report({ id: "p1" }));
    await moderation.closeReport("p1", { status: "DISMISSED", note: null, ...stamp() });

    expect(await moderation.createReport(report({ id: "p2" }))).toBe(true);
  });

  it("lists the open queue oldest first and the closed ones newest closed first, with names and no email", async () => {
    await seed();
    await moderation.createReport(report({ id: "late", createdAt: later(5000) }));
    await moderation.createReport(report({ id: "early", createdAt: later(1000), threadId: null, replyId: "r1", reporterId: "ana", reason: "Ofensivo" }));
    await moderation.createReport(report({ id: "old", createdAt: later(100), threadId: null, replyId: "r1" }));
    await moderation.createReport(report({ id: "new", createdAt: later(200), reporterId: "ana" }));
    await moderation.closeReport("old", { status: "DISMISSED", note: "Sin motivo", ...stamp(1000) });
    await moderation.closeReport("new", { status: "RESOLVED", note: "Ocultado", ...stamp(2000, null) });

    const open = await moderation.listReports("open", { offset: 0, limit: 10 });
    const closed = await moderation.listReports("closed", { offset: 0, limit: 10 });

    expect(open.items.map((row) => row.report.id)).toEqual(["early", "late"]);
    expect(open).toMatchObject({ total: 2 });
    expect(open.items[0]).toMatchObject({
      reporterName: "Ana",
      post: { kind: "reply", threadId: "t1", threadTitle: "Duda de arrays", body: "Pruebe con map", authorId: "beto", authorName: "Beto", authorSuspended: false, hidden: false, locked: false },
    });
    expect(open.items[1]).toMatchObject({ reporterName: "Beto", post: { kind: "thread", body: "Cuerpo del hilo", authorName: "Ana" } });
    expect(closed.items.map((row) => row.report.id)).toEqual(["new", "old"]);
    expect(closed.items[0]?.report).toMatchObject({ status: "RESOLVED", resolvedAt: later(2000), resolvedBy: null, resolutionNote: "Ocultado" });
    expect(JSON.stringify([open, closed])).not.toContain("@unl");
    expect((await moderation.listReports("open", { offset: 1, limit: 1 })).items.map((row) => row.report.id)).toEqual(["late"]);
  });

  it("reflects the post's state: hidden, locked thread and a suspended author", async () => {
    await seed();
    await moderation.createReport(report({ id: "p1", threadId: null, replyId: "r1" }));
    await moderation.setPostHidden({ kind: "reply", id: "r1" }, true, stamp());
    await moderation.setThreadLocked("t1", true, stamp());
    await moderation.setMemberSuspended("beto", true, stamp());

    const [row] = (await moderation.listReports("open", { offset: 0, limit: 10 })).items;

    expect(row?.post).toMatchObject({ hidden: true, locked: true, authorSuspended: true });
  });

  it("closes an open report once: the second attempt, and an unknown id, are told apart", async () => {
    await seed();
    await moderation.createReport(report({ id: "p1" }));

    expect(await moderation.closeReport("p1", { status: "RESOLVED", note: "Hecho", ...stamp(10, "u1") })).toBe("ok");
    expect(await moderation.closeReport("p1", { status: "DISMISSED", note: null, ...stamp(20, "u2") })).toBe("closed");
    expect(await moderation.closeReport("ghost", { status: "DISMISSED", note: null, ...stamp() })).toBe("not-found");
    expect(await prisma.forumReport.findUniqueOrThrow({ where: { id: "p1" } })).toMatchObject({ status: "RESOLVED", resolvedBy: "u1", resolvedAt: later(10), resolutionNote: "Hecho" });
  });

  it("lets only one of two moderators closing at once win", async () => {
    await seed();
    await moderation.createReport(report({ id: "p1" }));

    const outcomes = await Promise.all([
      moderation.closeReport("p1", { status: "RESOLVED", note: null, ...stamp(1, "u1") }),
      moderation.closeReport("p1", { status: "DISMISSED", note: null, ...stamp(2, "u2") }),
    ]);

    expect(outcomes.sort()).toEqual(["closed", "ok"]);
  });
});

describe("ForumModerationPrismaRepository hide and lock (integration)", () => {
  it("hides and unhides a thread, keeping the first time and the moderator, and answers not-found for an unknown one", async () => {
    await seed();

    expect(await moderation.setPostHidden({ kind: "thread", id: "t1" }, true, stamp(0, "u1"))).toBe("changed");
    expect(await moderation.setPostHidden({ kind: "thread", id: "t1" }, true, stamp(5000, "u2"))).toBe("unchanged");
    expect(await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).toMatchObject({ hiddenAt: later(0), hiddenBy: "u1" });
    expect((await categories.list())[0]?.threadCount).toBe(0);

    expect(await moderation.setPostHidden({ kind: "thread", id: "t1" }, false, stamp())).toBe("changed");
    expect(await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).toMatchObject({ hiddenAt: null, hiddenBy: null });
    expect(await moderation.setPostHidden({ kind: "thread", id: "ghost" }, true, stamp())).toBe("not-found");
    expect(await moderation.setPostHidden({ kind: "thread", id: "ghost" }, false, stamp())).toBe("not-found");
  });

  it("hides a reply from the thread and clears it as the best answer; hiding another reply leaves the mark", async () => {
    await seed();
    await posts.addReply(makeForumReply({ id: "r2", threadId: "t1", authorId: "ana", createdAt: later(1000) }));
    await prisma.forumThread.update({ where: { id: "t1" }, data: { bestReplyId: "r1" } });

    expect(await moderation.setPostHidden({ kind: "reply", id: "r2" }, true, stamp(0, null))).toBe("changed");
    expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).bestReplyId).toBe("r1");
    expect(await prisma.forumReply.findUniqueOrThrow({ where: { id: "r2" } })).toMatchObject({ hiddenAt: later(0), hiddenBy: null });

    expect(await moderation.setPostHidden({ kind: "reply", id: "r1" }, true, stamp(0, "u1"))).toBe("changed");
    expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).bestReplyId).toBeNull();
    expect((await posts.listReplies("t1")).map((row) => row.reply.id)).toEqual([]);

    expect(await moderation.setPostHidden({ kind: "reply", id: "r1" }, false, stamp())).toBe("changed");
    expect((await posts.listReplies("t1")).map((row) => row.reply.id)).toEqual(["r1"]);
    expect(await moderation.setPostHidden({ kind: "reply", id: "ghost" }, true, stamp())).toBe("not-found");
  });

  it("locks and unlocks a thread: a lock refuses replies, and the first lock time stays", async () => {
    await seed();

    expect(await moderation.setThreadLocked("t1", true, stamp(0, "u1"))).toBe("changed");
    expect(await moderation.setThreadLocked("t1", true, stamp(9000, "u2"))).toBe("unchanged");
    expect(await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).toMatchObject({ lockedAt: later(0), lockedBy: "u1" });
    expect(await posts.addReply(makeForumReply({ id: "r9", threadId: "t1", authorId: "ana" }))).toBe("locked");

    expect(await moderation.setThreadLocked("t1", false, stamp())).toBe("changed");
    expect(await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).toMatchObject({ lockedAt: null, lockedBy: null });
    expect(await posts.addReply(makeForumReply({ id: "r9", threadId: "t1", authorId: "ana" }))).toBe("ok");
    expect(await moderation.setThreadLocked("ghost", true, stamp())).toBe("not-found");
    expect(await moderation.setThreadLocked("ghost", false, stamp())).toBe("not-found");
  });
});

describe("ForumModerationPrismaRepository no-op steps (integration)", () => {
  it("tells a step that changed nothing from one that did, for hide, lock and suspension", async () => {
    await seed();

    expect(await moderation.setPostHidden({ kind: "thread", id: "t1" }, false, stamp())).toBe("unchanged");
    expect(await moderation.setPostHidden({ kind: "reply", id: "r1" }, false, stamp())).toBe("unchanged");
    expect(await moderation.setThreadLocked("t1", false, stamp())).toBe("unchanged");
    expect(await moderation.setMemberSuspended("ana", false, stamp())).toBe("unchanged");

    expect(await moderation.setPostHidden({ kind: "reply", id: "r1" }, true, stamp())).toBe("changed");
    expect(await moderation.setPostHidden({ kind: "reply", id: "r1" }, true, stamp())).toBe("unchanged");
    expect(await moderation.setMemberSuspended("ana", true, stamp())).toBe("changed");
    expect(await moderation.setMemberSuspended("ana", true, stamp())).toBe("unchanged");
  });
});

describe("reply edit against a moderator hide (integration)", () => {
  const edit = (body = "Texto corregido") => posts.updateReply("r1", { body, at: later(10), authorId: "beto" });

  it("does not deadlock with a hide that has taken the reply and is about to clear the best answer", async () => {
    await seed();
    await posts.setBestReply("t1", "r1");
    let racing: Promise<unknown> = Promise.resolve();

    // The hide's own order: the reply first, then the thread's best-answer mark. An edit that took the
    // thread first would wait for the reply while the hide waits for the thread: a deadlock.
    await prisma.$transaction(async (tx) => {
      await tx.forumReply.update({ where: { id: "r1" }, data: { hiddenAt: T0, hiddenBy: "u1" } });
      racing = edit().then(
        (outcome) => outcome,
        (error: unknown) => error,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      await tx.forumThread.updateMany({ where: { bestReplyId: "r1" }, data: { bestReplyId: null } });
    });

    expect(await racing).toBe("not-found");
    expect((await prisma.forumReply.findUniqueOrThrow({ where: { id: "r1" } })).body).toBe("Pruebe con map");
  });

  it("settles every round of edits racing hides of the best answer, with no deadlock error", async () => {
    await seed();

    for (let round = 0; round < 15; round += 1) {
      await prisma.forumReply.update({ where: { id: "r1" }, data: { hiddenAt: null, hiddenBy: null } });
      await posts.setBestReply("t1", "r1");

      const outcomes = await Promise.all([edit(`Texto ${round}`), moderation.setPostHidden({ kind: "reply", id: "r1" }, true, stamp())]);

      expect(["ok", "not-found"]).toContain(outcomes[0]);
      expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).bestReplyId).toBeNull();
    }
  });
});

describe("ForumModerationPrismaRepository suspension (integration)", () => {
  const session = (id: string, memberId: string) => ({ id, memberId, createdAt: T0, expiresAt: later(3_600_000), revokedAt: null, lastSeenAt: T0, userAgent: null, ipHash: null });

  it("suspends a member and revokes their live sessions in the same step, and only theirs", async () => {
    await seed();
    await sessions.create(session("s1", "ana"));
    await sessions.create(session("s2", "ana"));
    await sessions.create(session("s3", "beto"));
    await sessions.revoke("s2", later(-1000));

    expect(await moderation.setMemberSuspended("ana", true, stamp(0, "u1"))).toBe("changed");

    expect(await prisma.forumMember.findUniqueOrThrow({ where: { id: "ana" } })).toMatchObject({ status: "SUSPENDED", suspendedAt: later(0), suspendedBy: "u1" });
    expect((await prisma.forumSession.findMany({ orderBy: { id: "asc" } })).map((row) => [row.id, row.revokedAt])).toEqual([
      ["s1", later(0)],
      ["s2", later(-1000)],
      ["s3", null],
    ]);
    expect((await sessions.findWithMember("s1"))?.member.status).toBe("SUSPENDED");
  });

  it("keeps the first suspension, reactivates without bringing the sessions back, and answers not-found for an unknown member", async () => {
    await seed();
    await sessions.create(session("s1", "ana"));

    await moderation.setMemberSuspended("ana", true, stamp(0, "u1"));
    await moderation.setMemberSuspended("ana", true, stamp(9000, "u2"));
    expect(await prisma.forumMember.findUniqueOrThrow({ where: { id: "ana" } })).toMatchObject({ suspendedAt: later(0), suspendedBy: "u1" });

    expect(await moderation.setMemberSuspended("ana", false, stamp())).toBe("changed");
    expect(await prisma.forumMember.findUniqueOrThrow({ where: { id: "ana" } })).toMatchObject({ status: "ACTIVE", suspendedAt: null, suspendedBy: null });
    expect((await prisma.forumSession.findUniqueOrThrow({ where: { id: "s1" } })).revokedAt).toEqual(later(0));
    expect(await moderation.setMemberSuspended("ghost", true, stamp())).toBe("not-found");
    expect(await moderation.setMemberSuspended("ghost", false, stamp())).toBe("not-found");
  });
});
