import { createElement } from "react";
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
vi.mock("../../../../app/_components/brand-mark", () => ({ BrandIsotype: () => null, BrandLogo: () => null }));
vi.mock("../../../../app/_components/theme-toggle", () => ({ ThemeToggle: () => null }));

import ForumLayout from "../../../../app/foro/layout";
import ForumHomePage from "../../../../app/foro/page";
import { FORUM_LANDING_ERROR_MESSAGES, FORUM_LANDING_ERRORS } from "@/interface/forum/forum-login-errors";
import { FORUM_THREADS_PAGE_SIZE } from "@/application/forum/forum-threads.use-cases";
import { makeForumCategory, makeForumMember, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { cookieJar, forumMemberJar, stubForumSecrets } from "@/tests/support/forum-page";
import { signInAs } from "@/tests/support/test-auth";
import { addTestEvent } from "@/tests/support/test-event-registration";
import { testForum } from "@/tests/support/test-forum";
import { AUTH_COOKIE_NAME } from "@/infrastructure/auth/session-jwt";

type HomeQuery = { error?: string; next?: string | string[]; estado?: string; categoria?: string; pagina?: string };

const renderQuery = async (query: HomeQuery) => renderToStaticMarkup(await ForumHomePage({ searchParams: Promise.resolve(query) }));
const textOf = (html: string, glue = "") => html.replace(/<[^>]+>/g, glue).replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const renderHome = (error?: string, next?: string | string[]) => renderQuery({ error, next });
const renderLayout = async () => renderToStaticMarkup(await ForumLayout({ children: createElement("p", null, "contenido") }));

beforeEach(() => {
  vi.clearAllMocks();
  stubForumSecrets();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  cookiesMock.mockResolvedValue(cookieJar({}));
});

describe("/foro with a suspended account (D1)", () => {
  async function suspendedJar() {
    const { jar, memberId } = await forumMemberJar({ displayName: "Daniela P." });
    testForum.members.members.set(memberId, { ...testForum.members.members.get(memberId)!, status: "SUSPENDED", suspendedAt: new Date() });
    cookiesMock.mockResolvedValue(jar);

    return memberId;
  }

  it("shows the suspension notice instead of the sign-in, and nothing of the forum", async () => {
    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", name: "Programación" }));
    testForum.store.threads.set("t1", makeForumThread({ id: "t1", categoryId: "c1", title: "Hilo secreto de prueba" }));
    await suspendedJar();

    const html = await renderHome();
    const text = textOf(html);

    expect(text).toContain("Su cuenta del foro está suspendida");
    expect(text).toContain("escriba a la directiva de ASO");
    expect(html).not.toContain("Su carrera se resuelve");
    expect(html).not.toContain("Programación");
    expect(html).not.toContain("Hilo secreto de prueba");
    expect(html).not.toContain("Daniela");
    expect(html).not.toContain('role="alert"');
  });

  it("still lets them try another account, and carries the page they came for", async () => {
    await suspendedJar();

    const html = await renderHome(undefined, "/foro/hilo/abc");

    expect(textOf(html)).toContain("Entrar con otra cuenta de Google");
    expect(html).toContain('href="/foro/auth/google/start?next=%2Fforo%2Fhilo%2Fabc"');
  });

  it("is told only to the holder of that member's cookie: a visitor, an admin and an active member see what they always saw", async () => {
    const memberId = await suspendedJar();

    cookiesMock.mockResolvedValue(cookieJar({}));
    expect(textOf(await renderHome())).not.toContain("suspendida");
    expect(textOf(await renderHome())).toContain("Su carrera se resuelve aquí");

    cookiesMock.mockResolvedValue(cookieJar({ [AUTH_COOKIE_NAME]: await signInAs("ADMIN") }));
    expect(textOf(await renderHome())).not.toContain("suspendida");

    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", name: "Programación" }));
    testForum.members.members.set(memberId, { ...testForum.members.members.get(memberId)!, status: "ACTIVE", suspendedAt: null });
    const { jar } = await forumMemberJar({ id: "other", email: "other@unl.edu.ec", googleSub: "sub-other" });
    cookiesMock.mockResolvedValue(jar);
    const html = await renderHome();

    expect(html).not.toContain("suspendida");
    expect(html).toContain("Programación");
  });

  it("keeps the identity chip out of the top bar, like for any visitor", async () => {
    await suspendedJar();

    expect(await renderLayout()).not.toContain("Daniela");
  });
});

describe("/foro as a visitor", () => {
  it("offers the Google sign-in and none of the forum", async () => {
    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", name: "Programación" }));

    const html = await renderHome();

    expect(html).toContain("Entrar con Google");
    expect(html).toContain('href="/foro/auth/google/start"');
    expect(html).toContain("@unl.edu.ec");
    expect(html).not.toContain("Programación");
    expect(html).not.toContain('role="alert"');
  });

  it("draws the Google button from the shared style, not from colours of its own, and the title in the shared title face", async () => {
    const html = await renderHome();
    const button = html.match(/<a [^>]*href="\/foro\/auth\/google\/start"[^>]*>/)?.[0] ?? "";
    const title = html.match(/<h1[^>]*id="gate-title"[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";

    expect(button).toContain('class="google-button');
    expect(button).not.toMatch(/#[0-9a-f]{3,6}|bg-white|border-white|rgb\(/i);
    expect(title).toContain("font-display");
    expect(textOf(title)).toBe("Su carrera se resuelve aquí");
  });

  it("gives three reasons to enter as tiles, in the order Preguntar, Proponer, Armar equipo", async () => {
    const html = await renderHome();
    const tiles = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1] ?? "");

    expect(tiles.map((tile) => textOf(tile))).toEqual(["PreguntarDudas de materias", "ProponerTalleres y charlas", "Armar equipoPara el próximo evento"]);
    for (const tile of tiles) expect(tile).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("data-bleed");
  });

  it("has one sign-in action, and the note says only @unl.edu.ec works and the first entry creates the account", async () => {
    const html = await renderHome();

    expect(html.match(/href="\/foro\/auth\/google\/start/g)).toHaveLength(1);
    expect(textOf(html)).toContain("Solo con su correo @unl.edu.ec. La primera vez se crea su cuenta.");
  });

  it("shows no sample threads and no git branch, and says little: 40 words at most", async () => {
    const html = await renderHome();
    const text = textOf(html, " ");

    for (const gone of ["Estructuras de Datos", "Postgres", "hackathon", "hace 2 h", "respuestas", "Hilos de ejemplo", "git branch", "HEAD"]) {
      expect(html, gone).not.toContain(gone);
    }
    expect(html).not.toContain("inert");
    expect(html).not.toContain('class="branch"');
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(40);
  });

  it("passes the path the visitor came for to the sign-in as next", async () => {
    const html = await renderHome(undefined, "/foro/hilo/abc?x=1");

    expect(html).toContain('href="/foro/auth/google/start?next=%2Fforo%2Fhilo%2Fabc%3Fx%3D1"');
  });

  it.each([
    ["an external URL", "https://evil.example/foro"],
    ["a protocol-relative URL", "//evil.example"],
    ["the admin area", "/admin"],
    ["an auth path", "/foro/auth/google/callback"],
    ["a repeated parameter", ["/foro/hilo/a", "/foro/hilo/b"]],
  ])("does not forward %s: the sign-in link stays plain", async (_label, next) => {
    const html = await renderHome(undefined, next);

    expect(html).toContain('href="/foro/auth/google/start"');
    expect(html).not.toContain("next=");
  });

  it.each(FORUM_LANDING_ERRORS)("explains a failed sign-in (%s) as an alert and offers to try again", async (code) => {
    const html = await renderHome(code);

    expect(html).toContain('role="alert"');
    expect(html.replace(/&#x27;/g, "'")).toContain(FORUM_LANDING_ERROR_MESSAGES[code]);
    expect(html).toContain("Entrar de nuevo con Google");
  });

  it("tells a suspended account refused at the Google sign-in so, apart from the other refusals (D1)", async () => {
    const suspended = textOf(await renderHome("suspended"));

    expect(suspended).toContain("Su cuenta del foro está suspendida");
    expect(suspended).toContain("escriba a la directiva de ASO");
    expect(textOf(await renderHome("denied"))).not.toContain("suspendid");
    expect(textOf(await renderHome("verification"))).not.toContain("directiva");
  });

  it("ignores an unknown error code instead of echoing it", async () => {
    const html = await renderHome("<script>alert(1)</script>");

    expect(html).not.toContain("script");
    expect(html).toContain("Entrar con Google");
  });

  it("treats an admin session as a visitor: it is not a forum member", async () => {
    cookiesMock.mockResolvedValue(cookieJar({ [AUTH_COOKIE_NAME]: await signInAs("ADMIN") }));

    expect(await renderHome()).toContain("Entrar con Google");
  });
});

const NOW = new Date();
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function seedForum() {
  testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "general", name: "General", sortOrder: 1 }));
  testForum.store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", sortOrder: 2 }));
  testForum.store.categories.set("c3", makeForumCategory({ id: "c3", slug: "propuestas", name: "Propuestas", sortOrder: 3 }));
  testForum.members.members.set("m2", makeForumMember({ id: "m2", email: "kevin@unl.edu.ec", googleSub: "sub-2", displayName: "Kevin L." }));
  testForum.store.threads.set("t-wsl", makeForumThread({ id: "t-wsl", categoryId: "c2", authorId: "m2", title: "¿Cómo configuro WSL2?", lastActivityAt: minutesAgo(60) }));
  testForum.store.threads.set("t-idea", makeForumThread({ id: "t-idea", categoryId: "c1", authorId: "m2", title: "Ideas para el hackatón", lockedAt: minutesAgo(5), lastActivityAt: minutesAgo(1500) }));
  testForum.store.threads.set("t-fault", makeForumThread({ id: "t-fault", categoryId: "c2", authorId: "m2", title: "Segfault al liberar la lista", bestReplyId: "r1", lastActivityAt: minutesAgo(12) }));
  testForum.store.threads.set("t-hidden", makeForumThread({ id: "t-hidden", categoryId: "c1", authorId: "m2", title: "Hilo oculto por la moderación", hiddenAt: minutesAgo(3) }));
}

describe("/foro as a member", () => {
  beforeEach(async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar()).jar);
  });

  it("is the thread list of every category: open threads newest activity first, hidden ones never", async () => {
    seedForum();

    const html = await renderQuery({});

    expect(html).toContain('<h1 class="');
    expect(html).toMatch(/<h1[^>]*>Hilos<\/h1>/);
    expect(html).not.toMatch(/<h1[^>]*>Foro<\/h1>/);
    expect(html.indexOf("¿Cómo configuro WSL2?")).toBeGreaterThan(-1);
    expect(html.indexOf("¿Cómo configuro WSL2?")).toBeLessThan(html.indexOf("Ideas para el hackatón"));
    expect(html).not.toContain("Segfault al liberar la lista");
    expect(html).not.toContain("Hilo oculto por la moderación");
    expect(html).toContain('href="/foro/hilo/t-wsl"');
    expect(html).toContain("Kevin L.");
    expect(html).toContain("hace 1 h");
    expect(html).not.toContain("Entrar con Google");
  });

  it("shows each thread's category as a chip and says what state it is in with words", async () => {
    seedForum();

    const html = await renderQuery({});

    expect(html).toMatch(/<span class="chip"[^>]*data-hue="\d"[^>]*>Materias<\/span>/);
    expect(html).toContain(">abierto</span>");
    expect(html).toContain(">cerrado por la moderación</span>");
    expect(html).toContain('<span class="sr-only">Abierto</span>');
  });

  it("counts both tabs for the whole forum and switches to the solved threads", async () => {
    seedForum();

    const open = await renderQuery({});
    const solved = await renderQuery({ estado: "resueltos" });

    expect(open).toMatch(/Abiertos<span[^>]*>2<\/span>/);
    expect(open).toMatch(/Resueltos<span[^>]*>1<\/span>/);
    expect(open).toMatch(/aria-current="page"[^>]*href="\/foro"/);
    expect(open).toContain('href="/foro?estado=resueltos"');
    expect(solved).toContain("Segfault al liberar la lista");
    expect(solved).toContain(">resuelto</span>");
    expect(solved).not.toContain("¿Cómo configuro WSL2?");
    expect(solved).toMatch(/aria-current="page"[^>]*href="\/foro\?estado=resueltos"/);
  });

  it("filters by category with chips that keep the tab, counting only that category", async () => {
    seedForum();

    const html = await renderQuery({ categoria: "materias", estado: "resueltos" });

    expect(html).toContain('aria-label="Categoría"');
    expect(html).toContain('href="/foro?estado=resueltos"');
    expect(html).toContain('href="/foro?categoria=propuestas&amp;estado=resueltos"');
    expect(html).toMatch(/aria-current="page"[^>]*href="\/foro\?categoria=materias&amp;estado=resueltos"/);
    expect(html).toContain("Segfault al liberar la lista");
    expect(html).toMatch(/Abiertos<span[^>]*>1<\/span>/);
    expect(await renderQuery({ categoria: "materias" })).not.toContain("Ideas para el hackatón");
  });

  it("shows the description of the chosen category under the chips, and none for the whole forum", async () => {
    seedForum();
    testForum.store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", sortOrder: 2, description: "Dudas de las materias" }));

    const one = await renderQuery({ categoria: "materias" });
    const all = await renderQuery({});

    expect(one).toMatch(/<p[^>]*>Dudas de las materias<\/p>/);
    expect(one).toContain('data-slot="category-description"');
    // The line sits between the header and the list, after the rail that carries the same words.
    expect(one.indexOf('data-slot="category-description"')).toBeLessThan(one.indexOf('href="/foro/hilo/'));
    // The whole forum has no line of its own; the rail still says what each category is for.
    expect(all).not.toContain('data-slot="category-description"');
  });

  it("shows no description line for a category that has none", async () => {
    seedForum();

    const html = await renderQuery({ categoria: "materias" });

    expect(html).not.toMatch(/data-slot="category-description"/);
  });

  it("is a 404 for a category that does not exist", async () => {
    seedForum();

    await expect(renderQuery({ categoria: "no-existe" })).rejects.toThrow("NOT_FOUND");
  });

  it("offers Nuevo hilo as a choice of category, or straight to the category it is filtered to", async () => {
    seedForum();

    const all = await renderQuery({});
    const one = await renderQuery({ categoria: "propuestas" });

    for (const slug of ["general", "materias", "propuestas"]) expect(all).toContain(`href="/foro/c/${slug}/nuevo"`);
    expect(all).toContain('aria-haspopup="true"');
    expect(one).toContain('href="/foro/c/propuestas/nuevo"');
    expect(one).not.toContain('href="/foro/c/materias/nuevo"');
  });

  it("explains an empty tab in a line and offers Nuevo hilo, keeping the tabs", async () => {
    seedForum();
    testForum.store.threads.delete("t-fault");

    const solved = await renderQuery({ estado: "resueltos" });

    expect(solved).toContain("No hay hilos resueltos.");
    expect(solved).toContain("Nuevo hilo");
    expect(solved).toContain("Estado de los hilos");
    expect(solved).not.toContain('href="/foro/hilo/');
    expect(solved).not.toContain("¿No encuentra su duda?");
  });

  it("says so when the forum has no threads yet, and still offers the first one", async () => {
    testForum.store.categories.set("c1", makeForumCategory({ id: "c1", slug: "general", name: "General" }));

    const html = await renderQuery({});

    expect(html).toContain("Todavía no hay hilos.");
    expect(html).toContain('href="/foro/c/general/nuevo"');
    expect(html).not.toContain("¿No encuentra su duda?");
  });

  it("says there are no categories yet instead of offering a thread nobody can place", async () => {
    const html = await renderQuery({});

    expect(html).toContain("Todavía no hay categorías.");
    expect(html).not.toContain("Nuevo hilo");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain('aria-label="Categoría"');
  });

  it("paginates and keeps the tab and the category in the links", async () => {
    seedForum();
    for (let index = 0; index < FORUM_THREADS_PAGE_SIZE + 2; index += 1) {
      testForum.store.threads.set(`bulk-${index}`, makeForumThread({ id: `bulk-${index}`, categoryId: "c3", title: `Propuesta ${index}`, lastActivityAt: minutesAgo(index) }));
    }

    const first = await renderQuery({ categoria: "propuestas" });
    const last = await renderQuery({ categoria: "propuestas", pagina: "99" });

    expect(first).toContain("Página 1 de 2");
    expect(first).toContain('href="/foro?categoria=propuestas&amp;pagina=2"');
    expect(last).toContain("Página 2 de 2");
    expect(last).toContain('href="/foro?categoria=propuestas"');
  });

  it("does not offer registrations as a block of the home: no aside, no event links, whatever is open", async () => {
    seedForum();
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", registrationCapacity: 60, date: "2099-11-28" });

    const html = await renderQuery({});

    expect(html).not.toContain("Inscripciones abiertas");
    expect(html).not.toContain('href="/inscripciones/');
    expect(html).not.toContain("Taller de Docker");
    expect(html).not.toContain("open-registrations-title");
    expect(html.match(/<aside/g)).toHaveLength(1);
  });

  it("puts Inscripciones in its own group of the rail, with the number of events open, apart from the categories", async () => {
    seedForum();
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });
    await addTestEvent({ title: "Hackathon UNL", registrationMode: "unl", date: "2099-12-05" });
    await addTestEvent({ title: "Charla abierta al público", registrationMode: "open" });
    await addTestEvent({ title: "Taller que ya pasó", registrationMode: "unl", date: "2020-01-10" });

    const html = await renderQuery({});
    const group = html.match(/<h2[^>]*>Eventos<\/h2><nav aria-label="Eventos">[\s\S]*?<\/nav>/)?.[0] ?? "";

    expect(group).toMatch(/<a [^>]*href="\/foro\/eventos"[^>]*>[\s\S]*?Inscripciones<span[^>]*>2<span class="sr-only"> abiertas<\/span><\/span>/);
    expect(group).not.toContain("aria-current");
    expect(html.indexOf("Categorías</h2>")).toBeLessThan(html.indexOf("Eventos</h2>"));
    expect(html.indexOf('href="/foro?categoria=propuestas"')).toBeLessThan(html.indexOf("Eventos</h2>"));
  });

  it("says Inscripciones with a count of zero while no event is open, and keeps the guide to the forum", async () => {
    seedForum();
    await addTestEvent({ title: "Charla abierta al público", registrationMode: "open" });

    const html = await renderQuery({});

    expect(html).toMatch(/href="\/foro\/eventos"[^>]*>[\s\S]*?Inscripciones<span[^>]*>0<span class="sr-only"> abiertas<\/span>/);
    expect(html).toContain("Cómo funciona el foro");
  });

  it("keeps a way to Inscripciones on phones, under the filters that lg up move to the rail", async () => {
    seedForum();
    await addTestEvent({ title: "Taller de Docker", registrationMode: "unl", date: "2099-11-28" });

    const html = await renderQuery({});
    const phones = html.match(/<div class="[^"]*\blg:hidden\b[^"]*">[\s\S]*?<\/nav><\/div><\/div>/)?.[0] ?? "";

    expect(html.match(/aria-label="Eventos"/g)).toHaveLength(2);
    expect(phones).toContain('href="/foro/eventos"');
    expect(phones).toContain("Inscripciones");
  });

  it("is a rail with the filters and the categories beside the list, with the guide after it", async () => {
    seedForum();
    testForum.store.categories.set("c2", makeForumCategory({ id: "c2", slug: "materias", name: "Materias", sortOrder: 2, description: "Dudas de las materias" }));

    const html = await renderQuery({});
    const rail = html.match(/<h2[^>]*>Categorías<\/h2>[\s\S]*?<\/nav>/)?.[0] ?? "";

    expect(html).toContain("data-wide");
    expect(rail).toContain('aria-label="Categoría"');
    expect(rail).toMatch(/href="\/foro"[^>]*>[\s\S]*?Todas/);
    expect(rail).toMatch(/href="\/foro\?categoria=materias"[^>]*>[\s\S]*?Materias[\s\S]*?<span class="font-mono[^>]*>2<span class="sr-only"> hilos<\/span>[\s\S]*?Dudas de las materias/);
    expect(rail).toContain('href="/foro?categoria=propuestas"');
    expect(html.indexOf("Categorías</h2>")).toBeLessThan(html.indexOf('href="/foro/hilo/'));
    expect(html.indexOf('href="/foro/hilo/')).toBeLessThan(html.indexOf("Cómo funciona el foro"));
  });

  it("explains how the forum works with what it really does: ask, mark the best answer, report", async () => {
    seedForum();

    const guide = (await renderQuery({})).match(/<aside[^>]*aria-labelledby="how-it-works-title"[^>]*>[\s\S]*?<\/aside>/)?.[0] ?? "";

    expect(guide).toContain("Cómo funciona el foro");
    expect(guide).toContain("Pregunte");
    expect(guide).toContain("Marque la mejor respuesta");
    expect(guide).toContain("Reporte lo que incumpla las reglas");
    expect(guide.match(/<li/g)).toHaveLength(3);
  });

  it("keeps the filters on top of the list for phones and moves them to the rail from lg up", async () => {
    seedForum();

    const html = await renderQuery({});

    expect(html.match(/aria-label="Estado de los hilos"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Categoría"/g)).toHaveLength(2);
    expect(html).toMatch(/<div class="[^"]*\blg:hidden\b[^"]*">[\s\S]*?<nav aria-label="Estado de los hilos"/);
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*\blg:grid\b[^"]*"><nav aria-label="Estado de los hilos"/);
  });

  it("ends a list that has threads with a prompt to start one, after the list on its branch line, and not on an empty list", async () => {
    seedForum();

    const html = await renderQuery({});
    const prompt = html.match(/<div class="thread-graph-end[^"]*">[\s\S]*?¿No encuentra su duda\?[\s\S]*?Nuevo hilo/)?.[0] ?? "";

    expect(prompt).toContain("Abra un hilo");
    expect(html.indexOf("</ul>")).toBeLessThan(html.indexOf("thread-graph-end"));
    expect(html.lastIndexOf('href="/foro/hilo/')).toBeLessThan(html.indexOf("¿No encuentra su duda?"));
    expect(await renderQuery({ categoria: "propuestas" })).not.toContain("¿No encuentra su duda?");
  });

  it("sets the list as a branch of the history graph with a header over its columns, and says each column in words", async () => {
    seedForum();

    const html = await renderQuery({});
    const header = html.match(/<div aria-hidden="true" class="thread-cols[^"]*">[\s\S]*?<\/div>/)?.[0] ?? "";

    expect(html).toContain('class="thread-graph"');
    for (const column of ["Hilo", "Autor", "Última actividad", "Respuestas"]) expect(header).toContain(`>${column}<`);
    // Phones read the same words in one line under the title; from xl up each has its own column.
    expect(html).toContain("Kevin L.");
    expect(html).toContain("actividad </span>");
  });

  it("falls back to the sign-in when the session was revoked", async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar()).jar);
    expect(await renderHome()).not.toContain("Entrar con Google");
    for (const record of testForum.sessions.sessions.values()) record.revokedAt = new Date();

    expect(await renderHome()).toContain("Entrar con Google");
  });
});

describe("the forum layout", () => {
  it("names the signed-in member and offers to sign out", async () => {
    cookiesMock.mockResolvedValue((await forumMemberJar({ displayName: "Daniela P." })).jar);

    const html = await renderLayout();

    expect(html).toContain("Daniela P.");
    expect(html).toContain(">DP<");
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain("contenido");
  });

  it("shows no member and no sign-out to a visitor, and keeps the skip link and the main landmark", async () => {
    const html = await renderLayout();

    expect(html).not.toContain("Cerrar sesión");
    expect(html).toContain('href="#main"');
    expect(html).toContain('<main id="main"');
  });

  it("is a reading column by default and widens only for the pages that mark themselves", async () => {
    const main = (await renderLayout()).match(/<main[^>]*>/)?.[0] ?? "";

    expect(main).toContain("max-w-[62rem]");
    expect(main).toContain("has-[[data-wide]]:max-w-none");
    expect(main).toContain("has-[[data-bleed]]:max-w-none");
  });
});
