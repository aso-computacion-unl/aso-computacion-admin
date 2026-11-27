// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { EventForm } from "../../../../app/admin/events/_components/event-form";
import { ValidationError } from "@/domain/domain-error";
import { DEADLINE_AFTER_EVENT_MESSAGE } from "@/domain/event-registration";
import { mapActionError, type ActionResult } from "@/interface/admin/action-result";
import { EMPTY_EVENT_FORM_VALUES, type EventFormValues } from "@/interface/admin/events/event-form-values";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

import { controlsPerLabel } from "./one-control-per-label";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });
const mountForm = (action: Action = ok, initial: Partial<EventFormValues> = {}) =>
  mount(createElement(ToastProvider, null, createElement(EventForm, { action, submitLabel: "Crear evento", initialValues: { ...EMPTY_EVENT_FORM_VALUES, ...initial } })));

const labelled = (host: HTMLElement, text: string) => [...host.querySelectorAll("label")].find((label) => label.textContent === text);
const field = (host: HTMLElement, text: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${labelled(host, text)!.htmlFor}"]`)!;
const disclosure = (host: HTMLElement, summary: string) => [...host.querySelectorAll("details")].find((details) => details.querySelector("summary")?.textContent === summary)!;
const moreOptions = (host: HTMLElement) => disclosure(host, "Más opciones");
const schedule = (host: HTMLElement) => disclosure(host, "Programar publicación y retiro");
const publication = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-slot="publish-side"]')!;
const submit = (host: HTMLElement) => click(host.querySelector('button[type="submit"]')!);
const sent = (action: ReturnType<typeof vi.fn>) => action.mock.calls.at(-1)![1] as FormData;
const switchNamed = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent === name)!;

const OUTSIDE = ["Título", "Descripción", "Hora", "Lugar"];
const INSIDE = ["Mensaje de commit", "Para quién", "Enlace", "Texto del enlace", "Puntos destacados", "Identificador (slug)"];
const SCHEDULED = ["Publicar el", "Retirar el"];

