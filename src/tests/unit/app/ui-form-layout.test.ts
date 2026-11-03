import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()])));

vi.mock("@/interface/admin/faqs/actions", () => actions("createFaq"));
vi.mock("@/interface/admin/commands/actions", () => actions("createCommand"));
vi.mock("@/interface/admin/pillars/actions", () => actions("createPillar"));
vi.mock("@/interface/admin/socials/actions", () => actions("createSocialLink"));
vi.mock("@/interface/admin/board/actions", () => actions("createBoardMember"));
vi.mock("@/interface/admin/sponsors/actions", () => actions("createSponsor"));
vi.mock("@/interface/admin/events/actions", () => actions("createEvent"));
vi.mock("@/interface/admin/news/actions", () => actions("createNewsItem"));
vi.mock("@/interface/admin/settings/actions", () => actions("updateSiteSettings"));

import { FormLayout } from "../../../../app/admin/_components/form-layout";
import NewBoardMemberPage from "../../../../app/admin/board/new/page";
import NewCommandPage from "../../../../app/admin/commands/new/page";
import NewEventPage from "../../../../app/admin/events/new/page";
import NewFaqPage from "../../../../app/admin/faqs/new/page";
import NewNewsPage from "../../../../app/admin/news/new/page";
import NewPillarPage from "../../../../app/admin/pillars/new/page";
import AdminSettingsPage from "../../../../app/admin/settings/page";
import NewSocialLinkPage from "../../../../app/admin/socials/new/page";
import NewSponsorPage from "../../../../app/admin/sponsors/new/page";

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

  it("frames a form with no side column at the form's own width, header included, centered in the page", () => {
    const html = render({});
    const frame = html.match(/<div[^>]*data-slot="page-frame"[^>]*>/)?.[0] ?? "";

    expect(frame).toContain('data-width="narrow"');
    expect(frame).toContain("mx-auto");
    expect(frame).toContain("max-w-166");
    // The header lives inside the frame, so the title and the form share one left edge.
    expect(html.indexOf('data-slot="page-frame"')).toBeLessThan(html.indexOf('data-slot="page-header"'));
  });

  it("lets a form with a side column fill the page: a flexible form column beside a fixed side column", () => {
    const html = render({ aside: createElement("p", null, "foto") });
    const frame = html.match(/<div[^>]*data-slot="page-frame"[^>]*>/)?.[0] ?? "";
    const formColumn = html.match(/<div[^>]*data-slot="form-column"[^>]*>/)?.[0] ?? "";
    const columns = html.match(/<div[^>]*data-layout="split"[^>]*>/)?.[0] ?? "";

    expect(frame).toContain('data-width="fill"');
    expect(frame).not.toContain("max-w");
    expect(formColumn).not.toContain("max-w");
    expect(columns).toContain("xl:grid-cols-[minmax(0,1fr)_26rem]");
  });
});

describe("every create page ends in the same save bar", () => {
  const pages = [
    ["faqs", NewFaqPage],
    ["commands", NewCommandPage],
    ["pillars", NewPillarPage],
    ["socials", NewSocialLinkPage],
    ["board", NewBoardMemberPage],
    ["sponsors", NewSponsorPage],
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
