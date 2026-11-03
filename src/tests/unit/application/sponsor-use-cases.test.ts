import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toSponsorResult } from "@/application/mappers/sponsor-result.mapper";
import { CreateSponsorUseCase } from "@/application/use-cases/create-sponsor.use-case";
import { SetOrderedContentPublishedUseCase } from "@/application/use-cases/ordered-content.use-cases";
import { RemoveSponsorLogoUseCase } from "@/application/use-cases/remove-sponsor-logo.use-case";
import { SetSponsorLogoUseCase, SPONSOR_LOGO_FOLDER, SPONSOR_LOGO_MIN_WIDTH } from "@/application/use-cases/set-sponsor-logo.use-case";
import { UpdateSponsorUseCase } from "@/application/use-cases/update-sponsor.use-case";
import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ImageTooSmallError, ValidationError } from "@/domain";
import type { Sponsor } from "@/domain/sponsor";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const TEXT = { name: "Acme", url: "https://acme.test" };

function imageFile(name: string) {
  return { name, type: "image/png", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };
}

describe("sponsor use cases", () => {
  let sponsors: InMemoryOrderedRepository<Sponsor>;
  let storage: InMemoryMediaStorage;
  let setLogo: SetSponsorLogoUseCase;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sponsors = new InMemoryOrderedRepository<Sponsor>();
    storage = new InMemoryMediaStorage();
    setLogo = new SetSponsorLogoUseCase(sponsors, new UploadImageUseCase(storage), storage);
    errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CreateSponsorUseCase and UpdateSponsorUseCase", () => {
    it("appends an unpublished sponsor without a logo after the existing ones", async () => {
      const create = new CreateSponsorUseCase(sponsors);

      const first = await create.execute(TEXT);
      const second = await create.execute({ name: "Beta" });

      expect(first).toMatchObject({ sortOrder: 0, isPublished: false, logo: null, url: "https://acme.test" });
      expect(second).toMatchObject({ sortOrder: 1, url: null });
    });

    it("cannot create a published sponsor: there is no logo yet", async () => {
      await expect(new CreateSponsorUseCase(sponsors).execute({ ...TEXT, isPublished: true })).rejects.toThrow(expect.objectContaining({ field: "logo" }));
      expect(await sponsors.list()).toEqual([]);
    });

    it("rejects a non-https link without storing anything", async () => {
      await expect(new CreateSponsorUseCase(sponsors).execute({ ...TEXT, url: "http://acme.test" })).rejects.toBeInstanceOf(ValidationError);
      expect(await sponsors.list()).toEqual([]);
    });

    it("updates the name, link and logo alt keeping the position, clears a blank link, and fails for an unknown id", async () => {
      const created = await new CreateSponsorUseCase(sponsors).execute(TEXT);
      await setLogo.execute({ id: created.id, file: imageFile("a.png"), alt: "Antes" });
      const update = new UpdateSponsorUseCase(sponsors);

      expect(await update.execute({ id: created.id, name: "Acme S.A.", logoAlt: "Después" })).toMatchObject({ name: "Acme S.A.", sortOrder: 0, logo: { alt: "Después" } });
      expect(await update.execute({ id: created.id, url: "" })).toMatchObject({ url: null });
      await expect(update.execute({ id: MISSING_ID, name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("refuses to publish a sponsor without a logo, and allows it once the logo is set", async () => {
      const { id } = await new CreateSponsorUseCase(sponsors).execute(TEXT);
      const publish = new SetOrderedContentPublishedUseCase(sponsors, toSponsorResult, "Sponsor not found");

      await expect(publish.execute({ id, isPublished: true })).rejects.toThrow(expect.objectContaining({ field: "logo" }));
      await setLogo.execute({ id, file: imageFile("a.png"), alt: "Acme" });

      await expect(publish.execute({ id, isPublished: true })).resolves.toMatchObject({ isPublished: true });
    });
  });

  describe("SetSponsorLogoUseCase", () => {
    let id: string;

    beforeEach(async () => {
      id = (await new CreateSponsorUseCase(sponsors).execute(TEXT)).id;
    });

    it("uploads to the sponsors folder and stores the logo with its alt, without exposing the publicId", async () => {
      expect(SPONSOR_LOGO_FOLDER).toBe("sponsors");

      const result = await setLogo.execute({ id, file: imageFile("a.png"), alt: "  Acme  " });

      expect(result.logo).toEqual({ url: "https://storage.test/sponsors/a.png", width: 1600, height: 1200, alt: "Acme" });
      expect((await sponsors.getById(id))?.props.logo?.publicId).toBe("sponsors/a.png");
    });

    it("rejects a logo narrower than the minimum, leaving nothing in storage", async () => {
      storage.nextDimensions = { width: SPONSOR_LOGO_MIN_WIDTH - 1, height: 100 };

      await expect(setLogo.execute({ id, file: imageFile("small.png"), alt: "x" })).rejects.toBeInstanceOf(ImageTooSmallError);
      expect(storage.has("sponsors/small.png")).toBe(false);
    });

    it("rejects a blank alt or an unknown sponsor BEFORE uploading anything", async () => {
      await expect(setLogo.execute({ id, file: imageFile("a.png"), alt: " " })).rejects.toBeInstanceOf(ValidationError);
      await expect(setLogo.execute({ id: MISSING_ID, file: imageFile("a.png"), alt: "x" })).rejects.toBeInstanceOf(NotFoundError);

      expect(storage.size).toBe(0);
    });

    it("destroys the previous logo after the write succeeded when replacing", async () => {
      await setLogo.execute({ id, file: imageFile("old.png"), alt: "Vieja" });

      await setLogo.execute({ id, file: imageFile("new.png"), alt: "Nueva" });

      expect(storage.destroyedPublicIds).toEqual(["sponsors/old.png"]);
      expect(storage.has("sponsors/new.png")).toBe(true);
    });

    it("destroys the NEW asset, keeps the old one and rethrows when the database write fails", async () => {
      await setLogo.execute({ id, file: imageFile("old.png"), alt: "Vieja" });
      const failure = new Error("db down");
      vi.spyOn(sponsors, "update").mockRejectedValueOnce(failure);

      await expect(setLogo.execute({ id, file: imageFile("new.png"), alt: "Nueva" })).rejects.toBe(failure);

      expect(storage.destroyedPublicIds).toEqual(["sponsors/new.png"]);
      expect((await sponsors.getById(id))?.props.logo?.publicId).toBe("sponsors/old.png");
    });
  });

  describe("RemoveSponsorLogoUseCase", () => {
    let id: string;
    let remove: RemoveSponsorLogoUseCase;

    beforeEach(async () => {
      id = (await new CreateSponsorUseCase(sponsors).execute(TEXT)).id;
      remove = new RemoveSponsorLogoUseCase(sponsors, storage);
    });

    it("clears the logo, destroys the stored file and unpublishes the sponsor, which cannot show without it", async () => {
      await setLogo.execute({ id, file: imageFile("a.png"), alt: "x" });
      await sponsors.update((await sponsors.getById(id))!.withPublished(true));

      expect(await remove.execute({ id })).toMatchObject({ logo: null, isPublished: false });

      expect(storage.destroyedPublicIds).toEqual(["sponsors/a.png"]);
      expect((await sponsors.getById(id))?.props.isPublished).toBe(false);
    });

    it("keeps the stored file when the database write fails, and logs a failed destroy without failing", async () => {
      await setLogo.execute({ id, file: imageFile("a.png"), alt: "x" });
      vi.spyOn(sponsors, "update").mockRejectedValueOnce(new Error("db down"));
      await expect(remove.execute({ id })).rejects.toThrow("db down");
      expect(storage.has("sponsors/a.png")).toBe(true);

      storage.destroyError = new Error("cloudinary down");
      await expect(remove.execute({ id })).resolves.toMatchObject({ logo: null });
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("sponsors/a.png"), expect.anything());
    });

    it("is a no-op without a logo and fails for an unknown id", async () => {
      await expect(remove.execute({ id })).resolves.toMatchObject({ logo: null });
      expect(storage.destroyedPublicIds).toEqual([]);
      await expect(remove.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
