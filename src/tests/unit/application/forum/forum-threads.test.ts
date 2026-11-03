import { beforeEach, describe, expect, it } from "vitest";

import { ForumThrottledError, POSTING_LIMITS, PostingThrottle } from "@/application/forum/posting-throttle";
import {
  CreateForumThreadUseCase,
  EditForumReplyUseCase,
  EditForumThreadUseCase,
  FORUM_THREADS_PAGE_SIZE,
  GetForumThreadUseCase,
  ListForumThreadsUseCase,
  ReplyToForumThreadUseCase,
} from "@/application/forum/forum-threads.use-cases";
import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import { ForumMemberSuspendedError, ForumPostNotOwnedError, ForumThreadLockedError } from "@/domain/forum";
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

const NOW = new Date("2026-10-26T12:00:00.000Z");

let clock: Date;
let ids: number;
let members: InMemoryForumMemberRepository;
let store: InMemoryForumStore;
let posts: InMemoryForumPostRepository;
let categories: InMemoryForumCategoryRepository;

const newId = () => `id-${(ids += 1)}`;
const now = () => clock;
const throttle = () => new PostingThrottle(posts, now);

const createThread = () => new CreateForumThreadUseCase(members, categories, posts, throttle(), now, newId);
const reply = () => new ReplyToForumThreadUseCase(members, posts, throttle(), now, newId);

beforeEach(() => {
  clock = NOW;
  ids = 0;
  members = new InMemoryForumMemberRepository([
    makeForumMember({ id: "m1", displayName: "Ana", email: "ana@unl.edu.ec", googleSub: "s1" }),
    makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2" }),
    makeForumMember({ id: "m3", displayName: "Cris", email: "cris@unl.edu.ec", googleSub: "s3", status: "SUSPENDED", suspendedAt: NOW }),
  ]);
  store = new InMemoryForumStore(members);
  posts = new InMemoryForumPostRepository(store);
  categories = new InMemoryForumCategoryRepository(store);
  store.categories.set("c1", makeForumCategory({ id: "c1", slug: "programacion", name: "Programación" }));
});

describe("CreateForumThreadUseCase", () => {
  it("creates a thread in the category, trimmed, with the member as author and a fresh activity time", async () => {
    const result = await createThread().execute({ memberId: "m1", categorySlug: "programacion", title: "  ¿Cómo empiezo?  ", body: "Hola\r\n```js\nlet a;\n```" });

    expect(result).toMatchObject({ id: "id-1", title: "¿Cómo empiezo?", authorName: "Ana", mine: true, locked: false, editedAt: null, bestReplyId: null });
    expect(store.threads.get("id-1")).toMatchObject({ categoryId: "c1", authorId: "m1", body: "Hola\n```js\nlet a;\n```", lastActivityAt: NOW, lockedAt: null, hiddenAt: null });
  });

  it("refuses a suspended member, an unknown member, an unknown category and invalid text", async () => {
    const input = { categorySlug: "programacion", title: "Duda", body: "Texto" };

    await expect(createThread().execute({ ...input, memberId: "m3" })).rejects.toThrow(ForumMemberSuspendedError);
    await expect(createThread().execute({ ...input, memberId: "ghost" })).rejects.toThrow(ForbiddenError);
    await expect(createThread().execute({ ...input, memberId: "m1", categorySlug: "nope" })).rejects.toThrow(NotFoundError);
    await expect(createThread().execute({ ...input, memberId: "m1", title: " " })).rejects.toThrow(ValidationError);
    await expect(createThread().execute({ ...input, memberId: "m1", body: "x".repeat(10001) })).rejects.toThrow(ValidationError);
    expect(store.threads.size).toBe(0);
  });
});

describe("posting throttle", () => {
  const [perMinute, perHour] = POSTING_LIMITS;

  it("refuses the post after the per-minute limit and says how long to wait, then allows it when the window passes", async () => {
    for (let index = 0; index < perMinute.max; index++) {
      await createThread().execute({ memberId: "m1", categorySlug: "programacion", title: `Hilo ${index}`, body: "Texto" });
    }

    const refused = createThread().execute({ memberId: "m1", categorySlug: "programacion", title: "Uno más", body: "Texto" });

    await expect(refused).rejects.toThrow(ForumThrottledError);
    await expect(refused).rejects.toMatchObject({ retryAfterSeconds: perMinute.windowSeconds });
    expect(store.threads.size).toBe(perMinute.max);

    clock = new Date(NOW.getTime() + perMinute.windowSeconds * 1000 + 1);

    await expect(createThread().execute({ memberId: "m1", categorySlug: "programacion", title: "Ahora sí", body: "Texto" })).resolves.toBeDefined();
  });

  it("counts threads and replies together, per member", async () => {
    await createThread().execute({ memberId: "m1", categorySlug: "programacion", title: "Hilo", body: "Texto" });
    await reply().execute({ memberId: "m1", threadId: "id-1", body: "uno" });
    await reply().execute({ memberId: "m1", threadId: "id-1", body: "dos" });

    await expect(reply().execute({ memberId: "m1", threadId: "id-1", body: "tres" })).rejects.toThrow(ForumThrottledError);
    await expect(reply().execute({ memberId: "m2", threadId: "id-1", body: "otro miembro" })).resolves.toBeDefined();
  });

  it("applies the hourly limit as well", async () => {
    store.threads.set("t0", makeForumThread({ id: "t0", categoryId: "c1" }));
    for (let index = 0; index < perHour.max; index++) {
      store.replies.set(`old-${index}`, makeForumReply({ id: `old-${index}`, threadId: "t0", authorId: "m1", createdAt: new Date(NOW.getTime() - 10 * 60 * 1000) }));
    }

    await expect(reply().execute({ memberId: "m1", threadId: "t0", body: "otra" })).rejects.toMatchObject({ retryAfterSeconds: perHour.windowSeconds });
  });
});

