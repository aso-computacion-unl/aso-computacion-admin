import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "ASO Computación — Admin",
  description: "Content administration for ASO Computación.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#03224a",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
