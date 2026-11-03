import { beforeEach, describe, expect, it } from "vitest";

import {
  CreateForumCategoryUseCase,
  DeleteForumCategoryUseCase,
  ForumCategoryNotEmptyError,
  ListForumCategoriesUseCase,
  UpdateForumCategoryUseCase,
} from "@/application/forum/forum-categories.use-cases";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain/domain-error";
import {
  InMemoryForumCategoryRepository,
  InMemoryForumMemberRepository,
  InMemoryForumStore,
  makeForumCategory,
  makeForumThread,
} from "@/tests/fakes/in-memory-forum";

const NOW = new Date("2026-10-26T12:00:00.000Z");

let store: InMemoryForumStore;
let categories: InMemoryForumCategoryRepository;
let ids: number;

const newId = () => `cat-${(ids += 1)}`;

beforeEach(() => {
  store = new InMemoryForumStore(new InMemoryForumMemberRepository());
  categories = new InMemoryForumCategoryRepository(store);
  ids = 0;
});

describe("CreateForumCategoryUseCase", () => {
  const create = () => new CreateForumCategoryUseCase(categories, () => NOW, newId);

  it("derives the slug from the name, appends the category and trims the text", async () => {
    await create().execute({ name: "Programación" });
    const second = await create().execute({ name: "  Eventos y charlas ", description: "  Lo que viene  " });

    expect(second).toEqual({ id: "cat-2", slug: "eventos-y-charlas", name: "Eventos y charlas", description: "Lo que viene", sortOrder: 2, threadCount: 0 });
  });

  it("takes an explicit slug and refuses a malformed or taken one", async () => {
    await create().execute({ name: "Materias", slug: "materias" });

    await expect(create().execute({ name: "Otra", slug: "materias" })).rejects.toThrow(ValidationError);
    await expect(create().execute({ name: "Otra", slug: "No Valido" })).rejects.toThrow(ValidationError);
    await expect(create().execute({ name: "¿¿??" })).rejects.toThrow(ValidationError);
  });

  it("refuses an empty name and an over-long description", async () => {
    await expect(create().execute({ name: "  " })).rejects.toThrow(ValidationError);
    await expect(create().execute({ name: "Ok", description: "x".repeat(201) })).rejects.toThrow(ValidationError);
  });
});

describe("UpdateForumCategoryUseCase", () => {
  const update = () => new UpdateForumCategoryUseCase(categories, () => NOW);

  it("changes only what is given and stamps the update", async () => {
    store.categories.set("c1", makeForumCategory({ id: "c1", description: "Vieja" }));

    const result = await update().execute({ id: "c1", name: "Código", description: null });

    expect(result).toMatchObject({ id: "c1", slug: "programacion", name: "Código", description: null, sortOrder: 1 });
    expect(store.categories.get("c1")?.updatedAt).toEqual(NOW);
  });

  it("refuses a slug used by another category, but not its own", async () => {
    store.categories.set("c1", makeForumCategory({ id: "c1", slug: "uno" }));
    store.categories.set("c2", makeForumCategory({ id: "c2", slug: "dos" }));

    await expect(update().execute({ id: "c2", slug: "uno" })).rejects.toThrow(ValidationError);
    await expect(update().execute({ id: "c2", slug: "dos", sortOrder: 5 })).resolves.toMatchObject({ slug: "dos", sortOrder: 5 });
  });

  it("answers not found for an unknown category and refuses a negative order", async () => {
    store.categories.set("c1", makeForumCategory({ id: "c1" }));

    await expect(update().execute({ id: "ghost", name: "X" })).rejects.toThrow(NotFoundError);
    await expect(update().execute({ id: "c1", sortOrder: -1 })).rejects.toThrow(ValidationError);
  });
});

describe("DeleteForumCategoryUseCase", () => {
  const remove = () => new DeleteForumCategoryUseCase(categories);

  it("deletes an empty category", async () => {
    store.categories.set("c1", makeForumCategory({ id: "c1" }));

    await remove().execute({ id: "c1" });

    expect(store.categories.size).toBe(0);
  });

  it("refuses while any thread, hidden ones included, still lives in it", async () => {
    store.categories.set("c1", makeForumCategory({ id: "c1" }));
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", hiddenAt: NOW }));

    await expect(remove().execute({ id: "c1" })).rejects.toThrow(ForumCategoryNotEmptyError);
    expect(store.categories.size).toBe(1);
    await expect(remove().execute({ id: "ghost" })).rejects.toThrow(NotFoundError);
  });
});

describe("ListForumCategoriesUseCase", () => {
  it("lists in display order with the count of threads a student can see", async () => {
    store.categories.set("c2", makeForumCategory({ id: "c2", slug: "dos", sortOrder: 2 }));
    store.categories.set("c1", makeForumCategory({ id: "c1", slug: "uno", sortOrder: 1 }));
    store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1" }));
    store.threads.set("t2", makeForumThread({ id: "t2", categoryId: "c1", hiddenAt: NOW }));

    const result = await new ListForumCategoriesUseCase(categories).execute();

    expect(result.map((category) => [category.slug, category.threadCount])).toEqual([
      ["uno", 1],
      ["dos", 0],
    ]);
  });
});
