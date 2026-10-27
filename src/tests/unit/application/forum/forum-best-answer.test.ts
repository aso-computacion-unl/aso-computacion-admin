import { beforeEach, describe, expect, it } from "vitest";

import { GetForumThreadUseCase } from "@/application/forum/forum-threads.use-cases";
import { MarkForumBestAnswerUseCase } from "@/application/forum/forum-best-answer.use-case";
import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ForumMemberSuspendedError, ForumNotThreadAuthorError, ForumThreadLockedError } from "@/domain/forum";
import {
  InMemoryForumCategoryRepository,
  InMemoryForumMemberRepository,
  InMemoryForumPostRepository,
  InMemoryForumStore,
  makeForumCategory,
  makeForumMember,
  makeForumReply,
  makeForumThread,
} from "@/tests/fakes/in-memory-forum";

const NOW = new Date("2026-10-27T12:00:00.000Z");

let members: InMemoryForumMemberRepository;
let store: InMemoryForumStore;
let posts: InMemoryForumPostRepository;

const mark = (posts_: InMemoryForumPostRepository = posts) => new MarkForumBestAnswerUseCase(members, posts_);
const best = () => store.threads.get("t1")?.bestReplyId;

beforeEach(() => {
  members = new InMemoryForumMemberRepository([
    makeForumMember({ id: "m1", displayName: "Ana", email: "ana@unl.edu.ec", googleSub: "s1" }),
    makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2" }),
    makeForumMember({ id: "m3", displayName: "Cris", email: "cris@unl.edu.ec", googleSub: "s3", status: "SUSPENDED", suspendedAt: NOW }),
  ]);
  store = new InMemoryForumStore(members);
  posts = new InMemoryForumPostRepository(store);
  store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion" }));
  store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1" }));
  store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c1", authorId: "m2" }));
  store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2" }));
  store.replies.set("r2", makeForumReply({ id: "r2", threadId: "t1", authorId: "m1" }));
  store.replies.set("other", makeForumReply({ id: "other", threadId: "t2", authorId: "m1" }));
});

describe("MarkForumBestAnswerUseCase", () => {
  it("lets the thread's author mark a reply, change it and take the mark back; the thread view shows it", async () => {
    expect(await mark().execute({ memberId: "m1", threadId: "t1", replyId: "r1" })).toEqual({ bestReplyId: "r1" });
    expect(best()).toBe("r1");

    const view = await new GetForumThreadUseCase(new InMemoryForumCategoryRepository(store), posts).execute({ threadId: "t1", viewerId: "m2" });
    expect(view.thread.bestReplyId).toBe("r1");
    expect(view.replies.map((reply) => [reply.id, reply.isBest])).toEqual([["r1", true], ["r2", false]]);

    expect(await mark().execute({ memberId: "m1", threadId: "t1", replyId: "r2" })).toEqual({ bestReplyId: "r2" });
    expect(best()).toBe("r2");
    expect(await mark().execute({ memberId: "m1", threadId: "t1", replyId: null })).toEqual({ bestReplyId: null });
    expect(best()).toBeNull();
    expect(await mark().execute({ memberId: "m1", threadId: "t1", replyId: null })).toEqual({ bestReplyId: null });
  });

  it("lets the author mark their own reply as the answer", async () => {
    await expect(mark().execute({ memberId: "m1", threadId: "t1", replyId: "r2" })).resolves.toEqual({ bestReplyId: "r2" });
  });

  it("refuses everybody but the author, a suspended or unknown member, and changes nothing", async () => {
    await mark().execute({ memberId: "m1", threadId: "t1", replyId: "r1" });

    await expect(mark().execute({ memberId: "m2", threadId: "t1", replyId: "r2" })).rejects.toThrow(ForumNotThreadAuthorError);
    await expect(mark().execute({ memberId: "m2", threadId: "t1", replyId: null })).rejects.toThrow(ForumNotThreadAuthorError);
    store.threads.set("t3", makeForumThread({ id: "t3", authorId: "m3" }));
    await expect(mark().execute({ memberId: "m3", threadId: "t3", replyId: null })).rejects.toThrow(ForumMemberSuspendedError);
    await expect(mark().execute({ memberId: "ghost", threadId: "t1", replyId: "r2" })).rejects.toThrow(ForbiddenError);
    expect(best()).toBe("r1");
  });

  it("refuses a reply that is not in this thread, a hidden or unknown one, and a hidden or unknown thread", async () => {
    store.replies.set("hidden", makeForumReply({ id: "hidden", threadId: "t1", hiddenAt: NOW }));
    store.threads.set("t4", makeForumThread({ id: "t4", authorId: "m1", hiddenAt: NOW }));

    for (const replyId of ["other", "hidden", "ghost"]) {
      await expect(mark().execute({ memberId: "m1", threadId: "t1", replyId })).rejects.toThrow(NotFoundError);
    }
    await expect(mark().execute({ memberId: "m1", threadId: "t4", replyId: null })).rejects.toThrow(NotFoundError);
    await expect(mark().execute({ memberId: "m1", threadId: "ghost", replyId: null })).rejects.toThrow(NotFoundError);
    expect(best()).toBeNull();
    expect(store.threads.get("t2")?.bestReplyId).toBeNull();
  });

  it("refuses to change the answer of a locked thread", async () => {
    await mark().execute({ memberId: "m1", threadId: "t1", replyId: "r1" });
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", lockedAt: NOW, bestReplyId: "r1" }));

    await expect(mark().execute({ memberId: "m1", threadId: "t1", replyId: "r2" })).rejects.toThrow(ForumThreadLockedError);
    await expect(mark().execute({ memberId: "m1", threadId: "t1", replyId: null })).rejects.toThrow(ForumThreadLockedError);
    expect(best()).toBe("r1");
  });

  it("re-checks at write time: a lock or a hide that lands after the read wins", async () => {
    const racing = (change: () => void) => {
      const repo = new InMemoryForumPostRepository(store);
      const original = repo.findReply.bind(repo);
      repo.findReply = async (id) => {
        const found = await original(id);
        change();
        return found;
      };
      return repo;
    };

    const lock = racing(() => store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", lockedAt: NOW })));
    await expect(mark(lock).execute({ memberId: "m1", threadId: "t1", replyId: "r1" })).rejects.toThrow(ForumThreadLockedError);

    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1" }));
    const hide = racing(() => store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", hiddenAt: NOW })));
    await expect(mark(hide).execute({ memberId: "m1", threadId: "t1", replyId: "r1" })).rejects.toThrow(NotFoundError);
    expect(best()).toBeNull();
  });
});
