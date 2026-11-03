import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { GoogleMark } from "./google-mark";
import "./google-button.css";

interface GoogleButtonProps {
  /** Where the redirect flow starts (`/foro/auth/google/start` with its `next`, or the admin's `/auth/google/start`). */
  href: string;
  children: ReactNode;
  className?: string;
}

/**
 * The one Google button of the app (forum and admin login): Google's own white button in both themes (colours are the
 * `.google-button` tokens in google-button.css, drawn from Google's sign-in branding rules, not from the brand
 * palette). Every place that offers "Entrar con Google" uses this so they cannot drift.
 *
 * A plain link, not next/link: it starts a redirect flow and must not be prefetched.
 */
export function GoogleButton({ href, children, className }: GoogleButtonProps) {
  return (
    <a href={href} className={cn("google-button inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded px-6 font-bold", className)}>
      <GoogleMark className="size-5" />
      {children}
    </a>
  );
}
