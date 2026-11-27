import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({
  session: vi.fn(),
  deploy: vi.fn(),
  events: vi.fn(),
  eventCounts: vi.fn(),
  news: vi.fn(),
  newsCounts: vi.fn(),
  faqCounts: vi.fn(),
  reports: vi.fn(),
  members: vi.fn(),
  overview: vi.fn(),
  audit: vi.fn(),
  sessions: vi.fn(),
  trash: vi.fn(),
  activity: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: reads.session }));
vi.mock("@/interface/admin/deploy-status-admin-read", () => ({ getLastDeployStatus: reads.deploy }));
vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvents: reads.events, getAdminEventCounts: reads.eventCounts }));
vi.mock("@/interface/admin/news/news-admin-read", () => ({ getAdminNewsItems: reads.news, getAdminNewsCounts: reads.newsCounts }));
vi.mock("@/interface/admin/faqs/faqs-admin-read", () => ({ getAdminFaqsCounts: reads.faqCounts }));
vi.mock("@/interface/admin/forum/forum-moderation-read", () => ({ getAdminForumReports: reads.reports, getAdminForumMembers: reads.members }));
vi.mock("@/interface/admin/event-registrations/registrations-overview-admin-read", () => ({ getAdminRegistrationOverview: reads.overview }));
vi.mock("@/interface/admin/audit/audit-activity-read", () => ({ getAdminActivityByDay: reads.activity }));
vi.mock("@/interface/admin/audit/audit-admin-read", () => ({ getAuditLogPage: reads.audit }));
vi.mock("@/interface/admin/sessions/sessions-admin-read", () => ({ getActiveSessions: reads.sessions }));
vi.mock("@/interface/admin/trash/trash-admin-read", () => ({ getAdminTrash: reads.trash }));

import AdminHomePage from "../../../../app/admin/page";

type Role = "ADMIN" | "EDITOR";

const render = async (role: Role = "ADMIN", name = "Alejandro Vera", searchParams: { acceso?: string } = {}) => {
  reads.session.mockResolvedValue({ kind: "user", role, name });

  return renderToStaticMarkup(await AdminHomePage({ searchParams: Promise.resolve(searchParams) }));
};

const draftEvent = { id: "e1", title: "Charla", date: null, datePrecision: "day", isPublished: false, publishAt: null, registrationMode: "none", updatedAt: new Date("2026-10-01T00:00:00Z") };
const scheduledNews = { id: "n1", title: "Convocatoria", isPublished: false, publishAt: new Date("2099-01-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z") };
const row = (overrides: Record<string, unknown> = {}) => ({
  id: "e7",
  slug: "hackathon",
  title: "Hackathon",
  date: "2099-03-10",
  datePrecision: "day",
  mode: "unl",
  capacity: 80,
  registered: 64,
  deadline: null,
  state: "open",
  publication: "live",
  ...overrides,
});
const auditEntry = (id: string, summary: string, overrides: Record<string, unknown> = {}) => ({
  id,
  at: new Date(Date.now() - 12 * 60_000),
  actorKind: "user",
  actorUserId: "u1",
  action: "event.publish",
  entityType: "event",
  entityId: "e1",
  summary,
  ...overrides,
});

/** The markup of one labelled section, from its opening tag to the end of the page (enough to find what it holds first). */
const section = (html: string, id: string) => html.slice(html.indexOf(`aria-labelledby="${id}"`));
const between = (html: string, from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to));
const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1]);

