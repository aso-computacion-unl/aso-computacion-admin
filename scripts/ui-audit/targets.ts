import type { PrismaClient } from "@/generated/prisma/client";
import type { Page } from "@playwright/test";

import { MODULE_NAV } from "../../app/admin/_components/nav-items";
import { ADMIN_URL, LANDING_URL, type Target } from "./config";

/** Every page the old sidebar listed: the home, the content modules and the pages behind the four areas. */
const ADMIN_ROUTES = [
  "/admin",
  ...MODULE_NAV.map((item) => item.href),
  "/admin/medios",
  "/admin/registrations",
  "/admin/papelera",
  "/admin/foro/reportes",
  "/admin/foro/categorias",
  "/admin/vista-previa",
  "/admin/sesiones",
  "/admin/usuarios",
  "/admin/registro",
];

const stem = (path: string) => path.replace(/^\/admin\/?/, "").replace(/\//g, "-") || "home";

/** The first `/…/edit` link of a list page, or null when the module is empty or has no edit page. */
async function firstEditPath(page: Page, listPath: string): Promise<string | null> {
  await page.goto(`${ADMIN_URL}${listPath}`, { waitUntil: "domcontentloaded", timeout: 90_000 });

  return page.locator('a[href$="/edit"]').first().getAttribute("href", { timeout: 5_000 }).catch(() => null);
}

export async function adminTargets(page: Page): Promise<Target[]> {
  const targets: Target[] = [];
  const add = (path: string, name: string, notes?: string) => targets.push({ area: "admin", name, url: `${ADMIN_URL}${path}`, auth: "admin", notes });

  for (const href of ADMIN_ROUTES) add(href, stem(href));
  add("/admin/medios/limpieza", "medios-limpieza", "Linked from Medios, not in the sidebar.");

  for (const item of MODULE_NAV) {
    if (!item.action?.href.endsWith("/new")) continue;

    const moduleName = stem(item.href);

    add(item.action.href, `${moduleName}-new`);

    const edit = await firstEditPath(page, item.href);

    if (edit) {
      add(edit, `${moduleName}-edit`);
      if (moduleName === "events") add(edit.replace(/\/edit$/, "/registrations"), "events-registrations");
    } else {
      targets.push({ area: "admin", name: `${moduleName}-edit`, url: `${ADMIN_URL}${item.href}`, auth: "admin", notes: "No edit link found on the list (empty list?); the list was captured instead." });
    }
  }

  targets.push({ area: "admin", name: "not-found", url: `${ADMIN_URL}/admin/does-not-exist`, auth: "admin", expectStatus: 404 });

  return targets;
}

export function loginTarget(): Target {
  return { area: "admin", name: "login", url: `${ADMIN_URL}/login`, auth: "none", notes: "No session." };
}

export async function forumTargets(prisma: PrismaClient): Promise<Target[]> {
  const base = `${ADMIN_URL}/foro`;
  const targets: Target[] = [
    { area: "forum", name: "sign-in", url: base, auth: "none", notes: "No forum cookie: the sign-in gate." },
    { area: "forum", name: "home", url: base, auth: "forum" },
  ];

  const categories = await prisma.forumCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { slug: true } });
  const threads = await prisma.forumThread.findMany({ orderBy: { lastActivityAt: "desc" }, select: { id: true, title: true } });
  // Only the `unl` mode has a forum page; `open` events register through the landing form.
  const events = await prisma.event.findMany({ where: { deletedAt: null, registrationMode: "unl" }, orderBy: { createdAt: "asc" }, select: { slug: true } });

  for (const { slug } of categories) targets.push({ area: "forum", name: `category-${slug}`, url: `${base}/c/${slug}`, auth: "forum" });
  if (categories[0]) {
    targets.push({ area: "forum", name: `category-${categories[0].slug}-resolved`, url: `${base}/c/${categories[0].slug}?estado=resueltos`, auth: "forum", notes: "The Resueltos tab, usually an empty state." });
    targets.push({ area: "forum", name: `new-thread-${categories[0].slug}`, url: `${base}/c/${categories[0].slug}/nuevo`, auth: "forum" });
  }
  threads.forEach(({ id }, index) => targets.push({ area: "forum", name: `thread-${index + 1}`, url: `${base}/hilo/${id}`, auth: "forum", notes: `Thread ${index + 1} of ${threads.length} by recent activity.` }));
  for (const { slug } of events) {
    targets.push({ area: "forum", name: `event-${slug}`, url: `${base}/eventos/${slug}`, auth: "forum" });
    targets.push({ area: "forum", name: `event-${slug}-signed-out`, url: `${base}/eventos/${slug}`, auth: "none", notes: "No forum cookie." });
  }
  targets.push({ area: "forum", name: "not-found", url: `${base}/hilo/does-not-exist`, auth: "forum", expectStatus: 404 });

  return targets;
}

/** The landing's home, its English home and every top-level page its markup links, plus one detail page per section. */
export async function landingTargets(page: Page): Promise<Target[]> {
  await page.goto(`${LANDING_URL}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  const paths = new Set<string>();

  for (const href of hrefs) {
    const url = new URL(href);

    if (url.origin === LANDING_URL) paths.add(url.pathname);
  }

  const sorted = [...paths].sort((a, b) => a.localeCompare(b, "en"));
  const sections = new Map<string, string>();

  // Top-level pages (`/novedades`, `/en/`) all count; for a detail page (`/novedades/x`) only the first of its section does.
  const targets: Target[] = [{ area: "landing", name: "home", url: `${LANDING_URL}/`, auth: "none" }];

  for (const path of sorted) {
    const segments = path.split("/").filter(Boolean);

    if (segments.length === 0) continue;

    const isTop = segments.length === 1 || path === "/en/";
    const section = segments[0] ?? "";

    if (!isTop) {
      if (sections.has(section)) continue;
      sections.set(section, path);
    }

    targets.push({ area: "landing", name: segments.join("-"), url: `${LANDING_URL}${path}`, auth: "none", notes: isTop ? undefined : "First detail page of its section." });
  }

  return targets;
}
