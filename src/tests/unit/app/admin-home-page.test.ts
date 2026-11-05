import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ session: vi.fn(), failing: vi.fn(), deploy: vi.fn() }));

vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: reads.session }));
vi.mock("@/interface/admin/deploy-status-admin-read", () => ({ getLastDeployStatus: reads.deploy }));
// A failed read shows a dash in its module line, so the page renders with no database.
vi.mock("@/interface/admin/board/board-members-admin-read", () => ({ getAdminBoardMembers: reads.failing }));
vi.mock("@/interface/admin/commands/commands-admin-read", () => ({ getAdminCommands: reads.failing }));
vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvents: reads.failing }));
vi.mock("@/interface/admin/faqs/faqs-admin-read", () => ({ getAdminFaqs: reads.failing }));
vi.mock("@/interface/admin/forum/forum-moderation-read", () => ({ getAdminForumReports: reads.failing }));
vi.mock("@/interface/admin/news/news-admin-read", () => ({ getAdminNewsItems: reads.failing }));
vi.mock("@/interface/admin/pillars/pillars-admin-read", () => ({ getAdminPillars: reads.failing }));
vi.mock("@/interface/admin/socials/socials-admin-read", () => ({ getAdminSocialLinks: reads.failing }));
vi.mock("@/interface/admin/sponsors/sponsors-admin-read", () => ({ getAdminSponsors: reads.failing }));

import AdminHomePage from "../../../../app/admin/page";

const render = async (role: "admin" | "editor") => {
  reads.session.mockResolvedValue({ role });

  return renderToStaticMarkup(await AdminHomePage({ searchParams: Promise.resolve({}) }));
};

beforeEach(() => {
  reads.session.mockReset();
  reads.failing.mockReset().mockRejectedValue(new Error("down"));
  reads.deploy.mockReset().mockResolvedValue(undefined);
});

describe("the admin home module grid", () => {
  it.each(["admin", "editor"] as const)("paints no solid background behind its cells, so a missing cell at any width stays empty (%s)", async (role) => {
    const html = await render(role);
    const modules = html.slice(html.indexOf('id="modules-title"'));
    const list = modules.slice(modules.indexOf("<ul"), modules.indexOf(">", modules.indexOf("<ul")));

    expect(list).not.toContain("bg-border");
    expect(modules.match(/<li class="[^"]*bg-card/g)?.length).toBeGreaterThan(0);
  });

  it("titles its sections with the shared section heading", async () => {
    const html = await render("admin");

    expect(html).toMatch(/<h2 class="[^"]*text-lg font-bold[^"]*" id="modules-title">Contenido del sitio<\/h2>/);
  });
});
