import { beforeEach, describe, expect, it } from "vitest";

import { GetForumReactionsUseCase, ToggleForumReactionUseCase } from "@/application/forum/forum-reactions.use-cases";
import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ForumMemberSuspendedError } from "@/domain/forum";
import {
  InMemoryForumMemberRepository,
  InMemoryForumPostRepository,
  InMemoryForumReactionRepository,
  InMemoryForumStore,
  makeForumMember,
  makeForumReply,
  makeForumThread,
} from "@/tests/fakes/in-memory-forum";

const NOW = new Date("2026-10-27T12:00:00.000Z");
const THREAD = { kind: "thread", id: "t1" } as const;
const REPLY = { kind: "reply", id: "r1" } as const;

let ids: number;
let members: InMemoryForumMemberRepository;
let store: InMemoryForumStore;
let posts: InMemoryForumPostRepository;
let reactions: InMemoryForumReactionRepository;

const newId = () => `id-${(ids += 1)}`;
const toggle = () => new ToggleForumReactionUseCase(members, posts, reactions, () => NOW, newId);
const read = () => new GetForumReactionsUseCase(posts, reactions);

beforeEach(() => {
  ids = 0;
  members = new InMemoryForumMemberRepository([
    makeForumMember({ id: "m1", displayName: "Ana", email: "ana@unl.edu.ec", googleSub: "s1" }),
    makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2" }),
    makeForumMember({ id: "m3", displayName: "Cris", email: "cris@unl.edu.ec", googleSub: "s3", status: "SUSPENDED", suspendedAt: NOW }),
  ]);
  store = new InMemoryForumStore(members);
  posts = new InMemoryForumPostRepository(store);
  reactions = new InMemoryForumReactionRepository(store);
  store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1" }));
  store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2" }));
});

describe("ToggleForumReactionUseCase", () => {
  it("adds the member's «me sirvió» and takes it back on the next toggle, answering the new state and count", async () => {
    expect(await toggle().execute({ memberId: "m2", target: THREAD })).toEqual({ reacted: true, count: 1 });
    expect(store.reactions.size).toBe(1);
    expect(await toggle().execute({ memberId: "m2", target: THREAD })).toEqual({ reacted: false, count: 0 });
    expect(store.reactions.size).toBe(0);
    expect(await toggle().execute({ memberId: "m2", target: THREAD })).toEqual({ reacted: true, count: 1 });
  });

  it("keeps one reaction per member per post: members add up, a thread and a reply are different posts", async () => {
    await toggle().execute({ memberId: "m1", target: REPLY });
    expect(await toggle().execute({ memberId: "m2", target: REPLY })).toEqual({ reacted: true, count: 2 });
    expect(await toggle().execute({ memberId: "m2", target: THREAD })).toEqual({ reacted: true, count: 1 });
    expect(store.reactions.size).toBe(3);
  });

  it("still takes a reaction on a locked thread", async () => {
    store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1", lockedAt: NOW }));

    await expect(toggle().execute({ memberId: "m2", target: THREAD })).resolves.toEqual({ reacted: true, count: 1 });
  });

  it("refuses a suspended or unknown member and a post a student cannot see, and stores nothing", async () => {
    store.threads.set("t2", makeForumThread({ id: "t2", hiddenAt: NOW }));
    store.replies.set("r2", makeForumReply({ id: "r2", threadId: "t1", hiddenAt: NOW }));
    store.replies.set("r3", makeForumReply({ id: "r3", threadId: "t2" }));

    await expect(toggle().execute({ memberId: "m3", target: THREAD })).rejects.toThrow(ForumMemberSuspendedError);
    await expect(toggle().execute({ memberId: "ghost", target: THREAD })).rejects.toThrow(ForbiddenError);
    for (const target of [{ kind: "thread", id: "ghost" }, { kind: "thread", id: "t2" }, { kind: "reply", id: "ghost" }, { kind: "reply", id: "r2" }, { kind: "reply", id: "r3" }] as const) {
      await expect(toggle().execute({ memberId: "m2", target })).rejects.toThrow(NotFoundError);
    }
    expect(store.reactions.size).toBe(0);
  });
});

describe("GetForumReactionsUseCase", () => {
  beforeEach(() => {
    store.replies.set("r2", makeForumReply({ id: "r2", threadId: "t1", authorId: "m1" }));
  });

  it("counts a thread's reactions and each visible reply's, and marks the viewer's own", async () => {
    await toggle().execute({ memberId: "m1", target: THREAD });
    await toggle().execute({ memberId: "m2", target: THREAD });
    await toggle().execute({ memberId: "m1", target: REPLY });

    expect(await read().execute({ threadId: "t1", viewerId: "m1" })).toEqual({ thread: { count: 2, mine: true }, replies: { r1: { count: 1, mine: true } } });
    expect(await read().execute({ threadId: "t1", viewerId: "m2" })).toEqual({ thread: { count: 2, mine: true }, replies: { r1: { count: 1, mine: false } } });
    expect(await read().execute({ threadId: "t1", viewerId: "m3" })).toEqual({ thread: { count: 2, mine: false }, replies: { r1: { count: 1, mine: false } } });
  });

  it("says nothing about a hidden reply, answers an empty summary for a post nobody marked and not found for a hidden thread", async () => {
    await toggle().execute({ memberId: "m1", target: REPLY });
    store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", hiddenAt: NOW }));

    expect(await read().execute({ threadId: "t1", viewerId: "m1" })).toEqual({ thread: { count: 0, mine: false }, replies: {} });

    store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1", hiddenAt: NOW }));
    await expect(read().execute({ threadId: "t1", viewerId: "m1" })).rejects.toThrow(NotFoundError);
    await expect(read().execute({ threadId: "ghost", viewerId: "m1" })).rejects.toThrow(NotFoundError);
  });

  it("carries no member id, name or email", async () => {
    await toggle().execute({ memberId: "m1", target: THREAD });

    expect(JSON.stringify(await read().execute({ threadId: "t1", viewerId: "m2" }))).not.toMatch(/m1|Ana|@/);
  });
});
