import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const VARIANTS = {
  /** A section of a page: the panel, the gallery, a block of the home. */
  section: "text-lg font-bold font-stretch-[112%]",
  /** A quiet group label over a list: the commit groups, the registrations tables. */
  label: "text-[0.8125rem] font-bold font-stretch-[118%] tracking-[0.04em] text-mist uppercase",
} as const;

interface SectionTitleProps extends ComponentProps<"h2"> {
  variant?: keyof typeof VARIANTS;
}

/** The one level-2 heading of the admin, so a section looks the same on every screen. */
export function SectionTitle({ variant = "section", className, ...props }: SectionTitleProps) {
  return <h2 className={cn(VARIANTS[variant], className)} {...props} />;
}
