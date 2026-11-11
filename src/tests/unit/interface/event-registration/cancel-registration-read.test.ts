import { beforeEach, describe, expect, it } from "vitest";

import { getCancelRegistrationPage } from "@/interface/event-registration/cancel-registration-read";
import { addTestEvent, resetTestEventRegistration } from "@/tests/support/test-event-registration";

const NOW = new Date("2099-11-20T15:00:00.000Z");

beforeEach(() => {
  resetTestEventRegistration();
});

/** S4: what the cancellation page needs to refuse, before the button, what the POST would refuse. */
describe("getCancelRegistrationPage", () => {
  it("names the event behind the slug, so the page can tell a link of another event", async () => {
    const event = await addTestEvent({ registrationMode: "unl" });

    expect(await getCancelRegistrationPage(event.slug, NOW)).toMatchObject({ eventId: event.id, mode: "unl", closed: false });
  });

  it("S4: says registration closed for an event that no longer takes registrations through its mode, once its day has passed", async () => {
    const event = await addTestEvent({ registrationMode: "none", date: "2099-11-10" });

    expect(await getCancelRegistrationPage(event.slug, NOW)).toMatchObject({ eventId: event.id, mode: "none", registration: null, closed: true });
  });

  it("says closed for an event whose registration deadline passed, too", async () => {
    const event = await addTestEvent({ registrationMode: "open", registrationDeadline: new Date("2099-11-19T00:00:00.000Z") });

    expect(await getCancelRegistrationPage(event.slug, NOW)).toMatchObject({ eventId: event.id, closed: true });
  });
});
