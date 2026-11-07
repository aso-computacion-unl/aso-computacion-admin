// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { FaqForm } from "../../../../app/admin/faqs/_components/faq-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, settle, typeInto, unmountAll } from "@/tests/support/dom";

import { controlsPerLabel } from "./one-control-per-label";

afterEach(async () => {
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const mountForm = (action: Action = async () => ({ success: true })) =>
  mount(createElement(ToastProvider, null, createElement(FaqForm, { action, submitLabel: "Crear pregunta" })));

const field = (host: HTMLElement, text: string) => {
  const label = [...host.querySelectorAll("label")].find((candidate) => candidate.textContent === text)!;

  return host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[id="${label.htmlFor}"]`)!;
};
const moreOptions = (host: HTMLElement) => host.querySelector("details")!;

describe("the FAQ editor", () => {
  it("shows Pregunta and Respuesta, with the optional command in a closed \"Más opciones\" and no helper paragraphs", async () => {
    const host = await mountForm();

    expect(moreOptions(host).querySelector("summary")?.textContent).toBe("Más opciones");
    expect(moreOptions(host).open).toBe(false);
    expect(moreOptions(host).contains(field(host, "Comando (opcional)"))).toBe(true);
    expect(moreOptions(host).contains(field(host, "Pregunta"))).toBe(false);
    expect(moreOptions(host).contains(field(host, "Respuesta"))).toBe(false);
    expect(host.querySelectorAll("small")).toHaveLength(0);
    expect(host.textContent).not.toContain("Hasta 1000 caracteres");
    expect(host.textContent).not.toContain("Vacío: el sitio");
  });

  it("opens when the server refuses the command", async () => {
    const host = await mountForm(async () => ({ fieldErrors: { command: "Ese comando ya existe." } }));

    await typeInto(field(host, "Pregunta"), "¿Cómo entro?");
    await typeInto(field(host, "Respuesta"), "Con su cuenta.");
    await click(host.querySelector('button[type="submit"]')!);
    await settle();

    expect(moreOptions(host).open).toBe(true);
    expect(moreOptions(host).textContent).toContain("Ese comando ya existe.");
  });

  it("stays closed when the error is in Pregunta", async () => {
    const host = await mountForm();

    await click(host.querySelector('button[type="submit"]')!);

    expect(host.textContent).toContain("Revise");
    expect(moreOptions(host).open).toBe(false);
  });

  it("echoes the command it will answer to once there is one", async () => {
    const host = await mountForm();

    await click(moreOptions(host).querySelector("summary")!);
    await typeInto(field(host, "Comando (opcional)"), "inscribirme");

    expect(host.textContent).toContain("❯ git help inscribirme");
  });

  it("shows its counters only near the limit", async () => {
    const host = await mountForm();
    const counters = () => host.textContent!.match(/\d+ \/ \d+/g) ?? [];

    await typeInto(field(host, "Pregunta"), "P".repeat(159));
    await typeInto(field(host, "Respuesta"), "R".repeat(799));
    expect(counters()).toEqual([]);

    await typeInto(field(host, "Pregunta"), "P".repeat(160));
    await typeInto(field(host, "Respuesta"), "R".repeat(800));
    expect(counters()).toEqual(["160 / 200", "800 / 1000"]);
  });
});

describe("the labels of the FAQ editor", () => {
  it("name one control each, so the \"?\" help toggle does not answer to \"Comando (opcional)\"", async () => {
    const host = await mountForm();
    const perLabel = controlsPerLabel(host);

    expect(perLabel.get("Comando (opcional)")?.size).toBe(1);
    for (const [text, controls] of perLabel) expect(controls.size, text).toBe(1);
  });
});
