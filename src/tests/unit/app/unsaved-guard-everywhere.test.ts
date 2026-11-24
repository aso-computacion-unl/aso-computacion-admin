// @vitest-environment jsdom
import { act, createElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Actor } from "@/domain/user";

/**
 * Where a click went: `next/link` records its href unless the click was stopped, and a plain `<a>` that the page did
 * not stop is recorded by the last listener of the document (instead of jsdom trying to navigate).
 */
const visits = vi.hoisted((): string[] => []);
const push = vi.hoisted(() => vi.fn<(href: string) => void>());
const logout = vi.hoisted(() => vi.fn<(formData: FormData) => Promise<void>>(async () => {}));
const requirePageSession = vi.hoisted(() => vi.fn<() => Promise<Actor>>());

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
  usePathname: () => "/admin/faqs/1/edit",
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(),
}));
vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession }));
vi.mock("@/interface/auth/actions", () => ({ logout }));
vi.mock("../../../../app/_components/brand-mark", () => ({ BrandIsotype: () => null }));

import { AppTopBar } from "../../../../app/_components/app-top-bar";
import { IdentityChip } from "../../../../app/_components/identity-chip";
import { Field } from "../../../../app/admin/_components/form-parts";
import { GuardedLink } from "../../../../app/admin/_components/unsaved-changes";
import { AUTOSAVE_DELAY_MS, useControlledForm } from "../../../../app/admin/_components/use-controlled-form";
import AdminLayout from "../../../../app/admin/layout";
import type { ActionResult } from "@/interface/admin/action-result";
import { click, mount, typeInto, unmountAll } from "@/tests/support/dom";

function recordPlainNavigation(event: MouseEvent) {
  const link = (event.target as Element | null)?.closest?.("a[href]");

  if (!link || event.defaultPrevented) return;
  visits.push(link.getAttribute("href")!);
  event.preventDefault();
}

beforeEach(() => {
  // jsdom has no `matchMedia`; the theme toggle reads the system preference through it.
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  document.addEventListener("click", recordPlainNavigation);
  requirePageSession.mockResolvedValue({ kind: "user", sessionId: "s1", userId: "u1", name: "Ana Pérez", role: "ADMIN" });
});

afterEach(async () => {
  document.removeEventListener("click", recordPlainNavigation);
  visits.length = 0;
  push.mockReset();
  logout.mockClear();
  await unmountAll();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
type Control = Parameters<ComponentProps<typeof Field>["children"]>[0];

const DRAFT = { title: "Hola", isPublished: false };
const ok: Action = async () => ({ success: true });

function Editor({ action, autosave }: { action: Action; autosave: boolean }) {
  const { bind, handleSubmit, formRef } = useControlledForm(action, DRAFT, { autosave });

  return createElement(
    "form",
    { ref: formRef, onSubmit: handleSubmit, noValidate: true },
    // eslint-disable-next-line react/no-children-prop -- `Field` takes a render function as its child, which createElement's typing refuses as a positional child.
    createElement(Field, { label: "Título", children: function renderInput(control: Control) { return createElement("input", { ...control, ...bind("title"), required: true }); } }),
  );
}

/** An edit page's own content: the form and the kinds of links a page puts in its text. */
function PageContent({ action = ok, autosave = false, extra }: { action?: Action; autosave?: boolean; extra?: ReactNode }) {
  return createElement(
    "div",
    null,
    createElement(Editor, { action, autosave }),
    createElement("a", { href: "/admin/registrations?evento=1" }, "Ver inscritos"),
    createElement("a", { href: "/admin/faqs", target: "_blank" }, "En otra pestaña"),
    createElement("a", { href: "/admin/faqs", target: "_self" }, "En esta pestaña"),
    createElement("a", { href: "/admin/events/1/registrations/export", download: true }, "Descargar CSV"),
    createElement("a", { href: "#respuesta" }, "Ir a la respuesta"),
    createElement("a", { href: `${window.location.pathname}#respuesta` }, "Ir a la respuesta, con la ruta"),
    createElement("a", { href: "https://example.org/guia" }, "Guía externa"),
    createElement("a", { href: "mailto:directiva@example.org" }, "Escribir"),
    createElement("a", { href: "/admin/faqs/2/edit" }, createElement("span", null, "Otra pregunta")),
    createElement(GuardedLink, { href: "/admin/faqs" }, "Volver, por el guardia"),
    extra,
  );
}

/** A guarded link whose focus goes back to a button of its own, the way the items of «Más» do. */
const ownReturn: { current: HTMLButtonElement | null } = { current: null };

function GuardedWithOwnReturn() {
  return createElement(
    "div",
    null,
    createElement("button", { ref: (button: HTMLButtonElement | null) => void (ownReturn.current = button), type: "button" }, "Menú propio"),
    createElement(GuardedLink, { href: "/admin/news", returnFocusTo: ownReturn }, "Novedades, por el guardia"),
  );
}

/** The real admin layout (provider, top bar, identity menu, rail and tab bar) around the page. */
async function mountAdmin(props: ComponentProps<typeof PageContent> = {}) {
  const tree = await AdminLayout({ children: createElement(PageContent, props) });

  return mount(tree);
}

/** The top bar and the identity menu as the forum and /inscripciones use them: no provider above. */
function OutsideAdmin({ signOut }: { signOut: ReactNode }) {
  return createElement(
    "div",
    null,
    // eslint-disable-next-line react/no-children-prop -- `AppTopBar` requires its children in its props, which createElement's typing checks before the positional ones.
    createElement(AppTopBar, {
      productName: "Foro",
      homeHref: "/foro",
      homeLabel: "Foro, inicio",
      children: createElement(IdentityChip, { name: "Ana Pérez", roleLabel: "Estudiante UNL", signOut }),
    }),
    createElement(PageContent),
  );
}

function slowAction() {
  const answers: ((result: ActionResult) => Promise<void>)[] = [];
  const action: Action = () =>
    new Promise((resolve) => {
      answers.push((result) => act(async () => resolve(result)));
    });

  return { action, answers };
}

const title = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[name="title"]')!;
const makeDirty = (host: HTMLElement) => typeInto(title(host), "Hola mundo");
const dialogs = () => document.querySelectorAll<HTMLElement>('[role="alertdialog"]');
const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const dialogButton = (label: string) => [...(dialog()?.querySelectorAll("button") ?? [])].find((button) => button.textContent === label)!;
const link = (host: HTMLElement, text: string) => [...host.querySelectorAll<HTMLAnchorElement>("a")].find((candidate) => candidate.textContent === text)!;
const logo = (host: HTMLElement) => host.querySelector<HTMLAnchorElement>("header a[aria-label]")!;
const chip = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('header button[aria-haspopup="true"]')!;
const menuButton = (host: HTMLElement, text: string) => [...host.querySelectorAll<HTMLButtonElement>("header [id] button")].find((button) => button.textContent?.includes(text))!;
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

async function press(key: string) {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

async function clickWith(element: Element, init: MouseEventInit) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  });
}

