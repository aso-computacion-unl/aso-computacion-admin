// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { EventForm } from "../../../../app/admin/events/_components/event-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { EMPTY_EVENT_FORM_VALUES, type EventFormValues } from "@/interface/admin/events/event-form-values";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });
const mountForm = (action: Action = ok, initial: Partial<EventFormValues> = {}) =>
  mount(createElement(ToastProvider, null, createElement(EventForm, { action, submitLabel: "Crear evento", initialValues: { ...EMPTY_EVENT_FORM_VALUES, ...initial } })));

const labelled = (host: HTMLElement, text: string) => [...host.querySelectorAll("label")].find((label) => label.textContent === text);
const field = (host: HTMLElement, text: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${labelled(host, text)!.htmlFor}"]`)!;
const moreOptions = (host: HTMLElement) => host.querySelector("details")!;
const submit = (host: HTMLElement) => click(host.querySelector('button[type="submit"]')!);
const sent = (action: ReturnType<typeof vi.fn>) => action.mock.calls.at(-1)![1] as FormData;
const switchNamed = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent === name)!;

const OUTSIDE = ["Título", "Descripción"];
const INSIDE = ["Mensaje de commit", "Hora", "Lugar", "Para quién", "Enlace", "Texto del enlace", "Puntos destacados", "Publicar el", "Retirar el", "Identificador (slug)"];

describe("the event editor's \"Más opciones\"", () => {
  it("shows only what the event needs to exist, with everything else in one closed disclosure and no helper paragraphs", async () => {
    const host = await mountForm();
    const details = moreOptions(host);

    expect(host.querySelectorAll("details")).toHaveLength(1);
    expect(details.querySelector("summary")?.textContent).toBe("Más opciones");
    expect(details.open).toBe(false);
    for (const text of OUTSIDE) expect(details.contains(field(host, text)), text).toBe(false);
    for (const text of INSIDE) expect(details.contains(field(host, text)), text).toBe(true);
    expect(details.contains(switchNamed(host, "Destacado"))).toBe(true);
    expect(details.contains(switchNamed(host, "Publicado"))).toBe(false);
    expect(host.querySelector('input[name="datePrecision"]')).not.toBeNull();
    expect(host.querySelector('input[name="type"]')).not.toBeNull();
    expect(host.querySelectorAll("small")).toHaveLength(0);
  });

  it("opens with a click on its summary", async () => {
    const host = await mountForm();

    await click(moreOptions(host).querySelector("summary")!);

    expect(moreOptions(host).open).toBe(true);
  });

  it("opens, and keeps the invalid field in view, when the browser check finds an error inside it", async () => {
    const host = await mountForm();

    await typeInto(field(host, "Título"), "Taller de Git");
    await typeInto(field(host, "Enlace"), "no es un enlace");
    await submit(host);

    expect(moreOptions(host).open).toBe(true);
    expect(field(host, "Enlace").getAttribute("aria-invalid")).toBe("true");
    expect(moreOptions(host).textContent).toContain("Use un enlace que empiece con https://");
  });

  it("opens when the server refuses a field inside it, and stays closed when the error is outside", async () => {
    const inside = await mountForm(async () => ({ fieldErrors: { lugar: "Use hasta 80 caracteres." } }));

    await typeInto(field(inside, "Título"), "Taller");
    await submit(inside);
    await settle();

    expect(moreOptions(inside).open).toBe(true);
    expect(moreOptions(inside).textContent).toContain("Use hasta 80 caracteres.");

    const outside = await mountForm(async () => ({ fieldErrors: { description: "Use hasta 600 caracteres." } }));

    await typeInto(field(outside, "Título"), "Taller");
    await submit(outside);
    await settle();

    expect(moreOptions(outside).open).toBe(false);
    expect(outside.textContent).toContain("Use hasta 600 caracteres.");
  });

  it("explains a field behind a small \"?\" instead of a paragraph", async () => {
    const host = await mountForm();
    const help = host.querySelector<HTMLButtonElement>('button[aria-label="Ayuda: Identificador (slug)"]')!;

    expect(help.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(help.getAttribute("aria-controls")!)?.hidden).toBe(true);

    await click(help);

    expect(help.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(help.getAttribute("aria-controls")!)?.hidden).toBe(false);
  });
});

