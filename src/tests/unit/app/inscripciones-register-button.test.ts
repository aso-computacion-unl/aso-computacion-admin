// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock, registerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }, registerMock: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/interface/forum/event-registration", () => ({ registerForEvent: registerMock }));

import { REGISTRATION_SESSION_EXPIRED_RESULT } from "@/interface/event-registration/registration-action-errors";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

import { RegisterButton } from "../../../../app/inscripciones/[slug]/register-button";

const SIGN_IN = "/foro/auth/google/start?next=%2Finscripciones%2Ftaller-docker";

const open_ = (signInHref: string | null = SIGN_IN) => mount(createElement(RegisterButton, { slug: "taller-docker", signInHref }));
const reserve = async (host: HTMLElement) => {
  await click(host.querySelector<HTMLButtonElement>("button.ticket-cta")!);
  await settle();
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the reserve button (D5: registration wording, a way back to this event)", () => {
  it("reserves for the event it belongs to", async () => {
    registerMock.mockResolvedValue({ success: true });
    const host = await open_();

    await reserve(host);

    expect(registerMock).toHaveBeenCalledWith("taller-docker");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("when the session is gone, says so in registration words and offers the sign-in that returns to this same event page", async () => {
    registerMock.mockResolvedValue(REGISTRATION_SESSION_EXPIRED_RESULT);
    const host = await open_();

    await reserve(host);

    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para reservar su cupo.");
    expect(host.textContent).not.toMatch(/foro/i);
    expect(host.querySelector<HTMLAnchorElement>("a.google-button")?.getAttribute("href")).toBe(SIGN_IN);
    expect(host.querySelector("a.google-button")?.textContent).toContain("Entrar con Google");
  });

  it("offers no sign-in when the login is not configured here: it would end in an error", async () => {
    registerMock.mockResolvedValue(REGISTRATION_SESSION_EXPIRED_RESULT);
    const host = await open_(null);

    await reserve(host);

    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector("a")).toBeNull();
  });

  it("a refused account gets its own message and no sign-in: signing in again would not help", async () => {
    registerMock.mockResolvedValue({ error: "Su cuenta no puede reservar cupos. Use su cuenta institucional @unl.edu.ec." });
    const host = await open_();

    await reserve(host);

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Su cuenta no puede reservar cupos.");
    expect(host.querySelector("a")).toBeNull();
  });

  it("clears the previous message when it is tried again", async () => {
    registerMock.mockResolvedValueOnce({ error: "Ya no quedan cupos para este evento." }).mockResolvedValueOnce({ success: true });
    const host = await open_();

    await reserve(host);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Ya no quedan cupos para este evento.");

    await reserve(host);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
