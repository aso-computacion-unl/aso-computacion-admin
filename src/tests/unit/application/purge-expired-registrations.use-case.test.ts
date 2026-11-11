import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PURGE_BATCH_SIZE,
  PURGE_MAX_BATCHES,
  PurgeExpiredRegistrationsUseCase,
  PurgeInterruptedError,
} from "@/application/event-registration/purge-expired-registrations.use-case";
import type { EventRegistrationRecord } from "@/application/ports/event-registration-repository.port";
import { Event, type CreateEventInput } from "@/domain/event";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRegistrationRetentionStore } from "@/tests/fakes/in-memory-event-registration-retention.store";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";

// Event on 2026-01-10: its registrations expire at 2026-04-11T05:00:00Z (90 days after the day ends in Ecuador).
const EXPIRY = new Date("2026-04-11T05:00:00.000Z");

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;
let store: InMemoryEventRegistrationRetentionStore;
let sequence = 0;

async function addEvent(overrides: Partial<CreateEventInput> = {}) {
  const event = Event.create({ title: `Evento ${(sequence += 1)}`, date: "2026-01-10", isPublished: true, registrationMode: "open", ...overrides });

  await events.create(event);

  return event.props;
}

function addPeople(eventId: string, count: number, overrides: Partial<EventRegistrationRecord> = {}) {
  for (let index = 0; index < count; index += 1) {
    sequence += 1;
    registrations.seed({ id: `r-${sequence}`, eventId, mode: "open", name: `Persona ${sequence}`, email: `p${sequence}@example.com`, career: null, semester: null, createdAt: new Date("2025-12-01T00:00:00Z"), ...overrides });
  }
}

const purge = () => new PurgeExpiredRegistrationsUseCase(store);

beforeEach(() => {
  sequence = 0;
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
  store = new InMemoryEventRegistrationRetentionStore(events, registrations);
});