describe("the event editor's \"Más opciones\"", () => {
  it("shows only what the event needs to exist, with everything else in one closed disclosure and no helper paragraphs", async () => {
    const host = await mountForm();
    const details = moreOptions(host);

    expect(host.querySelectorAll("details")).toHaveLength(2);
    expect(details.open).toBe(false);
    expect(schedule(host).open).toBe(false);
    for (const text of OUTSIDE) expect(details.contains(field(host, text)), text).toBe(false);
    for (const text of INSIDE) expect(details.contains(field(host, text)), text).toBe(true);
    for (const text of SCHEDULED) expect(schedule(host).contains(field(host, text)), text).toBe(true);
    for (const name of ["Publicado", "Destacado"]) {
      expect(publication(host).contains(switchNamed(host, name)), name).toBe(true);
      expect(details.contains(switchNamed(host, name)) || schedule(host).contains(switchNamed(host, name)), name).toBe(false);
    }
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
    const inside = await mountForm(async () => ({ fieldErrors: { para: "Use hasta 80 caracteres." } }));

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

  it("opens «Programar publicación y retiro» when the server refuses a date inside it, and leaves «Más opciones» closed", async () => {
    const host = await mountForm(async () => ({ fieldErrors: { publishAt: "Elija una fecha futura." } }));

    await typeInto(field(host, "Título"), "Taller");
    await submit(host);
    await settle();

    expect(schedule(host).open).toBe(true);
    expect(schedule(host).textContent).toContain("Elija una fecha futura.");
    expect(moreOptions(host).open).toBe(false);
  });

  it("explains a field behind a small \"?\" instead of a paragraph", async () => {
    const host = await mountForm();
    const help = field(host, "Identificador (slug)").closest("div")!.querySelector<HTMLButtonElement>("button[aria-controls]")!;

    expect(help.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(help.getAttribute("aria-controls")!)?.hidden).toBe(true);

    await click(help);

    expect(help.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(help.getAttribute("aria-controls")!)?.hidden).toBe(false);
  });
});

describe("the publish panel of the event editor", () => {
  it("previews the event as the timeline shows it while it is typed", async () => {
    const host = await mountForm(ok, { type: "taller", date: "2026-12-12" });
    const preview = () => host.querySelector('[aria-label="Así se verá en la línea de tiempo"]')!.textContent;

    expect(preview()).toContain("Sin título");

    await typeInto(field(host, "Título"), "Taller de Git");
    await typeInto(field(host, "Hora"), "15:00 – 17:00");
    await typeInto(field(host, "Lugar"), "Lab 2");

    expect(preview()).toBe("Taller · 12 dic 2026Taller de Git15:00 – 17:00 · Lab 2");
  });

  it("adds the registration of a new event with registration, its cierre read as written", async () => {
    const host = await mountForm(ok, { eventKind: "registration", registrationMode: "open", registrationCapacity: "30", registrationDeadline: "2026-12-10T23:59" });

    expect(host.querySelector('[aria-label="Así se verá en la línea de tiempo"]')!.textContent).toContain("Formulario abierto · 30 cupos · cierra 10 dic 2026, 23:59");
  });
});

describe("the labels of the event editor", () => {
  it("name one control each, so no \"?\" help toggle answers to the name of its field", async () => {
    const host = await mountForm();
    const perLabel = controlsPerLabel(host);

    for (const text of ["Publicar el", "Identificador (slug)", "Puntos destacados"]) expect(perLabel.get(text)?.size, text).toBe(1);
    for (const [text, controls] of perLabel) expect(controls.size, text).toBe(1);
  });

  it("gives every help toggle the same short name and describes it with its field's label", async () => {
    const host = await mountForm();
    const toggles = [...host.querySelectorAll<HTMLButtonElement>("button[aria-controls]")];

    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(toggle.getAttribute("aria-label")).toBe("Ayuda");
      expect(document.getElementById(toggle.getAttribute("aria-describedby")!)?.tagName).toBe("LABEL");
    }
  });
});

describe("the event editor's date type", () => {
  it("switches to a month-only date with one click and back, showing Mes instead of Fecha", async () => {
    const host = await mountForm();
    const radio = (value: string) => host.querySelector<HTMLInputElement>(`input[name="datePrecision"][value="${value}"]`)!;

    expect(radio("day").checked).toBe(true);
    expect(labelled(host, "Fecha")).toBeDefined();

    await click(radio("month"));

    expect(radio("month").checked).toBe(true);
    expect(radio("day").checked).toBe(false);
    expect(labelled(host, "Mes")).toBeDefined();
    expect(field(host, "Mes").type).toBe("month");

    await click(radio("day"));

    expect(radio("day").checked).toBe(true);
    expect(labelled(host, "Fecha")).toBeDefined();
  });
});

const kind = (host: HTMLElement, value: "announcement" | "registration") => host.querySelector<HTMLInputElement>(`input[name="eventKind"][value="${value}"]`);

describe("the kind of a new event (event-kinds S1-S3)", () => {
  it("offers «Evento» and «Evento con inscripción», «Evento» chosen, with no registration fields", async () => {
    const host = await mountForm();

    expect(kind(host, "announcement")?.closest("label")?.textContent).toBe("Evento");
    expect(kind(host, "registration")?.closest("label")?.textContent).toBe("Evento con inscripción");
    expect(kind(host, "announcement")?.checked).toBe(true);
    expect(labelled(host, "Cupos")).toBeUndefined();
    expect(host.querySelector('input[name="registrationMode"]')).toBeNull();
  });

  it("«Evento con inscripción» asks how people sign up and sends the kind with its settings", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await click(kind(host, "registration")!);
    await typeInto(field(host, "Título"), "Taller");
    await click(host.querySelector<HTMLInputElement>('input[name="registrationMode"][value="open"]')!);
    await typeInto(field(host, "Cupos"), "30");
    await typeInto(field(host, "Cierre"), "2099-11-27T18:00");
    await submit(host);
    await settle();

    expect(Object.fromEntries(["eventKind", "registrationMode", "registrationCapacity", "registrationDeadline"].map((key) => [key, sent(action).get(key)]))).toEqual({
      eventKind: "registration",
      registrationMode: "open",
      registrationCapacity: "30",
      registrationDeadline: "2099-11-27T18:00",
    });
    expect(switchNamed(host, "Tiene inscripción")).toBeUndefined();
  });

  it("shows a refused cierre on Cierre, which the new event form then has", async () => {
    const host = await mountForm(async () => mapActionError(new ValidationError("registrationDeadline", DEADLINE_AFTER_EVENT_MESSAGE)));

    await click(kind(host, "registration")!);
    await typeInto(field(host, "Título"), "Taller");
    await submit(host);
    await settle();

    expect(field(host, "Cierre").getAttribute("aria-invalid")).toBe("true");
    expect(field(host, "Fecha").getAttribute("aria-invalid")).not.toBe("true");
  });

  it("switching to «Evento» drops a cierre refused for «Evento con inscripción»: it never shows on Fecha (R3-002)", async () => {
    const host = await mountForm(async () => mapActionError(new ValidationError("registrationDeadline", DEADLINE_AFTER_EVENT_MESSAGE)));

    await click(kind(host, "registration")!);
    await typeInto(field(host, "Título"), "Taller");
    await submit(host);
    await settle();
    await click(kind(host, "announcement")!);

    expect(field(host, "Fecha").getAttribute("aria-invalid")).not.toBe("true");
    expect(host.textContent).not.toContain(DEADLINE_AFTER_EVENT_MESSAGE);
  });

  it("fixed to «Evento con inscripción» (Inscripciones, S3-S4): no kind to choose, the registration fields shown and sent with the kind", async () => {
    const action = vi.fn(ok);
    const host = await mount(createElement(ToastProvider, null, createElement(EventForm, { action, submitLabel: "Crear inscripción", fixedKind: "registration" })));

    expect(host.querySelector('input[name="eventKind"]')).toBeNull();
    expect(labelled(host, "Cupos")).toBeDefined();

    await typeInto(field(host, "Título"), "Taller");
    await typeInto(field(host, "Cupos"), "30");
    await submit(host);
    await settle();

    expect(sent(action).get("eventKind")).toBe("registration");
    expect(sent(action).get("registrationMode")).toBe("unl");
    expect(sent(action).get("registrationCapacity")).toBe("30");
  });

  it("is not offered when editing an event", async () => {
    const host = await mount(createElement(ToastProvider, null, createElement(EventForm, { action: ok, submitLabel: "Guardar cambios", initialValues: { ...EMPTY_EVENT_FORM_VALUES, title: "Taller", slug: "taller" } })));

    expect(host.querySelector('input[name="eventKind"]')).toBeNull();
  });
});

