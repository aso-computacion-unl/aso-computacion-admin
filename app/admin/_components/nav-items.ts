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

/** The eight content modules, in the order the board uses them most. Home is reached from the logo. */
export const MODULE_NAV: readonly NavItem[] = [
  { href: "/admin/events", label: "Eventos", icon: "events", action: { href: "/admin/events/new", label: "Nuevo evento" } },
  { href: "/admin/news", label: "Novedades", icon: "news", action: { href: "/admin/news/new", label: "Nueva noticia" } },
  { href: "/admin/faqs", label: "FAQ", icon: "faq", action: { href: "/admin/faqs/new", label: "Nueva pregunta" } },
  { href: "/admin/commands", label: "Comandos", icon: "merge", action: { href: "/admin/commands/new", label: "Nuevo comando" } },
  { href: "/admin/board", label: "Directiva", icon: "board", action: { href: "/admin/board/new", label: "Agregar integrante" } },
  { href: "/admin/pillars", label: "Pilares", icon: "pillars", action: { href: "/admin/pillars/new", label: "Nuevo pilar" } },
  { href: "/admin/socials", label: "Redes", icon: "share", action: { href: "/admin/socials/new", label: "Agregar red" } },
  { href: "/admin/settings", label: "Sitio", icon: "site", adminOnly: true, action: { href: "/admin/settings", label: "Editar textos" } },
];

export const HOME_NAV: NavItem = { href: "/admin", label: "Inicio", icon: "home" };

/** Where deleted content waits for a restore. Not a content module: it has no card on the home. */
export const TRASH_NAV: NavItem = { href: "/admin/papelera", label: "Papelera", icon: "trash" };

/** Sessions are for everyone (an editor sees and revokes their own); users and the audit log are the admin's. */
export const ACCOUNT_NAV: readonly NavItem[] = [
  { href: "/admin/sesiones", label: "Sesiones", icon: "eye" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "board", adminOnly: true },
  { href: "/admin/registro", label: "Registro", icon: "news", adminOnly: true },
];

export function visibleTo(items: readonly NavItem[], role: Role): NavItem[] {
  return items.filter((item) => !item.adminOnly || role === "ADMIN");
}

/** The modules on the phone's tab bar, in tab order: the ones the board uses after every event. */
const TAB_HREFS = ["/admin/events", "/admin/news", "/admin/board", "/admin/faqs"];

export const TAB_NAV: readonly NavItem[] = TAB_HREFS.flatMap((href) => MODULE_NAV.filter((item) => item.href === href));

/** The whole sidebar, in order. */
export function sideNav(role: Role): NavItem[] {
  return [HOME_NAV, ...visibleTo(MODULE_NAV, role), TRASH_NAV, ...visibleTo(ACCOUNT_NAV, role)];
}

/** Everything else (and the home) lives in the "Más" sheet: it changes rarely. */
export function moreNav(role: Role): NavItem[] {
  return [HOME_NAV, ...visibleTo(MODULE_NAV, role).filter((item) => !TAB_HREFS.includes(item.href)), TRASH_NAV, ...visibleTo(ACCOUNT_NAV, role)];
}
