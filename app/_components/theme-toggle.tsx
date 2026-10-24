"use client";

import { useEffect, useSyncExternalStore } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
 * Light/dark switch, named by what it does: "Modo claro" with a sun while dark, "Modo oscuro" with a
 * moon while light. Both labels and icons are in the markup and CSS shows the current theme's pair (the
 * hidden one is `display: none`, so screen readers get the same name), with no flicker before hydration.
 */
export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "dark" as Theme);

  // The inline script may run before the theme-color tag exists; keep the browser chrome in step once mounted.
  // Read the DOM, not `theme`: during hydration `theme` is still the server snapshot ("dark").
  useEffect(() => applyThemeColor(currentTheme()), [theme]);

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
      title={showLabel ? undefined : "Cambiar tema"}
      onClick={toggle}
      className={className}
    >
      <Icon name="sun" className="theme-dark-only" />
      <Icon name="moon" className="theme-light-only" />
      <span className={cn(!showLabel && "sr-only", "theme-dark-only")}>Modo claro</span>
      <span className={cn(!showLabel && "sr-only", "theme-light-only")}>Modo oscuro</span>
    </Button>
  );
}
