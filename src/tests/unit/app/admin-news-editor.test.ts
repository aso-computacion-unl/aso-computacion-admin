// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { EMPTY_NEWS_FORM_VALUES, NewsForm, type NewsFormValues } from "../../../../app/admin/news/_components/news-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

import { controlsPerLabel } from "./one-control-per-label";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });
const STORED: NewsFormValues = {
  ...EMPTY_NEWS_FORM_VALUES,
  title: "Becas 2026",
  slug: "becas-2026",
  summary: "Se abren las becas.",
  body: "Primer párrafo con **negrita**.\n\n- uno\n- dos",
  publishedAt: "2026-11-02",
  isPublished: true,
};
const COVER = { url: "https://res.cloudinary.com/demo/image/upload/v1/portada.jpg", width: 1600, height: 900 };

const mountForm = (action: Action = ok, initial: Partial<NewsFormValues> = {}, props: { submitLabel?: string; isEditing?: boolean; cover?: typeof COVER | null } = {}) =>
  mount(
    createElement(
      ToastProvider,
      null,
      createElement(NewsForm, { action, submitLabel: props.submitLabel ?? "Guardar cambios", isEditing: props.isEditing ?? true, cover: props.cover ?? null, initialValues: { ...STORED, ...initial } }),
    ),
  );

const labelled = (host: HTMLElement, text: string) => [...host.querySelectorAll("label")].find((label) => label.textContent === text);
const field = (host: HTMLElement, text: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${labelled(host, text)!.htmlFor}"]`)!;
const moreOptions = (host: HTMLElement) => host.querySelector("details")!;
const primary = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = (name: string) => [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name)!;
const version = (value: "before" | "after") => dialog()!.querySelector<HTMLInputElement>(`input[name="preview-version"][value="${value}"]`)!;
const site = () => dialog()!.querySelector("[data-slot='publish-site']")!.textContent;
const changes = () => [...dialog()!.querySelectorAll("[data-slot='publish-changes'] li")].map((item) => item.textContent);
const switchNamed = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent === name)!;

const OUTSIDE = ["Título", "Resumen", "Texto"];
const INSIDE = ["Fecha de publicación", "Identificador (slug)", "Publicar el", "Retirar el"];

describe("the news editor's \"Más opciones\"", () => {
  it("shows Título, Resumen and Texto, with date, slug and schedule in one closed disclosure and no helper paragraphs", async () => {
    const host = await mountForm();
    const details = moreOptions(host);

    expect(host.querySelectorAll("details")).toHaveLength(1);
    expect(details.querySelector("summary")?.textContent).toBe("Más opciones");
    expect(details.open).toBe(false);
    for (const label of OUTSIDE) expect(details.contains(field(host, label)), label).toBe(false);
    for (const label of INSIDE) expect(details.contains(field(host, label)), label).toBe(true);
    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 120 caracteres");
    expect(host.textContent).not.toContain("Déjela vacía");
  });

  it("has no permanent preview column", async () => {
    const host = await mountForm();

    expect(host.querySelector('[aria-label="Vista previa"], [data-slot="form-aside"]')).toBeNull();
    expect(host.textContent).not.toContain("se actualiza al escribir");
  });

  it("keeps the Markdown hint behind a \"?\" next to Texto", async () => {
    const host = await mountForm();
    const toggle = labelled(host, "Texto")!.parentElement!.querySelector<HTMLButtonElement>('button[aria-label="Ayuda"]')!;
    const hint = () => [...host.querySelectorAll("p")].find((paragraph) => paragraph.textContent?.includes("**negrita**, *cursiva*"))!;

    expect(hint().hidden).toBe(true);
    await click(toggle);
    expect(hint().hidden).toBe(false);
  });

  it("opens when the server refuses the identifier", async () => {
    const host = await mountForm(async () => ({ fieldErrors: { slug: "El identificador no puede repetirse." } }), { isPublished: false });

    await click(primary(host));
    await settle();

    expect(moreOptions(host).open).toBe(true);
    expect(moreOptions(host).textContent).toContain("El identificador no puede repetirse.");
  });

  it("stays closed when the error is in Título", async () => {
    const host = await mountForm(ok, { title: "", isPublished: false });

    await click(primary(host));

    expect(host.textContent).toContain("Revise");
    expect(moreOptions(host).open).toBe(false);
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountForm();
    const counters = () => host.textContent!.match(/\d+ \/ \d+/g) ?? [];

    await typeInto(field(host, "Título"), "T".repeat(95));
    await typeInto(field(host, "Resumen"), "R".repeat(223));
    expect(counters()).toEqual([]);

    await typeInto(field(host, "Título"), "T".repeat(96));
    await typeInto(field(host, "Resumen"), "R".repeat(224));
    expect(counters()).toEqual(["96 / 120", "224 / 280"]);
  });

  it("asks for the cover's description only when the news item has a cover", async () => {
    const without = await mountForm();
    expect(labelled(without, "Descripción de la foto de portada")).toBeUndefined();

    const withCover = await mountForm(ok, { coverAlt: "Aula llena" }, { cover: COVER });
    expect(field(withCover, "Descripción de la foto de portada").value).toBe("Aula llena");
  });
});

