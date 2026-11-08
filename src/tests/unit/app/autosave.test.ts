// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../../app/admin/_components/toast";
import { ActionBar, Field, FormFeedback } from "../../../../app/admin/_components/form-parts";
import { AUTOSAVE_DELAY_MS, useControlledForm } from "../../../../app/admin/_components/use-controlled-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, typeInto, unmountAll } from "@/tests/support/dom";

// Only the timers are fake: React and the DOM helpers keep their own scheduling.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(async () => {
  await unmountAll();
  vi.useRealTimers();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type Control = Parameters<ComponentProps<typeof Field>["children"]>[0];

const DRAFT = { title: "Hola", isPublished: false };
const PUBLISHED = { title: "Hola", isPublished: true };

/** The form of an edit page: a required title, the switch, and the action bar with the save status. */
function Editor({ action, autosave, initial }: { action: Action; autosave: boolean; initial: typeof DRAFT }) {
  const { bind, toggle, handleSubmit, state, isPending, formRef, autosaveStatus } = useControlledForm(action, initial, { autosave });

  return createElement(
    "form",
    { ref: formRef, onSubmit: handleSubmit, noValidate: true },
    // eslint-disable-next-line react/no-children-prop -- `Field` takes a render function as its child, which createElement's typing refuses as a positional child.
    createElement(Field, { label: "Título", children: function renderInput(control: Control) { return createElement("input", { ...control, ...bind("title"), required: true }); } }),
    createElement("input", { type: "checkbox", "aria-label": "Publicado", ...toggle("isPublished") }),
    // eslint-disable-next-line react/no-children-prop -- same as above.
    createElement(ActionBar, { status: createElement(FormFeedback, { state, autosave: autosaveStatus }), children: createElement("button", { type: "submit", disabled: isPending }, "Guardar cambios") }),
  );
}

const mountEditor = (action: Action, { autosave = true, initial = DRAFT }: { autosave?: boolean; initial?: typeof DRAFT } = {}) =>
  mount(createElement(ToastProvider, null, createElement(Editor, { action, autosave, initial })));

const title = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[name="title"]')!;
const published = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
const submitButton = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const status = (host: HTMLElement) => host.querySelector('[data-slot="autosave-status"]')?.textContent ?? null;
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

/** An action that answers when the test says so, to hold a request in flight. */
function slowAction() {
  const calls: { sent: FormData; answer: (result: ActionResult) => Promise<void> }[] = [];
  const action: Action = (_previous, sent) =>
    new Promise((resolve) => {
      calls.push({ sent, answer: (result) => act(async () => resolve(result)) });
    });

  return { action, calls };
}

const okAction = () => {
  const action = vi.fn<Action>(async () => ({ success: true }));

  return action;
};

/** What the browser does on unload: the page asks to stay when a listener cancels the event. */
function unloadIsBlocked(): boolean {
  const event = new Event("beforeunload", { cancelable: true });

  window.dispatchEvent(event);

  return event.defaultPrevented;
}

describe("autosave of an unpublished draft on an edit page", () => {
  it("saves once the typing stops, not before", async () => {
    const action = okAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS - 1);
    expect(action).not.toHaveBeenCalled();

    await advance(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[1].get("title")).toBe("Hola mundo");
  });

  it("waits again while the owner keeps typing", async () => {
    const action = okAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola m");
    await advance(AUTOSAVE_DELAY_MS - 100);
    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS - 100);
    expect(action).not.toHaveBeenCalled();

    await advance(100);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[1].get("title")).toBe("Hola mundo");
  });

  it("does nothing while nothing has changed", async () => {
    const action = okAction();

    await mountEditor(action);
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(action).not.toHaveBeenCalled();
  });

  it("never saves on a create page, where a save would create a row", async () => {
    const action = okAction();
    const host = await mountEditor(action, { autosave: false });

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(action).not.toHaveBeenCalled();
    expect(status(host)).toBeNull();
  });

  it("never saves an item that is published: that goes through Publicar", async () => {
    const action = okAction();
    const host = await mountEditor(action, { initial: PUBLISHED });

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(action).not.toHaveBeenCalled();
  });

  it("stops once the switch is turned on, and picks up again if it is turned off", async () => {
    const action = okAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    await click(published(host));
    await advance(AUTOSAVE_DELAY_MS * 3);
    expect(action).not.toHaveBeenCalled();

    await click(published(host));
    await advance(AUTOSAVE_DELAY_MS);
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[1].has("isPublished")).toBe(false);
  });

  it("skips a form with an invalid field, without showing an error", async () => {
    const action = okAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "");
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(action).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(status(host)).toBe("");
  });

  it("saves again once the field is valid", async () => {
    const action = okAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "");
    await advance(AUTOSAVE_DELAY_MS);
    await typeInto(title(host), "Otra vez");
    await advance(AUTOSAVE_DELAY_MS);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not save a draft the owner just saved by hand", async () => {
    const action = okAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    await click(submitButton(host));
    await advance(AUTOSAVE_DELAY_MS * 3);

    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("one request at a time", () => {
  it("holds a newer edit until the request in flight is answered, then saves it: the last edit wins", async () => {
    const { action, calls } = slowAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "Primero");
    await advance(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(1);

    await typeInto(title(host), "Segundo");
    await advance(AUTOSAVE_DELAY_MS * 3);
    expect(calls).toHaveLength(1);

    await calls[0]!.answer({ success: true });
    await advance(AUTOSAVE_DELAY_MS);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.sent.get("title")).toBe("Segundo");
  });

  it("does not let the answer to an older request touch what was typed since", async () => {
    const { action, calls } = slowAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "Primero");
    await advance(AUTOSAVE_DELAY_MS);
    await typeInto(title(host), "Segundo");
    await calls[0]!.answer({ success: true });

    expect(title(host).value).toBe("Segundo");
    expect(unloadIsBlocked()).toBe(true);
    expect(status(host)).toBe("");
  });

  it("does not retry a request that failed until the owner edits again", async () => {
    const action = vi.fn<Action>(async () => ({ error: "No se pudo guardar." }));
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS);
    await advance(AUTOSAVE_DELAY_MS * 5);
    expect(action).toHaveBeenCalledTimes(1);

    await typeInto(title(host), "Hola mundo!");
    await advance(AUTOSAVE_DELAY_MS);
    expect(action).toHaveBeenCalledTimes(2);
  });
});

