import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { Faq } from "@/domain/faq";

function build(overrides: Partial<Parameters<typeof Faq.create>[0]> = {}): Faq {
  return Faq.create({ question: "¿Tiene algún costo?", answer: "Es gratis.", sortOrder: 0, ...overrides });
}

describe("Faq.create", () => {
  it("trims text and starts unpublished", () => {
    const faq = build({ question: "  ¿Quién participa?  ", answer: "  Todos.  " });

    expect(faq.props).toMatchObject({ question: "¿Quién participa?", answer: "Todos.", sortOrder: 0, isPublished: false });
    expect(faq.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ["question", { question: "   " }],
    ["question", { question: "q".repeat(201) }],
    ["answer", { answer: "" }],
    ["answer", { answer: "a".repeat(1001) }],
    ["sortOrder", { sortOrder: -1 }],
    ["sortOrder", { sortOrder: 1.5 }],
  ])("rejects an invalid %s", (field, overrides) => {
    expect(() => build(overrides)).toThrow(ValidationError);
    expect(() => build(overrides)).toThrow(expect.objectContaining({ field }));
  });

  it("accepts the length limits exactly", () => {
    expect(() => build({ question: "q".repeat(200), answer: "a".repeat(1000) })).not.toThrow();
  });
});

describe("Faq.update / withPublished / withSortOrder", () => {
  it("re-validates updated text and keeps the rest", () => {
    const faq = build();
    const updated = faq.update({ answer: "Gratis siempre." });

    expect(updated.props).toMatchObject({ id: faq.props.id, question: faq.props.question, answer: "Gratis siempre." });
    expect(() => faq.update({ question: "" })).toThrow(ValidationError);
  });

  it("toggles publication and sets the order without touching the text", () => {
    const faq = build();

    expect(faq.withPublished(true).props.isPublished).toBe(true);
    expect(faq.withSortOrder(3).props.sortOrder).toBe(3);
    expect(() => faq.withSortOrder(-2)).toThrow(ValidationError);
  });
});
