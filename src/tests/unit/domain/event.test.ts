import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { Event, type CreateEventInput } from "@/domain/event";

function build(overrides: Partial<CreateEventInput> = {}): Event {
  return Event.create({ title: "Hackatón 24h", ...overrides });
}

describe("Event.create", () => {
  it("applies safe defaults: unpublished, not featured, optional fields empty", () => {
    const event = build();

    expect(event.props).toMatchObject({
      title: "Hackatón 24h",
      slug: "hackaton-24h",
      description: null,
      date: null,
      type: null,
      commitMessage: null,
      hora: null,
      lugar: null,
      para: null,
      featured: false,
      linkUrl: null,
      linkLabel: null,
      highlights: [],
      isPublished: false,
    });
    expect(event.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("trims text and keeps an explicit slug", () => {
    const event = build({ title: "  Taller de Git  ", slug: "git-basico", description: "  Primeros pasos  " });

    expect(event.props.title).toBe("Taller de Git");
    expect(event.props.slug).toBe("git-basico");
    expect(event.props.description).toBe("Primeros pasos");
  });

  it("turns blank optional text into null", () => {
    expect(build({ description: "   ", commitMessage: "", hora: " " }).props).toMatchObject({
      description: null,
      commitMessage: null,
      hora: null,
    });
  });

  it.each([
    ["title", { title: "   " }],
    ["title", { title: "a".repeat(121) }],
    ["description", { description: "a".repeat(601) }],
    ["commitMessage", { commitMessage: "a".repeat(81) }],
    ["hora", { hora: "a".repeat(81) }],
    ["lugar", { lugar: "a".repeat(81) }],
    ["para", { para: "a".repeat(81) }],
    ["linkLabel", { linkUrl: "https://aso.test", linkLabel: "a".repeat(81) }],
    ["slug", { slug: "Not A Slug" }],
  ])("rejects an invalid %s", (field, input) => {
    expect(() => build(input)).toThrow(expect.objectContaining({ name: "ValidationError", field }));
  });

  it("accepts the boundary lengths", () => {
    expect(() =>
      build({ title: "a".repeat(120), description: "a".repeat(600), commitMessage: "a".repeat(80) }),
    ).not.toThrow();
  });

  it("fails when no slug can be derived from the title", () => {
    expect(() => build({ title: "¡¡¡" })).toThrow(expect.objectContaining({ field: "slug" }));
  });

  describe("date", () => {
    it("stores a valid calendar date as YYYY-MM-DD", () => {
      expect(build({ date: "2026-12-11" }).props.date).toBe("2026-12-11");
    });

    it.each(["2026-02-30", "11/12/2026", "2026-12-11T10:00:00Z", "2026-13-01", "tomorrow"])("rejects %j", (date) => {
      expect(() => build({ date })).toThrow(expect.objectContaining({ field: "date" }));
    });
  });

  describe("datePrecision", () => {
    it("defaults to day and leaves the date untouched", () => {
      expect(build({ date: "2026-12-11" }).props).toMatchObject({ date: "2026-12-11", datePrecision: "day" });
      expect(build({ date: "2026-12-11", datePrecision: "day" }).props.date).toBe("2026-12-11");
    });

    it("normalises a month-only date to the first of its month", () => {
      expect(build({ date: "2026-02-17", datePrecision: "month" }).props).toMatchObject({
        date: "2026-02-01",
        datePrecision: "month",
      });
      expect(build({ date: "2026-02-28", datePrecision: "month" }).props.date).toBe("2026-02-01");
    });

    it("falls back to day when there is no date", () => {
      expect(build({ datePrecision: "month" }).props).toMatchObject({ date: null, datePrecision: "day" });
      expect(build({ date: "  ", datePrecision: "month" }).props.datePrecision).toBe("day");
    });

    it.each(["week", "MONTH", "", "year"])("rejects the precision %j", (datePrecision) => {
      expect(() => build({ date: "2026-02-17", datePrecision: datePrecision as never })).toThrow(
        expect.objectContaining({ name: "ValidationError", field: "datePrecision" }),
      );
    });

    it("still rejects an invalid date when the precision is month", () => {
      expect(() => build({ date: "2026-02-30", datePrecision: "month" })).toThrow(expect.objectContaining({ field: "date" }));
      expect(() => build({ date: "2026-02", datePrecision: "month" })).toThrow(expect.objectContaining({ field: "date" }));
    });

    it("re-normalises on update: switching to month snaps the date, clearing the date resets to day", () => {
      const exact = build({ date: "2026-02-17" });
      const month = exact.update({ datePrecision: "month" });

      expect(month.props).toMatchObject({ date: "2026-02-01", datePrecision: "month" });
      expect(month.update({ date: "2026-05-20" }).props).toMatchObject({ date: "2026-05-01", datePrecision: "month" });
      expect(month.update({ datePrecision: "day" }).props).toMatchObject({ date: "2026-02-01", datePrecision: "day" });
      expect(month.update({ date: null }).props).toMatchObject({ date: null, datePrecision: "day" });
    });
  });

  describe("type", () => {
    it.each(["taller", "charla", "evento", "comunidad"])("accepts %s", (type) => {
      expect(build({ type }).props.type).toBe(type);
    });

    it("rejects an unknown type", () => {
      expect(() => build({ type: "fiesta" })).toThrow(expect.objectContaining({ field: "type" }));
    });
  });

  describe("link", () => {
    it("accepts an https url with a label", () => {
      expect(build({ linkUrl: "https://aso.test/inscripcion", linkLabel: "Inscribirme" }).props).toMatchObject({
        linkUrl: "https://aso.test/inscripcion",
        linkLabel: "Inscribirme",
      });
    });

    it.each(["http://aso.test", "javascript:alert(1)", "//aso.test", "aso.test", "https://"])(
      "rejects %j as a link",
      (linkUrl) => {
        expect(() => build({ linkUrl })).toThrow(expect.objectContaining({ field: "linkUrl" }));
      },
    );

    it("rejects a label without a url", () => {
      expect(() => build({ linkLabel: "Inscribirme" })).toThrow(expect.objectContaining({ field: "linkLabel" }));
    });
  });

  describe("highlights", () => {
    it("keeps order and trims entries", () => {
      expect(build({ highlights: [" Intro ", "Retos"] }).props.highlights).toEqual(["Intro", "Retos"]);
    });

    it("accepts eight entries and rejects nine", () => {
      expect(() => build({ highlights: Array.from({ length: 8 }, (_, i) => `h${i}`) })).not.toThrow();
      expect(() => build({ highlights: Array.from({ length: 9 }, (_, i) => `h${i}`) })).toThrow(
        expect.objectContaining({ field: "highlights" }),
      );
    });

    it.each([[[" "]], [["a".repeat(81)]]])("rejects invalid entry %j", (highlights) => {
      expect(() => build({ highlights })).toThrow(expect.objectContaining({ field: "highlights" }));
    });
  });
});

describe("Event.update", () => {
  it("changes only the given fields and refreshes updatedAt", () => {
    const event = Event.reconstitute({
      ...build({ title: "Original", description: "Texto" }).props,
      updatedAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    const updated = event.update({ title: "Nuevo" });

    expect(updated.props.title).toBe("Nuevo");
    expect(updated.props.description).toBe("Texto");
    expect(updated.props.id).toBe(event.props.id);
    expect(updated.props.slug).toBe(event.props.slug);
    expect(updated.props.updatedAt.getTime()).toBeGreaterThan(event.props.updatedAt.getTime());
  });

  it("clears an optional field when given null", () => {
    expect(build({ date: "2026-12-11" }).update({ date: null }).props.date).toBeNull();
  });

  it("re-validates changed fields", () => {
    expect(() => build().update({ linkUrl: "http://aso.test" })).toThrow(ValidationError);
  });

  it("checks the link label against the resulting url", () => {
    const withLink = build({ linkUrl: "https://aso.test", linkLabel: "Ir" });

    expect(() => withLink.update({ linkUrl: null })).toThrow(expect.objectContaining({ field: "linkLabel" }));
    expect(withLink.update({ linkUrl: null, linkLabel: null }).props.linkUrl).toBeNull();
  });

  it("publishes and unpublishes", () => {
    const event = build();

    expect(event.update({ isPublished: true }).props.isPublished).toBe(true);
    expect(event.update({ isPublished: true }).update({ isPublished: false }).props.isPublished).toBe(false);
  });
});
