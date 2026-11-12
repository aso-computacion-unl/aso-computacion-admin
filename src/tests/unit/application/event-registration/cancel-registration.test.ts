import { beforeEach, describe, expect, it } from "vitest";

import { ForbiddenError } from "@/application";
import {
  CancelRegistrationByLinkUseCase,
  CancelUnlRegistrationUseCase,
} from "@/application/event-registration/cancel-registration.use-cases";
import { RegisterWithOpenFormUseCase, RegisterWithUnlAccountUseCase } from "@/application/event-registration/event-registration.use-cases";
import { Event, type CreateEventInput } from "@/domain/event";
import { ForumMemberSuspendedError } from "@/domain/forum";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryForumMemberRepository, makeForumMember } from "@/tests/fakes/in-memory-forum";

/*
 * D7 (R2, R4, R6): a registered person says they cannot attend and the registration is deleted, which frees the seat.
 * Every refusal is checked for what it must leave behind: the stored rows and the seat count, exactly as they were.
 */
const NOW = new Date("2026-11-20T15:00:00.000Z");
const FORM = { name: "Ana Pérez", email: "ana@example.com", institution: "UNL", career: "Computación", semester: 5 };

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;
let members: InMemoryForumMemberRepository;

async function addEvent(overrides: Partial<CreateEventInput> = {}) {
  const event = Event.create({ title: "Taller de Git", date: "2026-11-28", isPublished: true, registrationMode: "open", ...overrides });

  await events.create(event);

  return event.props;
}

const byLink = () => new CancelRegistrationByLinkUseCase(events, registrations);
const unl = (allowedDomain = "unl.edu.ec") => new CancelUnlRegistrationUseCase(events, registrations, members, { allowedDomain });

/** An open-form registration, confirmed unless told otherwise (the people opened their link). */
async function openPerson(form: Record<string, unknown> = FORM, { confirmed = true }: { confirmed?: boolean } = {}) {
  const outcome = await new RegisterWithOpenFormUseCase(events, registrations).execute({ slug: "taller-de-git", form, now: NOW, confirmNonce: "n" });

  if (outcome.status !== "registered") throw new Error(outcome.status);
  if (confirmed) await registrations.confirm(outcome.registration.eventId, outcome.registration.id, NOW, "n");

  return outcome.registration;
}

async function unlPerson(id: string, email: string) {
  members.members.set(id, makeForumMember({ id, email, displayName: `Persona ${id}` }));

  return new RegisterWithUnlAccountUseCase(events, registrations, members, { allowedDomain: "unl.edu.ec" }).execute({ slug: "taller-de-git", memberId: id, now: NOW });
}

beforeEach(() => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
  members = new InMemoryForumMemberRepository();
});

