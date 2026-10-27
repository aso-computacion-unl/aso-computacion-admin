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

const event = { slug: "taller-docker", title: "Taller de Docker", date: new Date("2026-11-20T15:00:00Z"), datePrecision: "day" as const, hora: "15:00", lugar: "Laboratorio 2" };
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

  it("asks a visitor to sign in with the same white Google button as the forum gate", async () => {
    pageMock.mockResolvedValue({ member: null, status: status() });

    const html = await render();
    const button = html.match(/<a [^>]*href="\/foro\/auth\/google\/start"[^>]*>.*?<\/a>/)?.[0] ?? "";

    expect(button).toContain("bg-white");
    expect(button).toContain("text-[#1f1f1f]");
    expect(button).toContain("<svg");
    expect(button).toContain("Entrar con Google");
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
  it("says the event has no forum registration page, and links back to the forum", () => {
    const html = renderToStaticMarkup(EventNotFound());

    expect(html).toContain("No encontrado");
    expect(html).toContain("inscripción");
    expect(html).not.toContain("categoría");
    expect(html).not.toContain("hilo");
    expect(html).toContain('href="/foro"');
  });
});
