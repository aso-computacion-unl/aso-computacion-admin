import { beforeEach, describe, expect, it } from "vitest";

import { ListForumFeedUseCase } from "@/application/forum/forum-feed.use-case";
import { FORUM_THREADS_PAGE_SIZE } from "@/application/forum/forum-threads.use-cases";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import {
  InMemoryForumCategoryRepository,
  InMemoryForumMemberRepository,
  InMemoryForumPostRepository,
  InMemoryForumStore,
  makeForumCategory,
  makeForumMember,
  makeForumThread,
} from "@/tests/fakes/in-memory-forum";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 26, 12, minute));

let store: InMemoryForumStore;
let feed: ListForumFeedUseCase;

const execute = (input: Partial<Parameters<ListForumFeedUseCase["execute"]>[0]> = {}) => feed.execute({ state: "open", page: 1, viewerId: "m1", ...input });

beforeEach(() => {
  const members = new InMemoryForumMemberRepository([makeForumMember({ id: "m1", displayName: "Ana" }), makeForumMember({ id: "m2", displayName: "Beto", email: "beto@unl.edu.ec", googleSub: "s2" })]);

  store = new InMemoryForumStore(members);
  feed = new ListForumFeedUseCase(new InMemoryForumCategoryRepository(store), new InMemoryForumPostRepository(store));
  store.categories.set("c1", makeForumCategory({ id: "c1", slug: "general", name: "General", sortOrder: 1 }));
  store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", sortOrder: 2 }));
  store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", authorId: "m2", title: "Abierto en General", lastActivityAt: at(10) }));
  store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c2", authorId: "m1", title: "Abierto en Materias", lastActivityAt: at(30) }));
  store.threads.set("t3", makeForumThread({ id: "t3", categoryId: "c2", authorId: "m2", title: "Resuelto en Materias", bestReplyId: "r1", lastActivityAt: at(20) }));
  store.threads.set("t4", makeForumThread({ id: "t4", categoryId: "c1", authorId: "m2", title: "Oculto", hiddenAt: at(1), lastActivityAt: at(40) }));
  store.threads.set("t5", makeForumThread({ id: "t5", categoryId: "c1", authorId: "m2", title: "Cerrado sin respuesta", lockedAt: at(2), lastActivityAt: at(5) }));
});

describe("ListForumFeedUseCase", () => {
  it("lists the open threads of every category, newest activity first, each with its category", async () => {
    const page = await execute();

    expect(page.items.map((item) => item.title)).toEqual(["Abierto en Materias", "Abierto en General", "Cerrado sin respuesta"]);
    expect(page.items[0]).toMatchObject({ id: "t2", authorName: "Ana", mine: true, category: { slug: "materias", name: "Materias" } });
    expect(page.items[1]).toMatchObject({ mine: false, category: { slug: "general", name: "General" } });
    expect(page.category).toBeNull();
  });

  it("lists the solved threads under the solved tab and counts both tabs", async () => {
    const page = await execute({ state: "solved" });

    expect(page.items.map((item) => item.id)).toEqual(["t3"]);
    expect(page.counts).toEqual({ open: 3, solved: 1 });
    expect(page).toMatchObject({ state: "solved", total: 1, page: 1, pageCount: 1 });
  });

  it("never lists nor counts a hidden thread", async () => {
    const page = await execute();

    expect(page.items.map((item) => item.id)).not.toContain("t4");
    expect(page.counts.open).toBe(3);
  });

  it("narrows the list and the counts to one category", async () => {
    const page = await execute({ categorySlug: "materias" });

    expect(page.items.map((item) => item.id)).toEqual(["t2"]);
    expect(page.counts).toEqual({ open: 1, solved: 1 });
    expect(page.category).toEqual({ slug: "materias", name: "Materias", description: null });
  });

  it("carries the description of the category the list is narrowed to, and only that one", async () => {
    store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", sortOrder: 2, description: "Dudas de las materias" }));

    const page = await execute({ categorySlug: "materias" });

    expect(page.category).toEqual({ slug: "materias", name: "Materias", description: "Dudas de las materias" });
    expect(page.categories).toEqual([
      { slug: "general", name: "General" },
      { slug: "materias", name: "Materias" },
    ]);
  });

  it("offers every category in display order for the filter chips, even one without threads", async () => {
    store.categories.set("c3", makeForumCategory({ id: "c3", slug: "propuestas", name: "Propuestas", sortOrder: 3 }));

    expect((await execute()).categories).toEqual([
      { slug: "general", name: "General" },
      { slug: "materias", name: "Materias" },
      { slug: "propuestas", name: "Propuestas" },
    ]);
    expect((await execute({ categorySlug: "propuestas" })).items).toEqual([]);
  });

  it("refuses an unknown category", async () => {
    await expect(execute({ categorySlug: "no-existe" })).rejects.toThrow(NotFoundError);
  });

  it("is empty, with zero counts, when the forum has no threads", async () => {
    store.threads.clear();

    expect(await execute()).toMatchObject({ items: [], counts: { open: 0, solved: 0 }, total: 0, page: 1, pageCount: 1 });
  });

  it("pages like the category list and clamps a page past the end to the last one", async () => {
    store.threads.clear();
    for (let index = 0; index < FORUM_THREADS_PAGE_SIZE + 3; index += 1) {
      store.threads.set(`p${index}`, makeForumThread({ id: `p${index}`, categoryId: "c1", title: `Hilo ${index}`, lastActivityAt: at(index) }));
    }

    const first = await execute();
    const last = await execute({ page: 99 });

    expect(first).toMatchObject({ page: 1, pageCount: 2, total: FORUM_THREADS_PAGE_SIZE + 3 });
    expect(first.items).toHaveLength(FORUM_THREADS_PAGE_SIZE);
    expect(last).toMatchObject({ page: 2, pageCount: 2 });
    expect(last.items).toHaveLength(3);
    expect(await execute({ page: Number.NaN })).toMatchObject({ page: 1 });
  });
});
