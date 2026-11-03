import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const LATER = new Date("2026-11-02T12:00:00.000Z");

const newEvent = (overrides: Record<string, unknown> = {}) => ({ id: "e1", slug: "evento", title: "Evento", updatedAt: NOW, ...overrides });
const newNews = (overrides: Record<string, unknown> = {}) => ({
  id: "n1",
  slug: "noticia",
  title: "Noticia",
  summary: "Resumen",
  body: "Cuerpo",
  publishedAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

describe("publication window schema (integration)", () => {
  it("stores events and news without a window by default", async () => {
    expect(await prisma.event.create({ data: newEvent() })).toMatchObject({ publishAt: null, unpublishAt: null });
    expect(await prisma.newsItem.create({ data: newNews() })).toMatchObject({ publishAt: null, unpublishAt: null });
  });

  it("keeps the instant of a window, with the time of day, exactly as written", async () => {
    const event = await prisma.event.create({ data: newEvent({ publishAt: NOW, unpublishAt: LATER }) });

    expect(event.publishAt?.toISOString()).toBe(NOW.toISOString());
    expect(event.unpublishAt?.toISOString()).toBe(LATER.toISOString());
  });

  it("accepts a window with only one end", async () => {
    await prisma.event.create({ data: newEvent({ publishAt: NOW }) });
    await prisma.newsItem.create({ data: newNews({ unpublishAt: LATER }) });

    expect(await prisma.event.count()).toBe(1);
    expect(await prisma.newsItem.count()).toBe(1);
  });

  it("refuses a window that closes at or before it opens, on events and on news", async () => {
    await expect(prisma.event.create({ data: newEvent({ publishAt: LATER, unpublishAt: NOW }) })).rejects.toThrow();
    await expect(prisma.event.create({ data: newEvent({ publishAt: NOW, unpublishAt: NOW }) })).rejects.toThrow();
    await expect(prisma.newsItem.create({ data: newNews({ publishAt: LATER, unpublishAt: NOW }) })).rejects.toThrow();

    expect(await prisma.event.count()).toBe(0);
    expect(await prisma.newsItem.count()).toBe(0);
  });

  it("remembers when the landing last accepted a rebuild, apart from the last attempt", async () => {
    expect(await prisma.deployStatus.create({ data: { id: "landing", attemptedAt: NOW, ok: false } })).toMatchObject({ lastSuccessAt: null });
    expect((await prisma.deployStatus.update({ where: { id: "landing" }, data: { lastSuccessAt: LATER } })).lastSuccessAt?.toISOString()).toBe(LATER.toISOString());
  });
});
