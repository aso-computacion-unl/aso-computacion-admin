import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/interface/theme/theme";

import "./globals.css";

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
      </head>
      <body>{children}</body>
    </html>
  );
}
