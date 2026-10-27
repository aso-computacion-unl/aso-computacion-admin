/** Shared constants of the local UI audit harness. Nothing here reads the environment. */

export const ADMIN_URL = "http://localhost:3000";
export const LANDING_URL = "http://localhost:4321";

/** The forum member the minted session belongs to (a row that `npm run seed:demo` creates). */
export const FORUM_MEMBER_EMAIL = "demo1@unl.edu.ec";

export const OUTPUT_DIR = "test-results/ui-audit";

export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Same key the pre-paint script reads (src/interface/theme/theme.ts); the landing uses it too. */
export const THEME_KEY = "aso-theme";

export type Theme = "dark" | "light";
export type ViewportName = "desktop" | "phone";

export interface Variant {
  viewport: ViewportName;
  theme: Theme;
  width: number;
  height: number;
}

export const DESKTOP_DARK: Variant = { viewport: "desktop", theme: "dark", width: 1440, height: 900 };

/** Dark is the user's theme, so it gets both viewports; light is only checked on desktop. */
export const VARIANTS: readonly Variant[] = [
  DESKTOP_DARK,
  { viewport: "phone", theme: "dark", width: 390, height: 844 },
  { viewport: "desktop", theme: "light", width: 1440, height: 900 },
];

export type Area = "admin" | "forum" | "landing";
export type Auth = "none" | "admin" | "forum";

export interface Target {
  area: Area;
  /** File-name stem and manifest name. */
  name: string;
  /** Absolute URL. */
  url: string;
  auth: Auth;
  /** A status other than 200 that is the point of the screen (a not-found page). */
  expectStatus?: number;
  notes?: string;
}

export interface Capture {
  area: Area;
  name: string;
  url: string;
  finalUrl: string;
  viewport: ViewportName;
  theme: Theme;
  file: string;
  status: number;
  consoleErrors: string[];
  horizontalOverflow: boolean;
  notes: string[];
}
