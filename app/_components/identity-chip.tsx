"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { initialsOf } from "@/interface/forum/forum-display";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./theme-toggle";

/**
 * The name the top bar shows. A four-part name (two given names, two surnames, the usual form in Ecuador)
 * becomes the first given name and the first surname; a shorter one stays whole, because three parts could
 * be either two given names or two surnames. The full name is in the menu.
 */
export function chipName(name: string): string {
  const parts = name.trim().split(/\s+/);

  return parts.length >= 4 ? `${parts[0]} ${parts[2]}` : parts.join(" ");
}

interface IdentityChipProps {
  /** The signed-in person's name; absent for the emergency session, which has no account. */
  name?: string;
  /** The role pill: "Administrador", "Editor", "Estudiante UNL", or the emergency label. */
  roleLabel: string;
  /** The password session: a signal-red pill and avatar replace the name and the role. */
  emergency?: boolean;
  /** Explains the session at the top of the menu (the emergency access). */
  notice?: string;
  /** The sign-out control, a form or a button, rendered by the caller because each product signs out its own way. */
  signOut: ReactNode;
}

const PILL = "rounded-full px-2.5 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap";

/**
 * Who is signed in, header-right in both products: avatar, name and role pill (avatar only on a phone).
 * It opens a disclosure with the theme toggle and the sign-out. The panel is always in the markup, hidden
 * while closed, so it is out of the tab order and the accessibility tree until it opens. Opening moves the
 * focus into it; Escape, a click outside or tabbing away closes it, and Escape returns the focus to the chip.
 */
export function IdentityChip({ name, roleLabel, emergency = false, notice, signOut }: IdentityChipProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    panel.current?.querySelector<HTMLElement>("button, a[href]")?.focus();

    const isOutside = (target: EventTarget | null) => !root.current?.contains(target as Node | null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const closeOutside = (event: Event) => {
      if (isOutside(event.target)) setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [open]);

  const accessibleName = emergency ? `Menú de cuenta: ${roleLabel}` : `Menú de cuenta: ${name}, ${roleLabel}`;

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={accessibleName}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2.5 rounded px-1.5 transition-colors duration-150 ease-out hover:bg-foreground/8 aria-expanded:bg-foreground/8 sm:justify-start sm:px-2"
      >
        <Avatar name={name} emergency={emergency} />
        {emergency ? (
          <span className={cn(PILL, "hidden bg-destructive text-destructive-foreground sm:inline")}>{roleLabel}</span>
        ) : (
          <>
            <span title={name} className="hidden max-w-48 truncate text-sm font-semibold sm:inline">
              {chipName(name ?? "")}
            </span>
            <span className={cn(PILL, "hidden border border-border text-mist sm:inline")}>{roleLabel}</span>
          </>
        )}
        <Icon name="chev" className={cn("hidden size-4 text-mist transition-transform duration-150 ease-out sm:block", open && "rotate-180")} />
      </button>
      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-card p-2 shadow-[0_14px_32px_-10px_rgb(0_0_0/0.55)]"
      >
        <div className="grid gap-1.5 px-3 pt-2 pb-3">
          {emergency ? (
            <>
              <span className={cn(PILL, "w-fit bg-destructive text-destructive-foreground")}>{roleLabel}</span>
              {notice ? <p className="text-sm leading-snug text-mist">{notice}</p> : null}
            </>
          ) : (
            <div className="grid gap-1">
              <span className="text-sm font-semibold wrap-anywhere">{name}</span>
              <span className={cn(PILL, "w-fit border border-border text-mist")}>{roleLabel}</span>
            </div>
          )}
        </div>
        <div className="grid gap-0.5 border-t border-border pt-2">
          <ThemeToggle showLabel className="w-full justify-start" />
          {signOut}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, emergency }: { name?: string; emergency: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
        emergency ? "bg-destructive text-destructive-foreground" : "bg-card text-sky-bright ring-1 ring-border",
      )}
    >
      {emergency ? <Icon name="alert" className="size-4" /> : initialsOf(name ?? "")}
    </span>
  );
}