describe("the event editor and the registration (S3)", () => {
  it("an announcement has no registration section: no switch, mode, Cupos or Cierre, and a save sends no registration setting", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    expect(switchNamed(host, "Tiene inscripción")).toBeUndefined();
    expect(labelled(host, "Cupos")).toBeUndefined();
    expect(labelled(host, "Cierre")).toBeUndefined();
    expect(host.querySelector('input[name="registrationMode"]')).toBeNull();

    await typeInto(field(host, "Título"), "Taller");
    await submit(host);
    await settle();

    for (const key of ["eventKind", "registrationMode", "registrationCapacity", "registrationDeadline", "confirmRegistrationChange"]) {
      expect(sent(action).has(key)).toBe(false);
    }
  });
});

describe("a date before the registration's cierre (S3, S4)", () => {
  const refused: Action = async () => mapActionError(new ValidationError("registrationDeadline", DEADLINE_AFTER_EVENT_MESSAGE));
  const mountEditing = (registrationHref?: string) =>
    mount(createElement(ToastProvider, null, createElement(EventForm, { action: refused, submitLabel: "Guardar cambios", registrationHref, initialValues: { ...EMPTY_EVENT_FORM_VALUES, title: "Taller", slug: "taller", date: "2099-11-28" } })));

  it("shows the refusal on the date, which this form has, with the way to move the cierre in Inscripciones", async () => {
    const host = await mountEditing("/admin/registrations/e1/edit");

    await typeInto(field(host, "Fecha"), "2099-11-20");
    await submit(host);
    await settle();

    const date = field(host, "Fecha");
    const describedBy = date.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent).join(" ");

    expect(date.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy).toContain("El cierre de la inscripción no puede ser posterior al día del evento.");
    expect(describedBy).toContain("Inscripciones");
    expect(host.querySelector<HTMLAnchorElement>('a[href="/admin/registrations/e1/edit"]')?.textContent).toBe("Gestionar inscripción");
  });

  it("still shows it on the date without a link when the page gives none", async () => {
    const host = await mountEditing();

    await submit(host);
    await settle();

    expect(field(host, "Fecha").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain("El cierre de la inscripción no puede ser posterior al día del evento.");
    expect(host.querySelector('a[href^="/admin/registrations"]')).toBeNull();
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

describe("the side column of the event editor (08)", () => {
  it("holds Publicación and the save bar, with both switches in the state row", async () => {
    const host = await mount(
      createElement(ToastProvider, null, createElement(EventForm, { action: ok, submitLabel: "Guardar cambios", initialValues: { ...EMPTY_EVENT_FORM_VALUES, slug: "taller" } })),
    );
    const side = publication(host);
    const state = host.querySelector('[data-slot="publish-state"]')!;

    expect(side.querySelector('[data-slot="action-bar"]')).not.toBeNull();
    expect(state.contains(switchNamed(host, "Publicado"))).toBe(true);
    expect(state.contains(switchNamed(host, "Destacado"))).toBe(true);
    expect(host.querySelectorAll('[role="switch"]')).toHaveLength(2);
  });
});
