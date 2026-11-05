// @vitest-environment jsdom
import { createElement, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionBar, Field, FormFeedback } from "../../../../app/admin/_components/form-parts";
import { ToastProvider } from "../../../../app/admin/_components/toast";
import { useControlledForm } from "../../../../app/admin/_components/use-controlled-form";
import { SettingsForm } from "../../../../app/admin/settings/_components/settings-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { FIELD_MESSAGES, SETTINGS_FIELD_MESSAGES, fieldMessage } from "@/interface/admin/field-messages";
import { click, mount, typeInto, unmountAll } from "@/tests/support/dom";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const EMPTY = { title: "", summary: "", url: "" };

/* eslint-disable react/no-children-prop -- `Field` takes a render function as its child, which createElement's typing refuses as a positional child. */
type Control = Parameters<ComponentProps<typeof Field>["children"]>[0];

/** A three-field form wired the way the admin forms are: hook, fields, save bar. */
function Harness({ action, fieldMessages }: { action: Action; fieldMessages?: Record<string, string> }) {
  const { bind, handleSubmit, state, isPending, errors } = useControlledForm(action, EMPTY, fieldMessages ? { fieldMessages } : undefined);
  const input = (name: keyof typeof EMPTY, type = "text") =>
    function renderInput(control: Control) {
      return createElement("input", { ...control, ...bind(name), type, required: true });
    };

  return createElement(
    ToastProvider,
    null,
    createElement(
      "form",
      { onSubmit: handleSubmit, noValidate: true },
      createElement(Field, { label: "Título", error: errors.title, children: input("title") }),
      createElement(Field, { label: "Resumen", error: errors.summary, children: input("summary") }),
      createElement(Field, { label: "Enlace", error: errors.url, children: input("url", "url") }),
      createElement(ActionBar, {
        status: createElement(FormFeedback, { state }),
        children: createElement("button", { type: "submit", disabled: isPending }, "Guardar"),
      }),
    ),
  );
}

const ok: Action = async () => ({ success: true });
const field = (host: HTMLElement, label: string) => {
  const labelElement = [...host.querySelectorAll("label")].find((candidate) => candidate.textContent === label)!;

  return host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${labelElement.htmlFor}"]`)!;
};
const invalidFields = (host: HTMLElement) => [...host.querySelectorAll("[aria-invalid='true']")].map((input) => (input as HTMLInputElement).name);
const submit = (host: HTMLElement) => click(host.querySelector('button[type="submit"]')!);
const feedback = (host: HTMLElement) => host.querySelector('[data-slot="form-feedback"]')!;
const messageOf = (host: HTMLElement, label: string) => document.getElementById(field(host, label).getAttribute("aria-describedby")!.split(" ").at(-1)!)?.textContent;

