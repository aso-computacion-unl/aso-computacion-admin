import { beforeEach, describe, expect, it } from "vitest";

import { ListEventsUseCase } from "@/application/use-cases/list-events.use-case";
import { ListNewsItemsUseCase } from "@/application/use-cases/list-news-items.use-case";
import { ListOrderedContentPageUseCase } from "@/application/use-cases/ordered-content.use-cases";
import { toFaqResult } from "@/application/mappers/faq-result.mapper";
import { Event, EventPhoto, Faq, NewsItem } from "@/domain";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const PAGE_OF_TWO = { page: 1, pageSize: 2 };

describe("ListEventsUseCase.executePage", () => {
  let events: InMemoryEventRepository;
  let photos: InMemoryEventPhotoRepository;

  beforeEach(() => {
    photos = new InMemoryEventPhotoRepository();
    events = new InMemoryEventRepository(photos);
  });

  it("returns the window with the photo count of each event on it and the totals of the whole match", async () => {
    const newest = await events.create(Event.create({ title: "Taller de Git", date: "2026-06-01" }));
    await events.create(Event.create({ title: "Taller de Docker", date: "2026-05-01" }));
    await events.create(Event.create({ title: "Charla", date: "2026-04-01" }));
    await photos.add(EventPhoto.create({ eventId: newest.props.id, url: "https://x.test/a.jpg", publicId: "a", width: 1200, height: 800, alt: "a", sortOrder: 0 }), 12);

    const page = await new ListEventsUseCase(events, photos).executePage({ search: "taller" }, PAGE_OF_TWO);

    expect(page).toMatchObject({ total: 2, page: 1, pageCount: 1 });
    expect(page.items.map((event) => [event.title, event.photoCount])).toEqual([
      ["Taller de Git", 1],
      ["Taller de Docker", 0],
    ]);
  });

  it("composes the status filter with the search", async () => {
    await events.create(Event.create({ title: "Taller publicado", isPublished: true }));
    await events.create(Event.create({ title: "Taller borrador" }));

    const page = await new ListEventsUseCase(events, photos).executePage({ search: "taller", status: "draft" }, PAGE_OF_TWO);

    expect(page.items.map((event) => event.title)).toEqual(["Taller borrador"]);
  });
});

describe("ListNewsItemsUseCase.executePage", () => {
  it("returns results in the admin shape with the page position", async () => {
    const news = new InMemoryNewsRepository();
    for (const title of ["Beca A", "Beca B", "Beca C", "Otra"]) {
      await news.create(NewsItem.create({ title, summary: "s", body: "b", publishedAt: "2026-05-01" }));
    }

    const page = await new ListNewsItemsUseCase(news).executePage({ search: "beca" }, { page: 2, pageSize: 2 });

    expect(page).toMatchObject({ total: 3, page: 2, pageCount: 2 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toHaveProperty("isPublished", false);
  });
});

describe("ListOrderedContentPageUseCase", () => {
  it("lists in display order, searches, and maps each row", async () => {
    const faqs = new InMemoryOrderedRepository<Faq>(
      (faq) => [faq.props.question, faq.props.answer, faq.props.command],
    );
    for (const [index, question] of ["¿Cuesta?", "¿Quién entra?", "¿Dónde?"].entries()) {
      await faqs.create(Faq.create({ question, answer: "Respuesta", sortOrder: index }));
    }

    const useCase = new ListOrderedContentPageUseCase(faqs, toFaqResult);

    expect((await useCase.execute({}, PAGE_OF_TWO)).items.map((faq) => faq.question)).toEqual(["¿Cuesta?", "¿Quién entra?"]);
    expect((await useCase.execute({ search: "QUIÉN" }, PAGE_OF_TWO)).items.map((faq) => faq.question)).toEqual(["¿Quién entra?"]);
    expect(await useCase.execute({}, { page: 2, pageSize: 2 })).toMatchObject({ total: 3, page: 2, pageCount: 2 });
  });
});
