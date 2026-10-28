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

  it("sets a brand panel beside the form on wide screens: what the panel is for, a commit log, and no second h1", async () => {
    const html = await render();
    const panel = html.match(/<aside[^>]*aria-label="Sobre el panel"[^>]*>[\s\S]*?<\/aside>/)?.[0] ?? "";

    expect(panel).toContain("hidden");
    expect(panel).toContain("lg:flex");
    expect(panel).toContain("El sitio de la asociación, siempre al día.");
    expect(panel).toContain("git log --oneline");
    expect(panel).toContain("a3f9c21");
    expect(panel).not.toContain("<h1");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.indexOf('aria-label="Sobre el panel"')).toBeLessThan(html.indexOf('id="login-title"'));
  });

  it("keeps the form in the one main landmark and fills the viewport height", async () => {
    const html = await render();

    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain("min-h-dvh");
    expect(html).toContain('id="login-title"');
    expect(html).toContain("Panel de administración");
  });

  it("names the form's section by the title and gives the panel the larger share of the width", async () => {
    const html = await render();

    expect(html).toMatch(/<section aria-labelledby="login-title"[^>]*>\s*<h1 id="login-title"/);
    expect(html).toContain("lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
    expect(html).toContain("Entrar con Google");
    expect(html).toContain("Acceso de emergencia");
  });
});
