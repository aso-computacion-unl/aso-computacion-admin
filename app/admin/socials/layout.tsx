import type { ReactNode } from "react";

// Styling lives in the Tailwind classes of each page and in `../timeline.css`; this only passes through.
export default function ModuleLayout({ children }: { children: ReactNode }) {
  return children;
}
