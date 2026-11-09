import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ForumThrottledError } from "@/application/forum/posting-throttle";
import { FORUM_SESSION_EXPIRED_MESSAGE, FORUM_SESSION_EXPIRED_RESULT, mapForumActionError } from "@/interface/forum/forum-action-result";
import { ForumUnauthorizedError } from "@/interface/forum/require-forum-member";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("the posting throttle message (D3)", () => {
  it.each([
    [60, 3, "minuto", "Está publicando muy rápido: el límite es de 3 publicaciones por minuto. Puede volver a intentarlo en 1 minuto."],
    [3600, 30, "hora", "Está publicando muy rápido: el límite es de 30 publicaciones por hora. Puede volver a intentarlo en 60 minutos."],
    // A wait is never promised shorter than it is: partial minutes round up.
    [90, 5, "minuto", "Está publicando muy rápido: el límite es de 5 publicaciones por minuto. Puede volver a intentarlo en 2 minutos."],
    [1, 5, "minuto", "Está publicando muy rápido: el límite es de 5 publicaciones por minuto. Puede volver a intentarlo en 1 minuto."],
  ] as const)("names the limit that tripped (%is, %i per %s) and the wait in whole minutes", (seconds, max, per, message) => {
    expect(mapForumActionError(new ForumThrottledError(seconds, max, per))).toEqual({ error: message });
  });

  it("never speaks of seconds", () => {
    expect(JSON.stringify(mapForumActionError(new ForumThrottledError(60, 3, "minuto")))).not.toMatch(/\bs\.|segundo/);
  });
});

describe("a forum session that ended (D5)", () => {
  it("is told as a sign-in required, so a form can keep its text and offer the way back", () => {
    expect(mapForumActionError(new ForumUnauthorizedError())).toEqual(FORUM_SESSION_EXPIRED_RESULT);
    expect(FORUM_SESSION_EXPIRED_RESULT).toEqual({ error: FORUM_SESSION_EXPIRED_MESSAGE, sessionExpired: true });
  });

  it("is not claimed for the other refusals", () => {
    expect(mapForumActionError(new Error("boom"))).not.toHaveProperty("sessionExpired");
  });
});
