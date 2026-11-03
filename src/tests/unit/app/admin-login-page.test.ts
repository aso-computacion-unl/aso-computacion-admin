import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { availability } = vi.hoisted(() => ({ availability: vi.fn() }));

vi.mock("../../../../app/_components/brand-mark", () => ({ BrandLogo: () => null }));
vi.mock("@/infrastructure/auth/auth-config", () => ({ loginAvailability: availability }));
vi.mock("@/interface/auth/actions", () => ({ login: vi.fn() }));
vi.mock("@/interface/auth/report-auth-config", () => ({ reportAuthConfigProblems: vi.fn() }));

import LoginPage from "../../../../app/login/page";

const render = async () => renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));

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

describe("the admin login layout", () => {
  beforeEach(() => availability.mockReturnValue({ google: true, emergency: true, problems: [] }));

  it("sets the access as the first node of a branch: HEAD, then what the panel is for, with no second h1", async () => {
    const html = await render();
    const branch = html.match(/<ol class="branch">[\s\S]*?<\/ol>/)?.[0] ?? "";
    const head = branch.match(/<li>[\s\S]*?<\/li>/)?.[0] ?? "";

    expect(head).toContain("HEAD → admin");
    expect(head).toContain("Entrar con Google");
    expect(branch.match(/<li/g)).toHaveLength(4);
    expect(branch).toContain("Eventos y galerías");
    expect(branch).toContain("Noticias y preguntas frecuentes");
    expect(branch).toContain("Sitio público al día");
    expect(branch).toContain("a3f9c21");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.indexOf('id="login-title"')).toBeLessThan(html.indexOf('class="branch"'));
  });

  it("keeps the hashes and the terminal line out of assistive technology", async () => {
    const html = await render();

    expect(html).toMatch(/<span aria-hidden="true"[^>]*>a3f9c21<\/span>/);
    expect(html).toMatch(/<p aria-hidden="true"[^>]*>\$ git branch --show-current/);
  });

  it("keeps the form in the one main landmark and fills the viewport height", async () => {
    const html = await render();

    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain("min-h-dvh");
    expect(html).toContain('id="login-title"');
    expect(html).toContain("Panel de administración");
  });

  it("names the section by the title and offers the emergency access as a closed disclosure", async () => {
    const html = await render();

    expect(html).toMatch(/<section aria-labelledby="login-title"[^>]*>\s*<h1 id="login-title"/);
    expect(html).toContain("Entrar con Google");
    expect(html).toMatch(/<details class="emergency[^"]*"[^>]*>\s*<summary[^>]*>Acceso de emergencia<\/summary>/);
    expect(html).not.toMatch(/<details[^>]* open/);
  });
});

describe("the admin login states", () => {
  it("shows the error of the query as one alert in the first node, above the Google button", async () => {
    availability.mockReturnValue({ google: true, emergency: true, problems: [] });
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ error: "verification" }) }));

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain("No pudimos verificar su cuenta de Google");
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('href="/auth/google/start"'));
  });

  it("without Google, asks for the password in the first node and offers no Google button or disclosure", async () => {
    availability.mockReturnValue({ google: false, emergency: true, problems: [] });
    const html = await render();

    expect(html).toContain("Ingrese la contraseña de la directiva");
    expect(html).toContain('name="password"');
    expect(html).not.toContain("Entrar con Google");
    expect(html).not.toContain("<details");
  });
});
