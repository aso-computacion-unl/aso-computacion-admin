import type { IconName } from "@/components/icons";
import type { Role } from "@/domain/user";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** What the board does most in this module, offered as a button on its card on the home. */
  action?: { href: string; label: string };
  /** Hidden from editors (the page and its actions enforce it too; hiding is only courtesy). */
  adminOnly?: true;
}

/** The content modules the home offers as cards, in the order the board uses them most. Home is reached from the logo. */
export const MODULE_NAV: readonly NavItem[] = [
  { href: "/admin/events", label: "Eventos", icon: "events", action: { href: "/admin/events/new", label: "Nuevo evento" } },
  { href: "/admin/news", label: "Novedades", icon: "news", action: { href: "/admin/news/new", label: "Nueva noticia" } },
  { href: "/admin/faqs", label: "FAQ", icon: "faq", action: { href: "/admin/faqs/new", label: "Nueva pregunta" } },
  { href: "/admin/commands", label: "Comandos", icon: "merge", action: { href: "/admin/commands/new", label: "Nuevo comando" } },
  { href: "/admin/board", label: "Directiva", icon: "board", action: { href: "/admin/board/new", label: "Agregar integrante" } },
  { href: "/admin/pillars", label: "Pilares", icon: "pillars", action: { href: "/admin/pillars/new", label: "Nuevo pilar" } },
  { href: "/admin/socials", label: "Redes", icon: "share", action: { href: "/admin/socials/new", label: "Agregar red" } },
  { href: "/admin/sponsors", label: "Aliados", icon: "star", action: { href: "/admin/sponsors/new", label: "Nuevo aliado" } },
  { href: "/admin/settings", label: "Sitio", icon: "site", adminOnly: true, action: { href: "/admin/settings", label: "Editar textos" } },
];

export const HOME_NAV: NavItem = { href: "/admin", label: "Inicio", icon: "home" };

export function visibleTo(items: readonly NavItem[], role: Role): NavItem[] {
  return items.filter((item) => !item.adminOnly || role === "ADMIN");
}

export interface AreaNavItem extends NavItem {
  /**
   * The pages that keep this area lit. A path matches itself and everything under it (whole segments only);
   * `*` stands for one segment. When two areas match, the longest pattern wins, so the registrations of one
   * event (under /admin/events) light Inscripciones and not Landing.
   */
  matches: readonly string[];
}

/** The four areas of the rail and the phone's tab bar. All are open to editors; each page still enforces its own role. */
export const AREA_NAV: readonly AreaNavItem[] = [
  {
    href: "/admin/events",
    label: "Landing",
    icon: "site",
    matches: ["/admin/events", "/admin/news", "/admin/faqs", "/admin/board", "/admin/pillars", "/admin/commands", "/admin/sponsors", "/admin/socials"],
  },
  { href: "/admin/registrations", label: "Inscripciones", icon: "list", matches: ["/admin/registrations", "/admin/events/*/registrations"] },
  { href: "/admin/foro/reportes", label: "Foro", icon: "msg", matches: ["/admin/foro"] },
  {
    href: "/admin/ajustes",
    label: "Ajustes",
    icon: "users",
    matches: ["/admin/ajustes", "/admin/usuarios", "/admin/sesiones", "/admin/settings", "/admin/registro", "/admin/papelera"],
  },
];

export function areaNav(role: Role): AreaNavItem[] {
  return AREA_NAV.filter((item) => !item.adminOnly || role === "ADMIN");
}

/** The pattern's length when the path matches it, 0 when it does not. */
function matchLength(pathname: string, pattern: string): number {
  const source = pattern.split("*").join("[^/]+");

  return new RegExp(`^${source}(?:/|$)`).test(pathname) ? pattern.length : 0;
}

/** The area a page belongs to; undefined for the home and for pages outside every area. */
export function activeArea(pathname: string): AreaNavItem | undefined {
  let best: { item: AreaNavItem; length: number } | undefined;

  for (const item of AREA_NAV) {
    for (const pattern of item.matches) {
      const length = matchLength(pathname, pattern);

      if (length > (best?.length ?? 0)) best = { item, length };
    }
  }

  return best?.item;
}

/** The Ajustes tabs in order; the entry route lands on the first one the role can open. */
const AJUSTES_TABS: readonly NavItem[] = [
  { href: "/admin/usuarios", label: "Equipo", icon: "users", adminOnly: true },
  { href: "/admin/sesiones", label: "Mis sesiones", icon: "monitor" },
];

/** Where /admin/ajustes sends the role: its first visible tab, so an editor never lands on a page that bounces them home. */
export function ajustesTarget(role: Role): string {
  return visibleTo(AJUSTES_TABS, role)[0]?.href ?? "/admin/sesiones";
}
