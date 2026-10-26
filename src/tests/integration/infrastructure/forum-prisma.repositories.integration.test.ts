import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NotFoundError } from "@/application/use-cases/use-case-error";
import { prisma } from "@/infrastructure/prisma/client";
import { ForumCategoryPrismaRepository } from "@/infrastructure/repositories/forum-category-prisma.repository";
import { ForumMemberPrismaRepository } from "@/infrastructure/repositories/forum-member-prisma.repository";
import { ForumPostPrismaRepository } from "@/infrastructure/repositories/forum-post-prisma.repository";
import { ForumSessionPrismaRepository } from "@/infrastructure/repositories/forum-session-prisma.repository";
import { makeForumCategory, makeForumMember, makeForumReply, makeForumThread } from "@/tests/fakes/in-memory-forum";

const members = new ForumMemberPrismaRepository();
const sessions = new ForumSessionPrismaRepository();
const categories = new ForumCategoryPrismaRepository();
const posts = new ForumPostPrismaRepository();

const T0 = new Date("2026-10-26T12:00:00.000Z");
const later = (ms: number) => new Date(T0.getTime() + ms);

const ana = makeForumMember({ id: "ana", email: "ana@unl.edu.ec", googleSub: "sub-ana", displayName: "Ana" });
const beto = makeForumMember({ id: "beto", email: "beto@unl.edu.ec", googleSub: "sub-beto", displayName: "Beto" });

async function seed() {
  await members.create(ana);
  await members.create(beto);
  await categories.create(makeForumCategory({ id: "c1", slug: "programacion", sortOrder: 1 }));
}

describe("ForumMemberPrismaRepository (integration)", () => {
  it("creates a member and finds it by id, Google sub and email", async () => {
    expect(await members.create(ana)).toBe(true);

    expect(await members.findById("ana")).toEqual(ana);
    expect(await members.findByGoogleSub("sub-ana")).toEqual(ana);
    expect(await members.findByEmail("ana@unl.edu.ec")).toEqual(ana);
    expect(await members.findById("ghost")).toBeNull();
  });

  it("reports a taken email or Google sub instead of throwing, even for two creates at once", async () => {
    const results = await Promise.all([members.create(ana), members.create({ ...ana, id: "other" })]);

    expect(results.sort()).toEqual([false, true]);
    expect(await members.create({ ...beto, googleSub: "sub-ana" })).toBe(false);
    expect(await prisma.forumMember.count()).toBe(1);
  });

  it("records the login time", async () => {
    await members.create(ana);
    await members.recordLogin("ana", T0);

    expect((await members.findById("ana"))?.lastLoginAt).toEqual(T0);
  });
});

describe("ForumSessionPrismaRepository (integration)", () => {
  const record = (id: string, overrides = {}) => ({ id, memberId: "ana", createdAt: T0, expiresAt: later(3_600_000), revokedAt: null, lastSeenAt: T0, userAgent: "UA", ipHash: "h", ...overrides });

  it("finds a session with its member, touches it and revokes it once", async () => {
    await members.create(ana);
    await sessions.create(record("s1"));

    expect(await sessions.findWithMember("s1")).toEqual({ session: record("s1"), member: ana });

    await sessions.touch("s1", later(1000));
    expect(await sessions.revoke("s1", later(2000))).toBe(true);
    expect(await sessions.revoke("s1", later(3000))).toBe(false);
    expect((await sessions.findWithMember("s1"))?.session).toMatchObject({ lastSeenAt: later(1000), revokedAt: later(2000) });
    expect(await sessions.findWithMember("ghost")).toBeNull();
  });

  it("shows the member's current status, so a suspension is seen on the next read", async () => {
    await members.create(ana);
    await sessions.create(record("s1"));
    await prisma.forumMember.update({ where: { id: "ana" }, data: { status: "SUSPENDED", suspendedAt: T0 } });

    expect((await sessions.findWithMember("s1"))?.member.status).toBe("SUSPENDED");
  });
});