describe("PurgeExpiredRegistrationsUseCase", () => {
  it("deletes the registrations of an event exactly 90 days after it ended (inclusive) and reports the count", async () => {
    const event = await addEvent();

    addPeople(event.id, 3);

    expect(await purge().execute(new Date(EXPIRY.getTime() - 1))).toEqual({ deleted: 0 });
    expect(registrations.all()).toHaveLength(3);

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 3 });
    expect(registrations.all()).toHaveLength(0);
  });

  it("leaves events newer than 90 days, future events and undated events untouched", async () => {
    const recent = await addEvent({ date: "2026-02-20" });
    const future = await addEvent({ date: "2099-01-01" });
    const undated = await addEvent({ date: null });
    const old = await addEvent({ date: "2025-06-01" });

    for (const event of [recent, future, undated, old]) {
      addPeople(event.id, 2);
    }

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 2 });
    expect(registrations.all().map((row) => row.eventId).sort()).toEqual([recent.id, recent.id, future.id, future.id, undated.id, undated.id].sort());
  });

  it("deletes only registrations: the expired event itself stays", async () => {
    const event = await addEvent();

    addPeople(event.id, 1);
    await purge().execute(EXPIRY);

    expect(await events.getById(event.id)).not.toBeNull();
  });

  it("also purges the registrations of an expired event that sits in the trash", async () => {
    const event = await addEvent();

    addPeople(event.id, 2);
    await events.trash(event.id);

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 2 });
  });

  it("treats a month-precision event as ending with its month", async () => {
    const event = await addEvent({ date: "2026-01-01", datePrecision: "month" });

    addPeople(event.id, 1);

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 0 });
    expect(await purge().execute(new Date("2026-05-02T05:00:00.000Z"))).toEqual({ deleted: 1 });
  });

  it("is idempotent: a second run right after finds nothing", async () => {
    const event = await addEvent();

    addPeople(event.id, 4);

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 4 });
    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 0 });
  });

  it("deletes in bounded batches and stops at the cap, leaving the rest for the next run", async () => {
    const event = await addEvent();

    addPeople(event.id, PURGE_BATCH_SIZE * PURGE_MAX_BATCHES + 5);

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: PURGE_BATCH_SIZE * PURGE_MAX_BATCHES });
    expect(store.batches).toHaveLength(PURGE_MAX_BATCHES);
    expect(store.batches.every((batch) => batch.limit === PURGE_BATCH_SIZE)).toBe(true);
    expect(registrations.all()).toHaveLength(5);

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 5 });
  });

  it("stops after the first batch that comes back short", async () => {
    const event = await addEvent();

    addPeople(event.id, PURGE_BATCH_SIZE + 1);

    await purge().execute(EXPIRY);

    expect(store.batches.map((batch) => batch.deleted)).toEqual([PURGE_BATCH_SIZE, 1]);
  });

  it("does not touch the database for deletion when no event has expired", async () => {
    const event = await addEvent({ date: "2026-03-01" });

    addPeople(event.id, 1);

    expect(await purge().execute(EXPIRY)).toEqual({ deleted: 0 });
    expect(store.batches).toEqual([]);
  });

  it("when a batch fails midway, throws an error that says how many rows were already gone and keeps the cause", async () => {
    const event = await addEvent();
    const cause = new Error("connection reset");

    addPeople(event.id, PURGE_BATCH_SIZE * 2);

    const real = store.deleteBatch.bind(store);
    const spy = vi.spyOn(store, "deleteBatch").mockImplementationOnce(real).mockRejectedValueOnce(cause);
    const failure = await purge().execute(EXPIRY).catch((error: unknown) => error);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(failure).toBeInstanceOf(PurgeInterruptedError);
    expect((failure as PurgeInterruptedError).deleted).toBe(PURGE_BATCH_SIZE);
    expect((failure as PurgeInterruptedError).cause).toBe(cause);
    expect(registrations.all()).toHaveLength(PURGE_BATCH_SIZE);
  });

  it("when nothing was deleted yet, lets the original error through", async () => {
    const event = await addEvent();
    const cause = new Error("db down");

    addPeople(event.id, 1);
    vi.spyOn(store, "deleteBatch").mockRejectedValue(cause);

    await expect(purge().execute(EXPIRY)).rejects.toBe(cause);
  });

  describe("pending registrations (email never confirmed)", () => {
    const stored = new Date("2026-04-09T05:00:00.000Z");
    const WINDOW_END = new Date(stored.getTime() + 48 * 60 * 60 * 1000);

    it("deletes a pending row exactly 48 h after it was stored and not a millisecond before, whatever its event", async () => {
      const future = await addEvent({ date: "2099-01-01" });

      addPeople(future.id, 2, { confirmedAt: null, createdAt: stored });

      expect(await purge().execute(new Date(WINDOW_END.getTime() - 1))).toEqual({ deleted: 0 });
      expect(registrations.all()).toHaveLength(2);

      expect(await purge().execute(WINDOW_END)).toEqual({ deleted: 2 });
      expect(registrations.all()).toHaveLength(0);
      expect(await events.getById(future.id)).not.toBeNull();
    });

    it("keeps a confirmed registration of a future event and a recent pending one", async () => {
      const future = await addEvent({ date: "2099-01-01" });

      addPeople(future.id, 1, { createdAt: stored });
      addPeople(future.id, 1, { confirmedAt: null, createdAt: new Date(WINDOW_END.getTime() - 1000) });

      expect(await purge().execute(WINDOW_END)).toEqual({ deleted: 0 });
      expect(registrations.all()).toHaveLength(2);
    });

    it("counts the pending rows of an expired event once, with the rest of that event's rows", async () => {
      const old = await addEvent();

      addPeople(old.id, 2);
      addPeople(old.id, 3, { confirmedAt: null, createdAt: stored });

      expect(await purge().execute(EXPIRY)).toEqual({ deleted: 5 });
      expect(store.batches.map((batch) => batch.deleted)).toEqual([5]);
      expect(store.pendingBatches.map((batch) => batch.deleted)).toEqual([0]);
    });

    it("reports how many rows were already gone when the pending purge fails after the event purge deleted some", async () => {
      const old = await addEvent();
      const cause = new Error("connection reset");

      addPeople(old.id, 2);
      vi.spyOn(store, "deleteStalePendingBatch").mockRejectedValue(cause);

      const failure = await purge().execute(EXPIRY).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(PurgeInterruptedError);
      expect((failure as PurgeInterruptedError).deleted).toBe(2);
      expect((failure as PurgeInterruptedError).cause).toBe(cause);
    });
  });
});
