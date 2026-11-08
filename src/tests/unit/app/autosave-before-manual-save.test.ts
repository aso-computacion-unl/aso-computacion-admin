// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { AUTOSAVE_DELAY_MS } from "../../../../app/admin/_components/use-controlled-form";
import { FaqForm } from "../../../../app/admin/faqs/_components/faq-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, typeInto, unmountAll } from "@/tests/support/dom";

// Only the timers are fake: React and the DOM helpers keep their own scheduling.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(async () => {
  // React chains the actions of every form it renders: a request a test left unanswered would hold back the next test's.
  for (const release of unanswered.splice(0)) await settled(release);
  await unmountAll();
  vi.useRealTimers();
});

const unanswered: (() => void)[] = [];

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const DRAFT = { question: "¿Cómo entro?", answer: "Con su cuenta.", command: "", isPublished: false };

/** Answers inside `act` and lets the promises and the transition that follow run out (the timers are fake, so no `setTimeout`). */
const settled = (answer: () => void) =>
  act(async () => {
    answer();
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  });

/** An action that answers (or fails) when the test says so, to hold a request in flight. */
function slowAction() {
  const calls: { sent: FormData; answer: (result: ActionResult) => Promise<void>; fail: () => Promise<void> }[] = [];
  const action: Action = (_previous, sent) =>
    new Promise((resolve, reject) => {
      unanswered.push(() => resolve({ error: "left open" }));
      calls.push({
        sent,
        answer: (result) => settled(() => resolve(result)),
        fail: () => settled(() => reject(new Error("offline"))),
      });
    });

  return { action, calls };
}

const mountFaq = (action: Action, initialValues = DRAFT) =>
  mount(createElement(ToastProvider, null, createElement(FaqForm, { action, submitLabel: "Guardar cambios", initialValues, autosave: true })));

const question = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[name="question"]')!;
const published = (host: HTMLElement) => host.querySelector<HTMLInputElement>('[role="switch"]')!;
const saveButton = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const confirm = () => [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Sí, publicar")!;
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

/** A draft whose autosave is out and unanswered, with a newer edit typed after it. */
async function withAutosaveInFlight() {
  const { action, calls } = slowAction();
  const host = await mountFaq(action);

  await typeInto(question(host), "Primero");
  await advance(AUTOSAVE_DELAY_MS);
  expect(calls).toHaveLength(1);
  await typeInto(question(host), "Segundo");

  return { host, calls };
}

describe("a manual save while a draft autosave is in flight", () => {
  it("does not send until the autosave is answered, then sends once with the latest values", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(saveButton(host));
    expect(calls).toHaveLength(1);
    expect(saveButton(host).textContent).toBe("Guardando…");

    await calls[0]!.answer({ success: true });
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.sent.get("question"))).toEqual(["Primero", "Segundo"]);
  });

  it("still sends once after the autosave fails", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(saveButton(host));
    expect(calls).toHaveLength(1);

    await calls[0]!.fail();
    expect(calls).toHaveLength(2);
    expect(calls[1]!.sent.get("question")).toBe("Segundo");
  });

  it("still sends once after the autosave is refused", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(saveButton(host));
    await calls[0]!.answer({ error: "Su sesión expiró." });

    expect(calls).toHaveLength(2);
    expect(calls[1]!.sent.get("question")).toBe("Segundo");
  });

  it("keeps dropping the autosave's answer: it neither touches the fields nor marks the text as stored", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(saveButton(host));
    await calls[0]!.answer({ success: true });

    expect(question(host).value).toBe("Segundo");
    expect(host.querySelector('[data-slot="autosave-status"]')!.textContent).toBe("");
    // The manual save is still out: the text is not stored until it answers.
    expect(saveButton(host).textContent).toBe("Guardando…");

    await calls[1]!.answer({ success: true });
    expect(saveButton(host).textContent).toBe("Guardar cambios");
  });

  it("sends once however many times the button is pressed while it waits", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(saveButton(host));
    await click(saveButton(host));
    await click(saveButton(host));
    await calls[0]!.answer({ success: true });
    await click(saveButton(host));
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(calls).toHaveLength(2);
  });

  it("starts no autosave while the manual save waits or is out, and picks autosave up again once it is answered", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(saveButton(host));
    await typeInto(question(host), "Tercero");
    await advance(AUTOSAVE_DELAY_MS * 3);
    expect(calls).toHaveLength(1);

    await calls[0]!.answer({ success: true });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.sent.get("question")).toBe("Tercero");

    await typeInto(question(host), "Cuarto");
    await advance(AUTOSAVE_DELAY_MS * 3);
    expect(calls).toHaveLength(2);

    await calls[1]!.answer({ success: true });
    await advance(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.sent.get("question")).toBe("Cuarto");
  });

  it("does not let an autosave that was only waiting for the typing to stop start after the button is pressed", async () => {
    const { action, calls } = slowAction();
    const host = await mountFaq(action);

    await typeInto(question(host), "Primero");
    await advance(AUTOSAVE_DELAY_MS - 1);
    await click(saveButton(host));

    expect(calls).toHaveLength(1);
    await advance(AUTOSAVE_DELAY_MS * 3);
    expect(calls).toHaveLength(1);
  });
});

describe("Publicar while a draft autosave is in flight", () => {
  it("waits for the autosave, then publishes once: the order of the calls is autosave, publish", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(published(host));
    await click(saveButton(host));
    expect(dialog()).not.toBeNull();

    await click(confirm());
    expect(calls).toHaveLength(1);
    expect(confirm().getAttribute("aria-disabled")).toBe("true");

    await click(confirm());
    await calls[0]!.answer({ success: true });

    expect(calls).toHaveLength(2);
    expect(calls[0]!.sent.has("isPublished")).toBe(false);
    expect(calls[1]!.sent.get("question")).toBe("Segundo");
    expect(calls[1]!.sent.has("isPublished")).toBe(true);

    await advance(AUTOSAVE_DELAY_MS * 3);
    expect(calls).toHaveLength(2);
  });

  it("publishes after the autosave fails as well", async () => {
    const { host, calls } = await withAutosaveInFlight();

    await click(published(host));
    await click(saveButton(host));
    await click(confirm());
    await calls[0]!.fail();

    expect(calls).toHaveLength(2);
    expect(calls[1]!.sent.has("isPublished")).toBe(true);
  });
});

describe("a manual save with no autosave in flight", () => {
  it("sends at once", async () => {
    const { action, calls } = slowAction();
    const host = await mountFaq(action);

    await typeInto(question(host), "Primero");
    await click(saveButton(host));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.sent.get("question")).toBe("Primero");
  });

  it("sends at once once the autosave has been answered", async () => {
    const { action, calls } = slowAction();
    const host = await mountFaq(action);

    await typeInto(question(host), "Primero");
    await advance(AUTOSAVE_DELAY_MS);
    await calls[0]!.answer({ success: true });
    await typeInto(question(host), "Segundo");
    await click(saveButton(host));

    expect(calls).toHaveLength(2);
    expect(calls[1]!.sent.get("question")).toBe("Segundo");
  });
});
