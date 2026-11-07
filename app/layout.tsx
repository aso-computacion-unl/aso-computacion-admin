import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { THEME_COLOR, THEME_INIT_SCRIPT, THEME_KEY } from "@/interface/theme/theme";

import "./globals.css";

/**
 * Runs right after the theme script: the admin opens in the light editorial theme unless the user has chosen
 * one. Scoped to `/admin` and its sub-routes, so the forum, the login and the invitation page keep following
 * the system. `AdminThemeDefault` applies the same rule on client-side navigations, where this does not rerun.
 */
const ADMIN_LIGHT_DEFAULT_SCRIPT = `(function(){var p=location.pathname;if(p!=="/admin"&&p.indexOf("/admin/")!==0)return;var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(s==="light"||s==="dark")return;document.documentElement.dataset.theme="light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(THEME_COLOR.light)})})();`;

export const metadata: Metadata = {
  title: "ASO Computación — Admin",
  description: "Content administration for ASO Computación.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR.dark,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The pre-paint script sets data-theme on <html> before React hydrates, hence suppressHydrationWarning.
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ADMIN_LIGHT_DEFAULT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