describe("the labels of the news editor", () => {
  it("name one control each, so no \"?\" help toggle answers to a label", async () => {
    const host = await mountForm(ok, { coverAlt: "Aula llena" }, { cover: COVER });

    for (const [text, controls] of controlsPerLabel(host)) expect(controls.size, text).toBe(1);
  });
});

describe("the news editor's primary button", () => {
  it("reads \"Publicar\" when the item is published and keeps its save label for a draft", async () => {
    const published = await mountForm();
    expect(primary(published).textContent).toBe("Publicar");

    const draft = await mountForm(ok, { isPublished: false });
    expect(primary(draft).textContent).toBe("Guardar cambios");

    const created = await mountForm(ok, { ...EMPTY_NEWS_FORM_VALUES }, { submitLabel: "Crear noticia", isEditing: false });
    expect(primary(created).textContent).toBe("Crear noticia");
  });

  it("follows the Publicada switch: a draft that will be published says \"Publicar\"", async () => {
    const host = await mountForm(ok, { isPublished: false });

    await click(switchNamed(host, "Publicada"));

    expect(primary(host).textContent).toBe("Publicar");
  });

  it("saves a draft straight away, without a preview", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action, { isPublished: false });

    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("publishing a news item", () => {
  it("opens the full-screen preview with the item as the site shows it, and does not submit", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await click(primary(host));

    expect(dialog()).not.toBeNull();
    expect(dialog()!.getAttribute("aria-modal")).toBe("true");
    expect(site()).toContain("Becas 2026");
    expect(site()).toContain("Se abren las becas.");
    expect(site()).toContain("2 nov 2026");
    expect(dialog()!.querySelector("strong")?.textContent).toBe("negrita");
    expect(dialog()!.querySelectorAll("li")).toHaveLength(2);
    expect(action).not.toHaveBeenCalled();
  });

  it("shows the cover with the description written in the form", async () => {
    const host = await mountForm(ok, { coverAlt: "Aula llena" }, { cover: COVER });

    await click(primary(host));

    expect(dialog()!.querySelector("img")?.getAttribute("alt")).toBe("Aula llena");
  });

  it("lists what changed and highlights it in Después; Antes shows the stored row", async () => {
    const host = await mountForm();

    await typeInto(field(host, "Resumen"), "Las becas cierran el viernes.");
    await click(host.querySelector("summary")!);
    await typeInto(field(host, "Fecha de publicación"), "2026-11-05");
    await click(primary(host));

    expect(version("after").checked).toBe(true);
    expect(site()).toContain("Las becas cierran el viernes.");
    expect(changes()).toEqual(["Resumen: Se abren las becas. → Las becas cierran el viernes.", "Fecha de publicación: 2 nov 2026 → 5 nov 2026"]);
    expect(dialog()!.querySelectorAll("mark").length).toBeGreaterThan(0);

    await click(version("before"));

    expect(site()).toContain("Se abren las becas.");
    expect(site()).not.toContain("Las becas cierran");
    expect(dialog()!.querySelectorAll("mark")).toHaveLength(0);
  });

  it("says a draft is not on the site yet, in Antes, and lists no changes", async () => {
    const host = await mountForm(ok, { isPublished: false });

    await click(switchNamed(host, "Publicada"));
    await click(primary(host));
    await click(version("before"));

    expect(dialog()!.textContent).toContain("Todavía no está en el sitio");
    expect(dialog()!.querySelector("[data-slot='publish-changes']")).toBeNull();
  });

  it("closes with \"Seguir editando\", keeps what was typed and gives the focus back to the button", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await typeInto(field(host, "Título"), "Becas 2027");
    primary(host).focus();
    await click(primary(host));
    await click(inDialog("Seguir editando"));

    expect(dialog()).toBeNull();
    expect(field(host, "Título").value).toBe("Becas 2027");
    expect(document.activeElement).toBe(primary(host));
    expect(action).not.toHaveBeenCalled();
  });

  it("shows the errors instead of the preview when the form is invalid", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await typeInto(field(host, "Resumen"), "");
    await click(primary(host));

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Revise");
    expect(field(host, "Resumen").getAttribute("aria-invalid")).toBe("true");
    expect(action).not.toHaveBeenCalled();
  });

  it("submits once with \"Sí, publicar\", closes, and confirms with the publishing toast", async () => {
    const action = vi.fn(ok);
    const host = await mountForm(action);

    await typeInto(field(host, "Título"), "Becas 2027");
    await click(primary(host));

    const confirm = inDialog("Sí, publicar");

    await click(confirm);
    await click(confirm);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("title")).toBe("Becas 2027");
    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Publicado. El sitio se actualiza en un minuto.");
  });

  it("closes when the server refuses, so the errors are in sight", async () => {
    const host = await mountForm(async () => ({ fieldErrors: { slug: "El identificador no puede repetirse." } }));

    await click(primary(host));
    await click(inDialog("Sí, publicar"));
    await settle();

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("El identificador no puede repetirse.");
  });
});
