// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { EventForm } from "../../../../app/admin/events/_components/event-form";
import { FaqForm, type FaqFormValues } from "../../../../app/admin/faqs/_components/faq-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { EMPTY_EVENT_FORM_VALUES, type EventFormValues } from "@/interface/admin/events/event-form-values";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });
const PUBLISHED: Partial<EventFormValues> = {
  title: "Hackathon UNL 2026",
  slug: "hackathon",
  date: "2026-11-21",
  isPublished: true,
  registrationMode: "unl",
  registrationCapacity: "60",
};
const mountEvent = (action: Action = ok, initial: Partial<EventFormValues> = PUBLISHED) =>
  mount(createElement(ToastProvider, null, createElement(EventForm, { action, submitLabel: "Guardar cambios", initialValues: { ...EMPTY_EVENT_FORM_VALUES, ...initial } })));
const mountFaq = (action: Action = ok, initial: Partial<FaqFormValues> = {}) =>
  mount(
    createElement(
      ToastProvider,
      null,
      createElement(FaqForm, { action, submitLabel: "Guardar cambios", initialValues: { question: "¿Cómo entro?", answer: "Con su cuenta.", command: "", isPublished: true, ...initial } }),
    ),
  );

const field = (host: HTMLElement, text: string) => {
  const label = [...host.querySelectorAll("label")].find((candidate) => candidate.textContent === text)!;

  return host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${label.htmlFor}"]`)!;
};
const primary = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = (name: string) => [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name)!;
const version = (value: "before" | "after") => dialog()!.querySelector<HTMLInputElement>(`input[name="preview-version"][value="${value}"]`)!;
const site = () => dialog()!.querySelector("[data-slot='publish-site']")!.textContent;
const changes = () => [...dialog()!.querySelectorAll("[data-slot='publish-changes'] li")].map((item) => item.textContent);
const switchNamed = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent === name)!;
const keydown = (target: Element, key: string, init: KeyboardEventInit = {}) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });

