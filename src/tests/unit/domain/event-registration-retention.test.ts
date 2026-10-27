import { describe, expect, it } from "vitest";

import {
  REGISTRATION_RETENTION_DAYS,
  eventLastDay,
  registrationsExpired,
  retentionCandidateCutoff,
} from "@/domain/event-registration-retention";

// Ecuador is UTC-5: the calendar day changes at 05:00 UTC.
const at = (iso: string) => new Date(iso);

describe("registration retention rule", () => {
  it("keeps registrations for 90 days", () => {
    expect(REGISTRATION_RETENTION_DAYS).toBe(90);
  });

  describe("eventLastDay", () => {
    it("is the event date for a day-precision event", () => {
      expect(eventLastDay("2026-11-28", "day")).toBe("2026-11-28");
    });

    it("is the last day of the month for a month-precision event, leap years included", () => {
      expect(eventLastDay("2026-11-01", "month")).toBe("2026-11-30");
      expect(eventLastDay("2026-12-01", "month")).toBe("2026-12-31");
      expect(eventLastDay("2028-02-01", "month")).toBe("2028-02-29");
      expect(eventLastDay("2027-02-01", "month")).toBe("2027-02-28");
    });
  });

  describe("registrationsExpired", () => {
    // Event on 2026-01-10. Its day ends at 2026-01-11 00:00 Ecuador (05:00 UTC); 90 days later is 2026-04-11 00:00 Ecuador.
    const event = { date: "2026-01-10", datePrecision: "day" as const };

    it("is inclusive at exactly 90 days after the event ends: the instant they have passed, the registrations expire", () => {
      expect(registrationsExpired(event, at("2026-04-11T05:00:00.000Z"))).toBe(true);
    });

    it("keeps them one millisecond before that instant", () => {
      expect(registrationsExpired(event, at("2026-04-11T04:59:59.999Z"))).toBe(false);
    });

    it("keeps them during the whole 90th day and on the day of the event itself", () => {
      expect(registrationsExpired(event, at("2026-04-10T23:00:00.000Z"))).toBe(false);
      expect(registrationsExpired(event, at("2026-01-10T12:00:00.000Z"))).toBe(false);
    });

    it("expires them for good afterwards", () => {
      expect(registrationsExpired(event, at("2026-04-12T11:00:00.000Z"))).toBe(true);
      expect(registrationsExpired(event, at("2030-01-01T00:00:00.000Z"))).toBe(true);
    });

    it("leaves the registrations of a future or recent event alone", () => {
      expect(registrationsExpired(event, at("2026-01-01T00:00:00.000Z"))).toBe(false);
      expect(registrationsExpired(event, at("2026-02-15T00:00:00.000Z"))).toBe(false);
    });

    it("never expires an event without a date: nothing says when it ended", () => {
      expect(registrationsExpired({ date: null, datePrecision: "day" }, at("2099-01-01T00:00:00.000Z"))).toBe(false);
    });

    it("waits for the end of the month when only the month is known", () => {
      const month = { date: "2026-01-01", datePrecision: "month" as const };

      // The month ends with 2026-01-31; 90 days after that is 2026-05-02 00:00 Ecuador.
      expect(registrationsExpired(month, at("2026-05-02T04:59:59.999Z"))).toBe(false);
      expect(registrationsExpired(month, at("2026-05-02T05:00:00.000Z"))).toBe(true);
      // A day-precision event on the 1st would already be gone by then.
      expect(registrationsExpired({ date: "2026-01-01", datePrecision: "day" }, at("2026-04-02T05:00:00.000Z"))).toBe(true);
      expect(registrationsExpired(month, at("2026-04-02T05:00:00.000Z"))).toBe(false);
    });

    it("uses the Ecuador calendar, not UTC: late evening in Ecuador is already the next UTC day", () => {
      // 2026-04-10 23:30 Ecuador = 2026-04-11 04:30 UTC: still the 90th day there.
      expect(registrationsExpired(event, at("2026-04-11T04:30:00.000Z"))).toBe(false);
    });
  });

  describe("retentionCandidateCutoff", () => {
    it("is a date no later than any event date whose registrations can already have expired", () => {
      const now = at("2026-04-11T05:00:00.000Z");
      const cutoff = retentionCandidateCutoff(now);

      expect(cutoff).toBe("2026-01-10");
      expect(registrationsExpired({ date: cutoff, datePrecision: "day" }, now)).toBe(true);
    });
  });
});
