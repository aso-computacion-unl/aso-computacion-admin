import { createPrismaClient } from "@/infrastructure/prisma/create-client";
import { expect, test, type Page } from "@playwright/test";

/*
 * Journey F11 / decision D6: the members list for moderators at `/admin/foro/miembros`. List, search by name or
 * email, the "Suspendidos" filter and «Reactivar la cuenta» (the report queue's own action, audited and with the
 * same messages), for an editor, with a visitor sent to the login. The members are planted straight in the
 * database (a student cannot sign in with Google here); every search carries the `fmiem` prefix of their emails,
 * so rows other specs leave behind never get in the way, and this spec removes its rows (and their audit
 * entries) at the end.
 */
const prisma = createPrismaClient(process.env.DATABASE_URL);
const EDITOR_SESSION = process.env.E2E_EDITOR_SESSION ?? "";
const BASE_URL = "http://127.0.0.1:3100";
const LIST = "/admin/foro/miembros";
const MEMBERS = {
  marta: { id: "fmiem-marta", name: "Marta Activa E2E", status: "ACTIVE" },
  nelson: { id: "fmiem-nelson", name: "Nelson Suspendido E2E", status: "SUSPENDED" },
  olga: { id: "fmiem-olga", name: "Olga Suspendida E2E", status: "SUSPENDED" },
} as const;
const IDS = Object.values(MEMBERS).map((member) => member.id);

test.beforeAll(async () => {
  expect(EDITOR_SESSION, "run the suite with `npm run e2e`").not.toBe("");
  await cleanUp();

  for (const member of Object.values(MEMBERS)) {
    await prisma.forumMember.create({
      data: {
        id: member.id,
        email: `${member.id}@unl.edu.ec`,
        googleSub: `sub-${member.id}`,
        displayName: member.name,
        status: member.status,
        suspendedAt: member.status === "SUSPENDED" ? new Date("2026-10-10T15:00:00Z") : null,
        createdAt: new Date("2026-10-01T15:00:00Z"),
        lastLoginAt: member.id === MEMBERS.marta.id ? new Date("2026-10-20T15:00:00Z") : null,
      },
    });
  }
});

test.afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function cleanUp() {
  await prisma.auditLog.deleteMany({ where: { entityType: "forum_member", entityId: { in: IDS } } });
  await prisma.forumMember.deleteMany({ where: { id: { in: IDS } } });
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "admin_session", value: EDITOR_SESSION, url: BASE_URL }]);
});

const members = (page: Page) => page.getByRole("table", { name: "Miembros del foro" });
/** The body rows of the table: each has its member's name as the row header. */
const rows = (page: Page) => members(page).getByRole("row").filter({ has: page.getByRole("rowheader") });

test("an editor sees each member with name, email, status and dates, and can reach the list from the report queue", async ({ page }) => {
  await page.goto("/admin/foro/reportes");
  await page.getByRole("link", { name: "Miembros" }).click();
  await expect(page).toHaveURL(/\/admin\/foro\/miembros$/);
  await expect(page.getByRole("heading", { level: 1, name: "Miembros del foro" })).toBeVisible();

  await page.goto(`${LIST}?q=fmiem`);
  await expect(members(page).getByRole("columnheader")).toHaveText(["Miembro", "Se unió", "Último ingreso", "Estado", "Acción"]);
  const marta = rows(page).filter({ hasText: MEMBERS.marta.name });

  await expect(marta.getByRole("rowheader")).toContainText(`${MEMBERS.marta.id}@unl.edu.ec`);
  await expect(marta.getByRole("cell").nth(0)).toHaveText(/1 oct 2026$/);
  await expect(marta.getByRole("cell").nth(1)).toHaveText(/20 oct 2026$/);
  await expect(marta.getByRole("cell").nth(2)).toHaveText("Activo");
  await expect(marta.getByRole("button", { name: /Reactivar/ })).toHaveCount(0);

  const nelson = rows(page).filter({ hasText: MEMBERS.nelson.name });

  await expect(nelson.getByRole("cell").nth(1)).toHaveText("Sin ingresos registrados");
  await expect(nelson.getByRole("cell").nth(2)).toContainText("Suspendido");
  await expect(nelson.getByRole("cell").nth(2)).toContainText("el 10 oct 2026");
  await expect(nelson.getByRole("button", { name: `Reactivar la cuenta: ${MEMBERS.nelson.name}` })).toBeVisible();
  // The Google id is never on the page.
  await expect(page.locator("body")).not.toContainText("sub-fmiem");
});