describe("the event editor's primary button", () => {
  it("reads \"Publicar\" when the event is published and keeps its save label for a draft", async () => {
    const published = await mountEvent();
    expect(primary(published).textContent).toBe("Publicar");

    const draft = await mountEvent(ok, { ...PUBLISHED, isPublished: false });
    expect(primary(draft).textContent).toBe("Guardar cambios");
  });

  it("follows the Publicado switch: a draft that will be published says \"Publicar\"", async () => {
    const host = await mountEvent(ok, { ...PUBLISHED, isPublished: false });

    await click(switchNamed(host, "Publicado"));

    expect(primary(host).textContent).toBe("Publicar");
  });

  it("saves a draft straight away, without a preview", async () => {
    const action = vi.fn(ok);
    const host = await mountEvent(action, { ...PUBLISHED, isPublished: false });

    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("publishing an event", () => {
  it("opens a full-screen dialog with the preview and does not submit", async () => {
    const action = vi.fn(ok);
    const host = await mountEvent(action);

    await click(primary(host));

    expect(dialog()).not.toBeNull();
    expect(dialog()!.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog()!.getAttribute("aria-labelledby")!)?.textContent).toBe("Así queda");
    expect(site()).toContain("Hackathon UNL 2026");
    expect(action).not.toHaveBeenCalled();
  });

  it("closes with \"Seguir editando\", keeps what was typed, and gives the focus back to the button", async () => {
    const action = vi.fn(ok);
    const host = await mountEvent(action);

    await typeInto(field(host, "Cupos"), "80");
    primary(host).focus();
    await click(primary(host));
    await click(inDialog("Seguir editando"));

    expect(dialog()).toBeNull();
    expect(field(host, "Cupos").value).toBe("80");
    expect(document.activeElement).toBe(primary(host));
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps the focus inside while it is open (Tab wraps both ways) and closes with Escape", async () => {
    const host = await mountEvent();

    primary(host).focus();
    await click(primary(host));
    expect(dialog()!.contains(document.activeElement)).toBe(true);

    inDialog("Sí, publicar").focus();
    await keydown(inDialog("Sí, publicar"), "Tab");
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(inDialog("Sí, publicar"));

    await keydown(document.activeElement!, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(inDialog("Sí, publicar"));

    await keydown(dialog()!, "Escape");
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(primary(host));
  });

  it("shows Después (the form) and Antes (the stored row) with a real radio pair, and lists what changed", async () => {
    const host = await mountEvent();

    await typeInto(field(host, "Cupos"), "80");
    await click(primary(host));

    expect(version("after").checked).toBe(true);
    expect(version("before").type).toBe("radio");
    expect(site()).toContain("80");
    expect(changes()).toEqual(["Cupos: 60 → 80"]);
    expect(dialog()!.querySelectorAll("mark").length).toBeGreaterThan(0);

    await click(version("before"));

    expect(version("before").checked).toBe(true);
    expect(site()).toContain("60");
    expect(site()).not.toContain("80");
    expect(dialog()!.querySelectorAll("mark")).toHaveLength(0);
  });

  it("says a new event is not on the site yet, in Antes, and lists no changes", async () => {
    const host = await mountEvent(ok, { ...EMPTY_EVENT_FORM_VALUES });

    await typeInto(field(host, "Título"), "Taller de Git");
    await click(switchNamed(host, "Publicado"));
    await click(primary(host));
    await click(version("before"));

    expect(dialog()!.textContent).toContain("Todavía no está en el sitio");
    expect(dialog()!.querySelector("[data-slot='publish-changes']")).toBeNull();
  });

  it("treats a stored draft as not on the site yet", async () => {
    const host = await mountEvent(ok, { ...PUBLISHED, isPublished: false });

    await click(switchNamed(host, "Publicado"));
    await click(primary(host));
    await click(version("before"));

    expect(dialog()!.textContent).toContain("Todavía no está en el sitio");
  });

  it("shows the errors instead of the preview when the form is invalid", async () => {
    const action = vi.fn(ok);
    const host = await mountEvent(action);

    await typeInto(field(host, "Título"), "");
    await click(primary(host));

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Revise");
    expect(field(host, "Título").getAttribute("aria-invalid")).toBe("true");
    expect(action).not.toHaveBeenCalled();
  });

  it("submits once with \"Sí, publicar\", closes, and confirms with the publishing toast", async () => {
    const action = vi.fn(ok);
    const host = await mountEvent(action);

    await typeInto(field(host, "Cupos"), "80");
    await click(primary(host));

    const confirm = inDialog("Sí, publicar");

    await click(confirm);
    await click(confirm);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("registrationCapacity")).toBe("80");
    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Publicado. El sitio se actualiza en un minuto.");
  });

  it("closes when the server refuses, so the errors are in sight", async () => {
    const host = await mountEvent(async () => ({ fieldErrors: { registrationCapacity: "Use un número entero." } }));

    await click(primary(host));
    await click(inDialog("Sí, publicar"));
    await settle();

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Use un número entero.");
  });
});

describe("publishing a FAQ", () => {
  it("shows the question card with its command line, and what changed", async () => {
    const host = await mountFaq();

    await typeInto(field(host, "Respuesta"), "Con su cuenta UNL.");
    await click(host.querySelector("summary")!);
    await typeInto(field(host, "Comando (opcional)"), "inscribirme");
    await click(primary(host));

    expect(primary(host).textContent).toBe("Publicar");
    expect(site()).toContain("¿Cómo entro?");
    expect(site()).toContain("Con su cuenta UNL.");
    expect(site()).toContain("❯ git help inscribirme");
    expect(changes()).toEqual(["Respuesta: Con su cuenta. → Con su cuenta UNL.", "Comando: Sin comando → inscribirme"]);

    await click(version("before"));
    expect(site()).not.toContain("git help");
  });

  it("does not submit on open or on \"Seguir editando\", and submits once on \"Sí, publicar\"", async () => {
    const action = vi.fn(ok);
    const host = await mountFaq(action);

    await click(primary(host));
    await click(inDialog("Seguir editando"));
    expect(action).not.toHaveBeenCalled();

    await click(primary(host));
    await click(inDialog("Sí, publicar"));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Publicado. El sitio se actualiza en un minuto.");
  });

  it("keeps its save label for a draft and saves it straight away", async () => {
    const action = vi.fn(ok);
    const host = await mountFaq(action, { isPublished: false });

    expect(primary(host).textContent).toBe("Guardar cambios");
    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the errors instead of the preview when the question is empty", async () => {
    const host = await mountFaq();

    await typeInto(field(host, "Pregunta"), "");
    await click(primary(host));

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Revise");
  });
});
