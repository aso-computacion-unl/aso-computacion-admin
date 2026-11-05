// @vitest-environment jsdom
import { createElement, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** `next/link` needs the app router; here a click on a link is recorded instead of navigating. */
const visits = vi.hoisted((): string[] => []);

vi.mock("next/link", () => ({
  default: ({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) =>
    createElement("a", {
      ...props,
      href,
      onClick: (event: MouseEvent & { defaultPrevented: boolean }) => {
        onClick?.(event as never);
        if (!event.defaultPrevented) visits.push(href);
        (event as unknown as Event).preventDefault();
      },
    }),
}));

import { ActionBar, Field, FormFeedback } from "../../../../app/admin/_components/form-parts";
import { PageHeader } from "../../../../app/admin/_components/page-header";
import { useControlledForm } from "../../../../app/admin/_components/use-controlled-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, typeInto, unmountAll } from "@/tests/support/dom";

afterEach(async () => {
  visits.length = 0;
  await unmountAll();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type Control = Parameters<ComponentProps<typeof Field>["children"]>[0];

const INITIAL = { title: "Hola" };

/** The back link in the page header and the form below it, the way every edit page puts them. */
function Page({ action }: { action: Action }) {
  const { bind, handleSubmit, state, isPending } = useControlledForm(action, INITIAL);

  return createElement(
    "div",
    null,
    createElement(PageHeader, { title: "Editar", back: { href: "/admin/events", label: "Volver a eventos" } }),
    createElement(
      "form",
      { onSubmit: handleSubmit, noValidate: true },
      // eslint-disable-next-line react/no-children-prop -- `Field` takes a render function as its child, which createElement's typing refuses as a positional child.
      createElement(Field, { label: "Título", children: function renderInput(control: Control) { return createElement("input", { ...control, ...bind("title"), required: true }); } }),
      // eslint-disable-next-line react/no-children-prop -- same as above.
      createElement(ActionBar, { status: createElement(FormFeedback, { state }), children: createElement("button", { type: "submit", disabled: isPending }, "Guardar") }),
    ),
  );
}

const ok: Action = async () => ({ success: true });
const failing: Action = async () => ({ error: "No se pudo guardar." });
const title = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[name="title"]')!;
const submit = (host: HTMLElement) => click(host.querySelector('button[type="submit"]')!);
const backLink = (host: HTMLElement) => [...host.querySelectorAll("a")].find((link) => link.textContent === "Volver a eventos")!;
const confirmation = (host: HTMLElement) => host.querySelector('[role="group"][aria-label="Confirmar: salir sin guardar"]');
const button = (host: HTMLElement, label: string) => [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === label)!;

/** What the browser does on unload: the page asks to stay when a listener cancels the event. */
function unloadIsBlocked(): boolean {
  const event = new Event("beforeunload", { cancelable: true });

  window.dispatchEvent(event);

  return event.defaultPrevented;
}

describe("leaving the page with unsaved changes", () => {
  it("does not ask while nothing has changed", async () => {
    await mount(createElement(Page, { action: ok }));

    expect(unloadIsBlocked()).toBe(false);
  });

  it("asks the browser to confirm once a field changes", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");

    expect(unloadIsBlocked()).toBe(true);
  });

  it("stops asking when the owner puts the original text back", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await typeInto(title(host), "Hola");

    expect(unloadIsBlocked()).toBe(false);
  });

  it("stops asking after a successful save", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await submit(host);

    expect(unloadIsBlocked()).toBe(false);
  });

  it("keeps asking after a save that failed: nothing was stored", async () => {
    const host = await mount(createElement(Page, { action: failing }));

    await typeInto(title(host), "Hola mundo");
    await submit(host);

    expect(unloadIsBlocked()).toBe(true);
  });

  it("asks again when the owner edits after a successful save", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await submit(host);
    await typeInto(title(host), "Hola otra vez");

    expect(unloadIsBlocked()).toBe(true);
  });

  it("stops asking once the form is gone", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await unmountAll();

    expect(unloadIsBlocked()).toBe(false);
    expect(host.isConnected).toBe(false);
  });
});

describe("the back link with unsaved changes", () => {
  it("goes straight back when nothing has changed", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await click(backLink(host));

    expect(visits).toEqual(["/admin/events"]);
    expect(confirmation(host)).toBeNull();
  });

  it("asks first when something has changed, and does not leave yet", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await click(backLink(host));

    expect(visits).toEqual([]);
    expect(confirmation(host)?.textContent).toContain("Tiene cambios sin guardar");
  });

  it("puts the focus on the safe choice, and 'Seguir editando' closes the question and returns to the link", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await click(backLink(host));

    expect(document.activeElement).toBe(button(host, "Seguir editando"));

    await click(button(host, "Seguir editando"));

    expect(confirmation(host)).toBeNull();
    expect(document.activeElement).toBe(backLink(host));
    expect(visits).toEqual([]);
    expect(title(host).value).toBe("Hola mundo");
  });

  it("leaves only when the owner confirms", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await click(backLink(host));
    await click([...host.querySelectorAll("a")].find((link) => link.textContent === "Salir sin guardar")!);

    expect(visits).toEqual(["/admin/events"]);
  });

  it("takes the question back once a save leaves nothing unsaved", async () => {
    const host = await mount(createElement(Page, { action: ok }));

    await typeInto(title(host), "Hola mundo");
    await click(backLink(host));
    await submit(host);

    expect(confirmation(host)).toBeNull();
  });
});
