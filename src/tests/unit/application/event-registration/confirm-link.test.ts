import { beforeEach, describe, expect, it } from "vitest";

import { ConfirmOpenRegistrationUseCase, RegisterWithOpenFormUseCase } from "@/application/event-registration/event-registration.use-cases";
import { Event } from "@/domain/event";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";

/*
 * D9 (R4): registering again while pending replaces the confirmation link; only the latest one confirms.
 * The link names the registration and the attempt (a nonce stored on the pending row).
 */
const NOW = new Date("2026-11-20T15:00:00.000Z");
const HOUR = 3_600_000;
const FORM = { name: "Ana Pérez", email: "ana@example.com", institution: "UNL", career: "Computación", semester: 5 };

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;
let eventId: string;

const register = (confirmNonce: string | undefined, now = NOW, form: Record<string, unknown> = FORM) => new RegisterWithOpenFormUseCase(events, registrations).execute({ slug: "taller-de-git", form, now, confirmNonce });
const confirm = (nonce: string | null, now = NOW) => new ConfirmOpenRegistrationUseCase(events, registrations).execute({ slug: "taller-de-git", eventId, registrationId: only().id, nonce, now });
const only = () => registrations.all()[0]!;

beforeEach(async () => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);

  const event = Event.create({ title: "Taller de Git", date: "2026-11-28", isPublished: true, registrationMode: "open", registrationCapacity: 5 });

  await events.create(event);
  eventId = event.props.id;
});

describe("confirmation links are bound to the latest attempt (D9)", () => {
  it("confirms with the link of the attempt that is stored", async () => {
    await register("attempt-1");

    expect(await confirm("attempt-1", new Date(NOW.getTime() + HOUR))).toEqual({ status: "confirmed", registration: expect.objectContaining({ email: "ana@example.com" }) });
    expect(await registrations.count(eventId)).toBe(1);
  });

  it("refuses the first link once the same email registered again, and leaves the pending row as it was", async () => {
    await register("attempt-1");
    const again = await register("attempt-2", new Date(NOW.getTime() + HOUR));

    expect(again).toMatchObject({ status: "registered" });

    const before = registrations.all();

    expect(await confirm("attempt-1", new Date(NOW.getTime() + 2 * HOUR))).toEqual({ status: "invalid" });
    expect(registrations.all()).toEqual(before);
    expect(only().confirmedAt).toBeNull();
    expect(await registrations.count(eventId)).toBe(0);
  });

  it("keeps the same row and lets only the newest link confirm it", async () => {
    await register("attempt-1");
    const firstId = only().id;

    await register("attempt-2", new Date(NOW.getTime() + HOUR));
    await register("attempt-3", new Date(NOW.getTime() + 2 * HOUR));

    expect(registrations.all()).toHaveLength(1);
    expect(only().id).toBe(firstId);
    expect(await confirm("attempt-2", new Date(NOW.getTime() + 3 * HOUR))).toEqual({ status: "invalid" });
    expect(await confirm(null, new Date(NOW.getTime() + 3 * HOUR))).toEqual({ status: "invalid" });
    expect(only().confirmedAt).toBeNull();
    expect(await confirm("attempt-3", new Date(NOW.getTime() + 3 * HOUR))).toMatchObject({ status: "confirmed" });
  });

  it("answers an old link of an already confirmed registration as invalid, and the current one as already confirmed", async () => {
    await register("attempt-1");
    await register("attempt-2", new Date(NOW.getTime() + HOUR));
    await confirm("attempt-2", new Date(NOW.getTime() + 2 * HOUR));

    expect(await confirm("attempt-1", new Date(NOW.getTime() + 3 * HOUR))).toEqual({ status: "invalid" });
    expect(await confirm("attempt-2", new Date(NOW.getTime() + 3 * HOUR))).toMatchObject({ status: "already_confirmed" });
  });

  it("does not expose the nonce in the stored record that admin lists and exports read", async () => {
    await register("attempt-1");

    expect(JSON.stringify(only())).not.toContain("attempt-1");
  });

  it("keeps a pending row from before the change (no nonce) confirmable with a link that carries none, until it is registered again", async () => {
    registrations.seed({ id: "legacy", eventId, mode: "open", name: "Ana Pérez", email: "ana@example.com", institution: "UNL", career: null, semester: null, createdAt: NOW, confirmedAt: null });

    expect(await registrations.confirm(eventId, "legacy", new Date(NOW.getTime() + HOUR))).toMatchObject({ status: "confirmed" });

    registrations.clear();
    registrations.seed({ id: "legacy", eventId, mode: "open", name: "Ana Pérez", email: "ana@example.com", institution: "UNL", career: null, semester: null, createdAt: NOW, confirmedAt: null });

    await register("attempt-1", new Date(NOW.getTime() + HOUR));

    expect(await confirm(null, new Date(NOW.getTime() + 2 * HOUR))).toEqual({ status: "invalid" });
    expect(await confirm("attempt-1", new Date(NOW.getTime() + 2 * HOUR))).toMatchObject({ status: "confirmed" });
  });

  it("still tells an unknown registration apart: no such row is invalid whatever the nonce", async () => {
    await register("attempt-1");

    expect(await new ConfirmOpenRegistrationUseCase(events, registrations).execute({ slug: "taller-de-git", eventId, registrationId: "ghost", nonce: "attempt-1", now: NOW })).toEqual({ status: "invalid" });
  });
});
