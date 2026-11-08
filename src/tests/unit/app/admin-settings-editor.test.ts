// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { SettingsForm, type SettingsFormValues } from "../../../../app/admin/settings/_components/settings-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

import { controlsPerLabel } from "./one-control-per-label";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });
const STORED: SettingsFormValues = { tagline: "Comunidad de computación", description: "Talleres y charlas.", about: "Somos la asociación." };

const mountForm = (action: Action = ok) => mount(createElement(ToastProvider, null, createElement(SettingsForm, { action, initialValues: STORED })));
const mountEmpty = (action: Action = ok) => mount(createElement(ToastProvider, null, createElement(SettingsForm, { action })));

const button = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.trim() === name)!;
const field = (host: HTMLElement, text: string) => {
  const label = [...host.querySelectorAll("label")].find((candidate) => candidate.textContent === text)!;

  return host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${label.htmlFor}"]`)!;
};
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = (name: string) => [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === name)!;
const version = (value: "before" | "after") => dialog()!.querySelector<HTMLInputElement>(`input[name="preview-version"][value="${value}"]`)!;
const site = () => dialog()!.querySelector("[data-slot='publish-site']")!.textContent;
const changes = () => [...dialog()!.querySelectorAll("[data-slot='publish-changes'] li")].map((item) => item.textContent);
const edit = async (host: HTMLElement) => {
  await click(button(host, "Editar"));
};

describe("the site texts editor", () => {
  it("reads the saved texts and opens the three fields only on \"Editar\"", async () => {
    const host = await mountForm();

    expect(host.querySelector("form")).toBeNull();
    expect(host.textContent).toContain("Comunidad de computación");

    await edit(host);

    for (const label of ["Lema", "Descripción", "Acerca de"]) expect(field(host, label), label).toBeTruthy();
    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 120 caracteres");
  });

  it("has no permanent preview column", async () => {
    const host = await mountForm();

    expect(host.querySelector('[aria-label="Vista previa"], [data-slot="form-aside"]')).toBeNull();
    await edit(host);
    expect(host.querySelector('[aria-label="Vista previa"], [data-slot="form-aside"]')).toBeNull();
  });

  it("says \"Publicar\" where it said \"Guardar cambios\", and keeps \"Cancelar\"", async () => {
    const host = await mountForm();

    await edit(host);

    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.textContent).toBe("Publicar");
    expect(button(host, "Cancelar")).toBeTruthy();
    expect([...host.querySelectorAll("button")].some((candidate) => candidate.textContent === "Guardar cambios")).toBe(false);
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountForm();
    const counters = () => host.textContent!.match(/\d+ \/ \d+/g) ?? [];

    await edit(host);
    await typeInto(field(host, "Lema"), "L".repeat(95));
    expect(counters()).toEqual([]);

    await typeInto(field(host, "Lema"), "L".repeat(96));
    expect(counters()).toEqual(["96 / 120"]);
  });

  it("names one control per label", async () => {
    const host = await mountForm();

    await edit(host);

    for (const [text, controls] of controlsPerLabel(host)) expect(controls.size, text).toBe(1);
  });
});

describe("publishing the site texts", () => {
  it("opens the full-screen preview with the texts as typed and does not submit", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await edit(host);
    await typeInto(field(host, "Lema"), "Aprender haciendo");
    await click(button(host, "Publicar"));

    expect(dialog()).not.toBeNull();
    expect(dialog()!.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog()!.getAttribute("aria-labelledby")!)?.textContent).toBe("Así queda");
    expect(site()).toContain("ASO Computación · Aprender haciendo");
    expect(site()).toContain("Talleres y charlas.");
    expect(site()).toContain("Somos la asociación.");
    expect(action).not.toHaveBeenCalled();
  });

  it("lists what changed, highlights it in Después, and shows the saved texts in Antes", async () => {
    const host = await mountForm();

    await edit(host);
    await typeInto(field(host, "Lema"), "Aprender haciendo");
    await typeInto(field(host, "Acerca de"), "Somos la asociación estudiantil.");
    await click(button(host, "Publicar"));

    expect(version("after").checked).toBe(true);
    expect(changes()).toEqual(["Lema: Comunidad de computación → Aprender haciendo", "Acerca de: Somos la asociación. → Somos la asociación estudiantil."]);
    expect(dialog()!.querySelectorAll("mark").length).toBeGreaterThan(0);

    await click(version("before"));

    expect(site()).toContain("ASO Computación · Comunidad de computación");
    expect(site()).not.toContain("Aprender haciendo");
    expect(dialog()!.querySelectorAll("mark")).toHaveLength(0);
  });

  it("says nothing was saved before when the site still uses its own texts", async () => {
    const host = await mountEmpty();

    await edit(host);
    for (const [label, text] of [["Lema", "Lema nuevo"], ["Descripción", "Descripción nueva"], ["Acerca de", "Acerca de nuevo"]] as const) await typeInto(field(host, label), text);
    await click(button(host, "Publicar"));
    await click(version("before"));

    expect(dialog()!.textContent).toContain("Todavía no está en el sitio");
    expect(dialog()!.querySelector("[data-slot='publish-changes']")).toBeNull();
  });

  it("closes with \"Seguir editando\", keeps what was typed and gives the focus back to the button", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await edit(host);
    await typeInto(field(host, "Lema"), "Aprender haciendo");
    button(host, "Publicar").focus();
    await click(button(host, "Publicar"));
    await click(inDialog("Seguir editando"));

    expect(dialog()).toBeNull();
    expect(field(host, "Lema").value).toBe("Aprender haciendo");
    expect(document.activeElement).toBe(button(host, "Publicar"));
    expect(action).not.toHaveBeenCalled();
  });

  it("shows every error instead of the preview when a field is empty", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await edit(host);
    await typeInto(field(host, "Lema"), "");
    await typeInto(field(host, "Acerca de"), "");
    await click(button(host, "Publicar"));

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Revise 2 campos.");
    expect(field(host, "Lema").getAttribute("aria-invalid")).toBe("true");
    expect(action).not.toHaveBeenCalled();
  });

  it("submits once with \"Sí, publicar\", closes the preview and the fields, and confirms with the publishing toast", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await edit(host);
    await typeInto(field(host, "Lema"), "Aprender haciendo");
    await click(button(host, "Publicar"));

    const confirm = inDialog("Sí, publicar");

    await click(confirm);
    await click(confirm);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("tagline")).toBe("Aprender haciendo");
    expect(dialog()).toBeNull();
    expect(host.querySelector("form")).toBeNull();
    expect(host.textContent).toContain("Publicado. El sitio se actualiza en un minuto.");
    expect(host.textContent).toContain("Aprender haciendo");
  });

  it("closes the preview when the server refuses and keeps the fields open with what was typed", async () => {
    const host = await mountForm(async () => ({ fieldErrors: { tagline: "El lema es demasiado largo." } }));

    await edit(host);
    await typeInto(field(host, "Lema"), "Aprender haciendo");
    await click(button(host, "Publicar"));
    await click(inDialog("Sí, publicar"));
    await settle();

    expect(dialog()).toBeNull();
    expect(field(host, "Lema").value).toBe("Aprender haciendo");
    expect(host.textContent).toContain("El lema es demasiado largo.");
  });
});