describe("a form with several invalid fields", () => {
  it("shows every empty required field at once, with the same texts the server uses, without calling the action", async () => {
    const action = vi.fn(ok);
    const host = await mount(createElement(Harness, { action }));

    await submit(host);

    expect(invalidFields(host)).toEqual(["title", "summary", "url"]);
    expect(messageOf(host, "Título")).toBe(FIELD_MESSAGES.title);
    expect(messageOf(host, "Enlace")).toBe(FIELD_MESSAGES.url);
    expect(action).not.toHaveBeenCalled();
  });

  it("uses the entity's own wording when its limits differ from the shared one", async () => {
    const host = await mount(createElement(Harness, { action: ok, fieldMessages: { title: "El título admite hasta 60 caracteres." } }));

    await submit(host);

    expect(messageOf(host, "Título")).toBe("El título admite hasta 60 caracteres.");
    expect(messageOf(host, "Resumen")).toBe(fieldMessage("summary"));
  });

  it("counts a field made only of spaces as empty", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await typeInto(field(host, "Título"), "   ");
    await submit(host);

    expect(invalidFields(host)).toContain("title");
  });

  it("flags a value that does not fit the field type, e.g. a link that is not a URL", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "no es un enlace");
    await submit(host);

    expect(invalidFields(host)).toEqual(["url"]);
  });

  it("submits once nothing is invalid", async () => {
    const action = vi.fn(ok);
    const host = await mount(createElement(Harness, { action }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    await submit(host);

    expect(action).toHaveBeenCalledTimes(1);
    expect(invalidFields(host)).toEqual([]);
  });

  it("shows every field error the server returns, not just the first", async () => {
    const action: Action = async () => ({ fieldErrors: { summary: "Mal resumen.", title: "Mal título." } });
    const host = await mount(createElement(Harness, { action }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    await submit(host);

    expect(invalidFields(host)).toEqual(["title", "summary"]);
    expect(messageOf(host, "Título")).toBe("Mal título.");
    expect(messageOf(host, "Resumen")).toBe("Mal resumen.");
  });
});

describe("the save bar summary", () => {
  it("says how many fields to review, in the plural", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await submit(host);

    expect(feedback(host).textContent).toContain("Revise 3 campos.");
  });

  it("says 'Revise 1 campo' in the singular", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "x");
    await submit(host);

    expect(feedback(host).textContent).toContain("Revise 1 campo.");
    expect(feedback(host).textContent).not.toContain("campos");
  });

  it("counts the server's field errors too", async () => {
    const action: Action = async () => ({ fieldErrors: { title: "Mal título.", summary: "Mal resumen." } });
    const host = await mount(createElement(Harness, { action }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    await submit(host);

    expect(feedback(host).textContent).toContain("Revise 2 campos.");
  });

  it("keeps a general error as it is, with no count", async () => {
    const action: Action = async () => ({ error: "No se pudo guardar." });
    const host = await mount(createElement(Harness, { action }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    await submit(host);

    expect(feedback(host).textContent).toContain("No se pudo guardar.");
    expect(feedback(host).textContent).not.toContain("Revise");
  });
});

describe("focus after a failed submit", () => {
  it("moves to the first invalid field when the form itself catches the errors", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await typeInto(field(host, "Título"), "Hola");
    await submit(host);

    expect(document.activeElement).toBe(field(host, "Resumen"));
  });

  it("moves to the first invalid field, in page order, when the server returns the errors", async () => {
    const action: Action = async () => ({ fieldErrors: { url: "Mal enlace.", summary: "Mal resumen." } });
    const host = await mount(createElement(Harness, { action }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    await submit(host);

    expect(document.activeElement).toBe(field(host, "Resumen"));
  });

  it("leaves the focus alone when the save succeeds", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    button.focus();
    await click(button);

    expect(document.activeElement).toBe(button);
  });
});

describe("the screen reader announcement", () => {
  it("is one alert for the whole failure; the field errors are not alerts of their own", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await submit(host);

    const alerts = [...host.querySelectorAll('[role="alert"]')];

    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.textContent).toContain("Revise 3 campos.");
    // The field errors are still read with their field through aria-describedby.
    expect(messageOf(host, "Título")).toBe(FIELD_MESSAGES.title);
    expect(host.querySelectorAll("form [aria-live]")).toHaveLength(0);
  });

  it("is one alert also when the server returns the errors", async () => {
    const action: Action = async () => ({ fieldErrors: { title: "Mal título.", summary: "Mal resumen." } });
    const host = await mount(createElement(Harness, { action }));

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    await submit(host);

    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
});

describe("a successful save", () => {
  it("keeps both the toast and the inline notice, and clears the errors", async () => {
    const host = await mount(createElement(Harness, { action: ok }));

    await submit(host);
    expect(invalidFields(host)).toHaveLength(3);

    await typeInto(field(host, "Título"), "Hola");
    await typeInto(field(host, "Resumen"), "Resumen");
    await typeInto(field(host, "Enlace"), "https://aso.test");
    await submit(host);

    expect(invalidFields(host)).toEqual([]);
    expect(feedback(host).textContent).toContain("Cambios guardados.");
    expect(feedback(host).textContent).not.toContain("Revise");
    expect(host.querySelector('[role="status"][aria-live="polite"] li')?.textContent).toContain("Cambios guardados.");
  });
});

describe("the site settings form, which keeps its own editor state", () => {
  it("shows every empty field at once, announces once and focuses the first", async () => {
    const action = vi.fn(ok);
    const host = await mount(createElement(SettingsForm, { action, initialValues: { tagline: "Lema", description: "Descripción", about: "Acerca" } }));

    await click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Editar"))!);
    for (const label of ["Lema", "Descripción", "Acerca de"]) await typeInto(field(host, label), "");
    await submit(host);

    expect(invalidFields(host)).toEqual(["tagline", "description", "about"]);
    expect(messageOf(host, "Lema")).toBe(SETTINGS_FIELD_MESSAGES.tagline);
    expect(feedback(host).textContent).toContain("Revise 3 campos.");
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(document.activeElement).toBe(field(host, "Lema"));
    expect(action).not.toHaveBeenCalled();
  });
});
