import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getEventUseCasesMock, revalidatePathMock, redirectMock, useCases } = vi.hoisted(() => {
  const execute = () => vi.fn(async () => ({ id: "event-1" }));
  const useCases = {
    create: { execute: execute() },
    update: { execute: execute() },
    setPublished: { execute: execute() },
    delete: { execute: execute() },
    attachPhoto: { execute: execute() },
    updatePhotoAlt: { execute: execute() },
    reorderPhotos: { execute: execute() },
    deactivatePhoto: { execute: execute() },
  };

  return {
    cookiesMock: vi.fn(),
    getEventUseCasesMock: vi.fn(() => useCases),
    revalidatePathMock: vi.fn(),
    redirectMock: vi.fn(() => {
      throw new Error("REDIRECT");
    }),
    useCases,
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/interface/admin/events/events-container", () => ({ getEventUseCases: getEventUseCasesMock }));

import { AUTH_COOKIE_NAME, signSession } from "@/infrastructure/auth/session-jwt";
import * as actions from "@/interface/admin/events/actions";

const SESSION_EXPIRED = { error: "Su sesión expiró. Inicie sesión de nuevo." };

function eventForm(): FormData {
  const form = new FormData();
  form.set("title", "Hackatón 24h");
  return form;
}

function photoForm(): FormData {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "a.jpg", { type: "image/jpeg" }));
  form.set("alt", "Equipo");
  return form;
}

// One entry per exported action: the test below fails when an action is added without a case here.
const ACTION_CALLS: Record<string, () => Promise<unknown>> = {
  createEvent: () => actions.createEvent(null, eventForm()),
  updateEvent: () => actions.updateEvent("event-1", null, eventForm()),
  setEventPublished: () => actions.setEventPublished("event-1", true),
  deleteEvent: () => actions.deleteEvent("event-1"),
  uploadEventPhoto: () => actions.uploadEventPhoto("event-1", null, photoForm()),
  updateEventPhotoAlt: () => actions.updateEventPhotoAlt("event-1", "photo-1", null, photoForm()),
  moveEventPhoto: () => actions.moveEventPhoto("event-1", "photo-1", "up"),
  deactivateEventPhoto: () => actions.deactivateEventPhoto("event-1", "photo-1"),
};

function cookieJar(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === AUTH_COOKIE_NAME && value !== undefined ? { name, value } : undefined),
  });
}

describe("events server actions require an admin session (L9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
  });

  it("has an auth case for every exported action", () => {
    expect(Object.keys(ACTION_CALLS).sort()).toEqual(Object.keys(actions).sort());
  });

  describe.each([
    ["no cookie", undefined],
    ["a forged token", "forged.token.value"],
  ])("with %s", (_label, cookie) => {
    beforeEach(() => cookieJar(cookie));

    it.each(Object.entries(ACTION_CALLS))("%s rejects and performs no write", async (_name, call) => {
      const outcome = await call();

      expect(outcome).toEqual(SESSION_EXPIRED);
      expect(getEventUseCasesMock).not.toHaveBeenCalled();
      for (const useCase of Object.values(useCases)) {
        expect(useCase.execute).not.toHaveBeenCalled();
      }
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  it("fails closed when the signing secret is not configured", async () => {
    cookieJar(await signSession());
    vi.stubEnv("ADMIN_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    for (const call of Object.values(ACTION_CALLS)) {
      expect(await call()).toEqual(SESSION_EXPIRED);
    }

    expect(getEventUseCasesMock).not.toHaveBeenCalled();
  });

  it("positive control: a valid session reaches the use cases", async () => {
    cookieJar(await signSession());

    await expect(actions.deleteEvent("event-1")).resolves.toEqual({ success: true });

    expect(useCases.delete.execute).toHaveBeenCalledWith({ id: "event-1" });
  });

  it("the guard is the first statement of every action", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/interface/admin/events/actions.ts", "utf8");
    const bodies = source.split(/export async function /).slice(1);

    expect(bodies).toHaveLength(Object.keys(ACTION_CALLS).length);
    for (const body of bodies) {
      expect(body.slice(body.indexOf("await "), body.indexOf("await ") + 30)).toContain("await requireAdminSession()");
    }
  });
});
