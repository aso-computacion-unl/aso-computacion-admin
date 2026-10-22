import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateEventUseCase } from "@/application/use-cases/create-event.use-case";
import { DeleteEventUseCase } from "@/application/use-cases/delete-event.use-case";
import { GetEventUseCase } from "@/application/use-cases/get-event.use-case";
import { ListEventsUseCase } from "@/application/use-cases/list-events.use-case";
import { SetEventPublishedUseCase } from "@/application/use-cases/set-event-published.use-case";
import { UpdateEventUseCase } from "@/application/use-cases/update-event.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { EventPhoto } from "@/domain/event-photo";
import { InMemoryEventPhotoRepository } from "@/tests/fakes/in-memory-event-photo.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryMediaStorage } from "@/tests/fakes/in-memory-media-storage";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

describe("event use cases", () => {
  let events: InMemoryEventRepository;
  let photos: InMemoryEventPhotoRepository;

  beforeEach(() => {
    events = new InMemoryEventRepository();
    photos = new InMemoryEventPhotoRepository();
  });

  describe("CreateEventUseCase", () => {
    it("creates an unpublished event with a slug derived from the title", async () => {
      const result = await new CreateEventUseCase(events).execute({ title: "Hackatón 24h", date: "2026-11-28" });

      expect(result).toMatchObject({ title: "Hackatón 24h", slug: "hackaton-24h", isPublished: false });
      expect(await events.getById(result.id)).not.toBeNull();
    });

    it("suffixes a derived slug that is already taken", async () => {
      const create = new CreateEventUseCase(events);

      await create.execute({ title: "Taller de Git" });
      const second = await create.execute({ title: "Taller de Git" });
      const third = await create.execute({ title: "Taller de Git" });

      expect([second.slug, third.slug]).toEqual(["taller-de-git-2", "taller-de-git-3"]);
    });

    it("keeps a suffixed slug within 80 characters", async () => {
      const create = new CreateEventUseCase(events);
      const title = "a".repeat(100);

      await create.execute({ title });
      const second = await create.execute({ title });

      expect(second.slug).toHaveLength(80);
      expect(second.slug.endsWith("-2")).toBe(true);
    });

    it("rejects an explicit slug that is already taken", async () => {
      const create = new CreateEventUseCase(events);
      await create.execute({ title: "Uno", slug: "mismo" });

      await expect(create.execute({ title: "Dos", slug: "mismo" })).rejects.toMatchObject({
        name: "ValidationError",
        field: "slug",
      });
    });

    it("rejects invalid input without persisting", async () => {
      await expect(new CreateEventUseCase(events).execute({ title: " " })).rejects.toMatchObject({ field: "title" });
      expect(await events.list()).toEqual([]);
    });
  });

  describe("UpdateEventUseCase", () => {
    it("updates fields and keeps the slug unless a new one is given", async () => {
      const created = await new CreateEventUseCase(events).execute({ title: "Original" });

      const updated = await new UpdateEventUseCase(events).execute({ id: created.id, title: "Nuevo título" });

      expect(updated).toMatchObject({ title: "Nuevo título", slug: "original" });
    });

    it("lets the event keep its own slug but not take another event's", async () => {
      const create = new CreateEventUseCase(events);
      const first = await create.execute({ title: "Primero" });
      await create.execute({ title: "Segundo" });
      const update = new UpdateEventUseCase(events);

      await expect(update.execute({ id: first.id, slug: "primero" })).resolves.toMatchObject({ slug: "primero" });
      await expect(update.execute({ id: first.id, slug: "segundo" })).rejects.toMatchObject({ field: "slug" });
    });

    it("throws NotFoundError for an unknown event", async () => {
      await expect(new UpdateEventUseCase(events).execute({ id: MISSING_ID, title: "x" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("SetEventPublishedUseCase", () => {
    it("publishes and unpublishes", async () => {
      const created = await new CreateEventUseCase(events).execute({ title: "Charla" });
      const setPublished = new SetEventPublishedUseCase(events);

      expect((await setPublished.execute({ id: created.id, isPublished: true })).isPublished).toBe(true);
      expect((await setPublished.execute({ id: created.id, isPublished: false })).isPublished).toBe(false);
    });

    it("throws NotFoundError for an unknown event", async () => {
      await expect(
        new SetEventPublishedUseCase(events).execute({ id: MISSING_ID, isPublished: true }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("DeleteEventUseCase", () => {
    let storage: InMemoryMediaStorage;

    beforeEach(() => {
      storage = new InMemoryMediaStorage();
    });

    async function eventWithPhotos(...publicIds: string[]) {
      const created = await new CreateEventUseCase(events).execute({ title: "Charla" });

      for (const publicId of publicIds) {
        await photos.add(
          EventPhoto.create({
            eventId: created.id,
            url: `https://img.test/${publicId}.jpg`,
            publicId,
            width: 1600,
            height: 900,
            alt: publicId,
            sortOrder: 0,
          }),
          12,
        );
      }

      return created;
    }

    it("deletes an existing event", async () => {
      const created = await eventWithPhotos();

      await new DeleteEventUseCase(events, photos, storage).execute({ id: created.id });

      expect(await events.getById(created.id)).toBeNull();
      expect(storage.destroyedPublicIds).toEqual([]);
    });

    it("destroys every stored image of the event, active or not, after the delete", async () => {
      const created = await eventWithPhotos("events/a", "events/b");
      const hidden = (await photos.listActiveByEventId(created.id))[1]!;
      await photos.update(hidden.deactivate());

      await new DeleteEventUseCase(events, photos, storage).execute({ id: created.id });

      expect([...storage.destroyedPublicIds].sort()).toEqual(["events/a", "events/b"]);
    });

    it("does not destroy anything when the delete itself fails", async () => {
      const created = await eventWithPhotos("events/a");
      events.delete = async () => {
        throw new Error("db down");
      };

      await expect(new DeleteEventUseCase(events, photos, storage).execute({ id: created.id })).rejects.toThrow(
        "db down",
      );
      expect(storage.destroyedPublicIds).toEqual([]);
    });

    it("still succeeds when storage cleanup fails, logging the publicIds left behind", async () => {
      const created = await eventWithPhotos("events/a", "events/b");
      storage.destroyError = new Error("cloudinary down");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        new DeleteEventUseCase(events, photos, storage).execute({ id: created.id }),
      ).resolves.toBeUndefined();

      expect(await events.getById(created.id)).toBeNull();
      const logged = log.mock.calls.map((call) => String(call[0])).join("\n");
      expect(logged).toContain("events/a");
      expect(logged).toContain("events/b");
      log.mockRestore();
    });

    it("throws NotFoundError for an unknown event and destroys nothing", async () => {
      await expect(
        new DeleteEventUseCase(events, photos, storage).execute({ id: MISSING_ID }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(storage.destroyedPublicIds).toEqual([]);
    });
  });

  describe("ListEventsUseCase", () => {
    it("lists every event, drafts included, with its active photo count", async () => {
      const create = new CreateEventUseCase(events);
      const old = await create.execute({ title: "Viejo", date: "2025-01-10", isPublished: true });
      const draft = await create.execute({ title: "Borrador" });
      const next = await create.execute({ title: "Próximo", date: "2026-12-01" });
      const input = { eventId: old.id, url: "https://img.test/a.jpg", width: 1600, height: 900, alt: "Foto" };
      await photos.add(EventPhoto.create({ ...input, publicId: "a", sortOrder: 0 }), 12);
      await photos.add(EventPhoto.create({ ...input, publicId: "b", sortOrder: 1 }).deactivate(), 12);

      const result = await new ListEventsUseCase(events, photos).execute();

      expect(result.map((item) => [item.id, item.photoCount, item.isPublished])).toEqual([
        [next.id, 0, false],
        [old.id, 1, true],
        [draft.id, 0, false],
      ]);
    });
  });

  describe("GetEventUseCase", () => {
    it("returns the event with its active photos in order", async () => {
      const created = await new CreateEventUseCase(events).execute({ title: "Charla" });
      const base = { eventId: created.id, url: "https://img.test/a.jpg", width: 1600, height: 900, alt: "Foto" };
      const b = await photos.add(EventPhoto.create({ ...base, publicId: "b", sortOrder: 0 }), 12);
      const a = await photos.add(EventPhoto.create({ ...base, publicId: "a", sortOrder: 0 }), 12);
      await photos.saveOrder(created.id, [a.props.id, b.props.id]);

      const result = await new GetEventUseCase(events, photos).execute({ id: created.id });

      expect(result.title).toBe("Charla");
      expect(result.photos.map((photo) => photo.publicId)).toEqual(["a", "b"]);
    });

    it("throws NotFoundError for an unknown event", async () => {
      await expect(new GetEventUseCase(events, photos).execute({ id: MISSING_ID })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
