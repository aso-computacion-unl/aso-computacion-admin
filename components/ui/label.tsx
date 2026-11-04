import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** `htmlFor` is a named prop, not left in the spread, so the label visibly points at its control. */
function Label({ className, htmlFor, children, ...props }: ComponentProps<"label">) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm leading-[1.3] font-[650] text-foreground", className)} {...props}>
      {children}
    </label>
  );
}

export { Label };
