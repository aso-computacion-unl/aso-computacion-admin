import { beforeEach, describe, expect, it } from "vitest";

import {
  CloseForumReportUseCase,
  FORUM_REPORTS_PAGE_SIZE,
  ListForumReportsUseCase,
  ReportForumPostUseCase,
  SetForumMemberSuspendedUseCase,
  SetForumPostHiddenUseCase,
  SetForumThreadLockedUseCase,
} from "@/application/forum/forum-moderation.use-cases";
import { OpenForumSessionUseCase, ValidateForumSessionUseCase } from "@/application/forum/forum-auth.use-cases";
import { GetForumThreadUseCase, ReplyToForumThreadUseCase } from "@/application/forum/forum-threads.use-cases";
import { PostingThrottle } from "@/application/forum/posting-throttle";
import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import { ForumAlreadyReportedError, ForumMemberSuspendedError, ForumReportAlreadyClosedError, ForumThreadLockedError } from "@/domain/forum";
import {
  InMemoryForumCategoryRepository,
  InMemoryForumMemberRepository,
  InMemoryForumModerationRepository,
  InMemoryForumPostRepository,
  InMemoryForumSessionRepository,
  InMemoryForumStore,
  makeForumCategory,
  makeForumMember,
  makeForumReply,
  makeForumReport,
  makeForumThread,
} from "@/tests/fakes/in-memory-forum";

const NOW = new Date("2026-10-27T12:00:00.000Z");
const THREAD = { kind: "thread", id: "t1" } as const;
const REPLY = { kind: "reply", id: "r1" } as const;

let clock: Date;
let ids: number;
let members: InMemoryForumMemberRepository;
let store: InMemoryForumStore;
let sessions: InMemoryForumSessionRepository;
let posts: InMemoryForumPostRepository;
let moderation: InMemoryForumModerationRepository;

const newId = () => `id-${(ids += 1)}`;
const now = () => clock;

const report = () => new ReportForumPostUseCase(members, posts, moderation, now, newId);
const listReports = () => new ListForumReportsUseCase(moderation);
const closeReport = () => new CloseForumReportUseCase(moderation, now);
const setHidden = () => new SetForumPostHiddenUseCase(moderation, now);
const setLocked = () => new SetForumThreadLockedUseCase(moderation, now);
const setSuspended = () => new SetForumMemberSuspendedUseCase(moderation, now);

beforeEach(() => {
  clock = NOW;
  ids = 0;
  members = new InMemoryForumMemberRepository([
    makeForumMember({ id: "m1", displayName: "Ana", email: "ana@unl.edu.ec", googleSub: "s1" }),
    makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2" }),
    makeForumMember({ id: "m3", displayName: "Cris", email: "cris@unl.edu.ec", googleSub: "s3", status: "SUSPENDED", suspendedAt: NOW }),
  ]);
  store = new InMemoryForumStore(members);
  sessions = new InMemoryForumSessionRepository(members);
  posts = new InMemoryForumPostRepository(store);
  moderation = new InMemoryForumModerationRepository(store, sessions);
  store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación" }));
  store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", title: "Duda de arrays" }));
  store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", body: "Pruebe con map" }));
});

