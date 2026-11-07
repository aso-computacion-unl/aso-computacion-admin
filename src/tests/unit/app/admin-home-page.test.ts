import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ session: vi.fn(), deploy: vi.fn(), events: vi.fn(), news: vi.fn(), reports: vi.fn(), overview: vi.fn() }));

vi.mock("@/interface/auth/require-page-session", () => ({ requirePageSession: reads.session }));
vi.mock("@/interface/admin/deploy-status-admin-read", () => ({ getLastDeployStatus: reads.deploy }));
vi.mock("@/interface/admin/events/events-admin-read", () => ({ getAdminEvents: reads.events }));
vi.mock("@/interface/admin/news/news-admin-read", () => ({ getAdminNewsItems: reads.news }));
vi.mock("@/interface/admin/forum/forum-moderation-read", () => ({ getAdminForumReports: reads.reports }));
vi.mock("@/interface/admin/event-registrations/registrations-overview-admin-read", () => ({ getAdminRegistrationOverview: reads.overview }));

import AdminHomePage from "../../../../app/admin/page";

type Role = "ADMIN" | "EDITOR";

const render = async (role: Role = "ADMIN", name = "Alejandro Vera", searchParams: { acceso?: string } = {}) => {
  reads.session.mockResolvedValue({ kind: "user", role, name });

  return renderToStaticMarkup(await AdminHomePage({ searchParams: Promise.resolve(searchParams) }));
};

const draftEvent = { id: "e1", title: "Charla", date: null, datePrecision: "day", isPublished: false, publishAt: null, registrationMode: "none", updatedAt: new Date("2026-10-01T00:00:00Z") };
const openRow = { id: "e7", title: "Hackathon", registered: 48, state: "open" };
const cardButtons = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((match) => [match[1], match[2]]);

beforeEach(() => {
  reads.session.mockReset();
  reads.deploy.mockReset().mockResolvedValue(undefined);
  reads.events.mockReset().mockResolvedValue([]);
  reads.news.mockReset().mockResolvedValue([]);
  reads.reports.mockReset().mockResolvedValue({ total: 0 });
  reads.overview.mockReset().mockResolvedValue({ upcoming: [], past: [] });
});

describe("the admin home greeting", () => {
  it("greets the person by first name in the one h1", async () => {
    const html = await render("ADMIN", "Alejandro Vera");

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Hola, Alejandro<\/h1>/);
  });

  it("greets without a name for the emergency access, which has no person", async () => {
    reads.session.mockResolvedValue({ kind: "break_glass", role: "ADMIN", name: "Acceso de emergencia" });
    const html = renderToStaticMarkup(await AdminHomePage({ searchParams: Promise.resolve({}) }));

    expect(html).toMatch(/<h1[^>]*>Hola<\/h1>/);
  });

  it("keeps the notice for an editor sent back from an admin-only page", async () => {
    expect(await render("EDITOR", "Ana", { acceso: "restringido" })).toContain('role="status"');
  });
});

