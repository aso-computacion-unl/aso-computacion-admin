import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/_components/brand-mark", () => ({ BrandLogo: () => null }));
vi.mock("../../../../app/_components/theme-toggle", () => ({ ThemeToggle: () => null }));

import InvitationPage, { dynamic, metadata } from "../../../../app/invitacion/[token]/page";
import { inviteTokens } from "@/infrastructure/auth/invite-token";
import { makeInvite } from "@/tests/fakes/in-memory-auth";
import { testAuth } from "@/tests/support/test-auth";

const TOKEN = inviteTokens.generate();
const HOUR = 60 * 60 * 1000;

const render = async (token: string) => renderToStaticMarkup(await InvitationPage({ params: Promise.resolve({ token }) }));

describe("the public invitation page", () => {
  it("is never indexed and never cached", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(dynamic).toBe("force-dynamic");
  });

  it("shows the invited email and role of a pending invite, with a Google link that carries the token", async () => {
    await testAuth.invites.create(
      makeInvite({ tokenHash: inviteTokens.hash(TOKEN), email: "ben@example.org", role: "ADMIN", createdAt: new Date(Date.now() - HOUR), expiresAt: new Date(Date.now() + HOUR) }),
    );

    const html = await render(TOKEN);

    expect(html).toContain("ben@example.org");
    expect(html).toContain("administrador");
    expect(html).toContain(`href="/auth/google/start?invite=${TOKEN}"`);
    expect(html).toContain("Continuar con Google");
  });

  it.each([
    ["an unknown token", async () => inviteTokens.generate()],
    ["a malformed token", async () => "nope"],
    [
      "an expired invite",
      async () => {
        await testAuth.invites.create(makeInvite({ tokenHash: inviteTokens.hash(TOKEN), email: "ben@example.org", expiresAt: new Date(Date.now() - 1000) }));
        return TOKEN;
      },
    ],
  ])("says only that the link is no longer valid for %s: no email, no Google link", async (_label, setup) => {
    const html = await render(await setup());

    expect(html).toContain("Invitación no disponible");
    expect(html).not.toContain("ben@example.org");
    expect(html).not.toContain("/auth/google/start");
  });
});
