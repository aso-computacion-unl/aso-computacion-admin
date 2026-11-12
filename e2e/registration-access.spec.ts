import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

import { FORUM_SESSION_SECRET, plantForumMemberSession } from "./support/forum-session";

/*
 * The public list `/inscripciones` as a long list (inscripciones-acceso): the header that stays in view, the month
 * filter as ticket stubs, the rows grouped by month with their action, the lead, both themes, and the optional UNL
 * access in the header. Events are seeded straight into the database under a unique prefix (removed at the end), in
 * 2097 and 2098 so that the list always spans two years and the months carry their year. The signed-in part plants a
 * member session and runs only with FORUM_SESSION_SECRET; the harness never configures a Google client, so the
 * visitor's "Entrar" is checked absent here (it is shown only when the sign-in is configured; see the unit tests).
 */
const STAMP = Date.now().toString(36);
const PREFIX = `ra-${STAMP}-`;
const prisma = createPrismaClient(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

interface Seeded {
  slug: string;
  title: string;
}

async function seedEvent(name: string, overrides: Partial<Prisma.EventUncheckedCreateInput>): Promise<Seeded> {
  const slug = `${PREFIX}${name}`;
  const title = `Acceso ${name} ${STAMP}`;

  await prisma.event.create({ data: { id: slug, slug, hora: "09:00 - 12:00", lugar: "Laboratorio 2", isPublished: true, registrationMode: "open", updatedAt: new Date(), ...overrides, title } });

  return { slug, title };
}

let marchOpen: Seeded;
let marchUnl: Seeded;
let april: Seeded;
let january: Seeded;

test.beforeAll(async () => {
  marchOpen = await seedEvent("marzo-abierto", { date: new Date("2097-03-05"), registrationCapacity: 20 });
  marchUnl = await seedEvent("marzo-unl", { date: new Date("2097-03-12"), registrationMode: "unl" });
  april = await seedEvent("abril", { date: new Date("2097-04-02") });
  january = await seedEvent("enero", { date: new Date("2098-01-16"), registrationMode: "unl" });
});

test.afterAll(async () => {
  await prisma.event.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

const row = (page: Page, event: Seeded) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name: event.title }) });
const filter = (page: Page) => page.getByRole("navigation", { name: "Filtrar por mes" });

