import { describe, expect, it, vi } from "vitest";

import { cancelOutcomeFromResponse, cancelOutcomeMessage, submitCancellation } from "@/interface/event-registration/cancel-registration";

/*
 * D7: the browser half of the cancellation page. It POSTs the token of the email link to the public cancel endpoint
 * and says what happened. The server decides everything.
 */
describe("cancelOutcomeFromResponse", () => {
  it.each([
    [200, { ok: true, status: "cancelled" }, { kind: "cancelled" }],
    [200, { ok: true, status: "already_cancelled" }, { kind: "already_cancelled" }],
    [200, { ok: true }, { kind: "failed" }],
    [409, { error: "closed" }, { kind: "closed" }],
    [410, { error: "expired" }, { kind: "expired" }],
    [400, { error: "invalid" }, { kind: "invalid" }],
    [404, { error: "not_found" }, { kind: "not_found" }],
    [503, { error: "unavailable" }, { kind: "unavailable" }],
    [409, { error: "full" }, { kind: "failed" }],
    [400, { error: "bad_request" }, { kind: "failed" }],
    [413, { error: "too_large" }, { kind: "failed" }],
    [500, null, { kind: "failed" }],
    [502, "<html>", { kind: "failed" }],
  ])("reads %i %j as %j", (status, body, expected) => {
    expect(cancelOutcomeFromResponse(status, body, null)).toEqual(expected);
  });

  it("keeps how long to wait after a rate limit, and survives a missing or odd header", () => {
    expect(cancelOutcomeFromResponse(429, { error: "rate_limited" }, "120")).toEqual({ kind: "rate_limited", retryAfterSeconds: 120 });
    expect(cancelOutcomeFromResponse(429, { error: "rate_limited" }, null)).toEqual({ kind: "rate_limited", retryAfterSeconds: null });
  });
});

describe("cancelOutcomeMessage", () => {
  const KINDS = ["cancelled", "already_cancelled", "closed", "expired", "invalid", "not_found", "unavailable", "failed"] as const;

  it("says every outcome in Spanish, addressed as usted, never the forum", () => {
    for (const kind of KINDS) {
      const message = cancelOutcomeMessage({ kind });

      expect(message.title.length, kind).toBeGreaterThan(5);
      expect(`${message.title} ${message.detail}`, kind).not.toMatch(/\b(tu|tus|tú|revisa|escribe|intenta|vuelve)\b|foro/i);
    }
  });

  it("says the registration is cancelled, and its seat free, only for cancelled; already_cancelled says nothing is left to do", () => {
    expect(cancelOutcomeMessage({ kind: "cancelled" }).title).toBe("Su inscripción quedó cancelada");
    expect(cancelOutcomeMessage({ kind: "cancelled" }).detail).toMatch(/cupo/);
    expect(cancelOutcomeMessage({ kind: "already_cancelled" }).title).toBe("Su inscripción ya estaba cancelada");
    expect(cancelOutcomeMessage({ kind: "already_cancelled" }).detail).toContain("No necesita hacer nada más");
  });

  it("tells a person whose registration closed to write to the board, and a bad link that it is no use", () => {
    expect(cancelOutcomeMessage({ kind: "closed" }).title).toBe("Las inscripciones de este evento ya cerraron");
    expect(cancelOutcomeMessage({ kind: "closed" }).detail).toContain("directiva de ASO");
    expect(cancelOutcomeMessage({ kind: "expired" }).detail).toContain("directiva de ASO");
    expect(cancelOutcomeMessage({ kind: "invalid" }).title).toBe("Este enlace no sirve");
  });

  it("is done for everything but a transient failure, which can be retried", () => {
    for (const kind of KINDS) {
      expect(cancelOutcomeMessage({ kind }).retry, kind).toBe(kind === "unavailable" || kind === "failed");
    }

    expect(cancelOutcomeMessage({ kind: "rate_limited", retryAfterSeconds: 60 }).retry).toBe(true);
    expect(cancelOutcomeMessage({ kind: "rate_limited", retryAfterSeconds: 60 }).detail).toContain("1 minuto");
  });

  it("offers the way back to the event only where the person can still act", () => {
    expect(cancelOutcomeMessage({ kind: "cancelled" }).backToEvent).toBe(true);
    expect(cancelOutcomeMessage({ kind: "already_cancelled" }).backToEvent).toBe(true);
    expect(cancelOutcomeMessage({ kind: "invalid" }).backToEvent).toBe(true);
    expect(cancelOutcomeMessage({ kind: "not_found" }).backToEvent).toBe(false);
  });
});

describe("submitCancellation", () => {
  it("POSTs the token as JSON to the cancel endpoint of the event, same origin, and reads the answer", async () => {
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, status: "cancelled" }), { status: 200 }));

    expect(await submitCancellation("taller-de-git", "tok.en", send)).toEqual({ kind: "cancelled" });
    expect(send).toHaveBeenCalledWith("/api/public/events/taller-de-git/registrations/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok.en" }),
    });
  });

  it("turns a dead network or a non-JSON answer into a plain failure instead of throwing", async () => {
    expect(await submitCancellation("x", "t", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))).toEqual({ kind: "failed" });
    expect(await submitCancellation("x", "t", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })))).toEqual({ kind: "failed" });
  });
});
