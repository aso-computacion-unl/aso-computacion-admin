import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PURGE_BATCH_SIZE, PurgeExpiredRegistrationsUseCase } from "@/application/event-registration/purge-expired-registrations.use-case";
import { Event, type CreateEventInput } from "@/domain/event";
import { prisma } from "@/infrastructure/prisma/client";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";
import { EventRegistrationRetentionPrismaStore } from "@/infrastructure/repositories/event-registration-retention-prisma.store";
import { ForumCategoryPrismaRepository } from "@/infrastructure/repositories/forum-category-prisma.repository";
import { ForumMemberPrismaRepository } from "@/infrastructure/repositories/forum-member-prisma.repository";
import { makeForumCategory, makeForumMember } from "@/tests/fakes/in-memory-forum";

// An event on 2026-01-10 expires its registrations at 2026-04-11T05:00:00Z.
const EXPIRY = new Date("2026-04-11T05:00:00.000Z");

const events = new EventPrismaRepository();
const purge = new PurgeExpiredRegistrationsUseCase(new EventRegistrationRetentionPrismaStore());
let sequence = 0;

async function addEvent(overrides: Partial<CreateEventInput> = {}) {
  sequence += 1;

  return (await events.create(Event.create({ title: `Evento ${sequence}`, date: "2026-01-10", isPublished: true, registrationMode: "open", ...overrides }))).props;
}

async function addPeople(eventId: string, count: number) {
  const base = sequence;

  sequence += count;
  await prisma.eventRegistration.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      id: `reg-${base + index}`,
      eventId,
      mode: "open" as const,
      name: `Persona ${base + index}`,
      email: `persona${base + index}@example.com`,
      career: "Computación",
      semester: 3,
      createdAt: new Date("2025-12-01T00:00:00Z"),
    })),
  });
}

const remaining = (eventId: string) => prisma.eventRegistration.count({ where: { eventId } });

describe("registration retention purge (integration)", () => {
  it("deletes exactly at 90 days after the event ends and not a millisecond before", async () => {
    const event = await addEvent();

    await addPeople(event.id, 3);

    expect(await purge.execute(new Date(EXPIRY.getTime() - 1))).toEqual({ deleted: 0 });
    expect(await remaining(event.id)).toBe(3);

    expect(await purge.execute(EXPIRY)).toEqual({ deleted: 3 });
    expect(await remaining(event.id)).toBe(0);
  });

  it("keeps the registrations of events newer than 90 days, of future events and of undated ones, and only deletes the expired ones", async () => {
    const expired = await addEvent({ date: "2025-06-01" });
    const recent = await addEvent({ date: "2026-02-20" });
    const dayBefore = await addEvent({ date: "2026-01-11" });
    const future = await addEvent({ date: "2099-01-01" });
    const undated = await addEvent({ date: null });

    for (const event of [expired, recent, dayBefore, future, undated]) {
      await addPeople(event.id, 2);
    }

    expect(await purge.execute(EXPIRY)).toEqual({ deleted: 2 });
    expect([await remaining(expired.id), await remaining(recent.id), await remaining(dayBefore.id), await remaining(future.id), await remaining(undated.id)]).toEqual([0, 2, 2, 2, 2]);
  });

  it("reads a month-precision event as ending with its month", async () => {
    const event = await addEvent({ date: "2026-01-01", datePrecision: "month" });

    await addPeople(event.id, 1);

    expect(await purge.execute(EXPIRY)).toEqual({ deleted: 0 });
    expect(await purge.execute(new Date("2026-05-02T05:00:00.000Z"))).toEqual({ deleted: 1 });
  });

  it("also purges an expired event that is in the trash", async () => {
    const event = await addEvent();

    await addPeople(event.id, 2);
    await events.trash(event.id);

    expect(await purge.execute(EXPIRY)).toEqual({ deleted: 2 });
    expect(await prisma.event.count({ where: { id: event.id } })).toBe(1);
  });

  it("touches no other table: events, photos and forum data are all still there", async () => {
    const event = await addEvent();

    await prisma.eventPhoto.create({ data: { id: "photo-1", eventId: event.id, url: "https://res.cloudinary.test/a.jpg", publicId: "a", width: 10, height: 10, alt: "a", sortOrder: 1 } });
    await new ForumMemberPrismaRepository().create(makeForumMember({ id: "ana", email: "ana@unl.edu.ec", googleSub: "sub-ana", displayName: "Ana" }));
    await new ForumCategoryPrismaRepository().create(makeForumCategory({ id: "c1", slug: "programacion", sortOrder: 1 }));
    await addPeople(event.id, 2);

    const before = await Promise.all([prisma.event.count(), prisma.eventPhoto.count(), prisma.forumMember.count(), prisma.forumCategory.count()]);

    expect(await purge.execute(EXPIRY)).toEqual({ deleted: 2 });
    expect(await Promise.all([prisma.event.count(), prisma.eventPhoto.count(), prisma.forumMember.count(), prisma.forumCategory.count()])).toEqual(before);
  });

  it("is idempotent, and two runs at the same time delete each row once", async () => {
    const event = await addEvent();

    await addPeople(event.id, 5);

    const runs = await Promise.all([purge.execute(EXPIRY), purge.execute(EXPIRY)]);

    expect(runs.reduce((sum, run) => sum + run.deleted, 0)).toBe(5);
    expect(await purge.execute(EXPIRY)).toEqual({ deleted: 0 });
  });

  it("deletes a backlog bigger than one batch in several batches", async () => {
    const event = await addEvent();

    await addPeople(event.id, PURGE_BATCH_SIZE + 7);

    expect(await purge.execute(EXPIRY)).toEqual({ deleted: PURGE_BATCH_SIZE + 7 });
    expect(await remaining(event.id)).toBe(0);
  });
});
