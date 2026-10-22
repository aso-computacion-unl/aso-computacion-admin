import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Event } from "@/domain/event";
import { EventPhoto } from "@/domain/event-photo";
import { prisma } from "@/infrastructure/prisma/client";
import { EventPhotoPrismaRepository } from "@/infrastructure/repositories/event-photo-prisma.repository";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

describe("EventPrismaRepository (integration)", () => {
  const repository = new EventPrismaRepository();

  it("round-trips every field, including the calendar date and ordered highlights", async () => {
    const event = Event.create({
      title: "Hackatón 24h",
      description: "Un día entero de código",
      date: "2026-11-28",
      type: "evento",
      commitMessage: "feat: hackatón 24h",
      hora: "09:00",
      lugar: "Laboratorio 2",
      para: "todos los ciclos",
      featured: true,
      linkUrl: "https://aso.test/hackaton",
      linkLabel: "Inscribirme",
      highlights: ["Apertura", "Retos", "Premiación"],
      isPublished: true,
    });

    await repository.create(event);
    const found = await repository.getById(event.props.id);

    expect(found?.props).toEqual(event.props);
  });

  it("stores the date as a plain calendar day regardless of the process time zone", async () => {
    const event = Event.create({ title: "Charla", date: "2026-03-01" });

    await repository.create(event);

    const [row] = await prisma.$queryRaw<{ date: string }[]>`SELECT "date"::text AS date FROM "Event"`;
    expect(row?.date).toBe("2026-03-01");
  });

  it("returns null for an unknown id", async () => {
    expect(await repository.getById(MISSING_ID)).toBeNull();
  });

  it("list returns drafts too: date descending, undated last, then newest first", async () => {
    const old = await repository.create(Event.create({ title: "Viejo", date: "2025-01-10" }));
    const next = await repository.create(Event.create({ title: "Próximo", date: "2026-12-01" }));
    const undatedOld = await repository.create(Event.create({ title: "Sin fecha uno" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const undatedNew = await repository.create(Event.create({ title: "Sin fecha dos" }));

    const ids = (await repository.list()).map((event) => event.props.id);

    expect(ids).toEqual([next, old, undatedNew, undatedOld].map((event) => event.props.id));
  });

  it("updates an event, keeping its id and creation time", async () => {
    const created = await repository.create(Event.create({ title: "Original" }));

    const updated = await repository.update(created.update({ title: "Nuevo", isPublished: true, highlights: ["Uno"] }));

    expect(updated.props).toMatchObject({ title: "Nuevo", isPublished: true, highlights: ["Uno"], id: created.props.id });
    expect(updated.props.createdAt).toEqual(created.props.createdAt);
  });

  it("throws NotFoundError when updating or deleting an unknown event", async () => {
    await expect(repository.update(Event.create({ title: "Fantasma" }))).rejects.toThrow("Event not found");
    await expect(repository.delete(MISSING_ID)).rejects.toThrow("Event not found");
  });

  it("slugExists ignores the excluded event", async () => {
    const event = await repository.create(Event.create({ title: "Taller de Git" }));

    expect(await repository.slugExists("taller-de-git")).toBe(true);
    expect(await repository.slugExists("taller-de-git", event.props.id)).toBe(false);
    expect(await repository.slugExists("otro")).toBe(false);
  });

  it("maps a slug collision to a slug validation error", async () => {
    await repository.create(Event.create({ title: "Uno", slug: "mismo" }));

    await expect(repository.create(Event.create({ title: "Dos", slug: "mismo" }))).rejects.toMatchObject({
      name: "ValidationError",
      field: "slug",
    });
  });

  it("deleting an event cascades to its photo rows", async () => {
    const event = await repository.create(Event.create({ title: "Charla" }));
    await new EventPhotoPrismaRepository().add(photoFor(event.props.id, "a", 0), 12);

    await repository.delete(event.props.id);

    expect(await prisma.eventPhoto.count()).toBe(0);
  });
});

function photoFor(eventId: string, publicId: string, sortOrder: number): EventPhoto {
  return EventPhoto.create({
    eventId,
    url: `https://img.test/${publicId}.jpg`,
    publicId,
    width: 1600,
    height: 900,
    alt: `Foto ${publicId}`,
    sortOrder,
  });
}

describe("EventPhotoPrismaRepository (integration)", () => {
  const events = new EventPrismaRepository();
  const repository = new EventPhotoPrismaRepository();

  async function newEvent() {
    return (await events.create(Event.create({ title: `Evento ${crypto.randomUUID()}` }))).props.id;
  }

  it("adds a photo and reads it back by id", async () => {
    const eventId = await newEvent();
    const photo = photoFor(eventId, "a", 0);

    await repository.add(photo, 12);

    expect((await repository.getById(photo.props.id))?.props).toEqual(photo.props);
    expect(await repository.getById(MISSING_ID)).toBeNull();
  });

  it("lists only active photos in gallery order", async () => {
    const eventId = await newEvent();
    const second = photoFor(eventId, "second", 1);
    const first = photoFor(eventId, "first", 0);
    const hidden = photoFor(eventId, "hidden", 2);
    await repository.add(second, 12);
    await repository.add(first, 12);
    await repository.add(hidden, 12);
    await repository.update(hidden.deactivate());

    const list = await repository.listActiveByEventId(eventId);

    expect(list.map((photo) => photo.props.publicId)).toEqual(["first", "second"]);
  });

  it("counts active photos per event, leaving out events with none", async () => {
    const [one, two, empty] = [await newEvent(), await newEvent(), await newEvent()];
    await repository.add(photoFor(one, "a", 0), 12);
    await repository.add(photoFor(one, "b", 1), 12);
    const hidden = photoFor(two, "c", 0);
    await repository.add(hidden, 12);
    await repository.update(hidden.deactivate());

    const counts = await repository.countActiveByEventIds([one, two, empty]);

    expect(counts.get(one)).toBe(2);
    expect(counts.get(two) ?? 0).toBe(0);
    expect(counts.get(empty) ?? 0).toBe(0);
    expect((await repository.countActiveByEventIds([])).size).toBe(0);
  });

  it("refuses a photo beyond the cap, counting only active ones", async () => {
    const eventId = await newEvent();
    const first = photoFor(eventId, "p0", 0);
    await repository.add(first, 2);
    await repository.add(photoFor(eventId, "p1", 1), 2);

    await expect(repository.add(photoFor(eventId, "p2", 2), 2)).rejects.toMatchObject({
      name: "ValidationError",
      field: "photos",
    });

    await repository.update(first.deactivate());
    await expect(repository.add(photoFor(eventId, "p3", 3), 2)).resolves.toBeDefined();
  });

  it("holds the cap under concurrent adds", async () => {
    const eventId = await newEvent();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => repository.add(photoFor(eventId, `c${i}`, i), 3)),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(await prisma.eventPhoto.count({ where: { eventId, isActive: true } })).toBe(3);
  });

  it("throws NotFoundError when the event does not exist", async () => {
    await expect(repository.add(photoFor(MISSING_ID, "a", 0), 12)).rejects.toThrow("Event not found");
  });

  it("updates alt and activity of an existing photo, and fails for an unknown one", async () => {
    const eventId = await newEvent();
    const photo = photoFor(eventId, "a", 0);
    await repository.add(photo, 12);

    const updated = await repository.update(photo.withAlt("Otra descripción").deactivate());

    expect(updated.props).toMatchObject({ alt: "Otra descripción", isActive: false });
    await expect(repository.update(photoFor(eventId, "ghost", 0))).rejects.toThrow("Event photo not found");
  });

  it("saveOrder rewrites sortOrder to the given sequence and ignores photos of other events", async () => {
    const eventId = await newEvent();
    const otherEventId = await newEvent();
    const [a, b, c] = ["a", "b", "c"].map((id, i) => photoFor(eventId, id, i));
    const foreign = photoFor(otherEventId, "foreign", 0);
    for (const photo of [a!, b!, c!, foreign]) await repository.add(photo, 12);

    await repository.saveOrder(eventId, [c!.props.id, a!.props.id, b!.props.id, foreign.props.id]);

    const list = await repository.listActiveByEventId(eventId);
    expect(list.map((photo) => [photo.props.publicId, photo.props.sortOrder])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
    expect((await repository.getById(foreign.props.id))?.props.sortOrder).toBe(0);
  });
});
