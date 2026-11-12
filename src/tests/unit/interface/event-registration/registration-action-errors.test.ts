import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ForbiddenError, NotFoundError } from "@/application/use-cases/use-case-error";
import { ForumMemberSuspendedError } from "@/domain/forum";
import { CANCELLATION_SESSION_EXPIRED_RESULT, mapCancellationActionError, mapRegistrationActionError, REGISTRATION_SESSION_EXPIRED_RESULT } from "@/interface/event-registration/registration-action-errors";
import { ForumUnauthorizedError } from "@/interface/forum/require-forum-member";

describe("mapRegistrationActionError (D5: registration wording, never the forum's)", () => {
  it("tells a gone session as the registration's, flagged so the screen can offer the sign-in", () => {
    expect(mapRegistrationActionError(new ForumUnauthorizedError())).toBe(REGISTRATION_SESSION_EXPIRED_RESULT);
    expect(REGISTRATION_SESSION_EXPIRED_RESULT.sessionExpired).toBe(true);
  });

  it.each([new ForumMemberSuspendedError(), new ForbiddenError()])("tells a refused account (%s) it cannot reserve, and to use the institutional account", (error) => {
    expect(mapRegistrationActionError(error)).toEqual({ error: "Su cuenta no puede reservar cupos. Use su cuenta institucional @unl.edu.ec." });
  });

  it("tells a missing record as the event's, not the forum post's", () => {
    expect(mapRegistrationActionError(new NotFoundError("event"))).toEqual({ error: "No se encontró el evento." });
  });

  it("never says foro in anything it answers on its own", () => {
    for (const error of [new ForumUnauthorizedError(), new ForumMemberSuspendedError(), new ForbiddenError(), new NotFoundError("x")]) {
      expect(mapRegistrationActionError(error).error).not.toMatch(/foro/i);
    }
  });

  it("leaves everything else to the shared mapping: an unexpected error is the generic message", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(mapRegistrationActionError(new Error("boom"))).toEqual({ error: "Ocurrió un error inesperado. Intente nuevamente." });
  });
});

describe("mapCancellationActionError (D7: the same words, about cancelling)", () => {
  it("tells a gone session as the cancellation's, flagged so the screen can offer the sign-in", () => {
    expect(mapCancellationActionError(new ForumUnauthorizedError())).toBe(CANCELLATION_SESSION_EXPIRED_RESULT);
    expect(CANCELLATION_SESSION_EXPIRED_RESULT).toEqual({ error: "Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para cancelar su inscripción.", sessionExpired: true });
  });

  it.each([new ForumMemberSuspendedError(), new ForbiddenError()])("tells a refused account (%s) it cannot cancel, not that it cannot reserve", (error) => {
    expect(mapCancellationActionError(error)).toEqual({ error: "Su cuenta no puede cancelar cupos. Use su cuenta institucional @unl.edu.ec." });
  });

  it("tells a missing record as the event's and never says foro", () => {
    expect(mapCancellationActionError(new NotFoundError("event"))).toEqual({ error: "No se encontró el evento." });

    for (const error of [new ForumUnauthorizedError(), new ForumMemberSuspendedError(), new ForbiddenError(), new NotFoundError("x")]) {
      expect(mapCancellationActionError(error).error).not.toMatch(/foro/i);
    }
  });

  it("leaves everything else to the shared mapping", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(mapCancellationActionError(new Error("boom"))).toEqual({ error: "Ocurrió un error inesperado. Intente nuevamente." });
  });
});
