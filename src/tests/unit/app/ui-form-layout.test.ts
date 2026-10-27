import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()])));

vi.mock("@/interface/admin/faqs/actions", () => actions("createFaq"));
vi.mock("@/interface/admin/commands/actions", () => actions("createCommand"));
vi.mock("@/interface/admin/pillars/actions", () => actions("createPillar"));
vi.mock("@/interface/admin/socials/actions", () => actions("createSocialLink"));
vi.mock("@/interface/admin/board/actions", () => actions("createBoardMember"));
vi.mock("@/interface/admin/impact/actions", () => actions("createImpactStat"));
vi.mock("@/interface/admin/sponsors/actions", () => actions("createSponsor"));
vi.mock("@/interface/admin/testimonials/actions", () => actions("createTestimonial"));
vi.mock("@/interface/admin/events/actions", () => actions("createEvent"));
vi.mock("@/interface/admin/news/actions", () => actions("createNewsItem"));
vi.mock("@/interface/admin/settings/actions", () => actions("updateSiteSettings"));

import { FormLayout } from "../../../../app/admin/_components/form-layout";
import NewBoardMemberPage from "../../../../app/admin/board/new/page";
import NewCommandPage from "../../../../app/admin/commands/new/page";
import NewEventPage from "../../../../app/admin/events/new/page";
import NewFaqPage from "../../../../app/admin/faqs/new/page";
import NewImpactStatPage from "../../../../app/admin/impact/new/page";
import NewNewsPage from "../../../../app/admin/news/new/page";
import NewPillarPage from "../../../../app/admin/pillars/new/page";
import AdminSettingsPage from "../../../../app/admin/settings/page";
import NewSocialLinkPage from "../../../../app/admin/socials/new/page";
import NewSponsorPage from "../../../../app/admin/sponsors/new/page";
import NewTestimonialPage from "../../../../app/admin/testimonials/new/page";

vi.mock("@/interface/admin/settings/settings-admin-read", () => ({ getAdminSiteSettings: vi.fn().mockResolvedValue({ tagline: "t", description: "d", about: "a" }) }));

const frame = { backHref: "/admin/faqs", backLabel: "Volver a preguntas", title: "Nueva pregunta", status: "sin guardar" };
const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(FormLayout, { ...frame, ...props, children: createElement("p", null, "form") } as never));

describe("FormLayout", () => {
  it("opens with the page header: back link, title and status", () => {
    const html = render({});

    expect(html).toContain('data-slot="page-header"');
    expect(html).toContain("Volver a preguntas");
    expect(html).toContain("sin guardar");
  });

  it("is one narrow column with no reserved side column when the form has nothing to put beside it", () => {
    const html = render({});

    expect(html).toContain('data-layout="single"');
    expect(html).not.toContain('data-slot="form-aside"');
  });

  it("puts media or a preview in a side column, below the form on a phone", () => {
    const html = render({ aside: createElement("p", null, "foto") });

    expect(html).toContain('data-layout="split"');
    expect(html).toMatch(/data-slot="form-aside"[^>]*>.*foto/);
    expect(html.indexOf("form")).toBeLessThan(html.indexOf("foto"));
  });

  it("keeps the form the same width with or without a side column", () => {
    const widthOf = (html: string) => html.match(/data-slot="form-column"[^>]*class="[^"]*(max-w-[^ "]+)/)?.[1];

    expect(widthOf(render({}))).toBeDefined();
    expect(widthOf(render({}))).toBe(widthOf(render({ aside: createElement("p", null, "foto") })));
  });
});

describe("every create page ends in the same save bar", () => {
  const pages = [
    ["faqs", NewFaqPage],
    ["commands", NewCommandPage],
    ["pillars", NewPillarPage],
    ["socials", NewSocialLinkPage],
    ["board", NewBoardMemberPage],
    ["impact", NewImpactStatPage],
    ["sponsors", NewSponsorPage],
    ["testimonials", NewTestimonialPage],
    ["events", NewEventPage],
    ["news", NewNewsPage],
  ] as const;

  it.each(pages)("%s", (_name, Page) => {
    const html = renderToStaticMarkup(createElement(Page));

    expect(html).toContain('data-slot="action-bar"');
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    expect(html).not.toContain("border-l-2");
  });
});

describe("the sticky columns sit below the 56px top bar", () => {
  it("offsets the news preview and the settings preview by more than the bar", () => {
    const news = renderToStaticMarkup(createElement(NewNewsPage));

    expect(news).toContain("lg:top-22");
    expect(news).not.toContain("lg:top-8");
  });

  it("does the same for the site settings", async () => {
    const settings = renderToStaticMarkup(await AdminSettingsPage());

    expect(settings).toContain("lg:top-22");
    expect(settings).not.toContain("lg:top-8");
  });
});
