import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_COLOR, THEME_KEY } from "@/interface/theme/theme";

import RootLayout from "../../../../app/layout";

/** Every inline script in the root `<head>`, in document order: what the browser runs before first paint. */
function preflightScripts(): string[] {
  const html = renderToStaticMarkup(createElement(RootLayout, null, null as ReactNode));

  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

interface Page {
  path: string;
  stored?: string | null;
  storageThrows?: boolean;
  prefersLight?: boolean;
}

function paint({ path, stored = null, storageThrows = false, prefersLight = false }: Page) {
  const meta = { content: THEME_COLOR.dark, setAttribute(_name: string, value: string) { this.content = value; } };
  const root = { dataset: {} as Record<string, string> };
  const sandbox = {
    document: { documentElement: root, querySelector: () => meta },
    location: { pathname: path },
    localStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error("blocked");
        return key === THEME_KEY ? stored : null;
      },
    },
    window: { matchMedia: (query: string) => ({ matches: query.includes("light") && prefersLight }) },
  };

  for (const script of preflightScripts()) runInNewContext(script, sandbox);

  return { theme: root.dataset.theme, chrome: meta.content };
}

describe("the admin opens in the light editorial theme", () => {
  it.each(["/admin", "/admin/", "/admin/events", "/admin/registrations/42"])("%s is light when nothing is stored, even if the system prefers dark", (path) => {
    expect(paint({ path, prefersLight: false }).theme).toBe("light");
  });

  it("paints the browser chrome in the light colour", () => {
    expect(paint({ path: "/admin" }).chrome).toBe(THEME_COLOR.light);
  });

  it("is light when storage is blocked, because there is no choice to honour", () => {
    expect(paint({ path: "/admin", storageThrows: true }).theme).toBe("light");
  });

  it("lets the user's explicit choice win in both directions", () => {
    expect(paint({ path: "/admin/events", stored: "dark", prefersLight: true })).toEqual({ theme: "dark", chrome: THEME_COLOR.dark });
    expect(paint({ path: "/admin/events", stored: "light", prefersLight: false }).theme).toBe("light");
  });

  it("ignores a junk stored value, as the rest of the app does", () => {
    expect(paint({ path: "/admin", stored: "sepia" }).theme).toBe("light");
  });
});

describe("everything outside /admin keeps following the system, defaulting to dark", () => {
  it.each(["/login", "/foro", "/foro/hilo/3", "/invitacion/abc", "/", "/administrador", "/adminx/events"])("%s", (path) => {
    expect(paint({ path, prefersLight: false })).toEqual({ theme: "dark", chrome: THEME_COLOR.dark });
    expect(paint({ path, prefersLight: true }).theme).toBe("light");
    expect(paint({ path, stored: "dark", prefersLight: true }).theme).toBe("dark");
  });
});

describe("AdminThemeDefault (soft navigation into and out of /admin)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("react");
  });

  /** Mounts the component against a fake `<html>`: layout effects run at once and the cleanup is handed back. */
  async function mount({ stored = null, prefersLight = false, theme }: { stored?: string | null; prefersLight?: boolean; theme: string }) {
    let cleanup: (() => void) | void;
    const root = { dataset: { theme } as Record<string, string> };
    const meta = { content: "", setAttribute(_name: string, value: string) { this.content = value; } };

    vi.doMock("react", async (importOriginal) => ({
      ...(await importOriginal<typeof import("react")>()),
      useLayoutEffect: (effect: () => (() => void) | void) => {
        cleanup = effect();
      },
    }));
    vi.stubGlobal("document", { documentElement: root, querySelector: () => meta });
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === THEME_KEY ? stored : null) });
    vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: query.includes("light") && prefersLight }) });

    const { AdminThemeDefault } = await import("../../../../app/_components/theme-toggle");

    expect(AdminThemeDefault()).toBeNull();

    return { root, meta, unmount: () => cleanup?.() };
  }

  it("turns a dark page light on entering the admin and gives the system theme back on leaving", async () => {
    const page = await mount({ theme: "dark", prefersLight: false });

    expect(page.root.dataset.theme).toBe("light");
    expect(page.meta.content).toBe(THEME_COLOR.light);

    page.unmount();

    expect(page.root.dataset.theme).toBe("dark");
    expect(page.meta.content).toBe(THEME_COLOR.dark);
  });

  it("leaves to a light system theme as light", async () => {
    const page = await mount({ theme: "dark", prefersLight: true });

    page.unmount();

    expect(page.root.dataset.theme).toBe("light");
  });

  it("does nothing when the user has chosen a theme", async () => {
    const page = await mount({ theme: "dark", stored: "dark" });

    expect(page.root.dataset.theme).toBe("dark");

    page.unmount();

    expect(page.root.dataset.theme).toBe("dark");
  });
});
