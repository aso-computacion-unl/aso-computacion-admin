// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pathnameMock, routerMock, signOutMock, accessMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/inscripciones"),
  routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  signOutMock: vi.fn(),
  accessMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: pathnameMock, useRouter: () => routerMock }));
vi.mock("@/interface/forum/forum-posting", () => ({ signOutOfForum: signOutMock }));
vi.mock("@/interface/forum/event-registration-read", () => ({ getRegistrationAccess: accessMock }));

import { SignOutButton } from "../../../../app/_components/member-sign-out-button";
import { RegistrationHeaderAccess } from "../../../../app/inscripciones/_components/header-access";
import RegistrationLayout from "../../../../app/inscripciones/layout";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

const member = { name: "María Cuenca", email: "maria.cuenca@unl.edu.ec" };
const SIGN_IN = `/foro/auth/google/start?next=${encodeURIComponent("/inscripciones")}`;
const NOTICE = "Su sesión sigue abierta 30 días en este navegador. En una computadora compartida, ciérrela al terminar.";

const enter = (host: HTMLElement) => [...host.querySelectorAll("a")].find((link) => link.getAttribute("href")?.startsWith("/foro/auth/google/start"));

beforeEach(() => {
  vi.clearAllMocks();
  pathnameMock.mockReturnValue("/inscripciones");
});

afterEach(async () => {
  await unmountAll();
});

describe("S1: the header of the list offers an optional UNL access to a visitor", () => {
  it("starts the forum's Google sign-in and comes back to the list, with the Google mark and the address it takes", async () => {
    const host = await mount(createElement(RegistrationHeaderAccess, { member: null, loginAvailable: true }));
    const link = enter(host)!;

    expect(link.getAttribute("href")).toBe(SIGN_IN);
    expect(link.textContent?.replace(/\s+/g, " ").trim()).toBe("Entrar @unl.edu.ec");
    expect(link.querySelector("svg")).not.toBeNull();
    // The visitor still gets the theme toggle beside it.
    expect(host.querySelector('[data-theme-toggle]')).not.toBeNull();
  });

  it("is not offered when the sign-in is not configured on this server", async () => {
    const host = await mount(createElement(RegistrationHeaderAccess, { member: null, loginAvailable: false }));

    expect(enter(host)).toBeUndefined();
    expect(host.querySelector('[data-theme-toggle]')).not.toBeNull();
  });

  it("stays on the list: the event's page keeps the bar it had, since it owns its own sign-in", async () => {
    pathnameMock.mockReturnValue("/inscripciones/taller-docker");

    const host = await mount(createElement(RegistrationHeaderAccess, { member: null, loginAvailable: true }));

    expect(enter(host)).toBeUndefined();
    expect(host.querySelector('[data-theme-toggle]')).not.toBeNull();
  });
});

describe("S2: a signed-in student sees who they are, with a menu", () => {
  it("names them on the account button and puts the name, the email, how long the session lasts and the sign-out in its menu", async () => {
    const host = await mount(createElement(RegistrationHeaderAccess, { member, loginAvailable: true }));
    const trigger = host.querySelector<HTMLButtonElement>("button[aria-expanded]")!;

    expect(enter(host)).toBeUndefined();
    expect(trigger.getAttribute("aria-label")).toContain("María Cuenca");

    await click(trigger);

    const panel = host.querySelector<HTMLElement>(`#${CSS.escape(trigger.getAttribute("aria-controls")!)}`)!;

    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain("María Cuenca");
    expect(panel.textContent).toContain("maria.cuenca@unl.edu.ec");
    expect(panel.textContent).toContain(NOTICE);
    expect([...panel.querySelectorAll("button")].some((button) => button.textContent?.includes("Cerrar sesión"))).toBe(true);
  });

  it("closes the menu with Escape and gives the focus back to its button", async () => {
    const host = await mount(createElement(RegistrationHeaderAccess, { member, loginAvailable: true }));
    const trigger = host.querySelector<HTMLButtonElement>("button[aria-expanded]")!;

    await click(trigger);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("signs out with the forum's sign-out and leaves the person on the list", async () => {
    signOutMock.mockResolvedValue({ success: true });
    const host = await mount(createElement(RegistrationHeaderAccess, { member, loginAvailable: true }));

    await click(host.querySelector("button[aria-expanded]")!);
    await click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Cerrar sesión"))!);
    await settle();

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(routerMock.replace).toHaveBeenCalledWith("/inscripciones");
    expect(routerMock.refresh).toHaveBeenCalled();
  });
});

describe("the forum's sign-out row, outside the registrations", () => {
  it("still leaves a member on the forum's landing by default", async () => {
    signOutMock.mockResolvedValue({ success: true });
    const host = await mount(createElement(SignOutButton));

    await click(host.querySelector("button")!);
    await settle();

    expect(routerMock.replace).toHaveBeenCalledWith("/foro");
  });
});

describe("the registration layout's bar", () => {
  it("carries the access the server resolved for this browser", async () => {
    accessMock.mockResolvedValue({ member: null, loginAvailable: true });

    const host = await mount(await RegistrationLayout({ children: "contenido" }));

    expect(enter(host.querySelector("header")!)?.getAttribute("href")).toBe(SIGN_IN);
  });
});
