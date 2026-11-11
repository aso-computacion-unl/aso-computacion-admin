import { beforeEach, describe, expect, it, vi } from "vitest";

import { BudgetedMailSender } from "@/application/mail/budgeted-mail-sender";
import { REMINDER_MAX_CONSECUTIVE_FAILURES, SendRegistrationRemindersUseCase } from "@/application/event-registration/send-registration-reminders.use-case";
import { Event, type CreateEventInput } from "@/domain/event";
import { reminderEmail } from "@/interface/event-registration/registration-emails";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryMailBudget, RecordingMailTransport } from "@/tests/fakes/in-memory-mail";

// 06:00 in Ecuador, when the daily cron runs. Today is 2026-11-20 there: the window is 21 to 23.
const NOW = new Date("2026-11-20T11:00:00.000Z");
const DAY = 24 * 3_600_000;
const ORIGIN = "https://admin.example.org";

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;
let budget: InMemoryMailBudget;
let transport: RecordingMailTransport;
let sequence = 0;

const build = (event: Parameters<typeof reminderEmail>[0]["event"]) =>
  reminderEmail({ event, eventUrl: `${ORIGIN}/inscripciones/${event.slug}`, calendarUrl: `${ORIGIN}/api/public/events/${event.slug}/calendar.ics` });

const reminders = (limit = 400, transportOverride: RecordingMailTransport | null = transport) =>
  new SendRegistrationRemindersUseCase(events, registrations, new BudgetedMailSender(transportOverride, budget, limit), build);

async function addEvent(date: string | null, overrides: Partial<CreateEventInput> = {}) {
  sequence += 1;

  const event = Event.create({ title: `Evento ${sequence}`, date, isPublished: true, registrationMode: "open", hora: "09:00 - 11:00", lugar: "Laboratorio 2", ...overrides });

  await events.create(event);

  return event.props;
}

/** `count` confirmed people for the event; returns their emails. */
function addPeople(eventId: string, count: number, overrides: Partial<Parameters<InMemoryEventRegistrationRepository["seed"]>[0]> = {}): string[] {
  return Array.from({ length: count }, () => {
    sequence += 1;

    const email = `p${sequence}@example.com`;

    registrations.seed({ id: `r-${sequence}`, eventId, mode: "open", name: `Persona ${sequence}`, email, career: null, semester: null, createdAt: new Date(NOW.getTime() - sequence * 1000), ...overrides });

    return email;
  });
}

const day = (offset: number, from: Date = NOW) => new Date(from.getTime() + offset * DAY).toISOString().slice(0, 10);
const remindedEmails = () => registrations.all().filter((row) => row.reminderSentAt !== null).map((row) => row.email).sort();
const delivered = () => transport.delivered.map((message) => message.to);

beforeEach(() => {
  sequence = 0;
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
  budget = new InMemoryMailBudget();
  transport = new RecordingMailTransport();
});

