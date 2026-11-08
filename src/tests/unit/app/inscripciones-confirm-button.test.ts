// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

import { click, mount, settle, unmountAll } from "@/tests/support/dom";

import { ConfirmRegistration } from "../../../../app/inscripciones/[slug]/confirmar/confirm-registration";

const CALENDAR = "/api/public/events/taller-docker/calendar.ics";
const FORM = "/inscripciones/taller-docker";

let fetchMock: ReturnType<typeof vi.fn>;

const answer = (status: number, body: unknown, headers: Record<string, string> = {}) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));
const status = (host: HTMLElement) => host.querySelector('[role="status"]')?.textContent ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await unmountAll();
  vi.unstubAllGlobals();
});

describe("the confirm button", () => {
  const open_ = (props: Partial<Parameters<typeof ConfirmRegistration>[0]> = {}) =>
    mount(createElement(ConfirmRegistration, { slug: "taller-docker", token: "tok.en", calendarHref: CALENDAR, formHref: FORM, ...props }));
  const button = (host: HTMLElement) => host.querySelector<HTMLButtonElement>("button")!;

  it("POSTs the token on click and not before", async () => {
    answer(200, { ok: true, status: "confirmed" });
    const host = await open_();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(button(host).textContent).toContain("Confirmar mi cupo");

    await click(button(host));
    await settle();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/public/events/taller-docker/registrations/confirm");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST", body: JSON.stringify({ token: "tok.en" }) });
  });

  it("shows the reserved seat with the calendar link, refreshes the seats and moves the focus there, when confirmed", async () => {
    answer(200, { ok: true, status: "confirmed" });
    const host = await open_();

    await click(button(host));
    await settle();

    expect(status(host)).toContain("Listo, su cupo está reservado");
    expect(host.querySelector<HTMLAnchorElement>(`a[href="${CALENDAR}"]`)?.textContent).toContain("Añadir al calendario");
    expect(host.querySelector("button")).toBeNull();
    expect(routerMock.refresh).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(host.querySelector('[role="status"]'));
  });

  it("shows the reserved seat, too, when it was already confirmed", async () => {
    answer(200, { ok: true, status: "already_confirmed" });
    const host = await open_();

    await click(button(host));
    await settle();

    expect(status(host)).toContain("Su cupo ya estaba reservado");
    expect(host.querySelector(`a[href="${CALENDAR}"]`)).not.toBeNull();
  });

  it("leaves the calendar out when the event has no exact upcoming day", async () => {
    answer(200, { ok: true, status: "confirmed" });
    const host = await open_({ calendarHref: null });

    await click(button(host));
    await settle();

    expect(status(host)).toContain("Listo, su cupo está reservado");
    expect(host.querySelector("a[href$='calendar.ics']")).toBeNull();
  });

  it.each([
    [409, { error: "full" }, "Cupos agotados"],
    [409, { error: "closed" }, "Las inscripciones cerraron"],
  ])("says %j and offers neither the calendar nor the button", async (code, body, title) => {
    answer(code, body);
    const host = await open_();

    await click(button(host));
    await settle();

    expect(status(host)).toContain(title);
    expect(host.querySelector("button")).toBeNull();
    expect(host.querySelector(`a[href="${CALENDAR}"]`)).toBeNull();
    expect(host.textContent).not.toContain("Listo, su cupo");
  });

  it.each([
    [410, { error: "expired" }, "Este enlace venció"],
    [400, { error: "invalid" }, "Este enlace no sirve"],
  ])("says the link is no use on %j and links back to the form", async (code, body, title) => {
    answer(code, body);
    const host = await open_();

    await click(button(host));
    await settle();

    expect(status(host)).toContain(title);
    expect(host.querySelector<HTMLAnchorElement>(`a[href="${FORM}"]`)).not.toBeNull();
    expect(host.querySelector("button")).toBeNull();
  });

  it("keeps the button after a failure that may pass, so the person can try again", async () => {
    answer(503, { error: "unavailable" });
    const host = await open_();

    await click(button(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("No pudimos confirmar su cupo");
    expect(button(host).textContent).toContain("Confirmar mi cupo");
    expect(routerMock.refresh).not.toHaveBeenCalled();

    answer(200, { ok: true, status: "confirmed" });
    await click(button(host));
    await settle();

    expect(status(host)).toContain("Listo, su cupo está reservado");
  });

  it("sends one request for a double click", async () => {
    let release!: (response: Response) => void;

    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (release = resolve)));

    const host = await open_();

    await click(button(host));
    await click(button(host));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(button(host).textContent).toContain("Confirmando");

    release(new Response(JSON.stringify({ ok: true, status: "confirmed" }), { status: 200 }));
    await settle();

    expect(status(host)).toContain("Listo, su cupo está reservado");
  });
});
