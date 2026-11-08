// @vitest-environment jsdom
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { AreaTabs } from "../../../../app/admin/_components/area-tabs";
import { AJUSTES_TABS, CONTENIDO_MORE, CONTENIDO_TABS } from "../../../../app/admin/_components/nav-items";
import { click, mount, unmountAll } from "@/tests/support/dom";

const TABS = "[data-slot='tab-strip'] > nav > ul > li > a";
const MENU = "[data-slot='more-menu'] a";

const html = (props: Parameters<typeof AreaTabs>[0]) => renderToStaticMarkup(createElement(AreaTabs, props));

/** The document the markup parses to, so a test reads links and attributes instead of matching strings. */
const parse = (markup: string) => {
  const host = document.createElement("div");

  host.innerHTML = markup;

  return host;
};

const links = (host: HTMLElement, selector: string) =>
  [...host.querySelectorAll<HTMLAnchorElement>(selector)].map((a) => [a.textContent?.replace(/\s+/g, " ").trim(), a.getAttribute("href")]);

afterEach(unmountAll);

describe("the Contenido tabs", () => {
  it("lists the four main types in order, plus the rest under 'Más'", () => {
    const host = parse(html({ area: "contenido", current: "/admin/news" }));

    expect(links(host, TABS)).toEqual([
      ["Línea de tiempo", "/admin/events"],
      ["Novedades", "/admin/news"],
      ["Preguntas", "/admin/faqs"],
      ["Directiva", "/admin/board"],
    ]);
    expect(links(host, MENU)).toEqual([
      ["Pilares", "/admin/pillars"],
      ["Comandos", "/admin/commands"],
      ["Aliados", "/admin/sponsors"],
      ["Redes", "/admin/socials"],
    ]);
    expect(host.querySelector("button[aria-haspopup]")?.textContent).toContain("Más");
  });

  it("marks only the current tab with aria-current=page", () => {
    const host = parse(html({ area: "contenido", current: "/admin/faqs" }));
    const current = [...host.querySelectorAll("[aria-current]")];

    expect(current.map((el) => [el.textContent?.trim(), el.getAttribute("aria-current")])).toEqual([["Preguntas", "page"]]);
  });

  it("lights 'Más' and names the current type there when it is one of the rest", () => {
    const host = parse(html({ area: "contenido", current: "/admin/sponsors" }));
    const more = host.querySelector("button[aria-haspopup]");

    expect(more?.getAttribute("aria-current")).toBe("page");
    expect(more?.textContent).toContain("Aliados");
    expect(host.querySelector(`${TABS}[aria-current]`)).toBeNull();
    expect(host.querySelector(`${MENU}[aria-current='page']`)?.textContent).toBe("Aliados");
  });

  it.each([
    ["/admin/events", "/admin/events/new"],
    ["/admin/news", "/admin/news/new"],
    ["/admin/faqs", "/admin/faqs/new"],
    ["/admin/board", "/admin/board/new"],
    ["/admin/pillars", "/admin/pillars/new"],
    ["/admin/commands", "/admin/commands/new"],
    ["/admin/sponsors", "/admin/sponsors/new"],
    ["/admin/socials", "/admin/socials/new"],
  ])("offers one '+ Crear' for the type of %s", (current, href) => {
    const host = parse(html({ area: "contenido", current }));
    const create = [...host.querySelectorAll("a")].filter((a) => a.textContent?.trim() === "Crear");

    expect(create.map((a) => a.getAttribute("href"))).toEqual([href]);
  });

  it("covers the eight content routes, in order", () => {
    expect([...CONTENIDO_TABS, ...CONTENIDO_MORE].map((tab) => tab.href)).toEqual([
      "/admin/events",
      "/admin/news",
      "/admin/faqs",
      "/admin/board",
      "/admin/pillars",
      "/admin/commands",
      "/admin/sponsors",
      "/admin/socials",
    ]);
  });
});

describe("the 'Más' menu", () => {
  it("is closed at first and opens and closes from its button", async () => {
    const host = await mount(createElement(AreaTabs, { area: "contenido", current: "/admin/events" }));
    const button = host.querySelector("button[aria-haspopup]") as HTMLButtonElement;
    const menu = host.querySelector("[data-slot='more-menu']") as HTMLElement;

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(menu.hidden).toBe(true);

    await click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(menu.hidden).toBe(false);

    await click(button);
    expect(menu.hidden).toBe(true);
  });

  it("closes with Escape and gives the focus back to its button", async () => {
    const host = await mount(createElement(AreaTabs, { area: "contenido", current: "/admin/events" }));
    const button = host.querySelector("button[aria-haspopup]") as HTMLButtonElement;
    const menu = host.querySelector("[data-slot='more-menu']") as HTMLElement;

    await click(button);
    await act(async () => {
      menu.querySelector("a")?.focus();
      menu.querySelector("a")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });
});

describe("the Ajustes tabs", () => {
  it("show an administrator all five, with a lock named for screen readers on the admin-only ones", () => {
    const host = parse(html({ area: "ajustes", current: "/admin/sesiones", role: "ADMIN" }));

    expect(links(host, TABS)).toEqual([
      ["Equipo solo administradores", "/admin/usuarios"],
      ["Mis sesiones", "/admin/sesiones"],
      ["Textos del sitio solo administradores", "/admin/settings"],
      ["Historial solo administradores", "/admin/registro"],
      ["Papelera", "/admin/papelera"],
    ]);
    expect(host.querySelectorAll("svg")).toHaveLength(3);
  });

  it("hide the admin-only tabs from an editor, leaving no lock", () => {
    const host = parse(html({ area: "ajustes", current: "/admin/papelera", role: "EDITOR" }));

    expect(links(host, TABS)).toEqual([
      ["Mis sesiones", "/admin/sesiones"],
      ["Papelera", "/admin/papelera"],
    ]);
    expect(host.querySelector("svg")).toBeNull();
  });

  it("mark the current tab and offer no '+ Crear' or 'Más'", () => {
    const host = parse(html({ area: "ajustes", current: "/admin/registro", role: "ADMIN" }));

    expect([...host.querySelectorAll("[aria-current]")].map((el) => [el.getAttribute("href"), el.getAttribute("aria-current")])).toEqual([["/admin/registro", "page"]]);
    expect(host.textContent).not.toContain("Crear");
    expect(host.querySelector("button")).toBeNull();
  });

  it("are the table the entry route reads", () => {
    expect(AJUSTES_TABS.map((tab) => [tab.label, tab.adminOnly === true])).toEqual([
      ["Equipo", true],
      ["Mis sesiones", false],
      ["Textos del sitio", true],
      ["Historial", true],
      ["Papelera", false],
    ]);
  });
});

describe("the strip on a phone", () => {
  it("scrolls sideways inside its own box instead of widening the page", () => {
    const host = parse(html({ area: "contenido", current: "/admin/events" }));
    const strip = host.querySelector("[data-slot='tab-strip']") as HTMLElement;

    expect(strip.className).toContain("overflow-x-auto");
    expect(strip.className).toContain("min-w-0");
  });
});
