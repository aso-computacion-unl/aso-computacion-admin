import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { NewEventRegistration } from "@/application/ports/event-registration-repository.port";
import { Event, type CreateEventInput } from "@/domain/event";
import { REGISTRATION_CONFIRMATION_TTL_MS } from "@/domain/event-registration";
import { prisma } from "@/infrastructure/prisma/client";
import { EventPrismaRepository } from "@/infrastructure/repositories/event-prisma.repository";
import { EventRegistrationPrismaRepository } from "@/infrastructure/repositories/event-registration-prisma.repository";

const NOW = new Date("2026-11-20T15:00:00.000Z");

const HOUR = 60 * 60 * 1000;

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

    return {
      id: `r-${sequence}`,
      eventId,
      mode: "open",
      name: `Persona ${sequence}`,
      email: `persona${sequence}@example.com`,
      institution: "Universidad Nacional de Loja",
      career: "Computación",
      semester: 3,
      confirmedAt: NOW,
      ...overrides,
    };
  };
  const pendingPerson = (eventId: string, overrides: Partial<NewEventRegistration> = {}) => person(eventId, { confirmedAt: null, ...overrides });

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

  it("counts the registrations of many events in one call, leaving out the events nobody joined", async () => {
    const busy = await addEvent({ title: "Con inscritos" });
    const quiet = await addEvent({ title: "Sin inscritos" });
    const other = await addEvent({ title: "Fuera de la consulta" });

    for (const [event, times] of [[busy, 2], [other, 1]] as const) {
      for (let index = 0; index < times; index += 1) await registrations.register(person(event.id), NOW);
    }

    expect(await registrations.countByEvents([busy.id, quiet.id])).toEqual(new Map([[busy.id, 2]]));
    expect(await registrations.countByEvents([])).toEqual(new Map());
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
    expect(await registrations.register(person(event.id, { mode: "unl", institution: null, career: null, semester: null }), NOW)).toEqual({ status: "mode_mismatch" });
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

  describe("pending registrations (email not yet confirmed)", () => {
    it("leave a pending row out of count, countByEvents, exists and list, while a confirmed one counts", async () => {
      const event = await addEvent();
      const quiet = await addEvent({ title: "Solo pendientes" });
      const confirmed = person(event.id, { name: "Confirmada" });
      const pending = pendingPerson(event.id, { name: "Pendiente" });

      await registrations.register(confirmed, NOW);
      expect(await registrations.register(pending, NOW)).toMatchObject({ status: "registered", registration: { id: pending.id, confirmedAt: null } });
      await registrations.register(pendingPerson(quiet.id), NOW);

      expect(await registrations.count(event.id)).toBe(1);
      expect(await registrations.count(quiet.id)).toBe(0);
      expect(await registrations.countByEvents([event.id, quiet.id])).toEqual(new Map([[event.id, 1]]));
      expect(await registrations.exists(event.id, confirmed.email)).toBe(true);
      expect(await registrations.exists(event.id, pending.email)).toBe(false);
      expect((await registrations.list(event.id)).map((row) => row.name)).toEqual(["Confirmada"]);
      expect(await registrations.list(quiet.id)).toEqual([]);
    });

    it("does not let pending rows use up the capacity", async () => {
      const event = await addEvent({ registrationCapacity: 1 });

      for (let index = 0; index < 4; index += 1) await registrations.register(pendingPerson(event.id), NOW);

      expect((await registrations.register(person(event.id), NOW)).status).toBe("registered");
      expect(await registrations.register(person(event.id), NOW)).toEqual({ status: "full" });
    });

    it("refreshes a pending row asked for again with the same email: same id, new data, new window, still one row", async () => {
      const event = await addEvent();
      const first = pendingPerson(event.id, { name: "Ana", email: "ana@example.com", institution: "ESPOL", career: null, semester: null });
      const later = new Date(NOW.getTime() + 5 * HOUR);

      await registrations.register(first, NOW);
      const outcome = await registrations.register(pendingPerson(event.id, { name: "Ana María", email: "ana@example.com", institution: "UTPL", career: "Derecho", semester: 4 }), later);

      expect(outcome).toMatchObject({
        status: "registered",
        registration: { id: first.id, name: "Ana María", institution: "UTPL", career: "Derecho", semester: 4, createdAt: later, confirmedAt: null },
      });
      expect(await prisma.eventRegistration.findMany({ where: { eventId: event.id } })).toEqual([
        expect.objectContaining({ id: first.id, name: "Ana María", institution: "UTPL", createdAt: later, confirmedAt: null }),
      ]);
    });

    it("stores one pending row when the same email is sent several times at once", async () => {
      const event = await addEvent();
      const email = "ana@example.com";

      const outcomes = await Promise.all(Array.from({ length: 6 }, () => registrations.register(pendingPerson(event.id, { email }), NOW)));

      expect(outcomes.every((outcome) => outcome.status === "registered")).toBe(true);
      expect(new Set(outcomes.map((outcome) => (outcome.status === "registered" ? outcome.registration.id : null))).size).toBe(1);
      expect(await prisma.eventRegistration.count({ where: { eventId: event.id } })).toBe(1);
    });

    it("refuses the same email as a duplicate once it is confirmed, leaving the confirmed row as it was", async () => {
      const event = await addEvent();
      const confirmed = person(event.id, { name: "Ana", email: "ana@example.com" });

      await registrations.register(confirmed, NOW);
      const [stored] = await registrations.list(event.id);

      expect(await registrations.register(pendingPerson(event.id, { name: "Intrusa", email: "ana@example.com" }), NOW)).toEqual({ status: "duplicate" });
      expect(await registrations.register(person(event.id, { name: "Intrusa", email: "ana@example.com" }), NOW)).toEqual({ status: "duplicate" });
      expect(await registrations.list(event.id)).toEqual([stored]);
    });
  });

  describe("the link of the latest attempt (D9)", () => {
    const LATER = new Date(NOW.getTime() + HOUR);
    const CONFIRM_AT = new Date(NOW.getTime() + 2 * HOUR);

    it("stores the nonce beside the row, never in the record, and replaces it when the pending email registers again", async () => {
      const event = await addEvent({ registrationCapacity: 2 });
      const first = pendingPerson(event.id, { email: "ana@example.com", confirmNonce: "attempt-1" });

      const stored = await registrations.register(first, NOW);

      expect(await prisma.eventRegistration.findUnique({ where: { id: first.id } })).toMatchObject({ confirmNonce: "attempt-1" });
      expect(JSON.stringify(stored)).not.toContain("attempt-1");

      await registrations.register(pendingPerson(event.id, { email: "ana@example.com", confirmNonce: "attempt-2" }), LATER);

      expect(await prisma.eventRegistration.findMany({ where: { eventId: event.id } })).toEqual([expect.objectContaining({ id: first.id, confirmNonce: "attempt-2" })]);
    });

    it("refuses the link of an earlier attempt as invalid, leaves the row pending and untouched, and then confirms with the newest", async () => {
      const event = await addEvent({ registrationCapacity: 2 });
      const first = pendingPerson(event.id, { email: "ana@example.com", confirmNonce: "attempt-1" });

      await registrations.register(first, NOW);
      await registrations.register(pendingPerson(event.id, { email: "ana@example.com", confirmNonce: "attempt-2" }), LATER);

      const before = await prisma.eventRegistration.findUnique({ where: { id: first.id } });

      expect(await registrations.confirm(event.id, first.id, CONFIRM_AT, "attempt-1")).toEqual({ status: "invalid" });
      expect(await registrations.confirm(event.id, first.id, CONFIRM_AT, null)).toEqual({ status: "invalid" });
      expect(await registrations.confirm(event.id, first.id, CONFIRM_AT)).toEqual({ status: "invalid" });
      expect(await prisma.eventRegistration.findUnique({ where: { id: first.id } })).toEqual(before);
      expect(await registrations.count(event.id)).toBe(0);

      expect(await registrations.confirm(event.id, first.id, CONFIRM_AT, "attempt-2")).toMatchObject({ status: "confirmed", registration: { id: first.id, confirmedAt: CONFIRM_AT } });
      expect(await registrations.count(event.id)).toBe(1);
    });

    it("answers an earlier attempt's link invalid even after the row is confirmed, and the current one already_confirmed", async () => {
      const event = await addEvent();
      const first = pendingPerson(event.id, { email: "ana@example.com", confirmNonce: "attempt-1" });

      await registrations.register(first, NOW);
      await registrations.register(pendingPerson(event.id, { email: "ana@example.com", confirmNonce: "attempt-2" }), LATER);
      await registrations.confirm(event.id, first.id, CONFIRM_AT, "attempt-2");

      expect(await registrations.confirm(event.id, first.id, CONFIRM_AT, "attempt-1")).toEqual({ status: "invalid" });
      expect(await registrations.confirm(event.id, first.id, CONFIRM_AT, "attempt-2")).toMatchObject({ status: "already_confirmed" });
    });

    it("keeps a pending row from before the column (null nonce) confirmable by a link that names none, until it registers again", async () => {
      const event = await addEvent({ registrationCapacity: 2 });
      const legacy = pendingPerson(event.id, { email: "ana@example.com" });
      const other = pendingPerson(event.id, { email: "luis@example.com" });

      await registrations.register(legacy, NOW);
      await registrations.register(other, NOW);

      expect(await registrations.confirm(event.id, legacy.id, CONFIRM_AT, null)).toMatchObject({ status: "confirmed" });

      await registrations.register(pendingPerson(event.id, { email: "luis@example.com", confirmNonce: "attempt-1" }), LATER);

      expect(await registrations.confirm(event.id, other.id, CONFIRM_AT, null)).toEqual({ status: "invalid" });
      expect(await registrations.confirm(event.id, other.id, CONFIRM_AT, "attempt-1")).toMatchObject({ status: "confirmed" });
    });
  });

  describe("confirm", () => {
    const CONFIRMED_AT = new Date(NOW.getTime() + 2 * HOUR);

    it("confirms a pending row: it takes the seat and shows up in count, exists and list", async () => {
      const event = await addEvent({ registrationCapacity: 2 });
      const pending = pendingPerson(event.id, { name: "Ana" });

      await registrations.register(pending, NOW);
      const outcome = await registrations.confirm(event.id, pending.id, CONFIRMED_AT);

      expect(outcome).toMatchObject({ status: "confirmed", registration: { id: pending.id, name: "Ana", confirmedAt: CONFIRMED_AT, createdAt: NOW } });
      expect(await registrations.count(event.id)).toBe(1);
      expect(await registrations.exists(event.id, pending.email)).toBe(true);
      expect((await registrations.list(event.id)).map((row) => row.id)).toEqual([pending.id]);
    });

    it("answers already_confirmed for a confirmed row, however it got confirmed, without changing it", async () => {
      const event = await addEvent();
      const pending = pendingPerson(event.id);
      const direct = person(event.id);

      await registrations.register(pending, NOW);
      await registrations.confirm(event.id, pending.id, CONFIRMED_AT);
      await registrations.register(direct, NOW);

      expect(await registrations.confirm(event.id, pending.id, new Date(CONFIRMED_AT.getTime() + HOUR))).toMatchObject({
        status: "already_confirmed",
        registration: { id: pending.id, confirmedAt: CONFIRMED_AT },
      });
      expect(await registrations.confirm(event.id, direct.id, CONFIRMED_AT)).toMatchObject({ status: "already_confirmed", registration: { id: direct.id, confirmedAt: NOW } });
      expect(await registrations.count(event.id)).toBe(2);
    });

    it("keeps a confirmed seat confirmed even after the event filled up or closed", async () => {
      const event = await addEvent({ registrationCapacity: 1, registrationDeadline: new Date("2026-11-21T00:00:00.000Z") });
      const pending = pendingPerson(event.id);

      await registrations.register(pending, NOW);
      await registrations.confirm(event.id, pending.id, NOW);

      expect(await registrations.confirm(event.id, pending.id, new Date("2026-11-22T00:00:00.000Z"))).toMatchObject({ status: "already_confirmed" });
    });

    it("expires exactly 48 h after the pending row was stored and not a millisecond before; a refresh restarts the window", async () => {
      const event = await addEvent();
      const pending = pendingPerson(event.id, { email: "ana@example.com" });
      const deadline = new Date(NOW.getTime() + REGISTRATION_CONFIRMATION_TTL_MS);

      await registrations.register(pending, NOW);

      expect(await registrations.confirm(event.id, pending.id, deadline)).toEqual({ status: "expired" });
      expect(await registrations.count(event.id)).toBe(0);

      await registrations.register(pendingPerson(event.id, { email: "ana@example.com" }), deadline);

      expect(await registrations.confirm(event.id, pending.id, new Date(deadline.getTime() + REGISTRATION_CONFIRMATION_TTL_MS - 1))).toMatchObject({ status: "confirmed" });
    });

    it("answers invalid for an unknown id and for an id that belongs to another event, leaving both rows untouched", async () => {
      const event = await addEvent();
      const other = await addEvent({ title: "Otro taller" });
      const pending = pendingPerson(other.id);

      await registrations.register(pending, NOW);

      expect(await registrations.confirm(event.id, "no-such-id", NOW)).toEqual({ status: "invalid" });
      expect(await registrations.confirm(event.id, pending.id, NOW)).toEqual({ status: "invalid" });
      expect(await prisma.eventRegistration.findUnique({ where: { id: pending.id } })).toMatchObject({ confirmedAt: null });
    });

    it("answers invalid for a trashed or missing event", async () => {
      const trashed = await addEvent({ title: "Papelera" });
      const pending = pendingPerson(trashed.id);

      await registrations.register(pending, NOW);
      await events.trash(trashed.id);

      expect(await registrations.confirm(trashed.id, pending.id, NOW)).toEqual({ status: "invalid" });
      expect(await registrations.confirm("00000000-0000-0000-0000-000000000000", "x", NOW)).toEqual({ status: "invalid" });
    });

    it("answers full when the seats went to others meanwhile, and the row stays pending (not deleted, not confirmed)", async () => {
      const event = await addEvent({ registrationCapacity: 1 });
      const late = pendingPerson(event.id);

      await registrations.register(late, NOW);
      await registrations.register(person(event.id), NOW);

      expect(await registrations.confirm(event.id, late.id, CONFIRMED_AT)).toEqual({ status: "full" });
      expect(await prisma.eventRegistration.findUnique({ where: { id: late.id } })).toMatchObject({ confirmedAt: null });
      expect(await registrations.count(event.id)).toBe(1);
    });

    it("answers closed after the deadline and the row stays pending", async () => {
      const event = await addEvent({ registrationDeadline: new Date("2026-11-21T00:00:00.000Z") });
      const pending = pendingPerson(event.id);

      await registrations.register(pending, NOW);

      expect(await registrations.confirm(event.id, pending.id, new Date("2026-11-21T00:00:00.000Z"))).toEqual({ status: "closed" });
      expect(await prisma.eventRegistration.findUnique({ where: { id: pending.id } })).toMatchObject({ confirmedAt: null });
      expect(await registrations.count(event.id)).toBe(0);
    });

    it("gives the last seat to exactly one of many pending people who confirm at the same moment", async () => {
      const event = await addEvent({ registrationCapacity: 3 });
      const people = Array.from({ length: 10 }, () => pendingPerson(event.id));

      for (const pending of people) await registrations.register(pending, NOW);

      const outcomes = await Promise.all(people.map((pending) => registrations.confirm(event.id, pending.id, CONFIRMED_AT)));
      const statuses = outcomes.map((outcome) => outcome.status);

      expect(statuses.filter((status) => status === "confirmed")).toHaveLength(3);
      expect(statuses.filter((status) => status === "full")).toHaveLength(7);
      expect(await registrations.count(event.id)).toBe(3);
    });

    it("confirming the same pending row twice at once seats one person once", async () => {
      const event = await addEvent({ registrationCapacity: 5 });
      const pending = pendingPerson(event.id);

      await registrations.register(pending, NOW);

      const outcomes = await Promise.all(Array.from({ length: 5 }, () => registrations.confirm(event.id, pending.id, CONFIRMED_AT)));

      expect(outcomes.filter((outcome) => outcome.status === "confirmed")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "already_confirmed")).toHaveLength(4);
      expect(await registrations.count(event.id)).toBe(1);
    });
  });

  describe("reminders", () => {
    const confirmed = (eventId: string, overrides: Partial<NewEventRegistration> = {}) => person(eventId, overrides);

    it("lists the confirmed people who have not been reminded, oldest first, up to the limit", async () => {
      const event = await addEvent();
      const first = confirmed(event.id, { name: "Primera" });
      const second = confirmed(event.id, { name: "Segunda" });
      const third = confirmed(event.id, { name: "Tercera" });

      await registrations.register(second, new Date(NOW.getTime() + 1000));
      await registrations.register(first, NOW);
      await registrations.register(third, new Date(NOW.getTime() + 2000));
      await registrations.register(pendingPerson(event.id, { name: "Pendiente" }), NOW);

      expect((await registrations.listDueForReminder(event.id, 10)).map((row) => row.name)).toEqual(["Primera", "Segunda", "Tercera"]);
      expect((await registrations.listDueForReminder(event.id, 2)).map((row) => row.name)).toEqual(["Primera", "Segunda"]);
      expect(await registrations.listDueForReminder(event.id, 0)).toEqual([]);
    });

    it("stops listing a person once their reminder is recorded, and records it once", async () => {
      const event = await addEvent();
      const ana = confirmed(event.id, { name: "Ana" });
      const sentAt = new Date(NOW.getTime() + HOUR);

      await registrations.register(ana, NOW);
      await registrations.register(confirmed(event.id, { name: "Luis" }), new Date(NOW.getTime() + 1000));

      expect(await registrations.markReminderSent(event.id, ana.id, sentAt)).toBe(true);
      expect(await registrations.markReminderSent(event.id, ana.id, new Date(sentAt.getTime() + HOUR))).toBe(false);
      expect((await registrations.listDueForReminder(event.id, 10)).map((row) => row.name)).toEqual(["Luis"]);
      expect(await prisma.eventRegistration.findUnique({ where: { id: ana.id } })).toMatchObject({ reminderSentAt: sentAt });
    });

    it("refuses to record a reminder for a pending registration, for another event's one or for an unknown one", async () => {
      const event = await addEvent();
      const other = await addEvent({ title: "Otro taller" });
      const pending = pendingPerson(event.id);
      const ana = confirmed(event.id);

      await registrations.register(pending, NOW);
      await registrations.register(ana, NOW);

      expect(await registrations.markReminderSent(event.id, pending.id, NOW)).toBe(false);
      expect(await registrations.markReminderSent(other.id, ana.id, NOW)).toBe(false);
      expect(await registrations.markReminderSent(event.id, "nobody", NOW)).toBe(false);
      expect(await prisma.eventRegistration.count({ where: { reminderSentAt: { not: null } } })).toBe(0);
    });

    it("records a reminder once when two runs race for the same person", async () => {
      const event = await addEvent();
      const ana = confirmed(event.id);

      await registrations.register(ana, NOW);

      const results = await Promise.all(Array.from({ length: 5 }, () => registrations.markReminderSent(event.id, ana.id, NOW)));

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it("does not list the people of another event", async () => {
      const event = await addEvent();
      const other = await addEvent({ title: "Otro taller" });

      await registrations.register(confirmed(other.id), NOW);

      expect(await registrations.listDueForReminder(event.id, 10)).toEqual([]);
    });
  });

  /*
   * D7: cancelling deletes the stored registration under the event's lock, so the seat it frees is seen at once and a
   * refusal leaves every stored row, and the seat count, exactly as they were.
   */
  describe("cancel", () => {
    const stored = (eventId: string) => registrations.list(eventId);

    it("deletes the named registration and frees its seat for the next person, leaving the others untouched", async () => {
      const event = await addEvent({ registrationCapacity: 2 });
      const ana = person(event.id, { email: "ana@example.com" });
      const luis = person(event.id, { email: "luis@example.com" });

      await registrations.register(ana, NOW);
      await registrations.register(luis, NOW);

      const [, luisRow] = await stored(event.id);

      expect(await registrations.register(person(event.id), NOW)).toEqual({ status: "full" });
      expect(await registrations.cancel(event.id, { id: ana.id }, NOW)).toEqual({ status: "cancelled" });
      expect(await stored(event.id)).toEqual([luisRow]);
      expect(await registrations.count(event.id)).toBe(1);
      expect((await registrations.register(person(event.id), NOW)).status).toBe("registered");
    });

    it("finds the registration of a verified email when asked by it, and only that one", async () => {
      const event = await addEvent({ registrationMode: "unl", registrationCapacity: 3 });
      const unl = (email: string) => person(event.id, { mode: "unl", email, institution: null, career: null, semester: null });

      await registrations.register(unl("ana@unl.edu.ec"), NOW);
      await registrations.register(unl("luis@unl.edu.ec"), NOW);

      expect(await registrations.cancel(event.id, { email: "ana@unl.edu.ec" }, NOW)).toEqual({ status: "cancelled" });
      expect((await stored(event.id)).map((row) => row.email)).toEqual(["luis@unl.edu.ec"]);
      expect(await registrations.cancel(event.id, { email: "ana@unl.edu.ec" }, NOW)).toEqual({ status: "not_registered" });
      expect((await stored(event.id)).map((row) => row.email)).toEqual(["luis@unl.edu.ec"]);
    });

    it("deletes a pending row too, which held no seat", async () => {
      const event = await addEvent({ registrationCapacity: 1 });
      const pending = person(event.id, { confirmedAt: null });
      const seated = person(event.id);

      await registrations.register(pending, NOW);
      await registrations.register(seated, NOW);

      expect(await registrations.cancel(event.id, { id: pending.id }, NOW)).toEqual({ status: "cancelled" });
      expect(await registrations.count(event.id)).toBe(1);
      expect((await stored(event.id)).map((row) => row.id)).toEqual([seated.id]);
    });

    it("answers not_registered for an unknown id and for an id of another event, changing nothing", async () => {
      const event = await addEvent({ registrationCapacity: 2 });
      const other = await addEvent({ title: "Otro taller", registrationCapacity: 2 });
      const mine = person(event.id);
      const theirs = person(other.id);

      await registrations.register(mine, NOW);
      await registrations.register(theirs, NOW);

      expect(await registrations.cancel(event.id, { id: "ghost" }, NOW)).toEqual({ status: "not_registered" });
      expect(await registrations.cancel(event.id, { id: theirs.id }, NOW)).toEqual({ status: "not_registered" });
      expect(await registrations.cancel(event.id, { email: theirs.email }, NOW)).toEqual({ status: "not_registered" });
      expect(await stored(event.id)).toHaveLength(1);
      expect(await stored(other.id)).toHaveLength(1);
    });

    it("is closed after the deadline and after the event day, and the rows and the seat count stay", async () => {
      const deadline = new Date("2026-11-21T00:00:00.000Z");
      const closing = await addEvent({ title: "Cierra", registrationCapacity: 2, registrationDeadline: deadline });
      const past = await addEvent({ title: "Pasado", date: "2026-11-10", registrationCapacity: 2 });
      const a = person(closing.id);
      const b = person(past.id);

      await registrations.register(a, NOW);
      await registrations.register(b, new Date("2026-11-01T00:00:00.000Z"));

      const beforeClosing = await stored(closing.id);
      const beforePast = await stored(past.id);

      expect(await registrations.cancel(closing.id, { id: a.id }, deadline)).toEqual({ status: "closed" });
      expect(await registrations.cancel(past.id, { id: b.id }, NOW)).toEqual({ status: "closed" });
      expect(await stored(closing.id)).toEqual(beforeClosing);
      expect(await stored(past.id)).toEqual(beforePast);
      expect(await registrations.count(closing.id)).toBe(1);
      expect(await registrations.cancel(closing.id, { id: a.id }, new Date(deadline.getTime() - 1))).toEqual({ status: "cancelled" });
    });

    it("is not_found for a draft, a trashed or a missing event, and the registration of a trashed event stays", async () => {
      const draft = await addEvent({ title: "Borrador", registrationCapacity: 2 });
      const trashed = await addEvent({ title: "Papelera", registrationCapacity: 2 });
      const a = person(draft.id);
      const b = person(trashed.id);

      await registrations.register(a, NOW);
      await registrations.register(b, NOW);
      await events.update(Event.reconstitute(draft).update({ isPublished: false }));
      await events.trash(trashed.id);

      expect(await registrations.cancel(draft.id, { id: a.id }, NOW)).toEqual({ status: "not_found" });
      expect(await registrations.cancel(trashed.id, { id: b.id }, NOW)).toEqual({ status: "not_found" });
      expect(await registrations.cancel("00000000-0000-0000-0000-000000000000", { id: "x" }, NOW)).toEqual({ status: "not_found" });
      expect(await stored(draft.id)).toHaveLength(1);
      expect(await registrations.count(trashed.id)).toBe(1);
    });

    it("cancelling the same registration at once deletes it once, and the seat is free exactly once", async () => {
      const event = await addEvent({ registrationCapacity: 1 });
      const ana = person(event.id);

      await registrations.register(ana, NOW);

      const outcomes = await Promise.all(Array.from({ length: 6 }, () => registrations.cancel(event.id, { id: ana.id }, NOW)));

      expect(outcomes.filter((outcome) => outcome.status === "cancelled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "not_registered")).toHaveLength(5);
      expect(await registrations.count(event.id)).toBe(0);
    });

    it("a cancellation racing a registration for the freed seat never oversells it", async () => {
      const event = await addEvent({ registrationCapacity: 1 });
      const ana = person(event.id);

      await registrations.register(ana, NOW);

      const results = await Promise.all([
        registrations.cancel(event.id, { id: ana.id }, NOW),
        ...Array.from({ length: 5 }, () => registrations.register(person(event.id), NOW)),
      ]);

      expect(results[0]).toEqual({ status: "cancelled" });
      expect(await registrations.count(event.id)).toBeLessThanOrEqual(1);
      expect(results.slice(1).filter((outcome) => outcome.status === "registered").length).toBeLessThanOrEqual(1);
    });
  });
});