describe("the save status", () => {
  it("says Guardando… while the request is out and Guardado once it is answered", async () => {
    const { action, calls } = slowAction();
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    expect(status(host)).toBe("");

    await advance(AUTOSAVE_DELAY_MS);
    expect(status(host)).toBe("Guardando…");

    await calls[0]!.answer({ success: true });
    expect(status(host)).toBe("Guardado");
  });

  it("is a polite live region next to the save button", async () => {
    const host = await mountEditor(okAction());
    const region = host.querySelector('[data-slot="autosave-status"]')!;

    expect(region.getAttribute("role")).toBe("status");
    expect(host.querySelector('[data-slot="action-bar"]')!.contains(region)).toBe(true);
  });

  it("goes quiet again as soon as the owner types after a save", async () => {
    const host = await mountEditor(okAction());

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS);
    expect(status(host)).toBe("Guardado");

    await typeInto(title(host), "Hola mundo!");
    expect(status(host)).toBe("");
  });

  it("shows no toast and no saved notice of the form's own: the status is the whole feedback", async () => {
    const host = await mountEditor(okAction());

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS);

    expect(document.body.textContent).not.toContain("Cambios guardados");
    expect(host.querySelector('[data-slot="form-feedback"]')!.textContent).toBe("Guardado");
  });

  it("says in a few words that it could not save, and the button still saves", async () => {
    const answers: ActionResult[] = [{ error: "Su sesión expiró. Inicie sesión de nuevo." }, { success: true }];
    const action = vi.fn<Action>(async () => answers.shift()!);
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS);
    expect(status(host)).toBe("Su sesión expiró. Inicie sesión de nuevo.");
    expect(unloadIsBlocked()).toBe(true);

    await click(submitButton(host));
    expect(action).toHaveBeenCalledTimes(2);
    expect(unloadIsBlocked()).toBe(false);
  });

  it("uses a generic line when the server answers with field errors, and shows none of them", async () => {
    const action = vi.fn<Action>(async () => ({ fieldErrors: { title: "Ese título ya existe." } }));
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS);

    expect(status(host)).toBe("No se pudo guardar. Use el botón.");
    expect(host.textContent).not.toContain("Ese título ya existe.");
    expect(host.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it("treats a request that throws as a failure", async () => {
    const action = vi.fn<Action>(async () => {
      throw new Error("offline");
    });
    const host = await mountEditor(action);

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS);

    expect(status(host)).toBe("No se pudo guardar. Use el botón.");
  });
});

describe("leaving the page after an autosave", () => {
  it("asks while the typing is not saved yet", async () => {
    const host = await mountEditor(okAction());

    await typeInto(title(host), "Hola mundo");

    expect(unloadIsBlocked()).toBe(true);
  });

  it("stops asking once the autosave is stored", async () => {
    const host = await mountEditor(okAction());

    await typeInto(title(host), "Hola mundo");
    await advance(AUTOSAVE_DELAY_MS);

    expect(unloadIsBlocked()).toBe(false);
  });
});