beforeEach(() => {
  reads.session.mockReset();
  reads.deploy.mockReset().mockResolvedValue(undefined);
  reads.events.mockReset().mockResolvedValue([]);
  reads.eventCounts.mockReset().mockResolvedValue({ published: 19, draft: 1 });
  reads.news.mockReset().mockResolvedValue([]);
  reads.newsCounts.mockReset().mockResolvedValue({ published: 12, draft: 0 });
  reads.faqCounts.mockReset().mockResolvedValue({ published: 9, draft: 0 });
  reads.reports.mockReset().mockResolvedValue({ total: 0 });
  reads.members.mockReset().mockResolvedValue({ total: 2 });
  reads.overview.mockReset().mockResolvedValue({ upcoming: [], past: [] });
  reads.audit.mockReset().mockResolvedValue({ items: [], users: [] });
  reads.sessions.mockReset().mockResolvedValue({ sessions: [{}, {}, {}, {}] });
  reads.trash.mockReset().mockResolvedValue([{}, {}, {}]);
  // Like the real read: the team for an administrator, their own changes for an editor.
  reads.activity.mockReset().mockImplementation(async () => ({ days: [], total: 0, scope: (await reads.session()).role === "ADMIN" ? "team" : "own" }));
});

describe("the admin home greeting", () => {
  it("greets the person by first name in the one h1", async () => {
    const html = await render("ADMIN", "Alejandro Vera");

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Hola, Alejandro<\/h1>/);
    expect(html).toContain(" · Loja");
  });

  it("greets without a name for the emergency access, which has no person", async () => {
    reads.session.mockResolvedValue({ kind: "break_glass", role: "ADMIN", name: "Acceso de emergencia" });
    const html = renderToStaticMarkup(await AdminHomePage({ searchParams: Promise.resolve({}) }));

    expect(html).toMatch(/<h1[^>]*>Hola<\/h1>/);
  });

  it("keeps the notice for an editor sent back from an admin-only page", async () => {
    expect(await render("EDITOR", "Ana", { acceso: "restringido" })).toContain("Esa sección es solo para administradores.");
  });
});

describe("the git status line", () => {
  it("sums up what needs someone: open reports, events without seats and scheduled drafts", async () => {
    reads.reports.mockResolvedValue({ total: 9 });
    reads.overview.mockResolvedValue({ upcoming: [row({ state: "full", registered: 80 })], past: [] });
    reads.news.mockResolvedValue([scheduledNews]);
    const html = await render();

    expect(html).toContain("$ git status</span> → ");
    expect(html).toMatch(/<b[^>]*>9 reportes<\/b> del foro por revisar/);
    expect(html).toMatch(/<b[^>]*>1 evento<\/b> sin cupos/);
    expect(html).toMatch(/<b[^>]*>1<\/b> programado/);
  });

  it("says everything is up to date when nothing waits", async () => {
    expect(await render()).toContain("→ todo al día.");
  });

  it("does not claim everything is up to date when the reads failed", async () => {
    reads.events.mockRejectedValue(new Error("down"));
    reads.news.mockRejectedValue(new Error("down"));
    reads.reports.mockRejectedValue(new Error("down"));
    reads.overview.mockRejectedValue(new Error("down"));
    const html = await render();

    expect(html).not.toContain("todo al día");
    expect(html).toContain("no pudimos leer todo lo pendiente");
    expect(html).toContain("No pudimos leer las inscripciones");
    expect(html).toContain("No pudimos leer los borradores");
  });
});

