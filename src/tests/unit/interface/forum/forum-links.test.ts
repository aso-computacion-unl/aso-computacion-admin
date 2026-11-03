import { describe, expect, it } from "vitest";

import { feedHref } from "@/interface/forum/forum-links";

describe("feedHref", () => {
  it("is /foro for the default tab, every category and the first page", () => {
    expect(feedHref()).toBe("/foro");
    expect(feedHref({ filter: "open", page: 1 })).toBe("/foro");
  });

  it("carries the category, the solved tab and the page", () => {
    expect(feedHref({ category: "materias" })).toBe("/foro?categoria=materias");
    expect(feedHref({ filter: "solved" })).toBe("/foro?estado=resueltos");
    expect(feedHref({ category: "materias", filter: "solved", page: 2 })).toBe("/foro?categoria=materias&estado=resueltos&pagina=2");
  });
});
