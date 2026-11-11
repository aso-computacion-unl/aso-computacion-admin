// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock, widgetMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }, widgetMock: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
// The real widget loads Cloudflare's script; the stub hands the form a token on click and records its resets.
vi.mock("../../../../app/inscripciones/[slug]/turnstile-widget", () => ({
  TurnstileWidget: (props: { onToken: (token: string | null) => void; onError: () => void; resetCount: number }) => {
    widgetMock(props);

    return createElement(
      "div",
      { "data-testid": "widget" },
      createElement("button", { type: "button", "data-testid": "solve", onClick: () => props.onToken("tok-1") }, "solve"),
      createElement("button", { type: "button", "data-testid": "break", onClick: () => props.onError() }, "break"),
    );
  },
}));

import { OpenRegistrationForm } from "../../../../app/inscripciones/[slug]/open-registration-form";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

const PRIVACY = "Usamos sus datos solo para esta actividad y los eliminamos 90 días después de que termine. Le enviaremos un correo para confirmar su dirección.";

let fetchMock: ReturnType<typeof vi.fn>;

const answer = (status: number, body: unknown, headers: Record<string, string> = {}) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));
const control = <T extends HTMLElement>(host: HTMLElement, selector: string) => host.querySelector<T>(selector)!;
const submit = (host: HTMLElement) => control<HTMLButtonElement>(host, 'button[type="submit"]');

