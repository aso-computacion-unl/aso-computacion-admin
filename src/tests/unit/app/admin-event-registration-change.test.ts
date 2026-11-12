// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { EventForm } from "../../../../app/admin/events/_components/event-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { EMPTY_EVENT_FORM_VALUES, type EventFormValues } from "@/interface/admin/events/event-form-values";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

/*
 * D14 (R8): in the event form, changing the registration mode, or lowering the seats below the people already
 * registered, asks "Este evento ya tiene N inscritos…" before saving and states the consequence. Nothing is sent
 * until the admin confirms, and the confirmation travels as a flag the server requires.
 */
afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });
const EDITING: Partial<EventFormValues> = { title: "Taller de Git", slug: "taller-de-git", registrationMode: "open", registrationCapacity: "30" };
const mountForm = (action: Action, registeredCount: number, initial: Partial<EventFormValues> = EDITING) =>
  mount(createElement(ToastProvider, null, createElement(EventForm, { action, submitLabel: "Guardar cambios", registeredCount, initialValues: { ...EMPTY_EVENT_FORM_VALUES, ...EDITING, ...initial } })));

const labelled = (host: HTMLElement, text: string) => [...host.querySelectorAll("label")].find((label) => label.textContent === text);
const field = (host: HTMLElement, text: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${labelled(host, text)!.htmlFor}"]`)!;
const radio = (host: HTMLElement, value: string) => host.querySelector<HTMLInputElement>(`input[name="registrationMode"][value="${value}"]`)!;
const switchNamed = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent === name)!;
const save = (host: HTMLElement) => click(host.querySelector('button[type="submit"]')!);
const dialog = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="alertdialog"]');
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === text)!;
const sent = (action: ReturnType<typeof vi.fn>) => action.mock.calls.at(-1)![1] as FormData;

describe("asking before a change that affects the people already registered (D14)", () => {
  it("asks, with how many are registered and what happens, when the mode changes; nothing is sent yet", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, 12);

    await click(radio(host, "unl"));
    await save(host);
    await settle();

    expect(dialog(host)).not.toBeNull();
    expect(dialog(host)!.textContent).toContain("Este evento ya tiene 12 inscritos.");
    expect(dialog(host)!.textContent).toMatch(/Cuenta UNL/);
    expect(dialog(host)!.textContent).toMatch(/conservan su cupo/);
    expect(action).not.toHaveBeenCalled();
  });

  it("sends the save with the confirmation flag once the admin accepts, and the question goes away", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, 12);

    await click(radio(host, "unl"));
    await save(host);
    await click(button(host, "Guardar el cambio"));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(sent(action).get("registrationMode")).toBe("unl");
    expect(sent(action).get("confirmRegistrationChange")).toBe("on");
    expect(dialog(host)).toBeNull();
  });

  it("sends nothing and keeps the edits when the admin keeps editing, and a later plain save carries no flag", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, 12);

    await click(radio(host, "unl"));
    await save(host);
    await click(button(host, "Seguir editando"));
    await settle();

    expect(action).not.toHaveBeenCalled();
    expect(dialog(host)).toBeNull();
    expect(radio(host, "unl").checked).toBe(true);

    await click(radio(host, "open"));
    await typeInto(field(host, "Título"), "Taller de Git 2");
    await save(host);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(sent(action).get("title")).toBe("Taller de Git 2");
    expect(sent(action).has("confirmRegistrationChange")).toBe(false);
  });

  it("asks when the seats go below the registered people and says the event will be full, but not at or above their number", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, 12);

    await typeInto(field(host, "Cupos"), "11");
    await save(host);
    await settle();

    expect(dialog(host)!.textContent).toContain("Este evento ya tiene 12 inscritos.");
    expect(dialog(host)!.textContent).toMatch(/11 cupos/);
    expect(dialog(host)!.textContent).toMatch(/agotado/);
    expect(action).not.toHaveBeenCalled();

    await click(button(host, "Seguir editando"));
    await typeInto(field(host, "Cupos"), "12");
    await save(host);
    await settle();

    expect(dialog(host)).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
    expect(sent(action).has("confirmRegistrationChange")).toBe(false);
  });

  it("asks when registration is switched off, naming what happens to the registered people", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, 3);

    await click(switchNamed(host, "Tiene inscripción"));
    await save(host);
    await settle();

    expect(dialog(host)!.textContent).toContain("Este evento ya tiene 3 inscritos.");
    expect(dialog(host)!.textContent).toMatch(/Si quita la inscripción/);
    expect(action).not.toHaveBeenCalled();
  });

  it("uses the singular for one registered person", async () => {
    const host = await mountForm(vi.fn(ok), 1);

    await click(radio(host, "unl"));
    await save(host);
    await settle();

    expect(dialog(host)!.textContent).toContain("Este evento ya tiene 1 inscrito.");
  });

  it.each([
    ["nobody is registered yet", 0, async (host: HTMLElement) => click(radio(host, "unl"))],
    ["only another field changes", 12, async (host: HTMLElement) => typeInto(field(host, "Título"), "Otro título")],
    ["the seats go up", 12, async (host: HTMLElement) => typeInto(field(host, "Cupos"), "40")],
    ["the limit is lifted", 12, async (host: HTMLElement) => typeInto(field(host, "Cupos"), "")],
  ])("saves at once, without a flag, when %s", async (_label, registered, edit) => {
    const action = vi.fn(ok);
    const host = await mountForm(action, registered);

    await edit(host);
    await save(host);
    await settle();

    expect(dialog(host)).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
    expect(sent(action).has("confirmRegistrationChange")).toBe(false);
  });

  it("does not ask again for what was saved: the next save of other fields goes straight through", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, 12);

    await click(radio(host, "unl"));
    await save(host);
    await click(button(host, "Guardar el cambio"));
    await settle();
    await typeInto(field(host, "Título"), "Taller de Git v2");
    await save(host);
    await settle();

    expect(action).toHaveBeenCalledTimes(2);
    expect(dialog(host)).toBeNull();
  });

  it("asks again for a different change after one was saved", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, 12);

    await click(radio(host, "unl"));
    await save(host);
    await click(button(host, "Guardar el cambio"));
    await settle();
    await click(radio(host, "open"));
    await save(host);
    await settle();

    expect(dialog(host)).not.toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the server's refusal as the form's error when it did not take the confirmation", async () => {
    const refusal = "Este evento ya tiene 13 inscritos. Confirme el cambio para guardarlo.";
    const host = await mountForm(async () => ({ error: refusal }), 12);

    await click(radio(host, "unl"));
    await save(host);
    await click(button(host, "Guardar el cambio"));
    await settle();

    expect(host.textContent).toContain(refusal);
  });
});
