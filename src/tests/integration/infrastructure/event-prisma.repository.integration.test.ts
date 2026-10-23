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

/** Waits until `count` backends are blocked on a row lock (the barrier above). */
async function waitForLockWaiters(count: number): Promise<void> {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const [row] = await prisma.$queryRaw<{ waiting: bigint }[]>`
      SELECT count(*) AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `;

    if (Number(row?.waiting ?? 0) >= count) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for ${count} lock waiters`);
}

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
    const first = photoFor(eventId, "first", 0);
    const second = photoFor(eventId, "second", 0);
    const hidden = photoFor(eventId, "hidden", 0);
    await repository.add(first, 12);
    await repository.add(second, 12);
    await repository.add(hidden, 12);
    await repository.update((await repository.getById(hidden.props.id))!.deactivate());

    const list = await repository.listActiveByEventId(eventId);

    expect(list.map((photo) => photo.props.publicId)).toEqual(["first", "second"]);
  });

  it("appends each photo after the last active one, ignoring the caller's sortOrder", async () => {
    const eventId = await newEvent();

    const a = await repository.add(photoFor(eventId, "a", 7), 12);
    const b = await repository.add(photoFor(eventId, "b", 0), 12);
    await repository.update(b.deactivate());
    const c = await repository.add(photoFor(eventId, "c", 0), 12);

    expect([a.props.sortOrder, b.props.sortOrder, c.props.sortOrder]).toEqual([0, 1, 1]);
    expect((await repository.getById(c.props.id))?.props.sortOrder).toBe(1);
  });

  it("lists every stored publicId of an event, active or not", async () => {
    const eventId = await newEvent();
    const other = await newEvent();
    const hidden = await repository.add(photoFor(eventId, "hidden", 0), 12);
    await repository.update(hidden.deactivate());
    await repository.add(photoFor(eventId, "shown", 0), 12);
    await repository.add(photoFor(other, "foreign", 0), 12);

    expect([...(await repository.listPublicIdsByEventId(eventId))].sort()).toEqual(["hidden", "shown"]);
    expect(await repository.listPublicIdsByEventId(MISSING_ID)).toEqual([]);
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

  it("holds the cap and gives distinct positions under concurrent adds", async () => {
    const eventId = await newEvent();
    const contenders = 5;

    // Barrier: a holder transaction takes the event row lock first, every add
    // is launched and observed blocked on that lock, and only then is the
    // holder released, so all adds really race for the same lock.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
        locked();
        await gate;
      },
      { timeout: 15_000 },
    );
    await lockTaken;

    const adds = Array.from({ length: contenders }, (_, i) =>
      repository.add(photoFor(eventId, `c${i}`, 0), 3).then(
        (photo) => ({ ok: true as const, photo }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    );
    await waitForLockWaiters(contenders);
    release();
    await holder;
    const results = await Promise.all(adds);

    const added = results.flatMap((result) => (result.ok ? [result.photo] : []));
    expect(added).toHaveLength(3);
    expect(added.map((photo) => photo.props.sortOrder).sort()).toEqual([0, 1, 2]);
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