async function fill(host: HTMLElement, values: Partial<Record<"name" | "email" | "institution" | "career" | "semester", string>> = {}) {
  const all = { name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: "5", ...values };

  await typeInto(control(host, 'input[name="name"]'), all.name);
  await typeInto(control(host, 'input[name="email"]'), all.email);
  await typeInto(control(host, 'input[name="institution"]'), all.institution);
  await typeInto(control(host, 'input[name="career"]'), all.career);
  await act(() => {
    const select = control<HTMLSelectElement>(host, 'select[name="semester"]');

    select.value = all.semester;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function act(run: () => void) {
  const { act: reactAct } = await import("react");

  await reactAct(async () => run());
}

const open = (props: Partial<Parameters<typeof OpenRegistrationForm>[0]> = {}) =>
  mount(createElement(OpenRegistrationForm, { slug: "taller-de-git", siteKey: undefined, ...props }));

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await unmountAll();
  vi.unstubAllGlobals();
});

describe("the open registration form", () => {
  it("asks for name, email, institution and, optionally, career and semester with labels, comfortable targets and the privacy note", async () => {
    const host = await open();

    for (const label of ["Nombre completo", "Correo", "Institución", "Carrera (opcional)", "Ciclo (opcional)"]) {
      expect([...host.querySelectorAll("label")].map((entry) => entry.textContent)).toContain(label);
    }

    expect(control<HTMLInputElement>(host, 'input[name="email"]').type).toBe("email");
    expect(control<HTMLInputElement>(host, 'input[name="email"]').autocomplete).toBe("email");
    expect(control<HTMLInputElement>(host, 'input[name="name"]').autocomplete).toBe("name");
    expect(control<HTMLSelectElement>(host, 'select[name="semester"]').options).toHaveLength(13);
    expect(host.textContent).toContain(PRIVACY);
    expect(submit(host).className).toContain("ticket-cta");
    expect(submit(host).textContent).toBe("Reservar mi cupo");
    expect(host.querySelector('[data-testid="widget"]')).toBeNull();
  });

  it("flags every empty field, puts the focus on the first and sends nothing", async () => {
    const host = await open();

    await click(submit(host));
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    for (const name of ["name", "email", "institution"]) expect(control(host, `input[name="${name}"]`).getAttribute("aria-invalid")).toBe("true");
    // Career and semester are optional: left empty they are not flagged.
    expect(control(host, 'input[name="career"]').getAttribute("aria-invalid")).toBeNull();
    expect(control(host, 'select[name="semester"]').getAttribute("aria-invalid")).toBeNull();
    expect(document.activeElement).toBe(control(host, 'input[name="name"]'));
    // The stylesheet sizes these icons, but the Icon's own `size-5` utility outranks a component-layer rule, so the size must be explicit.
    expect(control(host, ".ticket-error svg").getAttribute("class")).toContain("size-3.5");
    expect(host.textContent).toContain("Escriba su nombre.");
    expect(host.textContent).toContain("Escriba su institución.");
    expect(control(host, 'input[name="name"]').getAttribute("aria-describedby")).toBe(control(host, 'input[name="name"]').id + "-error");
  });

  it("stops flagging a field as soon as the person edits it", async () => {
    const host = await open();

    await click(submit(host));
    await typeInto(control(host, 'input[name="name"]'), "Ana");

    expect(control(host, 'input[name="name"]').getAttribute("aria-invalid")).toBeNull();
    expect(host.textContent).not.toContain("Escriba su nombre.");
    expect(control(host, 'input[name="email"]').getAttribute("aria-invalid")).toBe("true");
  });

  it("shows why registration is over, and no form, when the event is already full or closed", async () => {
    const host = await open({ closedMessage: "Ya no quedan cupos para este evento." });

    expect(control(host, '[role="status"]').textContent).toBe("Ya no quedan cupos para este evento.");
    expect(host.querySelector("form")).toBeNull();
  });

  it("keeps the check-your-email notice of whoever just asked after the page behind says the event is full", async () => {
    const { createRoot } = await import("react-dom/client");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const props = { slug: "taller-de-git", siteKey: undefined };
    answer(201, { ok: true });

    await act(() => root.render(createElement(OpenRegistrationForm, props)));
    await fill(host);
    await click(submit(host));
    await settle();
    await act(() => root.render(createElement(OpenRegistrationForm, { ...props, closedMessage: "Ya no quedan cupos para este evento." })));

    expect(control(host, '[role="status"]').textContent).toContain("Revise su correo");
    expect(host.textContent).not.toContain("Ya no quedan cupos");
    await act(() => root.unmount());
    host.remove();
  });

  it("posts the fields to the public endpoint and asks the person to check their email: no seat yet, so no calendar and no refresh", async () => {
    answer(201, { ok: true, confirm: "email" });
    const host = await open();

    await fill(host, { name: "  Ana   Pérez ", email: "ANA@example.com" });
    await click(submit(host));
    await settle();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/public/events/taller-de-git/registrations");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ name: "  Ana   Pérez ", email: "ANA@example.com", institution: "Universidad Nacional de Loja", career: "Computación", semester: 5 });
    const done = control(host, '[role="status"]');

    expect(done.textContent).toContain("Revise su correo");
    expect(done.textContent).toContain("ANA@example.com");
    expect(done.textContent).toContain("Confirmar mi cupo");
    expect(done.textContent).toContain("48 horas");
    expect(done.textContent).not.toContain("Listo, su cupo está reservado");
    expect(done.textContent).not.toContain("no enviamos correo de confirmación");
    expect(host.querySelector("a[href$='calendar.ics']")).toBeNull();
    expect(host.querySelector("form")).toBeNull();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(done);
  });

  it("sends a form with only name, email and institution: career and semester are optional", async () => {
    answer(201, { ok: true });
    const host = await open();

    await fill(host, { career: "", semester: "" });
    await click(submit(host));
    await settle();

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ name: "Ana Pérez", email: "ana@example.com", institution: "Universidad Nacional de Loja" });
  });

  it("says a duplicate on the email field and keeps what was typed", async () => {
    answer(409, { error: "duplicate" });
    const host = await open();

    await fill(host);
    await click(submit(host));
    await settle();

    const email = control<HTMLInputElement>(host, 'input[name="email"]');

    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(email);
    expect(host.textContent).toContain("Ya hay una inscripción con ese correo para este evento.");
    expect(email.value).toBe("ana@example.com");
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("points at the field the server refused", async () => {
    answer(400, { error: "validation", field: "career" });
    const host = await open();

    await fill(host);
    await click(submit(host));
    await settle();

    expect(control(host, 'input[name="career"]').getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(control(host, 'input[name="career"]'));
  });

  it.each([
    [409, { error: "full" }, "Ya no quedan cupos para este evento."],
    [409, { error: "closed" }, "Las inscripciones de este evento ya cerraron."],
    [404, { error: "not_found" }, "Este evento ya no recibe inscripciones desde aquí."],
  ])("replaces the form with the state when the answer is %i %j", async (status, body, message) => {
    answer(status, body);
    const host = await open();

    await fill(host);
    await click(submit(host));
    await settle();

    expect(host.querySelector("form")).toBeNull();
    expect(control(host, '[role="status"]').textContent).toContain(message);
    expect(routerMock.refresh).toHaveBeenCalledOnce();
  });

  it.each([
    [429, { error: "rate_limited" }, { "Retry-After": "300" }, "Vuelva a intentarlo en 5 minutos."],
    [503, { error: "unavailable" }, {}, "La inscripción no está disponible en este momento."],
    [503, { error: "email_unavailable" }, {}, "No pudimos enviarle el correo de confirmación"],
    [503, { error: "email_budget" }, {}, "Hoy ya enviamos todos los correos de confirmación que podemos. Inténtelo de nuevo mañana."],
    [400, { error: "captcha" }, {}, "No pudimos comprobar que usted es una persona."],
    [502, "<html>", {}, "No pudimos enviar su inscripción."],
  ])("keeps the form and its values and explains %i in an alert", async (status, body, headers, message) => {
    answer(status, body, headers);
    const host = await open();

    await fill(host);
    await click(submit(host));
    await settle();

    expect(control(host, '[role="alert"]').textContent).toContain(message);
    expect(control(host, ".stub-alert svg").getAttribute("class")).toContain("size-4");
    expect(document.activeElement).toBe(control(host, '[role="alert"]'));
    expect(control<HTMLInputElement>(host, 'input[name="name"]').value).toBe("Ana Pérez");
    expect(submit(host).getAttribute("aria-disabled")).toBeNull();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("blocks a second submit while the first one is in flight", async () => {
    let finish!: (response: Response) => void;

    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (finish = resolve)));
    const host = await open();

    await fill(host);
    await click(submit(host));
    expect(submit(host).getAttribute("aria-disabled")).toBe("true");
    expect(submit(host).textContent).toBe("Enviando…");
    expect(control(host, "form").getAttribute("aria-busy")).toBe("true");
    await click(submit(host));
    expect(fetchMock).toHaveBeenCalledOnce();

    finish(new Response(JSON.stringify({ ok: true, confirm: "email" }), { status: 201 }));
    await settle();
    expect(host.textContent).toContain("Revise su correo");
  });
});

describe("the open registration form with the Turnstile widget", () => {
  it("asks for the verification before sending anything", async () => {
    const host = await open({ siteKey: "0x4AAAA" });

    await fill(host);
    await click(submit(host));
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(control(host, '[role="alert"]').textContent).toContain("Complete la verificación");
  });

  it("sends the token it got, and asks the widget for a new one afterwards, whatever the answer", async () => {
    answer(409, { error: "duplicate" });
    const host = await open({ siteKey: "0x4AAAA" });

    await fill(host);
    await click(control(host, '[data-testid="solve"]'));
    await click(submit(host));
    await settle();

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ turnstileToken: "tok-1" });
    expect(widgetMock.mock.calls.at(-1)![0].resetCount).toBe(1);

    // The spent token is gone: a second try needs a new check.
    await click(submit(host));
    await settle();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Complete la verificación");
  });

  it("says so when the widget cannot start", async () => {
    const host = await open({ siteKey: "0x4AAAA" });

    await click(control(host, '[data-testid="break"]'));

    expect(control(host, '[role="alert"]').textContent).toContain("No pudimos cargar la verificación");
  });

  it("keeps the server's answer on screen when the widget fails to start again after it", async () => {
    answer(503, { error: "unavailable" });
    const host = await open({ siteKey: "0x4AAAA" });

    await fill(host);
    await click(control(host, '[data-testid="solve"]'));
    await click(submit(host));
    await settle();
    await click(control(host, '[data-testid="break"]'));

    expect(control(host, '[role="alert"]').textContent).toContain("La inscripción no está disponible en este momento.");
    expect(host.textContent).not.toContain("No pudimos cargar la verificación");
  });
});
