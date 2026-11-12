import { beforeEach, describe, expect, it } from "vitest";

import { BudgetedMailSender } from "@/application/mail/budgeted-mail-sender";
import { SendRegistrationRemindersUseCase } from "@/application/event-registration/send-registration-reminders.use-case";
import { Event } from "@/domain/event";
import { REMINDER_SHARE_OF_DAILY_MAIL, reminderMailAllowance } from "@/domain/registration-reminder";
import { reminderEmail } from "@/interface/event-registration/registration-emails";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryMailBudget, RecordingMailTransport } from "@/tests/fakes/in-memory-mail";

/*
 * D12 (R4, R6): reminders may use at most about 70 % of the day's mail cap (rounded down); the rest stays for
 * confirmation emails, which may still use everything that is left.
 */
const NOW = new Date("2026-11-20T11:00:00.000Z");
const TODAY = "2026-11-20";
const ORIGIN = "https://admin.example.org";

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;
let budget: InMemoryMailBudget;
let transport: RecordingMailTransport;
let eventId: string;
let people = 0;

const build = (event: Parameters<typeof reminderEmail>[0]["event"]) => reminderEmail({ event, eventUrl: `${ORIGIN}/inscripciones/${event.slug}`, calendarUrl: `${ORIGIN}/api/public/events/${event.slug}/calendar.ics` });
const sender = (cap: number) => new BudgetedMailSender(transport, budget, cap);
const reminders = (cap: number) => new SendRegistrationRemindersUseCase(events, registrations, sender(cap), build);

function addPeople(count: number) {
  for (let index = 0; index < count; index += 1) {
    people += 1;
    registrations.seed({ id: `r-${people}`, eventId, mode: "open", name: `Persona ${people}`, email: `p${people}@example.com`, career: null, semester: null, createdAt: new Date(NOW.getTime() - people * 1000) });
  }
}

const reminded = () => registrations.all().filter((row) => row.reminderSentAt !== null).length;
const confirmation = (to: string) => ({ to, subject: "Confirme su cupo", text: "enlace" });

beforeEach(async () => {
  people = 0;
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
  budget = new InMemoryMailBudget();
  transport = new RecordingMailTransport();

  const event = Event.create({ title: "Taller", date: "2026-11-22", isPublished: true, registrationMode: "open", hora: "09:00", lugar: "Lab 2" });

  await events.create(event);
  eventId = event.props.id;
});

describe("the reminders' share of the daily mail cap (D12)", () => {
  it("is about 70 %, a named constant", () => {
    expect(REMINDER_SHARE_OF_DAILY_MAIL).toBe(0.7);
  });

  it.each([
    [{ cap: 400, remaining: 400 }, 280],
    [{ cap: 10, remaining: 10 }, 7],
    [{ cap: 5, remaining: 5 }, 3],
    [{ cap: 1, remaining: 1 }, 0],
    [{ cap: 0, remaining: 0 }, 0],
    [{ cap: 10, remaining: 6 }, 3],
    [{ cap: 10, remaining: 3 }, 0],
    [{ cap: 10, remaining: 0 }, 0],
    [{ cap: 400, remaining: 120 }, 0],
  ])("allows %j to go out as reminders: %i", ({ cap, remaining }, allowed) => {
    expect(reminderMailAllowance(cap, remaining)).toBe(allowed);
  });

  it("allows every message when the cap is unlimited (a test double without a cap)", () => {
    expect(reminderMailAllowance(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("SendRegistrationRemindersUseCase and the confirmation reserve (D12)", () => {
  it("stops at 70 % of the cap even with more people due, stoppedBy budget, and leaves the rest unreminded and still due", async () => {
    addPeople(12);

    const result = await reminders(10).execute({ now: NOW });

    expect(result).toMatchObject({ sent: 7, stoppedBy: "budget" });
    expect(transport.delivered).toHaveLength(7);
    expect(reminded()).toBe(7);
    expect(await budget.used(TODAY)).toBe(7);
    expect(registrations.all().filter((row) => row.reminderSentAt === null)).toHaveLength(5);
  });

  it("rounds the share down: a cap of 5 allows 3 reminders, not 4", async () => {
    addPeople(5);

    expect(await reminders(5).execute({ now: NOW })).toMatchObject({ sent: 3, stoppedBy: "budget" });
    expect(await budget.used(TODAY)).toBe(3);
  });

  it("leaves the whole reserve to confirmations: after the cron, they can still send every remaining message", async () => {
    addPeople(20);
    await reminders(10).execute({ now: NOW });

    const mailer = sender(10);

    expect(await mailer.remainingToday(NOW)).toBe(3);
    expect((await mailer.send(confirmation("a@example.com"), NOW)).status).toBe("sent");
    expect((await mailer.send(confirmation("b@example.com"), NOW)).status).toBe("sent");
    expect((await mailer.send(confirmation("c@example.com"), NOW)).status).toBe("sent");
    expect((await mailer.send(confirmation("d@example.com"), NOW)).status).toBe("budget_exhausted");
    expect(await budget.used(TODAY)).toBe(10);
  });

  it("counts what confirmations already used: reminders only get what is left of their 70 %", async () => {
    addPeople(10);
    for (let index = 0; index < 4; index += 1) await budget.reserve(TODAY, 10);

    const result = await reminders(10).execute({ now: NOW });

    expect(result).toMatchObject({ sent: 3, stoppedBy: "budget" });
    expect(await budget.used(TODAY)).toBe(7);
  });

  it("sends no reminder at all once the day's mail is already past 70 %, and changes nothing", async () => {
    addPeople(3);
    for (let index = 0; index < 7; index += 1) await budget.reserve(TODAY, 10);

    const result = await reminders(10).execute({ now: NOW });

    expect(result).toMatchObject({ sent: 0, failed: 0, stoppedBy: "budget" });
    expect(transport.delivered).toEqual([]);
    expect(reminded()).toBe(0);
    expect(await budget.used(TODAY)).toBe(7);
  });

  it("does not send more on a second run the same day, and sends the rest the next day", async () => {
    addPeople(12);
    await reminders(10).execute({ now: NOW });

    expect(await reminders(10).execute({ now: NOW })).toMatchObject({ sent: 0, stoppedBy: "budget" });
    expect(reminded()).toBe(7);

    const tomorrow = new Date(NOW.getTime() + 24 * 3_600_000);
    const next = await reminders(10).execute({ now: tomorrow });

    expect(next.sent).toBe(5);
    expect(reminded()).toBe(12);
  });

  it("never lets reminders go past the share when sends fail: a failed send gives its unit back and is not counted", async () => {
    addPeople(9);
    // The oldest registration goes first: its send fails, and the seven allowed ones still go out after it.
    transport.failing.add("p9@example.com");

    const result = await reminders(10).execute({ now: NOW });

    expect(result).toMatchObject({ sent: 7, failed: 1 });
    expect(await budget.used(TODAY)).toBe(7);
    expect(reminded()).toBe(7);
  });
});
