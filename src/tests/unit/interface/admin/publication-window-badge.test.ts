import { describe, expect, it } from "vitest";

import { windowBadge } from "@/interface/admin/publication-window-badge";

const OPEN = new Date("2026-11-02T13:00:00.000Z"); // 08:00 in Ecuador
const CLOSE = new Date("2026-11-09T01:30:00.000Z"); // 20:30 the evening before, in Ecuador
const published = { isPublished: true, publishAt: OPEN, unpublishAt: CLOSE };

describe("windowBadge", () => {
  it("says Programado, with the opening in Ecuador time, until the window opens", () => {
    expect(windowBadge(published, new Date(OPEN.getTime() - 1))).toEqual({
      label: "Programado",
      detail: "Se publica el 2 nov 2026, 8:00 a. m. (hora de Ecuador)",
    });
  });

  it("shows nothing while it is live, from the opening instant to the closing one", () => {
    expect(windowBadge(published, OPEN)).toBeNull();
    expect(windowBadge(published, new Date(CLOSE.getTime() - 1))).toBeNull();
  });

  it("says Vencido, with the closing in Ecuador time (the previous evening, not the UTC date), from the closing instant", () => {
    expect(windowBadge(published, CLOSE)).toEqual({
      label: "Vencido",
      detail: "Se retiró el 8 nov 2026, 8:30 p. m. (hora de Ecuador)",
    });
  });

  it("shows nothing for a draft, whatever its window, and nothing for an item without a window", () => {
    expect(windowBadge({ ...published, isPublished: false }, new Date(OPEN.getTime() - 1))).toBeNull();
    expect(windowBadge({ ...published, isPublished: false }, CLOSE)).toBeNull();
    expect(windowBadge({ isPublished: true, publishAt: null, unpublishAt: null }, CLOSE)).toBeNull();
  });
});
