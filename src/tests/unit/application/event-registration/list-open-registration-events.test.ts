import { beforeEach, describe, expect, it } from "vitest";

import { ListOpenRegistrationEventsUseCase } from "@/application/event-registration/list-open-registration-events.use-case";
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

function register(eventId: string, count: number, mode: "unl" | "open" = "unl") {
  for (let index = 0; index < count; index += 1) {
    registrations.seed({ id: `${eventId}-${index}`, eventId, mode, name: `Persona ${index}`, email: `p${index}@unl.edu.ec`, career: null, semester: null, createdAt: NOW });
  }
}

const list = () => new ListOpenRegistrationEventsUseCase(events, registrations).execute({ now: NOW });
const titles = async () => (await list()).map((event) => event.title);

beforeEach(() => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
});

describe("ListOpenRegistrationEventsUseCase (D8: the public list of /inscripciones)", () => {
  it("lists the UNL events and the open-form events alike, each with the way it takes registrations", async () => {
    await addEvent("Taller de Git", { registrationMode: "unl", date: "2026-12-05" });
    await addEvent("Charla abierta", { registrationMode: "open", date: "2026-11-25" });

    expect(await list()).toEqual([
      expect.objectContaining({ title: "Charla abierta", mode: "open" }),
      expect.objectContaining({ title: "Taller de Git", mode: "unl" }),
    ]);
  });

  it("puts the upcoming events first, soonest first, and the undated ones last", async () => {
    await addEvent("Charla sin fecha", { date: null });
    await addEvent("Taller de Git", { date: "2026-12-05", registrationMode: "open" });
    await addEvent("Taller de Docker", { date: "2026-11-25" });

    expect(await titles()).toEqual(["Taller de Docker", "Taller de Git", "Charla sin fecha"]);
  });

  it("describes each event for its card: slug, date, place and hour, description, and the seats left of the capacity (confirmed registrations only)", async () => {
    const taller = await addEvent("Taller de Docker", { registrationCapacity: 60, description: "Contenedores desde cero.", hora: "09:00 - 11:00", lugar: "Laboratorio 2", registrationMode: "open" });
    register(taller.id, 48, "open");

    expect(await list()).toEqual([
      {
        slug: "taller-de-docker",
        title: "Taller de Docker",
        date: "2026-11-28",
        datePrecision: "day",
        description: "Contenedores desde cero.",
        hora: "09:00 - 11:00",
        lugar: "Laboratorio 2",
        mode: "open",
        capacity: 60,
        seatsLeft: 12,
      },
    ]);
  });

  it("has no seat count for an event without a limit", async () => {
    await addEvent("Taller de Docker");

    expect(await list()).toEqual([expect.objectContaining({ capacity: null, seatsLeft: null })]);
  });

  it("leaves out whatever cannot take a registration right now", async () => {
    await addEvent("Abierto UNL");
    await addEvent("Abierto formulario", { registrationMode: "open" });
    await addEvent("Sin inscripción", { registrationMode: "none" });
    await addEvent("Borrador", { isPublished: false });
    await addEvent("Programado", { publishAt: new Date("2026-12-01T00:00:00.000Z") });
    await addEvent("Retirado", { publishAt: new Date("2026-11-01T00:00:00.000Z"), unpublishAt: new Date("2026-11-15T00:00:00.000Z") });
    await addEvent("Plazo vencido", { registrationDeadline: new Date("2026-11-19T00:00:00.000Z") });
    await addEvent("Ya ocurrió", { date: "2026-11-10", registrationMode: "open" });
    const lleno = await addEvent("Lleno", { registrationCapacity: 2 });
    register(lleno.id, 2);

    expect(await titles()).toEqual(["Abierto formulario", "Abierto UNL"]);
  });

  it("is empty when nothing is open", async () => {
    expect(await list()).toEqual([]);
  });

  it("lists every open event, not only the first few", async () => {
    for (let day = 1; day <= 7; day += 1) await addEvent(`Evento ${day}`, { date: `2026-12-${String(day).padStart(2, "0")}` });

    const shown = await titles();

    expect(shown).toHaveLength(7);
    expect(shown[0]).toBe("Evento 1");
  });
});