describe("ReportForumPostUseCase", () => {
  it("opens a report on a thread and on a reply, trimmed, attributed to the reporter", async () => {
    expect(await report().execute({ memberId: "m2", target: THREAD, reason: "  Es spam  " })).toEqual({ id: "id-1" });
    await report().execute({ memberId: "m1", target: REPLY, reason: "Ofensivo" });

    expect([...store.reports.values()]).toMatchObject([
      { id: "id-1", reporterId: "m2", threadId: "t1", replyId: null, reason: "Es spam", status: "OPEN", createdAt: NOW, resolvedAt: null, resolvedBy: null },
      { id: "id-2", reporterId: "m1", threadId: null, replyId: "r1", status: "OPEN" },
    ]);
  });

  it("keeps one open report per member per post: a second is refused, another member or another post is fine", async () => {
    await report().execute({ memberId: "m2", target: THREAD, reason: "Spam" });

    await expect(report().execute({ memberId: "m2", target: THREAD, reason: "Otra vez" })).rejects.toThrow(ForumAlreadyReportedError);
    await report().execute({ memberId: "m1", target: { kind: "thread", id: "t1" }, reason: "Spam" });
    await report().execute({ memberId: "m2", target: REPLY, reason: "Spam" });

    expect(store.reports.size).toBe(3);
  });

  it("lets the same member report the post again once the earlier report is closed", async () => {
    await report().execute({ memberId: "m2", target: THREAD, reason: "Spam" });
    await closeReport().execute({ reportId: "id-1", outcome: "DISMISSED", moderatorId: "u1" });

    await expect(report().execute({ memberId: "m2", target: THREAD, reason: "Sigue ahí" })).resolves.toEqual({ id: "id-2" });
  });

  it("still takes a report on a locked thread", async () => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", lockedAt: NOW }));

    await expect(report().execute({ memberId: "m2", target: THREAD, reason: "Spam" })).resolves.toBeDefined();
  });

  it("refuses a suspended or unknown member, a post a student cannot see and a bad reason, and stores nothing", async () => {
    store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c1", hiddenAt: NOW }));
    store.replies.set("r2", makeForumReply({ id: "r2", threadId: "t1", hiddenAt: NOW }));
    store.replies.set("r3", makeForumReply({ id: "r3", threadId: "t2" }));

    await expect(report().execute({ memberId: "m3", target: THREAD, reason: "Spam" })).rejects.toThrow(ForumMemberSuspendedError);
    await expect(report().execute({ memberId: "ghost", target: THREAD, reason: "Spam" })).rejects.toThrow(ForbiddenError);
    for (const target of [{ kind: "thread", id: "ghost" }, { kind: "thread", id: "t2" }, { kind: "reply", id: "ghost" }, { kind: "reply", id: "r2" }, { kind: "reply", id: "r3" }] as const) {
      await expect(report().execute({ memberId: "m2", target, reason: "Spam" })).rejects.toThrow(NotFoundError);
    }
    await expect(report().execute({ memberId: "m2", target: THREAD, reason: "  " })).rejects.toThrow(ValidationError);
    await expect(report().execute({ memberId: "m2", target: THREAD, reason: "x".repeat(501) })).rejects.toThrow(ValidationError);
    await expect(report().execute({ memberId: "m2", target: THREAD, reason: "a\u0000b" })).rejects.toThrow(ValidationError);
    expect(store.reports.size).toBe(0);
  });
});

describe("ListForumReportsUseCase", () => {
  const open = (id: string, minutes: number, overrides: Parameters<typeof makeForumReport>[0] = {}) =>
    store.reports.set(id, makeForumReport({ id, reporterId: "m2", threadId: "t1", createdAt: new Date(NOW.getTime() + minutes * 60_000), ...overrides }));

  it("lists the open reports oldest first with what a moderator needs, and no email or reporter id", async () => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", title: "Duda de arrays", lockedAt: NOW }));
    open("late", 5);
    open("early", 1, { threadId: null, replyId: "r1", reason: "Ofensivo", reporterId: "m1" });
    open("done", 0, { status: "RESOLVED", resolvedAt: NOW, resolvedBy: "u1" });

    const page = await listReports().execute({ status: "open", page: 1 });

    expect(page).toMatchObject({ total: 2, page: 1, pageCount: 1 });
    expect(page.items).toMatchObject([
      {
        id: "early",
        status: "OPEN",
        reason: "Ofensivo",
        reporterName: "Ana",
        target: { kind: "reply", threadId: "t1", threadTitle: "Duda de arrays", excerpt: "Pruebe con map", authorId: "m2", authorName: "Beto", authorSuspended: false, hidden: false, locked: true },
      },
      { id: "late", reporterName: "Beto", target: { kind: "thread", excerpt: "Cuerpo", authorName: "Ana" } },
    ]);
    expect(JSON.stringify(page)).not.toMatch(/@|googleSub/);
  });

  it("shows the closed ones, newest first, with who closed them and the note, and marks hidden posts and suspended authors", async () => {
    store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m3", hiddenAt: NOW }));
    open("old", 1, { status: "DISMISSED", resolvedAt: NOW, resolvedBy: "u1", resolutionNote: "Sin motivo" });
    open("new", 2, { threadId: null, replyId: "r1", status: "RESOLVED", resolvedAt: NOW, resolvedBy: "u2", resolutionNote: "Ocultada" });
    open("pending", 3);

    const page = await listReports().execute({ status: "closed", page: 1 });

    expect(page.items.map((item) => item.id)).toEqual(["new", "old"]);
    expect(page.items[0]).toMatchObject({ status: "RESOLVED", resolutionNote: "Ocultada", resolvedAt: NOW, target: { hidden: true, authorSuspended: true } });
  });

  it("cuts a long post to an excerpt and paginates, keeping a page past the end in range", async () => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", body: "x".repeat(1000) }));
    for (let index = 0; index < FORUM_REPORTS_PAGE_SIZE + 1; index += 1) open(`p${index}`, index);

    const first = await listReports().execute({ status: "open", page: 1 });
    const beyond = await listReports().execute({ status: "open", page: 99 });

    expect(first.items).toHaveLength(FORUM_REPORTS_PAGE_SIZE);
    expect(first.items[0]?.target.excerpt.length).toBeLessThanOrEqual(281);
    expect(first).toMatchObject({ total: FORUM_REPORTS_PAGE_SIZE + 1, pageCount: 2 });
    expect(beyond).toMatchObject({ page: 2, items: [{ id: `p${FORUM_REPORTS_PAGE_SIZE}` }] });
  });
});

