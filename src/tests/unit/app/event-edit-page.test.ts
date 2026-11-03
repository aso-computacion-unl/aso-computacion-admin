import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { eventMock } = vi.hoisted(() => ({ eventMock: vi.fn() }));

vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvent: eventMock }));
vi.mock("@/interface/admin/events/actions", () => ({ updateEvent: vi.fn() }));
vi.mock("@/interface/admin/events/event-form-values", () => ({ eventToFormValues: () => ({}) }));
// The form and the gallery have their own tests; here they only stand in for their sections.
vi.mock("../../../../app/admin/events/_components/event-form", () => ({ EventForm: () => createElement("form", null, "event form") }));
vi.mock("../../../../app/admin/events/_components/photo-gallery", () => ({ PhotoGallery: () => createElement("section", null, "photo gallery") }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { SectionJumps } from "../../../../app/admin/_components/section-jumps";
import EditEventPage from "../../../../app/admin/events/[id]/edit/page";

const event = (over: Record<string, unknown> = {}) => ({ slug: "taller", isPublished: true, registrationMode: "none", photos: [{ id: "p1" }, { id: "p2" }], ...over });
const render = async () => renderToStaticMarkup(await EditEventPage({ params: Promise.resolve({ id: "e1" }) }));

beforeEach(() => {
  eventMock.mockReset();
});

describe("SectionJumps", () => {
  it("is a phone-only navigation of in-page links", () => {
    const html = renderToStaticMarkup(createElement(SectionJumps, { label: "Secciones", items: [{ href: "#datos", label: "Datos" }, { href: "#fotos", label: "Fotos (2)" }] }));

    expect(html).toMatch(/^<nav[^>]*aria-label="Secciones"/);
    expect(html).toMatch(/^<nav[^>]*lg:hidden/);
    expect(html).toContain('href="#datos"');
    expect(html).toContain('href="#fotos"');
    expect(html).toContain("Fotos (2)");
  });
});

describe("the event edit page", () => {
  it("lets a phone jump straight to the photos, counting them, instead of scrolling past the whole form", async () => {
    eventMock.mockResolvedValue(event());

    const html = await render();

    expect(html).toMatch(/<a [^>]*href="#fotos"[^>]*>Fotos \(2\)<\/a>/);
    expect(html).toMatch(/id="fotos"[^>]*>(?:(?!<\/div>).)*photo gallery/);
    expect(html).toContain('id="datos"');
    // The jumps come before the form, so they are on the first screen.
    expect(html.indexOf('href="#fotos"')).toBeLessThan(html.indexOf("event form"));
  });

  it("adds the registrations to the jumps only when the event takes them", async () => {
    eventMock.mockResolvedValue(event());
    expect(await render()).not.toContain('href="#inscripciones"');

    eventMock.mockResolvedValue(event({ registrationMode: "unl" }));
    const html = await render();

    expect(html).toContain('href="#inscripciones"');
    expect(html).toContain('id="inscripciones"');
  });

  it("is a 404 for an unknown event", async () => {
    eventMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
