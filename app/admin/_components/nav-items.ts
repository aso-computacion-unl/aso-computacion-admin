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

/** The eleven content modules, in the order the board uses them most. Home is reached from the logo. */
export const MODULE_NAV: readonly NavItem[] = [
  { href: "/admin/events", label: "Eventos", icon: "events", action: { href: "/admin/events/new", label: "Nuevo evento" } },
  { href: "/admin/news", label: "Novedades", icon: "news", action: { href: "/admin/news/new", label: "Nueva noticia" } },
  { href: "/admin/faqs", label: "FAQ", icon: "faq", action: { href: "/admin/faqs/new", label: "Nueva pregunta" } },
  { href: "/admin/commands", label: "Comandos", icon: "merge", action: { href: "/admin/commands/new", label: "Nuevo comando" } },
  { href: "/admin/board", label: "Directiva", icon: "board", action: { href: "/admin/board/new", label: "Agregar integrante" } },
  { href: "/admin/pillars", label: "Pilares", icon: "pillars", action: { href: "/admin/pillars/new", label: "Nuevo pilar" } },
  { href: "/admin/socials", label: "Redes", icon: "share", action: { href: "/admin/socials/new", label: "Agregar red" } },
  { href: "/admin/sponsors", label: "Aliados", icon: "image", action: { href: "/admin/sponsors/new", label: "Nuevo aliado" } },
  { href: "/admin/settings", label: "Sitio", icon: "site", adminOnly: true, action: { href: "/admin/settings", label: "Editar textos" } },
];

export const HOME_NAV: NavItem = { href: "/admin", label: "Inicio", icon: "home" };

/** Every stored image and where it is used. Read only for everyone; not a content module, so no home card. */
export const MEDIA_NAV: NavItem = { href: "/admin/medios", label: "Medios", icon: "image" };

/** The registrants of every event in one place. Counts only, open to editors and admins like each event's own page; not a content module (no home card). */
export const REGISTRATIONS_NAV: NavItem = { href: "/admin/registrations", label: "Inscripciones", icon: "list" };

/** Where deleted content waits for a restore. Not a content module: it has no card on the home. */
export const TRASH_NAV: NavItem = { href: "/admin/papelera", label: "Papelera", icon: "trash" };

/** The forum's report queue: moderation is open to editors and admins, and it is not a content module (no home card). */
export const FORUM_NAV: NavItem = { href: "/admin/foro/reportes", label: "Foro", icon: "alert" };

/** Preview codes and sessions are for everyone (an editor sees and revokes their own sessions); users and the audit log are the admin's. */
export const ACCOUNT_NAV: readonly NavItem[] = [
  { href: "/admin/vista-previa", label: "Vista previa", icon: "eye" },
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

export interface NavGroup {
  /** Shown above the group in the sidebar; the home stands alone, without one. */
  label: string | null;
  items: NavItem[];
}

/** The sidebar in groups: the home, what the landing shows, the tools around it, and the account. */
export function sideNavGroups(role: Role): NavGroup[] {
  return [
    { label: null, items: [HOME_NAV] },
    { label: "landing", items: visibleTo(MODULE_NAV, role) },
    { label: "herramientas", items: [MEDIA_NAV, REGISTRATIONS_NAV, TRASH_NAV, FORUM_NAV] },
    { label: "cuenta", items: visibleTo(ACCOUNT_NAV, role) },
  ];
}

/** The whole sidebar, in order. */
export function sideNav(role: Role): NavItem[] {
  return sideNavGroups(role).flatMap((group) => group.items);
}

/** Everything else (and the home) lives in the "Más" sheet: it changes rarely. */
export function moreNav(role: Role): NavItem[] {
  return [HOME_NAV, ...visibleTo(MODULE_NAV, role).filter((item) => !TAB_HREFS.includes(item.href)), MEDIA_NAV, REGISTRATIONS_NAV, TRASH_NAV, FORUM_NAV, ...visibleTo(ACCOUNT_NAV, role)];
}
