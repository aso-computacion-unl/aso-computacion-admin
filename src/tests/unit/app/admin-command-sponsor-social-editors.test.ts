// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { CommandForm, EMPTY_COMMAND_FORM_VALUES, type CommandFormValues } from "../../../../app/admin/commands/_components/command-form";
import { EMPTY_SOCIAL_FORM_VALUES, SocialForm, type SocialFormValues } from "../../../../app/admin/socials/_components/social-form";
import { EMPTY_SPONSOR_FORM_VALUES, SponsorForm, type SponsorFormValues } from "../../../../app/admin/sponsors/_components/sponsor-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

import { controlsPerLabel } from "./one-control-per-label";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });

const COMMAND: CommandFormValues = { command: "ayuda", description: "Lista los comandos", output: "Escriba un comando", isPublished: true };
const SPONSOR: SponsorFormValues = { name: "Acme", url: "https://acme.example", logoAlt: "Logo de Acme", isPublished: true };
const SOCIAL: SocialFormValues = {
  platform: "instagram",
  label: "Instagram",
  handle: "@aso",
  url: "https://instagram.com/aso",
  note: "Oficial",
  blurb: "Novedades de la carrera",
  isPublished: true,
};
const LOGO = "https://res.cloudinary.com/demo/image/upload/v1/acme.png";

const wrap = (form: ReturnType<typeof createElement>) => createElement(ToastProvider, null, form);

const mountCommand = (action: Action = ok, initial: Partial<CommandFormValues> = {}, submitLabel = "Guardar cambios") =>
  mount(wrap(createElement(CommandForm, { action, submitLabel, initialValues: { ...COMMAND, ...initial } })));

const mountSponsor = (action: Action = ok, initial: Partial<SponsorFormValues> = {}, props: { submitLabel?: string; hasLogo?: boolean; logoUrl?: string | null } = {}) =>
  mount(
    wrap(
      createElement(SponsorForm, {
        action,
        submitLabel: props.submitLabel ?? "Guardar cambios",
        hasLogo: props.hasLogo ?? true,
        logoUrl: props.logoUrl === undefined ? LOGO : props.logoUrl,
        initialValues: { ...SPONSOR, ...initial },
      }),
    ),
  );

const mountSocial = (action: Action = ok, initial: Partial<SocialFormValues> = {}, submitLabel = "Guardar cambios") =>
  mount(wrap(createElement(SocialForm, { action, submitLabel, initialValues: { ...SOCIAL, ...initial } })));

const labelled = (host: HTMLElement, text: string) => [...host.querySelectorAll("label")].find((label) => label.textContent === text);
const field = (host: HTMLElement, text: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${labelled(host, text)!.htmlFor}"]`)!;
const primary = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = (name: string) => [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name)!;
const version = (value: "before" | "after") => dialog()!.querySelector<HTMLInputElement>(`input[name="preview-version"][value="${value}"]`)!;
const site = () => dialog()!.querySelector("[data-slot='publish-site']")!;
const changes = () => [...dialog()!.querySelectorAll("[data-slot='publish-changes'] li")].map((item) => item.textContent);
const switchNamed = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent?.startsWith(name))!;
const counters = (host: HTMLElement) => host.textContent!.match(/\d+ \/ \d+/g) ?? [];
const helpOf = (host: HTMLElement, text: string) => host.querySelector(`[id="${labelled(host, text)!.htmlFor}"]`)!.closest("div")!.querySelector<HTMLElement>('[id$="-help"]');
const moreOptions = (host: HTMLElement) => [...host.querySelectorAll("details")].find((details) => details.querySelector("summary")?.textContent === "Más opciones")!;

