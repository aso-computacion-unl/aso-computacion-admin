import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { availability } = vi.hoisted(() => ({ availability: vi.fn() }));

vi.mock("../../../../app/_components/brand-mark", () => ({ BrandLogo: () => createElement("img", { "data-brand": "logo", alt: "" }) }));
vi.mock("../../../../app/_components/theme-toggle", () => ({
  AdminThemeDefault: () => createElement("i", { "data-light-scope": "" }),
  ThemeToggle: () => createElement("button", { "data-theme-toggle": "" }),
}));
vi.mock("@/infrastructure/auth/auth-config", () => ({ loginAvailability: availability }));
vi.mock("@/interface/auth/actions", () => ({ login: vi.fn() }));
vi.mock("@/interface/auth/report-auth-config", () => ({ reportAuthConfigProblems: vi.fn() }));

import { THEME_COLOR, THEME_KEY } from "@/interface/theme/theme";

import LoginPage from "../../../../app/login/page";

const render = async (error?: string) => renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(error ? { error } : {}) }));

describe("the admin login with Google available", () => {
  beforeEach(() => availability.mockReturnValue({ google: true, emergency: true, problems: [] }));

  it("offers 'Entrar con Google' as a plain link that starts the redirect flow", async () => {
    const link = (await render()).match(/<a [^>]*href="\/auth\/google\/start"[^>]*>.*?<\/a>/)?.[0] ?? "";

    expect(link).toContain("Entrar con Google");
  });

  it("draws the link as the shared Google button, with Google's mark, like the forum", async () => {
    const link = (await render()).match(/<a [^>]*href="\/auth\/google\/start"[^>]*>.*?<\/a>/)?.[0] ?? "";

    expect(link).toContain("google-button");
    expect(link).toContain("<svg");
    expect(link).toContain("#4285F4");
  });
});

describe("the admin login card", () => {
  beforeEach(() => availability.mockReturnValue({ google: true, emergency: true, problems: [] }));

  it("is one card in the one main landmark: the full logo, 'Admin', the name as the only h1, then the way in", async () => {
    const html = await render();

    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<section aria-labelledby="login-title"/);
    expect(html).toMatch(/<h1[^>]*id="login-title"[^>]*>ASO Computación<\/h1>/);
    expect(html).toContain('data-brand="logo"');
    expect(html).toContain(">Admin<");
    expect(html.indexOf('data-brand="logo"')).toBeLessThan(html.indexOf('id="login-title"'));
    expect(html.indexOf('id="login-title"')).toBeLessThan(html.indexOf("Entrar con Google"));
  });

  it("drops the branch decoration and the explanatory copy", async () => {
    const html = await render();

    expect(html).not.toContain('class="branch"');
    expect(html).not.toContain("git branch");
    expect(html).not.toContain("HEAD →");
    expect(html).not.toContain("Eventos y galerías");
  });

  it("keeps the theme toggle in the corner, outside the card", async () => {
    const html = await render();

    expect(html.match(/data-theme-toggle/g)).toHaveLength(1);
    expect(html.indexOf("data-theme-toggle")).toBeLessThan(html.indexOf("<section"));
  });

  it("keeps the light look on soft navigations through the shared admin default", async () => {
    expect(await render()).toContain("data-light-scope");
  });

  it("offers the emergency access as a quiet, closed disclosure after the Google button", async () => {
    const html = await render();

    expect(html).toMatch(/<details class="emergency[^"]*"[^>]*>\s*<summary[^>]*>[\s\S]*Acceso de emergencia<\/summary>/);
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html.indexOf("Entrar con Google")).toBeLessThan(html.indexOf("Acceso de emergencia"));
  });

  it("keeps the emergency form's fields as they were", async () => {
    const html = await render();

    expect(html).toContain('name="password"');
    expect(html).toContain('id="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain("Iniciar sesión");
  });
});

describe("the admin login states", () => {
  beforeEach(() => availability.mockReturnValue({ google: true, emergency: true, problems: [] }));

  it("shows the error of the query as one alert in the card, above the Google button", async () => {
    const html = await render("verification");

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain("No pudimos verificar su cuenta de Google");
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('href="/auth/google/start"'));
  });

  it("shows the invitation error in the same place", async () => {
    const html = await render("invite");

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain("La invitación no es válida");
  });

  it("shows no alert for an unknown error code", async () => {
    expect(await render("<script>")).not.toContain('role="alert"');
  });

  it("without Google, asks for the password in the card and offers no Google button or disclosure", async () => {
    availability.mockReturnValue({ google: false, emergency: true, problems: [] });
    const html = await render();

    expect(html).toContain('name="password"');
    expect(html).toContain('data-brand="logo"');
    expect(html).not.toContain("Entrar con Google");
    expect(html).not.toContain("<details");
  });

  it("with half-set Google variables, says so and keeps the password form for the emergency access", async () => {
    availability.mockReturnValue({ google: false, emergency: true, problems: ["GOOGLE_CLIENT_ID"] });
    const html = await render();

    expect(html).toContain("Configuración incompleta");
    expect(html).toContain('name="password"');
    expect(html).not.toContain("Entrar con Google");
  });

  it("with no way in at all, only says the access is unavailable", async () => {
    availability.mockReturnValue({ google: false, emergency: false, problems: ["GOOGLE_CLIENT_ID"] });
    const html = await render();

    expect(html).toContain("Configuración incompleta");
    expect(html).not.toContain('name="password"');
    expect(html).not.toContain("Entrar con Google");
  });
});

describe("the admin login's light look before first paint", () => {
  beforeEach(() => availability.mockReturnValue({ google: true, emergency: true, problems: [] }));

  async function paint({ stored = null, storageThrows = false }: { stored?: string | null; storageThrows?: boolean } = {}) {
    const script = (await render()).match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    const meta = { content: THEME_COLOR.dark, setAttribute(_name: string, value: string) { this.content = value; } };
    // What the root layout's own script has already set: a stored choice, else the dark default.
    const root = { dataset: { theme: stored === "light" ? "light" : "dark" } as Record<string, string> };

    runInNewContext(script, {
      document: { documentElement: root, querySelector: () => meta },
      localStorage: {
        getItem: (key: string) => {
          if (storageThrows) throw new Error("blocked");
          return key === THEME_KEY ? stored : null;
        },
      },
    });

    return { theme: root.dataset.theme, chrome: meta.content, script };
  }

  it("turns the page light, and the browser chrome with it, when nothing is stored", async () => {
    expect(await paint()).toMatchObject({ theme: "light", chrome: THEME_COLOR.light });
  });

  it("is light when storage is blocked, because there is no choice to honour", async () => {
    expect((await paint({ storageThrows: true })).theme).toBe("light");
  });

  it("lets a stored choice win in both directions, and ignores a junk value", async () => {
    expect((await paint({ stored: "dark" })).theme).toBe("dark");
    expect((await paint({ stored: "light" })).theme).toBe("light");
    expect((await paint({ stored: "sepia" })).theme).toBe("light");
  });

  it("lives only on the login page: nothing here writes to the shared layout, so the forum keeps following the system", async () => {
    const { script } = await paint();

    expect(script).toContain("documentElement.dataset.theme");
    expect(script).not.toContain("matchMedia");
  });
});
