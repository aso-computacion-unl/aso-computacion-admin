import type { IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/** The six content modules, in the order the board uses them most. Home is reached from the logo. */
export const MODULE_NAV: readonly NavItem[] = [
  { href: "/admin/events", label: "Eventos", icon: "events" },
  { href: "/admin/faqs", label: "FAQ", icon: "faq" },
  { href: "/admin/board", label: "Directiva", icon: "board" },
  { href: "/admin/pillars", label: "Pilares", icon: "pillars" },
  { href: "/admin/socials", label: "Redes", icon: "share" },
  { href: "/admin/settings", label: "Sitio", icon: "site" },
];

export const HOME_NAV: NavItem = { href: "/admin", label: "Inicio", icon: "home" };
