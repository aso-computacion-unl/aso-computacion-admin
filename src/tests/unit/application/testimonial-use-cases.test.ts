import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateTestimonialUseCase } from "@/application/use-cases/create-testimonial.use-case";
import { RemoveTestimonialPhotoUseCase } from "@/application/use-cases/remove-testimonial-photo.use-case";
import {
  SetTestimonialPhotoUseCase,
  TESTIMONIAL_PHOTO_FOLDER,
  TESTIMONIAL_PHOTO_MIN_WIDTH,
} from "@/application/use-cases/set-testimonial-photo.use-case";
import { UpdateTestimonialUseCase } from "@/application/use-cases/update-testimonial.use-case";
import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ImageTooSmallError, ValidationError } from "@/domain";
import type { Testimonial } from "@/domain/testimonial";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const TEXT = { quote: "Aquí aprendí a trabajar en equipo.", name: "Ana Pérez", role: "Egresada" };

function imageFile(name: string) {
  return { name, type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };
}

describe("testimonial use cases", () => {
  let testimonials: InMemoryOrderedRepository<Testimonial>;
  let storage: InMemoryMediaStorage;
  let setPhoto: SetTestimonialPhotoUseCase;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    testimonials = new InMemoryOrderedRepository<Testimonial>();
    storage = new InMemoryMediaStorage();
    setPhoto = new SetTestimonialPhotoUseCase(testimonials, new UploadImageUseCase(storage), storage);
    errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CreateTestimonialUseCase and UpdateTestimonialUseCase", () => {
    it("appends a testimonial without a photo after the existing ones, and may publish it right away", async () => {
      const create = new CreateTestimonialUseCase(testimonials);

      const first = await create.execute(TEXT);
      const second = await create.execute({ ...TEXT, name: "Luis", isPublished: true });

      expect(first).toMatchObject({ sortOrder: 0, isPublished: false, photo: null });
      expect(second).toMatchObject({ sortOrder: 1, isPublished: true, photo: null });
    });

    it("rejects an over-long quote without storing anything", async () => {
      await expect(new CreateTestimonialUseCase(testimonials).execute({ ...TEXT, quote: "q".repeat(301) })).rejects.toBeInstanceOf(ValidationError);
      expect(await testimonials.list()).toEqual([]);
    });

    it("updates text and the photo alt keeping the position, and fails for an unknown id", async () => {
      const created = await new CreateTestimonialUseCase(testimonials).execute(TEXT);
      await setPhoto.execute({ id: created.id, file: imageFile("a.jpg"), alt: "Antes" });
      const update = new UpdateTestimonialUseCase(testimonials);

      expect(await update.execute({ id: created.id, role: "Docente", photoAlt: "Después" })).toMatchObject({
        role: "Docente",
        sortOrder: 0,
        photo: { alt: "Después" },
      });
      await expect(update.execute({ id: MISSING_ID, role: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("SetTestimonialPhotoUseCase", () => {
    let id: string;

    beforeEach(async () => {
      id = (await new CreateTestimonialUseCase(testimonials).execute(TEXT)).id;
    });

    it("uploads to the testimonials folder and stores the photo with its alt, without exposing the publicId", async () => {
      expect(TESTIMONIAL_PHOTO_FOLDER).toBe("testimonials");

      const result = await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "  Ana  " });

      expect(result.photo).toEqual({ url: "https://storage.test/testimonials/a.jpg", width: 1600, height: 1200, alt: "Ana" });
      expect((await testimonials.getById(id))?.props.photo?.publicId).toBe("testimonials/a.jpg");
    });

    it("rejects a photo narrower than the minimum, leaving nothing in storage", async () => {
      storage.nextDimensions = { width: TESTIMONIAL_PHOTO_MIN_WIDTH - 1, height: 400 };

      await expect(setPhoto.execute({ id, file: imageFile("small.jpg"), alt: "x" })).rejects.toBeInstanceOf(ImageTooSmallError);
      expect(storage.has("testimonials/small.jpg")).toBe(false);
    });

    it("rejects a blank alt or an unknown testimonial BEFORE uploading anything", async () => {
      await expect(setPhoto.execute({ id, file: imageFile("a.jpg"), alt: " " })).rejects.toBeInstanceOf(ValidationError);
      await expect(setPhoto.execute({ id: MISSING_ID, file: imageFile("a.jpg"), alt: "x" })).rejects.toBeInstanceOf(NotFoundError);

      expect(storage.size).toBe(0);
    });

    it("destroys the previous photo after the write succeeded when replacing", async () => {
      await setPhoto.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });

      await setPhoto.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" });

      expect(storage.destroyedPublicIds).toEqual(["testimonials/old.jpg"]);
      expect(storage.has("testimonials/new.jpg")).toBe(true);
    });

    it("destroys the NEW asset, keeps the old one and rethrows when the database write fails", async () => {
      await setPhoto.execute({ id, file: imageFile("old.jpg"), alt: "Vieja" });
      const failure = new Error("db down");
      vi.spyOn(testimonials, "update").mockRejectedValueOnce(failure);

      await expect(setPhoto.execute({ id, file: imageFile("new.jpg"), alt: "Nueva" })).rejects.toBe(failure);

      expect(storage.destroyedPublicIds).toEqual(["testimonials/new.jpg"]);
      expect((await testimonials.getById(id))?.props.photo?.publicId).toBe("testimonials/old.jpg");
    });
  });

  describe("RemoveTestimonialPhotoUseCase", () => {
    let id: string;
    let remove: RemoveTestimonialPhotoUseCase;

    beforeEach(async () => {
      id = (await new CreateTestimonialUseCase(testimonials).execute({ ...TEXT, isPublished: true })).id;
      remove = new RemoveTestimonialPhotoUseCase(testimonials, storage);
    });

    it("clears the photo and destroys the stored file, leaving the testimonial published", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });

      expect(await remove.execute({ id })).toMatchObject({ photo: null, isPublished: true });

      expect(storage.destroyedPublicIds).toEqual(["testimonials/a.jpg"]);
    });

    it("keeps the stored file when the database write fails, and logs a failed destroy without failing", async () => {
      await setPhoto.execute({ id, file: imageFile("a.jpg"), alt: "x" });
      vi.spyOn(testimonials, "update").mockRejectedValueOnce(new Error("db down"));
      await expect(remove.execute({ id })).rejects.toThrow("db down");
      expect(storage.has("testimonials/a.jpg")).toBe(true);

      storage.destroyError = new Error("cloudinary down");
      await expect(remove.execute({ id })).resolves.toMatchObject({ photo: null });
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("testimonials/a.jpg"), expect.anything());
    });

    it("is a no-op without a photo and fails for an unknown id", async () => {
      await expect(remove.execute({ id })).resolves.toMatchObject({ photo: null });
      expect(storage.destroyedPublicIds).toEqual([]);
      await expect(remove.execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
