// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { BoardMemberForm, EMPTY_BOARD_MEMBER_FORM_VALUES, type BoardMemberFormValues } from "../../../../app/admin/board/_components/board-member-form";
import { EMPTY_PILLAR_FORM_VALUES, PillarForm, type PillarFormValues } from "../../../../app/admin/pillars/_components/pillar-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

import { controlsPerLabel } from "./one-control-per-label";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ok: Action = async () => ({ success: true });

const MEMBER: BoardMemberFormValues = { ...EMPTY_BOARD_MEMBER_FORM_VALUES, name: "Ana Torres", role: "Presidenta", photoAlt: "Ana sonríe", isPublished: true };
const PILLAR: PillarFormValues = { ...EMPTY_PILLAR_FORM_VALUES, word: "VOZ", title: "Representación", text: "Llevamos tu voz al consejo.", imageAlt: "Asamblea", isPublished: true };

const mountMember = (action: Action = ok, initial: Partial<BoardMemberFormValues> = {}, props: { submitLabel?: string; hasPhoto?: boolean } = {}) =>
  mount(
    createElement(
      ToastProvider,
      null,
      createElement(BoardMemberForm, { action, submitLabel: props.submitLabel ?? "Guardar cambios", hasPhoto: props.hasPhoto ?? true, initialValues: { ...MEMBER, ...initial } }),
    ),
  );

const mountPillar = (action: Action = ok, initial: Partial<PillarFormValues> = {}, props: { submitLabel?: string; hasImage?: boolean } = {}) =>
  mount(
    createElement(
      ToastProvider,
      null,
      createElement(PillarForm, { action, submitLabel: props.submitLabel ?? "Guardar cambios", hasImage: props.hasImage ?? true, initialValues: { ...PILLAR, ...initial } }),
    ),
  );

const labelled = (host: HTMLElement, text: string) => [...host.querySelectorAll("label")].find((label) => label.textContent === text);
const field = (host: HTMLElement, text: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${labelled(host, text)!.htmlFor}"]`)!;
const primary = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = (name: string) => [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name)!;
const version = (value: "before" | "after") => dialog()!.querySelector<HTMLInputElement>(`input[name="preview-version"][value="${value}"]`)!;
const site = () => dialog()!.querySelector("[data-slot='publish-site']")!.textContent;
const changes = () => [...dialog()!.querySelectorAll("[data-slot='publish-changes'] li")].map((item) => item.textContent);
const switchNamed = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLInputElement>('[role="switch"]')].find((input) => input.closest("label")?.textContent?.startsWith(name))!;
const counters = (host: HTMLElement) => host.textContent!.match(/\d+ \/ \d+/g) ?? [];

