import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/infrastructure/observability/report-error", () => ({ reportError: vi.fn() }));

import { todayInEcuador } from "@/domain/calendar-date";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";
import { testMail } from "@/tests/support/test-mail";

import { POST } from "../../../../app/api/public/events/[slug]/registrations/route";

/*
 * D12 (R4): what the reminders leave of the day's cap (30 %) is for confirmation emails, and confirmations may use all
 * of it: the open form answers 503 email_budget only when the whole cap is spent.
 */
const SLUG = "taller-de-git";
// The budget is kept per day in Ecuador, which is not the UTC date between 00:00 and 05:00 UTC.
const TODAY = () => todayInEcuador(new Date());
let sequence = 0;

function register(email: string) {
  sequence += 1;

  const request = new NextRequest(`https://admin.test/api/public/events/${SLUG}/registrations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `192.0.2.${sequence}-${sequence}` },
    body: JSON.stringify({ name: "Ana Pérez", email, institution: "UNL", turnstileToken: "good-token" }),
  });

  return POST(request, { params: Promise.resolve({ slug: SLUG }) });
}

beforeEach(async () => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_URL", "https://admin.example.org");
  vi.stubEnv("MAIL_GMAIL_USER", "asociacion@gmail.com");
  vi.stubEnv("MAIL_GMAIL_APP_PASSWORD", "abcdefghijklmnop");
  vi.stubEnv("REGISTRATION_CONFIRM_SECRET", "r".repeat(40));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
  await addTestEvent();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("confirmation emails and the reminders' share of the cap (D12)", () => {
  it("still accepts registrations with the whole reserve the reminders left, and refuses (503 email_budget, nothing stored) only once the cap is spent", async () => {
    testMail.dailyLimit = 10;
    // The cron already used its 7 of 10.
    for (let index = 0; index < 7; index += 1) await testMail.budget.reserve(TODAY(), 10);

    for (const email of ["a@example.com", "b@example.com", "c@example.com"]) {
      expect((await register(email)).status).toBe(201);
    }

    expect(testMail.transport.delivered).toHaveLength(3);
    expect(await testMail.budget.used(TODAY())).toBe(10);

    const refused = await register("d@example.com");

    expect(refused.status).toBe(503);
    expect(await refused.json()).toMatchObject({ error: "email_budget" });
    expect(testEventRegistration.registrations.all().map((row) => row.email)).toEqual(["a@example.com", "b@example.com", "c@example.com"]);
    expect(testMail.transport.delivered).toHaveLength(3);
  });
});
