import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { openRegistrationCancelToken } from "@/infrastructure/registration/registration-cancel-token";
import { buildReminderMessage } from "@/interface/event-registration/reminder-message";

/*
 * D7 (R6): the reminder of each person carries the link that cancels their registration, signed for them; without a
 * usable signing secret the reminder still goes out, saying there is nothing to do, rather than not going out.
 */
const ORIGIN = "https://admin.example.org";
const EVENT = { id: "event-1", slug: "taller-de-git", title: "Taller de Git", date: "2026-11-28", datePrecision: "day" as const, hora: "09:00 - 11:00", lugar: "Laboratorio 2" };

const cancelLink = (text: string) => /https:\/\/admin\.example\.org\/inscripciones\/taller-de-git\/cancelar\?token=([^\s"'<>]+)/.exec(text);

beforeEach(() => {
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "r".repeat(40));
  vi.stubEnv("ADMIN_SECRET", "a".repeat(40));
  vi.stubEnv("FORUM_SESSION_SECRET", "f".repeat(40));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildReminderMessage", () => {
  it("links the event page, the calendar file and a cancellation link whose token names this person's registration and this event", async () => {
    const message = await buildReminderMessage(ORIGIN)(EVENT, { id: "reg-ana" });
    const match = cancelLink(message.text);

    expect(message.text).toContain(`${ORIGIN}/inscripciones/taller-de-git\n`);
    expect(message.text).toContain(`${ORIGIN}/api/public/events/taller-de-git/calendar.ics`);
    expect(match).not.toBeNull();
    expect(await openRegistrationCancelToken(match![1])).toEqual({ status: "valid", claims: { registrationId: "reg-ana", eventId: "event-1" } });
    expect(message.html).toContain(`href="${match![0]}"`);
  });

  it("signs a different link for each person", async () => {
    const build = buildReminderMessage(ORIGIN);
    const [ana, luis] = [await build(EVENT, { id: "reg-ana" }), await build(EVENT, { id: "reg-luis" })];

    expect(cancelLink(ana.text)![1]).not.toBe(cancelLink(luis.text)![1]);
    expect(await openRegistrationCancelToken(cancelLink(luis.text)![1])).toMatchObject({ status: "valid", claims: { registrationId: "reg-luis" } });
  });

  it.each([undefined, "", "short", "a".repeat(40), "f".repeat(40)])("without a usable secret (%j) the reminder has no cancellation link and says there is nothing to do", async (secret) => {
    vi.stubEnv("REGISTRATION_CONFIRM_SECRET", secret as string);

    const message = await buildReminderMessage(ORIGIN)(EVENT, { id: "reg-ana" });

    expect(message.text).not.toContain("cancelar");
    expect(message.html).not.toContain("cancelar");
    expect(message.text).toContain("no necesita hacer nada más");
    expect(message.text).toContain(`${ORIGIN}/inscripciones/taller-de-git`);
  });
});
