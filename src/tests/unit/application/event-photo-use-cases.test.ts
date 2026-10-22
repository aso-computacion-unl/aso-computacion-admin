import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttachEventPhotoUseCase } from "@/application/use-cases/attach-event-photo.use-case";
import { CreateEventUseCase } from "@/application/use-cases/create-event.use-case";
import { DeactivateEventPhotoUseCase } from "@/application/use-cases/deactivate-event-photo.use-case";
import { ReorderEventPhotosUseCase } from "@/application/use-cases/reorder-event-photos.use-case";
import { UpdateEventPhotoAltUseCase } from "@/application/use-cases/update-event-photo-alt.use-case";
import { UploadImageUseCase } from "@/application/use-cases/upload-image.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ImageTooSmallError } from "@/domain";
import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

function imageFile(name: string) {
  return { name, type: "image/jpeg", size: 3, arrayBuffer: async () => new ArrayBuffer(3) };
}

describe("event photo use cases", () => {
  let events: InMemoryEventRepository;
  let photos: InMemoryEventPhotoRepository;
  let storage: InMemoryMediaStorage;
  let attach: AttachEventPhotoUseCase;
  let eventId: string;

  beforeEach(async () => {
    events = new InMemoryEventRepository();
    photos = new InMemoryEventPhotoRepository();
    storage = new InMemoryMediaStorage();
    attach = new AttachEventPhotoUseCase(events, photos, new UploadImageUseCase(storage), storage);
    eventId = (await new CreateEventUseCase(events).execute({ title: "Hackatón" })).id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AttachEventPhotoUseCase", () => {
    it("uploads to the events folder, requires 1200 px and appends the photo with its alt", async () => {
      storage.nextDimensions = { width: 1200, height: 800 };

      const first = await attach.execute({ eventId, file: imageFile("a.jpg"), alt: "  Equipo  " });
      const second = await attach.execute({ eventId, file: imageFile("b.jpg"), alt: "Premiación" });

      expect(first).toMatchObject({
        eventId,
        url: "https://storage.test/events/a.jpg",
        publicId: "events/a.jpg",
        width: 1200,
        height: 800,
        alt: "Equipo",
        sortOrder: 0,
        isActive: true,
      });
      expect(second.sortOrder).toBe(1);
      expect(storage.get("events/a.jpg")?.folder).toBe("events");
    });

    it("rejects an image narrower than 1200 px and leaves nothing stored or saved", async () => {
      storage.nextDimensions = { width: 1199, height: 800 };

      await expect(attach.execute({ eventId, file: imageFile("a.jpg"), alt: "Foto" })).rejects.toBeInstanceOf(
        ImageTooSmallError,
      );

      expect(storage.size).toBe(0);
      expect(await photos.listActiveByEventId(eventId)).toEqual([]);
    });

    it("rejects a missing alt before uploading anything", async () => {
      await expect(attach.execute({ eventId, file: imageFile("a.jpg"), alt: "  " })).rejects.toMatchObject({
        field: "alt",
      });

      expect(storage.size).toBe(0);
    });

    it("rejects an unknown event before uploading anything", async () => {
      await expect(
        attach.execute({ eventId: MISSING_ID, file: imageFile("a.jpg"), alt: "Foto" }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(storage.size).toBe(0);
    });

    it("stops at twelve active photos without uploading the thirteenth", async () => {
      for (let i = 0; i < MAX_ACTIVE_EVENT_PHOTOS; i += 1) {
        await attach.execute({ eventId, file: imageFile(`p${i}.jpg`), alt: `Foto ${i}` });
      }

      await expect(attach.execute({ eventId, file: imageFile("extra.jpg"), alt: "Extra" })).rejects.toMatchObject({
        field: "photos",
      });

      expect(storage.has("events/extra.jpg")).toBe(false);
    });

    it("lets a deactivated photo free its slot", async () => {
      const first = await attach.execute({ eventId, file: imageFile("p0.jpg"), alt: "Foto" });
      for (let i = 1; i < MAX_ACTIVE_EVENT_PHOTOS; i += 1) {
        await attach.execute({ eventId, file: imageFile(`p${i}.jpg`), alt: "Foto" });
      }

      await new DeactivateEventPhotoUseCase(photos).execute({ eventId, photoId: first.id });

      await expect(attach.execute({ eventId, file: imageFile("new.jpg"), alt: "Nueva" })).resolves.toMatchObject({
        alt: "Nueva",
      });
    });

    describe("orphan handling (L10)", () => {
      it("destroys the uploaded asset and rethrows the original error when the DB write fails", async () => {
        const dbError = new Error("connection reset");
        photos.addError = dbError;
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(attach.execute({ eventId, file: imageFile("a.jpg"), alt: "Foto" })).rejects.toBe(dbError);

        expect(storage.destroyedPublicIds).toEqual(["events/a.jpg"]);
        expect(storage.has("events/a.jpg")).toBe(false);
      });

      it("still surfaces the original error and logs when the cleanup fails too", async () => {
        const dbError = new Error("connection reset");
        photos.addError = dbError;
        storage.destroyError = new Error("cloudinary down");
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(attach.execute({ eventId, file: imageFile("a.jpg"), alt: "Foto" })).rejects.toBe(dbError);

        expect(log).toHaveBeenCalledTimes(1);
        expect(String(log.mock.calls[0]?.join(" "))).toContain("events/a.jpg");
      });

      it("destroys a too-small image exactly once: the upload cleans it, the DB cleanup is not reached", async () => {
        storage.nextDimensions = { width: 100, height: 100 };

        await expect(attach.execute({ eventId, file: imageFile("a.jpg"), alt: "Foto" })).rejects.toBeInstanceOf(
          ImageTooSmallError,
        );

        expect(storage.destroyedPublicIds).toEqual(["events/a.jpg"]);
      });
    });
  });

  describe("ReorderEventPhotosUseCase", () => {
    async function seed(count: number) {
      const ids: string[] = [];
      for (let i = 0; i < count; i += 1) {
        ids.push((await attach.execute({ eventId, file: imageFile(`p${i}.jpg`), alt: `Foto ${i}` })).id);
      }
      return ids;
    }

    async function order() {
      return (await photos.listActiveByEventId(eventId)).map((photo) => photo.props.id);
    }

    it("moves a photo up and down by swapping with its neighbour", async () => {
      const [a, b, c] = await seed(3);
      const reorder = new ReorderEventPhotosUseCase(photos);

      await reorder.execute({ eventId, photoId: c!, direction: "up" });
      expect(await order()).toEqual([a, c, b]);

      await reorder.execute({ eventId, photoId: a!, direction: "down" });
      expect(await order()).toEqual([c, a, b]);
    });

    it("keeps the order when the photo is already at the edge", async () => {
      const [a, b] = await seed(2);
      const reorder = new ReorderEventPhotosUseCase(photos);

      await reorder.execute({ eventId, photoId: a!, direction: "up" });
      await reorder.execute({ eventId, photoId: b!, direction: "down" });

      expect(await order()).toEqual([a, b]);
    });

    it("rejects a photo that is not an active photo of the event", async () => {
      await seed(1);

      await expect(
        new ReorderEventPhotosUseCase(photos).execute({ eventId, photoId: MISSING_ID, direction: "up" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("DeactivateEventPhotoUseCase", () => {
    it("deactivates the photo but keeps the stored asset", async () => {
      const photo = await attach.execute({ eventId, file: imageFile("a.jpg"), alt: "Foto" });

      await new DeactivateEventPhotoUseCase(photos).execute({ eventId, photoId: photo.id });

      expect(await photos.listActiveByEventId(eventId)).toEqual([]);
      expect((await photos.getById(photo.id))?.props.isActive).toBe(false);
      expect(storage.destroyedPublicIds).toEqual([]);
    });

    it("rejects a photo of another event", async () => {
      const photo = await attach.execute({ eventId, file: imageFile("a.jpg"), alt: "Foto" });

      await expect(
        new DeactivateEventPhotoUseCase(photos).execute({ eventId: MISSING_ID, photoId: photo.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect((await photos.getById(photo.id))?.props.isActive).toBe(true);
    });
  });

  describe("UpdateEventPhotoAltUseCase", () => {
    it("updates the alt text and rejects an empty one", async () => {
      const photo = await attach.execute({ eventId, file: imageFile("a.jpg"), alt: "Foto" });
      const updateAlt = new UpdateEventPhotoAltUseCase(photos);

      expect((await updateAlt.execute({ eventId, photoId: photo.id, alt: "Nueva descripción" })).alt).toBe(
        "Nueva descripción",
      );
      await expect(updateAlt.execute({ eventId, photoId: photo.id, alt: " " })).rejects.toMatchObject({ field: "alt" });
      expect((await photos.getById(photo.id))?.props.alt).toBe("Nueva descripción");
    });

    it("throws NotFoundError for an unknown photo", async () => {
      await expect(
        new UpdateEventPhotoAltUseCase(photos).execute({ eventId, photoId: MISSING_ID, alt: "x" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
