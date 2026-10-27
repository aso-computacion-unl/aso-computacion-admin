import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pageMock } = vi.hoisted(() => ({ pageMock: vi.fn() }));

vi.mock("@/interface/forum/event-registration-read", () => ({ getEventRegistrationPage: pageMock }));
vi.mock("@/interface/forum/event-registration", () => ({ registerForEvent: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import EventRegistrationPage from "../../../../app/foro/eventos/[slug]/page";
import EventNotFound from "../../../../app/foro/eventos/[slug]/not-found";

const event = { slug: "taller-docker", title: "Taller de Docker", date: "2026-11-20", datePrecision: "day" as const, hora: "15:00", lugar: "Laboratorio 2" };
const status = (over: Record<string, unknown> = {}) => ({ event, mode: "unl", state: "open", alreadyRegistered: false, capacity: 30, deadline: null, ...over });
const member = { memberId: "m1", sessionId: "s1", displayName: "Ana Pérez" };

const render = async () => renderToStaticMarkup(await EventRegistrationPage({ params: Promise.resolve({ slug: "taller-docker" }) }));

beforeEach(() => {
  pageMock.mockReset();
});

describe("the forum event registration page", () => {
  it("lives in the forum column: no landmark of its own and no private container", async () => {
    pageMock.mockResolvedValue({ member: null, status: status() });

    const html = await render();

    expect(html).not.toContain("<main");
    expect(html).not.toContain("max-w-xl");
    expect(html).not.toContain("p-6");
    expect(html).toContain("Taller de Docker");
  });

  it("offers a way back to the forum, like the category and thread pages", async () => {
    pageMock.mockResolvedValue({ member: null, status: status() });

    expect(await render()).toMatch(/<a [^>]*href="\/foro"[^>]*>(?:(?!<\/a>).)*Foro/);
  });

  it("asks a visitor to sign in with the forum's one Google button, coming back to this event", async () => {
    pageMock.mockResolvedValue({ member: null, status: status() });

    const html = await render();
    const button = html.match(/<a [^>]*href="\/foro\/auth\/google\/start[^"]*"[^>]*>.*?<\/a>/)?.[0] ?? "";

    expect(button).toContain('href="/foro/auth/google/start?next=%2Fforo%2Feventos%2Ftaller-docker"');
    expect(button).toContain("google-button");
    expect(button).not.toContain("bg-white");
    expect(button).toContain("<svg");
    expect(button).toContain("Entrar con Google");
    expect(html).toContain("volverá a esta página");
    expect(html).not.toContain("vuelva a abrir este enlace");
  });

  it("lays out the event facts as labelled details, with the seats when there is a limit", async () => {
    pageMock.mockResolvedValue({ member: null, status: status({ deadline: new Date("2026-11-18T23:00:00Z") }) });

    const html = await render();

    expect(html).toContain("<dl");
    for (const label of ["Fecha", "Hora", "Lugar", "Cupos", "Inscripciones hasta"]) expect(html).toMatch(new RegExp(`<dt[^>]*>${label}</dt>`));
    expect(html).toMatch(/<dt[^>]*>Lugar<\/dt><dd[^>]*>Laboratorio 2<\/dd>/);
    expect(html).toMatch(/<dt[^>]*>Cupos<\/dt><dd[^>]*>30<\/dd>/);
    expect(html).toMatch(/<dt[^>]*>Inscripciones hasta<\/dt>/);
  });

  it("leaves out the details the event does not have", async () => {
    pageMock.mockResolvedValue({ member: null, status: { ...status({ capacity: null }), event: { ...event, hora: null, lugar: null } } });

    const html = await render();

    expect(html).not.toContain(">Lugar<");
    expect(html).not.toContain(">Hora<");
    expect(html).not.toContain(">Cupos<");
    expect(html).toContain(">Fecha<");
  });

  it("offers the registration to a signed-in member", async () => {
    pageMock.mockResolvedValue({ member, status: status() });

    const html = await render();

    expect(html).toContain("Ana Pérez");
    expect(html).toContain("Inscribirme");
    expect(html).not.toContain("auth/google/start");
  });

  it("says so when the member is already registered or the seats are gone", async () => {
    pageMock.mockResolvedValue({ member, status: status({ alreadyRegistered: true }) });
    expect(await render()).toContain("ya está inscrito");

    pageMock.mockResolvedValue({ member, status: status({ state: "full" }) });
    expect(await render()).toContain("Ya no quedan cupos");
  });

  it("is a 404 for an event without a forum registration", async () => {
    pageMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the event 404", () => {
  it("is the shared not-found state in the forum face, about the registration, linking back to the forum", () => {
    const html = renderToStaticMarkup(EventNotFound());

    expect(html).toContain('data-slot="not-found-state"');
    expect(html).not.toContain("font-display");
    expect(html).toContain("No encontrado");
    expect(html).toContain("inscripción");
    expect(html).not.toContain("categoría");
    expect(html).not.toContain("hilo");
    expect(html).toContain('href="/foro"');
  });
});
