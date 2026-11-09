// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

import { click, mount, settle, unmountAll } from "@/tests/support/dom";

import { CancelRegistration } from "../../../../app/inscripciones/[slug]/cancelar/cancel-registration";

const EVENT_HREF = "/inscripciones/taller-docker";

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

describe("the cancel button of the email link", () => {
  const open_ = () => mount(createElement(CancelRegistration, { slug: "taller-docker", token: "tok.en", eventHref: EVENT_HREF }));
  const button = (host: HTMLElement) => host.querySelector<HTMLButtonElement>("button")!;

  it("POSTs the token on click and not before", async () => {
    answer(200, { ok: true, status: "cancelled" });
    const host = await open_();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(button(host).textContent).toContain("Cancelar mi inscripción");

    await click(button(host));
    await settle();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/public/events/taller-docker/registrations/cancel");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST", body: JSON.stringify({ token: "tok.en" }) });
  });

  it("says the registration is cancelled, refreshes the seats, offers the way back to the event and moves the focus there", async () => {
    answer(200, { ok: true, status: "cancelled" });
    const host = await open_();

    await click(button(host));
    await settle();

    expect(status(host)).toContain("Su inscripción quedó cancelada");
    expect(host.querySelector("button")).toBeNull();
    expect(host.querySelector<HTMLAnchorElement>(`a[href="${EVENT_HREF}"]`)).not.toBeNull();
    expect(routerMock.refresh).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(host.querySelector('[role="status"]'));
  });

  it("says it was already cancelled, without refreshing anything", async () => {
    answer(200, { ok: true, status: "already_cancelled" });
    const host = await open_();

    await click(button(host));
    await settle();

    expect(status(host)).toContain("Su inscripción ya estaba cancelada");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it.each([
    [409, { error: "closed" }, "Las inscripciones de este evento ya cerraron"],
    [410, { error: "expired" }, "Este enlace venció"],
    [400, { error: "invalid" }, "Este enlace no sirve"],
    [404, { error: "not_found" }, "Este evento ya no está disponible"],
  ])("ends with the reason for %i %j, without a button to press again", async (code, body, title) => {
    answer(code, body);
    const host = await open_();

    await click(button(host));
    await settle();

    expect(status(host)).toContain(title);
    expect(host.querySelector("button")).toBeNull();
  });

  it.each([
    [503, { error: "unavailable" }, "No pudimos cancelar su inscripción"],
    [500, null, "Revise su conexión"],
  ])("keeps the button, with an alert, after the transient failure %i, so it can be tried again", async (code, body, text) => {
    answer(code, body);
    const host = await open_();

    await click(button(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(text);
    expect(button(host)).not.toBeNull();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("says how long to wait after a rate limit, and keeps the button", async () => {
    answer(429, { error: "rate_limited" }, { "Retry-After": "120" });
    const host = await open_();

    await click(button(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("2 minutos");
    expect(button(host)).not.toBeNull();
  });

  it("a dead network is a failure to retry, not a crash", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const host = await open_();

    await click(button(host));
    await settle();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Revise su conexión");
    expect(button(host)).not.toBeNull();
  });
});
