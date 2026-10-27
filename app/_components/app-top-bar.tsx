import Link from "next/link";
import type { ReactNode } from "react";

import { BrandIsotype } from "./brand-mark";

interface AppTopBarProps {
  /** The product's name in the brand display face: "Admin ASO" or "Foro". */
  productName: string;
  homeHref: string;
  /** Accessible name of the brand link. */
  homeLabel: string;
  /** Right side: the identity chip, or just the theme toggle for a visitor. */
  children: ReactNode;
}

/**
 * The one top bar of the admin and the forum: same height, brand position and type in both, with
 * who is signed in on the right. In the admin it spans the full width above the sidebar and the content
 * (the sidebar starts below it), so the brand sits at the same x in both products.
 */
export function AppTopBar({ productName, homeHref, homeLabel, children }: AppTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-muted px-4 shadow-[0_1px_0_var(--color-border)] sm:px-6">
      <Link href={homeHref} aria-label={homeLabel} className="flex items-center gap-3 rounded">
        <BrandIsotype width={26} height={29} />
        <span className="font-display text-lg tracking-[0.01em]">{productName}</span>
      </Link>
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </header>
  );
}
