import { beforeEach, describe, expect, it } from "vitest";

import { CreateSocialLinkUseCase } from "@/application/use-cases/create-social-link.use-case";
import { UpdateSocialLinkUseCase } from "@/application/use-cases/update-social-link.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain";
import type { SocialLink } from "@/domain/social-link";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const TIKTOK = { platform: "tiktok", label: "TikTok", handle: "@aso_computacion_unl", url: "https://www.tiktok.com/@aso" };

describe("social link use cases", () => {
  let links: InMemoryOrderedRepository<SocialLink>;

  beforeEach(() => {
    links = new InMemoryOrderedRepository<SocialLink>();
  });

  it("appends an unpublished link after the existing ones", async () => {
    const create = new CreateSocialLinkUseCase(links);

    const first = await create.execute(TIKTOK);
    const second = await create.execute({ ...TIKTOK, platform: "twitch", isPublished: true });

    expect(first).toMatchObject({ sortOrder: 0, isPublished: false, note: null, blurb: null });
    expect(second).toMatchObject({ sortOrder: 1, isPublished: true, platform: "twitch" });
  });

  it("rejects an http link without storing anything", async () => {
    await expect(
      new CreateSocialLinkUseCase(links).execute({ ...TIKTOK, url: "http://www.tiktok.com/@aso" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await links.list()).toEqual([]);
  });

  it("updates fields keeping the position, and fails for an unknown id", async () => {
    const created = await new CreateSocialLinkUseCase(links).execute(TIKTOK);
    const update = new UpdateSocialLinkUseCase(links);

    expect(await update.execute({ id: created.id, note: "Clips", isPublished: true })).toMatchObject({
      id: created.id,
      note: "Clips",
      isPublished: true,
      sortOrder: 0,
    });
    await expect(update.execute({ id: MISSING_ID, label: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