test("searching finds a member by name or by email, says when nobody matches and clears the search", async ({ page }) => {
  await page.goto(LIST);
  await page.getByRole("searchbox", { name: "Buscar por nombre o correo" }).fill("marta activa");
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page).toHaveURL(/\?q=marta\+activa$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByText(MEMBERS.marta.name)).toBeVisible();
  await expect(page.getByText("1 resultado para «marta activa».")).toBeVisible();

  await page.goto(`${LIST}?q=FMIEM-OLGA@`);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByText(MEMBERS.olga.name)).toBeVisible();

  await page.goto(`${LIST}?q=nadie-se-llama-asi-e2e`);
  await expect(page.getByText("No hay miembros que coincidan con «nadie-se-llama-asi-e2e».")).toBeVisible();
  await page.getByRole("link", { name: "Quitar la búsqueda" }).click();
  await expect(page).toHaveURL(/\/admin\/foro\/miembros$/);
});

test("the Suspendidos filter lists only suspended accounts and keeps the search", async ({ page }) => {
  await page.goto(`${LIST}?q=fmiem`);
  await expect(rows(page)).toHaveCount(3);

  await page.getByRole("link", { name: "Suspendidos" }).click();
  await expect(page).toHaveURL(/\?estado=suspendidos&q=fmiem$/);
  await expect(page.getByRole("link", { name: "Suspendidos" })).toHaveAttribute("aria-current", "true");
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByText(MEMBERS.marta.name)).toHaveCount(0);

  await page.getByRole("link", { name: "Todos" }).click();
  await expect(rows(page)).toHaveCount(3);

  await page.goto(`${LIST}?estado=suspendidos&q=marta`);
  await expect(page.getByText("No hay miembros suspendidos que coincidan con «marta».")).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the rows stack, keep their dates and button, and the page never scrolls sideways", async ({ page }) => {
    await page.goto(`${LIST}?q=fmiem`);
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).filter({ hasText: MEMBERS.marta.name })).toContainText("Se unió el 1 oct 2026");
    await expect(page.getByRole("button", { name: `Reactivar la cuenta: ${MEMBERS.olga.name}` })).toBeVisible();

    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));

    expect(width.scroll, "the members list scrolls sideways").toBeLessThanOrEqual(width.client);
  });
});

test("an editor reactivates a suspended account: the change is stored, audited and the row leaves the filter", async ({ page }) => {
  await page.goto(`${LIST}?estado=suspendidos&q=fmiem`);
  await page.getByRole("button", { name: `Reactivar la cuenta: ${MEMBERS.nelson.name}` }).click();

  await expect(page.getByText("Cuenta reactivada.")).toBeVisible();
  await expect(page.getByText(MEMBERS.nelson.name)).toHaveCount(0);
  await expect(page.getByText(MEMBERS.olga.name)).toBeVisible();

  const row = await prisma.forumMember.findUniqueOrThrow({ where: { id: MEMBERS.nelson.id } });

  expect(row.status).toBe("ACTIVE");
  expect(row.suspendedAt).toBeNull();

  const entries = await prisma.auditLog.findMany({ where: { entityType: "forum_member", entityId: MEMBERS.nelson.id } });

  expect(entries.map((entry) => entry.action)).toEqual(["forum.member.reactivate"]);
  expect(entries[0]?.summary).not.toContain("@");

  await page.goto(`${LIST}?q=fmiem-nelson`);
  await expect(rows(page)).toContainText("Activo");
});

test("reactivating an account somebody else already reactivated says nothing changed and audits nothing", async ({ page }) => {
  await page.goto(`${LIST}?estado=suspendidos&q=fmiem-olga`);
  // Another moderator got there first, after this page was loaded.
  await prisma.forumMember.update({ where: { id: MEMBERS.olga.id }, data: { status: "ACTIVE", suspendedAt: null } });

  await page.getByRole("button", { name: `Reactivar la cuenta: ${MEMBERS.olga.name}` }).click();

  await expect(page.getByText("Sin cambios: otra persona ya lo había hecho.")).toBeVisible();
  expect(await prisma.auditLog.count({ where: { entityType: "forum_member", entityId: MEMBERS.olga.id } })).toBe(0);
});

test("a visitor without a session is sent to the login", async ({ browser }) => {
  const visitor = await browser.newContext({ baseURL: BASE_URL });
  const page = await visitor.newPage();

  await page.goto(LIST);
  await expect(page).toHaveURL(/\/login/);
  await visitor.close();
});
