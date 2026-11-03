import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListEventSeatsUseCase } from "@/application/event-registration/list-event-seats.use-case";
import { Event, type CreateEventInput } from "@/domain/event";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";

const NOW = new Date("2026-11-20T15:00:00.000Z"); // 10:00 in Ecuador, 2026-11-20

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;

async function addEvent(title: string, overrides: Partial<CreateEventInput> = {}) {
  const event = Event.create({ title, date: "2026-11-28", isPublished: true, registrationMode: "open", ...overrides });

  await events.create(event);

  return event.props;
}

function register(eventId: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    registrations.seed({ id: `${eventId}-${index}`, eventId, mode: "open", name: `Persona ${index}`, email: `p${index}@example.com`, career: "Computación", semester: 3, createdAt: NOW });
  }
}

const seats = () => new ListEventSeatsUseCase(events, registrations).execute({ now: NOW });
const slugs = async () => (await seats()).map((event) => event.slug);

beforeEach(() => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
});

describe("ListEventSeatsUseCase", () => {
  it("reports an open event with seats: capacity, registered, seats left", async () => {
    const taller = await addEvent("Taller de Git", { registrationCapacity: 60 });
    register(taller.id, 48);

    expect(await seats()).toEqual([{ slug: "taller-de-git", capacity: 60, registered: 48, seatsLeft: 12, status: "open" }]);
  });

  it("reports a full event with no seats left, never negative", async () => {
    const lleno = await addEvent("Lleno", { registrationCapacity: 2 });
    register(lleno.id, 3);

    expect(await seats()).toEqual([{ slug: "lleno", capacity: 2, registered: 3, seatsLeft: 0, status: "full" }]);
  });

  it("reports closed when the deadline has passed, keeping the real counts", async () => {
    const vencido = await addEvent("Plazo vencido", { registrationCapacity: 10, registrationDeadline: new Date("2026-11-19T00:00:00.000Z") });
    register(vencido.id, 4);

    expect(await seats()).toEqual([{ slug: "plazo-vencido", capacity: 10, registered: 4, seatsLeft: 6, status: "closed" }]);
  });

  it("reports closed when the event day is before today in Ecuador, and still open on the day itself", async () => {
    await addEvent("Ya ocurrió", { date: "2026-11-19" });
    await addEvent("Hoy", { date: "2026-11-20" });

    expect(await seats()).toEqual([
      expect.objectContaining({ slug: "ya-ocurrio", status: "closed" }),
      expect.objectContaining({ slug: "hoy", status: "open" }),
    ]);
  });

  it("closed wins over full, like the registration itself", async () => {
    const pasado = await addEvent("Pasado y lleno", { date: "2026-11-10", registrationCapacity: 1 });
    register(pasado.id, 1);

    expect(await seats()).toEqual([expect.objectContaining({ status: "closed", seatsLeft: 0 })]);
  });

  it("has no seatsLeft for an event without a limit", async () => {
    const libre = await addEvent("Sin límite");
    register(libre.id, 7);

    expect(await seats()).toEqual([{ slug: "sin-limite", capacity: null, registered: 7, seatsLeft: null, status: "open" }]);
  });

  it("counts every stored registration, whatever way it was made", async () => {
    const mixto = await addEvent("Mixto", { registrationCapacity: 5 });
    register(mixto.id, 1);
    registrations.seed({ id: "unl-1", eventId: mixto.id, mode: "unl", name: "Ana", email: "ana@unl.edu.ec", career: null, semester: null, createdAt: NOW });

    expect(await seats()).toEqual([expect.objectContaining({ registered: 2, seatsLeft: 3 })]);
  });

  it("covers both modes that take registrations, and leaves out events that take none", async () => {
    await addEvent("Con cuenta UNL", { registrationMode: "unl" });
    await addEvent("Formulario abierto", { registrationMode: "open" });
    await addEvent("Sin inscripción", { registrationMode: "none" });

    expect((await slugs()).sort()).toEqual(["con-cuenta-unl", "formulario-abierto"]);
  });

  it("leaves out events that are not publicly visible: drafts, not yet live, and withdrawn", async () => {
    await addEvent("Visible");
    await addEvent("Borrador", { isPublished: false });
    await addEvent("Programado", { publishAt: new Date("2026-12-01T00:00:00.000Z") });
    await addEvent("Retirado", { publishAt: new Date("2026-11-01T00:00:00.000Z"), unpublishAt: new Date("2026-11-15T00:00:00.000Z") });

    expect(await slugs()).toEqual(["visible"]);
  });

  it("leaves out a trashed event", async () => {
    const visible = await addEvent("Visible");
    const trashed = await addEvent("En la papelera");
    await events.trash(trashed.id);

    expect(await slugs()).toEqual(["visible"]);
    expect(visible.slug).toBe("visible");
  });

  it("lists soonest first, undated last, and is empty when no event takes registrations", async () => {
    expect(await seats()).toEqual([]);

    await addEvent("Sin fecha", { date: null });
    await addEvent("Después", { date: "2026-12-05" });
    await addEvent("Antes", { date: "2026-11-25" });

    expect(await slugs()).toEqual(["antes", "despues", "sin-fecha"]);
  });

  it("counts every event in ONE aggregated query, not one per event", async () => {
    for (let day = 1; day <= 6; day += 1) register((await addEvent(`Evento ${day}`, { date: `2026-12-0${day}` })).id, day);
    const countByEvents = vi.spyOn(registrations, "countByEvents");
    const count = vi.spyOn(registrations, "count");

    expect((await seats()).map((event) => event.registered)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(countByEvents).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
  });

  it("exposes nothing but the five documented fields", async () => {
    const taller = await addEvent("Taller de Git", { registrationCapacity: 3 });
    register(taller.id, 1);

    expect(Object.keys((await seats())[0]!).sort()).toEqual(["capacity", "registered", "seatsLeft", "slug", "status"]);
  });
});
