import type { ComponentProps } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { fieldClasses } from "./field-styles";

/** Native `<select>` (the best picker on a phone) with the field look and a drawn chevron. */
function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select className={cn(fieldClasses, "cursor-pointer appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <Icon name="chev" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-mist" />
    </span>
  );
}

export { Select };
