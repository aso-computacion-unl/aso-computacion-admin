import { describe, expect, it } from "vitest";

import { groupEvents } from "@/interface/admin/events/event-timeline";
import { eventViewPage, eventViewPath, eventViews, parseEventView } from "@/interface/admin/events/event-views";
import { PAGE_SIZE } from "@/interface/admin/list-params";

const item = (id: string, date: string | null, isPublished: boolean, updatedAt = "2026-10-01T00:00:00Z") => ({
  id,
  date,
  isPublished,
  updatedAt: new Date(updatedAt),
});
const ids = (items: { id: string }[]) => items.map((entry) => entry.id);

describe("parseEventView", () => {
  it("is Próximos unless the param says exactly pasados", () => {
    expect(parseEventView(undefined)).toBe("proximos");
    expect(parseEventView("pasados")).toBe("pasados");
    expect(parseEventView("proximos")).toBe("proximos");
    expect(parseEventView("PASADOS")).toBe("proximos");
    expect(parseEventView(["pasados", "pasados"])).toBe("proximos");
  });
});

describe("eventViewPath", () => {
  it("is the bare path for Próximos, so the default tab has a single URL", () => {
    expect(eventViewPath("/admin/events", "proximos")).toBe("/admin/events");
    expect(eventViewPath("/admin/events", "pasados")).toBe("/admin/events?vista=pasados");
  });
});

describe("eventViews", () => {
  const today = "2026-10-22";

  it("puts drafts first, then the upcoming ones, in Próximos; the past and the undated ones in Pasados", () => {
    const groups = groupEvents(
      [
        item("past", "2026-10-01", true),
        item("draft-old", "2020-01-01", false),
        item("today", today, true),
        item("undated", null, true),
        item("next", "2026-12-01", true),
      ],
      today,
    );

    const views = eventViews(groups);

    expect(ids(views.proximos)).toEqual(["draft-old", "next", "today"]);
    expect(ids(views.pasados)).toEqual(["past", "undated"]);
  });
});

describe("eventViewPage", () => {
  const rows = Array.from({ length: PAGE_SIZE + 5 }, (_, index) => ({ id: `e${index}` }));

  it("pages the rows of one tab with the list's page size", async () => {
    const second = await eventViewPage(rows, 2);

    expect(second).toMatchObject({ page: 2, pageCount: 2, total: PAGE_SIZE + 5, pageSize: PAGE_SIZE });
    expect(ids(second.items)).toEqual(["e20", "e21", "e22", "e23", "e24"]);
  });

  it("clamps a page past the end to the last one, and an empty tab to one empty page", async () => {
    expect((await eventViewPage(rows, 9)).page).toBe(2);
    expect(await eventViewPage([], 3)).toEqual({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, pageCount: 1 });
  });
});
