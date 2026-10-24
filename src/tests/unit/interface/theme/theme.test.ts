import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import { nextTheme, resolveTheme, THEME_COLOR, THEME_INIT_SCRIPT, THEME_KEY, type Theme } from "@/interface/theme/theme";

describe("resolveTheme", () => {
  it.each<[string | null, boolean, Theme]>([
    ["light", false, "light"],
    ["dark", true, "dark"],
    [null, false, "dark"],
    [null, true, "light"],
    ["sepia", true, "light"],
    ["sepia", false, "dark"],
    ["", false, "dark"],
  ])("stored %j, system prefers light %s -> %s", (stored, prefersLight, expected) => {
    expect(resolveTheme(stored, prefersLight)).toBe(expected);
  });
});

describe("nextTheme", () => {
  it("flips between the two themes", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});

describe("theme constants", () => {
  it("shares the storage key with the landing", () => {
    expect(THEME_KEY).toBe("aso-theme");
  });

  it("keeps today's dark browser chrome colour", () => {
    expect(THEME_COLOR.dark).toBe("#03224a");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  interface Fakes {
    stored?: string | null;
    storageThrows?: boolean;
    prefersLight?: boolean;
    withMeta?: boolean;
  }

  function run({ stored = null, storageThrows = false, prefersLight = false, withMeta = true }: Fakes) {
    const meta = { content: "#03224a", setAttribute(_name: string, value: string) { this.content = value; } };
    const root = { dataset: {} as Record<string, string> };
    const sandbox = {
      document: { documentElement: root, querySelector: () => (withMeta ? meta : null) },
      localStorage: {
        getItem: (key: string) => {
          if (storageThrows) throw new Error("blocked");
          return key === THEME_KEY ? stored : null;
        },
      },
      window: { matchMedia: (query: string) => ({ matches: query.includes("light") && prefersLight }) },
    };

    runInNewContext(THEME_INIT_SCRIPT, sandbox);

    return { theme: root.dataset.theme, chrome: meta.content };
  }

  it("applies a stored choice over the system preference", () => {
    expect(run({ stored: "light", prefersLight: false }).theme).toBe("light");
    expect(run({ stored: "dark", prefersLight: true }).theme).toBe("dark");
  });

  it("follows the system when nothing is stored, defaulting to dark", () => {
    expect(run({ prefersLight: true }).theme).toBe("light");
    expect(run({ prefersLight: false }).theme).toBe("dark");
  });

  it("falls back to the system when storage is blocked", () => {
    expect(run({ storageThrows: true, prefersLight: true }).theme).toBe("light");
  });

  it("repaints the browser chrome colour for the resolved theme", () => {
    expect(run({ stored: "light" }).chrome).toBe(THEME_COLOR.light);
    expect(run({ stored: "dark" }).chrome).toBe(THEME_COLOR.dark);
  });

  it("does not throw when the theme-color meta tag is missing", () => {
    expect(run({ stored: "light", withMeta: false }).theme).toBe("light");
  });

  it("agrees with resolveTheme for every combination", () => {
    for (const stored of [null, "light", "dark", "junk"]) {
      for (const prefersLight of [true, false]) {
        expect(run({ stored, prefersLight }).theme).toBe(resolveTheme(stored, prefersLight));
      }
    }
  });
});
