"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { GoogleButton } from "../../_components/google-button";

/**
 * The shared Google button with the pass's loading state: once it is clicked the browser spends a moment reaching
 * Google, and the button says so ("Abriendo Google…") and stops taking clicks. The link itself is untouched, so it
 * still works without JavaScript. A page restored from the back/forward cache comes back idle.
 */
export function PassGoogleButton({ href, children }: { href: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const element = box.current;
    const start = (event: MouseEvent) => {
      // A modified click opens Google in another tab or window: this page stays, so it must stay clickable.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      setOpening(true);
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setOpening(false);
    };

    element?.addEventListener("click", start);
    window.addEventListener("pageshow", restore);

    return () => {
      element?.removeEventListener("click", start);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  return (
    <div ref={box} className="pass-google" aria-busy={opening || undefined}>
      <GoogleButton href={href} className="min-h-14 w-full px-5 text-[1.0625rem]">{opening ? "Abriendo Google…" : children}</GoogleButton>
    </div>
  );
}
