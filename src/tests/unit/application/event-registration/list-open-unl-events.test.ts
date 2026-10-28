import { beforeEach, describe, expect, it } from "vitest";

import { ListOpenUnlEventsUseCase } from "@/application/event-registration/list-open-unl-events.use-case";
import { Event, type CreateEventInput } from "@/domain/event";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";

const NOW = new Date("2026-11-20T15:00:00.000Z");

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;

async function addEvent(title: string, overrides: Partial<CreateEventInput> = {}) {
  const event = Event.create({ title, date: "2026-11-28", isPublished: true, registrationMode: "unl", ...overrides });

  await events.create(event);

  return event.props;
}

function register(eventId: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    registrations.seed({ id: `${eventId}-${index}`, eventId, mode: "unl", name: `Persona ${index}`, email: `p${index}@unl.edu.ec`, career: null, semester: null, createdAt: NOW });
  }
}

const list = () => new ListOpenUnlEventsUseCase(events, registrations).execute({ now: NOW });
const titles = async () => (await list()).map((event) => event.title);

beforeEach(() => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
});

describe("ListOpenUnlEventsUseCase", () => {
  it("lists the public UNL events that still take registrations, soonest first, undated last", async () => {
    await addEvent("Charla sin fecha", { date: null });
    await addEvent("Taller de Git", { date: "2026-12-05" });
    await addEvent("Taller de Docker", { date: "2026-11-25" });

    expect(await titles()).toEqual(["Taller de Docker", "Taller de Git", "Charla sin fecha"]);
  });

  it("describes each event for its row: slug, date, description, and the seats left of the capacity", async () => {
    const taller = await addEvent("Taller de Docker", { registrationCapacity: 60, description: "Contenedores desde cero." });
    register(taller.id, 48);

    expect(await list()).toEqual([
      { slug: "taller-de-docker", title: "Taller de Docker", date: "2026-11-28", datePrecision: "day", description: "Contenedores desde cero.", capacity: 60, seatsLeft: 12 },
    ]);
  });

  it("has no seat count for an event without a limit", async () => {
    await addEvent("Taller de Docker");

    expect(await list()).toEqual([expect.objectContaining({ capacity: null, seatsLeft: null })]);
  });

  it("leaves out events that are not open for UNL registration right now", async () => {
    await addEvent("Abierto");
    await addEvent("Otro modo", { registrationMode: "open" });
    await addEvent("Sin inscripción", { registrationMode: "none" });
    await addEvent("Borrador", { isPublished: false });
    await addEvent("Programado", { publishAt: new Date("2026-12-01T00:00:00.000Z") });
    await addEvent("Retirado", { publishAt: new Date("2026-11-01T00:00:00.000Z"), unpublishAt: new Date("2026-11-15T00:00:00.000Z") });
    await addEvent("Plazo vencido", { registrationDeadline: new Date("2026-11-19T00:00:00.000Z") });
    await addEvent("Ya ocurrió", { date: "2026-11-10" });
    const lleno = await addEvent("Lleno", { registrationCapacity: 2 });
    register(lleno.id, 2);

    expect(await titles()).toEqual(["Abierto"]);
  });

  it("is empty when nothing is open", async () => {
    expect(await list()).toEqual([]);
  });

  it("lists every open event, not only the first few: the registrations page shows them all", async () => {
    for (let day = 1; day <= 7; day += 1) await addEvent(`Evento ${day}`, { date: `2026-12-${String(day).padStart(2, "0")}` });

    const shown = await titles();

    expect(shown).toHaveLength(7);
    expect(shown[0]).toBe("Evento 1");
  });
});
