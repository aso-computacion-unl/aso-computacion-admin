import type { IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** What the board does most in this module, offered as a button on its card on the home. */
  action?: { href: string; label: string };
}

/** The six content modules, in the order the board uses them most. Home is reached from the logo. */
export const MODULE_NAV: readonly NavItem[] = [
  { href: "/admin/events", label: "Eventos", icon: "events", action: { href: "/admin/events/new", label: "Nuevo evento" } },
  { href: "/admin/faqs", label: "FAQ", icon: "faq", action: { href: "/admin/faqs/new", label: "Nueva pregunta" } },
  { href: "/admin/board", label: "Directiva", icon: "board", action: { href: "/admin/board/new", label: "Agregar integrante" } },
  { href: "/admin/pillars", label: "Pilares", icon: "pillars", action: { href: "/admin/pillars/new", label: "Nuevo pilar" } },
  { href: "/admin/socials", label: "Redes", icon: "share", action: { href: "/admin/socials/new", label: "Agregar red" } },
  { href: "/admin/settings", label: "Sitio", icon: "site", action: { href: "/admin/settings", label: "Editar textos" } },
];

export const HOME_NAV: NavItem = { href: "/admin", label: "Inicio", icon: "home" };
