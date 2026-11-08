"use client";

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "light" | "dark";
      language: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | undefined;

function turnstileApi(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

/** Loads Cloudflare's script once per page; a failed load is forgotten, so the next mount can try again. */
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const ready = () => {
      const api = turnstileApi();

      return api ? resolve(api) : reject(new Error("Turnstile did not start"));
    };

    if (turnstileApi()) return ready();

    const script = document.createElement("script");

    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error("Turnstile did not load"));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });

  return loading;
}

interface TurnstileWidgetProps {
  siteKey: string;
  /** The token once the visitor passes the check, or `null` when it expires or fails. */
  onToken: (token: string | null) => void;
  /** The widget could not start, or Cloudflare reported an error. */
  onError: () => void;
  /** A token works once: every increment asks Cloudflare for a new check. */
  resetCount: number;
}

/** Cloudflare Turnstile, rendered explicitly into a box tall enough that the form does not jump when it appears. */
export function TurnstileWidget({ siteKey, onToken, onError, resetCount }: TurnstileWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const callbacks = useRef({ onToken, onError });

  useEffect(() => {
    callbacks.current = { onToken, onError };
  });

  useEffect(() => {
    let cancelled = false;

    loadTurnstile().then(
      (api) => {
        if (cancelled || !container.current) return;

        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          // The pass's tear-off is navy in both themes, so the check is always the dark one.
          theme: "dark",
          language: "es",
          callback: (token) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(null),
          "error-callback": () => {
            callbacks.current.onToken(null);
            callbacks.current.onError();
          },
        });
      },
      () => {
        if (!cancelled) callbacks.current.onError();
      },
    );

    return () => {
      cancelled = true;

      if (widgetId.current) turnstileApi()?.remove(widgetId.current);

      widgetId.current = undefined;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetCount > 0 && widgetId.current) turnstileApi()?.reset(widgetId.current);
  }, [resetCount]);

  return <div ref={container} className="min-h-[65px]" />;
}
