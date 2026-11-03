import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, notFoundMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

import ForumRegistrationsPage, { metadata } from "../../../../app/foro/eventos/page";
import { makeForumCategory, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { addTestEvent, testEventRegistration } from "@/tests/support/test-event-registration";
import { testForum } from "@/tests/support/test-forum";

const render = async (query: { error?: string } = {}) => renderToStaticMarkup(await ForumRegistrationsPage({ searchParams: Promise.resolve(query) }));

beforeEach(() => {
  vi.clearAllMocks();
  stubForumSecrets();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  cookiesMock.mockResolvedValue(cookieJar({}));
});

describe("/foro/eventos as a visitor", () => {
  it("shows the same Google gate as the forum home, coming back to this page, and none of the events", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });

    const html = await render();

    expect(html).toContain("Entrar con Google");
    expect(html).toContain('href="/foro/auth/google/start?next=%2Fforo%2Feventos"');
    expect(html).not.toContain("Taller de Docker");
    expect(html).not.toContain("Inscripciones");
  });

  it("explains a failed sign-in the way the home does", async () => {
    expect(await render({ error: "denied" })).toContain('role="alert"');
  });
});

describe("/foro/eventos as a member", () => {
  beforeEach(async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar()).jar);
    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "general", name: "General", sortOrder: 1 }));
    testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", title: "Un hilo" }));
  });

  it("is titled Inscripciones", async () => {
    expect(metadata.title).toBe("Inscripciones");
    expect(await render()).toMatch(/<h1[^>]*>Inscripciones<\/h1>/);
  });

  it("lists every event open for UNL registration, soonest first, each linking to its page with date and seats", async () => {
    const later = await addTestEvent({ title: "Hackathon UNL 2026", registrationMode: "unl", registrationCapacity: 60, date: "2099-12-15" });
    const sooner = await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", registrationCapacity: 30, date: "2099-11-28" });
    await addTestEvent({ title: "Meetup sin fecha", registrationMode: "unl", date: null });
    testEventRegistration.registrations.seed({ id: "r1", eventId: sooner.id, mode: "unl", name: "Ana", email: "ana@unl.edu.ec", career: null, semester: null, createdAt: new Date() });
    await addTestEvent({ title: "Charla abierta al público", registrationMode: "open" });
    await addTestEvent({ title: "Taller que ya pasó", registrationMode: "unl", date: "2020-01-10" });

    const html = await render();
    const list = html.match(/<ul>[\s\S]*?<\/ul>/)?.[0] ?? "";

    expect(list.match(/<li>/g)).toHaveLength(3);
    expect(list).toContain(`href="/foro/eventos/${sooner.slug}"`);
    expect(list).toContain(`href="/foro/eventos/${later.slug}"`);
    expect(list).toContain("28 nov 2099");
    expect(list).toContain("Quedan 29 cupos");
    expect(list).toContain("Quedan 60 cupos");
    expect(list).toContain("Sin límite de cupos");
    expect(list.indexOf("Taller de Docker")).toBeLessThan(list.indexOf("Hackathon UNL 2026"));
    expect(list.indexOf("Hackathon UNL 2026")).toBeLessThan(list.indexOf("Meetup sin fecha"));
    expect(list).not.toContain("Charla abierta");
    expect(list).not.toContain("ya pasó");
  });

  it("hangs the events on the same branch line as the thread list, with a header over their columns", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });

    const html = await render();
    const header = html.match(/<div aria-hidden="true" class="thread-cols[^"]*">[\s\S]*?<\/div>/)?.[0] ?? "";

    expect(html).toContain('class="thread-graph"');
    for (const column of ["Evento", "Fecha", "Cupos"]) expect(header).toContain(`>${column}<`);
  });

  it("says seats in the singular when only one is left", async () => {
    const event = await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", registrationCapacity: 2, date: "2099-11-28" });
    testEventRegistration.registrations.seed({ id: "r0", eventId: event.id, mode: "unl", name: "Ana", email: "ana@unl.edu.ec", career: null, semester: null, createdAt: new Date() });
    const full = await addTestEvent({ title: "Taller lleno", registrationMode: "unl", registrationCapacity: 1, date: "2099-12-01" });
    testEventRegistration.registrations.seed({ id: "r1", eventId: full.id, mode: "unl", name: "Bea", email: "bea@unl.edu.ec", career: null, semester: null, createdAt: new Date() });

    const html = await render();

    expect(html).toContain("Queda 1 cupo");
    expect(html).not.toContain("Taller lleno");
  });

  it("shows each event's description under its title, and nothing extra for an event without one", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28", description: "Contenedores desde cero, con tu laptop." });
    await addTestEvent({ title: "Meetup sin texto", registrationMode: "unl", date: "2099-12-02" });

    const list = (await render()).match(/<ul>[\s\S]*?<\/ul>/)?.[0] ?? "";
    const items = list.match(/<li>[\s\S]*?<\/li>/g) ?? [];

    expect(items[0]).toContain("Contenedores desde cero, con tu laptop.");
    expect(items[1]).not.toContain("line-clamp-2");
  });

  it("lists more than five open events: the page shows them all", async () => {
    for (let day = 1; day <= 7; day += 1) {
      await addTestEvent({ title: `Evento ${day}`, registrationMode: "unl", date: `2099-12-${String(day).padStart(2, "0")}` });
    }

    const list = (await render()).match(/<ul>[\s\S]*?<\/ul>/)?.[0] ?? "";

    expect(list.match(/<li>/g)).toHaveLength(7);
  });

  it("says so, with a way back to the threads, while no event is open", async () => {
    await addTestEvent({ title: "Charla abierta al público", registrationMode: "open" });

    const html = await render();

    expect(html).toContain("No hay inscripciones abiertas.");
    expect(html).toContain("Cuando la directiva abra una, la verá aquí.");
    expect(html).toContain('href="/foro"');
    expect(html).not.toContain('href="/foro/eventos/');
    expect(html).not.toContain("thread-graph");
  });

  it("uses the forum's rail with Inscripciones marked as the current page and no thread tab or category current", async () => {
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });

    const html = await render();
    const rail = html.match(/<div class="hidden[^"]*lg:grid[^"]*">[\s\S]*?<\/nav><\/div><\/div>/)?.[0] ?? "";

    expect(html).toContain("data-wide");
    expect(rail).toContain("Abiertos");
    expect(rail).toContain("Categorías");
    expect(rail).toMatch(/aria-current="page"[^>]*href="\/foro\/eventos"/);
    expect(rail.match(/aria-current="page"/g)).toHaveLength(1);
    expect(rail).toMatch(/Inscripciones<span[^>]*>1<span class="sr-only"> abierta<\/span>/);
    expect(rail).toMatch(/Abiertos<span[^>]*>1<\/span>/);
  });

  it("keeps a way back to the threads on phones, where the rail is hidden", async () => {
    const html = await render();

    expect(html).toMatch(/<a [^>]*class="[^"]*\blg:hidden\b[^"]*"[^>]*href="\/foro"[^>]*>[\s\S]*?Hilos<\/a>|<a [^>]*href="\/foro"[^>]*class="[^"]*\blg:hidden\b[^"]*"[^>]*>[\s\S]*?Hilos<\/a>/);
  });

  it("falls back to the sign-in when the session was revoked", async () => {
    for (const record of testForum.sessions.sessions.values()) record.revokedAt = new Date();

    expect(await render()).toContain("Entrar con Google");
  });

  it("still opens, with the empty state, when the event read fails", async () => {
    vi.spyOn(testEventRegistration.services.openUnl, "execute").mockRejectedValue(new Error("db down"));

    const html = await render();

    expect(html).toContain("No hay inscripciones abiertas.");
    expect(console.error).toHaveBeenCalled();
  });
});
