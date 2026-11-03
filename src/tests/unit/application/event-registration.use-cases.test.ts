import { beforeEach, describe, expect, it } from "vitest";

import { ForbiddenError, NotFoundError } from "@/application";
import {
  DeleteEventRegistrationUseCase,
  GetEventRegistrationStatusUseCase,
  ListEventRegistrationsUseCase,
  RegisterWithOpenFormUseCase,
  RegisterWithUnlAccountUseCase,
} from "@/application/event-registration/event-registration.use-cases";
import { Event, type CreateEventInput } from "@/domain/event";
import { ForumMemberSuspendedError } from "@/domain/forum";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryForumMemberRepository, makeForumMember } from "@/tests/fakes/in-memory-forum";

const NOW = new Date("2026-11-20T15:00:00.000Z");
const FORM = { name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5 };

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;
let members: InMemoryForumMemberRepository;

async function addEvent(overrides: Partial<CreateEventInput> = {}) {
  const event = Event.create({ title: "Taller de Git", date: "2026-11-28", isPublished: true, registrationMode: "open", ...overrides });

  await events.create(event);

  return event.props;
}

const openForm = () => new RegisterWithOpenFormUseCase(events, registrations);
const unlAccount = (allowedDomain = "unl.edu.ec") => new RegisterWithUnlAccountUseCase(events, registrations, members, { allowedDomain });

beforeEach(() => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
  members = new InMemoryForumMemberRepository();
});

describe("registration mode", () => {
  it("accepts nothing for an event without registration", async () => {
    await addEvent({ registrationMode: "none" });

    expect(await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW })).toEqual({ status: "mode_mismatch" });
    expect(registrations.all()).toHaveLength(0);
  });

  it("does not let the open form into an event that asked for a UNL account, nor the reverse", async () => {
    await addEvent({ registrationMode: "unl" });
    members.members.set("m1", makeForumMember({ id: "m1" }));

    expect(await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW })).toEqual({ status: "mode_mismatch" });
    expect(registrations.all()).toHaveLength(0);

    events = new InMemoryEventRepository();
    registrations = new InMemoryEventRegistrationRepository(events);
    await addEvent({ registrationMode: "open" });

    expect(await unlAccount().execute({ slug: "taller-de-git", memberId: "m1", now: NOW })).toEqual({ status: "mode_mismatch" });
  });

  it("registers through the open form with exactly the data it collects", async () => {
    await addEvent();

    const outcome = await openForm().execute({ slug: "taller-de-git", form: { ...FORM, email: " ANA@Example.com ", extra: "ignored" }, now: NOW });

    expect(outcome.status).toBe("registered");
    expect(registrations.all()).toEqual([expect.objectContaining({ mode: "open", name: "Ana Pérez", email: "ana@example.com", career: "Computación", semester: 5 })]);
    expect(Object.keys(registrations.all()[0]!).sort()).toEqual(["career", "createdAt", "email", "eventId", "id", "mode", "name", "semester"]);
  });

  it("registers a UNL member with the verified name and email, and no career or semester", async () => {
    await addEvent({ registrationMode: "unl" });
    members.members.set("m1", makeForumMember({ id: "m1", email: "ana@unl.edu.ec", displayName: "Ana Pérez" }));

    expect((await unlAccount().execute({ slug: "taller-de-git", memberId: "m1", now: NOW })).status).toBe("registered");
    expect(registrations.all()).toEqual([expect.objectContaining({ mode: "unl", name: "Ana Pérez", email: "ana@unl.edu.ec", career: null, semester: null })]);
  });

  it("refuses a suspended member, an unknown member and an email outside the institutional domain", async () => {
    await addEvent({ registrationMode: "unl" });
    members.members.set("sus", makeForumMember({ id: "sus", status: "SUSPENDED" }));
    members.members.set("out", makeForumMember({ id: "out", email: "ana@gmail.com" }));

    await expect(unlAccount().execute({ slug: "taller-de-git", memberId: "sus", now: NOW })).rejects.toBeInstanceOf(ForumMemberSuspendedError);
    await expect(unlAccount().execute({ slug: "taller-de-git", memberId: "out", now: NOW })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(unlAccount().execute({ slug: "taller-de-git", memberId: "ghost", now: NOW })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(unlAccount("").execute({ slug: "taller-de-git", memberId: "sus", now: NOW })).rejects.toBeInstanceOf(ForbiddenError);
    expect(registrations.all()).toHaveLength(0);
  });

  it("does not accept an invalid open form, naming the field", async () => {
    await addEvent();

    await expect(openForm().execute({ slug: "taller-de-git", form: { ...FORM, semester: 40 }, now: NOW })).rejects.toThrow(
      expect.objectContaining({ name: "ValidationError", field: "semester" }),
    );
    expect(registrations.all()).toHaveLength(0);
  });

  it("treats an unknown, draft or scheduled event as not found", async () => {
    await addEvent({ slug: "borrador", title: "Borrador", isPublished: false });
    await addEvent({ slug: "futuro", title: "Futuro", publishAt: new Date("2026-12-01T00:00:00.000Z") });

    for (const slug of ["nada", "borrador", "futuro"]) {
      expect(await openForm().execute({ slug, form: FORM, now: NOW })).toEqual({ status: "not_found" });
    }
  });
});

