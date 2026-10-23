import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { fieldClasses } from "./field-styles";

function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  const mono = type === "date" || type === "time";

  return <input type={type} className={cn(fieldClasses, mono && "font-mono text-[0.9375rem]", className)} {...props} />;
}

export { Input };