describe("cancelling with the link of an email", () => {
  it("deletes the registration and frees the seat, and leaves the other people exactly as they were", async () => {
    const event = await addEvent({ registrationCapacity: 2 });
    const ana = await openPerson();
    const luis = await openPerson({ ...FORM, name: "Luis", email: "luis@example.com" });

    expect(await registrations.count(event.id)).toBe(2);

    const outcome = await byLink().execute({ slug: "taller-de-git", eventId: event.id, registrationId: ana.id, now: NOW });

    expect(outcome).toEqual({ status: "cancelled", eventId: event.id });
    expect(registrations.all()).toEqual([expect.objectContaining({ id: luis.id, email: "luis@example.com", confirmedAt: NOW })]);
    expect(await registrations.count(event.id)).toBe(1);
    expect(await registrations.exists(event.id, "ana@example.com")).toBe(false);
  });

  it("gives the freed seat to the next person on a full event", async () => {
    const event = await addEvent({ registrationCapacity: 1 });
    const ana = await openPerson();
    const full = await new RegisterWithOpenFormUseCase(events, registrations).execute({ slug: "taller-de-git", form: { ...FORM, email: "luis@example.com" }, now: NOW });

    expect(full).toEqual({ status: "full" });

    await byLink().execute({ slug: "taller-de-git", eventId: event.id, registrationId: ana.id, now: NOW });

    expect((await new RegisterWithOpenFormUseCase(events, registrations).execute({ slug: "taller-de-git", form: { ...FORM, email: "luis@example.com" }, now: NOW })).status).toBe("registered");
  });

  it("deletes a still-pending registration too: it held no seat, and its personal data goes", async () => {
    const event = await addEvent({ registrationCapacity: 2 });
    const ana = await openPerson(FORM, { confirmed: false });
    const luis = await openPerson({ ...FORM, name: "Luis", email: "luis@example.com" });

    expect(await byLink().execute({ slug: "taller-de-git", eventId: event.id, registrationId: ana.id, now: NOW })).toEqual({ status: "cancelled", eventId: event.id });
    expect(registrations.all().map((row) => row.id)).toEqual([luis.id]);
    expect(await registrations.count(event.id)).toBe(1);
  });

  it("says not_registered the second time, and changes nothing", async () => {
    const event = await addEvent({ registrationCapacity: 2 });
    const ana = await openPerson();
    const luis = await openPerson({ ...FORM, name: "Luis", email: "luis@example.com" });
    const cancel = () => byLink().execute({ slug: "taller-de-git", eventId: event.id, registrationId: ana.id, now: NOW });

    await cancel();
    const before = registrations.all();

    expect(await cancel()).toEqual({ status: "not_registered" });
    expect(registrations.all()).toEqual(before);
    expect(before.map((row) => row.id)).toEqual([luis.id]);
  });

  it("refuses a link issued for another event (invalid) without touching the registration", async () => {
    const event = await addEvent({ registrationCapacity: 2 });
    const other = await addEvent({ title: "Otro taller", registrationCapacity: 2 });
    const ana = await openPerson();
    const before = registrations.all();

    expect(await byLink().execute({ slug: "otro-taller", eventId: event.id, registrationId: ana.id, now: NOW })).toEqual({ status: "invalid" });
    expect(await byLink().execute({ slug: "taller-de-git", eventId: other.id, registrationId: ana.id, now: NOW })).toEqual({ status: "invalid" });
    expect(registrations.all()).toEqual(before);
    expect(await registrations.count(event.id)).toBe(1);
  });

  it("does not cancel someone else's registration with an id from another event or a made-up id", async () => {
    const event = await addEvent({ registrationCapacity: 2 });
    const ana = await openPerson();
    const before = registrations.all();

    expect(await byLink().execute({ slug: "taller-de-git", eventId: event.id, registrationId: "ghost", now: NOW })).toEqual({ status: "not_registered" });
    expect(registrations.all()).toEqual(before);
    expect(ana.id).not.toBe("ghost");
  });

  it("is closed after the registration deadline and after the event day: the rows and the seats stay as they were", async () => {
    const closing = await addEvent({ title: "Cierra", registrationCapacity: 3, registrationDeadline: new Date(NOW.getTime() + 1000) });
    const ana = await new RegisterWithOpenFormUseCase(events, registrations).execute({ slug: "cierra", form: FORM, now: NOW });

    if (ana.status !== "registered") throw new Error(ana.status);
    await registrations.confirm(closing.id, ana.registration.id, NOW, null);

    const later = new Date(NOW.getTime() + 2000);
    const before = registrations.all();

    expect(await byLink().execute({ slug: "cierra", eventId: closing.id, registrationId: ana.registration.id, now: later })).toEqual({ status: "closed" });
    expect(registrations.all()).toEqual(before);
    expect(await registrations.count(closing.id)).toBe(1);

    const past = await addEvent({ title: "Pasado", date: "2026-11-10" });

    registrations.seed({ id: "old", eventId: past.id, mode: "open", name: "Ana", email: "ana@example.com", semester: null, career: null, createdAt: NOW });

    const withPast = registrations.all();

    expect(await byLink().execute({ slug: "pasado", eventId: past.id, registrationId: "old", now: NOW })).toEqual({ status: "closed" });
    expect(registrations.all()).toEqual(withPast);
  });

  it("is not_found for an event that is no longer public (draft, withdrawn) or in the trash, and for an unknown slug; nothing is deleted", async () => {
    const draft = await addEvent({ title: "Borrador", isPublished: false });
    const trashed = await addEvent({ title: "Papelera" });
    const draftRow = { eventId: draft.id, mode: "open" as const, name: "Ana", email: "ana@example.com", semester: null, career: null, createdAt: NOW };

    registrations.seed({ id: "d", ...draftRow });
    registrations.seed({ id: "t", ...draftRow, eventId: trashed.id });
    await events.trash(trashed.id);

    const before = registrations.all();

    expect(await byLink().execute({ slug: "borrador", eventId: draft.id, registrationId: "d", now: NOW })).toEqual({ status: "not_found" });
    expect(await byLink().execute({ slug: "papelera", eventId: trashed.id, registrationId: "t", now: NOW })).toEqual({ status: "not_found" });
    expect(await byLink().execute({ slug: "no-existe", eventId: draft.id, registrationId: "d", now: NOW })).toEqual({ status: "not_found" });
    expect(registrations.all()).toEqual(before);
  });

  it("still cancels after the admin switched the event to another mode (the people registered the old way keep their say)", async () => {
    const event = await addEvent({ registrationCapacity: 2 });
    const ana = await openPerson();
    const live = (await events.getById(event.id))!;

    await events.update(live.update({ registrationMode: "unl" }));

    expect(await byLink().execute({ slug: "taller-de-git", eventId: event.id, registrationId: ana.id, now: NOW })).toEqual({ status: "cancelled", eventId: event.id });
    expect(registrations.all()).toEqual([]);
  });
});