describe("ReplyToForumThreadUseCase", () => {
  beforeEach(() => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1" }));
  });

  it("adds the reply and moves the thread's activity", async () => {
    clock = new Date(NOW.getTime() + 1000);

    const result = await reply().execute({ memberId: "m2", threadId: "t1", body: "  Prueba con **negrita**  " });

    expect(result).toMatchObject({ body: "Prueba con **negrita**", authorName: "Beto", mine: true, isBest: false });
    expect(store.threads.get("t1")?.lastActivityAt).toEqual(clock);
  });

  it("refuses a reply to a locked thread, and stores nothing", async () => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", lockedAt: NOW }));

    await expect(reply().execute({ memberId: "m2", threadId: "t1", body: "hola" })).rejects.toThrow(ForumThreadLockedError);
    expect(store.replies.size).toBe(0);
  });

  it("refuses when the thread gets locked between the read and the write", async () => {
    const racing = new InMemoryForumPostRepository(store);
    const original = racing.findThread.bind(racing);
    racing.findThread = async (id) => {
      const row = await original(id);
      store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", lockedAt: NOW }));
      return row;
    };

    await expect(new ReplyToForumThreadUseCase(members, racing, new PostingThrottle(racing, now), now, newId).execute({ memberId: "m2", threadId: "t1", body: "hola" })).rejects.toThrow(ForumThreadLockedError);
    expect(store.replies.size).toBe(0);
  });

  it("treats a hidden or unknown thread as not found, and refuses a suspended member and an empty body", async () => {
    store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c1", hiddenAt: NOW }));

    await expect(reply().execute({ memberId: "m2", threadId: "t2", body: "hola" })).rejects.toThrow(NotFoundError);
    await expect(reply().execute({ memberId: "m2", threadId: "ghost", body: "hola" })).rejects.toThrow(NotFoundError);
    await expect(reply().execute({ memberId: "m3", threadId: "t1", body: "hola" })).rejects.toThrow(ForumMemberSuspendedError);
    await expect(reply().execute({ memberId: "m2", threadId: "t1", body: "  " })).rejects.toThrow(ValidationError);
  });
});

describe("editing your own posts", () => {
  beforeEach(() => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1" }));
    store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2" }));
  });

  it("lets the author edit a thread and marks it edited", async () => {
    const result = await new EditForumThreadUseCase(members, posts, now).execute({ memberId: "m1", threadId: "t1", title: "Nuevo", body: "Cuerpo nuevo" });

    expect(result).toMatchObject({ title: "Nuevo", body: "Cuerpo nuevo", editedAt: NOW, mine: true });
  });

  it("lets the author edit a reply, also in a locked thread", async () => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", lockedAt: NOW }));

    const result = await new EditForumReplyUseCase(members, posts, now).execute({ memberId: "m2", replyId: "r1", body: "Editada" });

    expect(result).toMatchObject({ body: "Editada", editedAt: NOW });
  });

  it("refuses somebody else's post, a hidden post, a suspended author and an unknown post", async () => {
    const editThread = new EditForumThreadUseCase(members, posts, now);
    const editReply = new EditForumReplyUseCase(members, posts, now);

    await expect(editThread.execute({ memberId: "m2", threadId: "t1", title: "x", body: "x" })).rejects.toThrow(ForumPostNotOwnedError);
    await expect(editReply.execute({ memberId: "m1", replyId: "r1", body: "x" })).rejects.toThrow(ForumPostNotOwnedError);

    store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2", hiddenAt: NOW }));
    await expect(editReply.execute({ memberId: "m2", replyId: "r1", body: "x" })).rejects.toThrow(ForumPostNotOwnedError);

    store.threads.set("t3", makeForumThread({ id: "t3", categoryId: "c1", authorId: "m3" }));
    await expect(editThread.execute({ memberId: "m3", threadId: "t3", title: "x", body: "x" })).rejects.toThrow(ForumMemberSuspendedError);
    await expect(editThread.execute({ memberId: "m1", threadId: "ghost", title: "x", body: "x" })).rejects.toThrow(NotFoundError);
    await expect(editReply.execute({ memberId: "m2", replyId: "ghost", body: "x" })).rejects.toThrow(NotFoundError);
    expect(store.replies.get("r1")?.body).toBe("Respuesta");
  });
});

