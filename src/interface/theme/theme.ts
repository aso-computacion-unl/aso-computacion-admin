/**
 * Light/dark theme. The pre-paint script below (inlined in the root layout) and `resolveTheme` apply the
 * same rule; the toggle only flips the choice afterwards. Same storage key as the landing, so the choice
 * is shared conceptually between both sites.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "aso-theme";

/** Browser chrome colour per theme: the surface of the sidebar and mobile header. */
export const THEME_COLOR: Record<Theme, string> = { dark: "#03224a", light: "#e4ebf4" };

/** A stored choice wins; otherwise follow the system, defaulting to the dark brand look unless it asks for light. */
export function resolveTheme(stored: string | null, prefersLight: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;

  return prefersLight ? "light" : "dark";
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Runs in the `<head>` before the first paint, so there is no flash of the other theme. Plain ES5 on purpose. */
export const THEME_INIT_SCRIPT = `(function(){var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}var t=s==="light"||s==="dark"?s:window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?${JSON.stringify(THEME_COLOR.light)}:${JSON.stringify(THEME_COLOR.dark)})})();`;