describe("the command editor", () => {
  it("has no helper paragraphs, no drafts note and no preview panel in the page", async () => {
    const host = await mountCommand();

    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 600 caracteres");
    expect(host.textContent).not.toContain("Los borradores no salen");
    expect(host.textContent).not.toContain("Vista previa");
    expect(host.textContent).not.toContain("En la ayuda");
    expect(host.textContent).not.toContain("❯");
  });

  it("keeps a short help for the command behind its \"?\"", async () => {
    const host = await mountCommand();
    const help = helpOf(host, "Comando")!;

    expect(help.hidden).toBe(true);
    expect(help.textContent!.length).toBeLessThanOrEqual(60);
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountCommand();

    await typeInto(field(host, "Respuesta"), "R".repeat(479));
    expect(counters(host)).toEqual([]);

    await typeInto(field(host, "Respuesta"), "R".repeat(480));
    expect(counters(host)).toEqual(["480 / 600"]);
  });

  it("names one control per label", async () => {
    const host = await mountCommand();

    for (const [text, controls] of controlsPerLabel(host)) expect(controls.size, text).toBe(1);
  });

  it("reads \"Publicar\" when published and keeps its save label for a draft", async () => {
    expect(primary(await mountCommand()).textContent).toBe("Publicar");
    expect(primary(await mountCommand(ok, { isPublished: false })).textContent).toBe("Guardar cambios");
    expect(primary(await mountCommand(ok, { ...EMPTY_COMMAND_FORM_VALUES }, "Crear comando")).textContent).toBe("Crear comando");
  });

  it("saves a draft straight away, without a preview", async () => {
    const action = vi.fn(ok);
    const host = await mountCommand(action, { isPublished: false });

    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("previews the terminal, lists the change and submits once with \"Sí, publicar\"", async () => {
    const action = vi.fn(ok);
    const host = await mountCommand(action);

    await typeInto(field(host, "Respuesta"), "Use ayuda");
    await click(primary(host));

    expect(action).not.toHaveBeenCalled();
    expect(site().textContent).toContain("❯ ayuda");
    expect(site().textContent).toContain("Use ayuda");
    expect(site().textContent).toContain("En la ayuda: ayuda — Lista los comandos");
    expect(changes()).toEqual(["Respuesta: Escriba un comando → Use ayuda"]);

    await click(version("before"));
    expect(site().textContent).toContain("Escriba un comando");
    expect(site().textContent).not.toContain("Use ayuda");

    const confirm = inDialog("Sí, publicar");
    await click(confirm);
    await click(confirm);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("output")).toBe("Use ayuda");
    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Publicado. El sitio se actualiza en un minuto.");
  });

  it("shows the errors instead of the preview when the form is invalid", async () => {
    const action = vi.fn(ok);
    const host = await mountCommand(action);

    await typeInto(field(host, "Comando"), "");
    await click(primary(host));

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Revise");
    expect(action).not.toHaveBeenCalled();
  });
});

describe("the sponsor editor", () => {
  it("has no helper paragraphs and no drafts note", async () => {
    const host = await mountSponsor();

    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 60 caracteres");
    expect(host.textContent).not.toContain("Obligatoria, para accesibilidad");
    expect(host.textContent).not.toContain("Los borradores no salen");
  });

  it("still says why a sponsor without a logo cannot be published", async () => {
    const host = await mountSponsor(ok, { isPublished: false, logoAlt: "" }, { hasLogo: false, logoUrl: null });

    expect(host.textContent).toContain("Sin logo no se puede publicar");
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountSponsor();

    await typeInto(field(host, "Nombre"), "N".repeat(47));
    expect(counters(host)).toEqual([]);

    await typeInto(field(host, "Nombre"), "N".repeat(48));
    expect(counters(host)).toEqual(["48 / 60"]);
  });

  it("names one control per label", async () => {
    const host = await mountSponsor();

    for (const [text, controls] of controlsPerLabel(host)) expect(controls.size, text).toBe(1);
  });

  it("reads \"Publicar\" when published and keeps its save label for a draft", async () => {
    expect(primary(await mountSponsor()).textContent).toBe("Publicar");
    expect(primary(await mountSponsor(ok, { isPublished: false })).textContent).toBe("Guardar cambios");
    expect(primary(await mountSponsor(ok, { ...EMPTY_SPONSOR_FORM_VALUES }, { submitLabel: "Agregar aliado", hasLogo: false, logoUrl: null })).textContent).toBe("Agregar aliado");
  });

  it("saves a draft straight away, without a preview", async () => {
    const action = vi.fn(ok);
    const host = await mountSponsor(action, { isPublished: false });

    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("previews the logo as a link, lists the change and submits once with \"Sí, publicar\"", async () => {
    const action = vi.fn(ok);
    const host = await mountSponsor(action);

    await typeInto(field(host, "Enlace (opcional)"), "https://acme.example/es");
    await click(primary(host));

    expect(action).not.toHaveBeenCalled();

    const image = site().querySelector("img")!;

    expect(image.getAttribute("alt")).toBe("Logo de Acme");
    expect(image.getAttribute("src")).toContain("res.cloudinary.com/demo/image/upload/");
    expect(image.closest("a")?.getAttribute("href")).toBe("https://acme.example/es");
    expect(site().textContent).toContain("Acme");
    expect(changes()).toEqual(["Enlace: https://acme.example → https://acme.example/es"]);

    await click(inDialog("Sí, publicar"));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("url")).toBe("https://acme.example/es");
    expect(dialog()).toBeNull();
  });

  it("shows the logo without a link when the sponsor has no address", async () => {
    const host = await mountSponsor(ok, { url: "" });

    await typeInto(field(host, "Nombre"), "Acme SA");
    await click(primary(host));

    expect(site().querySelector("img")).not.toBeNull();
    expect(site().querySelector("a")).toBeNull();
  });

  it("closes the preview when the server refuses a sponsor without a logo, so the error is in sight", async () => {
    const host = await mountSponsor(async () => ({ fieldErrors: { logo: "Suba un logo antes de publicar." } }), { isPublished: false, logoAlt: "" }, { hasLogo: false, logoUrl: null });

    await click(switchNamed(host, "Publicado"));
    await click(primary(host));
    await click(version("before"));
    expect(dialog()!.textContent).toContain("Todavía no está en el sitio");

    await click(inDialog("Sí, publicar"));
    await settle();

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Suba un logo antes de publicar.");
  });
});

describe("the social link editor", () => {
  it("has no helper paragraphs and no drafts note", async () => {
    const host = await mountSocial();

    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 40 caracteres");
    expect(host.textContent).not.toContain("Los borradores no salen");
  });

  it("keeps the note and the short description in \"Más opciones\", closed", async () => {
    const host = await mountSocial();
    const more = moreOptions(host);

    expect(more.open).toBe(false);
    expect([...more.querySelectorAll("label")].map((label) => label.textContent)).toEqual(["Nota (opcional)", "Descripción corta (opcional)"]);
    expect(more.contains(field(host, "Nombre"))).toBe(false);
    expect(more.contains(field(host, "Enlace"))).toBe(false);
  });

  it.each([
    ["note", "Nota (opcional)"],
    ["blurb", "Descripción corta (opcional)"],
  ] as const)("opens \"Más opciones\" on the %s error", async (key, label) => {
    const host = await mountSocial(async () => ({ fieldErrors: { [key]: "Es demasiado largo." } }), { isPublished: false });

    expect(moreOptions(host).open).toBe(false);

    await click(primary(host));
    await settle();

    expect(moreOptions(host).open).toBe(true);
    expect(moreOptions(host).textContent).toContain("Es demasiado largo.");
    expect(moreOptions(host).contains(field(host, label))).toBe(true);
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountSocial();

    await typeInto(field(host, "Nombre"), "N".repeat(31));
    expect(counters(host)).toEqual([]);

    await typeInto(field(host, "Nombre"), "N".repeat(32));
    expect(counters(host)).toEqual(["32 / 40"]);
  });

  it("names one control per label", async () => {
    const host = await mountSocial();

    for (const [text, controls] of controlsPerLabel(host)) expect(controls.size, text).toBe(1);
  });

  it("still renames the link with the platform while its name is the platform's own", async () => {
    const host = await mountSocial(ok, { label: "Instagram" });
    const select = field(host, "Red") as unknown as HTMLSelectElement;

    await act(async () => {
      select.value = "tiktok";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(field(host, "Nombre").value).toBe("TikTok");

    await typeInto(field(host, "Nombre"), "Mi canal");
    await act(async () => {
      select.value = "youtube";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(field(host, "Nombre").value).toBe("Mi canal");
  });

  it("reads \"Publicar\" when published and keeps its save label for a draft", async () => {
    expect(primary(await mountSocial()).textContent).toBe("Publicar");
    expect(primary(await mountSocial(ok, { isPublished: false })).textContent).toBe("Guardar cambios");
    expect(primary(await mountSocial(ok, { ...EMPTY_SOCIAL_FORM_VALUES }, "Agregar red")).textContent).toBe("Agregar red");
  });

  it("saves a draft straight away, without a preview", async () => {
    const action = vi.fn(ok);
    const host = await mountSocial(action, { isPublished: false });

    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("previews the link, lists the change and submits once with \"Sí, publicar\"", async () => {
    const action = vi.fn(ok);
    const host = await mountSocial(action);

    await typeInto(field(host, "Usuario"), "@aso_computacion");
    await click(primary(host));

    expect(action).not.toHaveBeenCalled();
    expect(site().textContent).toContain("Instagram");
    expect(site().textContent).toContain("@aso_computacion");
    expect(site().textContent).toContain("Oficial");
    expect(site().textContent).toContain("Novedades de la carrera");
    expect(changes()).toEqual(["Usuario: @aso → @aso_computacion"]);

    await click(inDialog("Sí, publicar"));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("handle")).toBe("@aso_computacion");
    expect(dialog()).toBeNull();
  });
});
