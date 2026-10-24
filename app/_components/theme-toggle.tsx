"use client";

import { useEffect, useSyncExternalStore } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { nextTheme, THEME_COLOR, THEME_KEY, type Theme } from "@/interface/theme/theme";

/** The pre-paint script writes the theme on `<html>`; every toggle on the page reads it from there. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return () => observer.disconnect();
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyThemeColor(theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

interface ThemeToggleProps {
  /** Show "Modo oscuro" as visible text (the sidebar); otherwise the button is icon-only. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Light/dark switch. `aria-pressed` is "dark mode is on". The icon is the theme the button switches to,
 * sun while dark and moon while light; both are in the markup and CSS picks one, so there is no flicker
 * before hydration.
 */
export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "dark" as Theme);

  // The inline script may run before the theme-color tag exists; keep the browser chrome in step once mounted.
  useEffect(() => applyThemeColor(theme), [theme]);

  function toggle() {
    const next = nextTheme(currentTheme());

    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice lasts for this page only.
    }

    document.documentElement.dataset.theme = next;
    applyThemeColor(next);
  }

  return (
    <Button
      type="button"
      variant="quiet"
      size={showLabel ? "default" : "icon"}
      data-theme-toggle
      aria-pressed={theme === "dark"}
      aria-label={showLabel ? undefined : "Modo oscuro"}
      title={showLabel ? undefined : "Modo oscuro"}
      onClick={toggle}
      className={className}
    >
      <Icon name="sun" className="theme-dark-only" />
      <Icon name="moon" className="theme-light-only" />
      {showLabel ? <span>Modo oscuro</span> : null}
    </Button>
  );
}