describe("deadline, capacity and duplicates", () => {
  it("refuses after the deadline and stores nothing", async () => {
    await addEvent({ registrationDeadline: new Date("2026-11-20T14:59:59.000Z") });

    expect(await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW })).toEqual({ status: "closed" });
    expect(registrations.all()).toHaveLength(0);
  });

  it("refuses when the seats are taken, and the person who was already in keeps theirs", async () => {
    await addEvent({ registrationCapacity: 1 });
    await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW });

    expect(await openForm().execute({ slug: "taller-de-git", form: { ...FORM, email: "luis@example.com" }, now: NOW })).toEqual({ status: "full" });
    expect(registrations.all()).toHaveLength(1);
  });

  it("refuses the same email twice and leaves the first registration as it was", async () => {
    await addEvent();
    await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW });
    const [first] = registrations.all();

    const again = await openForm().execute({ slug: "taller-de-git", form: { ...FORM, name: "Otro Nombre", career: "Otra", semester: 9, email: "ANA@example.com" }, now: new Date(NOW.getTime() + 1000) });

    expect(again).toEqual({ status: "duplicate" });
    expect(registrations.all()).toEqual([first]);
  });

  it("lets the same email register for two different events", async () => {
    await addEvent();
    await addEvent({ title: "Charla de Linux" });

    expect((await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW })).status).toBe("registered");
    expect((await openForm().execute({ slug: "charla-de-linux", form: FORM, now: NOW })).status).toBe("registered");
  });
});

describe("registration status", () => {
  const status = (email?: string, memberId?: string) =>
    new GetEventRegistrationStatusUseCase(events, registrations, members).execute({ slug: "taller-de-git", now: NOW, email, memberId });

  it("is null without registration or for an event that is not public", async () => {
    await addEvent({ registrationMode: "none" });

    expect(await status()).toBeNull();
  });

  it("reports open, full and closed, and whether this person is already in", async () => {
    await addEvent({ registrationMode: "unl", registrationCapacity: 1 });

    expect(await status("ana@unl.edu.ec")).toMatchObject({ mode: "unl", state: "open", alreadyRegistered: false, capacity: 1 });

    members.members.set("m1", makeForumMember({ id: "m1" }));
    await unlAccount().execute({ slug: "taller-de-git", memberId: "m1", now: NOW });

    expect(await status("ana@unl.edu.ec")).toMatchObject({ state: "full", alreadyRegistered: true });
    expect(await status("luis@unl.edu.ec")).toMatchObject({ state: "full", alreadyRegistered: false });
    expect(await status(undefined, "m1")).toMatchObject({ alreadyRegistered: true });
    expect(await status(undefined, "ghost")).toMatchObject({ alreadyRegistered: false });
    expect(await new GetEventRegistrationStatusUseCase(events, registrations).execute({ slug: "taller-de-git", now: new Date("2026-12-01T12:00:00.000Z") })).toMatchObject({ state: "closed" });
  });
});

describe("listing and deleting registrations", () => {
  it("lists a known event's registrations oldest first, and refuses an unknown event", async () => {
    const event = await addEvent();
    await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW });
    await openForm().execute({ slug: "taller-de-git", form: { ...FORM, email: "luis@example.com", name: "Luis" }, now: new Date(NOW.getTime() + 60_000) });

    const listing = await new ListEventRegistrationsUseCase(events, registrations).execute({ eventId: event.id });

    expect(listing.registrations.map((row) => row.name)).toEqual(["Ana Pérez", "Luis"]);
    expect(listing.event).toMatchObject({ title: "Taller de Git", registrationCapacity: null });
    await expect(new ListEventRegistrationsUseCase(events, registrations).execute({ eventId: "ghost" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deletes one registration of that event only, frees the seat, and says so when it is not there", async () => {
    const event = await addEvent({ registrationCapacity: 1 });
    await openForm().execute({ slug: "taller-de-git", form: FORM, now: NOW });
    const [registration] = registrations.all();
    const remove = new DeleteEventRegistrationUseCase(registrations);

    await expect(remove.execute({ eventId: "other-event", registrationId: registration!.id })).rejects.toBeInstanceOf(NotFoundError);
    expect(registrations.all()).toHaveLength(1);

    await remove.execute({ eventId: event.id, registrationId: registration!.id });

    expect(registrations.all()).toHaveLength(0);
    expect((await openForm().execute({ slug: "taller-de-git", form: { ...FORM, email: "luis@example.com" }, now: NOW })).status).toBe("registered");
    await expect(remove.execute({ eventId: event.id, registrationId: registration!.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});
