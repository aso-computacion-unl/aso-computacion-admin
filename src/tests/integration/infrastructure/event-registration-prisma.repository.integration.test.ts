import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { NewEventRegistration } from "@/application/ports/event-registration-repository.port";
import { Event, type CreateEventInput } from "@/domain/event";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";
import { EventRegistrationPrismaRepository } from "@/infrastructure/repositories/event-registration-prisma.repository";

const NOW = new Date("2026-11-20T15:00:00.000Z");

describe("EventRegistrationPrismaRepository (integration)", () => {
  const events = new EventPrismaRepository();
  const registrations = new EventRegistrationPrismaRepository();
  let sequence = 0;

  async function addEvent(overrides: Partial<CreateEventInput> = {}) {
    const event = Event.create({ title: "Taller de Git", date: "2026-11-28", isPublished: true, registrationMode: "open", ...overrides });

    return (await events.create(event)).props;
  }

  const person = (eventId: string, overrides: Partial<NewEventRegistration> = {}): NewEventRegistration => {
    sequence += 1;

    return { id: `r-${sequence}`, eventId, mode: "open", name: `Persona ${sequence}`, email: `persona${sequence}@example.com`, career: "Computación", semester: 3, ...overrides };
  };

  it("round-trips the registration settings of an event and finds a live event by slug", async () => {
    const deadline = new Date("2026-11-27T23:30:00.123Z");
    const event = await addEvent({ registrationMode: "unl", registrationCapacity: 25, registrationDeadline: deadline });

    expect((await events.findLiveBySlug("taller-de-git"))?.props).toEqual(event);
    expect(event).toMatchObject({ registrationMode: "unl", registrationCapacity: 25, registrationDeadline: deadline });

    await events.update(Event.reconstitute(event).update({ registrationMode: "none" }));

    expect((await events.findLiveBySlug("taller-de-git"))?.props).toMatchObject({ registrationMode: "none", registrationCapacity: null, registrationDeadline: null });
    expect(await events.findLiveBySlug("otro")).toBeNull();
  });

  it("stores a registration and lists it oldest first", async () => {
    const event = await addEvent();
    const first = person(event.id, { name: "Ana" });
    const second = person(event.id, { name: "Luis" });

    expect((await registrations.register(first, NOW)).status).toBe("registered");
    expect((await registrations.register(second, new Date(NOW.getTime() + 1000))).status).toBe("registered");

    expect((await registrations.list(event.id)).map((row) => row.name)).toEqual(["Ana", "Luis"]);
    expect(await registrations.count(event.id)).toBe(2);
    expect(await registrations.exists(event.id, first.email)).toBe(true);
  });

  it("gives the last seat to exactly one of many people who ask at the same moment", async () => {
    const event = await addEvent({ registrationCapacity: 3 });

    const outcomes = await Promise.all(Array.from({ length: 12 }, () => registrations.register(person(event.id), NOW)));
    const statuses = outcomes.map((outcome) => outcome.status);

    expect(statuses.filter((status) => status === "registered")).toHaveLength(3);
    expect(statuses.filter((status) => status === "full")).toHaveLength(9);
    expect(await registrations.count(event.id)).toBe(3);
  });

  it("stores one registration when the same email is sent several times at once", async () => {
    const event = await addEvent();
    const email = "ana@example.com";

    const outcomes = await Promise.all(Array.from({ length: 6 }, () => registrations.register(person(event.id, { email }), NOW)));

    expect(outcomes.filter((outcome) => outcome.status === "registered")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "duplicate")).toHaveLength(5);
    expect(await registrations.count(event.id)).toBe(1);
  });

  it("refuses a duplicate, a closed deadline and a wrong mode without touching what is stored", async () => {
    const event = await addEvent({ registrationDeadline: new Date("2026-11-21T00:00:00.000Z") });
    const first = person(event.id, { name: "Ana", email: "ana@example.com" });
    await registrations.register(first, NOW);
    const [stored] = await registrations.list(event.id);

    expect(await registrations.register(person(event.id, { email: "ana@example.com", name: "Otra", semester: 9 }), NOW)).toEqual({ status: "duplicate" });
    expect(await registrations.register(person(event.id), new Date("2026-11-21T00:00:00.000Z"))).toEqual({ status: "closed" });
    expect(await registrations.register(person(event.id, { mode: "unl", career: null, semester: null }), NOW)).toEqual({ status: "mode_mismatch" });
    expect(await registrations.list(event.id)).toEqual([stored]);
  });

  it("does not register for a draft, a missing or a trashed event", async () => {
    const draft = await addEvent({ title: "Borrador", isPublished: false });
    const trashed = await addEvent({ title: "Papelera" });
    await events.trash(trashed.id);

    expect(await registrations.register(person(draft.id), NOW)).toEqual({ status: "not_found" });
    expect(await registrations.register(person(trashed.id), NOW)).toEqual({ status: "not_found" });
    expect(await registrations.register(person("00000000-0000-0000-0000-000000000000"), NOW)).toEqual({ status: "not_found" });
  });

  it("deletes a registration of that event only, which frees its seat", async () => {
    const event = await addEvent({ registrationCapacity: 1 });
    const other = await addEvent({ title: "Otro taller" });
    const first = person(event.id);
    await registrations.register(first, NOW);

    expect(await registrations.delete(other.id, first.id)).toBe(false);
    expect(await registrations.count(event.id)).toBe(1);
    expect(await registrations.delete(event.id, first.id)).toBe(true);
    expect(await registrations.delete(event.id, first.id)).toBe(false);
    expect((await registrations.register(person(event.id), NOW)).status).toBe("registered");
  });
});
