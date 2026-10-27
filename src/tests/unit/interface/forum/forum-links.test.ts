import { describe, expect, it } from "vitest";

import { categoryHref, feedHref } from "@/interface/forum/forum-links";

describe("categoryHref", () => {
  it("is the plain URL for the default filter and the first page", () => {
    expect(categoryHref("programacion")).toBe("/foro/c/programacion");
    expect(categoryHref("programacion", { filter: "open", page: 1 })).toBe("/foro/c/programacion");
  });

  it("carries the solved filter and the page", () => {
    expect(categoryHref("materias", { filter: "solved" })).toBe("/foro/c/materias?estado=resueltos");
    expect(categoryHref("materias", { page: 3 })).toBe("/foro/c/materias?pagina=3");
    expect(categoryHref("materias", { filter: "solved", page: 2 })).toBe("/foro/c/materias?estado=resueltos&pagina=2");
  });
});

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