describe("SendRegistrationRemindersUseCase", () => {
  it("emails each confirmed person of an event one to three days ahead, once, and records when", async () => {
    const event = await addEvent(day(2));
    const emails = addPeople(event.id, 3);

    const result = await reminders().execute({ now: NOW });

    expect(result).toEqual({ sent: 3, failed: 0, events: 1, stoppedBy: "done" });
    expect(delivered().sort()).toEqual([...emails].sort());
    expect(registrations.all().every((row) => row.reminderSentAt?.getTime() === NOW.getTime())).toBe(true);
  });

  it("writes the title, the date and time, the place, the event page and the calendar file", async () => {
    const event = await addEvent("2026-11-22", { title: "Taller de Git" });

    addPeople(event.id, 1);
    await reminders().execute({ now: NOW });

    const [mail] = transport.delivered;

    expect(mail!.subject).toBe("Recordatorio: «Taller de Git», domingo 22 de noviembre de 2026");
    for (const part of ["Taller de Git", "domingo 22 de noviembre de 2026, 09:00 - 11:00", "Laboratorio 2", `${ORIGIN}/inscripciones/${event.slug}`, `${ORIGIN}/api/public/events/${event.slug}/calendar.ics`]) {
      expect(mail!.text).toContain(part);
      expect(mail!.html).toContain(part);
    }
  });

  it("reminds people who registered with a UNL account, too", async () => {
    const event = await addEvent(day(1), { registrationMode: "unl" });

    addPeople(event.id, 1, { mode: "unl", email: "ana@unl.edu.ec" });
    await reminders().execute({ now: NOW });

    expect(delivered()).toEqual(["ana@unl.edu.ec"]);
  });

  it("covers exactly one to three days ahead in Ecuador, both ends included", async () => {
    const dates = [day(-1), day(0), day(1), day(2), day(3), day(4)];

    for (const date of dates) addPeople((await addEvent(date)).id, 1);

    await reminders().execute({ now: NOW });

    const expected = [dates[2], dates[3], dates[4]];
    const reached = registrations.all().filter((row) => row.reminderSentAt !== null).map((row) => row.eventId);

    expect(reached).toHaveLength(3);
    expect((await Promise.all(reached.map((id) => events.getById(id)))).map((event) => event!.props.date).sort()).toEqual(expected);
  });

  it("counts the day in Ecuador: just before midnight there the window is still the day before's", async () => {
    const early = new Date("2026-11-20T04:59:00.000Z");
    const edge = await addEvent("2026-11-20");

    addPeople(edge.id, 1);

    // It is still the 19th in Ecuador, so the 20th is one day ahead.
    expect((await reminders().execute({ now: early })).sent).toBe(1);
  });

  it("leaves out people who never confirmed, who were already reminded, and events that are not public or have no exact day", async () => {
    const event = await addEvent(day(2));
    const [confirmed] = addPeople(event.id, 1);

    addPeople(event.id, 1, { confirmedAt: null });
    addPeople(event.id, 1, { reminderSentAt: new Date(NOW.getTime() - DAY) });
    addPeople((await addEvent(day(2), { isPublished: false })).id, 1);
    addPeople((await addEvent(day(2), { publishAt: new Date(NOW.getTime() + DAY) })).id, 1);
    addPeople((await addEvent(day(2), { publishAt: new Date(NOW.getTime() - 3 * DAY), unpublishAt: new Date(NOW.getTime() - DAY) })).id, 1);
    addPeople((await addEvent(day(2), { datePrecision: "month" })).id, 1);
    addPeople((await addEvent(null)).id, 1);

    const trashed = await addEvent(day(2));

    addPeople(trashed.id, 1);
    await events.trash(trashed.id);
    await reminders().execute({ now: NOW });

    expect(delivered()).toEqual([confirmed]);
  });

  it("sends nearest events first and stops at the day's budget; the rest stay eligible", async () => {
    const far = await addEvent(day(3), { title: "Lejano" });
    const near = await addEvent(day(1), { title: "Cercano" });
    const middle = await addEvent(day(2), { title: "Medio" });
    const nearEmails = addPeople(near.id, 2);
    const middleEmails = addPeople(middle.id, 3);

    addPeople(far.id, 4);

    // Reminders only get 70 % of the cap (D12, reminder-budget-share.test.ts): a cap of 6 lets 4 go out.
    const result = await reminders(6).execute({ now: NOW });

    expect(result).toMatchObject({ sent: 4, stoppedBy: "budget" });
    expect(delivered().slice(0, 2).sort()).toEqual([...nearEmails].sort());
    expect(delivered().slice(2).every((email) => middleEmails.includes(email))).toBe(true);
    expect(remindedEmails().filter((email) => !nearEmails.includes(email) && !middleEmails.includes(email))).toEqual([]);
    expect(registrations.all().filter((row) => row.reminderSentAt === null)).toHaveLength(5);
  });

  it("goes on the next day from where it stopped, still nearest first, and never sends twice", async () => {
    const near = await addEvent(day(1));
    const middle = await addEvent(day(2));

    addPeople(near.id, 2);
    addPeople(middle.id, 3);

    // A cap of 5 is 3 reminders a day (70 %, rounded down: D12).
    const today = reminders(5);

    await today.execute({ now: NOW });

    expect(delivered()).toHaveLength(3);
    // Tomorrow the budget is fresh; the middle event is now the nearest, and its leftovers are due.
    const tomorrow = new Date(NOW.getTime() + DAY);
    const second = await today.execute({ now: tomorrow });

    expect(second).toMatchObject({ sent: 2, stoppedBy: "done" });
    expect(delivered()).toHaveLength(5);
    expect(new Set(delivered()).size).toBe(5);
    expect(registrations.all().every((row) => row.reminderSentAt !== null)).toBe(true);
  });

  it("shares the day's budget with every other send: only what is left of it goes to reminders", async () => {
    const event = await addEvent(day(1));

    addPeople(event.id, 5);
    await budget.reserve("2026-11-20", 400);
    await budget.reserve("2026-11-20", 400);
    await budget.reserve("2026-11-20", 400);

    // A cap of 8 gives reminders 5 (70 %, rounded down: D12); the 3 already spent today count against them, so 2 go out.
    const result = await reminders(8).execute({ now: NOW });

    expect(result).toMatchObject({ sent: 2, stoppedBy: "budget" });
    expect(await budget.used("2026-11-20")).toBe(5);
  });

  it("is idempotent: running again right away sends nothing", async () => {
    const event = await addEvent(day(1));

    addPeople(event.id, 3);
    await reminders().execute({ now: NOW });

    expect(await reminders().execute({ now: NOW })).toEqual({ sent: 0, failed: 0, events: 1, stoppedBy: "done" });
    expect(delivered()).toHaveLength(3);
  });

  it("keeps a failed send eligible, gives its budget back, and sends it on the next run", async () => {
    const event = await addEvent(day(1));
    const [good, bad] = addPeople(event.id, 2);

    transport.failing.add(bad!);

    const first = await reminders().execute({ now: NOW });

    expect(first).toEqual({ sent: 1, failed: 1, events: 1, stoppedBy: "done" });
    expect(remindedEmails()).toEqual([good]);
    expect(await budget.used("2026-11-20")).toBe(1);

    transport.failing.clear();

    expect(await reminders().execute({ now: NOW })).toMatchObject({ sent: 1, failed: 0 });
    expect(remindedEmails()).toEqual([good, bad].sort());
    expect(delivered().filter((email) => email === good)).toHaveLength(1);
  });

  it("gives up for the day after several failures in a row: the provider is down, not the addresses", async () => {
    const event = await addEvent(day(1));
    const emails = addPeople(event.id, REMINDER_MAX_CONSECUTIVE_FAILURES + 4);

    for (const email of emails) transport.failing.add(email);

    const result = await reminders().execute({ now: NOW });

    expect(result).toEqual({ sent: 0, failed: REMINDER_MAX_CONSECUTIVE_FAILURES, events: 1, stoppedBy: "provider" });
    expect(remindedEmails()).toEqual([]);
  });

  it("a success resets the run of failures", async () => {
    const event = await addEvent(day(1));
    const emails = addPeople(event.id, 2 * REMINDER_MAX_CONSECUTIVE_FAILURES);

    // Alternate failing and good addresses: never enough failures in a row to give up.
    emails.forEach((email, index) => index % 2 === 0 && transport.failing.add(email));

    const result = await reminders().execute({ now: NOW });

    expect(result).toMatchObject({ sent: REMINDER_MAX_CONSECUTIVE_FAILURES, failed: REMINDER_MAX_CONSECUTIVE_FAILURES, stoppedBy: "done" });
  });

  it("S5: a message that cannot be built (its link fails to sign) counts as failed and stays due; the run goes on with the others", async () => {
    const event = await addEvent(day(1));
    const emails = addPeople(event.id, 3);
    const broken = registrations.all().find((row) => row.email === emails[0])!.id;
    const throwing = new SendRegistrationRemindersUseCase(events, registrations, new BudgetedMailSender(transport, budget, 400), (built, person) => {
      if (person.id === broken) throw new Error("REGISTRATION_CONFIRM_SECRET must be defined");

      return build(built);
    });

    expect(await throwing.execute({ now: NOW })).toEqual({ sent: 2, failed: 1, events: 1, stoppedBy: "done" });
    expect(remindedEmails()).toEqual([emails[1]!, emails[2]!].sort());
    expect(delivered()).not.toContain(emails[0]);
  });

  it("sends nothing and marks nothing while mail is not configured", async () => {
    const event = await addEvent(day(1));

    addPeople(event.id, 2);

    expect(await reminders(400, null).execute({ now: NOW })).toEqual({ sent: 0, failed: 0, events: 0, stoppedBy: "not_configured" });
    expect(remindedEmails()).toEqual([]);
    expect(await budget.used("2026-11-20")).toBe(0);
  });

  it("sends nothing while the message cannot be built (no public origin for its links)", async () => {
    const event = await addEvent(day(1));

    addPeople(event.id, 2);

    const noLinks = new SendRegistrationRemindersUseCase(events, registrations, new BudgetedMailSender(transport, budget, 400), null);

    expect(await noLinks.execute({ now: NOW })).toMatchObject({ sent: 0, stoppedBy: "not_configured" });
    expect(delivered()).toEqual([]);
  });

  it("stops starting sends when told the time is up, leaving the rest for the next run", async () => {
    const event = await addEvent(day(1));

    addPeople(event.id, 5);

    let calls = 0;
    const result = await reminders().execute({ now: NOW, shouldStop: () => (calls += 1) > 2 });

    expect(result).toMatchObject({ sent: 2, stoppedBy: "time" });
    expect(registrations.all().filter((row) => row.reminderSentAt === null)).toHaveLength(3);
  });

  it("does nothing, touching no mail, when no event is in the window", async () => {
    await addEvent(day(10));
    const send = vi.spyOn(transport, "deliver");

    expect(await reminders().execute({ now: NOW })).toEqual({ sent: 0, failed: 0, events: 0, stoppedBy: "done" });
    expect(send).not.toHaveBeenCalled();
  });
});
