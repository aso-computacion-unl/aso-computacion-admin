import type { IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** What the board does most in this module, offered as a button on its card on the home. */
  action?: { href: string; label: string };
}

/** The seven content modules, in the order the board uses them most. Home is reached from the logo. */
export const MODULE_NAV: readonly NavItem[] = [
  { href: "/admin/events", label: "Eventos", icon: "events", action: { href: "/admin/events/new", label: "Nuevo evento" } },
  { href: "/admin/news", label: "Novedades", icon: "news", action: { href: "/admin/news/new", label: "Nueva noticia" } },
  { href: "/admin/faqs", label: "FAQ", icon: "faq", action: { href: "/admin/faqs/new", label: "Nueva pregunta" } },
  { href: "/admin/board", label: "Directiva", icon: "board", action: { href: "/admin/board/new", label: "Agregar integrante" } },
  { href: "/admin/pillars", label: "Pilares", icon: "pillars", action: { href: "/admin/pillars/new", label: "Nuevo pilar" } },
  { href: "/admin/socials", label: "Redes", icon: "share", action: { href: "/admin/socials/new", label: "Agregar red" } },
  { href: "/admin/settings", label: "Sitio", icon: "site", action: { href: "/admin/settings", label: "Editar textos" } },
];

export const HOME_NAV: NavItem = { href: "/admin", label: "Inicio", icon: "home" };

/** The modules on the phone's tab bar, in tab order: the ones the board uses after every event. */
const TAB_HREFS = ["/admin/events", "/admin/news", "/admin/board", "/admin/faqs"];

export const TAB_NAV: readonly NavItem[] = TAB_HREFS.flatMap((href) => MODULE_NAV.filter((item) => item.href === href));

/** Everything else (and the home) lives in the "Más" sheet: it changes rarely. */
export const MORE_NAV: readonly NavItem[] = [HOME_NAV, ...MODULE_NAV.filter((item) => !TAB_HREFS.includes(item.href))];
