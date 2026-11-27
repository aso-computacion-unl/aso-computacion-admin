import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "@/application";
import { ChangeEventRegistrationUseCase } from "@/application/event-registration/event-registration-settings.use-cases";
import { type CreateEventInput } from "@/domain/event";
import { EVENT_KIND_FIXED_MESSAGE, PAST_EVENT_REGISTRATION_MESSAGE, REGISTRATION_NOT_SET_MESSAGE } from "@/domain/event-registration";
import { ValidationError } from "@/domain";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { storedEvent } from "@/tests/support/test-event-registration";

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

describe("ChangeEventRegistrationUseCase", () => {
  const change = (command: Parameters<ChangeEventRegistrationUseCase["execute"]>[0]) => new ChangeEventRegistrationUseCase(events).execute(command);

  it("changes the registration settings and nothing else", async () => {
    const event = await addEvent("Taller", { registrationMode: "unl", registrationCapacity: 10, hora: "09:00" });

    await change({ eventId: event.id, registrationMode: "open", registrationCapacity: null, registrationDeadline: null });

    expect(await stored(event.id)).toMatchObject({ registrationMode: "open", registrationCapacity: null, registrationDeadline: null, title: "Taller", hora: "09:00", lugar: "Laboratorio 2" });
  });

  it("never turns the registration off (event-kinds S6): `none` is refused and the event keeps its settings", async () => {
    const event = await addEvent("Taller", { registrationMode: "open", registrationCapacity: 10 });

    expect(await refusal(change({ eventId: event.id, registrationMode: "none", registrationCapacity: 10, registrationDeadline: null }))).toEqual(["registrationMode", EVENT_KIND_FIXED_MESSAGE]);
    expect(await stored(event.id)).toMatchObject({ registrationMode: "open", registrationCapacity: 10 });
  });

  it("refuses an event that does not exist", async () => {
    await expect(change({ eventId: "missing", registrationMode: "none" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses an event without registration, read from what is stored: an announcement never takes one here", async () => {
    const event = await addEvent("Sin inscripción");

    expect(await refusal(change({ eventId: event.id, registrationMode: "open", registrationCapacity: 5 }))).toEqual(["registrationMode", REGISTRATION_NOT_SET_MESSAGE]);
    expect(await stored(event.id)).toMatchObject({ registrationMode: "none", registrationCapacity: null });
  });

  it("refuses changing the registration of a past event, and never turns it off", async () => {
    const past = storedEvent({ title: "Antiguo", date: "2020-05-10", isPublished: true, registrationMode: "unl" });
    await events.create(past);

    expect(await refusal(change({ eventId: past.props.id, registrationMode: "open" }))).toEqual(["registrationMode", PAST_EVENT_REGISTRATION_MESSAGE]);
    expect(await refusal(change({ eventId: past.props.id, registrationMode: "none" }))).toEqual(["registrationMode", EVENT_KIND_FIXED_MESSAGE]);
    expect((await stored(past.props.id)).registrationMode).toBe("unl");
  });
});
