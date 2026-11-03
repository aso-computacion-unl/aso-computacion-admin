import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LastBuildMarker, SiteRebuildTrigger } from "@/application/ports/site-rebuild.port";
import { RebuildOnWindowCrossingUseCase } from "@/application/use-cases/rebuild-on-window-crossing.use-case";
import { Event } from "@/domain/event";
import { NewsItem } from "@/domain/news-item";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryNewsRepository } from "@/tests/fakes/in-memory-news.repository";

const LAST_BUILD = new Date("2026-11-02T12:00:00.000Z");
const NOW = new Date("2026-11-02T14:00:00.000Z");
const BETWEEN = new Date("2026-11-02T13:00:00.000Z");
const text = { summary: "Resumen", body: "Cuerpo" };

describe("RebuildOnWindowCrossingUseCase", () => {
  let events: InMemoryEventRepository;
  let news: InMemoryNewsRepository;
  let lastSuccessAt: Date | null;
  let trigger: ReturnType<typeof vi.fn<SiteRebuildTrigger["trigger"]>>;
  let useCase: RebuildOnWindowCrossingUseCase;

  beforeEach(() => {
    events = new InMemoryEventRepository();
    news = new InMemoryNewsRepository();
    lastSuccessAt = LAST_BUILD;
    trigger = vi.fn<SiteRebuildTrigger["trigger"]>(async () => "accepted");
    const marker: LastBuildMarker = { lastSuccessAt: async () => lastSuccessAt };
    useCase = new RebuildOnWindowCrossingUseCase(events, news, marker, { trigger });
  });

  it("does not rebuild when nothing changed: no windows, or only boundaries still in the future", async () => {
    await events.create(Event.create({ title: "Sin ventana", isPublished: true }));
    await events.create(Event.create({ title: "Futuro", isPublished: true, publishAt: new Date(NOW.getTime() + 1) }));
    await news.create(NewsItem.create({ ...text, title: "Futura", isPublished: true, unpublishAt: new Date("2027-01-01T00:00:00Z") }));

    expect(await useCase.execute(NOW)).toEqual({ crossed: 0, outcome: "not-needed" });
    expect(trigger).not.toHaveBeenCalled();
  });

  it("does not rebuild for a boundary the last build already saw, including one exactly at that build", async () => {
    await events.create(Event.create({ title: "Visto", isPublished: true, publishAt: new Date("2026-11-02T11:00:00Z") }));
    await events.create(Event.create({ title: "Justo", isPublished: true, publishAt: LAST_BUILD }));

    expect(await useCase.execute(NOW)).toMatchObject({ crossed: 0, outcome: "not-needed" });
    expect(trigger).not.toHaveBeenCalled();
  });

  it("rebuilds once when an event opens after the last build, counting one at exactly now", async () => {
    await events.create(Event.create({ title: "Abre", isPublished: true, publishAt: BETWEEN }));
    await events.create(Event.create({ title: "Abre ahora", isPublished: true, publishAt: NOW }));

    expect(await useCase.execute(NOW)).toEqual({ crossed: 2, outcome: "triggered" });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("rebuilds when a news item closes after the last build, and one rebuild covers events and news together", async () => {
    await news.create(NewsItem.create({ ...text, title: "Cierra", isPublished: true, unpublishAt: BETWEEN }));
    await events.create(Event.create({ title: "Abre", isPublished: true, publishAt: BETWEEN }));

    expect(await useCase.execute(NOW)).toEqual({ crossed: 2, outcome: "triggered" });
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it("ignores drafts and trashed items: they are not on the site either way", async () => {
    await events.create(Event.create({ title: "Borrador", publishAt: BETWEEN }));
    const trashed = await events.create(Event.create({ title: "Papelera", isPublished: true, publishAt: BETWEEN }));
    await events.trash(trashed.props.id);

    expect(await useCase.execute(NOW)).toMatchObject({ crossed: 0, outcome: "not-needed" });
    expect(trigger).not.toHaveBeenCalled();
  });

  it("with no accepted build on record every boundary up to now counts, once", async () => {
    lastSuccessAt = null;
    await events.create(Event.create({ title: "Antiguo", isPublished: true, publishAt: new Date("2025-01-01T00:00:00Z") }));

    expect(await useCase.execute(NOW)).toEqual({ crossed: 1, outcome: "triggered" });
  });

  it("reports a disabled hook and a failed one as what they are", async () => {
    await events.create(Event.create({ title: "Abre", isPublished: true, publishAt: BETWEEN }));

    trigger.mockResolvedValueOnce("disabled");
    expect(await useCase.execute(NOW)).toEqual({ crossed: 1, outcome: "disabled" });

    trigger.mockResolvedValueOnce("failed");
    expect(await useCase.execute(NOW)).toEqual({ crossed: 1, outcome: "failed" });
  });
});
