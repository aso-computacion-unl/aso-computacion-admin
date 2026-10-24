import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm leading-[1.3] font-[650] text-foreground", className)} {...props} />;
}

export { Label };