describe("the phone top bar's logo", () => {
  it("asks inside the admin while a form holds unsaved changes, and goes home on 'Salir sin guardar'", async () => {
    const host = await mountAdmin();

    expect(logo(host).getAttribute("href")).toBe("/admin");
    await makeDirty(host);
    await click(logo(host));

    expect(visits).toEqual([]);
    expect(dialogs()).toHaveLength(1);

    await click(dialogButton("Salir sin guardar"));
    expect(push).toHaveBeenCalledExactlyOnceWith("/admin");
  });

  it("gives the focus back to the logo with Escape", async () => {
    const host = await mountAdmin();

    await makeDirty(host);
    await click(logo(host));
    await press("Escape");

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(logo(host));
  });

  it("is a plain link inside the admin while nothing has changed", async () => {
    const host = await mountAdmin();

    await click(logo(host));

    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/admin"]);
  });

  it("is a plain link outside the admin, even with unsaved changes on the page", async () => {
    const host = await mount(createElement(OutsideAdmin, { signOut: null }));

    await makeDirty(host);
    await click(logo(host));

    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/foro"]);
  });
});

describe("the identity menu", () => {
  it("asks before 'Cerrar sesión' signs out while a form holds unsaved changes, and signs out on 'Salir sin guardar'", async () => {
    const host = await mountAdmin();

    await makeDirty(host);
    await click(chip(host));
    await click(menuButton(host, "Cerrar sesión"));

    expect(dialogs()).toHaveLength(1);
    expect(logout).not.toHaveBeenCalled();

    await click(dialogButton("Salir sin guardar"));
    expect(dialog()).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(title(host).value).toBe("Hola mundo");
  });

  it("stays signed in with 'Seguir editando' and, the menu being closed, gives the focus back to its button", async () => {
    const host = await mountAdmin();

    await makeDirty(host);
    await click(chip(host));
    await click(menuButton(host, "Cerrar sesión"));
    await click(dialogButton("Seguir editando"));

    expect(dialog()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(chip(host));
  });

  it("signs out without asking while nothing has changed", async () => {
    const host = await mountAdmin();

    await click(chip(host));
    await click(menuButton(host, "Cerrar sesión"));

    expect(dialog()).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("never asks for the theme toggle, which leaves nothing", async () => {
    const host = await mountAdmin();
    const before = document.documentElement.dataset.theme;

    await makeDirty(host);
    await click(chip(host));
    await click(menuButton(host, "Modo"));

    expect(dialog()).toBeNull();
    expect(document.documentElement.dataset.theme).not.toBe(before);
  });

  it("signs out as before outside the admin, even with unsaved changes on the page", async () => {
    const submitted = vi.fn();
    const signOut = createElement(
      "form",
      { onSubmit: (event: SubmitEvent) => { event.preventDefault(); submitted(); } },
      createElement("button", { type: "submit" }, "Cerrar sesión"),
    );
    const host = await mount(createElement(OutsideAdmin, { signOut }));

    await makeDirty(host);
    await click(chip(host));
    await click(menuButton(host, "Cerrar sesión"));

    expect(dialog()).toBeNull();
    expect(submitted).toHaveBeenCalledTimes(1);
  });
});

describe("a link inside a page's own content", () => {
  it("asks while a form holds unsaved changes, and goes where it pointed on 'Salir sin guardar'", async () => {
    const host = await mountAdmin();

    await makeDirty(host);
    await click(link(host, "Ver inscritos"));

    expect(visits).toEqual([]);
    expect(dialogs()).toHaveLength(1);
    expect(document.activeElement).toBe(dialogButton("Seguir editando"));

    await click(dialogButton("Salir sin guardar"));
    expect(push).toHaveBeenCalledExactlyOnceWith("/admin/registrations?evento=1");
  });

  it("asks for a click on something inside the link, and keeps editing with Escape, focus back on the link", async () => {
    const host = await mountAdmin();
    const other = link(host, "Otra pregunta");

    await makeDirty(host);
    await click(other.querySelector("span")!);
    expect(dialog()).not.toBeNull();

    await press("Escape");
    expect(dialog()).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(visits).toEqual([]);
    expect(document.activeElement).toBe(other);
  });

  it("asks for target=_self, which stays in this tab", async () => {
    const host = await mountAdmin();

    await makeDirty(host);
    await click(link(host, "En esta pestaña"));

    expect(dialog()).not.toBeNull();
  });

  it("does not ask while nothing has changed", async () => {
    const host = await mountAdmin();

    await click(link(host, "Ver inscritos"));

    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/admin/registrations?evento=1"]);
  });

  it("does not ask while the autosave of the change is on its way", async () => {
    const { action, answers } = slowAction();
    const host = await mountAdmin({ action, autosave: true });

    await makeDirty(host);
    await advance(AUTOSAVE_DELAY_MS);
    expect(answers).toHaveLength(1);

    await click(link(host, "Ver inscritos"));
    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/admin/registrations?evento=1"]);
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("lets a %s click through: it opens another tab or window", async (_name, init) => {
    const host = await mountAdmin();

    await makeDirty(host);
    await clickWith(link(host, "Ver inscritos"), init);

    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/admin/registrations?evento=1"]);
  });

  it.each([
    ["a target other than _self", "En otra pestaña", "/admin/faqs"],
    ["a download", "Descargar CSV", "/admin/events/1/registrations/export"],
    ["a jump on this page", "Ir a la respuesta", "#respuesta"],
    ["a jump on this page written with its path", "Ir a la respuesta, con la ruta", `${window.location.pathname}#respuesta`],
    ["another site", "Guía externa", "https://example.org/guia"],
    ["a mail link", "Escribir", "mailto:directiva@example.org"],
  ])("does not ask for %s: this page stays or the browser handles it", async (_name, text, href) => {
    const host = await mountAdmin();

    await makeDirty(host);
    await click(link(host, text));

    expect(dialog()).toBeNull();
    expect(visits).toEqual([href]);
  });

  it("does not ask twice for a GuardedLink: one dialog, one navigation", async () => {
    const host = await mountAdmin();

    await makeDirty(host);
    await click(link(host, "Volver, por el guardia"));

    expect(dialogs()).toHaveLength(1);
    await click(dialogButton("Salir sin guardar"));

    expect(dialog()).toBeNull();
    expect(push).toHaveBeenCalledExactlyOnceWith("/admin/faqs");
    expect(visits).toEqual([]);
  });

  it("leaves a GuardedLink's own focus target alone: the general listener does not take its click", async () => {
    const host = await mountAdmin({ extra: createElement(GuardedWithOwnReturn) });

    await makeDirty(host);
    await click(link(host, "Novedades, por el guardia"));
    expect(dialogs()).toHaveLength(1);

    await press("Escape");
    expect(document.activeElement?.textContent).toBe("Menú propio");
  });

  it("does not ask outside the admin", async () => {
    const host = await mount(createElement(OutsideAdmin, { signOut: null }));

    await makeDirty(host);
    await click(link(host, "Ver inscritos"));

    expect(dialog()).toBeNull();
    expect(visits).toEqual(["/admin/registrations?evento=1"]);
  });
});