describe("the event editor's registration switch", () => {
  it("is off by default: no fields, and the event is saved with mode none", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    expect(switchNamed(host, "Tiene inscripción").checked).toBe(false);
    expect(labelled(host, "Cupos")).toBeUndefined();
    expect(labelled(host, "Cierre")).toBeUndefined();
    expect(host.querySelector('input[name="registrationMode"]')).toBeNull();

    await typeInto(field(host, "Título"), "Taller");
    await submit(host);
    await settle();

    expect(sent(action).get("registrationMode")).toBe("none");
  });

  it("reveals the mode, Cupos and Cierre when it is on, and goes back to mode none when it is turned off", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await typeInto(field(host, "Título"), "Taller");
    await click(switchNamed(host, "Tiene inscripción"));

    expect(labelled(host, "Cupos")).toBeDefined();
    expect(labelled(host, "Cierre")).toBeDefined();
    expect([...host.querySelectorAll<HTMLInputElement>('input[name="registrationMode"]')].map((radio) => radio.value)).toEqual(["unl", "open"]);
    expect(host.querySelector<HTMLInputElement>('input[name="registrationMode"][value="unl"]')!.checked).toBe(true);

    await click(host.querySelector('input[name="registrationMode"][value="open"]')!);
    await typeInto(field(host, "Cupos"), "30");
    await submit(host);
    await settle();

    expect(sent(action).get("registrationMode")).toBe("open");
    expect(sent(action).get("registrationCapacity")).toBe("30");

    await click(switchNamed(host, "Tiene inscripción"));
    await submit(host);
    await settle();

    expect(labelled(host, "Cupos")).toBeUndefined();
    expect(sent(action).get("registrationMode")).toBe("none");
  });

  it("comes back on with the mode the event had before it was turned off", async () => {
    const host = await mountForm();

    await click(switchNamed(host, "Tiene inscripción"));
    await click(host.querySelector('input[name="registrationMode"][value="open"]')!);
    await click(switchNamed(host, "Tiene inscripción"));
    await click(switchNamed(host, "Tiene inscripción"));

    expect(host.querySelector<HTMLInputElement>('input[name="registrationMode"][value="open"]')!.checked).toBe(true);
  });

  it("starts on, with the stored mode, for an event that takes registrations", async () => {
    const host = await mountForm(ok, { slug: "taller", registrationMode: "open", registrationCapacity: "40" });

    expect(switchNamed(host, "Tiene inscripción").checked).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[name="registrationMode"][value="open"]')!.checked).toBe(true);
    expect(field(host, "Cupos").value).toBe("40");
  });
});

describe("the counters of the event editor", () => {
  it("appear only near the limit (80% or more)", async () => {
    const host = await mountForm();
    const counters = () => host.textContent!.match(/\d+ \/ \d+/g) ?? [];

    expect(counters()).toEqual([]);

    await typeInto(field(host, "Título"), "T".repeat(95));
    expect(counters()).toEqual([]);

    await typeInto(field(host, "Título"), "T".repeat(96));
    expect(counters()).toEqual(["96 / 120"]);

    await typeInto(field(host, "Descripción"), "D".repeat(480));
    expect(counters()).toEqual(["96 / 120", "480 / 600"]);
  });
});

describe("the event editor in a new event", () => {
  it("says the photos come after creating", async () => {
    const host = await mountForm();

    expect(host.textContent).toContain("Las fotos se agregan después de crear el evento.");
  });

  it("does not say it for an event that exists", async () => {
    const host = await mountForm(ok, { slug: "taller" });

    expect(host.textContent).not.toContain("Las fotos se agregan");
  });
});
