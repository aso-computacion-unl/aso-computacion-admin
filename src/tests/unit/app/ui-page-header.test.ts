import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({
  faq: vi.fn(),
  command: vi.fn(),
  pillar: vi.fn(),
  social: vi.fn(),
  board: vi.fn(),
  impact: vi.fn(),
  sponsor: vi.fn(),
  testimonial: vi.fn(),
}));

vi.mock("@/interface/admin/faqs/faqs-admin-read", () => ({ getAdminFaq: reads.faq }));
vi.mock("@/interface/admin/commands/commands-admin-read", () => ({ getAdminCommand: reads.command }));
vi.mock("@/interface/admin/pillars/pillars-admin-read", () => ({ getAdminPillar: reads.pillar }));
vi.mock("@/interface/admin/socials/socials-admin-read", () => ({ getAdminSocialLink: reads.social }));
vi.mock("@/interface/admin/board/board-members-admin-read", () => ({ getAdminBoardMember: reads.board }));
vi.mock("@/interface/admin/impact/impact-admin-read", () => ({ getAdminImpactStat: reads.impact }));
vi.mock("@/interface/admin/sponsors/sponsors-admin-read", () => ({ getAdminSponsor: reads.sponsor }));
vi.mock("@/interface/admin/testimonials/testimonials-admin-read", () => ({ getAdminTestimonial: reads.testimonial }));
for (const area of ["faqs", "commands", "pillars", "socials", "board", "impact", "sponsors", "testimonials"]) {
  vi.mock(`@/interface/admin/${area}/actions`, () => new Proxy({}, { get: () => vi.fn() }));
}

import { PageHeader, recordStatus } from "../../../../app/admin/_components/page-header";
import EditBoardMemberPage from "../../../../app/admin/board/[id]/edit/page";
import EditCommandPage from "../../../../app/admin/commands/[id]/edit/page";
import EditFaqPage from "../../../../app/admin/faqs/[id]/edit/page";
import EditImpactStatPage from "../../../../app/admin/impact/[id]/edit/page";
import EditPillarPage from "../../../../app/admin/pillars/[id]/edit/page";
import EditSocialLinkPage from "../../../../app/admin/socials/[id]/edit/page";
import EditSponsorPage from "../../../../app/admin/sponsors/[id]/edit/page";
import EditTestimonialPage from "../../../../app/admin/testimonials/[id]/edit/page";

describe("PageHeader", () => {
  const html = renderToStaticMarkup(
    createElement(PageHeader, {
      title: "Eventos",
      status: "main · 6 publicados",
      description: "Lo que se muestra en el sitio.",
      action: createElement("a", { href: "/admin/events/new" }, "Nuevo evento"),
      back: { href: "/admin", label: "Volver al inicio" },
    }),
  );

  it("puts the title in the display face and the status in mono", () => {
    expect(html).toMatch(/<h1[^>]*font-display[^>]*>Eventos<\/h1>/);
    expect(html).toMatch(/<p[^>]*font-mono[^>]*>main · 6 publicados<\/p>/);
  });

  it("orders the back link, the title, the status, the description, then the action", () => {
    const order = ["Volver al inicio", "Eventos</h1>", "main · 6 publicados", "Lo que se muestra", "Nuevo evento"].map((part) => html.indexOf(part));

    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("leaves out the status, the description and the action when there are none", () => {
    const bare = renderToStaticMarkup(createElement(PageHeader, { title: "Sitio" }));

    expect(bare).toContain("Sitio</h1>");
    expect(bare).not.toContain("font-mono");
    expect(bare).not.toContain("<a ");
  });
});

describe("recordStatus", () => {
  it("joins the record's name and its state, in the record's gender", () => {
    expect(recordStatus("Hackathon", true, "m")).toBe("Hackathon · publicado");
    expect(recordStatus("¿Quién puede participar?", false, "f")).toBe("¿Quién puede participar? · borrador");
    expect(recordStatus("Lanzamiento", true, "f")).toBe("Lanzamiento · publicada");
  });

  it("shortens a long name so the state is never cut off", () => {
    const status = recordStatus("a".repeat(200), true, "m");

    expect(status.endsWith("… · publicado")).toBe(true);
    expect(status.length).toBeLessThan(80);
  });
});

describe("every edit page names its record and its state", () => {
  beforeEach(() => {
    for (const read of Object.values(reads)) read.mockReset();
  });

  const params = { params: Promise.resolve({ id: "x" }) };
  const cases = [
    ["faqs", reads.faq, EditFaqPage, { question: "¿Quién puede participar?", answer: "Todos.", command: null, isPublished: true }, "¿Quién puede participar? · publicada"],
    ["commands", reads.command, EditCommandPage, { command: "eventos", description: "d", output: "o", isPublished: false }, "eventos · borrador"],
    ["pillars", reads.pillar, EditPillarPage, { word: "w", title: "Comunidad", text: "t", image: null, isPublished: true }, "Comunidad · publicado"],
    ["socials", reads.social, EditSocialLinkPage, { platform: "instagram", label: "Instagram", handle: "@aso", url: "https://x.test", note: null, blurb: null, isPublished: false }, "Instagram · borrador"],
    ["board", reads.board, EditBoardMemberPage, { name: "Emilio Jaramillo", role: "Presidente", photo: null, isPublished: true }, "Emilio Jaramillo · publicado"],
    ["impact", reads.impact, EditImpactStatPage, { value: "120", label: "Estudiantes", isPublished: true }, "Estudiantes · publicada"],
    ["sponsors", reads.sponsor, EditSponsorPage, { name: "Acme", url: null, logo: null, isPublished: false }, "Acme · borrador"],
    ["testimonials", reads.testimonial, EditTestimonialPage, { quote: "q", name: "Ana Pérez", role: "r", photo: null, isPublished: true }, "Ana Pérez · publicado"],
  ] as const;

  it.each(cases)("%s", async (_module, read, Page, record, status) => {
    read.mockResolvedValue(record);

    const html = renderToStaticMarkup(await Page(params));

    expect(html).toContain('data-slot="page-header"');
    expect(html).toMatch(new RegExp(`<p[^>]*font-mono[^>]*>${status.replace(/[?¿]/g, "\\$&")}</p>`));
  });
});