describe("the three tiers", () => {
  it("go from what needs attention, to the person's work, to the status", async () => {
    const html = await render();
    const order = ["Necesita atención", "Acciones rápidas", "Inscripciones próximas", "Tu trabajo", "Borradores", "Actividad reciente", "Estado", "Sitio público"].map((text) => html.indexOf(text));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("drops the old pending cards and the side panel", async () => {
    const html = await render();

    expect(html).not.toContain("Lo que te espera");
    expect(html).not.toContain("todo-card");
    expect(html).not.toContain("Crear y estado del sitio");
  });

  it("shows the 16-week activity map with a text alternative", async () => {
    const html = await render();

    expect(html).toMatch(/role="img" aria-label="Actividad del equipo en las últimas 16 semanas: sin cambios\."/);
    expect(html).toContain("0 cambios del equipo · 16 semanas");
  });

  it("draws the team's days from the change log", async () => {
    reads.activity.mockResolvedValue({ days: [{ date: "2026-11-24", count: 3 }, { date: "2026-11-25", count: 11 }], total: 14, scope: "team" });

    const html = await render();

    expect(html).toContain("14 cambios del equipo · 16 semanas");
  });

  it("labels an editor's map as their own changes", async () => {
    reads.activity.mockResolvedValue({ days: [{ date: "2026-11-25", count: 4 }], total: 4, scope: "own" });

    const html = await render("EDITOR");

    expect(html).toContain("Tus cambios: 4 · 16 semanas");
    expect(html).not.toContain("cambios del equipo");
  });

  it("shows no map when the change log could not be read, rather than sixteen empty weeks", async () => {
    reads.activity.mockRejectedValue(new Error("down"));

    const html = await render();

    expect(html).not.toContain("16 semanas");
    expect(html).toContain("Hola, Alejandro");
  });
});

describe("acciones rápidas", () => {
  const card = async () => between(await render(), 'aria-labelledby="quick-actions-title"', 'aria-labelledby="home-registrations"');

  it("opens the palette from the command line, as Ctrl K does", async () => {
    const html = await card();

    expect(html).toMatch(/<button type="button" aria-haspopup="dialog" aria-keyshortcuts="Control\+K Meta\+K"[^>]*>[\s\S]*\$ aso[\s\S]*buscar o crear…/);
  });

  it("offers the three creates with their single-key shortcuts", async () => {
    const html = await card();

    const tile = (href: string) => html.match(new RegExp(`<a [^>]*href="${href}"[^>]*>[\\s\\S]*?</a>`))?.[0] ?? "";

    expect(tile("/admin/events/new")).toMatch(/aria-keyshortcuts="E"[\s\S]*Nuevo evento/);
    expect(tile("/admin/news/new")).toMatch(/aria-keyshortcuts="N"[\s\S]*Nueva novedad/);
    expect(tile("/admin/faqs/new")).toMatch(/aria-keyshortcuts="P"[\s\S]*Nueva pregunta/);
  });

  it("counts the open reports on «Revisar el foro», the one red of the card", async () => {
    reads.reports.mockResolvedValue({ total: 9 });
    const html = await card();

    expect(html).toContain('aria-label="Revisar 9 reportes del foro"');
    expect(html.match(/bg-signal/g)).toHaveLength(1);
    expect(html).not.toMatch(/gradient/);
  });

  it("shows no count when the forum queue is empty", async () => {
    const html = await card();

    expect(html).toContain("Revisar el foro");
    expect(html).not.toContain("bg-signal");
  });

  it("continues the last edited draft and ends with the last change as a git log line", async () => {
    reads.events.mockResolvedValue([draftEvent, { ...draftEvent, id: "e2", title: "Hackathon 2027", updatedAt: new Date("2026-11-01T00:00:00Z") }]);
    reads.audit.mockResolvedValue({ items: [auditEntry("a3f9c1e2-0000", "Publicó «Taller de Git»")], users: [{ id: "u1", name: "María Torres" }] });
    const html = await card();

    expect(html).toMatch(/href="\/admin\/events\/e2\/edit"[\s\S]*Continuar borrador[\s\S]*Hackathon 2027/);
    expect(html).toMatch(/a3f9c1e2<\/span> Publicó «Taller de Git» · hace 12 min/);
  });
});

describe("inscripciones próximas", () => {
  it("lists each upcoming event with seats, state and the total signed up", async () => {
    reads.overview.mockResolvedValue({ upcoming: [row(), row({ id: "e8", title: "Install Party", capacity: 25, registered: 25, state: "full" }), row({ id: "e9", title: "Torneo", capacity: null, registered: 41, mode: "open" })], past: [] });
    const html = section(await render(), "home-registrations");

    expect(html).toMatch(/<b[^>]*>130<\/b> inscritos en 3 eventos/);
    expect(html).toContain('href="/admin/registrations?evento=e7"');
    expect(html).toContain("64 / 80");
    expect(html).toContain("Sin cupos");
    expect(html).toContain("41 inscritos");
    expect(html).toContain("Formulario abierto");
    expect(html).toContain('href="/admin/registrations"');
  });

  it("says plainly when no upcoming event takes registrations", async () => {
    expect(section(await render(), "home-registrations")).toContain("No hay eventos próximos con inscripción.");
  });
});

describe("tu trabajo", () => {
  it("lists the drafts by name, marking the scheduled ones", async () => {
    reads.events.mockResolvedValue([draftEvent]);
    reads.news.mockResolvedValue([scheduledNews]);
    const html = between(await render(), 'aria-labelledby="home-drafts"', 'aria-labelledby="home-activity"');

    expect(html).toMatch(/<b[^>]*>2<\/b> · 1 programado/);
    expect(html).toContain('href="/admin/events/e1/edit"');
    expect(html).toContain('aria-label="Continuar: Charla"');
    expect(html).toContain("Programado");
  });

  it("shows the administrator the newest changes of the log", async () => {
    reads.audit.mockResolvedValue({
      items: [auditEntry("a1", "Publicó «Taller de Git»"), auditEntry("a2", "Inició sesión", { actorKind: "break_glass", actorUserId: null, entityType: "session" })],
      users: [{ id: "u1", name: "María Torres" }],
    });
    const html = section(await render(), "home-activity");

    expect(html).toMatch(/<b>María Torres<\/b> · Publicó «Taller de Git»/);
    expect(html).toMatch(/<b class="text-on-tint-red">Acceso de emergencia<\/b> · Inició sesión/);
    expect(html).toContain("hace 12 min · Evento");
    expect(html).toContain('href="/admin/registro"');
  });

  it("gives an editor the drafts across the whole row, without the change log", async () => {
    const html = await render("EDITOR", "Ana");

    expect(html).not.toContain("Actividad reciente");
    expect(html).toMatch(/aria-labelledby="home-drafts" class="[^"]*lg:col-span-12/);
    expect(reads.audit).not.toHaveBeenCalled();
  });
});

describe("estado", () => {
  it("shows the deploy, what is published and the care of the accounts", async () => {
    reads.deploy.mockResolvedValue({ ok: true, attemptedAt: new Date(Date.now() - 5 * 60_000), httpStatus: 200, errorKind: null });
    const html = section(await render(), "status-site");

    expect(html).toContain("Al día");
    expect(html).toContain("Último despliegue: hace 5 min · OK");
    expect(html).not.toContain("puede tardar unos minutos");
    expect(html).toMatch(/href="\/admin\/events"[^>]*><b[^>]*>19<\/b>eventos/);
    expect(html).toMatch(/href="\/admin\/sesiones"[^>]*><b[^>]*>4<\/b>sesiones activas/);
    expect(html).toMatch(/href="\/admin\/foro\/miembros\?estado=suspendidos"[^>]*><b[^>]*>2<\/b>cuentas suspendidas/);
    expect(html).toMatch(/href="\/admin\/papelera"[^>]*><b[^>]*>3<\/b>en la papelera/);
  });

  it("names a failed deploy and what it means", async () => {
    reads.deploy.mockResolvedValue({ ok: false, attemptedAt: new Date(Date.now() - 60_000), httpStatus: 500, errorKind: null });
    const html = await render();

    expect(html).toContain("Falló (HTTP 500)");
    expect(html).toContain("El cambio quedó guardado");
  });

  it("says so when the deploy status could not be read", async () => {
    const html = await render();

    expect(html).toContain("No pudimos leer el último despliegue.");
    expect(html).not.toContain("Al día");
  });

  it("leaves the care of the accounts out for an editor, who links only to pages an editor can open", async () => {
    reads.reports.mockResolvedValue({ total: 3 });
    reads.events.mockResolvedValue([draftEvent]);
    const html = await render("EDITOR", "Ana");

    expect(html).not.toContain("Cuidado de la cuenta");
    expect(html).toContain("Tus cambios: 0 · 16 semanas");
    expect(links(html).filter((href) => /settings|usuarios|sesiones|registro|papelera/.test(href ?? ""))).toEqual([]);
    expect(reads.sessions).not.toHaveBeenCalled();
    expect(reads.trash).not.toHaveBeenCalled();
    expect(reads.members).not.toHaveBeenCalled();
  });
});
