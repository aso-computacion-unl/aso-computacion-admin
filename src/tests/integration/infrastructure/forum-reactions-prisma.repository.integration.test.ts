import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ForumMemberSuspendedError } from "@/domain/forum";
import { prisma } from "@/infrastructure/prisma/client";
import { ForumCategoryPrismaRepository } from "@/infrastructure/repositories/forum-category-prisma.repository";
import { ForumMemberPrismaRepository } from "@/infrastructure/repositories/forum-member-prisma.repository";
import { ForumModerationPrismaRepository } from "@/infrastructure/repositories/forum-moderation-prisma.repository";
import { ForumPostPrismaRepository } from "@/infrastructure/repositories/forum-post-prisma.repository";
import { ForumReactionPrismaRepository } from "@/infrastructure/repositories/forum-reaction-prisma.repository";
import { makeForumCategory, makeForumMember, makeForumReply, makeForumThread } from "@/tests/fakes/in-memory-forum";

const members = new ForumMemberPrismaRepository();
const categories = new ForumCategoryPrismaRepository();
const posts = new ForumPostPrismaRepository();
const moderation = new ForumModerationPrismaRepository();
const reactions = new ForumReactionPrismaRepository();

const T0 = new Date("2026-10-27T12:00:00.000Z");
const reaction = (id: string) => ({ id, at: T0 });
const thread = { kind: "thread", id: "t1" } as const;
const reply = { kind: "reply", id: "r1" } as const;

async function seed() {
  await members.create(makeForumMember({ id: "ana", email: "ana@unl.edu.ec", googleSub: "sub-ana", displayName: "Ana" }));
  await members.create(makeForumMember({ id: "beto", email: "beto@unl.edu.ec", googleSub: "sub-beto", displayName: "Beto" }));
  await categories.create(makeForumCategory({ id: "c1", slug: "programacion", sortOrder: 1 }));
  await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana" }));
  await posts.create(makeForumThread({ id: "t2", categoryId: "c1", authorId: "ana" }));
  await posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "beto" }));
  await posts.addReply(makeForumReply({ id: "r2", threadId: "t1", authorId: "ana", createdAt: new Date(T0.getTime() + 1000) }));
  await posts.addReply(makeForumReply({ id: "other", threadId: "t2", authorId: "beto" }));
}

