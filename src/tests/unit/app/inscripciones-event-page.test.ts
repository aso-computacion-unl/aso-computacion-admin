import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pageMock } = vi.hoisted(() => ({ pageMock: vi.fn() }));

vi.mock("@/interface/forum/event-registration-read", () => ({ getEventRegistrationPage: pageMock }));
vi.mock("@/interface/forum/event-registration", () => ({ registerForEvent: vi.fn() }));
vi.mock("@/interface/event-registration/cancel-registration-action", () => ({ cancelEventRegistration: vi.fn() }));
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
const unl = (member: unknown, over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ kind: "unl", member, loginAvailable: true, remindersOn: false, calendarHref: "/api/public/events/taller-docker/calendar.ics", status: status(over), ...extra });
const open = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ kind: "open", siteKey: undefined, calendarHref: "/api/public/events/taller-docker/calendar.ics", status: status({ mode: "open", ...over }), ...extra });
const none = (extra: Record<string, unknown> = {}) => ({ kind: "none", event, calendarHref: "/api/public/events/taller-docker/calendar.ics", ...extra });
const member = { memberId: "m1", sessionId: "s1", displayName: "Ana Pérez" };

const render = async (query: { error?: string | string[] } = {}) =>
  renderToStaticMarkup(await EventRegistrationPage({ params: Promise.resolve({ slug: "taller-docker" }), searchParams: Promise.resolve(query) }));

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

  it("asks a visitor to sign in with the forum's one Google button, in the stub, coming back to this event", async () => {
    pageMock.mockResolvedValue(unl(null));

    const html = await render();
    const button = html.match(/<a [^>]*href="\/foro\/auth\/google\/start[^"]*"[^>]*>.*?<\/a>/)?.[0] ?? "";
    const stub = html.match(/<section class="ticket-stub"[\s\S]*<\/section>/)?.[0] ?? "";

    expect(button).toContain('href="/foro/auth/google/start?next=%2Finscripciones%2Ftaller-docker"');
    expect(button).toContain("google-button");
    expect(button).not.toContain("bg-white");
    expect(button).toContain("<svg");
    expect(button).toContain("Entrar con Google");
    expect(stub).toContain(button);
    expect(stub).toContain("@unl.edu.ec");
    expect(html).toContain("volverá a esta página");
    expect(html).not.toContain("vuelva a abrir este enlace");
  });

  it("keeps the sign-in quiet: one line, one button, no form and no reservation until the visitor is in", async () => {
    pageMock.mockResolvedValue(unl(null));

    const html = await render();
    const stub = html.match(/<section class="ticket-stub"[\s\S]*<\/section>/)?.[0] ?? "";

    expect(html).toContain('data-mode="unl"');
    expect(stub.match(/<a /g)).toHaveLength(1);
    expect(stub).not.toContain("<form");
    expect(stub).not.toContain("<button");
    expect(stub).not.toContain("Reservar mi cupo");
  });

  it("tells the event's facts on the ticket: date stub, hour and place, and the title as the one heading", async () => {
    pageMock.mockResolvedValue(unl(null, { deadline: new Date("2026-11-18T23:00:00Z") }));

    const html = await render();
    const stub = html.match(/<div class="ticket-date"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? "";

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(stub).toMatch(/ticket-dow">Vie</);
    expect(stub).toMatch(/ticket-day">20</);
    expect(stub).toContain("nov 2026");
    expect(stub).toContain("15:00");
    expect(html).toMatch(/<time datetime="2026-11-20">vie 20 nov 2026<\/time>/i);
    expect(html).toMatch(/<ul class="ticket-facts">[\s\S]*15:00[\s\S]*Laboratorio 2/);
    expect(html).toContain("cierra el 18 nov 2026, 18:00 (hora de Ecuador)");
  });

  it("leaves out the details the event does not have", async () => {
    pageMock.mockResolvedValue({ ...unl(null, { capacity: null }), status: { ...status({ capacity: null }), event: { ...event, hora: null, lugar: null } } });

    const html = await render();

    expect(html).not.toContain("ticket-facts");
    expect(html).not.toContain("ticket-time");
    expect(html).not.toContain("cupos");
    expect(html).not.toContain("ticket-seats");
    expect(html).toContain('data-seats="none"');
    expect(html).toContain("ticket-day");
  });

  it("shows the event description under the title, and nothing when there is none", async () => {
    pageMock.mockResolvedValue({ ...unl(null), status: { ...status(), event: { ...event, description: "Aprenda a empaquetar su app.\nTraiga su laptop." } } });

    const html = await render();

    expect(html).toMatch(/<p[^>]*data-slot="event-description"[^>]*>Aprenda a empaquetar su app\.\nTraiga su laptop\.<\/p>/);
    expect(html.indexOf("Aprenda a empaquetar")).toBeGreaterThan(html.indexOf("Taller de Docker"));
    expect(html.indexOf("Aprenda a empaquetar")).toBeLessThan(html.indexOf("ticket-facts"));

    pageMock.mockResolvedValue(unl(null));
    expect(await render()).not.toContain("event-description");
  });

  it("says how many seats are left with a meter, and nothing when the event has no limit", async () => {
    pageMock.mockResolvedValue(unl(null, { capacity: 60, registered: 48 }));
    let html = await render();
    expect(html).toContain("Quedan 12 cupos");
    expect(html).toContain("48 de 60 inscritos");
    expect(html).toContain('<div class="ticket-meter" aria-hidden="true"><i style="width:80%"></i></div>');

    pageMock.mockResolvedValue(unl(null, { capacity: 60, registered: 59 }));
    expect(await render()).toContain("Queda 1 cupo");

    pageMock.mockResolvedValue(unl(null, { capacity: 60, registered: 60, state: "full" }));
    html = await render();
    expect(html).toContain("Quedan 0 cupos");
    expect(html).toContain('style="width:100%"');

    pageMock.mockResolvedValue(unl(null, { capacity: null, registered: 48 }));
    html = await render();
    expect(html).not.toMatch(/Quedan?\b/);
    expect(html).not.toContain("ticket-meter");
  });

  it("offers the one-click reservation to a signed-in member, who sees their name and no sign-in", async () => {
    pageMock.mockResolvedValue(unl(member));

    const html = await render();
    const stub = html.match(/<section class="ticket-stub"[\s\S]*<\/section>/)?.[0] ?? "";

    expect(stub).toContain("Ana Pérez");
    expect(stub).toMatch(/<button[^>]*class="ticket-cta"[^>]*>Reservar mi cupo/);
    expect(html).not.toContain("Inscribirme");
    expect(html).not.toContain("auth/google/start");
    expect(html).not.toContain("<form");
  });

  it("promises a reminder by email to a registered member only when reminders are on, and says there is no confirmation email otherwise", async () => {
    pageMock.mockResolvedValue({ ...unl(member, { alreadyRegistered: true }), remindersOn: true });

    const on = await render();

    expect(on).toContain("unos días antes del evento le enviaremos un recordatorio");
    expect(on).not.toContain("no enviamos correo de confirmación");

    pageMock.mockResolvedValue({ ...unl(member, { alreadyRegistered: true }), remindersOn: false });

    const off = await render();

    expect(off).toContain("no enviamos correo de confirmación");
    expect(off).not.toContain("le enviaremos un recordatorio");
  });

  it("D7: offers a registered member the way to cancel (a full event included: that is what frees the seat), and nobody else", async () => {
    pageMock.mockResolvedValue(unl(member, { alreadyRegistered: true }));
    expect(await render()).toContain("Cancelar mi inscripción");

    pageMock.mockResolvedValue(unl(member, { alreadyRegistered: true, state: "full" }));
    expect(await render()).toContain("Cancelar mi inscripción");

    // Once registration closed the server would refuse: the page does not offer it, and says who to write to.
    pageMock.mockResolvedValue(unl(member, { alreadyRegistered: true, state: "closed" }));

    const closed = await render();

    expect(closed).not.toContain("Cancelar mi inscripción");
    expect(closed).toContain("directiva de ASO");

    for (const other of [unl(member), unl(null), unl(member, { state: "full" }), unl(null, { state: "closed" }), open(), none()]) {
      pageMock.mockResolvedValue(other);
      expect(await render()).not.toContain("Cancelar mi inscripción");
    }
  });

  it("says so when the member is already registered, with the calendar, or when the seats are gone", async () => {
    pageMock.mockResolvedValue(unl(member, { alreadyRegistered: true }));
    let html = await render();
    expect(html).toContain("ya está inscrito");
    expect(html).toMatch(/<a [^>]*href="\/api\/public\/events\/taller-docker\/calendar\.ics"[^>]*>(?:(?!<\/a>).)*Añadir al calendario/);
    expect(html).not.toContain("Reservar mi cupo");

    pageMock.mockResolvedValue({ ...unl(member, { alreadyRegistered: true }), calendarHref: null });
    expect(await render()).not.toContain("calendar.ics");

    pageMock.mockResolvedValue(unl(member, { state: "full" }));
    html = await render();
    expect(html).toContain("Ya no quedan cupos");
    expect(html).not.toContain("Reservar mi cupo");

    pageMock.mockResolvedValue(unl(null, { state: "closed" }));
    html = await render();
    expect(html).toContain("Las inscripciones de este evento ya cerraron.");
    expect(html).not.toContain("auth/google/start");
  });

  describe("S8: the Google login is not configured on this server", () => {
    it("says the UNL registration is not available right now to a visitor, instead of a sign-in that cannot work", async () => {
      pageMock.mockResolvedValue(unl(null, {}, { loginAvailable: false }));

      const html = await render();
      const stub = html.match(/<section class="ticket-stub"[\s\S]*<\/section>/)?.[0] ?? "";

      expect(stub).toMatch(/<p role="status" class="stub-closed">La inscripción con cuenta UNL no está disponible en este momento\./);
      expect(html).not.toContain("auth/google");
      expect(html).not.toContain("Entrar con Google");
      expect(html).not.toContain("Reservar mi cupo");
      expect(html).toContain("Taller de Docker");
      expect(html).toContain("Quedan 30 cupos");
    });

    it("still lets someone who is already signed in reserve, and still tells a registered member they are in", async () => {
      pageMock.mockResolvedValue(unl(member, {}, { loginAvailable: false }));
      expect(await render()).toContain("Reservar mi cupo");

      pageMock.mockResolvedValue(unl(member, { alreadyRegistered: true }, { loginAvailable: false }));
      expect(await render()).toContain("Usted ya está inscrito en este evento.");
    });

    it("keeps saying a full or closed event is full or closed before anything about the login", async () => {
      pageMock.mockResolvedValue(unl(null, { state: "closed" }, { loginAvailable: false }));

      const html = await render();

      expect(html).toContain("Las inscripciones de este evento ya cerraron.");
      expect(html).not.toContain("no está disponible en este momento");
    });

    it("does not touch the open form, which has no Google login", async () => {
      pageMock.mockResolvedValue(open());

      expect(await render()).not.toContain("no está disponible en este momento");
    });
  });

  describe("D5: a failed sign-in comes back to this page and is told in registration words", () => {
    it.each(["unavailable", "failed", "denied", "verification"])("shows %s as an alert above the sign-in, with a button to try again, and never says foro", async (code) => {
      pageMock.mockResolvedValue(unl(null));

      const html = await render({ error: code });
      const stub = html.match(/<section class="ticket-stub"[\s\S]*<\/section>/)?.[0] ?? "";
      const alert = stub.match(/<p role="alert"[\s\S]*?<\/p>/)?.[0] ?? "";

      expect(alert).not.toBe("");
      expect(alert).not.toMatch(/foro/i);
      expect(stub.indexOf(alert)).toBeLessThan(stub.indexOf("auth/google/start"));
      expect(stub).toContain("Intentar de nuevo");
      expect(stub).not.toContain("Entrar con Google");
      expect(stub).toContain('href="/foro/auth/google/start?next=%2Finscripciones%2Ftaller-docker"');
    });

    it("explains a refused account by pointing to the institutional one", async () => {
      pageMock.mockResolvedValue(unl(null));

      expect(await render({ error: "denied" })).toContain("Esa cuenta no puede entrar. Use su correo institucional @unl.edu.ec.");
    });

    it.each([{ error: "suspended" }, { error: "<script>" }, { error: ["denied", "failed"] }, {}])("ignores an unknown or forum-only code (%j): the plain sign-in", async (query) => {
      pageMock.mockResolvedValue(unl(null));

      const html = await render(query);

      expect(html).not.toContain('role="alert"');
      expect(html).toContain("Entrar con Google");
    });

    it("does not show the problem to someone signed in or on an event that offers no sign-in", async () => {
      pageMock.mockResolvedValue(unl(member));
      expect(await render({ error: "denied" })).not.toContain('role="alert"');

      pageMock.mockResolvedValue(unl(null, {}, { loginAvailable: false }));
      expect(await render({ error: "denied" })).not.toContain('role="alert"');
    });
  });

  it("is a 404 for an unknown or non-public event", async () => {
    pageMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("the open registration of the same page", () => {
  it("shows the event and the form in the stub to someone without a session, with no Google button", async () => {
    pageMock.mockResolvedValue(open({ capacity: 30, registered: 12, deadline: new Date("2026-11-18T23:00:00Z") }));

    const html = await render();

    expect(html).toContain('data-mode="open"');
    expect(html).toContain("Taller de Docker");
    expect(html).toContain("Quedan 18 cupos");
    expect(html).toContain("12 de 30 inscritos · cierra el 18 nov 2026, 18:00");
    expect(html).toContain("Inscripciones abiertas");
    expect(html.match(/<section class="ticket-stub"[\s\S]*<form/)).not.toBeNull();
    for (const name of ["name", "email", "institution", "career", "semester"]) expect(html).toContain(`name="${name}"`);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Reservar mi cupo/);
    expect(html).toContain("Usamos sus datos solo para esta actividad");
    expect(html).not.toContain("auth/google/start");
    expect(html).not.toContain("Inscribirme");
    expect(html).not.toMatch(/\busted\b|\bSu inscripción\b/i);
  });

  it("says the form's last field is the optional ciclo", async () => {
    pageMock.mockResolvedValue(open());

    expect(await render()).toMatch(/<label[^>]*>Ciclo \(opcional\)<\/label>/);
  });

  it("hides the form when the seats are gone and says so, keeping the numbers", async () => {
    pageMock.mockResolvedValue(open({ state: "full", capacity: 2, registered: 2 }));

    const html = await render();

    expect(html).not.toContain("<form");
    expect(html).toContain("Ya no quedan cupos para este evento.");
    expect(html).toContain("Quedan 0 cupos");
    expect(html).toContain("2 de 2 inscritos");
    expect(html).toContain("Cupos agotados");
  });

  it("hides the form when the registration closed", async () => {
    pageMock.mockResolvedValue(open({ state: "closed" }));

    const html = await render();

    expect(html).not.toContain("<form");
    expect(html).toContain("Las inscripciones de este evento ya cerraron.");
    expect(html).toContain("Inscripciones cerradas");
    expect(html).not.toContain("cierra el");
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
    expect(html).toContain("Quedan 18 cupos");
  });

  it("is one ticket: the event on paper, a perforation, and the tear-off labelled as the registration", async () => {
    pageMock.mockResolvedValue(open());

    const html = await render();

    expect(html).toContain('class="ticket"');
    expect(html).toContain('class="ticket-perf"');
    expect(html).toMatch(/<section class="ticket-stub" aria-label="Inscripción">/);
    expect(html).not.toContain("reg-branch");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
});

describe("an event without registration", () => {
  it("is free entry: it says so on the ticket, offers the calendar in the stub and has nothing to fill in", async () => {
    pageMock.mockResolvedValue(none());

    const html = await render();
    const stub = html.match(/<section class="ticket-stub"[\s\S]*<\/section>/)?.[0] ?? "";

    expect(html).toContain('data-mode="none"');
    expect(html).toContain("Taller de Docker");
    expect(html).toMatch(/<p class="ticket-chip">Entrada libre<\/p>/);
    expect(stub).toContain("No necesita inscribirse: solo llegue.");
    expect(stub).toMatch(/<a [^>]*href="\/api\/public\/events\/taller-docker\/calendar\.ics"[^>]*>(?:(?!<\/a>).)*Añadir al calendario/);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("auth/google/start");
    expect(html).not.toContain("Quedan");
    expect(html).not.toContain("ticket-meter");
  });

  it("offers no calendar link when there is nothing to add", async () => {
    pageMock.mockResolvedValue(none({ calendarHref: null }));

    const html = await render();

    expect(html).toContain("Entrada libre");
    expect(html).toContain("No necesita inscribirse");
    expect(html).not.toContain("calendar.ics");
    expect(html).not.toContain("Guarde la fecha");
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
    expect(html).not.toContain('href="/foro');
    expect(html).toContain('href="/inscripciones"');
    expect(html).toContain("Ver las inscripciones abiertas");
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

  it("D8: its own top bar is named Inscripciones and its brand leads to the list, the same on every page of the route", () => {
    const html = layout();
    const bar = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";

    expect(bar).toMatch(/<a [^>]*href="\/inscripciones"[^>]*>[\s\S]*?Inscripciones<\/span><\/a>/);
    expect(bar).toContain("Inscripciones de ASO Computación, inicio");
    expect(bar).not.toMatch(/foro/i);
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

  it("defines the .ticket and the .pass the route uses, and the forum stylesheet defines neither", () => {
    const own = files(dir).filter((name) => name.endsWith(".css"));
    const css = own.map((file) => readFileSync(file, "utf8")).join("\n");
    const forum = readFileSync(join(dir, "..", "foro", "forum.css"), "utf8");

    expect(own.length).toBeGreaterThan(0);
    for (const selector of [".ticket-stub", ".pass-stub"]) {
      expect(css).toContain(selector);
      expect(forum).not.toContain(selector);
    }
  });

  it("does not borrow the forum gate's auth-branch pieces", () => {
    for (const file of files(dir).filter((name) => /\.(tsx?|css)$/.test(name))) {
      expect(readFileSync(file, "utf8"), file).not.toContain("auth-branch");
    }
  });
});