describe("the board member editor", () => {
  it("has no helper paragraphs and no drafts note", async () => {
    const host = await mountMember();

    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 60 caracteres");
    expect(host.textContent).not.toContain("Los borradores no salen");
  });

  it("still says why a member without a photo cannot be published", async () => {
    const host = await mountMember(ok, { isPublished: false, photoAlt: "" }, { hasPhoto: false });

    expect(host.textContent).toContain("Sin foto no se puede publicar");
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountMember();

    await typeInto(field(host, "Nombre"), "N".repeat(47));
    expect(counters(host)).toEqual([]);

    await typeInto(field(host, "Nombre"), "N".repeat(48));
    expect(counters(host)).toEqual(["48 / 60"]);
  });

  it("names one control per label", async () => {
    const host = await mountMember();

    for (const [text, controls] of controlsPerLabel(host)) expect(controls.size, text).toBe(1);
  });

  it("reads \"Publicar\" when published and keeps its save label for a draft", async () => {
    expect(primary(await mountMember()).textContent).toBe("Publicar");
    expect(primary(await mountMember(ok, { isPublished: false })).textContent).toBe("Guardar cambios");
    expect(primary(await mountMember(ok, { ...EMPTY_BOARD_MEMBER_FORM_VALUES }, { submitLabel: "Agregar integrante", hasPhoto: false })).textContent).toBe("Agregar integrante");
  });

  it("saves a draft straight away, without a preview", async () => {
    const action = vi.fn(ok);
    const host = await mountMember(action, { isPublished: false });

    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("previews a published member before saving, lists the change and submits once with \"Sí, publicar\"", async () => {
    const action = vi.fn(ok);
    const host = await mountMember(action);

    await typeInto(field(host, "Cargo"), "Vicepresidenta");
    await click(primary(host));

    expect(action).not.toHaveBeenCalled();
    expect(site()).toContain("Ana Torres");
    expect(site()).toContain("Vicepresidenta");
    expect(changes()).toEqual(["Cargo: Presidenta → Vicepresidenta"]);

    await click(version("before"));
    expect(site()).toContain("Presidenta");
    expect(site()).not.toContain("Vicepresidenta");

    const confirm = inDialog("Sí, publicar");
    await click(confirm);
    await click(confirm);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("role")).toBe("Vicepresidenta");
    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Publicado. El sitio se actualiza en un minuto.");
  });

  it("closes the preview when the server refuses a member without a photo, so the error is in sight", async () => {
    const host = await mountMember(async () => ({ fieldErrors: { photo: "Suba una foto antes de publicar." } }), { isPublished: false, photoAlt: "" }, { hasPhoto: false });

    await click(switchNamed(host, "Publicado"));
    await click(primary(host));
    await click(version("before"));
    expect(dialog()!.textContent).toContain("Todavía no está en el sitio");

    await click(inDialog("Sí, publicar"));
    await settle();

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Suba una foto antes de publicar.");
  });
});

describe("the pillar editor", () => {
  it("has no helper paragraphs and no drafts note", async () => {
    const host = await mountPillar();

    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 300 caracteres");
    expect(host.textContent).not.toContain("Los borradores no salen");
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountPillar();

    await typeInto(field(host, "Texto"), "T".repeat(239));
    expect(counters(host)).toEqual([]);

    await typeInto(field(host, "Texto"), "T".repeat(240));
    expect(counters(host)).toEqual(["240 / 300"]);
  });

  it("names one control per label", async () => {
    const host = await mountPillar();

    for (const [text, controls] of controlsPerLabel(host)) expect(controls.size, text).toBe(1);
  });

  it("reads \"Publicar\" when published and keeps its save label for a draft", async () => {
    expect(primary(await mountPillar()).textContent).toBe("Publicar");
    expect(primary(await mountPillar(ok, { isPublished: false })).textContent).toBe("Guardar cambios");
    expect(primary(await mountPillar(ok, { ...EMPTY_PILLAR_FORM_VALUES }, { submitLabel: "Crear pilar", hasImage: false })).textContent).toBe("Crear pilar");
  });

  it("saves a draft straight away, without a preview", async () => {
    const action = vi.fn(ok);
    const host = await mountPillar(action, { isPublished: false });

    await click(primary(host));
    await settle();

    expect(dialog()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the errors instead of the preview when the form is invalid", async () => {
    const action = vi.fn(ok);
    const host = await mountPillar(action);

    await typeInto(field(host, "Título"), "");
    await click(primary(host));

    expect(dialog()).toBeNull();
    expect(host.textContent).toContain("Revise");
    expect(action).not.toHaveBeenCalled();
  });

  it("previews the card, lists the change and submits once with \"Sí, publicar\"", async () => {
    const action = vi.fn(ok);
    const host = await mountPillar(action);

    await typeInto(field(host, "Palabra"), "UNIÓN");
    await click(primary(host));

    expect(action).not.toHaveBeenCalled();
    expect(site()).toContain("UNIÓN");
    expect(site()).toContain("Representación");
    expect(site()).toContain("Llevamos tu voz al consejo.");
    expect(changes()).toEqual(["Palabra: VOZ → UNIÓN"]);

    await click(inDialog("Sí, publicar"));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]![1] as FormData).get("word")).toBe("UNIÓN");
    expect(dialog()).toBeNull();
  });

  it("closes with \"Seguir editando\" and keeps what was typed", async () => {
    const action = vi.fn(ok);
    const host = await mountPillar(action);

    await typeInto(field(host, "Título"), "Voz estudiantil");
    await click(primary(host));
    await click(inDialog("Seguir editando"));

    expect(dialog()).toBeNull();
    expect(field(host, "Título").value).toBe("Voz estudiantil");
    expect(action).not.toHaveBeenCalled();
  });
});
