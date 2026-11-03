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
