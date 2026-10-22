import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The visual track and thumb. It reads the state of the `peer` checkbox that precedes it. */
export function SwitchTrack({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block h-6 w-11 shrink-0 rounded-full border border-mist/55 bg-muted",
        "transition-colors duration-200 ease-out",
        "after:absolute after:top-0.5 after:left-0.5 after:size-[1.125rem] after:rounded-full after:bg-mist",
        "after:transition-[translate,background-color] after:duration-200 after:ease-(--ease-reveal) after:content-['']",
        "peer-checked:border-sky peer-checked:bg-sky peer-checked:after:translate-x-5 peer-checked:after:bg-muted",
        "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-sky",
        "peer-disabled:opacity-50",
        className,
      )}
    />
  );
}

interface SwitchFieldProps extends Omit<ComponentProps<"input">, "type" | "children"> {
  label: ReactNode;
  description?: ReactNode;
}

/** A checkbox presented as a switch (`role="switch"`), with its label and an optional note. */
export function SwitchField({ label, description, className, ...props }: SwitchFieldProps) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2.5", className)}>
      <input type="checkbox" role="switch" className="peer sr-only" {...props} />
      <SwitchTrack className="mt-px" />
      <span className="grid leading-[1.3]">
        <b className="text-sm font-[650]">{label}</b>
        {description ? <small className="text-[0.8125rem] text-mist">{description}</small> : null}
      </span>
    </label>
  );
}
