// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock }) }));

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { RegistrationForm, type RegistrationFormValues } from "../../../../app/admin/registrations/_components/registration-form";
import { RegistrationSavedArrival } from "../../../../app/admin/registrations/_components/registration-saved-arrival";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

import { controlsPerLabel } from "./one-control-per-label";

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });
const OPEN: RegistrationFormValues = { registrationMode: "open", registrationCapacity: "30", registrationDeadline: "" };
const mountForm = (action: Action, initialValues: RegistrationFormValues = OPEN, registeredCount = 0, storedValues?: RegistrationFormValues) =>
  mount(createElement(ToastProvider, null, createElement(RegistrationForm, { action, initialValues, storedValues, registeredCount, submitLabel: "Guardar cambios" })));

const labelled = (host: HTMLElement, text: string) => [...host.querySelectorAll("label")].find((label) => label.textContent === text);
const field = (host: HTMLElement, text: string) => host.querySelector<HTMLInputElement>(`[id="${labelled(host, text)!.htmlFor}"]`)!;
const radio = (host: HTMLElement, value: string) => host.querySelector<HTMLInputElement>(`input[name="registrationMode"][value="${value}"]`)!;
const registrationSwitch = (host: HTMLElement) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent === "Tiene inscripción")!;
const save = (host: HTMLElement) => click(host.querySelector('button[type="submit"]')!);
const dialog = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="alertdialog"]');
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === text)!;
const sent = (action: ReturnType<typeof vi.fn>) => Object.fromEntries((action.mock.calls.at(-1)![1] as FormData).entries());

beforeEach(() => {
  replaceMock.mockReset();
});

afterEach(async () => {
  await unmountAll();
});

describe("RegistrationForm", () => {
  it("sends the three registration settings and nothing else of the event", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await typeInto(field(host, "Cupos"), "45");
    await save(host);
    await settle();

    expect(sent(action)).toEqual({ registrationMode: "open", registrationCapacity: "45", registrationDeadline: "" });
  });

  it("turns the registration off with the switch", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await click(registrationSwitch(host));
    await save(host);
    await settle();

    expect(sent(action).registrationMode).toBe("none");
  });

  it("comes back on with the mode the event had before it was turned off", async () => {
    const host = await mountForm(vi.fn(ok), { registrationMode: "unl", registrationCapacity: "", registrationDeadline: "" });

    await click(radio(host, "open"));
    await click(registrationSwitch(host));

    expect(labelled(host, "Cupos")).toBeUndefined();

    await click(registrationSwitch(host));

    expect(radio(host, "open").checked).toBe(true);
  });

  it("starts on, with the stored mode and seats, for an event that takes registrations", async () => {
    const host = await mountForm(vi.fn(ok));

    expect(registrationSwitch(host).checked).toBe(true);
    expect(radio(host, "open").checked).toBe(true);
    expect([...host.querySelectorAll<HTMLInputElement>('input[name="registrationMode"]')].map((input) => input.value)).toEqual(["unl", "open"]);
    expect(field(host, "Cupos").value).toBe("30");
    expect(labelled(host, "Cierre")).toBeDefined();
  });

  it("names one control per label, so the help toggles of Cupos and Cierre do not answer to their field's name", async () => {
    const perLabel = controlsPerLabel(await mountForm(vi.fn(ok)));

    for (const text of ["Cupos", "Cierre"]) expect(perLabel.get(text)?.size, text).toBe(1);
    for (const [text, controls] of perLabel) expect(controls.size, text).toBe(1);
  });

  it("shows a refused field under it, in the admin's words", async () => {
    const host = await mountForm(async () => ({ fieldErrors: { registrationMode: "El evento ya pasó: su inscripción no se puede abrir ni cambiar, solo desactivar." } }));

    await save(host);
    await settle();

    expect(host.textContent).toContain("El evento ya pasó: su inscripción no se puede abrir ni cambiar, solo desactivar.");
  });

  it("D14: asks before changing the mode of an event with registered people, and sends the confirmation once accepted", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, OPEN, 12);

    await click(radio(host, "unl"));
    await save(host);
    await settle();

    expect(dialog(host)!.textContent).toContain("Este evento ya tiene 12 inscritos.");
    expect(action).not.toHaveBeenCalled();

    await click(button(host, "Guardar el cambio"));
    await settle();

    expect(sent(action)).toMatchObject({ registrationMode: "unl", confirmRegistrationChange: "on" });
  });

  it("D14: on create, judges the change against the event's stored settings: reopening with people still registered asks first", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, { registrationMode: "unl", registrationCapacity: "", registrationDeadline: "" }, 3, { registrationMode: "none", registrationCapacity: "", registrationDeadline: "" });

    await save(host);
    await settle();

    expect(dialog(host)!.textContent).toContain("Este evento ya tiene 3 inscritos.");
    expect(action).not.toHaveBeenCalled();

    await click(button(host, "Guardar el cambio"));
    await settle();

    expect(sent(action)).toMatchObject({ registrationMode: "unl", confirmRegistrationChange: "on" });
  });

  it("D14: asks nothing while nobody is registered", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, OPEN, 0);

    await click(radio(host, "unl"));
    await save(host);
    await settle();

    expect(dialog(host)).toBeNull();
    expect(sent(action).confirmRegistrationChange).toBeUndefined();
  });
});

describe("RegistrationSavedArrival", () => {
  it("confirms the save once and drops the flag from the URL, keeping the event selected", async () => {
    const host = await mount(createElement(ToastProvider, null, createElement(RegistrationSavedArrival, { message: "Inscripción creada.", path: "/admin/registrations?evento=e1" })));
    await settle();

    expect(host.textContent).toContain("Inscripción creada.");
    expect(replaceMock).toHaveBeenCalledWith("/admin/registrations?evento=e1", { scroll: false });
  });
});
