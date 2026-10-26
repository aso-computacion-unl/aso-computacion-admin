import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreatePillarUseCase } from "@/application/use-cases/create-pillar.use-case";
import { RemovePillarImageUseCase } from "@/application/use-cases/remove-pillar-image.use-case";
import {
  PILLAR_IMAGE_FOLDER,
  PILLAR_IMAGE_MIN_WIDTH,
  SetPillarImageUseCase,
} from "@/application/use-cases/set-pillar-image.use-case";
import { UpdatePillarUseCase } from "@/application/use-cases/update-pillar.use-case";
import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ImageTooSmallError, ValidationError } from "@/domain";
import type { Pillar } from "@/domain/pillar";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const TEXT = { word: "VOZ", title: "Representamos", text: "Llevamos lo que piensan los estudiantes." };

function imageFile(name: string) {
  return { name, type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };
}

describe("pillar use cases", () => {
  let pillars: InMemoryOrderedRepository<Pillar>;
  let storage: InMemoryMediaStorage;
  let setImage: SetPillarImageUseCase;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pillars = new InMemoryOrderedRepository<Pillar>();
    storage = new InMemoryMediaStorage();
    setImage = new SetPillarImageUseCase(pillars, new UploadImageUseCase(storage), storage);
    errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CreatePillarUseCase and UpdatePillarUseCase", () => {
    it("appends an unpublished pillar without an image after the existing ones", async () => {
      const create = new CreatePillarUseCase(pillars);

      const first = await create.execute(TEXT);
      const second = await create.execute({ ...TEXT, word: "APOYO", isPublished: true });

      expect(first).toMatchObject({ sortOrder: 0, isPublished: false, image: null });
      expect(second).toMatchObject({ sortOrder: 1, isPublished: true });
    });

    it("ignores fields that are not part of a new pillar, such as a stray image alt", async () => {
      const created = await new CreatePillarUseCase(pillars).execute({ ...TEXT, imageAlt: "x" } as Parameters<CreatePillarUseCase["execute"]>[0]);

      expect(created).toMatchObject({ image: null, isPublished: false });
    });

    it("rejects invalid text without storing anything", async () => {
      await expect(new CreatePillarUseCase(pillars).execute({ ...TEXT, word: "w".repeat(21) })).rejects.toBeInstanceOf(ValidationError);
      expect(await pillars.list()).toEqual([]);
    });

    it("updates text and alt keeping the position, and fails for an unknown id", async () => {
      const created = await new CreatePillarUseCase(pillars).execute(TEXT);
      await setImage.execute({ id: created.id, file: imageFile("a.jpg"), alt: "Antes" });
      const update = new UpdatePillarUseCase(pillars);

      expect(await update.execute({ id: created.id, title: "Otro", imageAlt: "Después" })).toMatchObject({
        title: "Otro",
        sortOrder: 0,
        image: { alt: "Después" },
      });
      await expect(update.execute({ id: MISSING_ID, title: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("SetPillarImageUseCase", () => {
    let id: string;

    beforeEach(async () => {
      id = (await new CreatePillarUseCase(pillars).execute(TEXT)).id;
    });

    it("uploads to the pillars folder (1200 px minimum) and stores the image with its alt", async () => {
      expect(PILLAR_IMAGE_FOLDER).toBe("pillars");
      expect(PILLAR_IMAGE_MIN_WIDTH).toBe(1200);

      const result = await setImage.execute({ id, file: imageFile("a.jpg"), alt: "  Charla  " });

      expect(result.image).toEqual({ url: "https://storage.test/pillars/a.jpg", width: 1600, height: 1200, alt: "Charla" });
      expect(storage.get("pillars/a.jpg")?.folder).toBe("pillars");
      expect((await pillars.getById(id))?.props.image?.publicId).toBe("pillars/a.jpg");
    });

    it("rejects a blank alt or an unknown pillar BEFORE uploading anything", async () => {
      await expect(setImage.execute({ id, file: imageFile("a.jpg"), alt: " " })).rejects.toBeInstanceOf(ValidationError);
      await expect(setImage.execute({ id: MISSING_ID, file: imageFile("a.jpg"), alt: "x" })).rejects.toBeInstanceOf(NotFoundError);

      expect(storage.size).toBe(0);
    });

    it("rejects an image under 1200 px wide and leaves the pillar and storage untouched", async () => {
      storage.nextDimensions = { width: 800, height: 600 };

      await expect(setImage.execute({ id, file: imageFile("a.jpg"), alt: "x" })).rejects.toBeInstanceOf(ImageTooSmallError);

      expect((await pillars.getById(id))?.props.image).toBeNull();
      expect(storage.size).toBe(0);
    });

    it("destroys the previous image after the write succeeded when replacing", async () => {
      await setImage.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });

      const result = await setImage.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" });

      expect(result.image?.url).toBe("https://storage.test/pillars/new.jpg");
      expect(storage.destroyedPublicIds).toEqual(["pillars/old.jpg"]);
      expect(storage.has("pillars/new.jpg")).toBe(true);
    });

    it("logs the leftover publicId, and still succeeds, when destroying the previous image fails", async () => {
      await setImage.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });
      storage.destroyError = new Error("cloudinary down");

      await expect(setImage.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" })).resolves.toMatchObject({
        image: { url: "https://storage.test/pillars/new.jpg" },
      });

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("pillars/old.jpg"), expect.anything());
    });

    it("destroys the NEW asset, keeps the old one and rethrows when the database write fails", async () => {
      await setImage.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });
      const failure = new Error("db down");
      vi.spyOn(pillars, "update").mockRejectedValueOnce(failure);

      await expect(setImage.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" })).rejects.toBe(failure);

      expect(storage.destroyedPublicIds).toEqual(["pillars/new.jpg"]);
      expect(storage.has("pillars/old.jpg")).toBe(true);
      expect((await pillars.getById(id))?.props.image?.publicId).toBe("pillars/old.jpg");
    });

    it("logs the orphan publicId and still reports the original error when that cleanup fails too", async () => {
      const failure = new Error("db down");
      vi.spyOn(pillars, "update").mockRejectedValueOnce(failure);
      storage.destroyError = new Error("cloudinary down");

      await expect(setImage.execute({ id, file: imageFile("new.jpg"), alt: "x" })).rejects.toBe(failure);

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("pillars/new.jpg"), expect.anything());
    });
  });

  describe("RemovePillarImageUseCase", () => {
    let id: string;
    let remove: RemovePillarImageUseCase;

    beforeEach(async () => {
      id = (await new CreatePillarUseCase(pillars).execute(TEXT)).id;
      remove = new RemovePillarImageUseCase(pillars, storage);
    });

    it("clears the image, then destroys the stored file", async () => {
      await setImage.execute({ id, file: imageFile("a.jpg"), alt: "x" });

      expect((await remove.execute({ id })).image).toBeNull();

      expect((await pillars.getById(id))?.props.image).toBeNull();
      expect(storage.destroyedPublicIds).toEqual(["pillars/a.jpg"]);
    });

    it("keeps the stored file when the database write fails", async () => {
      await setImage.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      vi.spyOn(pillars, "update").mockRejectedValueOnce(new Error("db down"));

      await expect(remove.execute({ id })).rejects.toThrow("db down");

      expect(storage.destroyedPublicIds).toEqual([]);
      expect(storage.has("pillars/a.jpg")).toBe(true);
    });

    it("logs the leftover publicId and still succeeds when the destroy fails", async () => {
      await setImage.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      storage.destroyError = new Error("cloudinary down");

      await expect(remove.execute({ id })).resolves.toMatchObject({ image: null });

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("pillars/a.jpg"), expect.anything());
    });

    it("is a no-op for a pillar without an image and fails for an unknown id", async () => {
      await expect(remove.execute({ id })).resolves.toMatchObject({ image: null });
      expect(storage.destroyedPublicIds).toEqual([]);
      await expect(remove.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
