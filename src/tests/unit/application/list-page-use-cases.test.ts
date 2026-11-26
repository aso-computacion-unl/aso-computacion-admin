import { describe, expect, it } from "vitest";

import { ListNewsItemsUseCase } from "@/application/use-cases/list-news-items.use-case";
import { ListOrderedContentPageUseCase } from "@/application/use-cases/ordered-content.use-cases";
import { toFaqResult } from "@/application/mappers/faq-result.mapper";
import { Faq, NewsItem } from "@/domain";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const PAGE_OF_TWO = { page: 1, pageSize: 2 };

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