describe("CloseForumReportUseCase", () => {
  beforeEach(() => {
    store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m2", threadId: "t1" }));
  });

  it("resolves or dismisses an open report, stamping who closed it, when and why", async () => {
    await closeReport().execute({ reportId: "p1", outcome: "RESOLVED", note: "  Ocultado  ", moderatorId: "u1" });

    expect(store.reports.get("p1")).toMatchObject({ status: "RESOLVED", resolvedAt: NOW, resolvedBy: "u1", resolutionNote: "Ocultado" });

    store.reports.set("p2", makeForumReport({ id: "p2", reporterId: "m1", threadId: "t1" }));
    await closeReport().execute({ reportId: "p2", outcome: "DISMISSED", moderatorId: null });

    expect(store.reports.get("p2")).toMatchObject({ status: "DISMISSED", resolvedBy: null, resolutionNote: null });
  });

  it("refuses a closed or unknown report and an over-long note, changing nothing", async () => {
    await closeReport().execute({ reportId: "p1", outcome: "RESOLVED", moderatorId: "u1" });

    await expect(closeReport().execute({ reportId: "p1", outcome: "DISMISSED", moderatorId: "u2" })).rejects.toThrow(ForumReportAlreadyClosedError);
    await expect(closeReport().execute({ reportId: "ghost", outcome: "DISMISSED", moderatorId: "u2" })).rejects.toThrow(NotFoundError);
    store.reports.set("p3", makeForumReport({ id: "p3", reporterId: "m1", threadId: "t1" }));
    await expect(closeReport().execute({ reportId: "p3", outcome: "DISMISSED", note: "x".repeat(501), moderatorId: "u2" })).rejects.toThrow(ValidationError);
    expect(store.reports.get("p1")).toMatchObject({ status: "RESOLVED", resolvedBy: "u1" });
    expect(store.reports.get("p3")?.status).toBe("OPEN");
  });
});

describe("SetForumPostHiddenUseCase", () => {
  const viewThread = () => new GetForumThreadUseCase(new InMemoryForumCategoryRepository(store), posts).execute({ threadId: "t1", viewerId: "m2" });

  it("hides a thread from students and shows it again, keeping the moderator and the first time", async () => {
    await setHidden().execute({ target: THREAD, hidden: true, moderatorId: "u1" });

    expect(store.threads.get("t1")).toMatchObject({ hiddenAt: NOW });
    await expect(viewThread()).rejects.toThrow(NotFoundError);

    clock = new Date(NOW.getTime() + 60_000);
    await setHidden().execute({ target: THREAD, hidden: true, moderatorId: "u2" });
    expect(store.threads.get("t1")?.hiddenAt).toEqual(NOW);

    await setHidden().execute({ target: THREAD, hidden: false, moderatorId: "u1" });
    expect(store.threads.get("t1")).toMatchObject({ hiddenAt: null });
    await expect(viewThread()).resolves.toBeDefined();
  });

  it("hides a reply, and the best answer goes with it; hiding another reply leaves the mark", async () => {
    store.replies.set("r2", makeForumReply({ id: "r2", threadId: "t1", authorId: "m1" }));
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", bestReplyId: "r1" }));

    await setHidden().execute({ target: { kind: "reply", id: "r2" }, hidden: true, moderatorId: "u1" });
    expect(store.threads.get("t1")?.bestReplyId).toBe("r1");

    await setHidden().execute({ target: REPLY, hidden: true, moderatorId: "u1" });
    expect(store.replies.get("r1")).toMatchObject({ hiddenAt: NOW });
    expect(store.threads.get("t1")?.bestReplyId).toBeNull();
    expect((await viewThread()).replies.map((reply) => reply.id)).toEqual([]);

    await setHidden().execute({ target: REPLY, hidden: false, moderatorId: "u1" });
    expect(store.threads.get("t1")?.bestReplyId).toBeNull();
    expect((await viewThread()).replies.map((reply) => reply.id)).toEqual(["r1"]);
  });

  it("answers not found for an unknown post", async () => {
    await expect(setHidden().execute({ target: { kind: "thread", id: "ghost" }, hidden: true, moderatorId: "u1" })).rejects.toThrow(NotFoundError);
    await expect(setHidden().execute({ target: { kind: "reply", id: "ghost" }, hidden: true, moderatorId: "u1" })).rejects.toThrow(NotFoundError);
  });
});