describe("reading", () => {
  beforeEach(() => {
    store.categories.set("c2", makeForumCategory({ id: "c2", slug: "eventos", name: "Eventos", sortOrder: 2 }));
  });

  it("lists a category's visible threads, newest activity first, without author ids and marking the viewer's own", async () => {
    store.threads.set("a", makeForumThread({ id: "a", categoryId: "c1", authorId: "m1", title: "Viejo", lastActivityAt: new Date("2026-10-01T00:00:00Z") }));
    store.threads.set("b", makeForumThread({ id: "b", categoryId: "c1", authorId: "m2", title: "Nuevo", lastActivityAt: new Date("2026-10-05T00:00:00Z"), lockedAt: NOW, bestReplyId: "r9" }));
    store.threads.set("h", makeForumThread({ id: "h", categoryId: "c1", authorId: "m2", title: "Oculto", hiddenAt: NOW }));
    store.threads.set("x", makeForumThread({ id: "x", categoryId: "c2", title: "Otra categoría" }));
    store.replies.set("r1", makeForumReply({ id: "r1", threadId: "b", authorId: "m1" }));
    store.replies.set("r2", makeForumReply({ id: "r2", threadId: "b", authorId: "m1", hiddenAt: NOW }));

    const page = await new ListForumThreadsUseCase(categories, posts).execute({ categorySlug: "programacion", page: 1, viewerId: "m1" });

    expect(page.category).toMatchObject({ slug: "programacion", name: "Programación" });
    expect(page.items.map((item) => [item.title, item.mine, item.replyCount, item.locked, item.hasBestAnswer, item.authorName])).toEqual([
      ["Nuevo", false, 1, true, true, "Beto"],
      ["Viejo", true, 0, false, false, "Ana"],
    ]);
    expect(page).toMatchObject({ total: 2, page: 1, pageCount: 1 });
    expect(JSON.stringify(page)).not.toMatch(/unl\.edu\.ec|"authorId"|googleSub|"email"/);
  });

  it("paginates and keeps a page past the end within range", async () => {
    for (let index = 0; index < FORUM_THREADS_PAGE_SIZE + 1; index++) {
      store.threads.set(`t${index}`, makeForumThread({ id: `t${index}`, categoryId: "c1", lastActivityAt: new Date(NOW.getTime() - index * 1000) }));
    }
    const list = new ListForumThreadsUseCase(categories, posts);

    const first = await list.execute({ categorySlug: "programacion", page: 1, viewerId: "m1" });
    const past = await list.execute({ categorySlug: "programacion", page: 99, viewerId: "m1" });
    const garbage = await list.execute({ categorySlug: "programacion", page: Number.NaN, viewerId: "m1" });

    expect([first.items.length, first.pageCount]).toEqual([FORUM_THREADS_PAGE_SIZE, 2]);
    expect([past.page, past.items.length]).toEqual([2, 1]);
    expect(garbage.page).toBe(1);
    await expect(list.execute({ categorySlug: "nope", page: 1, viewerId: "m1" })).rejects.toThrow(NotFoundError);
  });

  it("shows a thread with its replies oldest first, marking the best one and the viewer's own", async () => {
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m1", bestReplyId: "r2" }));
    store.replies.set("r2", makeForumReply({ id: "r2", threadId: "t1", authorId: "m2", createdAt: new Date("2026-10-04T00:00:00Z") }));
    store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m1", createdAt: new Date("2026-10-03T00:00:00Z") }));
    store.replies.set("r3", makeForumReply({ id: "r3", threadId: "t1", authorId: "m2", hiddenAt: NOW }));

    const view = await new GetForumThreadUseCase(categories, posts).execute({ threadId: "t1", viewerId: "m1" });

    expect(view.category.slug).toBe("programacion");
    expect(view.thread).toMatchObject({ id: "t1", mine: true, authorName: "Ana", bestReplyId: "r2" });
    expect(view.replies.map((item) => [item.id, item.mine, item.isBest])).toEqual([
      ["r1", true, false],
      ["r2", false, true],
    ]);
    expect(JSON.stringify(view)).not.toMatch(/unl\.edu\.ec|"authorId"|googleSub|"email"/);
  });

  it("answers not found for a hidden or unknown thread", async () => {
    store.threads.set("h", makeForumThread({ id: "h", categoryId: "c1", hiddenAt: NOW }));
    const get = new GetForumThreadUseCase(categories, posts);

    await expect(get.execute({ threadId: "h", viewerId: "m1" })).rejects.toThrow(NotFoundError);
    await expect(get.execute({ threadId: "ghost", viewerId: "m1" })).rejects.toThrow(NotFoundError);
  });
});