test.describe("the list for a visitor", () => {
  test("S4 / S5: the month stubs filter the list, which groups its rows under a heading per month", async ({ page }) => {
    await page.goto("/inscripciones");

    const all = filter(page).getByRole("button", { name: /^Todos/ });
    const march = filter(page).getByRole("button", { name: /^Marzo 2097/ });

    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(march).toContainText("2 eventos");
    await expect(filter(page).getByRole("button", { name: /^Abril 2097/ })).toContainText("1 evento");
    await expect(page.getByRole("status")).toHaveText(/^Mostrando los \d+ eventos$/);
    await expect(page.getByRole("heading", { level: 2, name: "Marzo 2097" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Enero 2098" })).toBeVisible();

    // Soonest first, under its month.
    const titles = await page.getByRole("heading", { level: 3 }).allTextContents();

    expect(titles.indexOf(marchOpen.title)).toBeLessThan(titles.indexOf(marchUnl.title));
    expect(titles.indexOf(marchUnl.title)).toBeLessThan(titles.indexOf(april.title));
    expect(titles.indexOf(april.title)).toBeLessThan(titles.indexOf(january.title));

    await march.click();

    await expect(march).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("status")).toHaveText("Mostrando 2 eventos de marzo de 2097");
    await expect(page.getByRole("link", { name: marchOpen.title })).toBeVisible();
    await expect(page.getByRole("link", { name: marchUnl.title })).toBeVisible();
    await expect(page.getByRole("link", { name: april.title })).toBeHidden();
    await expect(page.getByRole("heading", { level: 2, name: "Enero 2098" })).toBeHidden();

    // Pressed, the stub is torn off in red and lifted.
    expect(await march.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(183, 53, 62)");
    expect(await march.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");

    await all.click();
    await expect(page.getByRole("link", { name: april.title })).toBeVisible();
  });

  test("S4: the pressed stub does not move when the person asks for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/inscripciones");

    const march = filter(page).getByRole("button", { name: /^Marzo 2097/ });

    await march.click();
    await expect(march).toHaveAttribute("aria-pressed", "true");
    expect(await march.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  });

  test("S5 / S6 / S7: each row says who can register and leads to the event's page, under a lead that reads whole", async ({ page }) => {
    await page.goto("/inscripciones");

    await expect(page.getByText("Talleres, charlas y encuentros de la carrera. Reserve su cupo en un minuto.")).toBeVisible();
    await expect(row(page, marchOpen)).toContainText("Abierto al público");
    await expect(row(page, marchOpen)).toContainText("Quedan 20 cupos");
    await expect(row(page, marchUnl)).toContainText("Cuenta UNL");
    await expect(row(page, marchOpen).getByRole("link", { name: "Inscribirme", exact: true })).toHaveAttribute("href", `/inscripciones/${marchOpen.slug}`);
    await expect(row(page, marchUnl).getByRole("link", { name: "Entrar para inscribirme" })).toHaveAttribute("href", `/inscripciones/${marchUnl.slug}`);

    // The open events need no account: the action reaches the event's page and its form.
    await row(page, marchOpen).getByRole("link", { name: "Inscribirme", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/inscripciones/${marchOpen.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: marchOpen.title })).toBeVisible();
  });

  test("S1: without a configured sign-in the header offers none, and the page asks for no account", async ({ page }) => {
    await page.goto("/inscripciones");

    const bar = page.getByRole("banner");

    await expect(bar.getByRole("link", { name: /Entrar/ })).toHaveCount(0);
    await expect(bar.locator("[data-theme-toggle]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Inscripciones" })).toBeVisible();
  });

  test("S3: the header stays in view while the list scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await page.goto("/inscripciones");
    await page.getByRole("link", { name: january.title }).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 4000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const box = await page.getByRole("banner").boundingBox();

    expect(box?.y).toBe(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "Inscripciones de ASO Computación, inicio" })).toBeInViewport();
  });

  test("S8: the light theme repaints the page around the paper, with the project's tokens", async ({ page }) => {
    // The theme the person chose before (the toggle stores it), read before the first paint.
    await page.addInitScript(() => window.localStorage.setItem("aso-theme", "light"));
    await page.goto("/inscripciones");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const color = (selector: string, property: "color" | "backgroundColor") => page.locator(selector).first().evaluate((element, key) => getComputedStyle(element)[key], property);

    // The month heading takes the light theme's mist; the stubs and rows stay paper.
    expect(await color(".reg-month-title", "color")).toBe("rgb(69, 85, 109)");
    expect(await color(".reg-stub[aria-pressed='false']", "backgroundColor")).toBe("rgb(255, 255, 255)");
    expect(await color(".reg-stub[aria-pressed='true']", "backgroundColor")).toBe("rgb(183, 53, 62)");
    expect(await color(".reg-card", "backgroundColor")).toBe("rgb(255, 255, 255)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("S2 / S5: on a phone the rows stack and nothing scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/inscripciones");
    await expect(page.getByRole("link", { name: marchOpen.title })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe("the list for a signed-in student", () => {
  test.skip(!FORUM_SESSION_SECRET, "set FORUM_SESSION_SECRET to plant a forum member session");

  const memberId = `${PREFIX}maria`;

  test.afterAll(async () => {
    await prisma.forumSession.deleteMany({ where: { memberId } });
    await prisma.forumMember.deleteMany({ where: { id: memberId } });
  });

  test("S2 / S6 / S7: the header names them with a menu that closes with Escape, and the sign-out leaves them on the list", async ({ page, context }) => {
    const member = await plantForumMemberSession(prisma, { memberId, displayName: "María Cuenca", email: `${memberId}@unl.edu.ec` });

    await context.addCookies([member.cookie]);
    await page.goto("/inscripciones");

    await expect(page.getByText("Talleres, charlas y encuentros de la carrera. Con su cuenta UNL se inscribe con un clic.")).toBeVisible();
    await expect(row(page, marchUnl).getByRole("link", { name: "Inscribirme", exact: true })).toHaveAttribute("href", `/inscripciones/${marchUnl.slug}`);
    await expect(page.getByRole("link", { name: "Entrar para inscribirme" })).toHaveCount(0);

    const account = page.getByRole("banner").getByRole("button", { name: /María Cuenca/ });

    await account.click();
    await expect(account).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(member.email)).toBeVisible();
    await expect(page.getByText("Su sesión sigue abierta 30 días en este navegador. En una computadora compartida, ciérrela al terminar.")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(account).toHaveAttribute("aria-expanded", "false");
    await expect(account).toBeFocused();
    await expect(page.getByText(member.email)).toBeHidden();

    await account.click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/inscripciones$/);
    await expect(page.getByText("Talleres, charlas y encuentros de la carrera. Reserve su cupo en un minuto.")).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: /María Cuenca/ })).toHaveCount(0);
    expect((await prisma.forumSession.findUnique({ where: { id: member.sessionId } }))?.revokedAt).not.toBeNull();
  });

  test("S2: on a phone the account shows only the initials, and the name and email stay in the menu", async ({ page, context }) => {
    const member = await plantForumMemberSession(prisma, { memberId, displayName: "María Cuenca", email: `${memberId}@unl.edu.ec` });

    await context.addCookies([member.cookie]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/inscripciones");

    const account = page.getByRole("banner").getByRole("button", { name: /María Cuenca/ });

    await expect(account).toBeVisible();
    await expect(account).toHaveText("MC", { useInnerText: true });

    await account.click();
    await expect(page.getByText(member.email)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