describe("SetForumThreadLockedUseCase", () => {
  it("locks a thread so nobody replies, and unlocks it", async () => {
    const reply = () => new ReplyToForumThreadUseCase(members, posts, new PostingThrottle(posts, now), now, newId).execute({ memberId: "m2", threadId: "t1", body: "Hola" });

    await setLocked().execute({ threadId: "t1", locked: true, moderatorId: "u1" });

    expect(store.threads.get("t1")).toMatchObject({ lockedAt: NOW });
    await expect(reply()).rejects.toThrow(ForumThreadLockedError);

    await setLocked().execute({ threadId: "t1", locked: false, moderatorId: "u1" });

    expect(store.threads.get("t1")).toMatchObject({ lockedAt: null });
    await expect(reply()).resolves.toBeDefined();
  });

  it("answers not found for an unknown thread", async () => {
    await expect(setLocked().execute({ threadId: "ghost", locked: true, moderatorId: "u1" })).rejects.toThrow(NotFoundError);
  });
});

describe("SetForumMemberSuspendedUseCase", () => {
  const open = (memberId: string) => new OpenForumSessionUseCase(sessions, now, newId).execute({ memberId });

  it("suspends a member and revokes every live session of theirs, and only theirs", async () => {
    const first = await open("m1");
    const second = await open("m1");
    const other = await open("m2");

    await setSuspended().execute({ memberId: "m1", suspended: true, moderatorId: "u1" });

    expect(members.members.get("m1")).toMatchObject({ status: "SUSPENDED", suspendedAt: NOW });
    expect(sessions.sessions.get(first.sessionId)?.revokedAt).toEqual(NOW);
    expect(sessions.sessions.get(second.sessionId)?.revokedAt).toEqual(NOW);
    expect(sessions.sessions.get(other.sessionId)?.revokedAt).toBeNull();
    expect(await new ValidateForumSessionUseCase(sessions, now).execute({ sessionId: first.sessionId, memberId: "m1" })).toBeNull();
  });

  it("makes the suspended member unable to post, until a moderator reactivates them", async () => {
    const post = () => new ReplyToForumThreadUseCase(members, posts, new PostingThrottle(posts, now), now, newId).execute({ memberId: "m1", threadId: "t1", body: "Hola" });

    await setSuspended().execute({ memberId: "m1", suspended: true, moderatorId: "u1" });
    await expect(post()).rejects.toThrow(ForumMemberSuspendedError);

    await setSuspended().execute({ memberId: "m1", suspended: false, moderatorId: "u1" });

    expect(members.members.get("m1")).toMatchObject({ status: "ACTIVE", suspendedAt: null });
    await expect(post()).resolves.toBeDefined();
  });

  it("keeps the first suspension time when suspending twice, and answers not found for an unknown member", async () => {
    await setSuspended().execute({ memberId: "m1", suspended: true, moderatorId: "u1" });
    clock = new Date(NOW.getTime() + 60_000);
    await setSuspended().execute({ memberId: "m1", suspended: true, moderatorId: null });

    expect(members.members.get("m1")?.suspendedAt).toEqual(NOW);
    await expect(setSuspended().execute({ memberId: "ghost", suspended: true, moderatorId: "u1" })).rejects.toThrow(NotFoundError);
  });
});
