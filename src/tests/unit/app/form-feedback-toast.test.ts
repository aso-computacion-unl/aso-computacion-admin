// @vitest-environment jsdom
import { createElement, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { FormFeedback } from "../../../../app/admin/_components/form-parts";
import { ToastProvider } from "../../../../app/admin/_components/toast";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, unmountAll } from "@/tests/support/dom";

afterEach(async () => {
  await unmountAll();
});

/** Each click on "next" hands FormFeedback the next result, the way a form gets one per submit. */
function Harness({ results, toast }: { results: (ActionResult | null)[]; toast?: boolean }) {
  const [index, setIndex] = useState(0);

  return createElement(
    ToastProvider,
    null,
    createElement("button", { type: "button", onClick: () => setIndex((value) => value + 1) }, "next"),
    createElement("div", { "data-testid": "feedback" }, createElement(FormFeedback, { state: results[index] ?? null, ...(toast === undefined ? {} : { toast }) })),
  );
}

const toastsIn = (host: HTMLElement) => [...host.querySelectorAll('[role="status"][aria-live="polite"] li')].map((item) => item.textContent);
const inlineIn = (host: HTMLElement) => host.querySelector('[data-testid="feedback"]')!;
const next = (host: HTMLElement) => click([...host.querySelectorAll("button")].find((button) => button.textContent === "next")!);

describe("FormFeedback save toast", () => {
  it("shows a 'Cambios guardados.' toast and keeps the notice next to the button", async () => {
    const host = await mount(createElement(Harness, { results: [null, { success: true }] }));

    expect(toastsIn(host)).toEqual([]);
    await next(host);

    // The toast reads its message, then the hidden label of its close button.
    expect(toastsIn(host)).toEqual(["Cambios guardados.Cerrar aviso"]);
    expect(inlineIn(host).textContent).toContain("Cambios guardados.");
    // End-to-end tests find the inline notice by this slot, wherever each form places it.
    expect(inlineIn(host).querySelector('[data-slot="form-feedback"]')?.textContent).toContain("Cambios guardados.");
  });

  it("announces the save once: the notice next to the button is not a second live region", async () => {
    const host = await mount(createElement(Harness, { results: [null, { success: true }] }));
    await next(host);

    const notice = [...inlineIn(host).querySelectorAll("p")].find((p) => p.textContent?.includes("Cambios guardados."))!;

    expect(notice.closest("[aria-live]")).toBeNull();
    expect(notice.getAttribute("role")).toBeNull();
  });

  it("shows one toast per save, also when the same form is saved twice", async () => {
    const host = await mount(createElement(Harness, { results: [null, { success: true }, { success: true }] }));
    await next(host);
    await next(host);

    expect(toastsIn(host)).toHaveLength(2);
  });

  it("keeps errors inline and announced, with no toast", async () => {
    const host = await mount(createElement(Harness, { results: [null, { error: "No se pudo guardar." }] }));
    await next(host);

    expect(toastsIn(host)).toEqual([]);
    expect(inlineIn(host).querySelector('[role="alert"]')?.textContent).toContain("No se pudo guardar.");
  });

  it("sends no toast when the form already confirms the save its own way", async () => {
    const host = await mount(createElement(Harness, { results: [null, { success: true }], toast: false }));
    await next(host);

    expect(toastsIn(host)).toEqual([]);
    expect(inlineIn(host).textContent).toContain("Cambios guardados.");
  });
});
