import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain";
import { todayInEcuador } from "@/domain/calendar-date";
import { NewsItem } from "@/domain/news-item";

const COVER = {
  url: "https://res.cloudinary.test/news/taller.jpg",
  publicId: "news/taller",
  width: 1600,
  height: 900,
  alt: "Estudiantes en el taller",
};

function build(overrides: Partial<Parameters<typeof NewsItem.create>[0]> = {}): NewsItem {
  return NewsItem.create({
    title: "Taller de Git 2026",
    summary: "Aprende Git desde cero.",
    body: "Primer párrafo.\n\n- uno\n- dos",
    ...overrides,
  });
}

describe("todayInEcuador", () => {
  it("is the calendar date in Ecuador (UTC-5), not in UTC", () => {
    expect(todayInEcuador(new Date("2026-10-23T01:30:00Z"))).toBe("2026-10-22");
    expect(todayInEcuador(new Date("2026-10-23T05:00:00Z"))).toBe("2026-10-23");
  });
});

describe("NewsItem.create", () => {
  it("trims, derives the slug from the title, starts as a draft without a cover and dated today in Ecuador", () => {
    const item = build({ title: "  Taller de Git 2026  ", summary: " Resumen " });

    expect(item.props).toMatchObject({
      slug: "taller-de-git-2026",
      title: "Taller de Git 2026",
      summary: "Resumen",
      cover: null,
      isPublished: false,
      publishedAt: todayInEcuador(new Date()),
    });
    expect(item.props.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps the body as written, Markdown included", () => {
    const body = "Un **negrita**, un *énfasis* y [un enlace](https://aso.test).\n\n- a\n- b";

    expect(build({ body }).props.body).toBe(body);
  });

  it("accepts an explicit slug and publication date", () => {
    const item = build({ slug: "git-2026", publishedAt: "2026-03-14" });

    expect(item.props).toMatchObject({ slug: "git-2026", publishedAt: "2026-03-14" });
  });

  it.each([
    ["title", { title: " " }],
    ["title", { title: "t".repeat(121) }],
    ["summary", { summary: "" }],
    ["summary", { summary: "s".repeat(281) }],
    ["body", { body: "  " }],
    ["body", { body: "b".repeat(10001) }],
    ["slug", { slug: "Not A Slug" }],
    ["slug", { title: "¡¡¡", summary: "x" }],
    ["publishedAt", { publishedAt: "2026-02-30" }],
    ["publishedAt", { publishedAt: "14/03/2026" }],
    ["publishedAt", { publishedAt: "2026-03" }],
  ])("rejects an invalid %s", (field, overrides) => {
    const make = () => build(overrides as Partial<Parameters<typeof NewsItem.create>[0]>);

    expect(make).toThrow(ValidationError);
    expect(make).toThrow(expect.objectContaining({ field }));
  });

  it("accepts the limits exactly", () => {
    const item = build({ title: "t".repeat(120), summary: "s".repeat(280), body: "b".repeat(10000) });

    expect(item.props.title).toHaveLength(120);
    expect(item.props.body).toHaveLength(10000);
  });
});

describe("NewsItem cover rules", () => {
  it("keeps a valid cover and requires its alt text (1-200)", () => {
    expect(build({ cover: { ...COVER, alt: "  Taller  " } }).props.cover).toEqual({ ...COVER, alt: "Taller" });
    expect(() => build({ cover: { ...COVER, alt: " " } })).toThrow(expect.objectContaining({ field: "coverAlt" }));
    expect(() => build({ cover: { ...COVER, alt: "a".repeat(201) } })).toThrow(expect.objectContaining({ field: "coverAlt" }));
  });

  it.each([
    ["coverUrl", { url: "http://x.test/a.jpg" }],
    ["coverPublicId", { publicId: " " }],
    ["coverWidth", { width: 0 }],
    ["coverHeight", { height: 1.5 }],
  ])("withCover rejects an invalid %s", (field, overrides) => {
    expect(() => build().withCover({ ...COVER, ...overrides })).toThrow(expect.objectContaining({ field }));
  });

  it("withCover replaces and withoutCover clears, keeping id and text", () => {
    const item = build({ cover: COVER });
    const replaced = item.withCover({ ...COVER, publicId: "news/otra", alt: "Otra" });

    expect(replaced.props.cover).toMatchObject({ publicId: "news/otra", alt: "Otra" });
    expect(replaced.props.id).toBe(item.props.id);
    expect(replaced.withoutCover().props).toMatchObject({ cover: null, title: "Taller de Git 2026" });
  });
});

describe("NewsItem.update", () => {
  it("keeps id, slug, creation date and cover; left-out fields keep their value", () => {
    const item = build({ cover: COVER, publishedAt: "2026-03-14" });
    const updated = item.update({ title: " Nuevo título ", isPublished: true });

    expect(updated.props).toMatchObject({
      id: item.props.id,
      createdAt: item.props.createdAt,
      slug: "taller-de-git-2026",
      title: "Nuevo título",
      isPublished: true,
      publishedAt: "2026-03-14",
      cover: COVER,
    });
  });

  it("re-validates and can change the slug and the date", () => {
    const item = build();

    expect(item.update({ slug: "otro", publishedAt: "2026-04-01" }).props).toMatchObject({ slug: "otro", publishedAt: "2026-04-01" });
    expect(() => item.update({ body: "" })).toThrow(expect.objectContaining({ field: "body" }));
    expect(() => item.update({ slug: "Mal Slug" })).toThrow(expect.objectContaining({ field: "slug" }));
    expect(() => item.update({ publishedAt: "nope" })).toThrow(expect.objectContaining({ field: "publishedAt" }));
  });

  it("changes the alt of an existing cover and refuses a blank one", () => {
    const item = build({ cover: COVER });

    expect(item.update({ coverAlt: " Nueva descripción " }).props.cover?.alt).toBe("Nueva descripción");
    expect(() => item.update({ coverAlt: "" })).toThrow(expect.objectContaining({ field: "coverAlt" }));
  });

  it("ignores a blank alt without a cover but refuses an alt for nothing", () => {
    const item = build();

    expect(item.update({ coverAlt: "  " }).props.cover).toBeNull();
    expect(() => item.update({ coverAlt: "Sin portada" })).toThrow(expect.objectContaining({ field: "coverAlt" }));
  });

  it("withPublished flips only the flag", () => {
    const item = build();

    expect(item.withPublished(true).props).toMatchObject({ isPublished: true, slug: item.props.slug });
  });
});