describe("ForumReactionPrismaRepository (integration)", () => {
  it("adds a member's reaction and takes it back on the next toggle, with the count after", async () => {
    await seed();

    expect(await reactions.toggle("ana", thread, reaction("x1"))).toEqual({ reacted: true, count: 1 });
    expect(await reactions.toggle("beto", thread, reaction("x2"))).toEqual({ reacted: true, count: 2 });
    expect(await reactions.toggle("ana", thread, reaction("x3"))).toEqual({ reacted: false, count: 1 });
    expect(await prisma.forumReaction.findMany({ select: { memberId: true, threadId: true, replyId: true } })).toEqual([{ memberId: "beto", threadId: "t1", replyId: null }]);
  });

  it("keeps a thread and a reply apart, and one reaction per member per post, even for two toggles at once", async () => {
    await seed();

    expect(await reactions.toggle("ana", reply, reaction("x1"))).toEqual({ reacted: true, count: 1 });
    expect(await reactions.toggle("ana", thread, reaction("x2"))).toEqual({ reacted: true, count: 1 });

    await Promise.all([reactions.toggle("beto", reply, reaction("x3")), reactions.toggle("beto", reply, reaction("x4"))]);

    expect(await prisma.forumReaction.count({ where: { memberId: "beto", replyId: "r1" } })).toBeLessThanOrEqual(1);
  });

  it("answers not found for a post that is gone, and stores nothing", async () => {
    await seed();

    await expect(reactions.toggle("ana", { kind: "thread", id: "ghost" }, reaction("x1"))).rejects.toThrow(NotFoundError);
    await expect(reactions.toggle("ana", { kind: "reply", id: "ghost" }, reaction("x2"))).rejects.toThrow(NotFoundError);
    expect(await prisma.forumReaction.count()).toBe(0);
  });

  it("refuses a suspended member and a hidden post inside the transaction, even when the caller's checks were stale", async () => {
    await seed();
    await moderation.setMemberSuspended("ana", true, { at: T0, by: "u1" });
    await moderation.setPostHidden({ kind: "reply", id: "r1" }, true, { at: T0, by: "u1" });
    await moderation.setPostHidden({ kind: "thread", id: "t2" }, true, { at: T0, by: "u1" });

    await expect(reactions.toggle("ana", thread, reaction("x1"))).rejects.toThrow(ForumMemberSuspendedError);
    await expect(reactions.toggle("beto", reply, reaction("x2"))).rejects.toThrow(NotFoundError);
    await expect(reactions.toggle("beto", { kind: "thread", id: "t2" }, reaction("x3"))).rejects.toThrow(NotFoundError);
    // A reply of a hidden thread is gone too.
    await expect(reactions.toggle("beto", { kind: "reply", id: "other" }, reaction("x4"))).rejects.toThrow(NotFoundError);
    expect(await prisma.forumReaction.count()).toBe(0);
  });

  it("waits for a suspension that is being committed and then refuses, so no reaction slips in after it", async () => {
    await seed();
    let racing: Promise<unknown> = Promise.resolve();

    await prisma.$transaction(async (tx) => {
      await tx.forumMember.update({ where: { id: "ana" }, data: { status: "SUSPENDED", suspendedAt: T0 } });
      racing = reactions.toggle("ana", thread, reaction("x1")).then(
        () => "reacted",
        (error: unknown) => error,
      );
      // Long enough for a toggle that does not wait on the member row to finish first.
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(await racing).toBeInstanceOf(ForumMemberSuspendedError);
    expect(await prisma.forumReaction.count()).toBe(0);
  });

  it("waits for a hide that is being committed and then refuses, so no reaction lands on a hidden reply", async () => {
    await seed();
    let racing: Promise<unknown> = Promise.resolve();

    await prisma.$transaction(async (tx) => {
      await tx.forumReply.update({ where: { id: "r1" }, data: { hiddenAt: T0, hiddenBy: "u1" } });
      racing = reactions.toggle("ana", reply, reaction("x1")).then(
        () => "reacted",
        (error: unknown) => error,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(await racing).toBeInstanceOf(NotFoundError);
    expect(await prisma.forumReaction.count()).toBe(0);
  });

  it("goes with the reply when the reply is deleted", async () => {
    await seed();
    await reactions.toggle("ana", reply, reaction("x1"));

    await prisma.forumReply.delete({ where: { id: "r1" } });

    expect(await prisma.forumReaction.count()).toBe(0);
  });

  it("summarises a thread's counts and the viewer's own, for the visible replies of that thread only", async () => {
    await seed();
    await reactions.toggle("ana", thread, reaction("x1"));
    await reactions.toggle("beto", thread, reaction("x2"));
    await reactions.toggle("ana", reply, reaction("x3"));
    await reactions.toggle("ana", { kind: "reply", id: "other" }, reaction("x4"));
    await reactions.toggle("beto", { kind: "reply", id: "r2" }, reaction("x5"));
    await moderation.setPostHidden({ kind: "reply", id: "r2" }, true, { at: T0, by: "u1" });

    expect(await reactions.summarize("t1", "ana")).toEqual({ thread: { count: 2, mine: true }, replies: { r1: { count: 1, mine: true } } });
    expect(await reactions.summarize("t1", "beto")).toEqual({ thread: { count: 2, mine: true }, replies: { r1: { count: 1, mine: false } } });
    expect(await reactions.summarize("t2", "ana")).toEqual({ thread: { count: 0, mine: false }, replies: { other: { count: 1, mine: true } } });
  });
});

describe("ForumPostPrismaRepository best answer (integration)", () => {
  const best = async (id = "t1") => (await prisma.forumThread.findUniqueOrThrow({ where: { id } })).bestReplyId;

  it("marks a reply of the thread, replaces it and clears it", async () => {
    await seed();

    expect(await posts.setBestReply("t1", "r1")).toBe("ok");
    expect(await best()).toBe("r1");
    expect(await posts.setBestReply("t1", "r2")).toBe("ok");
    expect(await best()).toBe("r2");
    expect(await posts.setBestReply("t1", null)).toBe("ok");
    expect(await best()).toBeNull();
  });

  it("refuses a reply of another thread, a hidden one and an unknown one, and keeps the current answer", async () => {
    await seed();
    await posts.setBestReply("t1", "r1");
    await moderation.setPostHidden({ kind: "reply", id: "r2" }, true, { at: T0, by: null });

    expect(await posts.setBestReply("t1", "other")).toBe("invalid-reply");
    expect(await posts.setBestReply("t1", "r2")).toBe("invalid-reply");
    expect(await posts.setBestReply("t1", "ghost")).toBe("invalid-reply");
    expect(await best()).toBe("r1");
    expect(await best("t2")).toBeNull();
  });

  it("refuses a hidden, unknown or locked thread", async () => {
    await seed();
    await posts.setBestReply("t1", "r1");
    await moderation.setThreadLocked("t1", true, { at: T0, by: "u1" });
    await moderation.setPostHidden({ kind: "thread", id: "t2" }, true, { at: T0, by: "u1" });

    expect(await posts.setBestReply("t1", "r2")).toBe("locked");
    expect(await posts.setBestReply("t1", null)).toBe("locked");
    expect(await posts.setBestReply("t2", "other")).toBe("not-found");
    expect(await posts.setBestReply("ghost", null)).toBe("not-found");
    expect(await best()).toBe("r1");
  });

  it("clears the answer when its reply is hidden or deleted", async () => {
    await seed();

    await posts.setBestReply("t1", "r1");
    await moderation.setPostHidden({ kind: "reply", id: "r1" }, true, { at: T0, by: "u1" });
    expect(await best()).toBeNull();

    await posts.setBestReply("t1", "r2");
    await prisma.forumReply.delete({ where: { id: "r2" } });
    expect(await best()).toBeNull();
  });

  it("never leaves a hidden reply as the answer when marking races hiding", async () => {
    await seed();

    await Promise.all([posts.setBestReply("t1", "r1"), moderation.setPostHidden({ kind: "reply", id: "r1" }, true, { at: T0, by: "u1" })]);

    expect(await best()).toBeNull();
    expect((await prisma.forumReply.findUniqueOrThrow({ where: { id: "r1" } })).hiddenAt).not.toBeNull();
  });
});
