// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cancelMock } = vi.hoisted(() => ({ cancelMock: vi.fn() }));

vi.mock("@/interface/event-registration/cancel-registration-action", () => ({ cancelEventRegistration: cancelMock }));

import { CANCELLATION_SESSION_EXPIRED_RESULT } from "@/interface/event-registration/registration-action-errors";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

import { CancelOwnRegistration } from "../../../../app/inscripciones/[slug]/cancel-own-registration";

/*
 * D7 (R2): the signed-in student lets their own seat go from the event page. Asking comes first: one press cannot
 * delete a registration by accident (the seat may be gone for good on a full event).
 */
const SIGN_IN = "/foro/auth/google/start?next=%2Finscripciones%2Ftaller-docker";

const open_ = (signInHref: string | null = SIGN_IN) => mount(createElement(CancelOwnRegistration, { slug: "taller-docker", signInHref }));
const buttons = (host: HTMLElement) => [...host.querySelectorAll("button")].map((button) => button.textContent ?? "");
const press = async (host: HTMLElement, label: string) => {
  await click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes(label))!);
  await settle();
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await unmountAll();
});

describe("the student's own cancel control", () => {
  it("offers only 'Cancelar mi inscripción' at first, and cancels nothing yet", async () => {
    const host = await open_();

    expect(buttons(host)).toEqual(["Cancelar mi inscripción"]);
    expect(cancelMock).not.toHaveBeenCalled();

    await press(host, "Cancelar mi inscripción");

    expect(cancelMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Se liberará su cupo");
    expect(buttons(host)).toEqual(["Sí, cancelar mi inscripción", "No, conservarla"]);
  });

  it("keeping it goes back to the first state without calling the server", async () => {
    const host = await open_();

    await press(host, "Cancelar mi inscripción");
    await press(host, "No, conservarla");

    expect(buttons(host)).toEqual(["Cancelar mi inscripción"]);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("cancels the event it belongs to once confirmed, and refreshes the page behind", async () => {
    cancelMock.mockResolvedValue({ success: true });
    const host = await open_();

    await press(host, "Cancelar mi inscripción");
    await press(host, "Sí, cancelar mi inscripción");

    expect(cancelMock).toHaveBeenCalledExactlyOnceWith("taller-docker");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows the refusal and goes back to the first state so it can be tried again", async () => {
    cancelMock.mockResolvedValue({ error: "Las inscripciones de este evento ya cerraron, así que ya no se puede cancelar desde aquí. Si no podrá asistir, escriba a la directiva de ASO." });
    const host = await open_();

    await press(host, "Cancelar mi inscripción");
    await press(host, "Sí, cancelar mi inscripción");

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("directiva de ASO");
    expect(buttons(host)).toEqual(["Cancelar mi inscripción"]);
  });

  it("when the session is gone, says so in registration words and offers the sign-in that returns to this event page", async () => {
    cancelMock.mockResolvedValue(CANCELLATION_SESSION_EXPIRED_RESULT);
    const host = await open_();

    await press(host, "Cancelar mi inscripción");
    await press(host, "Sí, cancelar mi inscripción");

    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Su sesión terminó. Entre de nuevo con su cuenta @unl.edu.ec para cancelar su inscripción.");
    expect(host.textContent).not.toMatch(/foro/i);
    expect(host.querySelector<HTMLAnchorElement>("a.google-button")?.getAttribute("href")).toBe(SIGN_IN);
  });

  it("offers no sign-in when the login is not configured here", async () => {
    cancelMock.mockResolvedValue(CANCELLATION_SESSION_EXPIRED_RESULT);
    const host = await open_(null);

    await press(host, "Cancelar mi inscripción");
    await press(host, "Sí, cancelar mi inscripción");

    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector("a")).toBeNull();
  });
});
