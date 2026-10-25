import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NewsItem } from "@/domain/news-item";
import { prisma } from "@/infrastructure/prisma/client";
import { NewsPrismaRepository } from "@/infrastructure/repositories/news-prisma.repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const COVER = {
  url: "https://res.cloudinary.test/news/taller.jpg",
  publicId: "news/taller",
  width: 1600,
  height: 900,
  alt: "Estudiantes en el taller",
};

const make = (title: string, overrides: Partial<Parameters<typeof NewsItem.create>[0]> = {}) =>
  NewsItem.create({ title, summary: "Resumen", body: "Cuerpo", ...overrides });

describe("NewsPrismaRepository (integration)", () => {
  const repository = new NewsPrismaRepository();

  it("round-trips an item without a cover and with one, body and accents intact", async () => {
    const bare = make("Sin portada", { publishedAt: "2026-03-14" });
    const full = make("Con portada", {
      summary: "ñ".repeat(280),
      body: "Un **párrafo** con [enlace](https://aso.test).\n\n- a\n- b\n" + "é".repeat(9000),
      publishedAt: "2026-04-01",
      cover: COVER,
      isPublished: true,
    });

    await repository.create(bare);
    await repository.create(full);

    expect((await repository.getById(bare.props.id))?.props).toEqual(bare.props);
    expect((await repository.getById(full.props.id))?.props).toEqual(full.props);
  });

  it("stores the publication date as a plain calendar day regardless of the process time zone", async () => {
    await repository.create(make("Charla", { publishedAt: "2026-03-01" }));

    const [row] = await prisma.$queryRaw<{ publishedAt: string }[]>`SELECT "publishedAt"::text AS "publishedAt" FROM "NewsItem"`;
    expect(row?.publishedAt).toBe("2026-03-01");
  });

  it("returns null for an unknown id", async () => {
    expect(await repository.getById(MISSING_ID)).toBeNull();
  });

  it("list returns drafts too: publication date descending, then newest created first", async () => {
    const old = await repository.create(make("Vieja", { publishedAt: "2025-01-10", isPublished: true }));
    const recent = await repository.create(make("Reciente", { publishedAt: "2026-12-01" }));
    const sameDayFirst = await repository.create(make("Mismo día uno", { publishedAt: "2026-06-01" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const sameDaySecond = await repository.create(make("Mismo día dos", { publishedAt: "2026-06-01" }));

    const ids = (await repository.list()).map((item) => item.props.id);

    expect(ids).toEqual([recent, sameDaySecond, sameDayFirst, old].map((item) => item.props.id));
  });

  it("list narrows by status and countByStatus counts both states", async () => {
    const published = await repository.create(make("Publicada", { publishedAt: "2026-02-01", isPublished: true }));
    const draft = await repository.create(make("Borrador", { publishedAt: "2026-03-01" }));

    expect((await repository.list({ status: "published" })).map((item) => item.props.id)).toEqual([published.props.id]);
    expect((await repository.list({ status: "draft" })).map((item) => item.props.id)).toEqual([draft.props.id]);
    expect(await repository.list({})).toHaveLength(2);
    expect(await repository.countByStatus()).toEqual({ published: 1, draft: 1 });
  });

  it("updates an item, keeping its id and creation time", async () => {
    const created = await repository.create(make("Original"));

    const updated = await repository.update(created.update({ title: "Nuevo", isPublished: true, publishedAt: "2026-05-05" }));

    expect(updated.props).toMatchObject({ title: "Nuevo", isPublished: true, publishedAt: "2026-05-05", id: created.props.id });
    expect(updated.props.createdAt).toEqual(created.props.createdAt);
  });

  it("sets, replaces and clears the cover through update", async () => {
    const created = await repository.create(make("Con portada"));

    const withCover = await repository.update(created.withCover(COVER));
    expect((await repository.getById(created.props.id))?.props.cover).toEqual(COVER);

    const replaced = await repository.update(withCover.withCover({ ...COVER, publicId: "news/otra", alt: "Otra" }));
    expect((await repository.getById(created.props.id))?.props.cover).toMatchObject({ publicId: "news/otra", alt: "Otra" });

    await repository.update(replaced.withoutCover());
    expect((await repository.getById(created.props.id))?.props.cover).toBeNull();
  });

  it("refuses, in the database, a cover with only some of its columns", async () => {
    const half = { id: crypto.randomUUID(), title: "Medio", summary: "Resumen", body: "Cuerpo", publishedAt: new Date("2026-03-01"), updatedAt: new Date() };

    await expect(prisma.newsItem.create({ data: { ...half, slug: "medio-1", coverUrl: "https://x.test/a.jpg" } })).rejects.toThrow();
    await expect(prisma.newsItem.create({ data: { ...half, id: crypto.randomUUID(), slug: "medio-2", coverAlt: "solo alt" } })).rejects.toThrow();
  });

  it("throws NotFoundError when updating or deleting an unknown item", async () => {
    await expect(repository.update(make("Fantasma"))).rejects.toThrow("News item not found");
    await expect(repository.delete(MISSING_ID)).rejects.toThrow("News item not found");
  });

  it("deletes an item", async () => {
    const created = await repository.create(make("Borrar"));

    await repository.delete(created.props.id);

    expect(await repository.getById(created.props.id)).toBeNull();
  });

  it("slugExists ignores the excluded item", async () => {
    const item = await repository.create(make("Taller de Git"));

    expect(await repository.slugExists("taller-de-git")).toBe(true);
    expect(await repository.slugExists("taller-de-git", item.props.id)).toBe(false);
    expect(await repository.slugExists("otro")).toBe(false);
  });

  it("maps a slug collision on create and on update to a slug validation error", async () => {
    await repository.create(make("Uno", { slug: "mismo" }));
    const other = await repository.create(make("Dos", { slug: "otro" }));

    await expect(repository.create(make("Tres", { slug: "mismo" }))).rejects.toMatchObject({ name: "ValidationError", field: "slug" });
    await expect(repository.update(other.update({ slug: "mismo" }))).rejects.toMatchObject({ name: "ValidationError", field: "slug" });
  });
});
