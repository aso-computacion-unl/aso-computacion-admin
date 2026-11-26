import { describe, expect, it } from "vitest";

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
  const views = eventViews(
    [
      item("past-old", "2025-01-01", true),
      item("draft-old", "2020-01-01", false, "2026-09-01T00:00:00Z"),
      item("far", "2027-06-01", true),
      item("undated", null, true),
      item("today", today, true),
      item("draft-new", null, false, "2026-10-20T00:00:00Z"),
      item("past-recent", "2026-10-01", true),
      item("next", "2026-12-01", true),
    ],
    today,
  );

  it("orders Próximos as the drafts (last edited first), then the upcoming ones soonest first", () => {
    expect(ids(views.drafts)).toEqual(["draft-new", "draft-old"]);
    expect(ids(views.upcoming)).toEqual(["today", "next", "far"]);
    expect(ids(views.proximos)).toEqual(["draft-new", "draft-old", "today", "next", "far"]);
  });

  it("orders Pasados most recent first, the undated ones last", () => {
    expect(ids(views.pasados)).toEqual(["past-recent", "past-old", "undated"]);
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
