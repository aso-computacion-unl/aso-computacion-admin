import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SiteSettings } from "@/domain/site-settings";
import { prisma } from "@/infrastructure/prisma/client";
import { SiteSettingsPrismaRepository } from "@/infrastructure/repositories/site-settings-prisma.repository";

const repository = new SiteSettingsPrismaRepository();
const settings = (tagline: string) =>
  SiteSettings.create({ tagline, description: "Descripción con ñ y tildes.", about: "á".repeat(600) });

describe("SiteSettingsPrismaRepository (integration)", () => {
  it("returns null before anything is saved", async () => {
    expect(await repository.get()).toBeNull();
  });

  it("round-trips the settings", async () => {
    const saved = settings("Primera");

    await repository.save(saved);

    expect((await repository.get())?.props).toEqual(saved.props);
  });

  it("save upserts: a second save replaces the first and the table keeps a single row", async () => {
    await repository.save(settings("Primera"));
    await repository.save(settings("Segunda"));

    expect((await repository.get())?.props.tagline).toBe("Segunda");
    expect(await prisma.siteSettings.count()).toBe(1);
  });

  it("refuses, in the database, a second row", async () => {
    await repository.save(settings("Primera"));

    await expect(
      prisma.siteSettings.create({ data: { id: "other", tagline: "x", description: "x", about: "x", updatedAt: new Date() } }),
    ).rejects.toThrow();
  });
});
