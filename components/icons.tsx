import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/** One stroke weight and one 24px grid for every icon (authored paths, no icon font). */
const PATHS = {
  events: "M6 7.25v9.5M18 11.25c0 4-12 2.5-12 5.5M3.75 5a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Zm0 14a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Zm10-10a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0Z",
  news: "M5 4h11a1 1 0 0 1 1 1v15M5 4a1 1 0 0 0-1 1v13.5A1.5 1.5 0 0 0 5.5 20H19a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-2M7.5 8h6M7.5 11.5h6M7.5 15h3.5",
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
  search: "M4 11a7 7 0 1 0 14 0 7 7 0 0 0-14 0ZM20 20l-4.2-4.2",
  sun: "M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.64 5.64l1.06 1.06M17.3 17.3l1.06 1.06M5.64 18.36l1.06-1.06M17.3 6.7l1.06-1.06",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  lock: "M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8 11V7a4 4 0 0 1 8 0v4",
  dot: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0ZM12 12v.01",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M19 4h-9M14 20H5M15 4 9 20",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  terminal: "m4 17 6-6-6-6M12 19h8",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  reply: "m15 10 5 5-5 5M4 4v7a4 4 0 0 0 4 4h12",
  msg: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  undo: "M9 7 4.5 11.5 9 16M5 11.5h9.5a5 5 0 0 1 0 10H12",
  users:
    "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M6.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.65a3.5 3.5 0 0 1 0 6.7",
  history: "M3 12a9 9 0 1 0 2.64-6.36L3 8.3M3 3.5v4.8h4.8M12 7.5V12l3 2",
  sliders: "M4 7h10M18 7h2M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM4 17h2M10 17h10M6 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z",
  monitor: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 21h8M12 17v4",
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
