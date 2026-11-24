import { beforeEach, describe, expect, it } from "vitest";

import { CreateEventUseCase } from "@/application/use-cases/create-event.use-case";
import { CreateNewsItemUseCase } from "@/application/use-cases/create-news-item.use-case";
import { UpdateEventUseCase } from "@/application/use-cases/update-event.use-case";
import { UpdateNewsItemUseCase } from "@/application/use-cases/update-news-item.use-case";
import { ValidationError } from "@/domain";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";

const OPEN = new Date("2026-11-09T13:00:00.000Z");
const BEFORE_OPEN = new Date("2026-11-02T13:00:00.000Z");
const NEWS = { title: "Taller de Git", summary: "Resumen.", body: "Texto." };

async function caught(run: () => Promise<unknown>): Promise<ValidationError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ValidationError) return error;
    throw error;
  }

  throw new Error("expected a ValidationError");
}

describe("event save reports the slug taken together with the entity's own failures", () => {
  let events: InMemoryEventRepository;

  beforeEach(async () => {
    events = new InMemoryEventRepository(new InMemoryEventPhotoRepository());
    await new CreateEventUseCase(events).execute({ title: "Hackatón", slug: "hackaton" });
  });

  it("on create: slug taken, link label without link and unpublish before publish", async () => {
    const error = await caught(() =>
      new CreateEventUseCase(events).execute({ title: "Otro", slug: "hackaton", linkLabel: "Ver", publishAt: OPEN, unpublishAt: BEFORE_OPEN }),
    );

    expect(error.issues).toEqual([
      { field: "slug", message: "slug is already used by another event" },
      { field: "linkLabel", message: "linkLabel needs a linkUrl" },
      { field: "unpublishAt", message: "unpublishAt must be after publishAt" },
    ]);
    expect(await events.slugExists("otro")).toBe(false);
  });

  it("on update: slug taken together with the entity's failures, nothing stored", async () => {
    const other = await new CreateEventUseCase(events).execute({ title: "Otro" });
    const error = await caught(() =>
      new UpdateEventUseCase(events).execute({ id: other.id, slug: "hackaton", linkLabel: "Ver" }),
    );

    expect(error.issues.map((issue) => issue.field)).toEqual(["slug", "linkLabel"]);
    expect((await events.getById(other.id))?.props).toMatchObject({ slug: "otro", linkLabel: null });
  });

  it("a slug taken alone is still exactly the old single error", async () => {
    const error = await caught(() => new CreateEventUseCase(events).execute({ title: "Otro", slug: "hackaton" }));

    expect(error).toMatchObject({ field: "slug", message: "slug is already used by another event" });
    expect(error.issues).toHaveLength(1);
  });

  it("an entity failure alone is still exactly the old single error", async () => {
    const error = await caught(() => new CreateEventUseCase(events).execute({ title: "Otro", linkLabel: "Ver" }));

    expect(error).toMatchObject({ field: "linkLabel", message: "linkLabel needs a linkUrl" });
    expect(error.issues).toHaveLength(1);
  });
});

describe("news save reports the slug taken together with the entity's own failures", () => {
  let news: InMemoryNewsRepository;

  beforeEach(async () => {
    news = new InMemoryNewsRepository();
    await new CreateNewsItemUseCase(news).execute({ ...NEWS, slug: "taller" });
  });

  it("on create: slug taken and unpublish before publish", async () => {
    const error = await caught(() =>
      new CreateNewsItemUseCase(news).execute({ ...NEWS, slug: "taller", publishAt: OPEN, unpublishAt: BEFORE_OPEN }),
    );

    expect(error.issues).toEqual([
      { field: "slug", message: "slug is already used by another news item" },
      { field: "unpublishAt", message: "unpublishAt must be after publishAt" },
    ]);
  });

  it("on update: slug taken and unpublish before publish", async () => {
    const other = await new CreateNewsItemUseCase(news).execute({ ...NEWS, title: "Otra" });
    const error = await caught(() =>
      new UpdateNewsItemUseCase(news).execute({ id: other.id, slug: "taller", publishAt: OPEN, unpublishAt: BEFORE_OPEN }),
    );

    expect(error.issues.map((issue) => issue.field)).toEqual(["slug", "unpublishAt"]);
  });

  it("a slug taken alone is still exactly the old single error", async () => {
    const other = await new CreateNewsItemUseCase(news).execute({ ...NEWS, title: "Otra" });
    const error = await caught(() => new UpdateNewsItemUseCase(news).execute({ id: other.id, slug: "taller" }));

    expect(error).toMatchObject({ field: "slug", message: "slug is already used by another news item" });
    expect(error.issues).toHaveLength(1);
  });
});

describe("a bad title without an explicit slug reports no slug issue", () => {
  it("event create: title and the other failing rule", async () => {
    const events = new InMemoryEventRepository(new InMemoryEventPhotoRepository());
    const error = await caught(() => new CreateEventUseCase(events).execute({ title: "   ", linkLabel: "Ver" }));

    expect(error.issues).toEqual([
      { field: "title", message: "title is required" },
      { field: "linkLabel", message: "linkLabel needs a linkUrl" },
    ]);
  });

  it("news create: title and the other failing rule", async () => {
    const news = new InMemoryNewsRepository();
    const error = await caught(() =>
      new CreateNewsItemUseCase(news).execute({ ...NEWS, title: "   ", publishAt: OPEN, unpublishAt: BEFORE_OPEN }),
    );

    expect(error.issues).toEqual([
      { field: "title", message: "title is required" },
      { field: "unpublishAt", message: "unpublishAt must be after publishAt" },
    ]);
  });
});
