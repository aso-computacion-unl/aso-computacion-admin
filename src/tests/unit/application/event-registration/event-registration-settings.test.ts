import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "@/application";
import {
  ChangeEventRegistrationUseCase,
  ListRegistrationCandidatesUseCase,
  OpenEventRegistrationUseCase,
} from "@/application/event-registration/event-registration-settings.use-cases";
import { type CreateEventInput } from "@/domain/event";
import { PAST_EVENT_REGISTRATION_MESSAGE, REGISTRATION_ALREADY_SET_MESSAGE, REGISTRATION_NOT_SET_MESSAGE } from "@/domain/event-registration";
import { ValidationError } from "@/domain";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { storedEvent } from "@/tests/support/test-event-registration";

const NOW = new Date("2026-11-20T15:00:00.000Z"); // 10:00 in Ecuador, 2026-11-20

let events: InMemoryEventRepository;

async function addEvent(title: string, overrides: Partial<CreateEventInput> = {}) {
  const event = storedEvent({ title, date: "2099-11-28", isPublished: true, lugar: "Laboratorio 2", registrationMode: "none", ...overrides });

  await events.create(event);

  return event.props;
}

const stored = async (id: string) => (await events.getById(id))!.props;

/** The validation issue a refused save names, as `[field, message]`. */
async function refusal(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );

  expect(error).toBeInstanceOf(ValidationError);

  return [(error as ValidationError).field, (error as ValidationError).message];
}

beforeEach(() => {
  events = new InMemoryEventRepository();
});

describe("ListRegistrationCandidatesUseCase", () => {
  const candidates = () => new ListRegistrationCandidatesUseCase(events).execute({ now: NOW });

  it("offers the upcoming events without registration, published or drafts, soonest first and undated last", async () => {
    await addEvent("Lejano", { date: "2099-12-20" });
    await addEvent("Borrador", { date: "2026-11-25", isPublished: false });
    await addEvent("Sin fecha", { date: null });
    await addEvent("Este mes", { date: "2026-11-01", datePrecision: "month" });
    await addEvent("Hoy", { date: "2026-11-20" });

    expect((await candidates()).map((event) => event.title)).toEqual(["Este mes", "Hoy", "Borrador", "Lejano", "Sin fecha"]);
  });

  it("leaves out the events that already happened and the ones that already take registrations", async () => {
    await addEvent("Ayer", { date: "2026-11-19" });
    await addEvent("Mes pasado", { date: "2026-10-01", datePrecision: "month" });
    await addEvent("Con inscripción", { registrationMode: "unl" });
    await addEvent("Elegible");

    expect((await candidates()).map((event) => event.title)).toEqual(["Elegible"]);
  });

  it("gives what the picker shows: title, date, place and whether it is a draft", async () => {
    const event = await addEvent("Taller", { isPublished: false });

    expect(await candidates()).toEqual([{ id: event.id, title: "Taller", date: "2099-11-28", datePrecision: "day", lugar: "Laboratorio 2", isPublished: false }]);
  });
});

describe("OpenEventRegistrationUseCase", () => {
  const open = (command: Parameters<OpenEventRegistrationUseCase["execute"]>[0]) => new OpenEventRegistrationUseCase(events).execute(command, NOW);

  it("turns on the registration of an upcoming event and changes nothing else", async () => {
    const event = await addEvent("Taller", { isPublished: false, description: "Git desde cero" });
    const deadline = new Date("2099-11-27T23:00:00.000Z");

    const result = await open({ eventId: event.id, registrationMode: "open", registrationCapacity: 30, registrationDeadline: deadline });

    expect(result.isPublished).toBe(false);
    expect(await stored(event.id)).toEqual({ ...event, registrationMode: "open", registrationCapacity: 30, registrationDeadline: deadline, updatedAt: expect.any(Date) });
  });

  it("refuses an event that does not exist", async () => {
    await expect(open({ eventId: "missing", registrationMode: "unl" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses an event that already takes registrations, and leaves it as it was", async () => {
    const event = await addEvent("Ya abierto", { registrationMode: "unl", registrationCapacity: 10 });

    expect(await refusal(open({ eventId: event.id, registrationMode: "open", registrationCapacity: 99 }))).toEqual(["registrationMode", REGISTRATION_ALREADY_SET_MESSAGE]);
    expect(await stored(event.id)).toMatchObject({ registrationMode: "unl", registrationCapacity: 10 });
  });

  it("refuses an event that already happened", async () => {
    const event = await addEvent("Pasado", { date: "2026-11-19" });

    expect(await refusal(open({ eventId: event.id, registrationMode: "unl" }))).toEqual(["registrationMode", PAST_EVENT_REGISTRATION_MESSAGE]);
    expect((await stored(event.id)).registrationMode).toBe("none");
  });

  it("refuses a save that does not pick a way to register", async () => {
    const event = await addEvent("Taller");

    expect((await refusal(open({ eventId: event.id, registrationMode: "none" })))[0]).toBe("registrationMode");
    expect((await refusal(open({ eventId: event.id })))[0]).toBe("registrationMode");
  });

  it("applies the date rules of the event: a deadline after its day is refused", async () => {
    const event = await addEvent("Taller", { date: "2099-11-28" });

    expect((await refusal(open({ eventId: event.id, registrationMode: "unl", registrationDeadline: new Date("2099-12-01T12:00:00.000Z") })))[0]).toBe("registrationDeadline");
  });
});

describe("ChangeEventRegistrationUseCase", () => {
  const change = (command: Parameters<ChangeEventRegistrationUseCase["execute"]>[0]) => new ChangeEventRegistrationUseCase(events).execute(command);

  it("changes the registration settings and nothing else", async () => {
    const event = await addEvent("Taller", { registrationMode: "unl", registrationCapacity: 10, hora: "09:00" });

    await change({ eventId: event.id, registrationMode: "open", registrationCapacity: null, registrationDeadline: null });

    expect(await stored(event.id)).toMatchObject({ registrationMode: "open", registrationCapacity: null, registrationDeadline: null, title: "Taller", hora: "09:00", lugar: "Laboratorio 2" });
  });

  it("turns the registration off, clearing its seats and deadline", async () => {
    const event = await addEvent("Taller", { registrationMode: "open", registrationCapacity: 10 });

    await change({ eventId: event.id, registrationMode: "none", registrationCapacity: 10, registrationDeadline: null });

    expect(await stored(event.id)).toMatchObject({ registrationMode: "none", registrationCapacity: null, registrationDeadline: null });
  });

  it("refuses an event that does not exist", async () => {
    await expect(change({ eventId: "missing", registrationMode: "none" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses an event without registration, read from what is stored: opening one is «Crear inscripción»", async () => {
    const event = await addEvent("Sin inscripción");

    expect(await refusal(change({ eventId: event.id, registrationMode: "open", registrationCapacity: 5 }))).toEqual(["registrationMode", REGISTRATION_NOT_SET_MESSAGE]);
    expect(await stored(event.id)).toMatchObject({ registrationMode: "none", registrationCapacity: null });
  });

  it("refuses changing the registration of a past event, but lets it be turned off", async () => {
    const past = storedEvent({ title: "Antiguo", date: "2020-05-10", isPublished: true, registrationMode: "unl" });
    await events.create(past);

    expect(await refusal(change({ eventId: past.props.id, registrationMode: "open" }))).toEqual(["registrationMode", PAST_EVENT_REGISTRATION_MESSAGE]);
    await change({ eventId: past.props.id, registrationMode: "none" });
    expect((await stored(past.props.id)).registrationMode).toBe("none");
  });
});