describe("ForumCategoryPrismaRepository (integration)", () => {
  it("creates, finds by id and slug, and refuses a taken slug", async () => {
    expect(await categories.create(makeForumCategory({ id: "c1" }))).toBe(true);
    expect(await categories.create(makeForumCategory({ id: "c2" }))).toBe(false);

    expect(await categories.findById("c1")).toEqual(makeForumCategory({ id: "c1" }));
    expect((await categories.findBySlug("programacion"))?.id).toBe("c1");
    expect(await categories.findBySlug("nope")).toBeNull();
  });

  it("lists in display order with the count of visible threads, and numbers the next one after the last", async () => {
    await seed();
    await categories.create(makeForumCategory({ id: "c0", slug: "eventos", sortOrder: 0 }));
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana" }));
    await posts.create(makeForumThread({ id: "t2", categoryId: "c1", authorId: "ana", hiddenAt: T0 }));

    const list = await categories.list();

    expect(list.map((entry) => [entry.category.slug, entry.threadCount])).toEqual([
      ["eventos", 0],
      ["programacion", 1],
    ]);
    expect(await categories.nextSortOrder()).toBe(2);
  });

  it("updates a category, refuses a slug taken by another and answers not found for an unknown one", async () => {
    await categories.create(makeForumCategory({ id: "c1", slug: "uno" }));
    await categories.create(makeForumCategory({ id: "c2", slug: "dos" }));

    expect(await categories.update(makeForumCategory({ id: "c2", slug: "dos", name: "Nuevo", sortOrder: 7 }))).toBe(true);
    expect(await categories.update(makeForumCategory({ id: "c2", slug: "uno" }))).toBe(false);
    await expect(categories.update(makeForumCategory({ id: "ghost", slug: "x" }))).rejects.toThrow(NotFoundError);
    expect(await categories.findById("c2")).toMatchObject({ name: "Nuevo", sortOrder: 7 });
  });

  it("deletes an empty category and refuses one with threads, hidden ones included", async () => {
    await seed();
    await categories.create(makeForumCategory({ id: "c2", slug: "vacia" }));
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana", hiddenAt: T0 }));

    expect(await categories.delete("c2")).toBe("ok");
    expect(await categories.delete("c1")).toBe("not-empty");
    expect(await categories.delete("ghost")).toBe("not-found");
    expect(await prisma.forumCategory.count()).toBe(1);
  });
});

