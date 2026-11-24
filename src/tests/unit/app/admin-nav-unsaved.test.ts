// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `next/link` needs the app router; here a click on a link is recorded instead of navigating. */
const visits = vi.hoisted((): string[] => []);
const push = vi.hoisted(() => vi.fn<(href: string) => void>());

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/events/1",
  useRouter: () => ({ push }),
}));

import { Rail, TabBar } from "../../../../app/admin/_components/admin-nav";
import { AreaTabs } from "../../../../app/admin/_components/area-tabs";
import { Field } from "../../../../app/admin/_components/form-parts";
import { UnsavedChangesProvider } from "../../../../app/admin/_components/unsaved-changes";
import { AUTOSAVE_DELAY_MS, useControlledForm } from "../../../../app/admin/_components/use-controlled-form";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, typeInto, unmountAll } from "@/tests/support/dom";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(async () => {
  visits.length = 0;
  push.mockReset();
  await unmountAll();
  vi.useRealTimers();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type Control = Parameters<ComponentProps<typeof Field>["children"]>[0];

const DRAFT = { title: "Hola", isPublished: false };

function Editor({ action, autosave }: { action: Action; autosave: boolean }) {
  const { bind, handleSubmit, formRef } = useControlledForm(action, DRAFT, { autosave });

  return createElement(
    "form",
    { ref: formRef, onSubmit: handleSubmit, noValidate: true },
    // eslint-disable-next-line react/no-children-prop -- `Field` takes a render function as its child, which createElement's typing refuses as a positional child.
    createElement(Field, { label: "Título", children: function renderInput(control: Control) { return createElement("input", { ...control, ...bind("title"), required: true }); } }),
  );
}

/** The admin shell around an edit page: the rail, the tab bar, the area tabs and the form, under the one provider of the layout. */
function Shell({ action, autosave = false, children }: { action: Action; autosave?: boolean; children?: ReactNode }) {
  return createElement(
    UnsavedChangesProvider,
    null,
    createElement(Rail, { role: "ADMIN" }),
    createElement(AreaTabs, { area: "contenido", current: "/admin/events" }),
    createElement(Editor, { action, autosave }),
    createElement(TabBar, { role: "ADMIN" }),
    children,
  );
}

const ok: Action = async () => ({ success: true });

/** An action that answers when the test says so, to hold a request in flight. */
function slowAction() {
  const answers: ((result: ActionResult) => Promise<void>)[] = [];
  const action: Action = () =>
    new Promise((resolve) => {
      answers.push((result) => act(async () => resolve(result)));
    });

  return { action, answers };
}

const title = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[name="title"]')!;
const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const dialogButton = (label: string) => [...(dialog()?.querySelectorAll("button") ?? [])].find((button) => button.textContent === label)!;
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const navLink = (host: HTMLElement, nav: string, label: string) =>
  [...host.querySelectorAll<HTMLAnchorElement>(`nav[aria-label="${nav}"] a`)].find((link) => link.textContent?.includes(label))!;
const railLink = (host: HTMLElement, label: string) => navLink(host, "Áreas", label);
const tabBarLink = (host: HTMLElement, label: string) => [...host.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Áreas"].fixed a')].find((link) => link.textContent?.includes(label))!;

async function makeDirty(host: HTMLElement) {
  await typeInto(title(host), "Hola mundo");
}

async function press(key: string) {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("the rail with unsaved changes", () => {
  it("navigates as a plain link while nothing has changed", async () => {
    const host = await mount(createElement(Shell, { action: ok }));

    await click(railLink(host, "Inscripciones"));

    expect(visits).toEqual(["/admin/registrations"]);
    expect(dialog()).toBeNull();
  });

  it("asks in a dialog and does not leave yet when a form has unsaved changes", async () => {
    const host = await mount(createElement(Shell, { action: ok }));

    await makeDirty(host);
    await click(railLink(host, "Inscripciones"));

    expect(visits).toEqual([]);
    expect(push).not.toHaveBeenCalled();
    expect(dialog()?.getAttribute("aria-modal")).toBe("true");
    expect(dialog()?.textContent).toContain("Tiene cambios sin guardar");
    expect(document.activeElement).toBe(dialogButton("Seguir editando"));
  });

  it("goes where the link pointed with 'Salir sin guardar'", async () => {
    const host = await mount(createElement(Shell, { action: ok }));

    await makeDirty(host);
    await click(railLink(host, "Foro"));
    await click(dialogButton("Salir sin guardar"));

    expect(push).toHaveBeenCalledWith("/admin/foro/reportes");
    expect(dialog()).toBeNull();
  });

  it("stays with 'Seguir editando' and gives the focus back to the link", async () => {
    const host = await mount(createElement(Shell, { action: ok }));
    const link = railLink(host, "Ajustes");

    await makeDirty(host);
    await act(async () => link.focus());
    await click(link);
    await click(dialogButton("Seguir editando"));

    expect(dialog()).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(visits).toEqual([]);
    expect(document.activeElement).toBe(link);
    expect(title(host).value).toBe("Hola mundo");
  });

  it("stays with Escape and gives the focus back to the link", async () => {
    const host = await mount(createElement(Shell, { action: ok }));
    const link = railLink(host, "Ajustes");

    await makeDirty(host);
    await click(link);
    await press("Escape");

    expect(dialog()).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(link);
  });

  it("keeps the focus inside the dialog with Tab", async () => {
    const host = await mount(createElement(Shell, { action: ok }));

    await makeDirty(host);
    await click(railLink(host, "Foro"));
    await press("Tab");
    expect(document.activeElement).toBe(dialogButton("Salir sin guardar"));

    await press("Tab");
    expect(document.activeElement).toBe(dialogButton("Seguir editando"));
  });

  it("also guards the isotype, the way to Inicio", async () => {
    const host = await mount(createElement(Shell, { action: ok }));

    await makeDirty(host);
    await click(host.querySelector<HTMLAnchorElement>('a[aria-label="ASO Computación, inicio de la administración"]')!);

    expect(visits).toEqual([]);
    expect(dialog()).not.toBeNull();
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("lets a %s click through: it opens another tab or window, this page stays", async (_name, init) => {
    const host = await mount(createElement(Shell, { action: ok }));

    await makeDirty(host);
    await act(async () => {
      railLink(host, "Foro").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
    });

    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/admin/foro/reportes"]);
  });
});

describe("the other ways out of an edit page", () => {
  it("guards the phone's tab bar", async () => {
    const host = await mount(createElement(Shell, { action: ok }));

    await makeDirty(host);
    await click(tabBarLink(host, "Inscripciones"));

    expect(visits).toEqual([]);
    expect(dialog()).not.toBeNull();

    await click(dialogButton("Salir sin guardar"));
    expect(push).toHaveBeenCalledWith("/admin/registrations");
  });

  it("guards the area tabs and '+ Crear'", async () => {
    const host = await mount(createElement(Shell, { action: ok }));

    await makeDirty(host);
    await click(navLink(host, "Tipo de contenido", "Novedades"));
    expect(dialog()).not.toBeNull();
    await click(dialogButton("Seguir editando"));

    await click([...host.querySelectorAll("a")].find((link) => link.textContent?.trim() === "Crear")!);
    expect(dialog()).not.toBeNull();
    await click(dialogButton("Salir sin guardar"));

    expect(visits).toEqual([]);
    expect(push).toHaveBeenCalledWith("/admin/events/new");
  });

  it("guards the items of 'Más' and, the menu being closed, gives the focus back to its button", async () => {
    const host = await mount(createElement(Shell, { action: ok }));
    const more = host.querySelector<HTMLButtonElement>("button[aria-haspopup]")!;

    await makeDirty(host);
    await click(more);
    await click([...host.querySelectorAll<HTMLAnchorElement>("[data-slot='more-menu'] a")].find((link) => link.textContent === "Aliados")!);

    expect(visits).toEqual([]);
    expect(dialog()).not.toBeNull();

    await press("Escape");
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(more);
  });
});

describe("an autosaving draft", () => {
  it("does not ask while its save is on its way, and asks again if it fails", async () => {
    const { action, answers } = slowAction();
    const host = await mount(createElement(Shell, { action, autosave: true }));

    await makeDirty(host);
    await advance(AUTOSAVE_DELAY_MS);
    expect(answers).toHaveLength(1);

    await click(railLink(host, "Foro"));
    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/admin/foro/reportes"]);

    await answers[0]!({ error: "No se pudo guardar." });
    await click(railLink(host, "Foro"));
    expect(dialog()).not.toBeNull();
  });

  it("asks while the typing has not been saved yet", async () => {
    const host = await mount(createElement(Shell, { action: ok, autosave: true }));

    await makeDirty(host);
    await click(railLink(host, "Foro"));

    expect(dialog()).not.toBeNull();
  });

  it("takes the question back once the autosave stores the text", async () => {
    const host = await mount(createElement(Shell, { action: ok, autosave: true }));
    const link = railLink(host, "Foro");

    await makeDirty(host);
    await click(link);
    expect(dialog()).not.toBeNull();

    await advance(AUTOSAVE_DELAY_MS);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(link);
  });
});
