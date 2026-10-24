import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * One button vocabulary for the whole admin. `aria-disabled` (not `disabled`) is how a blocked
 * action stays focusable and can explain itself; it gets the dashed, inactive look.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded border border-transparent",
    "font-bold font-stretch-[114%] leading-[1.1] select-none cursor-pointer",
    "transition-colors duration-150 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-40",
    "aria-disabled:cursor-not-allowed aria-disabled:border-dashed aria-disabled:border-mist/60 aria-disabled:bg-transparent aria-disabled:text-mist aria-disabled:hover:bg-transparent",
    "data-[busy=true]:pointer-events-none data-[busy=true]:opacity-80 data-[busy=true]:disabled:opacity-80",
    "data-[busy=true]:before:size-4 data-[busy=true]:before:animate-spin data-[busy=true]:before:rounded-full data-[busy=true]:before:border-2 data-[busy=true]:before:border-current data-[busy=true]:before:border-r-transparent data-[busy=true]:before:content-['']",
    "[&_svg]:size-5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-sky-bright active:bg-sky-press",
        line: "border-sky text-foreground hover:bg-sky/15 active:bg-sky/30",
        quiet: "font-semibold font-stretch-100 text-mist hover:bg-foreground/8 hover:text-foreground",
        danger: "bg-destructive text-destructive-foreground hover:bg-signal-press",
      },
      size: {
        default: "min-h-11 px-4.5 text-[0.9375rem]",
        sm: "min-h-10 px-3 text-[0.8125rem] font-semibold font-stretch-100",
        icon: "size-11 p-0",
        "icon-sm": "size-10 p-0 border-mist/30",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element (a `Link`) with the button's look instead of a `<button>`. */
  asChild?: boolean;
  /** Spinner and no pointer events while a server action runs. */
  busy?: boolean;
}

function Button({ className, variant, size, asChild = false, busy = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-busy={busy || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