describe("ForumPostPrismaRepository (integration)", () => {
  it("finds a thread with the author's public name and its visible reply count, hidden ones included", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana", hiddenAt: T0 }));
    await posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "beto" }));

    expect(await posts.findThread("ghost")).toBeNull();
    // The hidden thread rejects the reply, so it has none; the read still returns it for the use case to judge.
    expect(await posts.findThread("t1")).toMatchObject({ thread: { id: "t1", hiddenAt: T0 }, authorName: "Ana", replyCount: 0 });
  });

  it("lists visible threads by latest activity, paginated, with the total", async () => {
    await seed();
    for (const [id, offset] of [["a", 1], ["b", 3], ["c", 2]] as const) {
      await posts.create(makeForumThread({ id, categoryId: "c1", authorId: "ana", createdAt: later(offset), lastActivityAt: later(offset) }));
    }
    await posts.create(makeForumThread({ id: "h", categoryId: "c1", authorId: "ana", hiddenAt: T0, lastActivityAt: later(99) }));

    const first = await posts.listThreads("c1", { offset: 0, limit: 2 });
    const second = await posts.listThreads("c1", { offset: 2, limit: 2 });

    expect(first.items.map((row) => row.thread.id)).toEqual(["b", "c"]);
    expect(second.items.map((row) => row.thread.id)).toEqual(["a"]);
    expect([first.total, second.total]).toEqual([3, 3]);
  });

  it("adds a reply, moves the thread's activity and lists replies oldest first without the hidden ones", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana" }));

    expect(await posts.addReply(makeForumReply({ id: "r2", threadId: "t1", authorId: "beto", createdAt: later(2000) }))).toBe("ok");
    expect(await posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "ana", createdAt: later(1000) }))).toBe("ok");
    await prisma.forumReply.create({ data: { ...makeForumReply({ id: "r3", threadId: "t1", authorId: "beto" }), hiddenAt: T0 } });

    expect((await posts.listReplies("t1")).map((row) => [row.reply.id, row.authorName])).toEqual([
      ["r1", "Ana"],
      ["r2", "Beto"],
    ]);
    expect((await posts.findThread("t1"))?.replyCount).toBe(2);
  });

  it("refuses a reply to a locked thread, a hidden one and an unknown one, and stores nothing", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "locked", categoryId: "c1", authorId: "ana", lockedAt: T0 }));
    await posts.create(makeForumThread({ id: "hidden", categoryId: "c1", authorId: "ana", hiddenAt: T0 }));

    expect(await posts.addReply(makeForumReply({ id: "r1", threadId: "locked", authorId: "beto" }))).toBe("locked");
    expect(await posts.addReply(makeForumReply({ id: "r2", threadId: "hidden", authorId: "beto" }))).toBe("not-found");
    expect(await posts.addReply(makeForumReply({ id: "r3", threadId: "ghost", authorId: "beto" }))).toBe("not-found");
    expect(await prisma.forumReply.count()).toBe(0);
  });

  it("serialises a reply racing a lock: the reply is stored only if it won, never after the lock", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana" }));

    const [outcome] = await Promise.all([
      posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "beto" })),
      prisma.forumThread.update({ where: { id: "t1" }, data: { lockedAt: T0 } }),
    ]);

    expect(await prisma.forumReply.count()).toBe(outcome === "ok" ? 1 : 0);
    expect(await posts.addReply(makeForumReply({ id: "r2", threadId: "t1", authorId: "beto" }))).toBe("locked");
  });

  it("edits a thread and a reply, stamping the edit time", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana" }));
    await posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "beto" }));

    expect(await posts.updateThread("t1", { title: "Nuevo", body: "Cuerpo", at: later(5000), authorId: "ana" })).toBe("ok");
    expect(await posts.updateReply("r1", { body: "Editada", at: later(6000), authorId: "beto" })).toBe("ok");

    expect((await posts.findThread("t1"))?.thread).toMatchObject({ title: "Nuevo", body: "Cuerpo", editedAt: later(5000), updatedAt: later(5000) });
    expect(await posts.findReply("r1")).toMatchObject({ body: "Editada", editedAt: later(6000) });
    expect(await posts.findReply("ghost")).toBeNull();
  });

  it("refuses to edit when the thread is locked or hidden, the post is hidden or not the author's, and changes nothing", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "locked", categoryId: "c1", authorId: "ana", lockedAt: T0 }));
    await posts.create(makeForumThread({ id: "hidden", categoryId: "c1", authorId: "ana", hiddenAt: T0 }));
    await posts.create(makeForumThread({ id: "open", categoryId: "c1", authorId: "ana" }));
    await prisma.forumReply.create({ data: makeForumReply({ id: "in-locked", threadId: "locked", authorId: "beto" }) });
    await prisma.forumReply.create({ data: makeForumReply({ id: "in-hidden", threadId: "hidden", authorId: "beto" }) });
    await prisma.forumReply.create({ data: { ...makeForumReply({ id: "hidden-reply", threadId: "open", authorId: "beto" }), hiddenAt: T0 } });
    await prisma.forumReply.create({ data: makeForumReply({ id: "mine", threadId: "open", authorId: "beto" }) });

    const edit = { title: "X", body: "X", at: later(1000), authorId: "ana" };
    const reply = { body: "X", at: later(1000), authorId: "beto" };

    expect(await posts.updateThread("locked", edit)).toBe("locked");
    expect(await posts.updateThread("hidden", edit)).toBe("not-found");
    expect(await posts.updateThread("ghost", edit)).toBe("not-found");
    expect(await posts.updateThread("open", { ...edit, authorId: "beto" })).toBe("not-found");
    expect(await posts.updateReply("in-locked", reply)).toBe("locked");
    expect(await posts.updateReply("in-hidden", reply)).toBe("not-found");
    expect(await posts.updateReply("hidden-reply", reply)).toBe("not-found");
    expect(await posts.updateReply("ghost", reply)).toBe("not-found");
    expect(await posts.updateReply("mine", { ...reply, authorId: "ana" })).toBe("not-found");
    expect(await prisma.forumThread.count({ where: { editedAt: { not: null } } })).toBe(0);
    expect(await prisma.forumReply.count({ where: { editedAt: { not: null } } })).toBe(0);
  });

  it("clears the best answer when that reply is edited, and keeps it when another one is", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana" }));
    await posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "beto" }));
    await posts.addReply(makeForumReply({ id: "r2", threadId: "t1", authorId: "ana" }));
    await prisma.forumThread.update({ where: { id: "t1" }, data: { bestReplyId: "r1" } });

    await posts.updateReply("r2", { body: "Otra", at: later(1000), authorId: "ana" });
    expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).bestReplyId).toBe("r1");

    await posts.updateReply("r1", { body: "Cambiada", at: later(2000), authorId: "beto" });
    expect((await prisma.forumThread.findUniqueOrThrow({ where: { id: "t1" } })).bestReplyId).toBeNull();
  });

  it("serialises a reply edit racing a lock: the edit is stored only if it won, never after the lock", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "t1", categoryId: "c1", authorId: "ana" }));
    await posts.addReply(makeForumReply({ id: "r1", threadId: "t1", authorId: "beto" }));

    const [outcome] = await Promise.all([
      posts.updateReply("r1", { body: "Editada", at: later(1000), authorId: "beto" }),
      prisma.forumThread.update({ where: { id: "t1" }, data: { lockedAt: T0 } }),
    ]);

    expect((await prisma.forumReply.findUniqueOrThrow({ where: { id: "r1" } })).body).toBe(outcome === "ok" ? "Editada" : "Respuesta");
    expect(await posts.updateReply("r1", { body: "Tarde", at: later(2000), authorId: "beto" })).toBe("locked");
  });

  it("counts a member's threads and replies since a time", async () => {
    await seed();
    await posts.create(makeForumThread({ id: "old", categoryId: "c1", authorId: "ana", createdAt: later(-60_000) }));
    await posts.create(makeForumThread({ id: "new", categoryId: "c1", authorId: "ana", createdAt: later(1000) }));
    await posts.addReply(makeForumReply({ id: "r1", threadId: "new", authorId: "ana", createdAt: later(2000) }));
    await posts.addReply(makeForumReply({ id: "r2", threadId: "new", authorId: "beto", createdAt: later(3000) }));

    expect(await posts.countPostsSince("ana", T0)).toBe(2);
    expect(await posts.countPostsSince("beto", T0)).toBe(1);
    expect(await posts.countPostsSince("ana", later(60_000))).toBe(0);
  });
});
