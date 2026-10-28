import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** The error of a sign-in, in the admin and in the forum: said once, in a red-tinted box with the icon, never by colour alone. */
export function AuthAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-2.5 rounded bg-signal/20 px-3.5 py-3 text-base leading-snug ring-1 ring-error/45 ring-inset", className)}>
      <Icon name="alert" className="mt-0.5 size-[1.125rem] shrink-0 text-error" />
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}