describe("cancelling from the event page as a UNL student", () => {
  it("deletes the member's own registration and frees the seat", async () => {
    const event = await addEvent({ registrationMode: "unl", registrationCapacity: 2 });

    await unlPerson("m1", "ana@unl.edu.ec");
    await unlPerson("m2", "luis@unl.edu.ec");

    expect(await registrations.count(event.id)).toBe(2);
    expect(await unl().execute({ slug: "taller-de-git", memberId: "m1", now: NOW })).toEqual({ status: "cancelled", eventId: event.id });
    expect(registrations.all().map((row) => row.email)).toEqual(["luis@unl.edu.ec"]);
    expect(await registrations.count(event.id)).toBe(1);
  });

  it("never touches another member's registration: a member who is not registered learns only that they are not", async () => {
    const event = await addEvent({ registrationMode: "unl", registrationCapacity: 2 });

    await unlPerson("m1", "ana@unl.edu.ec");
    members.members.set("m2", makeForumMember({ id: "m2", email: "luis@unl.edu.ec" }));

    const before = registrations.all();

    expect(await unl().execute({ slug: "taller-de-git", memberId: "m2", now: NOW })).toEqual({ status: "not_registered" });
    expect(registrations.all()).toEqual(before);
    expect(await registrations.count(event.id)).toBe(1);
  });

  it("says not_registered when the member cancels twice, changing nothing the second time", async () => {
    await addEvent({ registrationMode: "unl", registrationCapacity: 2 });
    await unlPerson("m1", "ana@unl.edu.ec");
    await unlPerson("m2", "luis@unl.edu.ec");
    await unl().execute({ slug: "taller-de-git", memberId: "m1", now: NOW });

    const before = registrations.all();

    expect(await unl().execute({ slug: "taller-de-git", memberId: "m1", now: NOW })).toEqual({ status: "not_registered" });
    expect(registrations.all()).toEqual(before);
  });

  it.each([
    ["a member without the institutional domain", () => members.members.set("m1", makeForumMember({ id: "m1", email: "ana@gmail.com" })), ForbiddenError],
    ["an unknown member", () => undefined, ForbiddenError],
    ["a suspended member", () => members.members.set("m1", makeForumMember({ id: "m1", email: "ana@unl.edu.ec", status: "SUSPENDED" })), ForumMemberSuspendedError],
  ])("refuses %s before reading any registration", async (_label, arrange, error) => {
    await addEvent({ registrationMode: "unl", registrationCapacity: 2 });
    await unlPerson("m9", "luis@unl.edu.ec");
    arrange();

    const before = registrations.all();

    await expect(unl().execute({ slug: "taller-de-git", memberId: "m1", now: NOW })).rejects.toBeInstanceOf(error);
    expect(registrations.all()).toEqual(before);
  });

  it("fails closed without an institutional domain configured", async () => {
    await addEvent({ registrationMode: "unl", registrationCapacity: 2 });
    await unlPerson("m1", "ana@unl.edu.ec");

    const before = registrations.all();

    await expect(unl("").execute({ slug: "taller-de-git", memberId: "m1", now: NOW })).rejects.toBeInstanceOf(ForbiddenError);
    expect(registrations.all()).toEqual(before);
  });

  it("is closed after the deadline, not_found for a draft or trashed event, and leaves the registration in every case", async () => {
    const closing = await addEvent({ title: "Cierra", registrationMode: "unl", registrationDeadline: new Date(NOW.getTime() + 1000) });

    members.members.set("m1", makeForumMember({ id: "m1", email: "ana@unl.edu.ec", displayName: "Ana" }));
    await new RegisterWithUnlAccountUseCase(events, registrations, members, { allowedDomain: "unl.edu.ec" }).execute({ slug: "cierra", memberId: "m1", now: NOW });

    const draft = await addEvent({ title: "Borrador", registrationMode: "unl", isPublished: false });
    const trashed = await addEvent({ title: "Papelera", registrationMode: "unl" });

    for (const event of [draft, trashed]) {
      registrations.seed({ id: `row-${event.id}`, eventId: event.id, mode: "unl", name: "Ana", email: "ana@unl.edu.ec", semester: null, career: null, createdAt: NOW });
    }

    await events.trash(trashed.id);

    const before = registrations.all();

    expect(await unl().execute({ slug: "cierra", memberId: "m1", now: new Date(NOW.getTime() + 2000) })).toEqual({ status: "closed" });
    expect(await unl().execute({ slug: "borrador", memberId: "m1", now: NOW })).toEqual({ status: "not_found" });
    expect(await unl().execute({ slug: "papelera", memberId: "m1", now: NOW })).toEqual({ status: "not_found" });
    expect(await unl().execute({ slug: "no-existe", memberId: "m1", now: NOW })).toEqual({ status: "not_found" });
    expect(registrations.all()).toEqual(before);
    expect(closing.id).toBeTruthy();
  });
});
