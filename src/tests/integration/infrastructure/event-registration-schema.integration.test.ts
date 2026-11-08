import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { prisma } from "@/infrastructure/prisma/client";

const NOW = new Date("2026-10-27T12:00:00.000Z");

const newEvent = (overrides: Record<string, unknown> = {}) => ({ id: "e1", slug: "evento", title: "Evento", updatedAt: NOW, ...overrides });
const newRegistration = (overrides: Record<string, unknown> = {}) => ({
  id: "r1",
  eventId: "e1",
  mode: "open" as const,
  name: "Ana Pérez",
  email: "ana@example.com",
  institution: "Universidad Nacional de Loja",
  career: "Computación",
  semester: 5,
  confirmedAt: NOW,
  ...overrides,
});

describe("event registration schema (integration)", () => {
  it("defaults existing and new events to no registration, without capacity or deadline", async () => {
    expect(await prisma.event.create({ data: newEvent() })).toMatchObject({
      registrationMode: "none",
      registrationCapacity: null,
      registrationDeadline: null,
    });
  });

  it("refuses a capacity or a deadline on an event without registration, and a non-positive capacity", async () => {
    await expect(prisma.event.create({ data: newEvent({ registrationCapacity: 10 }) })).rejects.toThrow();
    await expect(prisma.event.create({ data: newEvent({ registrationDeadline: NOW }) })).rejects.toThrow();
    await expect(prisma.event.create({ data: newEvent({ registrationMode: "open", registrationCapacity: 0 }) })).rejects.toThrow();
    expect(await prisma.event.count()).toBe(0);

    const event = await prisma.event.create({
      data: newEvent({ registrationMode: "unl", registrationCapacity: 30, registrationDeadline: NOW }),
    });

    expect(event.registrationDeadline?.toISOString()).toBe(NOW.toISOString());
  });

  it("stores a registration and refuses the same email twice for one event, but not for another", async () => {
    await prisma.event.create({ data: newEvent({ registrationMode: "open" }) });
    await prisma.event.create({ data: newEvent({ id: "e2", slug: "otro", registrationMode: "open" }) });
    await prisma.eventRegistration.create({ data: newRegistration() });

    await expect(prisma.eventRegistration.create({ data: newRegistration({ id: "r2", name: "Otra Persona" }) })).rejects.toThrow();
    await prisma.eventRegistration.create({ data: newRegistration({ id: "r3", eventId: "e2" }) });

    expect(await prisma.eventRegistration.count()).toBe(2);
    expect((await prisma.eventRegistration.findUnique({ where: { id: "r1" } }))?.name).toBe("Ana Pérez");
  });

  it("keeps the data of a registration within what its mode needs", async () => {
    await prisma.event.create({ data: newEvent({ registrationMode: "open" }) });

    await expect(prisma.eventRegistration.create({ data: newRegistration({ email: "Ana@Example.com" }) })).rejects.toThrow();
    await expect(prisma.eventRegistration.create({ data: newRegistration({ mode: "none" }) })).rejects.toThrow();
    await expect(prisma.eventRegistration.create({ data: newRegistration({ mode: "unl" }) })).rejects.toThrow();
    await expect(prisma.eventRegistration.create({ data: newRegistration({ semester: 13 }) })).rejects.toThrow();
    await expect(prisma.eventRegistration.create({ data: newRegistration({ name: "" }) })).rejects.toThrow();

    await prisma.eventRegistration.create({ data: newRegistration({ mode: "unl", institution: null, career: null, semester: null }) });

    expect(await prisma.eventRegistration.count()).toBe(1);
  });

  it("lets an open row leave career and semester empty, but not institution out of range", async () => {
    await prisma.event.create({ data: newEvent({ registrationMode: "open" }) });

    await expect(prisma.eventRegistration.create({ data: newRegistration({ institution: "" }) })).rejects.toThrow();
    await expect(prisma.eventRegistration.create({ data: newRegistration({ institution: "x".repeat(121) }) })).rejects.toThrow();

    await prisma.eventRegistration.create({ data: newRegistration({ career: null, semester: null }) });
    await prisma.eventRegistration.create({ data: newRegistration({ id: "r2", email: "luis@example.com", institution: "x".repeat(120) }) });

    expect(await prisma.eventRegistration.count()).toBe(2);
  });

  it("refuses a UNL row that carries an institution or that is not confirmed", async () => {
    await prisma.event.create({ data: newEvent({ registrationMode: "unl" }) });
    const unl = { mode: "unl" as const, career: null, semester: null, institution: null };

    await expect(prisma.eventRegistration.create({ data: newRegistration({ ...unl, institution: "Universidad Nacional de Loja" }) })).rejects.toThrow();
    await expect(prisma.eventRegistration.create({ data: newRegistration({ ...unl, confirmedAt: null }) })).rejects.toThrow();
    expect(await prisma.eventRegistration.count()).toBe(0);

    await prisma.eventRegistration.create({ data: newRegistration(unl) });

    expect(await prisma.eventRegistration.count()).toBe(1);
  });

  it("lets an open row wait unconfirmed, and refuses a reminder for a row that was never confirmed", async () => {
    await prisma.event.create({ data: newEvent({ registrationMode: "open" }) });

    await prisma.eventRegistration.create({ data: newRegistration({ confirmedAt: null }) });

    await expect(prisma.eventRegistration.update({ where: { id: "r1" }, data: { reminderSentAt: NOW } })).rejects.toThrow();
    await expect(prisma.eventRegistration.create({ data: newRegistration({ id: "r2", email: "luis@example.com", confirmedAt: null, reminderSentAt: NOW }) })).rejects.toThrow();
    expect((await prisma.eventRegistration.findUnique({ where: { id: "r1" } }))?.reminderSentAt).toBeNull();

    await prisma.eventRegistration.update({ where: { id: "r1" }, data: { confirmedAt: NOW } });
    await prisma.eventRegistration.update({ where: { id: "r1" }, data: { reminderSentAt: NOW } });

    expect((await prisma.eventRegistration.findUnique({ where: { id: "r1" } }))?.reminderSentAt).toEqual(NOW);
    await expect(prisma.eventRegistration.update({ where: { id: "r1" }, data: { confirmedAt: null } })).rejects.toThrow();
  });

  it("removes the registrations together with their event", async () => {
    await prisma.event.create({ data: newEvent({ registrationMode: "open" }) });
    await prisma.eventRegistration.create({ data: newRegistration() });

    await prisma.event.delete({ where: { id: "e1" } });

    expect(await prisma.eventRegistration.count()).toBe(0);
  });
});
