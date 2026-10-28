import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListRegistrationOverviewUseCase } from "@/application/event-registration/list-registration-overview.use-case";
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

const overview = () => new ListRegistrationOverviewUseCase(events, registrations).execute({ now: NOW });
const titles = async () => {
  const { upcoming, past } = await overview();

  return { upcoming: upcoming.map((row) => row.title), past: past.map((row) => row.title) };
};

beforeEach(() => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
});

describe("ListRegistrationOverviewUseCase", () => {
  it("is empty when no event takes registrations", async () => {
    await addEvent("Sin inscripción", { registrationMode: "none" });

    expect(await overview()).toEqual({ upcoming: [], past: [] });
  });

  it("describes each event for its row: where to go, the mode, the seats, the deadline and the state", async () => {
    const deadline = new Date("2026-11-27T23:00:00.000Z");
    const taller = await addEvent("Taller de Git", { registrationMode: "unl", registrationCapacity: 60, registrationDeadline: deadline });
    register(taller.id, 48);

    expect((await overview()).upcoming).toEqual([
      {
        id: taller.id,
        slug: "taller-de-git",
        title: "Taller de Git",
        date: "2026-11-28",
        datePrecision: "day",
        mode: "unl",
        capacity: 60,
        registered: 48,
        deadline,
        state: "open",
        publication: "live",
      },
    ]);
  });

  it("maps the state like the registration itself: open, full, and closed (which wins over full)", async () => {
    const abierto = await addEvent("Abierto", { registrationCapacity: 5 });
    const lleno = await addEvent("Lleno", { registrationCapacity: 2 });
    const vencido = await addEvent("Plazo vencido", { registrationDeadline: new Date("2026-11-19T00:00:00.000Z") });
    const pasadoLleno = await addEvent("Pasado y lleno", { date: "2026-11-10", registrationCapacity: 1 });
    register(abierto.id, 4);
    register(lleno.id, 2);
    register(pasadoLleno.id, 1);

    const { upcoming, past } = await overview();
    const states = Object.fromEntries([...upcoming, ...past].map((row) => [row.title, row.state]));

    expect(states).toEqual({ Abierto: "open", Lleno: "full", "Plazo vencido": "closed", "Pasado y lleno": "closed" });
    expect(vencido.registrationDeadline).not.toBeNull();
  });

  it("counts the registered people of an event with no limit and leaves its capacity null", async () => {
    const libre = await addEvent("Sin límite");
    register(libre.id, 7);

    expect((await overview()).upcoming).toEqual([expect.objectContaining({ capacity: null, registered: 7, state: "open" })]);
  });

  it("lists upcoming events soonest first, then past ones, most recent first", async () => {
    await addEvent("Pasado antiguo", { date: "2026-03-01" });
    await addEvent("Futuro lejano", { date: "2027-02-10" });
    await addEvent("Pasado reciente", { date: "2026-11-19" });
    await addEvent("Futuro cercano", { date: "2026-11-25" });

    expect(await titles()).toEqual({ upcoming: ["Futuro cercano", "Futuro lejano"], past: ["Pasado reciente", "Pasado antiguo"] });
  });

  it("counts today, in Ecuador, as upcoming: the day flips at Ecuador midnight, not at UTC midnight", async () => {
    await addEvent("Hoy", { date: "2026-11-20" });
    await addEvent("Ayer", { date: "2026-11-19" });

    expect(await titles()).toEqual({ upcoming: ["Hoy"], past: ["Ayer"] });

    // 02:00 UTC of the 21st is still the 20th (21:00) in Ecuador.
    const lateEvening = await new ListRegistrationOverviewUseCase(events, registrations).execute({ now: new Date("2026-11-21T02:00:00.000Z") });

    expect(lateEvening.upcoming.map((row) => row.title)).toEqual(["Hoy"]);
  });

  it("keeps an undated event at the end of the upcoming ones: nothing says it already happened", async () => {
    await addEvent("Sin fecha", { date: null });
    await addEvent("Con fecha", { date: "2027-01-10" });
    await addEvent("Ya pasó", { date: "2026-01-10" });

    expect(await titles()).toEqual({ upcoming: ["Con fecha", "Sin fecha"], past: ["Ya pasó"] });
  });

  it("treats a month-only event as upcoming until its month is over, and ordered by the first of its month", async () => {
    await addEvent("Este mes", { date: "2026-11-01", datePrecision: "month" });
    await addEvent("Mes pasado", { date: "2026-10-01", datePrecision: "month" });
    await addEvent("Mes próximo", { date: "2026-12-01", datePrecision: "month" });
    await addEvent("Día cercano", { date: "2026-11-25" });

    expect(await titles()).toEqual({ upcoming: ["Este mes", "Día cercano", "Mes próximo"], past: ["Mes pasado"] });
  });

  it("breaks ties on the same day by title", async () => {
    await addEvent("Beta", { date: "2026-12-01" });
    await addEvent("Alfa", { date: "2026-12-01" });

    expect((await titles()).upcoming).toEqual(["Alfa", "Beta"]);
  });

  it("includes events that are not public yet, saying why, because the board needs to see their registrants", async () => {
    await addEvent("Borrador", { isPublished: false });
    await addEvent("Programado", { publishAt: new Date("2026-12-01T00:00:00.000Z") });
    await addEvent("Retirado", { publishAt: new Date("2026-11-01T00:00:00.000Z"), unpublishAt: new Date("2026-11-15T00:00:00.000Z") });
    await addEvent("Público");

    const { upcoming } = await overview();

    expect(Object.fromEntries(upcoming.map((row) => [row.title, row.publication]))).toEqual({ Borrador: "draft", Programado: "scheduled", Retirado: "expired", Público: "live" });
  });

  it("leaves out an event in the trash", async () => {
    await addEvent("Visible");
    const trashed = await addEvent("En la papelera");
    await events.trash(trashed.id);

    expect(await titles()).toEqual({ upcoming: ["Visible"], past: [] });
  });

  it("counts every event in ONE aggregated query, not one per event", async () => {
    for (let day = 1; day <= 5; day += 1) register((await addEvent(`Evento ${day}`, { date: `2026-12-0${day}` })).id, day);
    const countByEvents = vi.spyOn(registrations, "countByEvents");
    const count = vi.spyOn(registrations, "count");

    expect((await overview()).upcoming.map((row) => row.registered)).toEqual([1, 2, 3, 4, 5]);
    expect(countByEvents).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
  });

  it("carries no personal data of the registrants", async () => {
    const taller = await addEvent("Taller de Git");
    register(taller.id, 2);

    expect(JSON.stringify(await overview())).not.toMatch(/Persona \d|@example\.com|Computación/);
  });
});
