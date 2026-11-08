import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pageMock } = vi.hoisted(() => ({ pageMock: vi.fn() }));

vi.mock("@/interface/forum/event-registration-read", () => ({ getEventRegistrationPage: pageMock }));
vi.mock("@/interface/forum/event-registration", () => ({ registerForEvent: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

import EventRegistrationPage from "../../../../app/inscripciones/[slug]/page";
import EventNotFound from "../../../../app/inscripciones/[slug]/not-found";
import RegistrationLayout from "../../../../app/inscripciones/layout";

const event = { slug: "taller-docker", title: "Taller de Docker", description: null, date: "2026-11-20", datePrecision: "day" as const, hora: "15:00", lugar: "Laboratorio 2" };
const status = (over: Record<string, unknown> = {}) => ({ event, mode: "unl", state: "open", alreadyRegistered: false, capacity: 30, registered: 0, deadline: null, ...over });
const unl = (member: unknown, over: Record<string, unknown> = {}) => ({ kind: "unl", member, status: status(over) });
const open = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ kind: "open", siteKey: undefined, calendarHref: "/api/public/events/taller-docker/calendar.ics", status: status({ mode: "open", ...over }), ...extra });
const none = (extra: Record<string, unknown> = {}) => ({ kind: "none", event, calendarHref: "/api/public/events/taller-docker/calendar.ics", ...extra });
const member = { memberId: "m1", sessionId: "s1", displayName: "Ana Pérez" };

const render = async () => renderToStaticMarkup(await EventRegistrationPage({ params: Promise.resolve({ slug: "taller-docker" }) }));

beforeEach(() => {
  pageMock.mockReset();
});

describe("the event registration page", () => {
  it("lives in the layout's column: no landmark of its own and no private container", async () => {
    pageMock.mockResolvedValue(unl(null));

    const html = await render();

    expect(html).not.toContain("<main");
    expect(html).not.toContain("max-w-xl");
    expect(html).not.toContain("p-6");
    expect(html).toContain("Taller de Docker");
  });

  it.each([
    ["a UNL event", () => unl(null)],
    ["a UNL event with a member", () => unl(member)],
    ["an open event", () => open()],
    ["a free-entry event", () => none()],
  ])("shows no forum chrome for %s: no forum link, no back-to-forum row", async (_label, build) => {
    pageMock.mockResolvedValue(build());

    const html = await render();
    const links = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);

    // The only forum address on the page is the Google sign-in the forum owns.
    expect(links.filter((href) => href?.startsWith("/foro") && !href.startsWith("/foro/auth/google/start"))).toEqual([]);
    expect(html).not.toMatch(/>\s*Foro\s*</);
    expect(html).not.toContain("forum-rail");
    expect(html).not.toContain("data-wide");
  });

  it("asks a visitor to sign in with the forum's one Google button, coming back to this event", async () => {
    pageMock.mockResolvedValue(unl(null));

    const html = await render();
    const button = html.match(/<a [^>]*href="\/foro\/auth\/google\/start[^"]*"[^>]*>.*?<\/a>/)?.[0] ?? "";

    expect(button).toContain('href="/foro/auth/google/start?next=%2Finscripciones%2Ftaller-docker"');
    expect(button).toContain("google-button");
    expect(button).not.toContain("bg-white");
    expect(button).toContain("<svg");
    expect(button).toContain("Entrar con Google");
    expect(html).toContain("volverá a esta página");
    expect(html).not.toContain("vuelva a abrir este enlace");
  });

  it("lays out the event facts as labelled details", async () => {
    pageMock.mockResolvedValue(unl(null, { deadline: new Date("2026-11-18T23:00:00Z") }));

    const html = await render();

    expect(html).toContain("<dl");
    for (const label of ["Fecha", "Hora", "Lugar", "Inscripciones hasta"]) expect(html).toMatch(new RegExp(`<dt[^>]*>${label}</dt>`));
    expect(html).toMatch(/<dt[^>]*>Lugar<\/dt><dd[^>]*>Laboratorio 2<\/dd>/);
    expect(html).not.toContain(">Cupos<");
    expect(html).toMatch(/<dt[^>]*>Inscripciones hasta<\/dt>/);
  });

  it("leaves out the details the event does not have", async () => {
    pageMock.mockResolvedValue({ ...unl(null, { capacity: null }), status: { ...status({ capacity: null }), event: { ...event, hora: null, lugar: null } } });

    const html = await render();

    expect(html).not.toContain(">Lugar<");
    expect(html).not.toContain(">Hora<");
    expect(html).not.toContain("cupos");
    expect(html).toContain(">Fecha<");
  });

  it("shows the event description under the title, and nothing when there is none", async () => {
    pageMock.mockResolvedValue({ ...unl(null), status: { ...status(), event: { ...event, description: "Aprenda a empaquetar su app.\nTraiga su laptop." } } });

    const html = await render();

    expect(html).toMatch(/<p[^>]*data-slot="event-description"[^>]*>Aprenda a empaquetar su app\.\nTraiga su laptop\.<\/p>/);
    expect(html.indexOf("Aprenda a empaquetar")).toBeGreaterThan(html.indexOf("Taller de Docker"));
    expect(html.indexOf("Aprenda a empaquetar")).toBeLessThan(html.indexOf("<dl"));

    pageMock.mockResolvedValue(unl(null));
    expect(await render()).not.toContain("event-description");
  });

  it("says how many seats are left of the total, and nothing when the event has no limit", async () => {
    pageMock.mockResolvedValue(unl(null, { capacity: 60, registered: 48 }));
    expect(await render()).toContain("Quedan 12 de 60 cupos");

    pageMock.mockResolvedValue(unl(null, { capacity: 60, registered: 59 }));
    expect(await render()).toContain("Queda 1 de 60 cupos");

    pageMock.mockResolvedValue(unl(null, { capacity: 60, registered: 60, state: "full" }));
    expect(await render()).toContain("Quedan 0 de 60 cupos");

    pageMock.mockResolvedValue(unl(null, { capacity: null, registered: 48 }));
    expect(await render()).not.toMatch(/Quedan?\b/);
  });

  it("offers the registration to a signed-in member", async () => {
    pageMock.mockResolvedValue(unl(member));

    const html = await render();

    expect(html).toContain("Ana Pérez");
    expect(html).toContain("Inscribirme");
    expect(html).not.toContain("auth/google/start");
  });

  it("says so when the member is already registered or the seats are gone", async () => {
    pageMock.mockResolvedValue(unl(member, { alreadyRegistered: true }));
    expect(await render()).toContain("ya está inscrito");

    pageMock.mockResolvedValue(unl(member, { state: "full" }));
    expect(await render()).toContain("Ya no quedan cupos");
  });

  it("is a 404 for an unknown or non-public event", async () => {
    pageMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the open registration of the same page", () => {
  it("shows the event and the form to someone without a session, with no Google button", async () => {
    pageMock.mockResolvedValue(open({ capacity: 30, registered: 12, deadline: new Date("2026-11-18T23:00:00Z") }));

    const html = await render();

    expect(html).toContain("Taller de Docker");
    expect(html).toContain("Quedan 18 de 30 cupos");
    expect(html).toContain("Inscripciones abiertas");
    expect(html).toMatch(/<dt[^>]*>Inscripciones hasta<\/dt>/);
    expect(html).toContain("<form");
    for (const name of ["name", "email", "career", "semester"]) expect(html).toContain(`name="${name}"`);
    expect(html).toContain("Usamos tus datos solo para esta actividad");
    expect(html).not.toContain("auth/google/start");
    expect(html).not.toContain("Inscribirme como");
    expect(html).not.toMatch(/\busted\b|\bSu inscripción\b/i);
  });

  it("hides the form when the seats are gone and says so, keeping the numbers", async () => {
    pageMock.mockResolvedValue(open({ state: "full", capacity: 2, registered: 2 }));

    const html = await render();

    expect(html).not.toContain("<form");
    expect(html).toContain("Ya no quedan cupos para este evento.");
    expect(html).toContain("Quedan 0 de 2 cupos");
    expect(html).toContain("Cupos agotados");
  });

  it("hides the form when the registration closed", async () => {
    pageMock.mockResolvedValue(open({ state: "closed" }));

    const html = await render();

    expect(html).not.toContain("<form");
    expect(html).toContain("Las inscripciones de este evento ya cerraron.");
    expect(html).toContain("Inscripciones cerradas");
    expect(html).not.toContain("Inscripciones hasta");
  });

  it("shows a working form with the widget key when Turnstile is fully configured", async () => {
    pageMock.mockResolvedValue(open({}, { siteKey: "0x4AAAA-site_key", captchaMisconfigured: false }));

    const html = await render();

    expect(html).toContain("<form");
    expect(html).toContain('name="email"');
    expect(html).not.toContain("no está disponible");
  });

  it("does not offer a form nobody can submit when the Turnstile secret has no site key: it says registration is unavailable and keeps the event", async () => {
    pageMock.mockResolvedValue(open({ capacity: 30, registered: 12 }, { captchaMisconfigured: true }));

    const html = await render();

    expect(html).not.toContain("<form");
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain("Completa la verificación");
    expect(html).toContain("La inscripción no está disponible en este momento.");
    expect(html).toContain("Taller de Docker");
    expect(html).toContain("Quedan 18 de 30 cupos");
  });

  it("is a branch of two nodes, the event and the registration, so it matches the sign-in", async () => {
    pageMock.mockResolvedValue(open());

    const html = await render();

    expect(html).toContain('class="reg-branch');
    expect(html).toMatch(/<aside[^>]*aria-label="Inscripción"/);
    expect(html).toContain("<h1");
    expect(html).toMatch(/<h2[^>]*>Inscríbete<\/h2>/);
  });
});

describe("an event without registration", () => {
  it("explains that nobody has to sign up and offers the calendar", async () => {
    pageMock.mockResolvedValue(none());

    const html = await render();

    expect(html).toContain("Taller de Docker");
    expect(html).toContain("pase libre");
    expect(html).toContain("no necesitas inscribirte");
    expect(html).toMatch(/<a [^>]*href="\/api\/public\/events\/taller-docker\/calendar\.ics"[^>]*>(?:(?!<\/a>).)*Añadir al calendario/);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("auth/google/start");
    expect(html).not.toContain("Quedan");
  });

  it("offers no calendar link when there is nothing to add", async () => {
    pageMock.mockResolvedValue(none({ calendarHref: null }));

    const html = await render();

    expect(html).toContain("pase libre");
    expect(html).not.toContain("calendar.ics");
  });
});

describe("the event 404", () => {
  it("is the shared not-found state about the registration, without forum wording", () => {
    const html = renderToStaticMarkup(EventNotFound());

    expect(html).toContain('data-slot="not-found-state"');
    expect(html).toContain("No encontrado");
    expect(html).toContain("inscripción");
    expect(html).not.toContain("categoría");
    expect(html).not.toContain("hilo");
    expect(html).not.toContain("en el foro");
    expect(html).not.toContain('href="/foro"');
  });
});

describe("the registration layout", () => {
  const layout = () => renderToStaticMarkup(RegistrationLayout({ children: "contenido" }));

  it("is its own shell: a skip link, the brand, the theme toggle and one main landmark", () => {
    const html = layout();

    expect(html).toContain('href="#registration-main"');
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain("contenido");
    expect(html).toContain("ASO Computación");
  });

  it("has no forum rail, no forum name and no link into the forum", () => {
    const html = layout();

    expect(html).not.toMatch(/href="\/foro/);
    expect(html).not.toContain("Foro");
    expect(html).not.toContain("forum-rail");
  });
});

describe("the route owns its styles", () => {
  const dir = join(__dirname, "..", "..", "..", "..", "app", "inscripciones");
  const files = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(join(folder, entry.name)) : [join(folder, entry.name)]));

  it("depends on nothing under app/foro: no forum.css, no forum component", () => {
    for (const file of files(dir).filter((name) => /\.(tsx?|css)$/.test(name))) {
      const specifiers = [...readFileSync(file, "utf8").matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((match) => match[1] ?? "");

      expect(specifiers.filter((specifier) => /forum\.css|(^|\/)foro(\/|$)/.test(specifier)), file).toEqual([]);
    }
  });

  it("defines the .reg-branch the page uses, and the forum stylesheet no longer does", () => {
    const own = files(dir).filter((name) => name.endsWith(".css"));

    expect(own.length).toBeGreaterThan(0);
    expect(own.map((file) => readFileSync(file, "utf8")).join("\n")).toContain(".reg-branch");
    expect(readFileSync(join(dir, "..", "foro", "forum.css"), "utf8")).not.toContain(".reg-branch");
  });
});
