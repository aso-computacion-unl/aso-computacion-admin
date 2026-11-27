import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { eventMock } = vi.hoisted(() => ({ eventMock: vi.fn() }));

vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvent: eventMock }));
vi.mock("@/interface/admin/events/actions", () => ({ updateEvent: vi.fn() }));
// The real form values carry a placeholder kind ("announcement") that is never the stored one (R2-001).
vi.mock("@/interface/admin/events/event-form-values", () => ({ eventToFormValues: () => ({ eventKind: "announcement" }) }));
// The form and the gallery have their own tests; here they only stand in for their sections. The form puts the page's
// nothing of the page in its side column.
vi.mock("../../../../app/admin/events/_components/event-form", () => ({
  EventForm: ({ registrationHref }: { registrationHref?: string }) =>
    createElement("form", { "data-registration-href": registrationHref }, "event form", createElement("div", { "data-slot": "publish-side" })),
}));
vi.mock("../../../../app/admin/events/_components/photo-gallery", () => ({ PhotoGallery: () => createElement("section", null, "photo gallery") }));
vi.mock("../../../../app/admin/events/_components/event-created-arrival", () => ({ EventCreatedArrival: () => createElement("div", { "data-testid": "created-arrival" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { SectionJumps } from "../../../../app/admin/_components/section-jumps";
import EditEventPage from "../../../../app/admin/events/[id]/edit/page";

const event = (over: Record<string, unknown> = {}) => ({
  title: "Taller de Git",
  slug: "taller",
  isPublished: true,
  date: "2099-11-28",
  datePrecision: "day",
  registrationMode: "none",
  registrationCapacity: null,
  registrationDeadline: null,
  photos: [{ id: "p1" }, { id: "p2" }],
  ...over,
});
const panel = (html: string) => /<section[^>]*id="inscripciones"[^>]*>(.*?)<\/section>/.exec(html)?.[1] ?? "";
const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(([, href, text]) => `${text} → ${href}`);
const render = async (searchParams: Record<string, string | string[]> = {}) =>
  renderToStaticMarkup(await EditEventPage({ params: Promise.resolve({ id: "e1" }), searchParams: Promise.resolve(searchParams) }));

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
  it("is titled with the event's name, and the slug and state go in the status line", async () => {
    eventMock.mockResolvedValue(event());

    const html = await render();

    expect(html).toMatch(/<h1[^>]*>Taller de Git<\/h1>/);
    expect(html).toMatch(/<p[^>]*font-mono[^>]*>taller · publicado<\/p>/);
  });

  it("lets a phone jump straight to the photos, counting them, instead of scrolling past the whole form", async () => {
    eventMock.mockResolvedValue(event());

    const html = await render();

    expect(html).toMatch(/<a [^>]*href="#fotos"[^>]*>Fotos \(2\)<\/a>/);
    expect(html).toMatch(/id="fotos"[^>]*>(?:(?!<\/div>).)*photo gallery/);
    expect(html).toContain('id="datos"');
    // The jumps come before the form, so they are on the first screen.
    expect(html.indexOf('href="#fotos"')).toBeLessThan(html.indexOf("event form"));
  });

  it("owns the two columns (08): Fotos beside the form in the content column, never inside it; Inscripción in the side column", async () => {
    eventMock.mockResolvedValue(event({ registrationMode: "unl" }));

    const html = await render();
    const form = /<form[^>]*>.*<\/form>/.exec(html)![0];
    const columns = /<div id="datos"[^>]*>(.*)<\/div>/.exec(html)![1]!;

    // The photos' own forms cannot nest in the event's.
    expect(form).not.toContain("photo gallery");
    expect(columns).toContain("photo gallery");
    expect(columns.indexOf("event form")).toBeLessThan(columns.indexOf("photo gallery"));
    // Inscripción is in the content column under Fotos, outside the form, so the sticky side column fits a short screen.
    expect(form).not.toContain('id="inscripciones"');
    expect(columns.indexOf("photo gallery")).toBeLessThan(columns.indexOf('id="inscripciones"'));
    expect(panel(html)).toMatch(/<h2[^>]*>Inscripción<\/h2>/);
  });

  it("adds the registrations to the jumps only when the event takes them", async () => {
    eventMock.mockResolvedValue(event());
    expect(await render()).not.toContain('href="#inscripciones"');

    eventMock.mockResolvedValue(event({ registrationMode: "unl" }));
    const html = await render();

    expect(html).toContain('href="#inscripciones"');
    expect(html).toContain('id="inscripciones"');
  });

  it("shows the registration read-only (S3), with «Gestionar inscripción» and the registrants", async () => {
    eventMock.mockResolvedValue(event({ registrationMode: "open", registrationCapacity: 40, registrationDeadline: new Date("2099-11-27T23:00:00.000Z") }));

    const block = panel(await render());

    expect(block).toMatch(/Inscripción: Formulario abierto · 40 cupos · cierra 27 nov 2099/);
    expect(links(block)).toEqual(["Gestionar inscripción → /admin/registrations/e1/edit", "Ver inscripciones → /admin/events/e1/registrations"]);
    expect(block).not.toContain("<input");
  });

  it("shows the kind read-only, from the stored registration and not the form's placeholder (event-kinds S2)", async () => {
    eventMock.mockResolvedValue(event());
    expect(panel(await render())).toMatch(/<p[^>]*>Tipo de evento: Evento<\/p>/);

    for (const registrationMode of ["unl", "open"]) {
      eventMock.mockResolvedValue(event({ registrationMode }));
      const html = await render();

      expect(panel(html)).toMatch(/<p[^>]*>Tipo de evento: Evento con inscripción<\/p>/);
      expect(html).not.toContain('name="eventKind"');
    }
  });

  it("tells the form where the registration is changed, so a date refused for the cierre can point there", async () => {
    eventMock.mockResolvedValue(event({ registrationMode: "open" }));
    expect(await render()).toContain('data-registration-href="/admin/registrations/e1/edit"');

    eventMock.mockResolvedValue(event());
    expect(await render()).not.toContain("data-registration-href");
  });

  it("says a registration without seats or deadline has no limit and closes with the event", async () => {
    eventMock.mockResolvedValue(event({ registrationMode: "unl" }));

    expect(panel(await render())).toMatch(/Inscripción: Cuenta UNL · sin límite de cupos(?!.*cierra)/);
  });

  it("offers no registration link for an upcoming announcement: it never takes one (event-kinds S1)", async () => {
    eventMock.mockResolvedValue(event());

    const html = await render();
    const block = panel(html);

    expect(block).toContain("Sin inscripción");
    expect(links(block)).toEqual([]);
    expect(html).not.toContain("Crear inscripción");
  });

  it("offers no registration link for a past event without one", async () => {
    eventMock.mockResolvedValue(event({ date: "2020-01-15" }));

    const block = panel(await render());

    expect(block).toContain("Sin inscripción");
    expect(links(block)).toEqual([]);
  });

  it("welcomes a just-created event (?creado=1) with the arrival, and a plain visit without it", async () => {
    eventMock.mockResolvedValue(event());

    expect(await render({ creado: "1" })).toContain('data-testid="created-arrival"');
    expect(await render()).not.toContain('data-testid="created-arrival"');
    expect(await render({ creado: "0" })).not.toContain('data-testid="created-arrival"');
    expect(await render({ creado: ["1", "1"] })).not.toContain('data-testid="created-arrival"');
  });

  it("is a 404 for an unknown event", async () => {
    eventMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
