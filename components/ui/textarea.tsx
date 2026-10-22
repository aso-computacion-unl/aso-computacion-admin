import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { fieldClasses } from "./field-styles";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClasses, "resize-y leading-[1.45]", className)} {...props} />;
}

export { Textarea };
