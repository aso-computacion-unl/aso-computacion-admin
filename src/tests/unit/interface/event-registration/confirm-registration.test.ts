import { describe, expect, it, vi } from "vitest";

import { confirmOutcomeFromResponse, confirmOutcomeMessage, submitConfirmation } from "@/interface/event-registration/confirm-registration";

describe("confirmOutcomeFromResponse", () => {
  it.each([
    [200, { ok: true, status: "confirmed" }, { kind: "confirmed" }],
    [200, { ok: true, status: "already_confirmed" }, { kind: "already_confirmed" }],
    [200, { ok: true }, { kind: "failed" }],
    [409, { error: "full" }, { kind: "full" }],
    [409, { error: "closed" }, { kind: "closed" }],
    [410, { error: "expired" }, { kind: "expired" }],
    [400, { error: "invalid" }, { kind: "invalid" }],
    [404, { error: "not_found" }, { kind: "not_found" }],
    [503, { error: "unavailable" }, { kind: "unavailable" }],
    [400, { error: "bad_request" }, { kind: "failed" }],
    [413, { error: "too_large" }, { kind: "failed" }],
    [500, null, { kind: "failed" }],
    [502, "<html>", { kind: "failed" }],
  ])("reads %i %j as %j", (status, body, expected) => {
    expect(confirmOutcomeFromResponse(status, body, null)).toEqual(expected);
  });

  it("keeps how long to wait after a rate limit, and survives a missing or odd header", () => {
    expect(confirmOutcomeFromResponse(429, { error: "rate_limited" }, "120")).toEqual({ kind: "rate_limited", retryAfterSeconds: 120 });
    expect(confirmOutcomeFromResponse(429, { error: "rate_limited" }, null)).toEqual({ kind: "rate_limited", retryAfterSeconds: null });
  });
});

describe("confirmOutcomeMessage", () => {
  it("says every outcome in Spanish, addressed as usted", () => {
    const kinds = ["confirmed", "already_confirmed", "full", "closed", "expired", "invalid", "not_found", "unavailable", "failed"] as const;

    for (const kind of kinds) {
      const message = confirmOutcomeMessage({ kind });

      expect(message.title.length).toBeGreaterThan(5);
      expect(`${message.title} ${message.detail}`).not.toMatch(/\b(tu|tus|tú|revisa|escribe|intenta|vuelve)\b/i);
    }
  });

  it("says the seat is reserved for confirmed and already_confirmed, and that no seats are left for full", () => {
    expect(confirmOutcomeMessage({ kind: "confirmed" }).title).toBe("Listo, su cupo está reservado");
    expect(confirmOutcomeMessage({ kind: "already_confirmed" }).title).toBe("Su cupo ya estaba reservado");
    expect(confirmOutcomeMessage({ kind: "full" }).title).toBe("Cupos agotados");
    expect(confirmOutcomeMessage({ kind: "closed" }).title).toBe("Las inscripciones cerraron");
  });

  it("sends the person back to the form for an expired or invalid link, and only then", () => {
    expect(confirmOutcomeMessage({ kind: "expired" }).backToForm).toBe(true);
    expect(confirmOutcomeMessage({ kind: "invalid" }).backToForm).toBe(true);
    expect(confirmOutcomeMessage({ kind: "confirmed" }).backToForm).toBe(false);
    expect(confirmOutcomeMessage({ kind: "full" }).backToForm).toBe(false);
  });

  it("shows the reserved seat, with the calendar, only when the seat is reserved", () => {
    expect(confirmOutcomeMessage({ kind: "confirmed" }).reserved).toBe(true);
    expect(confirmOutcomeMessage({ kind: "already_confirmed" }).reserved).toBe(true);
    expect(confirmOutcomeMessage({ kind: "full" }).reserved).toBe(false);
    expect(confirmOutcomeMessage({ kind: "expired" }).reserved).toBe(false);
  });

  it("lets the person try again after a transient failure only", () => {
    expect(confirmOutcomeMessage({ kind: "unavailable" }).retry).toBe(true);
    expect(confirmOutcomeMessage({ kind: "failed" }).retry).toBe(true);
    expect(confirmOutcomeMessage({ kind: "rate_limited", retryAfterSeconds: 60 }).retry).toBe(true);
    expect(confirmOutcomeMessage({ kind: "full" }).retry).toBe(false);
    expect(confirmOutcomeMessage({ kind: "rate_limited", retryAfterSeconds: 60 }).detail).toContain("1 minuto");
  });
});

describe("submitConfirmation", () => {
  it("POSTs the token as JSON to the confirm endpoint of the event, same origin, and reads the answer", async () => {
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, status: "confirmed" }), { status: 200 }));

    expect(await submitConfirmation("taller-de-git", "tok.en", send)).toEqual({ kind: "confirmed" });
    expect(send).toHaveBeenCalledWith("/api/public/events/taller-de-git/registrations/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok.en" }),
    });
  });

  it("turns a dead network or a non-JSON answer into a plain failure instead of throwing", async () => {
    expect(await submitConfirmation("x", "t", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))).toEqual({ kind: "failed" });
    expect(await submitConfirmation("x", "t", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })))).toEqual({ kind: "failed" });
  });
});