describe("lo que te espera", () => {
  it("shows a card per thing waiting, each with one button", async () => {
    reads.reports.mockResolvedValue({ total: 3 });
    reads.overview.mockResolvedValue({ upcoming: [openRow], past: [] });
    reads.events.mockResolvedValue([draftEvent]);
    const html = await render();

    expect(html).toContain("Lo que te espera");
    expect(html).toMatch(/<h3[^>]*><span[^>]*>3<\/span>reportes en el foro<\/h3>/);
    expect(html).toMatch(/<h3[^>]*><span[^>]*>48<\/span>inscritos en Hackathon<\/h3>/);
    expect(html).toMatch(/<h3[^>]*><span[^>]*>1<\/span>borrador sin publicar<\/h3>/);
    expect(cardButtons(html)).toEqual(
      expect.arrayContaining([
        ["/admin/foro/reportes", "Revisar"],
        ["/admin/registrations?evento=e7", "Ver inscritos"],
        ["/admin/events/e1/edit", "Continuar"],
      ]),
    );
    expect(html.match(/<li data-slot="todo-card"/g)).toHaveLength(3);
  });

  it("hides the cards with nothing pending", async () => {
    reads.reports.mockResolvedValue({ total: 2 });
    const html = await render();

    expect(html.match(/<li data-slot="todo-card"/g)).toHaveLength(1);
    expect(html).toContain("reportes en el foro");
    expect(html).not.toContain("Ver inscritos");
    expect(html).not.toContain("sin publicar");
    expect(html).not.toContain("Todo al día");
  });

  it("ignores events whose registration is full or closed, and the ones nobody signed up for", async () => {
    reads.overview.mockResolvedValue({ upcoming: [{ ...openRow, state: "full" }, { ...openRow, id: "e8", registered: 0 }], past: [] });

    expect(await render()).toContain("Todo al día");
  });

  it("says 'Todo al día' in one calm line when nothing is pending", async () => {
    const html = await render();

    expect(html).toContain("Todo al día");
    expect(html).not.toContain("todo-card");
    expect(html).not.toContain("Revisar");
  });

  it("does not claim everything is up to date when the reads failed", async () => {
    reads.events.mockRejectedValue(new Error("down"));
    reads.news.mockRejectedValue(new Error("down"));
    reads.reports.mockRejectedValue(new Error("down"));
    reads.overview.mockRejectedValue(new Error("down"));
    const html = await render();

    expect(html).not.toContain("Todo al día");
    expect(html).toContain("No pudimos leer lo pendiente");
  });

  it("shows an editor the same cards and links only to pages an editor can open", async () => {
    reads.reports.mockResolvedValue({ total: 3 });
    reads.overview.mockResolvedValue({ upcoming: [openRow], past: [] });
    reads.events.mockResolvedValue([draftEvent]);
    const html = await render("EDITOR", "Ana");
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    expect(html.match(/<li data-slot="todo-card"/g)).toHaveLength(3);
    expect(hrefs.filter((href) => /settings|usuarios|sesiones|registro|papelera/.test(href ?? ""))).toEqual([]);
  });

  it("drops the old module grid and agenda", async () => {
    const html = await render();

    expect(html).not.toContain("Contenido del sitio");
    expect(html).not.toContain("Por atender");
    expect(html).not.toContain("Próximos eventos");
  });
});

describe("the '+ Crear' menu", () => {
  it("is one primary control offering Evento, Novedad and Pregunta through the existing new routes", async () => {
    const html = await render();
    const menu = html.match(/<details[\s\S]*?<\/details>/)?.[0] ?? "";

    expect(menu).toMatch(/<summary[^>]*>[\s\S]*Crear<\/summary>/);
    expect(menu.match(/<a /g)).toHaveLength(3);
    expect(menu).toMatch(/href="\/admin\/events\/new"[^>]*>[\s\S]*Evento<\/a>/);
    expect(menu).toMatch(/href="\/admin\/news\/new"[^>]*>[\s\S]*Novedad<\/a>/);
    expect(menu).toMatch(/href="\/admin\/faqs\/new"[^>]*>[\s\S]*Pregunta<\/a>/);
    expect(html.match(/<summary/g)).toHaveLength(1);
  });

  it("is there for an editor too, and when nothing is pending", async () => {
    expect(await render("EDITOR", "Ana")).toContain('href="/admin/news/new"');
  });
});

describe("the deploy line", () => {
  it("is one quiet line with the last attempt", async () => {
    reads.deploy.mockResolvedValue({ ok: true, attemptedAt: new Date(Date.now() - 5 * 60_000), httpStatus: 200, errorKind: null });
    const html = await render();

    expect(html).toContain("Último despliegue: hace 5 min · OK");
    expect(html).not.toContain("puede tardar unos minutos");
  });

  it("names the failure and what it means", async () => {
    reads.deploy.mockResolvedValue({ ok: false, attemptedAt: new Date(Date.now() - 60_000), httpStatus: 500, errorKind: null });
    const html = await render();

    expect(html).toContain("Falló (HTTP 500)");
    expect(html).toContain("El cambio quedó guardado");
  });

  it("is absent when the status could not be read", async () => {
    expect(await render()).not.toContain("despliegue");
  });
});
