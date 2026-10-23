import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** One stroke weight and one 24px grid for every icon (authored paths, no icon font). */
const PATHS = {
  events: "M6 7.25v9.5M18 11.25c0 4-12 2.5-12 5.5M3.75 5a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Zm0 14a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Zm10-10a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Z",
  faq: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0ZM9.5 9.5a2.5 2.5 0 1 1 3.6 2.25c-.75.4-1.1.9-1.1 1.75M12 16.75v.01",
  board: "M6 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3.25 3.25 0 0 1 0 5.6M18 14.4c1.9.7 3 2.4 3 5.1",
  pillars: "M4 9.5 12 4l8 5.5M6 11v7M10 11v7M14 11v7M18 11v7M4 20h16",
  share: "M3.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Zm9-6a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Zm0 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0ZM8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6",
  site: "M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5ZM3 9h18M6.5 6.5v.01M9.5 6.5v.01M7 13h6M7 16h10",
  home: "M4 11.5 12 5l8 6.5M6 10v9h12v-9",
  out: "M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14M10 12h10m0 0-3.5-3.5M20 12l-3.5 3.5",
  plus: "M12 5v14M5 12h14",
  chev: "m6 9 6 6 6-6",
  upload: "M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M12 15V4m0 0L8 8m4-4 4 4",
  left: "M19 12H5m0 0 6-6m-6 6 6 6",
  right: "M5 12h14m0 0-6-6m6 6-6 6",
  up: "M12 19V5m0 0-6 6m6-6 6 6",
  down: "M12 5v14m0 0 6-6m-6 6-6-6",
  star: "m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM9.25 12a2.75 2.75 0 1 0 5.5 0 2.75 2.75 0 0 0-5.5 0Z",
  "eye-off":
    "M4 4l16 16M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.3 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-1M10 10a2.75 2.75 0 0 0 3.9 3.9",
  x: "M6 6l12 12M18 6 6 18",
  alert: "M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.01",
  check: "m5 12.5 4.5 4.5L19 7.5",
  merge: "M3.75 5a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Zm0 14a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Zm10-7a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0ZM6 7.25v9.5M6 12h7.5",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  image:
    "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 16l4.5-4.5 4 4 3-3L20 17M9 9.5v.01",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  undo: "M9 7 4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H12",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
}

/** Decorative by default (`aria-hidden`): the control that holds it carries the accessible name. */
export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
