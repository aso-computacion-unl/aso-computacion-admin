import { beforeEach, describe, expect, it } from "vitest";

import { SendRegistrationRemindersUseCase, type ReminderMessageBuilder } from "@/application/event-registration/send-registration-reminders.use-case";
import { BudgetedMailSender } from "@/application/mail/budgeted-mail-sender";
import { Event } from "@/domain/event";
import { InMemoryEventRegistrationRepository } from "@/tests/fakes/in-memory-event-registration.repository";
import { InMemoryEventRepository } from "@/tests/fakes/in-memory-event.repository";
import { InMemoryMailBudget, RecordingMailTransport } from "@/tests/fakes/in-memory-mail";

/*
 * D7 (R6): the reminder carries a link that cancels THAT person's registration, so the message is built per person.
 */
const NOW = new Date("2026-11-20T11:00:00.000Z");

let events: InMemoryEventRepository;
let registrations: InMemoryEventRegistrationRepository;
let transport: RecordingMailTransport;

beforeEach(() => {
  events = new InMemoryEventRepository();
  registrations = new InMemoryEventRegistrationRepository(events);
  transport = new RecordingMailTransport();
});

const run = (build: ReminderMessageBuilder) => new SendRegistrationRemindersUseCase(events, registrations, new BudgetedMailSender(transport, new InMemoryMailBudget(), 400), build).execute({ now: NOW });

async function seedPeople(...ids: string[]) {
  const event = Event.create({ title: "Taller de Git", date: "2026-11-22", isPublished: true, registrationMode: "open" });

  await events.create(event);

  for (const id of ids) {
    registrations.seed({ id, eventId: event.props.id, mode: "open", name: id, email: `${id}@example.com`, career: null, semester: null, createdAt: new Date(NOW.getTime() - 1000) });
  }

  return event.props;
}

describe("reminders carry a cancellation link of their own (D7)", () => {
  it("builds the message once per person, with that person's registration, and each person gets only their own", async () => {
    const event = await seedPeople("ana", "luis");
    const asked: string[] = [];

    const result = await run(async (reminded, person) => {
      asked.push(`${reminded.slug}:${person.id}`);

      return { subject: "Recordatorio", text: `cancelar https://admin.test/cancelar?rid=${person.id}`, html: `<p>${person.id}</p>` };
    });

    expect(result).toMatchObject({ sent: 2, failed: 0, stoppedBy: "done" });
    expect(asked.sort()).toEqual([`${event.slug}:ana`, `${event.slug}:luis`]);

    for (const message of transport.delivered) {
      const id = message.to.split("@")[0]!;

      expect(message.text).toContain(`rid=${id}`);
      expect(message.text).not.toContain(`rid=${id === "ana" ? "luis" : "ana"}`);
    }
  });

  it("does not build a message for someone it will not reach: none are built when the budget has no room", async () => {
    await seedPeople("ana");

    const built: string[] = [];
    const noRoom = new SendRegistrationRemindersUseCase(events, registrations, new BudgetedMailSender(transport, new InMemoryMailBudget(), 0), (_event, person) => {
      built.push(person.id);

      return { subject: "s", text: "t", html: "h" };
    });

    expect(await noRoom.execute({ now: NOW })).toMatchObject({ sent: 0 });
    expect(built).toEqual([]);
    expect(transport.delivered).toEqual([]);
  });
});
